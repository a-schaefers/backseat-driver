import type { Elements, RenderChildren } from 'claude-code'

import type { ExplainView, LessonsView, LessonView, Mode, Note, OutlineRow, Profile, Profiles, ProgressRecord, ProgressView, Review, ReviewText, SettingRow, Speech, Tab, Watch, Working } from '../types'
import { bubbleColumn, bubbleWidth, isTalking, poseOf, saidSoFar, wordsSaid } from '../core/avatar'
import type { Avatar } from '../core/avatar'
import { artShape, characterArt } from './character'
import type { Backdrop } from '../core/sprite'
import { languageName } from '../core/languages'
import { isProblem, sortNotes } from '../core/notes'
import { ANSWER_LABELS, explained, GENERAL, recurring } from '../core/profiles'
import { encouragementLine, growthCounts, growthHeadline, growthLadder, growthMeterLabel, helpLine, improvedLine, raiseLine, rungWord, workOnLine } from '../core/growth'
import type { Growth, GrowthBand } from '../core/growth'
import { lessonLanguage, lessonProgress } from '../core/lessons'
import { lately, levelPhrase } from '../core/progress'
import { readableReview, shownReview, spotsIn, SURVEY_SUBJECT } from '../core/review'
import { DEFAULT_PERSONA } from '../core/settings'
import { clockTime, playLine } from '../core/status'
import type { Persona } from '../core/settings'

/** The elements the pane is built from. Every surface that draws panes has them, save `Select`, which some lack, and `Raster`, which only the terminal has. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button' | 'Markdown'> & Partial<Pick<Elements['terminal'], 'Select' | 'Raster'>>

/** Everything the pane shows, as plain data. */
export type PaneView = {
  mode: Mode
  tab: Tab
  persona: Persona
  notes: readonly Note[]
  /** The id of the note the keys act on, or null for the first one. */
  selected: number | null
  watch: Watch
  /** False when the play-by-play only looks on request. */
  isAutomatic: boolean
  review: Review
  /** When a deep review runs without being asked, in a few words: "after each commit". */
  reviewSchedule: string
  profiles: Profiles
  explain: ExplainView
  /** What they are working on: what they said, what a look made of it, and where their activity is. */
  working: Working
  progress: ProgressView
  /** Growth in each language in play that has a record, worked out for the Growth tab. Empty on the other tabs. */
  growth?: readonly { language: string; growth: Growth }[]
  /** The Lessons tab: the paths, where they are in each, and the one opened. */
  lessons?: LessonsView
  /** What to say about a newer release, or ''. */
  update: string
  /** What to say about the license, or ''. Optional: most of the time there is nothing. */
  license?: string
  /** True while the pane has the keyboard, which is when its keys work. */
  isFocused: boolean
  /** How wide the pane's body is, in columns. */
  columns: number
  /** The voice's animated character and what it is saying, or null while the animation is off. */
  character: { avatar: Avatar; speech: Speech; backdrop?: Backdrop } | null
  /** True where rows are scarce, as in a pane above the prompt: the character is then drawn in one line. */
  isCompact: boolean
  /** Which list opened downward is open: `jump:<subject>` or `setting:<key>`, or '' while every one is folded. */
  openList?: string
  /** How many rows the terminal has, as far as the drawing knows. */
  rows: number
  /** The plugin's own `/config` rows, for the Settings tab. */
  settings: readonly SettingRow[]
}

/** What the pane's controls do. The closures come from register.tsx. */
export type PaneActions = {
  onTab: (tab: Tab) => void
  onSelect: (id: number) => void
  onExplain: (note: Note) => void
  onDismiss: (note: Note) => void
  /** Stop bringing up this kind of note, for good. */
  onMute: (note: Note) => void
  onLook: () => void
  onReview: () => void
  onUnhush: (subject: string, topic: string) => void
  /** Ask the first-run questions again, for everything in play. */
  onQuestions: () => void
  /** Move the Explain tab's focus to the next symbol of the file, or the previous one. */
  onExplainMove: (step: 1 | -1) => void
  /** Look up what is in focus now, whatever the Explain setting says. */
  onExplainFetch: () => void
  /** Take what is in focus to the conversation. */
  onExplainAsk: () => void
  /** Ask what they are working on, so that they can say it themselves or take it back. */
  onWorking: () => void
  /** Select the next note in the order they are drawn, or the previous one. */
  onStep: (step: 1 | -1) => void
  /** Change one of the plugin's `/config` rows to the value picked. */
  onSetting: (row: SettingRow, value: string) => void
  /** Open a path in the Lessons tab, or go back to the list with null. */
  onLessonOpen?: (id: string | null) => void
  /** Start the next step of a path: it is taught in the conversation. */
  onLessonStart?: (id: string) => void
  /** They did the next step of a path, by their word. */
  onLessonDone?: (id: string) => void
  /** Deep review: show an older review (1) or a newer one (-1). */
  onReviewStep?: (step: 1 | -1) => void
  /** Open a place a review or a note names in the Explain tab. */
  onJump?: (path: string, line: number) => void
  /** Open the list of places the review names, or fold it again. */
  onJumpFold?: (subject: string) => void
  /** Open a setting's options under its row, or fold them again. */
  onSettingFold?: (key: string) => void
  /** Put the pane away as a strip above the prompt. The tutor stays on. */
  onMinimize?: () => void
  /** Explain: put the symbol that starts at this line in focus. */
  onExplainPick?: (line: number) => void
  /** Open a place in the person's own editor. Present only while `editor_command` is set. */
  onOpen?: (path: string, line: number) => void
}

const TABS: readonly { tab: Tab; label: string; short: string; tiny: string; hotkey: string }[] = [
  { tab: 'play', label: 'Play-by-play', short: 'Play', tiny: 'Play', hotkey: '1' },
  { tab: 'review', label: 'Deep review', short: 'Review', tiny: 'Review', hotkey: '2' },
  { tab: 'explain', label: 'Explain', short: 'Explain', tiny: 'Expl', hotkey: '3' },
  // Still `profile` inside: the tab grew from the Profile tab, then the Progress tab, and its key is what tests and muscle memory press.
  { tab: 'profile', label: 'Growth', short: 'Growth', tiny: 'Growth', hotkey: '4' },
  { tab: 'lessons', label: 'Lessons', short: 'Lessons', tiny: 'Lessons', hotkey: '5' },
  { tab: 'settings', label: 'Settings', short: 'Settings', tiny: 'Set', hotkey: '6' },
]

const NEW = ' (new)'
/** Something is under way behind the tab: a review, a lookup, an assessment. */
const BUSY = ' (…)'
/** Something behind the tab did not go to plan and waits to be looked at. */
const TROUBLE = ' (!)'

/**
 * What a tab says about what is behind it, after its name: how many notes
 * are open, that a review is new, running or stuck, that Explain or Progress
 * is at work. '' when there is nothing to say.
 */
export function tabBadge(tab: Tab, view: Partial<Pick<PaneView, 'notes' | 'review' | 'explain' | 'progress'>>): string {
  if (tab === 'play') return view.notes === undefined || view.notes.length === 0 ? '' : ` (${view.notes.length})`
  if (tab === 'review') {
    const review = view.review
    if (review === undefined) return ''
    if (review.isUnseen) return NEW

    return review.state === 'running' ? BUSY : review.state === 'failed' ? TROUBLE : ''
  }
  if (tab === 'explain') return view.explain?.status === 'updating' ? BUSY : ''
  if (tab === 'settings' || tab === 'lessons') return ''

  return view.progress !== undefined && view.progress.busy !== '' ? BUSY : ''
}

/**
 * The tabs' labels and the gap between them. The full names are used when
 * the row fits the pane, and the short ones when it does not, so that the
 * tabs never wrap onto a second line. What a tab says about itself is kept
 * for as long as the row has room for it.
 */
export function tabRow(
  view: Pick<PaneView, 'columns' | 'review'> & Partial<Pick<PaneView, 'notes' | 'explain' | 'progress'>>,
): { labels: string[]; gap: number } {
  // A button draws as its key, a colon, a space and its label.
  const fits = (labels: readonly string[], gap: number): boolean =>
    labels.reduce((sum, label) => sum + label.length + 3, 0) + gap * (TABS.length - 1) <= view.columns
  const full = TABS.map(({ tab, label }) => `${label}${tabBadge(tab, view)}`)
  if (fits(full, 3)) return { labels: full, gap: 3 }
  const short = TABS.map(({ tab, short: name }) => `${name}${tabBadge(tab, view)}`)
  if (fits(short, 2)) return { labels: short, gap: 2 }
  if (fits(short, 1)) return { labels: short, gap: 1 }

  // No room for everything: the review's badge is the one that asks for a look, so it stays.
  const reviewOnly = TABS.map(({ tab, short: name }) => (tab === 'review' ? `${name}${tabBadge(tab, view)}` : name))
  if (fits(reviewOnly, 2)) return { labels: reviewOnly, gap: 2 }
  if (fits(reviewOnly, 1)) return { labels: reviewOnly, gap: 1 }

  // Narrower than a docked pane: the longest names give way, and still the review's badge stays.
  const tinyWithBadge = TABS.map(({ tab, tiny }) => (tab === 'review' ? `${tiny}${tabBadge(tab, view)}` : tiny))
  if (fits(tinyWithBadge, 1)) return { labels: tinyWithBadge, gap: 1 }

  // Not even that (a 57-column dock with "(new)", seen 2026-10-05, wrapped "Set" onto the status line): the
  // review's badge shrinks to one mark, which still says there is something to read.
  return { labels: TABS.map(({ tab, tiny }) => (tab === 'review' && tabBadge(tab, view) !== '' ? `${tiny}*` : tiny)), gap: 1 }
}

/** Shown while the pane does not have the keyboard: its keys do nothing until it does. */
export const KEYBOARD_HINT = 'Click here or press Ctrl+X Tab to use the keys.'

/** Shown while the pane has the keyboard: how it is driven. */
export const FOCUSED_HINT = 'Tab moves · Enter presses · 1–6 open a tab · Esc goes back to the prompt.'

/**
 * One grammar for everything that can be pressed, so that a glance says what
 * is a control (owner, 2026-10-05: "what can i click on, what the keys are"):
 * a control with a key reads `k: label`, one without reads `[ label ]`, a row
 * of a list reads `▸ …` (`❯ …` the one the keys act on). Every tab ends with
 * its controls under a rule, and the last row says whether the keys work.
 */

/** A thin rule across the pane, setting one part apart from the next. */
function rule({ Text }: Pick<Kit, 'Text'>, columns: number) {
  return <Text dimColor>{'─'.repeat(Math.max(1, columns))}</Text>
}

/** A tab's controls, in one row at its end under a rule, the same place on every tab. A rule costs the row a blank would, so it is drawn compact too. */
function controlsRow({ Box, Text }: Pick<Kit, 'Box' | 'Text'>, view: Pick<PaneView, 'columns'>, controls: readonly RenderChildren[]) {
  return (
    <Box flexDirection="column">
      {rule({ Text }, view.columns)}
      <Box flexDirection="row" columnGap={3} flexWrap="wrap">
        {controls}
      </Box>
    </Box>
  )
}

/** The last row: whether the keys work now, and how the pane is driven. On every tab, since nothing else says it. */
function keysRow({ Box, Text, Button }: Pick<Kit, 'Box' | 'Text' | 'Button'>, view: Pick<PaneView, 'isFocused'>, actions: Pick<PaneActions, 'onMinimize'>) {
  return (
    <Box flexDirection="row" columnGap={2}>
      {actions.onMinimize !== undefined && (
        <Box flexShrink={0}>
          <Button key="minimize" label="minimize" hotkey="x" plain onPress={() => actions.onMinimize?.()} />
        </Box>
      )}
      <Box flexDirection="row" columnGap={1} flexShrink={1}>
        {/* The word that says where the keyboard is keeps its width, and only the hint after it gives way (seen live: "Keys" with the "on" squeezed out). */}
        <Box flexShrink={0}>
          <Text bold color={view.isFocused ? 'green' : 'yellow'}>
            {view.isFocused ? 'Keys on' : 'Keys off'}
          </Text>
        </Box>
        <Text dimColor wrap="truncate-end">
          {view.isFocused ? FOCUSED_HINT : KEYBOARD_HINT}
        </Text>
      </Box>
    </Box>
  )
}

/** How far along the tab row the open tab's label runs: the columns before it, its own, and the rest of the row. A button draws as its key, a colon, a space and its label. */
export function underlineSpans(labels: readonly string[], gap: number, withDigits: boolean, open: number, columns: number): { before: number; active: number; after: number } {
  const widths = labels.map(label => label.length + (withDigits ? 3 : 0))
  const before = widths.slice(0, open).reduce((sum, width) => sum + width, 0) + gap * Math.max(0, open)
  const active = widths[open] ?? 0

  return { before, active, after: Math.max(0, columns - before - active) }
}

/** The rule under the tabs, heavy and in the accent color under the open one: what makes the row read as a tab bar. */
function tabUnderline({ Box, Text }: Pick<Kit, 'Box' | 'Text'>, view: Pick<PaneView, 'tab' | 'columns'>, row: { labels: string[]; gap: number }) {
  const spans = underlineSpans(
    row.labels,
    row.gap,
    true,
    TABS.findIndex(entry => entry.tab === view.tab),
    view.columns,
  )

  return (
    <Box flexDirection="row">
      {spans.before > 0 && <Text dimColor>{'─'.repeat(spans.before)}</Text>}
      {spans.active > 0 && <Text color="claude">{'━'.repeat(spans.active)}</Text>}
      {spans.after > 0 && <Text dimColor>{'─'.repeat(spans.after)}</Text>}
    </Box>
  )
}

/** The mark before the status line: a light for what the play-by-play is doing, as the editors have one. */
export function stateMark(view: Pick<PaneView, 'mode' | 'watch'>): { mark: string; color: string | undefined } {
  if (view.mode === 'paused') return { mark: '○', color: undefined }
  switch (view.watch.state) {
    case 'looking':
    case 'settling':
      return { mark: '◐', color: 'yellow' }
    case 'waiting':
      return { mark: '◌', color: 'yellow' }
    case 'no-git':
      return { mark: '○', color: 'red' }
    case 'starting':
      return { mark: '◌', color: undefined }
    case 'idle':
      return { mark: '●', color: 'green' }
  }
}

/** What the play-by-play is doing. The sentence is worked out where its state is (`status.ts`). */
function watching(view: PaneView): string {
  // The mode reaches the pane a moment before the line that goes with it.
  return view.mode === 'paused' ? playLine({ at: 'paused' }) : view.watch.line
}

/** The persona in a few words, leaving out a half that is the default. '' when both are. */
export function personaLine({ voice, engineering }: Persona): string {
  if (voice === engineering) return voice === DEFAULT_PERSONA ? '' : `Voice and engineering: ${voice}.`
  if (engineering === DEFAULT_PERSONA) return `Voice: ${voice}.`
  if (voice === DEFAULT_PERSONA) return `Engineering: ${engineering}.`

  return `Voice: ${voice}. Engineering: ${engineering}.`
}

/** The one line under the tabs: whether the tutor is looking, in what voice and with whose judgment. */
export function statusLine(view: PaneView): string {
  const persona = personaLine(view.persona)

  return persona === '' ? watching(view) : `${watching(view)} ${persona}`
}

/** What the "Working on" line says before there is anything to go on. */
export const NOT_CLEAR = '(not clear yet)'

/**
 * What the person is working on, and how the tutor knows: their own words
 * first, then what a look made of their activity, then where the activity is.
 * The head follows "Working on" and reads as one phrase with it.
 */
export function workingLines(working: Working): { head: string; tail: string } {
  const lately = working.where === '' ? '' : ` Lately: ${working.where}.`
  if (working.said !== '') {
    return { head: working.said, tail: `You said so${working.saidAgo === '' ? '' : ` ${working.saidAgo}`}.${lately}` }
  }
  if (working.inferred !== '') return { head: working.inferred, tail: `Worked out from your activity.${lately}` }
  if (working.where !== '') {
    return { head: working.where, tail: working.share === '' ? 'From your activity.' : `From your activity: ${working.share}.` }
  }

  return { head: NOT_CLEAR, tail: '' }
}

function workingOn({ Box, Text, Button }: Kit, view: PaneView, actions: PaneActions) {
  const { head, tail } = workingLines(view.working)

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Box flexShrink={0}>
          <Text dimColor>Working on:</Text>
        </Box>
        <Box flexShrink={1}>
          <Text wrap="truncate-end">{head}</Text>
        </Box>
        <Box flexShrink={0} marginLeft={1}>
          <Button key="working" label={head === NOT_CLEAR ? 'say what' : 'change'} hotkey="w" plain onPress={() => actions.onWorking()} />
        </Box>
      </Box>
      {tail !== '' && !view.isCompact && (
        <Text dimColor wrap="truncate-end">
          {tail}
        </Text>
      )}
    </Box>
  )
}

/**
 * The notes in the order they are drawn: decision points first,
 * as theirs to make, then what will or may break and what reads better,
 * then insights.
 */
export function drawnOrder(notes: readonly Note[]): Note[] {
  const sorted = sortNotes(notes)

  return [
    ...sorted.filter(note => note.kind === 'decision'),
    ...sorted.filter(note => isProblem(note.kind)),
    ...sorted.filter(note => note.kind === 'insight'),
  ]
}

/** The note the keys act on: the selected one if it is still open, otherwise the first one drawn. */
export function currentNote(view: Pick<PaneView, 'notes' | 'selected'>): Note | undefined {
  const drawn = drawnOrder(view.notes)

  return drawn.find(note => note.id === view.selected) ?? drawn[0]
}

/** The note `step` away from the current one, in the order they are drawn, wrapping round. */
export function steppedNote(view: Pick<PaneView, 'notes' | 'selected'>, step: 1 | -1): Note | undefined {
  const drawn = drawnOrder(view.notes)
  const at = drawn.findIndex(note => note.id === currentNote(view)?.id)
  if (at === -1) return undefined

  return drawn[(at + step + drawn.length) % drawn.length]
}

/** When deep reviews run by themselves, from the two trigger settings. */
export function reviewSchedule(isAfterCommit: boolean, everyMs: number): string {
  const minutes = Math.round(everyMs / 60_000)
  const timer = minutes === 1 ? 'every minute' : `every ${minutes} minutes`
  if (isAfterCommit) return everyMs > 0 ? `after each commit and ${timer}` : 'after each commit'

  return everyMs > 0 ? timer : 'only when you ask'
}

/** Said by a character while the tutor is paused. */
export const ASLEEP = 'z z z'

/**
 * The animated persona: the drawing in its current pose, with its speech
 * bubble beside it. It is dim while it rests and lights up while it talks.
 */
function characterRow(kit: Kit, view: PaneView, { avatar, speech, backdrop }: { avatar: Avatar; speech: Speech; backdrop?: Backdrop }) {
  const { Box, Text } = kit
  const pose = poseOf(view.mode, view.watch.state, speech)
  const isResting = !isTalking(speech)
  const isAsleep = view.mode === 'paused'
  const shape = artShape(kit, avatar)
  const width = bubbleWidth(view.columns, shape.columns)

  if (view.isCompact || width === 0) {
    return (
      <Box flexDirection="row" columnGap={1}>
        <Text color={avatar.color} dimColor={isResting}>
          {avatar.mini[pose]}
        </Text>
        <Text dimColor={isAsleep} wrap="truncate-end">
          {isAsleep ? ASLEEP : saidSoFar(speech)}
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="row" columnGap={1}>
      {characterArt(kit, avatar, pose, isResting, backdrop)}
      <Box flexDirection="column">
        {isAsleep &&
          [...Array.from({ length: shape.mouth - 1 }, () => ' '), ASLEEP].map(line => <Text dimColor>{line}</Text>)}
        {!isAsleep &&
          speech.text !== '' &&
          bubbleColumn(avatar, speech.text, wordsSaid(speech), width, shape.mouth).map(line => (
            <Text wrap="truncate-end">{line}</Text>
          ))}
      </Box>
    </Box>
  )
}

/** What the Explain tab says while what it shows is not the whole story. Empty when it is. */
export function explainNotice(explain: ExplainView): string {
  switch (explain.status) {
    case 'fresh':
      return ''
    case 'updating':
      return explain.isOutlineCurrent || !explain.isMappable ? 'Looking this up.' : 'Mapping this file.'
    case 'waiting':
      return 'Not looked up yet. Lookups are on request: f fetches this.'
    case 'held':
      return 'Not looked up: you are close to your plan limit. f fetches this anyway.'
    case 'failed':
      return 'The last lookup failed. It is tried again in a minute, or press f.'
    case 'no-file':
      return 'There is no such file in this project.'
    case 'off':
      return 'Explain is switched off. Its setting is in /config.'
  }
}

/** One symbol of the outline on one line: its name, and as much of its summary as fits the pane. */
export function outlineLine(row: OutlineRow, isCurrent: boolean, columns: number): string {
  const start = `${isCurrent ? '>' : ' '} ${row.name}`
  const room = columns - start.length - 2
  if (row.summary === '' || room < 12) return start
  const summary = row.summary.length <= room ? row.summary : `${row.summary.slice(0, room - 1).trimEnd()}…`

  return `${start}  ${summary}`
}

/** An explanation as Markdown: one short paragraph per question it answers. */
export function detailMarkdown(detail: NonNullable<ExplainView['detail']>): string {
  const parts = [`**What** ${detail.what}`]
  if (detail.how !== '') parts.push(`**How** ${detail.how}`)
  if (detail.why !== '') parts.push(`**Why** ${detail.why}`)
  if (detail.watch !== '') parts.push(`**Watch** ${detail.watch}`)
  if (detail.uses.length > 0) parts.push(`**Relies on** ${detail.uses.join(', ')}`)

  return parts.join('\n\n')
}

/** What the Explain tab says about a file it knows nothing about yet. */
export const NOTHING_EXPLAINED = 'Nothing explained here yet: either this file has not been looked up, or it has no functions or classes to explain. f looks it up again, or run /bsd explain with a file and a line.'

/** The widest a symbol's name is drawn in the outline: longer names are cut, so that the summaries line up in a column. */
const NAME_COLUMNS = 24

/** How wide the outline's name column is: the longest name, cut at NAME_COLUMNS, plus its mark. */
export function nameColumns(outline: readonly OutlineRow[]): number {
  return 2 + Math.min(NAME_COLUMNS, outline.reduce((widest, row) => Math.max(widest, row.name.length), 0))
}

/** A name as the outline draws it: whole, or cut to NAME_COLUMNS with an ellipsis. */
export function outlineName(name: string): string {
  return name.length <= NAME_COLUMNS ? name : `${name.slice(0, NAME_COLUMNS - 1).trimEnd()}…`
}

/**
 * One symbol of the outline: its name in a column of its own, its summary
 * dim beside it, so that the names read as a list and the one in focus
 * stands out (owner, 2026-10-05: the rows "all look the same, becomes a
 * large blob of text"). The one in focus is marked and bold; the others
 * are rows to press.
 */
function outlineRow({ Box, Text, Button }: Pick<Kit, 'Box' | 'Text' | 'Button'>, row: OutlineRow, isCurrent: boolean, width: number, actions: PaneActions) {
  const name = outlineName(row.name)

  return (
    <Box flexDirection="row" columnGap={2}>
      <Box width={width} flexShrink={0}>
        {isCurrent ? (
          <Box flexDirection="row" columnGap={1}>
            <Text color="claude">❯</Text>
            <Text bold>{name}</Text>
          </Box>
        ) : actions.onExplainPick === undefined ? (
          <Text dimColor>{`▸ ${name}`}</Text>
        ) : (
          <Button key={`explain-row-${row.startLine}`} label={`▸ ${name}`} plain onPress={() => actions.onExplainPick?.(row.startLine)} />
        )}
      </Box>
      {row.summary !== '' && (
        <Text dimColor wrap="truncate-end">
          {row.summary}
        </Text>
      )}
    </Box>
  )
}

function explainTab({ Box, Text, Button, Markdown }: Kit, view: PaneView, actions: PaneActions) {
  const { explain } = view
  if (explain.spot === null) {
    return (
      <Box flexDirection="column">
        <Text dimColor>Nothing in focus yet.</Text>
        <Text dimColor>Save a file, or run /bsd explain with a file and a line.</Text>
      </Box>
    )
  }

  const { target, detail } = explain
  const spot = explain.spot
  // Nothing known about the file, and nothing on its way: say what to do rather than show an empty tab.
  const isBlank = target === null && explain.outline.length === 0 && explain.fileSummary === '' && explain.status === 'fresh'
  const notice = isBlank ? NOTHING_EXPLAINED : explainNotice(explain)
  const canFetch = isBlank || explain.status === 'waiting' || explain.status === 'held' || explain.status === 'failed'

  return (
    <Box flexDirection="column">
      <Text bold>{target === null ? explain.spot.path : `${explain.spot.path} · ${target.name}`}</Text>
      {target !== null && (
        <Text dimColor>
          {`${target.kind}, lines ${target.startLine} to ${target.endLine}`}
        </Text>
      )}
      <Box flexDirection="row" columnGap={3}>
        {explain.outline.length > 1 && <Button key="explain-next" label="next" hotkey="n" plain onPress={() => actions.onExplainMove(1)} />}
        {explain.outline.length > 1 && <Button key="explain-previous" label="previous" hotkey="p" plain onPress={() => actions.onExplainMove(-1)} />}
        {target !== null && <Button key="explain-ask" label="ask about this" hotkey="e" plain onPress={() => actions.onExplainAsk()} />}
        {canFetch && <Button key="explain-fetch" label="look this up" hotkey="f" plain onPress={() => actions.onExplainFetch()} />}
        {actions.onOpen !== undefined && <Button key="explain-open" label="open in editor" hotkey="o" plain onPress={() => actions.onOpen?.(spot.path, spot.line)} />}
      </Box>
      {/* The keys and the list stay at the top, so that a press moves the mark without moving the page (owner, 2026-10-05). */}
      {rule({ Text }, view.columns)}
      {explain.outline.length > 0 && <Text bold>In this file</Text>}
      {explain.outline.map(row =>
        outlineRow({ Box, Text, Button }, row, target !== null && row.startLine === target.startLine && row.endLine === target.endLine, nameColumns(explain.outline), actions),
      )}
      {explain.outline.length > 0 && rule({ Text }, view.columns)}
      {target === null && explain.fileSummary !== '' && <Text>{explain.fileSummary}</Text>}
      {target !== null && detail === null && target.summary !== '' && <Text>{target.summary}</Text>}
      {detail !== null && <Markdown key="explanation" text={detailMarkdown(detail)} />}
      {explain.insights.map(insight => (
        <Text>{`Deep review: ${insight}`}</Text>
      ))}
      {notice !== '' && <Text dimColor>{notice}</Text>}
      {!explain.isMappable && <Text dimColor>This file is too large to map, so only the lines around the cursor are explained.</Text>}
    </Box>
  )
}

/** What the Deep review tab says above the review: that one is running and since when, or why one did not finish. '' otherwise. */
export function reviewBanner(review: Review): string {
  if (review.state === 'running') {
    if (review.subject === SURVEY_SUBJECT) return 'Taking a first look around this project.'

    return review.since === undefined || review.since === 0 ? `Reviewing ${review.subject}.` : `Reviewing ${review.subject} since ${clockTime(review.since)}.`
  }
  if (review.state === 'failed') return `The review of ${review.subject} did not finish: ${review.text}`

  return ''
}

/** A subject such as "a first look around this project", as a heading. */
export function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** How many commits wait behind the one the banner is about, as a sentence, or ''. */
export function waitingLine(review: Review): string {
  const behind = (review.waiting ?? 0) - 1
  if (behind <= 0) return ''

  return behind === 1 ? 'One more commit is waiting for its review.' : `${behind} more commits are waiting for their reviews.`
}

/** What a review's history line says: which review of how many, and when it finished. */
export function reviewPlace(index: number, count: number, at: number | undefined): string {
  return `Review ${index + 1} of ${count}${at === undefined || at === 0 ? '' : ` · ${clockTime(at)}`}`
}

/** The places a review names, as `path:line`, for the person to jump to. */
export function reviewSpots(shown: Pick<ReviewText, 'text' | 'decisions' | 'insights'>): { path: string; line: number }[] {
  const named = shown.decisions.filter(decision => decision.line > 0).map(decision => `${decision.file}:${decision.line}`)

  return spotsIn([...named, shown.text, ...shown.insights].join('\n'))
}

/** The heading of a review's places, folded or open: "▸ Jump to a place (3)", "▾ Jump to a place (3)". */
export function jumpHeading(count: number, isOpen: boolean): string {
  return `${isOpen ? '▾' : '▸'} Jump to a place (${count})`
}

/**
 * The places a review names, as a list that opens downward rather than a
 * row that grows sideways (owner, 2026-10-05: "should be vertically stacked
 * … maybe even should be a kind of drop down menu"). One place is a row by
 * itself; more fold under a heading that opens them, one row each, and they
 * fold again on a jump or a change of tab.
 */
function jumpList({ Box, Button }: Pick<Kit, 'Box' | 'Button'>, view: Pick<PaneView, 'openList'>, subject: string, spots: readonly { path: string; line: number }[], actions: PaneActions) {
  const row = (spot: { path: string; line: number }, lead: string) => (
    <Button key={`jump-${spot.path}:${spot.line}`} label={`▸ ${lead}${spot.path}:${spot.line}`} plain onPress={() => actions.onJump?.(spot.path, spot.line)} />
  )
  if (spots.length === 1) return <Box flexDirection="column">{spots.map(spot => row(spot, 'Jump to '))}</Box>
  const isOpen = view.openList === `jump:${subject}`

  return (
    <Box flexDirection="column">
      <Button key="jump-list" label={jumpHeading(spots.length, isOpen)} plain onPress={() => actions.onJumpFold?.(subject)} />
      {isOpen && (
        <Box flexDirection="column" paddingLeft={2}>
          {spots.map(spot => row(spot, ''))}
        </Box>
      )}
    </Box>
  )
}

function deepReview({ Box, Text, Button, Markdown }: Kit, view: PaneView, actions: PaneActions) {
  const { review } = view
  const banner = reviewBanner(review)
  const behind = waitingLine(review)
  // What there is to read: the review opened in the history, the latest one when none is.
  const { shown, index, count } = shownReview(review)
  const isOlder = shown !== null && index === 0 && review.state !== 'done'
  const spots = shown === null || actions.onJump === undefined ? [] : reviewSpots(shown)

  return (
    <Box flexDirection="column">
      {review.state === 'none' && <Text dimColor>No deep review yet. One runs {view.reviewSchedule}.</Text>}
      {banner !== '' && <Text dimColor={review.state === 'running'}>{banner}</Text>}
      {behind !== '' && <Text dimColor>{behind}</Text>}
      {count > 1 && (
        <Box flexDirection="row" columnGap={3}>
          <Text dimColor>{reviewPlace(index, count, shown?.at)}</Text>
          {index + 1 < count && <Button key="review-older" label="older" hotkey="p" plain onPress={() => actions.onReviewStep?.(1)} />}
          {index > 0 && <Button key="review-newer" label="newer" hotkey="n" plain onPress={() => actions.onReviewStep?.(-1)} />}
        </Box>
      )}
      {isOlder && <Text dimColor>The review before it:</Text>}
      {shown !== null && <Text bold>{capitalized(shown.subject)}</Text>}
      {shown !== null && spots.length > 0 && jumpList({ Box, Button }, view, shown.subject, spots, actions)}
      {shown !== null && shown.decisions.length > 0 && (
        <Box flexDirection="column">
          <Text bold color="magenta">
            {DECISION_HEADING}
          </Text>
          {shown.decisions.map(decision => (
            <Box flexDirection="column">
              <Text>{`${decision.line > 0 ? `${decision.file}:${decision.line}` : decision.file}  ${decision.choice}`}</Text>
              {decision.tradeoff !== '' && (
                <Box paddingLeft={4}>
                  <Text dimColor>{decision.tradeoff}</Text>
                </Box>
              )}
            </Box>
          ))}
          <Text> </Text>
        </Box>
      )}
      {shown !== null && <Markdown key="review" text={shown.text} />}
      {shown !== null && shown.insights.length > 0 && (
        <Box flexDirection="column">
          <Text> </Text>
          <Text color="cyan">{INSIGHT_HEADING}</Text>
          {shown.insights.map(insight => (
            <Text>{`- ${insight}`}</Text>
          ))}
        </Box>
      )}
      {controlsRow({ Box, Text }, view, [<Button key="review-now" label="review now" hotkey="r" plain onPress={() => actions.onReview()} />])}
    </Box>
  )
}

/** The marks that set the two learning sections apart from the rest of the notes. */
export const DECISION_HEADING = '◆ Your call'
export const INSIGHT_HEADING = '★ Insight'

/** One note: the key that selects it, then its text, indented. */
function noteRow({ Box, Text, Button }: Kit, note: Note, current: Note, label: string, actions: PaneActions) {
  return (
    <Box flexDirection="column">
      <Button
        key={`note-${note.id}`}
        label={`${note.id === current.id ? '❯' : ' '} ${label}`}
        plain
        dimColor={note.id !== current.id}
        onPress={() => actions.onSelect(note.id)}
      />
      <Box paddingLeft={4}>
        <Text>{note.text}</Text>
      </Box>
    </Box>
  )
}

/**
 * The play-by-play: decision points first, set apart as theirs to make, then
 * what will or may break and what reads better, by file, then insights last.
 */
function playByPlay(kit: Kit, view: PaneView, actions: PaneActions) {
  const { Box, Text, Button } = kit
  const notes = drawnOrder(view.notes)
  const current = currentNote(view)
  // Paused, nothing looks, so it is not offered.
  const canLook = view.mode !== 'paused'
  if (current === undefined) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No notes. Keep going.</Text>
        {canLook && controlsRow(kit, view, [<Button key="look" label="look now" hotkey="l" plain onPress={() => actions.onLook()} />])}
      </Box>
    )
  }

  const decisions = notes.filter(note => note.kind === 'decision')
  const insights = notes.filter(note => note.kind === 'insight')
  const others = notes.filter(note => isProblem(note.kind))

  return (
    <Box flexDirection="column">
      {decisions.length > 0 && (
        <Text bold color="magenta">
          {DECISION_HEADING}
        </Text>
      )}
      {decisions.map(note => noteRow(kit, note, current, `${note.id}  ${note.file} · line ${note.line}`, actions))}
      {decisions.length > 0 && others.length > 0 && <Text> </Text>}
      {others.map((note, index) => (
        <Box flexDirection="column">
          {note.file !== others[index - 1]?.file && <Text bold>{note.file}</Text>}
          {noteRow(kit, note, current, `${note.id}  ${noteMark(note).mark} ${note.kind} · line ${note.line}`, actions)}
        </Box>
      ))}
      {insights.length > 0 && (decisions.length > 0 || others.length > 0) && <Text> </Text>}
      {insights.length > 0 && <Text color="cyan">{INSIGHT_HEADING}</Text>}
      {insights.map(note => noteRow(kit, note, current, `${note.id}  ${note.file} · line ${note.line}`, actions))}
      {controlsRow(kit, view, [
        <Button key="explain" label="explain" hotkey="e" plain onPress={() => actions.onExplain(current)} />,
        <Button key="dismiss" label="dismiss" hotkey="d" plain onPress={() => actions.onDismiss(current)} />,
        <Button key="mute" label="mute" hotkey="m" plain onPress={() => actions.onMute(current)} />,
        notes.length > 1 && <Button key="next-note" label="next note" hotkey="j" plain onPress={() => actions.onStep(1)} />,
        notes.length > 1 && <Button key="previous-note" label="previous" hotkey="k" plain onPress={() => actions.onStep(-1)} />,
        canLook && <Button key="look" label="look now" hotkey="l" plain onPress={() => actions.onLook()} />,
        actions.onOpen !== undefined && <Button key="open" label="open in editor" hotkey="o" plain onPress={() => actions.onOpen?.(current.file, current.line)} />,
      ])}
    </Box>
  )
}

/** Whether anything at all is on record for a subject. */
function hasRecord(profile: Profile): boolean {
  return (
    Object.keys(profile.answers).length > 0 ||
    profile.hushed.length > 0 ||
    explained(profile).length > 0 ||
    recurring(profile).length > 0
  )
}

/** Whose commits count, in a line: the first thing to check when a level looks wrong. */
export function identityLine(progress: ProgressView): string {
  if (!progress.isOn) return 'The progress report is switched off. Its setting is in /config.'
  if (progress.identity.length === 0) return 'Git has no user.email here, so no commit can be confirmed as yours and nothing is scored.'

  return `Judged only on commits by ${progress.identity.join(' or ')}, and only on the lines they add.`
}

/** A heading and its lines, or nothing when there are none. */
function listOf({ Box, Text }: Kit, heading: string, lines: readonly string[]) {
  if (lines.length === 0) return null

  return (
    <Box flexDirection="column">
      <Text dimColor>{heading}</Text>
      {lines.map(line => (
        <Text>{`- ${line}`}</Text>
      ))}
    </Box>
  )
}

/** How many cells the growth bar has. With the level before it and the label after, it fits a 57-column dock. */

/** The bar's colour at each band: a health bar, red when the way to the next level has barely begun, green when it is nearly there. Orange has no terminal name. */
const BAND_COLORS: Record<GrowthBand, string> = { red: 'red', orange: '#ff8700', yellow: 'yellow', green: 'green' }

/**
 * The headline as a ladder (owner, 2026-10-05: "beginner | junior | senior | Gandalf, why not make some humor"): a
 * nickname over each rung, the rungs passed full, the current one filling toward the next in the band's color, the
 * rungs ahead empty, and the honest level word under each. Before a level, the plain headline.
 */
function growthBar(kit: Kit, growth: Growth, isProvisional: boolean, columns: number) {
  const { Box, Text } = kit
  const ladder = growthLadder(growth, columns)
  if (ladder === null) return <Text bold>{growthHeadline(growth)}</Text>

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        {ladder.rungs.map(rung => (
          <Text bold={rung.state === 'current'} dimColor={rung.state !== 'current'}>
            {rungWord(rung.nick, ladder.width)}
          </Text>
        ))}
      </Box>
      <Box flexDirection="row" columnGap={1}>
        {ladder.rungs.map(rung => (
          <Box flexDirection="row">
            <Text dimColor>[</Text>
            {rung.filled > 0 && <Text color={rung.state === 'passed' ? 'green' : BAND_COLORS[ladder.band]}>{'█'.repeat(rung.filled)}</Text>}
            {rung.empty > 0 && <Text dimColor>{'░'.repeat(rung.empty)}</Text>}
            <Text dimColor>]</Text>
          </Box>
        ))}
      </Box>
      <Box flexDirection="row" columnGap={1}>
        {ladder.rungs.map(rung => (
          <Text bold={rung.state === 'current'} dimColor={rung.state !== 'current'}>
            {rungWord(rung.level, ladder.width)}
          </Text>
        ))}
      </Box>
      <Text dimColor>{`${growthMeterLabel(growth)}${isProvisional ? ' · provisional' : ''}`}</Text>
    </Box>
  )
}

/** One language's growth, as the tab shows it: the score, what to work on, where they needed help, what would raise it, what improved. */
function growthSection(kit: Kit, record: ProgressRecord, growth: Growth | undefined, columns: number) {
  const { Box, Text } = kit
  const { report } = record
  const recent = lately(record, 3)
  // A plain fact about what improved first. The model's own line only when there is none: it is kept apart from the level.
  const fact = growth === undefined ? '' : encouragementLine(growth)
  const encouragement = fact !== '' ? fact : (report?.encouragement ?? '')

  return (
    <Box flexDirection="column">
      {growth !== undefined && growthBar(kit, growth, record.isProvisional, columns)}
      {growth !== undefined && <Text dimColor>{growthCounts(growth)}</Text>}
      <Text dimColor>{`From your commits alone: ${levelPhrase(record).replace(/^no level yet: /, 'not placed yet, ')}`}</Text>
      {report !== null && report.why !== '' && <Text>{report.why}</Text>}
      {growth !== undefined && listOf(kit, 'Work on', growth.workOn.map(workOnLine))}
      {growth !== undefined && listOf(kit, 'Needed help with', growth.neededHelp.map(helpLine))}
      {growth !== undefined && listOf(kit, 'To raise your score', growth.toRaise.map(raiseLine))}
      {report !== null && report.next !== '' && <Text>{`Next level: ${report.next}`}</Text>}
      {growth !== undefined && listOf(kit, 'Improved', growth.improved.map(improvedLine))}
      {recent.length > 0 && <Text dimColor>Lately</Text>}
      {recent.map(line => (
        <Text dimColor>{`- ${line}`}</Text>
      ))}
      {encouragement !== '' && <Text>{encouragement}</Text>}
    </Box>
  )
}

function profileTab(kit: Kit, view: PaneView, actions: PaneActions) {
  const { Box, Text, Button } = kit
  const subjects = [...view.profiles.languages, GENERAL].flatMap(subject => {
    const profile = view.profiles.subjects[subject]

    return profile === undefined ? [] : [{ subject, profile }]
  })
  const { progress } = view

  return (
    <Box flexDirection="column">
      <Text dimColor>{identityLine(progress)}</Text>
      {progress.busy !== '' && <Text dimColor>{progress.busy}</Text>}
      {progress.skipped !== '' && <Text dimColor>{progress.skipped}</Text>}
      <Text> </Text>
      {subjects.map(({ subject, profile }) => {
        const themes = recurring(profile)
        const covered = explained(profile)
        const record = progress.records.find(candidate => candidate.language === subject)

        return (
          <Box flexDirection="column">
            <Text bold>{languageName(subject)}</Text>
            {progress.isOn && record !== undefined && growthSection(kit, record, view.growth?.find(entry => entry.language === subject)?.growth, view.columns)}
            {Object.entries(profile.answers).map(([id, answer]) => (
              <Text dimColor>{`${ANSWER_LABELS[id] ?? id}: ${answer}`}</Text>
            ))}
            {profile.hushed.map(hush => (
              <Box flexDirection="row" columnGap={1}>
                <Text>{`Muted: ${hush.text}`}</Text>
                <Button key={`unhush-${subject}-${hush.topic}`} label="unmute" onPress={() => actions.onUnhush(subject, hush.topic)} />
              </Box>
            ))}
            {/* With a record, the growth section says these under "Needed help with" and "Work on". */}
            {!(progress.isOn && record !== undefined) && covered.length > 0 && <Text dimColor>{`Explained so far: ${covered.join(', ')}`}</Text>}
            {!(progress.isOn && record !== undefined) && themes.length > 0 && (
              <Text dimColor>{`Keeps coming back: ${themes.map(theme => `${theme.topic} (${theme.times})`).join(', ')}`}</Text>
            )}
            {Object.keys(profile.answers).length === 0 && <Text dimColor>No answers yet.</Text>}
            {subject === GENERAL && !hasRecord(profile) && <Text dimColor>It fills in as you work, and it is the same in every project.</Text>}
            <Text> </Text>
          </Box>
        )
      })}
      {controlsRow(kit, view, [
        <Button
          key="questions"
          label={subjects.some(({ profile }) => Object.keys(profile.answers).length > 0) ? 'answer the questions again' : 'answer a few questions'}
          hotkey="q"
          plain
          onPress={() => actions.onQuestions()}
        />,
      ])}
    </Box>
  )
}

/** What the Lessons tab says above the list. */
export const LESSONS_HINT = 'Learning paths, done in your own code. Click one, or Tab to it and press Enter; s then starts its next step in the conversation. Skipping them costs nothing.'

/** What it says when the plugin has none. */
export const NO_LESSONS = 'No lessons are installed. A path is a markdown file in the plugin\'s lessons folder.'

/** A step's mark: done with the tutor, done by their word, started, the next one, or not yet. */
function stepMark(state: string, isNext: boolean): string {
  if (state === 'checked') return '✓'
  if (state === 'done') return '✓'
  if (isNext) return '▸'

  return ' '
}

/** One path opened: its steps, and what can be done with it. */
function lessonDetail({ Box, Text, Button }: Kit, view: PaneView, lesson: LessonView, actions: PaneActions) {
  const next = lesson.steps[lesson.next]

  return (
    <Box flexDirection="column">
      <Text bold>{lesson.title}</Text>
      <Text dimColor>{`${lessonLanguage(lesson.language)}, ${lesson.level}. ${lessonProgress(lesson)}.`}</Text>
      {lesson.summary !== '' && <Text>{lesson.summary}</Text>}
      <Text> </Text>
      {lesson.steps.map((step, index) => (
        <Text dimColor={step.state === 'checked' || step.state === 'done'}>
          {`${stepMark(step.state, index === lesson.next)} ${index + 1}. ${step.title}${step.state === 'done' ? ' (your word)' : ''}${step.helped > 0 ? ' (needed help)' : ''}`}
        </Text>
      ))}
      {next === undefined && <Text dimColor>Every step is done.</Text>}
      {controlsRow({ Box, Text }, view, [
        next !== undefined && (
          <Button
            key="lesson-start"
            label={next.state === 'started' ? `continue step ${lesson.next + 1}` : `start step ${lesson.next + 1}`}
            hotkey="s"
            plain
            onPress={() => actions.onLessonStart?.(lesson.id)}
          />
        ),
        next !== undefined && <Button key="lesson-done" label={`I did step ${lesson.next + 1}`} hotkey="c" plain onPress={() => actions.onLessonDone?.(lesson.id)} />,
        <Button key="lesson-back" label="all lessons" hotkey="b" plain onPress={() => actions.onLessonOpen?.(null)} />,
      ])}
    </Box>
  )
}

/** The Lessons tab: the paths, by language, or the one opened. */
function lessonsTab(kit: Kit, view: PaneView, actions: PaneActions) {
  const { Box, Text, Button } = kit
  const lessons = view.lessons ?? { paths: [], selected: null, problems: [] }
  const opened = lessons.paths.find(lesson => lesson.id === lessons.selected)
  if (opened !== undefined) return lessonDetail(kit, view, opened, actions)
  const languages = [...new Set(lessons.paths.map(lesson => lesson.language))]

  return (
    <Box flexDirection="column">
      <Text dimColor>{lessons.paths.length === 0 ? NO_LESSONS : LESSONS_HINT}</Text>
      {languages.map(language => (
        <Box flexDirection="column">
          <Text> </Text>
          <Text bold>{lessonLanguage(language)}</Text>
          {lessons.paths
            .filter(lesson => lesson.language === language)
            .map(lesson => (
              <Button
                key={`lesson-${lesson.id}`}
                label={`▸ ${lesson.title} · ${lesson.level} · ${lessonProgress(lesson)}`}
                plain
                onPress={() => actions.onLessonOpen?.(lesson.id)}
              />
            ))}
        </Box>
      ))}
      {lessons.problems.length > 0 && <Text> </Text>}
      {lessons.problems.map(problem => (
        <Text dimColor>{`Not a lesson: ${problem}`}</Text>
      ))}
    </Box>
  )
}

/** The tab's own contents, under the parts every tab shares. */
function tabBody(kit: Kit, view: PaneView, actions: PaneActions) {
  if (view.tab === 'play') return playByPlay(kit, view, actions)
  if (view.tab === 'review') return deepReview(kit, view, actions)
  if (view.tab === 'explain') return explainTab(kit, view, actions)
  if (view.tab === 'settings') return settingsTab(kit, view, actions)
  if (view.tab === 'lessons') return lessonsTab(kit, view, actions)

  return profileTab(kit, view, actions)
}

/** The tabs as a row of buttons, each with its digit. */
function tabButtons({ Box, Button }: Kit, view: PaneView, actions: PaneActions, row: { labels: string[]; gap: number }) {
  return (
    <Box flexDirection="row" columnGap={row.gap} flexShrink={0}>
      {TABS.map(({ tab, hotkey }, index) => (
        <Button key={`tab-${tab}`} label={row.labels[index] ?? ''} hotkey={hotkey} plain dimColor={view.tab !== tab} onPress={() => actions.onTab(tab)} />
      ))}
    </Box>
  )
}

/** What the Settings tab says above the rows. */
export const SETTINGS_HINT = 'The same settings as in /config. Click a row to see its options, then click one; or Tab to it and press Enter. A change applies at once.'

/** What a row says when its value is typed rather than picked, which the pane does not offer. */
export const SET_IN_CONFIG = 'set it in /config'

/** A row's heading, folded or open: "▸ Voice persona: knuth", "▾ Voice persona: knuth". */
export function settingHeading(row: Pick<SettingRow, 'label' | 'value'>, isOpen: boolean): string {
  return `${isOpen ? '▾' : '▸'} ${row.label}: ${row.value}`
}

/**
 * The plugin's `/config` rows, each a list that opens downward: the row
 * names its value, a press opens its options under it, and a press on an
 * option picks it and folds them again. A `Select` was tried first: on the
 * owner's terminal a click opened it and could neither pick an option nor
 * close it (2026-10-05).
 */
function settingsTab({ Box, Text, Button }: Kit, view: PaneView, actions: PaneActions) {
  if (view.settings.length === 0) return <Text dimColor>Reading the settings from /config.</Text>

  return (
    <Box flexDirection="column">
      <Text dimColor>{SETTINGS_HINT}</Text>
      <Text> </Text>
      {view.settings.map(row => {
        if (row.isLocked) return <Text dimColor>{`${row.label}: ${row.value} (set by your organization)`}</Text>
        if (row.options === undefined || row.options.length === 0) return <Text dimColor>{`${row.label}: ${row.value === '' ? '(empty)' : row.value} · ${SET_IN_CONFIG}`}</Text>
        const isOpen = view.openList === `setting:${row.key}`

        return (
          <Box flexDirection="column">
            <Button key={`setting-${row.key}`} label={settingHeading(row, isOpen)} plain onPress={() => actions.onSettingFold?.(row.key)} />
            {isOpen && (
              <Box flexDirection="column" paddingLeft={2}>
                {row.options.map(option =>
                  option === row.value ? (
                    <Box flexDirection="row" columnGap={1}>
                      <Text color="claude">❯</Text>
                      <Text bold>{option}</Text>
                    </Box>
                  ) : (
                    <Button key={`option-${row.key}-${option}`} label={`▸ ${option}`} plain onPress={() => actions.onSetting(row, option)} />
                  ),
                )}
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

/** What the editors' light says while it is red. */
export const NO_EDITOR = 'No editor is connected.'

/**
 * The editors' light: green with the editors' names while one with something
 * of this project open is connected, red while none is. Out (null) while the
 * session cannot say: paused, before the editors' files were first read, or
 * in a session that leaves them to the one that drives the project.
 */
export function editorLight(view: Pick<PaneView, 'mode' | 'watch'>): { isOn: boolean; text: string } | null {
  const editors = view.watch.editors
  if (view.mode === 'paused' || editors === undefined) return null

  return editors === '' ? { isOn: false, text: NO_EDITOR } : { isOn: true, text: editors }
}

/** The lines under the tabs: what the play-by-play is doing, what keeps going wrong, the editors' light, a newer release, the license. */
function statusRows({ Box, Text }: Kit, view: PaneView, withStatus: boolean) {
  const light = editorLight(view)
  const state = stateMark(view)

  return [
    withStatus && (
      <Box flexDirection="row" columnGap={1}>
        <Text color={state.color} dimColor={state.color === undefined}>
          {state.mark}
        </Text>
        <Text dimColor>{statusLine(view)}</Text>
      </Box>
    ),
    view.mode !== 'paused' && (view.watch.health ?? '') !== '' && <Text dimColor>{view.watch.health}</Text>,
    light !== null && (
      <Box flexDirection="row" columnGap={1}>
        <Text color={light.isOn ? 'green' : 'red'}>●</Text>
        <Text dimColor={!light.isOn}>{light.text}</Text>
      </Box>
    ),
    view.update !== '' && <Text color="yellow">{view.update}</Text>,
    (view.license ?? '') !== '' && <Text dimColor>{view.license}</Text>,
  ]
}

/** The character speaks for the play-by-play and the deep review, so it stands on their tabs only. */
function characterOf(view: PaneView): PaneView['character'] {
  // The Play-by-play tab only (owner, 2026-10-05: on the review tab its line repeated the review's takeaway above a long page).
  return view.tab === 'play' ? view.character : null
}

/** The pane: every part stacked, tabs first, controls and the keys row last. */
function renderStacked(kit: Kit, view: PaneView, actions: PaneActions) {
  const { Box, Text } = kit
  const character = characterOf(view)
  const row = tabRow(view)

  return (
    <Box flexDirection="column">
      {tabButtons(kit, view, actions, row)}
      {tabUnderline(kit, view, row)}
      {statusRows(kit, view, true)}
      {/* Outside a repository there is no journal, so nothing to go on and nowhere to keep an answer. */}
      {view.watch.state !== 'no-git' && workingOn(kit, view, actions)}
      <Text> </Text>
      {character !== null && characterRow(kit, view, character)}
      {character !== null && <Text> </Text>}
      {tabBody(kit, view, actions)}
      {keysRow(kit, view, actions)}
    </Box>
  )
}

/** The mark and color a note's kind gets on its row: Claude Code's own for errors and warnings. */
export function noteMark(note: Pick<Note, 'kind'>): { mark: string; color: string | undefined } {
  switch (note.kind) {
    case 'decision':
      return { mark: '◆', color: 'magenta' }
    case 'insight':
      return { mark: '★', color: 'cyan' }
    case 'bug':
      return { mark: '✘', color: 'red' }
    case 'risk':
      return { mark: '⚠', color: 'yellow' }
    default:
      return { mark: '·', color: undefined }
  }
}

/** What the strip says after the tabs: that the pane is put away, and how it comes back. */
export const STRIP_HINT = 'minimized · click a name, or Ctrl+X Tab then Enter, to bring it back'

/**
 * The pane put away (owner, 2026-10-06: the pane's close should minimize, and
 * only /bsd off shut the tutor down): one row above the prompt with the
 * tutor's name and its tabs, each a button that brings the pane back, the
 * name on the tab it was on and a tab on itself. The name takes the focus
 * ring, so Ctrl+X Tab then Enter is the way back from the keyboard. No button
 * has a key: a bare digit typed into an empty prompt presses a keyed button here.
 */
export function renderMinimized(
  { Box, Text, Button }: Pick<Kit, 'Box' | 'Text' | 'Button'>,
  view: Partial<Pick<PaneView, 'notes' | 'review' | 'explain' | 'progress'>>,
  actions: { onRestore: (tab: Tab | null) => void },
) {
  return (
    <Box flexDirection="row" columnGap={2}>
      <Box flexShrink={0}>
        <Button key="restore" label="▸ Backseat" plain autoFocus onPress={() => actions.onRestore(null)} />
      </Box>
      {TABS.map(({ tab, short }) => (
        <Box flexShrink={0}>
          <Button key={`restore-${tab}`} label={`${short}${tabBadge(tab, view)}`} plain dimColor onPress={() => actions.onRestore(tab)} />
        </Box>
      ))}
      <Text dimColor wrap="truncate-end">
        {STRIP_HINT}
      </Text>
    </Box>
  )
}

export function renderPane(kit: Kit, view: PaneView, actions: PaneActions) {
  return renderStacked(kit, view, actions)
}

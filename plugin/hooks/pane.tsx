import type { Elements } from 'claude-code'

import type { ExplainView, Mode, Note, OutlineRow, Profile, Profiles, ProgressRecord, ProgressView, Review, SettingRow, Speech, Tab, Watch, Working } from '../types'
import { bubbleColumn, bubbleWidth, isTalking, poseOf, saidSoFar, wordsSaid } from '../core/avatar'
import type { Avatar } from '../core/avatar'
import { artShape, characterArt } from './character'
import type { Backdrop } from '../core/sprite'
import { languageName } from '../core/languages'
import { isProblem, sortNotes } from '../core/notes'
import { ANSWER_LABELS, explained, GENERAL, recurring } from '../core/profiles'
import { lately, levelPhrase, skillStates } from '../core/progress'
import { readableReview, SURVEY_SUBJECT } from '../core/review'
import { DEFAULT_PERSONA } from '../core/settings'
import { clockTime, playLine } from '../core/status'
import type { Layout, Persona } from '../core/settings'

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
  /** Which of the three ways of showing the tutor this drawing is for. */
  layout: Layout
  /** Unified only: whether the lines above the prompt are opened into the tab shown. */
  isUnfolded: boolean
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
  /** Unified only: fold the opened tab back into the few lines above the prompt. */
  onFold: () => void
  /** Select the next note in the order they are drawn, or the previous one. */
  onStep: (step: 1 | -1) => void
  /** Change one of the plugin's `/config` rows to the value picked. */
  onSetting: (row: SettingRow, value: string) => void
}

const TABS: readonly { tab: Tab; label: string; short: string; hotkey: string }[] = [
  { tab: 'play', label: 'Play-by-play', short: 'Play', hotkey: '1' },
  { tab: 'review', label: 'Deep review', short: 'Review', hotkey: '2' },
  { tab: 'explain', label: 'Explain', short: 'Explain', hotkey: '3' },
  // Still `profile` inside: the tab grew from the Profile tab, and its key is what tests and muscle memory press.
  { tab: 'profile', label: 'Progress', short: 'Progress', hotkey: '4' },
  { tab: 'settings', label: 'Settings', short: 'Settings', hotkey: '5' },
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
  if (tab === 'settings') return ''

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
  return { labels: TABS.map(({ tab, short: name }) => (tab === 'review' ? `${name}${tabBadge(tab, view)}` : name)), gap: 2 }
}

/** Shown while the pane does not have the keyboard: its keys do nothing until it does. */
export const KEYBOARD_HINT = 'Ctrl+X Tab or a click to use these keys. Esc to go back.'

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
        <Button key="working" label="Working on" hotkey="w" plain onPress={() => actions.onWorking()} />
        <Text wrap="truncate-end">{head}</Text>
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
 * The notes in the order every layout draws them: decision points first,
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
export const NOTHING_EXPLAINED = 'Nothing explained here yet. f looks this file up, or run /bsd explain with a file and a line.'

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
      {target === null && explain.fileSummary !== '' && <Text>{explain.fileSummary}</Text>}
      {target !== null && detail === null && target.summary !== '' && <Text>{target.summary}</Text>}
      {detail !== null && <Markdown key="explanation" text={detailMarkdown(detail)} />}
      {explain.insights.map(insight => (
        <Text>{`Deep review: ${insight}`}</Text>
      ))}
      {notice !== '' && <Text dimColor>{notice}</Text>}
      {!explain.isMappable && <Text dimColor>This file is too large to map, so only the lines around the cursor are explained.</Text>}
      {explain.outline.length > 0 && <Text> </Text>}
      {explain.outline.length > 0 && <Text bold>In this file</Text>}
      {explain.outline.map(row => {
        const isCurrent = target !== null && row.startLine === target.startLine && row.endLine === target.endLine

        return <Text dimColor={!isCurrent}>{outlineLine(row, isCurrent, view.columns)}</Text>
      })}
      <Text> </Text>
      <Box flexDirection="row" columnGap={3}>
        {explain.outline.length > 1 && <Button key="explain-next" label="next" hotkey="n" plain onPress={() => actions.onExplainMove(1)} />}
        {explain.outline.length > 1 && <Button key="explain-previous" label="previous" hotkey="p" plain onPress={() => actions.onExplainMove(-1)} />}
        {target !== null && <Button key="explain-ask" label="ask about this" hotkey="e" plain onPress={() => actions.onExplainAsk()} />}
        {canFetch && <Button key="explain-fetch" label="fetch" hotkey="f" plain onPress={() => actions.onExplainFetch()} />}
      </Box>
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

function deepReview({ Box, Text, Button, Markdown }: Kit, view: PaneView, actions: PaneActions) {
  const { review } = view
  const banner = reviewBanner(review)
  const behind = waitingLine(review)
  // What there is to read: the latest review, or the one before it while a newer one is on its way.
  const shown = readableReview(review)
  const isOlder = shown !== null && review.state !== 'done'

  return (
    <Box flexDirection="column">
      {review.state === 'none' && <Text dimColor>No deep review yet. One runs {view.reviewSchedule}.</Text>}
      {banner !== '' && <Text dimColor={review.state === 'running'}>{banner}</Text>}
      {behind !== '' && <Text dimColor>{behind}</Text>}
      {isOlder && <Text> </Text>}
      {isOlder && <Text dimColor>The review before it:</Text>}
      {shown !== null && <Text bold>{capitalized(shown.subject)}</Text>}
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
      <Text> </Text>
      <Button key="review-now" label="review now" hotkey="r" plain onPress={() => actions.onReview()} />
    </Box>
  )
}

/**
 * The marks that set the two learning sections apart from the rest of the
 * notes. The ★ and the rule are the insight block of the Explanatory mode in
 * Anthropic's learning-output-style plugin (Apache-2.0), with thanks; see
 * THIRD_PARTY_NOTICES.md.
 */
export const DECISION_HEADING = '◆ Your call'
export const INSIGHT_HEADING = '★ Insight ─────────────────────────'

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
        {canLook && <Text> </Text>}
        {canLook && <Button key="look" label="look now" hotkey="l" plain onPress={() => actions.onLook()} />}
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
          {noteRow(kit, note, current, `${note.id}  ${note.kind} · line ${note.line}`, actions)}
        </Box>
      ))}
      {insights.length > 0 && (decisions.length > 0 || others.length > 0) && <Text> </Text>}
      {insights.length > 0 && <Text color="cyan">{INSIGHT_HEADING}</Text>}
      {insights.map(note => noteRow(kit, note, current, `${note.id}  ${note.file} · line ${note.line}`, actions))}
      <Text> </Text>
      <Box flexDirection="row" columnGap={3} flexWrap="wrap">
        {notes.length > 1 && <Button key="next-note" label="next" hotkey="j" plain onPress={() => actions.onStep(1)} />}
        {notes.length > 1 && <Button key="previous-note" label="previous" hotkey="k" plain onPress={() => actions.onStep(-1)} />}
        <Button key="explain" label="explain" hotkey="e" plain onPress={() => actions.onExplain(current)} />
        <Button key="dismiss" label="dismiss" hotkey="d" plain onPress={() => actions.onDismiss(current)} />
        <Button key="mute" label="mute" hotkey="m" plain onPress={() => actions.onMute(current)} />
        {canLook && <Button key="look" label="look now" hotkey="l" plain onPress={() => actions.onLook()} />}
      </Box>
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

/** One language's progress, as the tab shows it. */
function progressSection({ Box, Text }: Kit, record: ProgressRecord) {
  const { report } = record
  const states = skillStates(record)
  const recent = lately(record, 3)

  return (
    <Box flexDirection="column">
      <Text>{`Level: ${levelPhrase(record)}`}</Text>
      {report !== null && report.why !== '' && <Text>{report.why}</Text>}
      {report !== null && report.next !== '' && <Text>{`Next level: ${report.next}`}</Text>}
      {report !== null && report.working.length > 0 && <Text>{`Working on: ${report.working.join('; ')}`}</Text>}
      {states.shown.length > 0 && <Text dimColor>{`Shown: ${states.shown.join(', ')}`}</Text>}
      {states.slipping.length > 0 && <Text>{`Slipping: ${states.slipping.join(', ')}`}</Text>}
      {recent.length > 0 && <Text dimColor>Lately</Text>}
      {recent.map(line => (
        <Text dimColor>{`- ${line}`}</Text>
      ))}
      {report !== null && report.encouragement !== '' && <Text>{report.encouragement}</Text>}
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
            {progress.isOn && record !== undefined && progressSection(kit, record)}
            {Object.entries(profile.answers).map(([id, answer]) => (
              <Text dimColor>{`${ANSWER_LABELS[id] ?? id}: ${answer}`}</Text>
            ))}
            {profile.hushed.map(hush => (
              <Box flexDirection="row" columnGap={1}>
                <Button
                  key={`unhush-${subject}-${hush.topic}`}
                  label="x"
                  plain
                  onPress={() => actions.onUnhush(subject, hush.topic)}
                />
                <Text>{`Not bringing up: ${hush.text}`}</Text>
              </Box>
            ))}
            {covered.length > 0 && <Text dimColor>{`Explained so far: ${covered.join(', ')}`}</Text>}
            {themes.length > 0 && (
              <Text dimColor>{`Keeps coming back: ${themes.map(theme => `${theme.topic} (${theme.times})`).join(', ')}`}</Text>
            )}
            {Object.keys(profile.answers).length === 0 && <Text dimColor>No answers yet.</Text>}
            {subject === GENERAL && !hasRecord(profile) && <Text dimColor>It fills in as you work, and it is the same in every project.</Text>}
            <Text> </Text>
          </Box>
        )
      })}
      <Button
        key="questions"
        label={subjects.some(({ profile }) => Object.keys(profile.answers).length > 0) ? 'answer the questions again' : 'answer a few questions'}
        hotkey="q"
        plain
        onPress={() => actions.onQuestions()}
      />
    </Box>
  )
}

/** The tab's own contents, under the parts every tab shares. */
function tabBody(kit: Kit, view: PaneView, actions: PaneActions) {
  if (view.tab === 'play') return playByPlay(kit, view, actions)
  if (view.tab === 'review') return deepReview(kit, view, actions)
  if (view.tab === 'explain') return explainTab(kit, view, actions)
  if (view.tab === 'settings') return settingsTab(kit, view, actions)

  return profileTab(kit, view, actions)
}

/**
 * Whether the tab buttons carry their digits. A pane's keys work only while
 * it has the keyboard. Above the prompt, Claude Code also lets a bare digit
 * typed into an empty prompt press a button, so there the digits are only
 * given while the band has the keyboard: otherwise answering Claude with
 * "2" would open a tab.
 */
export function hasDigits(view: Pick<PaneView, 'layout' | 'isFocused'>): boolean {
  return view.layout === 'vertical' || view.isFocused
}

/** The tabs as a row of buttons. */
function tabButtons({ Box, Button }: Kit, view: PaneView, actions: PaneActions, row: { labels: string[]; gap: number }) {
  const isUnified = view.layout === 'unified'

  return (
    <Box flexDirection="row" columnGap={row.gap} flexShrink={0} marginRight={view.layout === 'vertical' ? 0 : 2}>
      {TABS.map(({ tab, hotkey }, index) => (
        <Button
          key={`tab-${tab}`}
          label={row.labels[index] ?? ''}
          {...(hasDigits(view) ? { hotkey } : {})}
          {...(view.layout !== 'vertical' && view.tab === tab ? { autoFocus: true as const } : {})}
          plain
          dimColor={view.tab !== tab || (isUnified && !view.isUnfolded)}
          onPress={() => actions.onTab(tab)}
        />
      ))}
    </Box>
  )
}

/** What the Settings tab says above the rows. */
export const SETTINGS_HINT = 'The same settings as in /config. Pick a row, then Enter to change it. A change applies at once.'

/** What the Settings tab says where it cannot offer a pick. */
export const SETTINGS_ELSEWHERE = 'The settings as they are now. They are changed in /config here.'

/** The plugin's `/config` rows, each changed in place with a pick. */
function settingsTab({ Box, Text, Select }: Kit, view: PaneView, actions: PaneActions) {
  if (view.settings.length === 0) return <Text dimColor>Reading the settings from /config.</Text>

  return (
    <Box flexDirection="column">
      <Text dimColor>{Select === undefined ? SETTINGS_ELSEWHERE : SETTINGS_HINT}</Text>
      <Text> </Text>
      {view.settings.map(row =>
        row.isLocked || Select === undefined ? (
          <Text dimColor>{`${row.label}: ${row.value}${row.isLocked ? ' (set by your organization)' : ''}`}</Text>
        ) : (
          <Select
            key={`setting-${row.key}`}
            label={`${row.label}: `}
            options={row.options.map(option => ({ value: option }))}
            value={row.value}
            onSelect={value => {
              if (value !== row.value) actions.onSetting(row, value)
            }}
          />
        ),
      )}
    </Box>
  )
}

/** The lines under the tabs: what the play-by-play is doing, what keeps going wrong, the editors connected, a newer release, the license. */
function statusRows({ Text }: Kit, view: PaneView, withStatus: boolean) {
  return [
    withStatus && <Text dimColor>{statusLine(view)}</Text>,
    view.mode !== 'paused' && (view.watch.health ?? '') !== '' && <Text dimColor>{view.watch.health}</Text>,
    view.mode !== 'paused' && (view.watch.editors ?? '') !== '' && <Text dimColor>{view.watch.editors}</Text>,
    view.update !== '' && <Text color="yellow">{view.update}</Text>,
    (view.license ?? '') !== '' && <Text dimColor>{view.license}</Text>,
  ]
}

/** The character speaks for the play-by-play and the deep review, so it stands on their tabs only. */
function characterOf(view: PaneView): PaneView['character'] {
  return view.tab === 'play' || view.tab === 'review' ? view.character : null
}

/** The vertical layout: every part stacked, as a pane beside the conversation wants it. */
function renderStacked(kit: Kit, view: PaneView, actions: PaneActions) {
  const { Box, Text } = kit
  const character = characterOf(view)

  return (
    <Box flexDirection="column">
      {tabButtons(kit, view, actions, tabRow(view))}
      {statusRows(kit, view, true)}
      {/* Outside a repository there is no journal, so nothing to go on and nowhere to keep an answer. */}
      {view.watch.state !== 'no-git' && workingOn(kit, view, actions)}
      <Text> </Text>
      {character !== null && characterRow(kit, view, character)}
      {character !== null && <Text> </Text>}
      {tabBody(kit, view, actions)}
      {!view.isFocused && <Text dimColor>{KEYBOARD_HINT}</Text>}
    </Box>
  )
}

/** What the horizontal layout's frame and padding take from each side. */
const FRAME_COLUMNS = 4
/** The gap between the horizontal layout's two columns. */
const SPLIT_GAP = 3

/**
 * How the horizontal layout splits its width: a side column for the
 * character and what they are working on, and the rest for the tab. Null
 * when the strip is too narrow for two columns, which then stack.
 */
export function stripColumns(columns: number): { side: number; body: number } | null {
  const inner = columns - FRAME_COLUMNS
  const side = Math.max(30, Math.min(48, Math.round(inner * 0.34)))
  const body = inner - side - SPLIT_GAP

  return body < 44 ? null : { side, body }
}

/** The horizontal layout: a framed strip above the prompt, the character beside the tab rather than above it. */
function renderStrip(kit: Kit, view: PaneView, actions: PaneActions) {
  const { Box, Text } = kit
  const inner = { ...view, columns: view.columns - FRAME_COLUMNS }
  const split = stripColumns(view.columns)
  if (split === null) {
    return (
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
        {renderStacked(kit, inner, actions)}
      </Box>
    )
  }
  const side = { ...view, columns: split.side }
  const body = { ...view, columns: split.body }
  const character = characterOf(side)

  return (
    <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
      {tabButtons(kit, view, actions, tabRow(inner))}
      {statusRows(kit, inner, true)}
      <Text> </Text>
      <Box flexDirection="row" columnGap={SPLIT_GAP}>
        <Box flexDirection="column" width={split.side} flexShrink={0}>
          {view.watch.state !== 'no-git' && workingOn(kit, side, actions)}
          {character !== null && <Text> </Text>}
          {character !== null && characterRow(kit, side, character)}
        </Box>
        <Box flexDirection="column" width={split.body}>
          {tabBody(kit, body, actions)}
        </Box>
      </Box>
      {!view.isFocused && <Text dimColor>{KEYBOARD_HINT}</Text>}
    </Box>
  )
}

/** How many notes the unified layout shows above the prompt while it is folded: fewer on a short terminal. */
export function previewCount(rows: number): number {
  return rows < 40 ? 2 : 3
}

/** The mark and color a note's kind gets on its one line in the unified layout: Claude Code's own for errors and warnings. */
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

/** One note on one line: where it is, then as much of it as fits. */
export function previewLine(note: Note): string {
  return `${note.file}:${note.line}  ${note.text}`
}

/** What the unified layout says under its notes when more are open than it shows. '' when none are hidden. */
export function moreLine(count: number, shown: number): string {
  const hidden = count - shown

  return hidden <= 0 ? '' : hidden === 1 ? 'and one more note' : `and ${hidden} more notes`
}

/** The play-by-play's state in a word or two, for the end of Claude Code's hint line. */
export function statusWord(view: Pick<PaneView, 'mode' | 'watch'>): string {
  if (view.mode === 'paused') return 'paused'
  const { state, line } = view.watch
  switch (state) {
    case 'starting':
      return 'starting'
    case 'no-git':
      return 'no git repository'
    case 'looking':
      return 'looking…'
    case 'settling':
      return 'saw your save'
    case 'waiting': {
      const next = /Next try (\S+)\./.exec(line)?.[1] ?? /until (\S+),/.exec(line)?.[1]

      return next === undefined ? 'waiting' : `waiting, next try ${next}`
    }
    case 'idle':
      return line.includes('Another session') ? 'in another session' : line.includes('only when you ask') ? 'on request' : 'watching'
  }
}

/**
 * The tutor's entry at the end of Claude Code's hint line under the prompt,
 * in the unified layout: what the play-by-play is doing, and where the
 * keyboard is, since nothing else in that layout says so.
 */
export function statusEntry(view: Pick<PaneView, 'mode' | 'watch'>, hasKeys: boolean): string {
  return `backseat ${statusWord(view)} · ${hasKeys ? 'esc to leave' : 'ctrl+x tab for keys'}`
}

/** The tabs' labels in the unified layout's one row: short names, and what each says about itself. */
export function unifiedTabs(view: Pick<PaneView, 'review'> & Partial<Pick<PaneView, 'notes' | 'explain' | 'progress'>>): string[] {
  return TABS.map(({ tab, short }) => `${short}${tabBadge(tab, view)}`)
}

/** How wide the unified layout's tab row draws, with its digits or without, and its margin. */
export function unifiedTabsWidth(labels: readonly string[], withDigits: boolean): number {
  return labels.reduce((sum, label) => sum + label.length + (withDigits ? 3 : 0), 0) + 2 * (labels.length - 1) + 2
}

/** The speech left room on the unified layout's row, below which it is left out rather than cut to a word. */
const MIN_SPEECH = 16

/** The full names of the tabs, for the heading of one opened in the unified layout. */
function tabName(tab: Tab): string {
  return TABS.find(entry => entry.tab === tab)?.label ?? tab
}

/**
 * The unified layout: no pane. One row above the prompt holds the character's
 * line and the tabs, with the open notes under it, one line each. A tab's
 * key opens it right there, and folds it again. What the play-by-play is
 * doing ends Claude Code's own hint line under the prompt (`statusEntry`).
 */
function renderUnified(kit: Kit, view: PaneView, actions: PaneActions) {
  const { Box, Text, Button } = kit
  const notes = drawnOrder(view.notes)
  const isAsleep = view.mode === 'paused'
  const character = view.character
  const labels = unifiedTabs(view)
  const face = character === null ? 'Backseat' : character.avatar.mini[poseOf(view.mode, view.watch.state, character.speech)]
  const room = view.columns - unifiedTabsWidth(labels, hasDigits(view)) - face.length - 3
  const said = character === null || room < MIN_SPEECH ? '' : isAsleep ? ASLEEP : saidSoFar(character.speech)
  const isSpeaking = character !== null && isTalking(character.speech)
  const shown = previewCount(view.rows)
  const body = { ...view, columns: view.columns - 2, isCompact: true }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row" columnGap={2}>
        <Box flexDirection="row" columnGap={1} flexGrow={1} flexShrink={1}>
          <Box flexShrink={0}>
            <Text color={character?.avatar.color} dimColor={!isSpeaking} wrap="truncate">
              {face}
            </Text>
          </Box>
          {said !== '' && (
            <Text dimColor={isAsleep || !isSpeaking} wrap="truncate-end">
              {said}
            </Text>
          )}
        </Box>
        {tabButtons(kit, view, actions, { labels, gap: 2 })}
      </Box>
      {statusRows(kit, view, false)}
      {!view.isUnfolded &&
        notes.slice(0, shown).map(note => {
          const { mark, color } = noteMark(note)

          return (
            <Box flexDirection="row" columnGap={1}>
              <Text color={color}>{mark}</Text>
              <Text dimColor wrap="truncate-end">
                {previewLine(note)}
              </Text>
            </Box>
          )
        })}
      {!view.isUnfolded && moreLine(notes.length, shown) !== '' && (
        <Box paddingLeft={2}>
          <Text dimColor>{moreLine(notes.length, shown)}</Text>
        </Box>
      )}
      {/* The note keys (e d m) act on an open tab. Folded, j opens the notes, so none of them falls through into the prompt. */}
      {!view.isUnfolded && notes.length > 0 && hasDigits(view) && (
        <Box paddingLeft={2} columnGap={2}>
          <Button key="open-notes" label="open the notes" hotkey="j" plain dimColor onPress={() => actions.onTab('play')} />
        </Box>
      )}
      {view.isUnfolded && (
        <Box flexDirection="column" paddingLeft={2}>
          <Box flexDirection="row" columnGap={2}>
            <Text bold>{tabName(view.tab)}</Text>
            <Button key="fold" label="fold" hotkey="x" plain dimColor onPress={() => actions.onFold()} />
          </Box>
          {view.tab === 'play' && <Text dimColor>{statusLine(view)}</Text>}
          {view.tab === 'play' && view.watch.state !== 'no-git' && workingOn(kit, body, actions)}
          <Text> </Text>
          {tabBody(kit, body, actions)}
        </Box>
      )}
    </Box>
  )
}

export function renderPane(kit: Kit, view: PaneView, actions: PaneActions) {
  if (view.layout === 'unified') return renderUnified(kit, view, actions)
  if (view.layout === 'horizontal') return renderStrip(kit, view, actions)

  return renderStacked(kit, view, actions)
}

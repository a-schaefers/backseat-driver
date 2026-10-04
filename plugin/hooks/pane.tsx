import type { Elements } from 'claude-code'

import type { ExplainView, Mode, Note, OutlineRow, Profile, Profiles, ProgressRecord, ProgressView, Review, Speech, Tab, Watch, Working } from '../types'
import { bubbleColumn, bubbleWidth, isTalking, poseOf, saidSoFar, wordsSaid } from './avatar'
import type { Avatar } from './avatar'
import { languageName } from './languages'
import { isProblem, sortNotes } from './notes'
import { ANSWER_LABELS, explained, GENERAL, recurring } from './profiles'
import { lately, levelPhrase, skillStates } from './progress'
import { SURVEY_SUBJECT } from './review'
import { DEFAULT_PERSONA } from './settings'
import type { Persona } from './settings'

/** The elements the pane is built from. Every surface that draws panes has them. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button' | 'Markdown'>

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
  /** True while the pane has the keyboard, which is when its keys work. */
  isFocused: boolean
  /** How wide the pane's body is, in columns. */
  columns: number
  /** The voice's animated character and what it is saying, or null while the animation is off. */
  character: { avatar: Avatar; speech: Speech } | null
  /** True where rows are scarce, as in a pane above the prompt: the character is then drawn in one line. */
  isCompact: boolean
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
}

const TABS: readonly { tab: Tab; label: string; short: string; hotkey: string }[] = [
  { tab: 'play', label: 'Play-by-play', short: 'Play', hotkey: '1' },
  { tab: 'review', label: 'Deep review', short: 'Review', hotkey: '2' },
  { tab: 'explain', label: 'Explain', short: 'Explain', hotkey: '3' },
  // Still `profile` inside: the tab grew from the Profile tab, and its key is what tests and muscle memory press.
  { tab: 'profile', label: 'Progress', short: 'Progress', hotkey: '4' },
]

const NEW = ' (new)'

/**
 * The tabs' labels and the gap between them. The full names are used when
 * the row fits the pane, and the short ones when it does not, so that the
 * tabs never wrap onto a second line.
 */
export function tabRow(view: Pick<PaneView, 'columns' | 'review'>): { labels: string[]; gap: number } {
  const name = (tab: Tab, label: string): string => (tab === 'review' && view.review.isUnseen ? `${label}${NEW}` : label)
  const full = TABS.map(({ tab, label }) => name(tab, label))
  // A button draws as its key, a colon, a space and its label.
  const width = full.reduce((sum, label) => sum + label.length + 3, 0) + 3 * (TABS.length - 1)

  return width <= view.columns ? { labels: full, gap: 3 } : { labels: TABS.map(({ tab, short }) => name(tab, short)), gap: 2 }
}

/** Shown while the pane does not have the keyboard: its keys do nothing until it does. */
export const KEYBOARD_HINT = 'Ctrl+X Tab or a click to use these keys. Esc to go back.'

function watching(view: PaneView): string {
  if (view.mode === 'paused') return 'Paused. /bsd resume to continue.'
  switch (view.watch.state) {
    case 'starting':
      return 'On. Getting ready.'
    case 'no-git':
      return 'On. This folder is not a git repository, so there is no play-by-play.'
    case 'looking':
      return 'On. Looking at your changes.'
    case 'failed':
      return `On. The last look failed (${view.watch.detail}). It will try again.`
    case 'held':
      return 'On. Holding back, because you are close to your plan limit. It still looks when you ask.'
    case 'idle':
      return view.isAutomatic ? 'On. Watching for your next save.' : 'On. Looking only when you ask.'
  }
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

/** The note the keys act on: the selected one if it is still open, otherwise the first. */
export function currentNote(view: Pick<PaneView, 'notes' | 'selected'>): Note | undefined {
  const sorted = sortNotes(view.notes)

  return sorted.find(note => note.id === view.selected) ?? sorted[0]
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
function characterRow({ Box, Text }: Kit, view: PaneView, { avatar, speech }: { avatar: Avatar; speech: Speech }) {
  const pose = poseOf(view.mode, view.watch.state, speech)
  const isResting = !isTalking(speech)
  const isAsleep = view.mode === 'paused'
  const width = bubbleWidth(view.columns, avatar.frames.rest[0]?.length ?? 0)

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
      <Box flexDirection="column">
        {avatar.frames[pose].map(line => (
          <Text color={avatar.color} dimColor={isResting} wrap="truncate-end">
            {line}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column">
        {isAsleep &&
          [...Array.from({ length: avatar.mouth - 1 }, () => ' '), ASLEEP].map(line => <Text dimColor>{line}</Text>)}
        {!isAsleep &&
          speech.text !== '' &&
          bubbleColumn(avatar, speech.text, wordsSaid(speech), width).map(line => (
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
  const notice = explainNotice(explain)
  const canFetch = explain.status === 'waiting' || explain.status === 'held' || explain.status === 'failed'

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

function deepReview({ Box, Text, Button, Markdown }: Kit, view: PaneView, actions: PaneActions) {
  const { review } = view

  return (
    <Box flexDirection="column">
      {review.state === 'none' && <Text dimColor>No deep review yet. One runs {view.reviewSchedule}.</Text>}
      {review.state === 'running' && (
        <Text dimColor>{review.subject === SURVEY_SUBJECT ? 'Taking a first look around this project.' : `Reviewing ${review.subject}.`}</Text>
      )}
      {review.state === 'failed' && (
        <Text>
          The review of {review.subject} did not finish: {review.text}
        </Text>
      )}
      {review.state === 'done' && <Text bold>{review.subject}</Text>}
      {review.state === 'done' && review.decisions.length > 0 && (
        <Box flexDirection="column">
          <Text bold color="magenta">
            {DECISION_HEADING}
          </Text>
          {review.decisions.map(decision => (
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
      {review.state === 'done' && <Markdown key="review" text={review.text} />}
      {review.state === 'done' && review.insights.length > 0 && (
        <Box flexDirection="column">
          <Text> </Text>
          <Text color="cyan">{INSIGHT_HEADING}</Text>
          {review.insights.map(insight => (
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
        label={`${note.id === current.id ? '>' : ' '} ${label}`}
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
  const notes = sortNotes(view.notes)
  const current = currentNote(view)
  if (current === undefined) {
    return (
      <Box flexDirection="column">
        <Text dimColor>No notes. Keep going.</Text>
        <Text> </Text>
        <Button key="look" label="look now" hotkey="l" plain onPress={() => actions.onLook()} />
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
      <Box flexDirection="row" columnGap={3}>
        <Button key="explain" label="explain" hotkey="e" plain onPress={() => actions.onExplain(current)} />
        <Button key="dismiss" label="dismiss" hotkey="d" plain onPress={() => actions.onDismiss(current)} />
        <Button key="mute" label="mute" hotkey="m" plain onPress={() => actions.onMute(current)} />
        <Button key="look" label="look now" hotkey="l" plain onPress={() => actions.onLook()} />
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

export function renderPane(kit: Kit, view: PaneView, actions: PaneActions) {
  const { Box, Text, Button } = kit
  const row = tabRow(view)
  // The character speaks for the play-by-play and the deep review, so it stands on their tabs only.
  const character = view.tab === 'play' || view.tab === 'review' ? view.character : null

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={row.gap}>
        {TABS.map(({ tab, hotkey }, index) => (
          <Button
            key={`tab-${tab}`}
            label={row.labels[index] ?? ''}
            hotkey={hotkey}
            plain
            dimColor={view.tab !== tab}
            onPress={() => actions.onTab(tab)}
          />
        ))}
      </Box>
      <Text dimColor>{statusLine(view)}</Text>
      {view.update !== '' && <Text color="yellow">{view.update}</Text>}
      {/* Outside a repository there is no journal, so nothing to go on and nowhere to keep an answer. */}
      {view.watch.state !== 'no-git' && workingOn(kit, view, actions)}
      <Text> </Text>
      {character !== null && characterRow(kit, view, character)}
      {character !== null && <Text> </Text>}
      {view.tab === 'play' && playByPlay(kit, view, actions)}
      {view.tab === 'review' && deepReview(kit, view, actions)}
      {view.tab === 'explain' && explainTab(kit, view, actions)}
      {view.tab === 'profile' && profileTab(kit, view, actions)}
      {!view.isFocused && <Text dimColor>{KEYBOARD_HINT}</Text>}
    </Box>
  )
}

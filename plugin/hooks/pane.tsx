import type { Elements } from 'claude-code'

import type { Mode, Note, Review, Tab, Watch } from '../types'
import { sortNotes } from './notes'

/** The elements the pane is built from. Every surface that draws panes has them. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button' | 'Markdown'>

/** Everything the pane shows, as plain data. */
export type PaneView = {
  mode: Mode
  tab: Tab
  persona: string
  notes: readonly Note[]
  /** The id of the note the keys act on, or null for the first one. */
  selected: number | null
  watch: Watch
  /** False when the play-by-play only looks on request. */
  isAutomatic: boolean
  review: Review
  /** When a deep review runs without being asked, in a few words: "after each commit". */
  reviewSchedule: string
}

/** What the pane's controls do. The closures come from register.tsx. */
export type PaneActions = {
  onTab: (tab: Tab) => void
  onSelect: (id: number) => void
  onExplain: (note: Note) => void
  onDismiss: (note: Note) => void
  onLook: () => void
  onReview: () => void
}

const TABS: readonly { tab: Tab; label: string; hotkey: string }[] = [
  { tab: 'play', label: 'Play-by-play', hotkey: '1' },
  { tab: 'review', label: 'Deep review', hotkey: '2' },
  { tab: 'profile', label: 'Profile', hotkey: '3' },
]

function watching(view: PaneView): string {
  if (view.mode === 'paused') return 'Paused. /bsd resume to continue.'
  switch (view.watch.state) {
    case 'no-git':
      return 'On. This folder is not a git repository, so there is no play-by-play.'
    case 'looking':
      return 'On. Looking at your changes.'
    case 'failed':
      return `On. The last look failed (${view.watch.detail}). It will try again.`
    case 'idle':
      return view.isAutomatic ? 'On. Watching for your next save.' : 'On. Looking only when you ask.'
  }
}

/** The one line under the tabs: whether the tutor is looking, and in what voice. */
export function statusLine(view: PaneView): string {
  return view.persona === 'none' ? watching(view) : `${watching(view)} Persona: ${view.persona}.`
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

function tabLabel(tab: Tab, label: string, view: PaneView): string {
  return tab === 'review' && view.review.isUnseen ? `${label} (new)` : label
}

function deepReview({ Box, Text, Button, Markdown }: Kit, view: PaneView, actions: PaneActions) {
  const { review } = view

  return (
    <Box flexDirection="column">
      {review.state === 'none' && <Text dimColor>No deep review yet. One runs {view.reviewSchedule}.</Text>}
      {review.state === 'running' && <Text dimColor>Reviewing {review.subject}.</Text>}
      {review.state === 'failed' && (
        <Text>
          The review of {review.subject} did not finish: {review.text}
        </Text>
      )}
      {review.state === 'done' && <Text bold>{review.subject}</Text>}
      {review.state === 'done' && <Markdown key="review" text={review.text} />}
      <Text> </Text>
      <Button key="review-now" label="review now" hotkey="r" plain onPress={() => actions.onReview()} />
    </Box>
  )
}

function playByPlay({ Box, Text, Button }: Kit, view: PaneView, actions: PaneActions) {
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

  return (
    <Box flexDirection="column">
      {notes.map((note, index) => (
        <Box flexDirection="column">
          {note.file !== notes[index - 1]?.file && <Text bold>{note.file}</Text>}
          <Button
            key={`note-${note.id}`}
            label={`${note.id === current.id ? '>' : ' '} ${note.id}  ${note.kind} · line ${note.line}`}
            plain
            dimColor={note.id !== current.id}
            onPress={() => actions.onSelect(note.id)}
          />
          <Box paddingLeft={4}>
            <Text>{note.text}</Text>
          </Box>
        </Box>
      ))}
      <Text> </Text>
      <Box flexDirection="row" columnGap={3}>
        <Button key="explain" label="explain" hotkey="e" plain onPress={() => actions.onExplain(current)} />
        <Button key="dismiss" label="dismiss" hotkey="d" plain onPress={() => actions.onDismiss(current)} />
        <Button key="look" label="look now" hotkey="l" plain onPress={() => actions.onLook()} />
      </Box>
    </Box>
  )
}

export function renderPane(kit: Kit, view: PaneView, actions: PaneActions) {
  const { Box, Text, Button } = kit

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={3}>
        {TABS.map(({ tab, label, hotkey }) => (
          <Button
            key={`tab-${tab}`}
            label={tabLabel(tab, label, view)}
            hotkey={hotkey}
            plain
            dimColor={view.tab !== tab}
            onPress={() => actions.onTab(tab)}
          />
        ))}
      </Box>
      <Text dimColor>{statusLine(view)}</Text>
      <Text> </Text>
      {view.tab === 'play' && playByPlay(kit, view, actions)}
      {view.tab === 'review' && deepReview(kit, view, actions)}
      {view.tab === 'profile' && <Text>Profiles are not built yet.</Text>}
    </Box>
  )
}

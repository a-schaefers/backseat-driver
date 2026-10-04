import type { Elements } from 'claude-code'

import type { Mode, Note, Tab, Watch } from '../types'
import { sortNotes } from './notes'

/** The elements the pane is built from. Every surface that draws panes has them. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

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
}

/** What the pane's controls do. The closures come from register.tsx. */
export type PaneActions = {
  onTab: (tab: Tab) => void
  onSelect: (id: number) => void
  onExplain: (note: Note) => void
  onDismiss: (note: Note) => void
  onLook: () => void
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

const NOT_BUILT: Record<Exclude<Tab, 'play'>, string> = {
  review: 'The deep review is not built yet.',
  profile: 'Profiles are not built yet.',
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
            label={label}
            hotkey={hotkey}
            plain
            dimColor={view.tab !== tab}
            onPress={() => actions.onTab(tab)}
          />
        ))}
      </Box>
      <Text dimColor>{statusLine(view)}</Text>
      <Text> </Text>
      {view.tab === 'play' ? playByPlay(kit, view, actions) : <Text>{NOT_BUILT[view.tab]}</Text>}
    </Box>
  )
}

import type { Elements } from 'claude-code'

import type { Mode, Tab } from '../types'

/** The elements the pane is built from. Every surface that draws panes has them. */
export type Kit = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

/** Everything the pane shows, as plain data. */
export type PaneView = {
  mode: Mode
  tab: Tab
  persona: string
}

/** What the pane's controls do. The closures come from register.tsx. */
export type PaneActions = {
  onTab: (tab: Tab) => void
}

const TABS: readonly { tab: Tab; label: string; hotkey: string }[] = [
  { tab: 'play', label: 'Play-by-play', hotkey: '1' },
  { tab: 'review', label: 'Deep review', hotkey: '2' },
  { tab: 'profile', label: 'Profile', hotkey: '3' },
]

/** The one line under the tabs: whether the tutor is looking, and in what voice. */
export function statusLine(view: PaneView): string {
  const state = view.mode === 'paused' ? 'Paused. /bsd resume to continue' : 'On'

  return view.persona === 'none' ? `${state}.` : `${state}. Persona: ${view.persona}.`
}

const NOT_BUILT: Record<Tab, string> = {
  play: 'The play-by-play is not built yet.',
  review: 'The deep review is not built yet.',
  profile: 'Profiles are not built yet.',
}

export function renderPane({ Box, Text, Button }: Kit, view: PaneView, actions: PaneActions) {
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
      <Text dimColor>
        {statusLine(view)}
      </Text>
      <Text> </Text>
      <Text>{NOT_BUILT[view.tab]}</Text>
    </Box>
  )
}

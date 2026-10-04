/** Whether the tutor is riding along: `paused` keeps the pane but stops looking. */
export type Mode = 'off' | 'on' | 'paused'

/** The pane's tabs. `play` is the play-by-play and the default view. */
export type Tab = 'play' | 'review' | 'profile'

declare module 'claude-code' {
  interface PluginState {
    'backseat-driver': {
      mode: Mode
      tab: Tab
    }
  }
}

/** Whether the tutor is riding along: `paused` keeps the pane but stops looking. */
export type Mode = 'off' | 'on' | 'paused'

/** The pane's tabs. `play` is the play-by-play and the default view. */
export type Tab = 'play' | 'review' | 'profile'

/** How much a note matters, most first: `bug` will break, `risk` may, `idiom` and `tip` teach. */
export type NoteKind = 'bug' | 'risk' | 'idiom' | 'tip'

/** One comment from the play-by-play, as the pane shows it. */
export type Note = {
  /** Counts up from 1 for the session and is never reused, so "note 3" stays note 3. */
  id: number
  /** Path from the repository root. */
  file: string
  line: number
  kind: NoteKind
  /** A short slug for the idea behind the note, such as `lock-across-await`. */
  topic: string
  text: string
}

/** What the watcher is doing, for the pane's status line. */
export type Watch = {
  state: 'idle' | 'looking' | 'no-git' | 'failed'
  /** When the last look finished, in clock milliseconds; null before the first one. */
  lastLookAt: number | null
  /** Why the last look failed, or what it found, in a few words. */
  detail: string
}

/** The latest deep review, for the pane's Deep review tab. */
export type Review = {
  state: 'none' | 'running' | 'done' | 'failed'
  /** What is or was under review, in a few words: "commit a1b2c3d: Fix the parser". */
  subject: string
  /** The review as Markdown when done, or why it failed. */
  text: string
  /** True until the user has opened the tab since this review arrived. */
  isUnseen: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'backseat-driver': {
      mode: Mode
      tab: Tab
      notes: Note[]
      /** The id of the note the pane's keys act on, or null for the first one. */
      selected: number | null
      watch: Watch
      review: Review
    }
  }
}

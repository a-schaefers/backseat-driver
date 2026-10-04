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
  /** `held`: nothing looks by itself, because a usage limit of the plan is nearly spent. */
  state: 'idle' | 'looking' | 'no-git' | 'failed' | 'held'
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

/** Something the user asked not to hear about again. */
export type Hush = {
  /** The same kind of slug a note carries, such as `missing-type-hints`. */
  topic: string
  /** What not to bring up, in the user's terms. */
  text: string
}

/** How often an idea has come up with this person. */
export type TopicStats = {
  /** Times the play-by-play raised it. */
  flagged: number
  /** Times they asked for it to be explained. */
  explained: number
}

/** What the tutor remembers about a person for one language, or in general. */
export type Profile = {
  /** Answers to the first-run questions, by question id. Empty when skipped. */
  answers: Record<string, string>
  /** True once the questions were answered or skipped, so they are not asked again unprompted. */
  isAsked: boolean
  hushed: Hush[]
  topics: Record<string, TopicStats>
}

/** The profiles in play this session, for the pane's Profile tab and for every prompt. */
export type Profiles = {
  /** Language ids, main ones first. `general` is always loaded and is not listed here. */
  languages: string[]
  /** By subject: a language id, or `general`. */
  subjects: Record<string, Profile>
}

declare module 'claude-code' {
  /** The tools this plugin registers for the tutor, so that a `tool.call` hook on one is typed. */
  interface McpToolInputs {
    'mcp__backseat-driver__hush': { topic: string; language: string; what: string; note?: number }
    'mcp__backseat-driver__unhush': { topic: string; language: string }
    'mcp__backseat-driver__profile': { language: string }
  }

  interface PluginState {
    'backseat-driver': {
      mode: Mode
      tab: Tab
      notes: Note[]
      /** Notes dismissed since the tutor was switched on. The same idea is not raised again in that file. */
      dismissed: Note[]
      /** The id of the note the pane's keys act on, or null for the first one. */
      selected: number | null
      watch: Watch
      review: Review
      profiles: Profiles
    }
  }
}

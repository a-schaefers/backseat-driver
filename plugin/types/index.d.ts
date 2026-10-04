/** Whether the tutor is riding along: `paused` keeps the pane but stops looking. */
export type Mode = 'off' | 'on' | 'paused'

/** The pane's tabs. `play` is the play-by-play and the default view. */
export type Tab = 'play' | 'review' | 'explain' | 'profile'

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
  /**
   * `starting`: just switched on, and the working tree has not been read yet.
   * `held`: nothing looks by itself, because a usage limit of the plan is nearly spent.
   */
  state: 'starting' | 'idle' | 'looking' | 'no-git' | 'failed' | 'held'
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

/** What the pane's animated character is saying. */
export type Speech = {
  /** The line, or '' while it has nothing to say. */
  text: string
  /** Ticks since it began the line. One more word is said each tick. */
  tick: number
  /** True for a moment now and then, while its eyes are shut. */
  isBlinking: boolean
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

/** Where the person is looking: a path from the repository root and a 1-based line. `endLine` past `line` means a selection. */
export type Spot = { path: string; line: number; endLine?: number }

export type ExplainStatus =
  /** Everything about the spot is on screen and current. */
  | 'fresh'
  /** Something is being fetched. What is shown is current, and more is coming. */
  | 'updating'
  /** There are gaps that nobody has asked to fill: lookups are on request. */
  | 'waiting'
  /** There are gaps, and they are left alone because the plan's usage limit is close. */
  | 'held'
  /** The last attempt to fetch it failed. It is tried again after a pause. */
  | 'failed'
  | 'no-file'
  | 'off'

/** One symbol of a file, as the Explain tab lists it. */
export type OutlineRow = { name: string; kind: string; startLine: number; endLine: number; summary: string }

/**
 * Everything the Explain tab shows about one spot. Nothing in it is stale:
 * every part was checked against the file on disk when the view was made.
 */
export type ExplainView = {
  spot: Spot | null
  status: ExplainStatus
  fileSummary: string
  /** The symbols that are current, in file order. One that changed is missing until the file is mapped again. */
  outline: OutlineRow[]
  /** False while the file has changed since it was mapped. */
  isOutlineCurrent: boolean
  /** False for a file too large to map: only what is asked about is explained. */
  isMappable: boolean
  /** What is in focus: a symbol, a selection, or nothing when the line is between symbols. */
  target: OutlineRow | null
  detail: { what: string; how: string; why: string; watch: string; uses: string[] } | null
  /** What a deep review said about this spot that still applies, each with the commit it comes from. */
  insights: string[]
}

declare module 'claude-code' {
  /** The tools this plugin registers for the tutor, so that a `tool.call` hook on one is typed. */
  interface McpToolInputs {
    'mcp__backseat-driver__hush': { topic: string; language: string; what: string; note?: number }
    'mcp__backseat-driver__unhush': { topic: string; language: string }
    'mcp__backseat-driver__profile': { language: string }
    'mcp__backseat-driver__record': { about: string; language: string; answer: string }
    'mcp__backseat-driver__lookup': { file: string; line?: number }
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
      /** What the Explain tab shows about the spot in focus. */
      explain: ExplainView
      /** The animated persona's line, while the animation is on. */
      speech: Speech
    }
  }
}

/** Whether the tutor is riding along: `paused` keeps the pane but stops looking. */
export type Mode = 'off' | 'on' | 'paused'

/** The pane's tabs. `play` is the play-by-play and the default view. */
export type Tab = 'play' | 'review' | 'explain' | 'profile' | 'settings'

/** One of the plugin's own `/config` rows, as the Settings tab shows it. */
export type SettingRow = {
  /** The row's key in `/config`: `<plugin>.<field>`. */
  key: string
  label: string
  description: string
  /** A toggle is shown as a pick between `on` and `off`. */
  kind: 'boolean' | 'choice'
  /** What it holds now: a choice's option, or `on` or `off`. */
  value: string
  options: string[]
  /** True when managed settings own the value: it is shown and cannot be changed here. */
  isLocked: boolean
}

/** How much a note matters, most first: `bug` will break, `risk` may, `idiom` and `tip` teach. */
/**
 * `bug` will break, `risk` may, `idiom` and `tip` teach. `decision` marks a
 * meaningful choice in their code, which stays theirs to make, and `insight`
 * points out an implementation choice or a pattern of their codebase. The last
 * two follow the Learning and Explanatory modes of Anthropic's
 * learning-output-style plugin (Apache-2.0), turned read-only: see
 * THIRD_PARTY_NOTICES.md.
 */
export type NoteKind = 'bug' | 'risk' | 'decision' | 'idiom' | 'tip' | 'insight'

/** A meaningful decision point a deep review found: a choice with real trade-offs, which stays theirs to make. */
export type DecisionPoint = {
  /** Path from the repository root, and a line in it, 0 when the review gave none. */
  file: string
  line: number
  /** What is being decided, in a few words. */
  choice: string
  /** What is at stake between the ways to go. */
  tradeoff: string
}

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

/** What the play-by-play is doing, for the pane's status line and the animated character's pose. */
export type Watch = {
  /**
   * `starting`: just switched on, and the working tree has not been read yet.
   * `settling`: a save was seen, and a look is on its way.
   * `waiting`: a look is wanted and held back: a request failed, Claude is not answering, or the plan's limit is close.
   * `idle`: none of these.
   */
  state: 'starting' | 'idle' | 'settling' | 'looking' | 'no-git' | 'waiting'
  /** When the last look finished, in clock milliseconds; null before the first one. */
  lastLookAt: number | null
  /** The status line as a sentence: what it is doing, and when a wait ends (`status.ts`). */
  line: string
  /** What keeps going wrong in the background, as a sentence for the dim row under the status line. Absent or '' when nothing does. */
  health?: string
  /**
   * Which editors are connected to this project, as a sentence (`editors.ts`), and '' when none is: the pane's
   * light is green for the one and red for the other. Absent while this session cannot say: before the editors'
   * files were first read, and in a session that does not read them.
   */
  editors?: string
}

/** A deep review as it was written: what the tab shows of one. */
export type ReviewText = {
  subject: string
  text: string
  decisions: DecisionPoint[]
  insights: string[]
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
  /** The meaningful decisions the reviewed work made or left open. The pane puts them first. */
  decisions: DecisionPoint[]
  /** What the review found worth knowing about the implementation choices and patterns of this codebase. */
  insights: string[]
  /** When the review that is running started, in clock milliseconds. */
  since?: number
  /** How many commits are waiting for their review, the one being reviewed included. */
  waiting?: number
  /** The last review that finished, kept in the tab while a newer one runs, waits or has failed. */
  last?: ReviewText | null
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

/**
 * What the person is working on, for the line under the pane's status line.
 * The pane shows the first of `said`, `inferred` and `where` that has anything in it.
 */
export type Working = {
  /** What they said they are working on, in their words. '' when they have not said, or took it back. */
  said: string
  /** How long ago they said it, once that is an hour or more: "3 h ago". */
  saidAgo: string
  /** What the play-by-play made of their activity at its last look, while the activity still fits it. */
  inferred: string
  /** Where their saves and their editor's caret have been lately: "stats.py, in mean". */
  where: string
  /** How much of the last few minutes went there: "72% of the last 10 minutes in the editor". */
  share: string
}

/** How far along someone is in a language, as the tutor has seen it in their own work. */
export type Level = 'beginner' | 'junior' | 'mid' | 'senior'

/** One thing the tutor saw in a commit of theirs: a skill shown, or one missed. */
export type Observation = {
  /** The commit's full hash. Two commits can share a short one. */
  commit: string
  /** The project it was seen in. */
  project: string
  at: number
  /** A short slug for the skill, such as `error-handling`. */
  skill: string
  verdict: 'shown' | 'missed'
  /** The level this skill belongs to. */
  level: Level
  /** 1 for work the tutor watched arrive, 0.5 for other commits of theirs. */
  weight: number
  note: string
}

export type LevelChange = {
  at: number
  from: Level | null
  to: Level
  reason: string
  /** How many observations there were when it changed: what came after is new evidence. */
  observationCount: number
}

/** What the Progress tab says about one language, as last written. */
export type Report = {
  why: string
  next: string
  working: string[]
  encouragement: string
  at: number
}

/** Everything the tutor has seen of someone's own work in one language, across projects. */
export type ProgressRecord = {
  v: 1
  language: string
  /** Null until there is enough to go on. */
  level: Level | null
  /** True until the level rests on enough work to be more than a first impression. */
  isProvisional: boolean
  observations: Observation[]
  history: LevelChange[]
  report: Report | null
  /** Full hashes of the commits already assessed, so that none counts twice, in any project. */
  assessed: string[]
}

/** The Progress tab's view: the records of the languages in play, and whose commits count. */
export type ProgressView = {
  /** Off when the setting is off. */
  isOn: boolean
  /** The email addresses whose commits count. Empty when git has none. */
  identity: string[]
  records: ProgressRecord[]
  /** What is being assessed right now, in a few words, or ''. */
  busy: string
  /** Why the last commit did not count, or ''. */
  skipped: string
}

declare module 'claude-code' {
  /** The tools this plugin registers for the tutor, so that a `tool.call` hook on one is typed. */
  interface McpToolInputs {
    'mcp__backseat-driver__hush': { topic: string; language: string; what: string; note?: number }
    'mcp__backseat-driver__unhush': { topic: string; language: string }
    'mcp__backseat-driver__profile': { language: string }
    'mcp__backseat-driver__record': { about: string; language: string; answer: string }
    'mcp__backseat-driver__lookup': { file: string; line?: number }
    'mcp__backseat-driver__working': { on: string }
    'mcp__backseat-driver__activity': Record<never, never>
    'mcp__backseat-driver__progress': { language: string }
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
      progress: ProgressView
      /** What the pane says about a newer release, or ''. */
      update: string
      /** What the pane says about the license, or '': usually nothing. */
      license: string
      /** The animated persona's line, while the animation is on. */
      speech: Speech
      /** What they are working on, for the line under the status line. */
      working: Working
      /** In the unified layout, whether the lines above the prompt are opened into the tab. */
      unfolded: boolean
      /** Whether the band above the prompt has the keyboard, as far as its focus ring has told. */
      bandKeys: boolean
      /** The plugin's own `/config` rows, for the Settings tab. Read again whenever the tab is opened. */
      settings: SettingRow[]
      /** The `userConfig` values this module was last loaded with, so that a reload can tell which of them changed. */
      applied: Readonly<Record<string, string | number | boolean | readonly string[]>> | null
    }
  }
}

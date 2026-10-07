/** Whether the tutor is riding along: `paused` keeps the pane but stops looking. */
export type Mode = 'off' | 'on' | 'paused'

/** The pane's tabs. `play` is the play-by-play and the default view. */
export type Tab = 'play' | 'review' | 'explain' | 'profile' | 'lessons' | 'settings'

/** One of the plugin's own `/config` rows, as the Settings tab shows it. */
export type SettingRow = {
  /** The row's key in `/config`: `<plugin>.<field>`. */
  key: string
  label: string
  description: string
  /** A toggle is shown as a pick between `on` and `off`. A typed value (`text`) is shown and changed in /config. */
  kind: 'boolean' | 'choice' | 'text'
  /** What it holds now: a choice's option, `on` or `off`, or the text typed. */
  value: string
  /** Empty for a typed value, which the tab shows with "set it in /config". */
  options: string[]
  /** True when managed settings own the value: it is shown and cannot be changed here. */
  isLocked: boolean
}

/** How much a note matters, most first: `bug` will break, `risk` may, `idiom` and `tip` teach. */
/**
 * `bug` will break, `risk` may, `idiom` and `tip` teach. `decision` marks a
 * meaningful choice in their code, which stays theirs to make, and `insight`
 * points out an implementation choice or a pattern of their codebase.
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
  /**
   * The line it points at, trimmed, as the look that raised it saw it. A later
   * look moves the note when that line moved and takes it down when it is gone.
   * Absent on notes from before 2026-10-05.
   */
  lineText?: string
}

/** What the play-by-play is doing, for the pane's status line and the animated character's pose. */
export type Watch = {
  /**
   * `starting`: just switched on, and the working tree has not been read yet.
   * `settling`: a save was seen, and a look is on its way.
   * `waiting`: a look is wanted and held back: a request failed, Claude is not answering, or the plan's limit is close.
   * `following`: another session drives this project, and this one shows what it writes: no watching of its own.
   * `idle`: none of these.
   */
  state: 'starting' | 'idle' | 'settling' | 'looking' | 'no-git' | 'waiting' | 'following'
  /** When the last look finished, in clock milliseconds; null before the first one. */
  lastLookAt: number | null
  /** The status line as a sentence: what it is doing, and when a wait ends (`status.ts`). */
  line: string
  /** What keeps going wrong in the background, as a sentence for the dim row under the status line. Absent or '' when nothing does. */
  health?: string
  /**
   * Which editors are connected to this project, as a sentence (`editors.ts`), and '' when none is: the pane's
   * light is green for the one and red for the other. Absent while this session cannot say: before the editors'
   * files were first read (the driver reads them at every scan, a session that does not drive at every beat of the lease).
   */
  editors?: string
  /**
   * While another session drives this project: when that session started, as a clock time ("00:58"), for the line
   * under the controls that says looks and reviews run there. '' while not known. Absent while this session drives.
   */
  driver?: string
}

/** A deep review as it was written: what the tab shows of one. */
export type ReviewText = {
  subject: string
  text: string
  decisions: DecisionPoint[]
  insights: string[]
  /** When it finished, and the commit it was about, for the history of the Deep review tab. Absent on a review of the work since the last one. */
  at?: number
  commit?: string
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
  /** Every review that finished in this project, newest first (reviews.json), so that the tab can go back to "the last review" a newer one refers to. */
  older?: ReviewText[]
  /** Which review the tab shows: 0 is the latest readable one, 1 the one before it, and so on. Back to 0 when a review lands. */
  opened?: number
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
  /** The profile's `looks` when it was last raised: how many looks since then tells whether it stopped coming back. */
  lastLook: number
}

/** What the tutor remembers about a person for one language, or in general. */
export type Profile = {
  /** Answers to the first-run questions, by question id. Empty when skipped. */
  answers: Record<string, string>
  /** True once the questions were answered or skipped, so they are not asked again unprompted. */
  isAsked: boolean
  hushed: Hush[]
  topics: Record<string, TopicStats>
  /** How many looks of the play-by-play have seen their code in this language. */
  looks: number
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
  /** The person's own added lines the assessments have read, in all. A level needs enough of them (owner, 2026-10-05: eight lines are no basis for one). */
  linesRead: number
  /** When a provisional level was last withdrawn as the record was read, in clock milliseconds, or 0: a report older than that was the placement's. */
  withdrawnAt: number
}

/** One step of a lesson as the Lessons tab shows it. `checked` is done with the tutor watching, `done` marked done by them. */
export type LessonStepView = { title: string; state: 'checked' | 'done' | 'started' | ''; helped: number }

/** One learning path, and where they are in it. */
export type LessonView = {
  id: string
  title: string
  language: string
  level: Level
  summary: string
  skills: string[]
  steps: LessonStepView[]
  /** The step to do next, 0-based, or -1 once every step is done. */
  next: number
}

/** The Lessons tab's view: the paths found, in the order shown, and the one opened. */
export type LessonsView = {
  paths: LessonView[]
  /** The path opened in the tab, or null for the list. */
  selected: string | null
  /** Files in the lessons folder that are not a path, and why. */
  problems: string[]
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

/** The project's ledger of issues (`findings.json`, plugin/core/findings.ts). */
export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Category = 'security' | 'bug' | 'edge-case' | 'logic' | 'robustness' | 'quality'
export type IssueStatus = 'open' | 'partly' | 'resolved' | 'dismissed'
/** Who says something of an issue: the person, a deep review or audit, the play-by-play. */
export type Actor = 'person' | 'review' | 'look'
export type IssueOrigin = 'audit' | 'review'
export type PersonAction = 'dismiss' | 'restore' | 'pin' | 'unpin'


export type Finding = {
  id: number
  /** The path from the repository's root, or `.` for the project as a whole. */
  file: string
  /** 0 for an issue about the whole file or project. */
  line: number
  /** The line as it read when the issue was found, trimmed: where to look for it after the file has changed. */
  lineText: string
  severity: Severity
  category: Category
  topic: string
  /** A few words to scan a list by. */
  title: string
  /** What is wrong and why it matters, naming the idea; never the fix, never a secret's value. */
  text: string
  /** '' or the condition it depends on: "only if the site is deployed with its .git folder". */
  condition: string
  origin: IssueOrigin
  commit: string
  at: number
  status: IssueStatus
  statusAt: number
  statusBy: '' | Actor
  statusNote: string
  isPinned: boolean
}

/** What the last audit read. `files` is how many source files git listed; `read` and `skipped` are its own account. */
export type Coverage = { at: number; commit: string; files: number; read: string[]; skipped: { path: string; why: string }[] }

export type Ledger = { nextId: number; findings: Finding[]; coverage: Coverage }

/** The project's ledger of issues as the pane holds it: the ledger, where each open issue's line stands now, and whether an audit was started. */
export type IssuesState = {
  ledger: Ledger
  /** By id: the issue's line in its file as the file reads now, 0 for a whole file, null when its line changed since it was found. */
  placed: Record<string, number | null>
  /** True once an audit of the project was started. */
  isAudited: boolean
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
    'mcp__backseat-driver__lesson': { path?: string; step?: number; outcome?: 'done' | 'help' }
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
      /** The project's ledger of issues, which the Deep review tab ranks and every view draws. */
      issues: IssuesState
      /** The id of the issue the Deep review tab's keys act on, or null for the first one. */
      selectedIssue: number | null
      watch: Watch
      review: Review
      profiles: Profiles
      /** What the Explain tab shows about the spot in focus. */
      explain: ExplainView
      progress: ProgressView
      /** The Lessons tab: the learning paths found, and where they are in each. */
      lessons: LessonsView
      /** What the pane says about a newer release, or ''. */
      update: string
      /** What the pane says about the license, or '': usually nothing. */
      license: string
      /** The animated persona's line, while the animation is on. */
      speech: Speech
      /** What they are working on, for the line under the status line. */
      working: Working
      /** Which list opened downward is open: `jump:<subject>` or `setting:<key>`, or '' while every one is folded. */
      openList: string
      /** The spinner's tick behind a tab at work: a review running, a lookup, a look at the progress. */
      spin: number
      /** True while the pane is put away as a strip above the prompt: the tutor on, its pane closed. */
      minimized: boolean
      /** The plugin's own `/config` rows, for the Settings tab. Read again whenever the tab is opened. */
      settings: SettingRow[]
      /** The `userConfig` values this module was last loaded with, so that a reload can tell which of them changed. */
      applied: Readonly<Record<string, string | number | boolean | readonly string[]>> | null
    }
  }
}

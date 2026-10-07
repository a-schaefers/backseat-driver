import type { Review, ReviewText } from '../types'

/** The latest move of HEAD, as `git reflog -1 --format=%H%x00%gs` prints it. */
export type ReflogEntry = {
  hash: string
  /** What moved HEAD: "commit: Fix the parser", "checkout: moving from a to b", "pull: Fast-forward". */
  subject: string
}

export const REFLOG_ARGS = ['reflog', '-1', '--format=%H%x00%gs'] as const

export function parseReflog(output: string): ReflogEntry | null {
  const [hash, subject] = output.trim().split('\0')
  if (hash === undefined || subject === undefined || !/^[0-9a-f]{7,64}$/.test(hash)) return null

  return { hash, subject }
}

/** True for a commit the user made, amended or merged. False for a checkout, pull, reset or rebase. */
export function isCommit(entry: ReflogEntry): boolean {
  return /^commit( \([a-z]+\))?: /.test(entry.subject)
}

/** The commit's own subject line, from its reflog entry. */
export function commitTitle(entry: ReflogEntry): string {
  return entry.subject.replace(/^commit( \([a-z]+\))?: /, '')
}

export function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

/** What a deep review looks at. */
export type ReviewScope =
  | {
      kind: 'commit'
      hash: string
      title: string
      /** `git show` of the commit: message, stat and patch. */
      patch: string
    }
  | {
      kind: 'since'
      /** The commit the previous deep review ended at. */
      from: string
      /** One line per commit made since then. */
      log: string
      /** Everything since then, committed or not, as one diff against the working tree. */
      diff: string
      /** New files git does not track yet, which no diff shows. */
      untracked: readonly string[]
    }
  /** No change at all: a first look around a project the tutor has not seen before. */
  | { kind: 'survey' }
  /**
   * No change at all: a look through the code as it is, for issues, ranked
   * (owner, 2026-10-07: in a real codebase the pane said nothing, and its
   * silence read as "he wrote a perfect codebase"). `files` are their source
   * files as git lists them; `vendored` the folders that look generated.
   */
  | { kind: 'audit'; files: readonly string[]; vendored: readonly string[] }

export function showCommitArgs(hash: string): string[] {
  return ['show', '--no-color', '--stat', '--patch', '--format=commit %H%nAuthor: %an%nDate:   %ad%n%n%s%n%n%b', hash]
}

/** A patch longer than this is cut. The reviewer can read the files itself. */
const MAX_PATCH_CHARS = 60_000

function capped(text: string): string {
  if (text.length <= MAX_PATCH_CHARS) return text

  return `${text.slice(0, MAX_PATCH_CHARS)}\n[Cut here: ${text.length - MAX_PATCH_CHARS} more characters. Read the files for the rest.]`
}

/** What the pane calls a survey, which reviews nothing. */
export const SURVEY_SUBJECT = 'a first look around this project'

/** What the pane calls an audit, which looks through the whole codebase for issues. */
export const AUDIT_SUBJECT = 'an audit of this project'

/** How many of their files an audit's request names. */
const MAX_AUDIT_FILES = 300

/** The files a patch or diff changes, by their path after the change. */
export function changedFilesOf(patch: string): string[] {
  const files: string[] = []
  for (const match of patch.matchAll(/^diff --git a\/.+ b\/(.+)$/gm)) {
    const path = match[1] ?? ''
    if (path !== '' && !files.includes(path)) files.push(path)
  }

  return files
}

/** What the pane calls the thing under review. */
export function scopeSubject(scope: ReviewScope): string {
  if (scope.kind === 'survey') return SURVEY_SUBJECT
  if (scope.kind === 'audit') return AUDIT_SUBJECT
  if (scope.kind === 'commit') return `commit ${shortHash(scope.hash)}: ${scope.title}`

  return scope.log.trim() === '' ? 'your uncommitted work' : `your work since ${shortHash(scope.from)}`
}

/** True when a timed review would have nothing to look at. */
export function isEmptyScope(scope: ReviewScope): boolean {
  return scope.kind === 'since' && scope.diff.trim() === '' && scope.untracked.length === 0
}

/** What the reviewer is given besides the change: what is already known, and what it said before. */
export type ReviewContext = {
  /** The project's overview as last written, or ''. */
  overview: string
  /** The reviewer's own recent reviews, newest first, or ''. */
  earlier: string
  /** The issues on record for what it looks at, each a line or two with its id, and the ones the person dismissed. */
  issues?: { open: readonly string[]; dismissed: readonly string[] }
}

function background(context: ReviewContext): string[] {
  return [
    ...(context.overview === '' ? [] : ['', 'What is on record about this project. Correct it in your notes if it is wrong or out of date:', context.overview]),
    ...(context.earlier === ''
      ? []
      : ['', 'Your earlier reviews, newest first. Where this change answers something you raised, say so. Do not repeat a point that still stands unless it matters more now:', context.earlier]),
    ...issuesOnRecord(context.issues),
  ]
}

/** The issues on record, for the reviewer to rule on by id, and the dismissed ones it never raises again. */
function issuesOnRecord(issues: ReviewContext['issues']): string[] {
  if (issues === undefined || (issues.open.length === 0 && issues.dismissed.length === 0)) return []

  return [
    '',
    'Issues on record here, with their ids. Rule on each in your fence: still open, partly fixed (say what remains) or resolved. Raise none of them again as a new issue:',
    ...(issues.open.length === 0 ? ['(none open)'] : issues.open),
    ...(issues.dismissed.length === 0 ? [] : ['', 'Issues the person dismissed. Never raise them again:', ...issues.dismissed]),
  ]
}

/**
 * The task handed to the deep reviewer. Its instructions are its system
 * prompt. `doing` is what the journal says about how the work came about, or
 * '' for nothing: it goes after the change, because it is not part of it.
 */
export function reviewRequest(scope: ReviewScope, context: ReviewContext = { overview: '', earlier: '' }, doing = ''): string {
  const closing =
    'The repository is your working directory. Read the files this touches, and the code around them, before you write.'
  const journal = doing === '' ? [] : ['', doing]

  if (scope.kind === 'survey') {
    return [
      'Survey this project. Nothing has changed: this is a first look around, so that later reviews and explanations start from the big picture.',
      'The repository is your working directory. Look at its layout, its entry points, its main modules and its tests. A dozen files read is plenty.',
    ].join('\n')
  }
  if (scope.kind === 'audit') {
    return [
      'Audit this project for issues. Nothing has changed: this is a look through the code as it is, for what is wrong or will bite, ranked from critical to low.',
      'The repository is your working directory. Read the code that takes input from outside first (requests, files, the command line, the database), then what it calls. About 25 files read is plenty: say in your fence which you read, and what you skipped and why.',
      ...background(context),
      '',
      'Their source files, as git lists them:',
      ...(scope.files.length === 0 ? ['(none listed)'] : scope.files.slice(0, MAX_AUDIT_FILES).map(path => `- ${path}`)),
      ...(scope.files.length > MAX_AUDIT_FILES ? [`[and ${scope.files.length - MAX_AUDIT_FILES} more]`] : []),
      ...(scope.vendored.length === 0
        ? []
        : ['', 'Folders that look generated or vendored. Do not audit their insides; a known-vulnerable version of what is in one is one issue:', ...scope.vendored.map(path => `- ${path}`)]),
    ].join('\n')
  }
  if (scope.kind === 'commit') {
    return [`Review this commit.`, closing, ...background(context), '', capped(scope.patch), ...journal].join('\n')
  }

  return [
    'Review the work done since your previous review. Some of it is committed and some is not.',
    closing,
    ...background(context),
    '',
    'Commits since then:',
    scope.log.trim() === '' ? '(none)' : scope.log.trim(),
    '',
    'All changes since then, as one diff:',
    scope.diff.trim() === '' ? '(none)' : capped(scope.diff),
    ...(scope.untracked.length === 0
      ? []
      : ['', 'New files git does not track yet. Read the ones that matter:', ...scope.untracked.map(path => `- ${path}`)]),
    ...journal,
  ].join('\n')
}

/** A cheap fingerprint of a scope, to tell whether anything changed since the previous review. */
export function scopePrint(scope: ReviewScope): string {
  const text =
    scope.kind === 'survey' || scope.kind === 'audit' ? scope.kind : scope.kind === 'commit' ? scope.hash : `${scope.from}\n${scope.diff}\n${scope.untracked.join('\n')}`
  let hash = 5381
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0

  return `${text.length}:${hash}`
}

/** The Markdown element takes 10,000 characters. A review is asked to be far shorter. */
const MAX_REVIEW_CHARS = 9500

export function fitReview(text: string): string {
  const trimmed = text.trim()

  return trimmed.length <= MAX_REVIEW_CHARS ? trimmed : `${trimmed.slice(0, MAX_REVIEW_CHARS)}\n\n(cut)`
}

/** What the model reads about this agent type when deciding whether to delegate to it. */
export const REVIEWER_DESCRIPTION =
  "Backseat Driver's deep reviewer: a read-only reviewer on the user's chosen deep review model. Use it for a second opinion when the user contests a point you made and you still think it stands. Give it the code in question, your point and the user's argument."

/**
 * The Deep review tab's state after a change. A review that finished is not
 * thrown away when the next one starts: it stays, as `last`, until a newer
 * one is done, so that there is always something to read.
 */
export function withReviewChange(review: Review, change: Partial<Review>): Review {
  const isLeavingDone = review.state === 'done' && change.state !== undefined && change.state !== 'done'
  const last: ReviewText | null = isLeavingDone
    ? { subject: review.subject, text: review.text, decisions: review.decisions, insights: review.insights }
    : change.state === 'done'
      ? null
      : (review.last ?? null)

  // A review that lands is the one to read: the tab comes back to it from wherever it was in the history.
  return { ...review, ...change, last, ...(change.state === 'done' ? { opened: 0 } : {}) }
}

/**
 * Every review there is to read, newest first: the one readable now, then
 * the earlier ones kept in reviews.json (which hold the readable one too,
 * once it is written: it is listed once).
 */
export function reviewHistory(review: Review): ReviewText[] {
  const current = readableReview(review)
  const older = review.older ?? []
  if (current === null) return older

  return older.some(earlier => earlier.text === current.text && earlier.subject === current.subject) ? older : [current, ...older]
}

/** The review the tab shows, where it stands in the history, and how many there are. */
export function shownReview(review: Review): { shown: ReviewText | null; index: number; count: number } {
  const history = reviewHistory(review)
  const index = Math.min(Math.max(review.opened ?? 0, 0), Math.max(history.length - 1, 0))

  return { shown: history[index] ?? null, index, count: history.length }
}

/** How many places a review's text can send the person to, at most. */
export const MAX_JUMPS = 4

/**
 * The places a review names as `path:line`, in order and each once: what the
 * person can jump to (owner, 2026-10-05: "should be clickable to jump to the
 * exact spot"). A path has to look like a file (an extension of letters).
 */
export function spotsIn(text: string, limit = MAX_JUMPS): { path: string; line: number }[] {
  const found: { path: string; line: number }[] = []
  for (const match of text.matchAll(/(?<![\w./-])((?:[\w.-]+\/)*[\w-]+(?:\.[\w-]+)*\.[A-Za-z]\w*):(\d{1,6})(?!\d)/g)) {
    const path = match[1] ?? ''
    const line = Number(match[2])
    if (line < 1 || found.some(spot => spot.path === path && spot.line === line)) continue
    found.push({ path, line })
    if (found.length >= limit) break
  }

  return found
}

/** The review the person can read right now: the latest when it is done, else the last one that was. */
export function readableReview(review: Review): ReviewText | null {
  if (review.state === 'done') return { subject: review.subject, text: review.text, decisions: review.decisions, insights: review.insights }

  return review.last ?? null
}

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

/** What the pane calls the thing under review. */
export function scopeSubject(scope: ReviewScope): string {
  if (scope.kind === 'survey') return SURVEY_SUBJECT
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
}

function background(context: ReviewContext): string[] {
  return [
    ...(context.overview === '' ? [] : ['', 'What is on record about this project. Correct it in your notes if it is wrong or out of date:', context.overview]),
    ...(context.earlier === ''
      ? []
      : ['', 'Your earlier reviews, newest first. Where this change answers something you raised, say so. Do not repeat a point that still stands unless it matters more now:', context.earlier]),
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
    scope.kind === 'survey' ? 'survey' : scope.kind === 'commit' ? scope.hash : `${scope.from}\n${scope.diff}\n${scope.untracked.join('\n')}`
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

  return { ...review, ...change, last }
}

/** The review the person can read right now: the latest when it is done, else the last one that was. */
export function readableReview(review: Review): ReviewText | null {
  if (review.state === 'done') return { subject: review.subject, text: review.text, decisions: review.decisions, insights: review.insights }

  return review.last ?? null
}

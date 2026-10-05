import type { Health, Pressure } from './health'
import { shortHash } from './review'
import { clockTime } from './status'

/**
 * The commits that are waiting for their deep review, or for the look at the
 * person's progress that follows it.
 *
 * A commit goes in the moment it is seen and comes out when both are done.
 * It is kept in the project's folder, so that a commit made while Claude was
 * not answering, while the plan was at its limit, or just before the session
 * was closed is still reviewed: when things are back, or the next time the
 * tutor is switched on here. Only the latest few are kept, and not for long:
 * a review of last week's commit helps nobody.
 */

export type Waiting = {
  /** The commit's full hash. */
  hash: string
  title: string
  /** When the commit was seen, in clock milliseconds. */
  at: number
  /** True once its deep review is done, or given up on. The look at the person's progress is what is left. */
  isReviewed: boolean
  /** Tries that got no answer, at the stage it is at now. */
  attempts: number
}

export type ReviewQueue = { v: 1; commits: Waiting[] }

/** How many commits wait at most. A newer one pushes the oldest out. */
export const MAX_WAITING = 3
/** A commit that has waited this long is let go. */
export const MAX_WAIT_MS = 24 * 60 * 60 * 1000
/** How often one stage of one commit is tried before it is given up on. */
export const MAX_ATTEMPTS = 3
/** After a try that got no answer, the next one waits this long, doubling. */
export const RETRY_MS = 60_000
/** A review that has not reported back after this long is looked for. */
export const WATCHDOG_MS = 15 * 60 * 1000
/** One that is still running then gets until this long after it started, and no longer. */
export const WATCHDOG_LIMIT_MS = 45 * 60 * 1000
/**
 * A review that died on an API error ends saying only "error". Which error
 * arrives separately, at about the same moment, before or after. It gets
 * this long to arrive before the failure is taken to have no known reason.
 */
export const VERDICT_MS = 2000

export const EMPTY_QUEUE: ReviewQueue = { v: 1, commits: [] }

function isWaiting(value: unknown): value is Waiting {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>

  return (
    typeof entry.hash === 'string' &&
    /^[0-9a-f]{7,64}$/.test(entry.hash) &&
    typeof entry.title === 'string' &&
    typeof entry.at === 'number' &&
    typeof entry.isReviewed === 'boolean' &&
    typeof entry.attempts === 'number'
  )
}

/** The queue as stored. Anything that is not one is an empty queue. */
export function parseQueue(stored: unknown): ReviewQueue {
  if (typeof stored !== 'object' || stored === null) return EMPTY_QUEUE
  const commits = (stored as { commits?: unknown }).commits

  return { v: 1, commits: Array.isArray(commits) ? commits.filter(isWaiting).slice(-MAX_WAITING) : [] }
}

/** The queue without what has waited too long. */
export function current(queue: ReviewQueue, now: number): ReviewQueue {
  const commits = queue.commits.filter(commit => now - commit.at < MAX_WAIT_MS)

  return commits.length === queue.commits.length ? queue : { v: 1, commits }
}

/** A commit that was just seen joins the end. One already waiting stays as it is. */
export function withCommit(queue: ReviewQueue, commit: { hash: string; title: string }, at: number): ReviewQueue {
  if (queue.commits.some(known => known.hash === commit.hash)) return queue

  return { v: 1, commits: [...queue.commits, { hash: commit.hash, title: commit.title, at, isReviewed: false, attempts: 0 }].slice(-MAX_WAITING) }
}

export function withoutCommit(queue: ReviewQueue, hash: string): ReviewQueue {
  return { v: 1, commits: queue.commits.filter(commit => commit.hash !== hash) }
}

/** The commit's review is done, or given up on: what is left is the look at the person's progress. */
export function reviewed(queue: ReviewQueue, hash: string): ReviewQueue {
  return { v: 1, commits: queue.commits.map(commit => (commit.hash === hash ? { ...commit, isReviewed: true, attempts: 0 } : commit)) }
}

/** One more try at the commit's present stage got no answer. */
export function withAttempt(queue: ReviewQueue, hash: string): ReviewQueue {
  return { v: 1, commits: queue.commits.map(commit => (commit.hash === hash ? { ...commit, attempts: commit.attempts + 1 } : commit)) }
}

/** Whether the commit's present stage has been tried as often as it will be. */
export function isSpent(queue: ReviewQueue, hash: string): boolean {
  return (queue.commits.find(commit => commit.hash === hash)?.attempts ?? 0) >= MAX_ATTEMPTS
}

/** How long to wait after the nth try in a row that got no answer. */
export function retryMs(attempts: number): number {
  return RETRY_MS * 2 ** Math.max(0, attempts - 1)
}

export type Wanted = {
  /** Whether commits are reviewed as they are made. */
  wantsReview: boolean
  /** Whether the person's progress is kept. */
  wantsAssessment: boolean
}

/** The oldest commit that still needs its review. */
export function nextToReview(queue: ReviewQueue, wanted: Wanted): Waiting | null {
  return wanted.wantsReview ? (queue.commits.find(commit => !commit.isReviewed) ?? null) : null
}

/** The oldest commit whose review is done with and which still needs the look at the person's progress. */
export function nextToAssess(queue: ReviewQueue, wanted: Wanted): Waiting | null {
  return wanted.wantsAssessment ? (queue.commits.find(commit => commit.isReviewed || !wanted.wantsReview) ?? null) : null
}

/** The commits that need nothing more under these settings, to be taken out. */
export function settledIn(queue: ReviewQueue, wanted: Wanted): string[] {
  return wanted.wantsAssessment ? [] : queue.commits.filter(commit => commit.isReviewed || !wanted.wantsReview).map(commit => commit.hash)
}

/** A commit as the pane names it: "commit a1b2c3d: Fix the parser". */
export function commitSubject(commit: { hash: string; title: string }): string {
  return `commit ${shortHash(commit.hash)}: ${commit.title}`
}

/** What the Deep review tab says about a commit whose review is held back by the plan's limit. */
export const PLAN_HELD = 'you are close to your plan limit. Press r to run it anyway.'

/**
 * Why a waiting review is not running, as the tab says it. '' when nothing
 * holds it back. `retryAt` is the review's own next try, when it has one
 * planned: the time named is the later of the two.
 */
export function heldText(health: Health, pressure: Pressure, jobBlock: string | undefined, retryAt: number | null): string {
  if (jobBlock !== undefined) return `the deep review cannot run (${jobBlock}). Its model is set in /config.`
  if (health.state === 'blocked') return `Claude is refusing this account (${health.detail}). It is reviewed once that is sorted out.`
  if (pressure.level === 'held') return PLAN_HELD
  if (health.state === 'waiting') {
    return `Claude is not answering (${health.detail}). It is tried again at ${clockTime(Math.max(health.until, retryAt ?? 0))}, or press r.`
  }
  if (health.state === 'probing') {
    return `Claude is not answering (${health.detail}). It is tried again ${retryAt === null ? 'shortly' : `at ${clockTime(retryAt)}`}, or press r.`
  }

  return ''
}

/** What the tab says after a try that got no answer: when the next one is, or that there will be none. */
export function failedText(detail: string, retryAt: number | null): string {
  return retryAt === null ? `${detail}. Press r to run it again.` : `${detail}. It is tried again at ${clockTime(retryAt)}, or press r.`
}

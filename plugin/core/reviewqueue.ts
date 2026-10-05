import { MAX_WAITING } from './core'
import { shortHash } from './review'

// The rules are the kernel's (kernel/src/Kernel/Queue.purs), through core.ts. The types, and reading the file, are here.
export {
  current,
  failedText,
  heldText,
  isSpent,
  MAX_ATTEMPTS,
  MAX_WAIT_MS,
  MAX_WAITING,
  nextToAssess,
  nextToReview,
  PLAN_HELD,
  RETRY_MS,
  retryMs,
  reviewed,
  settledIn,
  VERDICT_MS,
  WATCHDOG_LIMIT_MS,
  WATCHDOG_MS,
  withAttempt,
  withCommit,
  withoutCommit,
} from './core'

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

export type Wanted = {
  /** Whether commits are reviewed as they are made. */
  wantsReview: boolean
  /** Whether the person's progress is kept. */
  wantsAssessment: boolean
}

/** A commit as the pane names it: "commit a1b2c3d: Fix the parser". */
export function commitSubject(commit: { hash: string; title: string }): string {
  return `commit ${shortHash(commit.hash)}: ${commit.title}`
}

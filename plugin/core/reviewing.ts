/**
 * The waiting commits and their deep reviews: what is started next, how a
 * review that ended without a review counts, and how a reviewer that never
 * reports back is given up on. This is the engine; the program it runs in
 * gives it `ReviewPorts`, and what it remembers is `ReviewState`.
 *
 * Moved out of `hooks/register.tsx` with each call made in the order it was
 * made there. The reviewer itself, starting it and collecting its answer, is
 * the host's: it is Claude Code's agents.
 */

import type { Review } from '../types'
import { failedText, heldText, isSpent, mayAsk, nextToAssess, nextToReview, retryMs, reviewed, settledIn, WATCHDOG_LIMIT_MS, WATCHDOG_MS, withAttempt, withoutCommit } from './core'
import type { Health, Pressure } from './health'
import type { Trace } from './host'
import { commitSubject, EMPTY_QUEUE } from './reviewqueue'
import type { ReviewQueue, Waiting } from './reviewqueue'
import { scopeSubject, shortHash, showCommitArgs } from './review'
import type { ReviewScope } from './review'
import type { Settings } from './settings'

/** What the commits waiting for review and the reviewer remember. It is the review slot, with the retry times. */
export type ReviewState = {
  /** The commits waiting for their review, or for the look at the person's progress after it: the copy in memory. */
  waiting: ReviewQueue
  /** True while the look at the person's progress, for a waiting commit, is under way. */
  isAssessing: boolean
  /** After a try that got no answer, when the next one may start: of a review, and of a look at the person's progress. */
  reviewRetryAt: number | null
  assessRetryAt: number | null
  /**
   * True while a review is being started, or the end of one is being recorded.
   * With `reviewAgentId` and `endedReview` it is the one review slot: nothing
   * starts a review while any of them says it is taken, so that two events
   * arriving together cannot start the same review twice.
   */
  isReviewBusy: boolean
  /** The review that ended a moment ago saying only "error", while its reason may still arrive. */
  endedReview: { agentId: string; scope: ReviewScope | null } | null
  /** The running review's reviewer, and what it was asked, and when it started. */
  reviewAgentId: string | null
  reviewScope: ReviewScope | null
  reviewStartedAt: number
  /** Why the running deep review's subagent died, when an API error ended it. '' otherwise. */
  reviewFailure: string
  /**
   * The counting of that failure, while it is under way. The review's end
   * arrives at the same moment and waits for it, so that it finds Claude
   * already known not to be answering.
   */
  reviewFailureNoted: Promise<void> | null
}

export function freshReviewState(): ReviewState {
  return {
    waiting: EMPTY_QUEUE,
    isAssessing: false,
    reviewRetryAt: null,
    assessRetryAt: null,
    isReviewBusy: false,
    endedReview: null,
    reviewAgentId: null,
    reviewScope: null,
    reviewStartedAt: 0,
    reviewFailure: '',
    reviewFailureNoted: null,
  }
}

/** What the waiting commits and their reviews need from their host. Each is read or done when it is needed. */
export type ReviewPorts = {
  settings: Settings
  now: () => Promise<number>
  trace: Trace
  /** Sets a deadline, or takes it away. */
  deadline: { set: (name: string, at: number, run: () => Promise<unknown> | unknown) => void; cancel: (name: string) => void }
  /** Runs git in the repository. -1 is git not answering. */
  git: (args: readonly string[]) => Promise<{ exitCode: number; stdout: string }>
  changeQueue: (change: (queue: ReviewQueue) => ReviewQueue) => Promise<void>
  /** Changes what the Deep review tab says. */
  setReview: (change: Partial<Review>) => Promise<void>
  readReview: () => Promise<Review>
  /** Whether Claude is answering, how close the plan's limit is, and which jobs have a setting of their own that is refused. */
  health: () => Health
  pressure: () => Pressure
  jobBlock: (job: string) => string | undefined
  readPressure: () => Promise<unknown>
  /** A request that was finding out whether Claude is back ended without saying. */
  probeEnded: () => Promise<void>
  /** Whether the tutor is on, in a repository, and the one that drives it: whether anything may start. */
  isActive: () => boolean
  /** The reviewers Claude Code is running. */
  agents: () => Promise<readonly { id: string; description: string; status: string }[]>
  /** Hands a scope to the deep reviewer. Resolves false when it did not start. The caller holds the review slot. */
  startReview: (scope: ReviewScope) => Promise<boolean>
  /** Counts the switch-ons, so that work from before a switch-off lets go. */
  engagement: () => number
  /** The text of the deep review of a commit, by its short hash, or undefined. */
  reviewText: (commit: string) => string | undefined
  /** The look at the person's progress for a commit. Resolves false for "worth another try". */
  assess: (hash: string, review: string) => Promise<boolean>
  /** Runs this after the looks at progress already under way. */
  queueProgress: (work: () => Promise<void>) => void
  fail: (what: string, error: unknown) => void
}

/** Whether a review may start: none is running, being started, or being wound up. */
export function isReviewFree(state: ReviewState): boolean {
  return state.reviewAgentId === null && !state.isReviewBusy && state.endedReview === null
}

/**
 * Holds the review slot while a review is started or the end of one is
 * recorded. When no review is running afterwards, whatever is waiting gets
 * its turn: that is where a retry is timed and the next commit is taken up.
 */
export async function withReviewSlot(ports: ReviewPorts, state: ReviewState, work: () => Promise<unknown>): Promise<void> {
  state.isReviewBusy = true
  try {
    await work()
  } finally {
    state.isReviewBusy = false
    // Planned even when the work threw: a commit that waits would otherwise wait for the next commit or wake.
    if (state.reviewAgentId === null) await planReview(ports, state).catch(error => ports.fail('could not plan the next review', error))
  }
}

/** Reviews one commit now. Resolves false when no review started. The caller holds the review slot. */
export async function reviewCommitNow(ports: ReviewPorts, state: ReviewState, commit: { hash: string; title: string }): Promise<boolean> {
  const shown = await ports.git(showCommitArgs(commit.hash))
  if (shown.exitCode === -1) {
    // Git did not answer, which says nothing about the commit: one try, and it is tried again.
    await reviewFailed(ports, state, { kind: 'commit', hash: commit.hash, title: commit.title, patch: '' }, 'git did not answer', 'own')

    return false
  }
  if (shown.exitCode !== 0 || shown.stdout.trim() === '') {
    // It is not in this repository any more: rebased away, or thrown out.
    ports.trace('agent', 'commit gone', () => ({ commit, exitCode: shown.exitCode }))
    await ports.changeQueue(queue => withoutCommit(queue, commit.hash))

    return false
  }

  return ports.startReview({ kind: 'commit', hash: commit.hash, title: commit.title, patch: shown.stdout })
}

/**
 * A review ended without a review. For a commit that is waiting for one,
 * `how` says what that means:
 *
 * - `service`: Claude's doing, which `noteOutcome` has already been told. It
 *   is no try. The commit waits until Claude answers again, however long.
 * - `own`: nothing says why. It is one try: the next is timed, or the review
 *   is given up on.
 * - `final`: the person stopped it, or the model refused. It is not tried again.
 *
 * A commit whose review is given up on still counts toward the person's
 * progress. The caller holds the review slot, and what is next is planned
 * when it lets go.
 */
export async function reviewFailed(
  ports: ReviewPorts,
  state: ReviewState,
  scope: ReviewScope | null,
  detail: string,
  how: 'service' | 'own' | 'final',
): Promise<void> {
  const { settings } = ports
  // This review may have been the request finding out whether Claude is back, and it did not say.
  if (how !== 'service') await ports.probeEnded()
  if (scope === null || scope.kind !== 'commit' || !settings.deepReview.isAfterCommit || !state.waiting.commits.some(commit => commit.hash === scope.hash)) {
    // Asked for by hand, timed, or the look around: nothing tries it again.
    await ports.setReview({ state: 'failed', ...(scope === null ? {} : { subject: scopeSubject(scope) }), text: detail })

    return
  }
  const subject = scopeSubject(scope)
  if (how === 'service' && (!mayAsk(ports.health()) || ports.jobBlock('deep-review') !== undefined)) {
    state.reviewRetryAt = null
    await ports.setReview({ state: 'failed', subject, text: heldText(ports.health(), ports.pressure(), ports.jobBlock('deep-review'), null) })

    return
  }
  if (how !== 'final') await ports.changeQueue(queue => withAttempt(queue, scope.hash))
  if (how === 'final' || isSpent(state.waiting, scope.hash)) {
    await ports.changeQueue(queue => reviewed(queue, scope.hash))
    state.reviewRetryAt = null
    await ports.setReview({ state: 'failed', subject, text: how === 'final' ? detail : failedText(detail, null) })

    return
  }
  const attempts = state.waiting.commits.find(commit => commit.hash === scope.hash)?.attempts ?? 1
  state.reviewRetryAt = (await ports.now()) + retryMs(attempts)
  await ports.setReview({ state: 'failed', subject, text: failedText(detail, state.reviewRetryAt) })
}

/**
 * A review ended saying only "error", and its reason has arrived through
 * `classic.StopFailure`, or the moment it had for that has passed, in which
 * case `reason` is null.
 */
export async function reviewVerdict(ports: ReviewPorts, state: ReviewState, reason: string | null): Promise<void> {
  const ended = state.endedReview
  if (ended === null) return
  ports.deadline.cancel('review-verdict')
  await withReviewSlot(ports, state, async () => {
    state.endedReview = null
    await reviewFailed(ports, state, ended.scope, reason ?? 'error', reason === null ? 'own' : 'service')
  })
}

/** The running review has not reported back for a long time: it is looked for, and given up on when it is gone. */
export async function reviewWatchdog(ports: ReviewPorts, state: ReviewState): Promise<void> {
  const agentId = state.reviewAgentId
  if (agentId === null) return
  const now = await ports.now()
  let status = 'gone'
  try {
    status = (await ports.agents()).find(agent => agent.id === agentId)?.status ?? 'gone'
  } catch {
    // No list: it is taken to be gone.
  }
  // It reported back while the list was being read.
  if (state.reviewAgentId !== agentId) return
  ports.trace('agent', 'watchdog', () => ({ agentId, status, forMs: now - state.reviewStartedAt }))
  if ((status === 'running' || status === 'pending' || status === 'waiting') && now - state.reviewStartedAt < WATCHDOG_LIMIT_MS) {
    // Still at it. A hard review at a high thinking level takes long: it gets until the limit, and no longer.
    ports.deadline.set('review-watchdog', state.reviewStartedAt + WATCHDOG_LIMIT_MS, () => reviewWatchdog(ports, state))

    return
  }
  await withReviewSlot(ports, state, async () => {
    const scope = state.reviewScope
    state.reviewAgentId = null
    state.reviewScope = null
    state.reviewFailure = ''
    state.reviewFailureNoted = null
    await reviewFailed(ports, state, scope, 'the reviewer did not report back', 'own')
  })
}

/**
 * After a reload of the module, a review that was running is still running:
 * Claude Code runs it, not this module. When it is the review of the commit
 * that waits first, it is taken up again, so that its answer is collected and
 * the commit is not reviewed a second time. Any other review can no longer
 * be collected.
 */
export async function adoptReview(ports: ReviewPorts, state: ReviewState): Promise<void> {
  if (state.reviewAgentId !== null || (await ports.readReview()).state !== 'running') return
  const commit = nextToReview(state.waiting, { wantsReview: true, wantsAssessment: false })
  let agentId: string | undefined
  if (commit !== null) {
    const described = `Deep review of ${commitSubject(commit)}`
    try {
      agentId = (await ports.agents()).find(agent => agent.description === described && (agent.status === 'running' || agent.status === 'pending' || agent.status === 'waiting'))?.id
    } catch {
      // No list: it cannot be found.
    }
  }
  ports.trace('agent', 'adopt', () => ({ commit, agentId }))
  if (commit === null || agentId === undefined || state.reviewAgentId !== null) {
    if (state.reviewAgentId === null) await ports.setReview({ state: 'failed', text: 'the plugin reloaded while it was running' })

    return
  }
  state.reviewAgentId = agentId
  state.reviewScope = { kind: 'commit', hash: commit.hash, title: commit.title, patch: '' }
  state.reviewFailure = ''
  state.reviewFailureNoted = null
  // When it started is not known any more. The time it gets counts from here.
  state.reviewStartedAt = await ports.now()
  ports.deadline.set('review-watchdog', state.reviewStartedAt + WATCHDOG_MS, () => reviewWatchdog(ports, state))
}

/** The look at the person's progress for a waiting commit, after the ones already under way. */
export function startAssessment(ports: ReviewPorts, state: ReviewState, commit: Waiting): void {
  state.isAssessing = true
  const run = ports.engagement()
  ports.queueProgress(async () => {
    let isSettled = false
    try {
      // Switched off since: the commit stays waiting in the project's folder, for the next time the tutor is on here.
      if (run !== ports.engagement()) return
      // With its review for context, when it has one.
      const review = ports.reviewText(shortHash(commit.hash)) ?? ''
      isSettled = await ports.assess(commit.hash, review)
    } finally {
      if (run === ports.engagement()) await settleAssessment(ports, state, commit, isSettled)
    }
  })
}

/** What came of the look at a waiting commit's progress: done with, one try, or a wait that is Claude's doing. */
export async function settleAssessment(ports: ReviewPorts, state: ReviewState, commit: Waiting, isSettled: boolean): Promise<void> {
  state.assessRetryAt = null
  if (isSettled) {
    await ports.changeQueue(queue => withoutCommit(queue, commit.hash))
  } else if (mayAsk(ports.health()) && ports.jobBlock('progress') === undefined) {
    // Claude is answering, and nothing came of it all the same: that is one try.
    await ports.changeQueue(queue => withAttempt(queue, commit.hash))
    if (isSpent(state.waiting, commit.hash)) await ports.changeQueue(queue => withoutCommit(queue, commit.hash))
    else state.assessRetryAt = (await ports.now()) + retryMs(state.waiting.commits.find(known => known.hash === commit.hash)?.attempts ?? 1)
  }
  // Otherwise it was Claude's doing, which is no try: it waits until Claude answers again.
  state.isAssessing = false
  await planReview(ports, state)
}

/**
 * Starts whatever the waiting commits need next, when nothing stands in the
 * way, and says in the Deep review tab what does when something stands.
 * Called whenever that may have changed: a commit, the end of a review,
 * Claude answering again, the plan's window reopening.
 */
export async function planReview(ports: ReviewPorts, state: ReviewState): Promise<void> {
  const { settings } = ports
  const plan = ports.deadline
  if (!ports.isActive() || state.waiting.commits.length === 0) {
    plan.cancel('review')
    plan.cancel('assess')

    return
  }
  const wanted = { wantsReview: settings.deepReview.isAfterCommit, wantsAssessment: settings.isProgressOn }
  // Under these settings nothing is left to do for these.
  const settled = settledIn(state.waiting, wanted)
  if (settled.length > 0) await ports.changeQueue(queue => settled.reduce(withoutCommit, queue))
  const now = await ports.now()
  await ports.readPressure()
  // What is held back waits, on disk. `wake` plans again when Claude answers, and the plan's window reopening is a deadline of its own.
  const reopens = ports.pressure().level === 'held' ? ports.pressure().resetsAt : null

  // The review of the oldest commit that has none yet. One review runs at a time, and its end plans again.
  if (isReviewFree(state)) {
    const commit = nextToReview(state.waiting, wanted)
    const held =
      commit === null
        ? ''
        : heldText(ports.health(), ports.pressure(), ports.jobBlock('deep-review'), state.reviewRetryAt !== null && state.reviewRetryAt > now ? state.reviewRetryAt : null)
    if (commit === null) plan.cancel('review')
    else if (held !== '') {
      if (reopens === null) plan.cancel('review')
      else plan.set('review', reopens, () => planReview(ports, state))
      await ports.setReview({ state: 'failed', subject: commitSubject(commit), text: held, isUnseen: false })
    } else if (state.reviewRetryAt !== null && state.reviewRetryAt > now) {
      plan.set('review', state.reviewRetryAt, () => planReview(ports, state))
    } else {
      plan.cancel('review')
      state.reviewRetryAt = null
      // One that does not start leaves a time for its next try, or a commit given up on: the slot plans that as it is let go.
      await withReviewSlot(ports, state, () => reviewCommitNow(ports, state, commit))
    }
  }

  // The look at the person's progress, for the oldest commit whose review is done with. It runs beside the next review.
  if (!state.isAssessing) {
    const commit = nextToAssess(state.waiting, wanted)
    if (commit === null) plan.cancel('assess')
    else if (heldText(ports.health(), ports.pressure(), ports.jobBlock('progress'), null) !== '') {
      if (reopens === null) plan.cancel('assess')
      else plan.set('assess', reopens, () => planReview(ports, state))
    } else if (state.assessRetryAt !== null && state.assessRetryAt > now) {
      plan.set('assess', state.assessRetryAt, () => planReview(ports, state))
    } else {
      plan.cancel('assess')
      state.assessRetryAt = null
      startAssessment(ports, state, commit)
    }
  }
}

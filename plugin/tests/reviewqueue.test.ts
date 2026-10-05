import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { projectId } from '../hooks/datahome'
import { HEALTHY, NO_PRESSURE } from '../hooks/health'
import type { Health, Pressure } from '../hooks/health'
import {
  commitSubject,
  current,
  EMPTY_QUEUE,
  failedText,
  heldText,
  isSpent,
  MAX_ATTEMPTS,
  MAX_WAIT_MS,
  nextToAssess,
  nextToReview,
  parseQueue,
  PLAN_HELD,
  retryMs,
  reviewed,
  settledIn,
  VERDICT_MS,
  WATCHDOG_LIMIT_MS,
  WATCHDOG_MS,
  withAttempt,
  withCommit,
  withoutCommit,
} from '../hooks/reviewqueue'
import type { ReviewQueue } from '../hooks/reviewqueue'
import { clockTime } from '../hooks/status'
import { commitHash, PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

/** The commits that wait for their deep review, and what becomes of them when a review does not go to plan. */

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const C = 'c'.repeat(40)
const D = 'd'.repeat(40)
const BOTH = { wantsReview: true, wantsAssessment: true }

const queueOf = (...hashes: string[]): ReviewQueue => hashes.reduce((queue, hash, index) => withCommit(queue, { hash, title: `Commit ${index + 1}` }, 1000 * (index + 1)), EMPTY_QUEUE)

test('a commit joins the end of the queue once, and only the latest few wait', async () => {
  const queue = queueOf(A, B)
  expect(queue.commits.map(commit => commit.hash)).toEqual([A, B])
  expect(queue.commits[0]).toEqual({ hash: A, title: 'Commit 1', at: 1000, isReviewed: false, attempts: 0 })
  expect(withCommit(queue, { hash: A, title: 'Again' }, 9000)).toBe(queue)
  // A fourth pushes the oldest out.
  expect(queueOf(A, B, C, D).commits.map(commit => commit.hash)).toEqual([B, C, D])
  expect(withoutCommit(queue, A).commits.map(commit => commit.hash)).toEqual([B])
})

test('the queue is read back as it was written, and anything else is an empty one', async () => {
  const queue = reviewed(queueOf(A, B), A)
  expect(parseQueue(JSON.parse(JSON.stringify(queue)))).toEqual(queue)
  expect(parseQueue(null)).toEqual(EMPTY_QUEUE)
  expect(parseQueue('queue')).toEqual(EMPTY_QUEUE)
  expect(parseQueue({ commits: 'none' })).toEqual(EMPTY_QUEUE)
  expect(parseQueue({ commits: [{ hash: 'not a hash', title: 't', at: 1, isReviewed: false, attempts: 0 }, { hash: A }, queue.commits[1]] }).commits).toEqual([queue.commits[1]])
})

test('a commit that has waited a day is let go', async () => {
  const queue = queueOf(A, B)
  expect(current(queue, 1000 + MAX_WAIT_MS - 1)).toBe(queue)
  expect(current(queue, 1000 + MAX_WAIT_MS).commits.map(commit => commit.hash)).toEqual([B])
  expect(current(queue, 2000 + MAX_WAIT_MS).commits).toEqual([])
})

test('the oldest commit is reviewed first, and the look at progress follows each review', async () => {
  const queue = queueOf(A, B)
  expect(nextToReview(queue, BOTH)?.hash).toBe(A)
  // Nothing is looked at for progress before its review is done with.
  expect(nextToAssess(queue, BOTH)).toBe(null)

  const one = reviewed(queue, A)
  expect(nextToReview(one, BOTH)?.hash).toBe(B)
  expect(nextToAssess(one, BOTH)?.hash).toBe(A)
  expect(settledIn(one, BOTH)).toEqual([])

  // With the progress report off, a reviewed commit needs nothing more.
  expect(nextToAssess(one, { wantsReview: true, wantsAssessment: false })).toBe(null)
  expect(settledIn(one, { wantsReview: true, wantsAssessment: false })).toEqual([A])
  // With reviews off, a commit goes straight to the look at progress.
  expect(nextToReview(queue, { wantsReview: false, wantsAssessment: true })).toBe(null)
  expect(nextToAssess(queue, { wantsReview: false, wantsAssessment: true })?.hash).toBe(A)
  expect(settledIn(queue, { wantsReview: false, wantsAssessment: false })).toEqual([A, B])
})

test('a stage is tried three times, each wait twice the last, and moving on starts the count again', async () => {
  let queue = queueOf(A)
  expect([1, 2, 3].map(retryMs)).toEqual([60_000, 120_000, 240_000])
  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
    queue = withAttempt(queue, A)
    expect(isSpent(queue, A)).toBe(false)
  }
  queue = withAttempt(queue, A)
  expect(isSpent(queue, A)).toBe(true)
  expect(isSpent(queue, B)).toBe(false)

  queue = reviewed(queue, A)
  expect(queue.commits[0]).toEqual({ hash: A, title: 'Commit 1', at: 1000, isReviewed: true, attempts: 0 })
})

test('what the tab says while a review waits, and after a try that got no answer', async () => {
  const at = new Date(2026, 9, 4, 12, 7).getTime()
  const later = new Date(2026, 9, 4, 12, 9).getTime()
  const waiting: Health = { state: 'waiting', trouble: 'overloaded', detail: 'overloaded', until: at, failures: 1 }
  const probing: Health = { state: 'probing', trouble: 'offline', detail: 'no connection', failures: 2 }
  const held: Pressure = { level: 'held', percent: 97, window: 'five_hour', resetsAt: at }
  expect(heldText(HEALTHY, NO_PRESSURE, undefined, null)).toBe('')
  expect(heldText({ state: 'recovering', trouble: 'overloaded', detail: 'overloaded', failures: 1 }, NO_PRESSURE, undefined, null)).toBe('')
  expect(heldText(waiting, NO_PRESSURE, undefined, null)).toBe('Claude is not answering (overloaded). It is tried again at 12:07, or press r.')
  // The review's own next try may be later than Claude's: the time named is when it really is tried.
  expect(heldText(waiting, NO_PRESSURE, undefined, later)).toBe('Claude is not answering (overloaded). It is tried again at 12:09, or press r.')
  expect(heldText(waiting, NO_PRESSURE, undefined, at - 60_000)).toBe('Claude is not answering (overloaded). It is tried again at 12:07, or press r.')
  expect(heldText(probing, NO_PRESSURE, undefined, null)).toBe('Claude is not answering (no connection). It is tried again shortly, or press r.')
  expect(heldText(probing, NO_PRESSURE, undefined, later)).toBe('Claude is not answering (no connection). It is tried again at 12:09, or press r.')
  expect(heldText(HEALTHY, held, undefined, null)).toBe(PLAN_HELD)
  expect(heldText({ state: 'blocked', detail: 'billing error' }, NO_PRESSURE, undefined, null)).toBe('Claude is refusing this account (billing error). It is reviewed once that is sorted out.')
  // A model the plan does not have comes before everything else: waiting will not help.
  expect(heldText(waiting, held, 'model not found', null)).toBe('the deep review cannot run (model not found). Its model is set in /config.')

  expect(failedText('overloaded', at)).toBe('overloaded. It is tried again at 12:07, or press r.')
  expect(failedText('overloaded', null)).toBe('overloaded. Press r to run it again.')
  expect(commitSubject({ hash: A, title: 'Add mean' })).toBe('commit aaaaaaa: Add mean')
  expect(WATCHDOG_MS < WATCHDOG_LIMIT_MS).toBe(true)
})

type Session = ReturnType<typeof stubSession>
type Engine = Parameters<TestBody>[0]

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const TOTAL = `${MEAN}\n\ndef total(xs):\n    result = sum(xs)\n    return result\n`
const QUEUE = `projects/${projectId(ROOT)}/queue.json`
const QUIET = { play_by_play: 'on request', explain: 'off', animated_persona: false } as const
/** A session with the look at progress off, so that a test is about the review alone. */
const REVIEW_ONLY = { options: { ...QUIET, progress_report: false } } as const

async function start($: Engine, session: Session): Promise<void> {
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
}

/** Commits a change and lets the tutor see it. */
async function commit(session: Session, message: string, text = `${MEAN}# ${message}\n`): Promise<string> {
  session.write('stats.py', text)
  const hash = session.commit(message)
  await session.clock.advance(2000)

  return hash
}

/** Whether the Deep review tab says this: in a line of its own, or in the review itself. */
async function reviewTab($: Engine, text: string): Promise<boolean> {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  const found = (await ui.find({ type: 'Text', text })) ?? (await ui.find({ type: 'Markdown', text }))
  await ui.unmount()

  return found !== undefined
}

const waitingIn = (session: Session): string[] => parseQueue(session.data(QUEUE)).commits.map(entry => entry.hash)
const attemptsIn = (session: Session): number[] => parseQueue(session.data(QUEUE)).commits.map(entry => entry.attempts)

sessionTest('a commit waits on disk from the moment it is seen until its review is in', REVIEW_ONLY, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  const hash = await commit(session, 'Add a comment')
  expect(session.spawned.length).toBe(1)
  expect(waitingIn(session)).toEqual([hash])

  await $.turn.complete(session.finish(1, 'Fine.'))
  await session.clock.settle()
  expect(waitingIn(session)).toEqual([])
  expect(await reviewTab($, 'Fine.')).toBe(true)
  // One review, and no second one of the same commit.
  await session.clock.advance(600_000)
  expect(session.spawned.length).toBe(1)
})

sessionTest('a review that dies because Claude is not answering is no try: it runs again as soon as Claude may be back', REVIEW_ONLY, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  const hash = await commit(session, 'Add a comment')
  expect(session.spawned.length).toBe(1)

  // Claude Code says which error it was, and that the turn ended in one.
  await $.classic.StopFailure({ error: 'overloaded', agent_id: session.agentId(1) })
  await $.turn.complete(session.finish(1, '', 'error'))
  expect(await reviewTab($, 'did not finish: Claude is not answering (overloaded). It is tried again at')).toBe(true)
  expect(waitingIn(session)).toEqual([hash])
  expect(attemptsIn(session)).toEqual([0])
  expect(session.spawned.length).toBe(1)

  // The wait after one failure is half a minute at most. The review is then the request that finds out.
  await session.clock.advance(30_000)
  await session.clock.settle()
  expect(session.spawned.length).toBe(2)
  expect(session.spawned[1]?.prompt).toMatch('Add a comment')

  await $.turn.complete(session.finish(2, 'Good now.'))
  await session.clock.settle()
  expect(waitingIn(session)).toEqual([])
  expect(await reviewTab($, 'Good now.')).toBe(true)
  await session.clock.advance(600_000)
  expect(session.spawned.length).toBe(2)
})

sessionTest('an outage however long costs a commit none of its tries', REVIEW_ONLY, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  const hash = await commit(session, 'Add a comment')

  // Five reviews in a row die the same way, each after a longer wait than the last.
  for (let round = 1; round <= 5; round += 1) {
    expect(session.spawned.length).toBe(round)
    await $.classic.StopFailure({ error: 'overloaded', agent_id: session.agentId(round) })
    await $.turn.complete(session.finish(round, '', 'error'))
    await session.clock.advance(30_000 * 2 ** (round - 1))
    await session.clock.settle()
  }
  expect(session.spawned.length).toBe(6)
  expect(waitingIn(session)).toEqual([hash])
  expect(attemptsIn(session)).toEqual([0])

  await $.turn.complete(session.finish(6, 'Back.'))
  await session.clock.settle()
  expect(await reviewTab($, 'Back.')).toBe(true)
  expect(waitingIn(session)).toEqual([])
})

sessionTest('why a review died and that it died arrive at the same moment, and it is still no try', REVIEW_ONLY, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  const hash = await commit(session, 'Add a comment')

  // Claude Code raises both together, and neither waits for the other. Seen in a real outage.
  await Promise.all([$.classic.StopFailure({ error: 'server_error', agent_id: session.agentId(1) }), $.turn.complete(session.finish(1, '', 'error'))])
  await session.clock.settle()
  expect(await reviewTab($, 'did not finish: Claude is not answering (server error). It is tried again at')).toBe(true)
  expect(waitingIn(session)).toEqual([hash])
  expect(attemptsIn(session)).toEqual([0])

  // So it runs again when Claude may be back, half a minute later at most, and not a minute after that.
  await session.clock.advance(30_000)
  await session.clock.settle()
  expect(session.spawned.length).toBe(2)
})

sessionTest('the reason for a review that died may arrive after its end, and the tab then says it', REVIEW_ONLY, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  await commit(session, 'Add a comment')

  await $.turn.complete(session.finish(1, '', 'error'))
  expect(await reviewTab($, 'did not finish: error')).toBe(true)
  await $.classic.StopFailure({ error: 'model_not_found', agent_id: session.agentId(1) })
  // A model the plan does not have: trying again will not help, and the tab says what will.
  expect(await reviewTab($, 'did not finish: the deep review cannot run (model not found). Its model is set in /config.')).toBe(true)
  expect(attemptsIn(session)).toEqual([0])
  await session.clock.advance(600_000)
  expect(session.spawned.length).toBe(1)
})

sessionTest("another subagent's API error is not the deep review's", REVIEW_ONLY, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  // A subagent the conversation started asked for a model that does not exist.
  await $.classic.StopFailure({ error: 'model_not_found', agent_id: 'someone-else' })
  await commit(session, 'Add a comment')
  expect(session.spawned.length).toBe(1)
})

sessionTest('a review that fails for no known reason is tried three times, and the commit still counts toward progress', { options: QUIET }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  const before = session.assessments.length
  await commit(session, 'Add total', TOTAL)

  await $.turn.complete(session.finish(1, '', 'error'))
  // It has a moment for its reason to arrive. None does.
  await session.clock.advance(VERDICT_MS)
  expect(await reviewTab($, `did not finish: error. It is tried again at ${clockTime(session.clock.now() + 60_000)}, or press r.`)).toBe(true)
  expect(attemptsIn(session)).toEqual([1])
  await session.clock.advance(60_000)
  await session.clock.settle()
  expect(session.spawned.length).toBe(2)

  await $.turn.complete(session.finish(2, '', 'error'))
  await session.clock.advance(VERDICT_MS + 120_000)
  await session.clock.settle()
  expect(session.spawned.length).toBe(3)
  // Nothing has been made of the commit for the person's progress while its review may still come.
  expect(session.assessments.length).toBe(before)

  await $.turn.complete(session.finish(3, '', 'error'))
  await session.clock.advance(VERDICT_MS)
  await session.clock.settle()
  expect(await reviewTab($, 'did not finish: error. Press r to run it again.')).toBe(true)
  await session.clock.advance(900_000)
  expect(session.spawned.length).toBe(3)
  expect(session.assessments.length).toBe(before + 1)
  expect(waitingIn(session)).toEqual([])
})

sessionTest('a commit made while Claude is not answering waits, and is reviewed as soon as it answers', REVIEW_ONLY, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  // The conversation's turn died on an overload three times: the wait is a minute or two.
  await $.classic.StopFailure({ error: 'overloaded' })
  await $.classic.StopFailure({ error: 'overloaded' })
  await $.classic.StopFailure({ error: 'overloaded' })

  const hash = await commit(session, 'Add a comment')
  await session.clock.advance(20_000)
  expect(session.spawned).toEqual([])
  expect(waitingIn(session)).toEqual([hash])
  expect(await reviewTab($, 'did not finish: Claude is not answering (overloaded). It is tried again at')).toBe(true)

  await $.turn.complete(session.turnEnded())
  await session.clock.settle()
  expect(session.spawned.length).toBe(1)
  expect(session.spawned[0]?.prompt).toMatch('Add a comment')
})

sessionTest('commits made while a review runs are each reviewed, oldest first, and none twice', REVIEW_ONLY, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  await commit(session, 'One')
  await commit(session, 'Two')
  await commit(session, 'Three')
  expect(session.spawned.length).toBe(1)

  await $.turn.complete(session.finish(1, 'First.'))
  await session.clock.settle()
  expect(session.spawned.length).toBe(2)
  expect(session.spawned[1]?.prompt).toMatch('Two')
  await $.turn.complete(session.finish(2, 'Second.'))
  await session.clock.settle()
  expect(session.spawned.length).toBe(3)
  expect(session.spawned[2]?.prompt).toMatch('Three')
  await $.turn.complete(session.finish(3, 'Third.'))
  await session.clock.settle()
  expect(waitingIn(session)).toEqual([])
  expect(session.spawned.length).toBe(3)
})

sessionTest('a commit left waiting when the session was closed is reviewed the next time the tutor is on here', REVIEW_ONLY, async ($, on) => {
  const left = { hash: commitHash(1), title: 'Start', at: 0, isReviewed: false, attempts: 1 }
  const stale = { hash: commitHash(77), title: 'Long ago', at: -MAX_WAIT_MS - 1, isReviewed: false, attempts: 0 }
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [QUEUE]: { v: 1, commits: [stale, left] } } })
  await start($, session)

  expect(session.spawned.length).toBe(1)
  expect(session.spawned[0]?.prompt).toMatch('Review this commit.')
  expect(session.spawned[0]?.prompt).toMatch('Start')
  await $.turn.complete(session.finish(1, 'Late, but here.'))
  await session.clock.settle()
  expect(waitingIn(session)).toEqual([])
})

sessionTest('a waiting commit that is no longer in the repository is let go', REVIEW_ONLY, async ($, on) => {
  const gone = { hash: commitHash(77), title: 'Rebased away', at: 0, isReviewed: false, attempts: 0 }
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [QUEUE]: { v: 1, commits: [gone] } } })
  await start($, session)

  expect(session.spawned).toEqual([])
  expect(waitingIn(session)).toEqual([])
})

sessionTest('a reviewer that never reports back is given up on, and the next commit is not stuck behind it', REVIEW_ONLY, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  await commit(session, 'One')
  await commit(session, 'Two')
  expect(session.spawned.length).toBe(1)

  // It is still listed as running after a quarter of an hour: a hard review may take that long.
  await session.clock.advance(WATCHDOG_MS)
  await session.clock.settle()
  expect(session.spawned.length).toBe(1)
  expect(await reviewTab($, 'Reviewing commit')).toBe(true)

  // Then it is gone, without a word. At its limit it is given up on, and tried again.
  session.lostAgents.push(session.agentId(1))
  await session.clock.advance(WATCHDOG_LIMIT_MS - WATCHDOG_MS)
  await session.clock.settle()
  expect(await reviewTab($, 'did not finish: the reviewer did not report back. It is tried again at')).toBe(true)
  await session.clock.advance(60_000)
  await session.clock.settle()
  expect(session.spawned.length).toBe(2)
  expect(session.spawned[1]?.prompt).toMatch('One')

  await $.turn.complete(session.finish(2, 'Done at last.'))
  await session.clock.settle()
  expect(session.spawned.length).toBe(3)
  expect(session.spawned[2]?.prompt).toMatch('Two')
})

sessionTest('a review that was stopped by hand is not tried again', REVIEW_ONLY, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  await commit(session, 'Add a comment')
  await $.turn.complete(session.finish(1, '', 'aborted'))
  await session.clock.settle()
  expect(await reviewTab($, 'did not finish: it was stopped')).toBe(true)
  await session.clock.advance(900_000)
  expect(session.spawned.length).toBe(1)
  expect(waitingIn(session)).toEqual([])
})

sessionTest('a review that answers with nothing is one try, and asking for it again runs it at once', REVIEW_ONLY, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  await commit(session, 'Add a comment')
  await $.turn.complete(session.finish(1, '  '))
  await session.clock.settle()
  expect(await reviewTab($, `did not finish: the reviewer said nothing. It is tried again at ${clockTime(session.clock.now() + 60_000)}, or press r.`)).toBe(true)
  expect(attemptsIn(session)).toEqual([1])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  await ui.press({ key: 'review-now' })
  await ui.unmount()
  await session.clock.settle()
  expect(session.spawned.length).toBe(2)
  expect(session.spawned[1]?.prompt).toMatch('Add a comment')
})

sessionTest('a look at progress that Claude does not answer is no try, and runs again when Claude may be back', { options: { ...QUIET, deep_review_after_commit: false } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  const before = session.assessments.length
  session.failing.push('progress:overloaded')
  const hash = await commit(session, 'Add total', TOTAL)
  await session.clock.settle()
  expect(session.assessments.length).toBe(before + 1)
  expect(waitingIn(session)).toEqual([hash])
  expect(attemptsIn(session)).toEqual([0])

  // The wait after one failure is half a minute at most.
  await session.clock.advance(30_000)
  await session.clock.settle()
  expect(session.assessments.length).toBe(before + 2)
  expect(waitingIn(session)).toEqual([])
})

sessionTest('a look at progress that comes back empty is tried again a minute later', { options: { ...QUIET, deep_review_after_commit: false } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  const before = session.assessments.length
  session.failing.push('progress:empty')
  const hash = await commit(session, 'Add total', TOTAL)
  await session.clock.settle()
  expect(session.assessments.length).toBe(before + 1)
  expect(waitingIn(session)).toEqual([hash])
  expect(attemptsIn(session)).toEqual([1])

  await session.clock.advance(57_000)
  expect(session.assessments.length).toBe(before + 1)
  await session.clock.advance(3000)
  await session.clock.settle()
  expect(session.assessments.length).toBe(before + 2)
  expect(waitingIn(session)).toEqual([])
})

sessionTest('paused, a waiting commit waits, and resuming takes it up', REVIEW_ONLY, async ($, on) => {
  const left = { hash: commitHash(1), title: 'Start', at: 0, isReviewed: false, attempts: 0 }
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [QUEUE]: { v: 1, commits: [left] } } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  // Paused before the tutor has finished starting.
  await $.command.run(typed('bsd', 'pause'))
  await session.clock.settle()
  await session.clock.advance(60_000)
  expect(session.spawned).toEqual([])

  await $.command.run(typed('bsd', 'resume'))
  await session.clock.settle()
  expect(session.spawned.length).toBe(1)
})

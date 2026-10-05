import { expect, test } from 'claude-code/testing'

import type { Review } from '../types'
import { HEALTHY, NO_PRESSURE } from '../core/health'
import { retryMs, withCommit } from '../core/reviewqueue'
import { freshReviewState, planReview, reviewFailed, reviewVerdict, withReviewSlot } from '../core/reviewing'
import type { ReviewPorts, ReviewState } from '../core/reviewing'
import { readSettings } from '../core/settings'

const HASH = 'a'.repeat(40)

/** The waiting commits and their reviews are host-neutral: they run here with nothing but ports. */
function world(overrides: Partial<ReviewPorts> = {}) {
  const log: string[] = []
  const deadlines = new Map<string, number>()
  const tab: Partial<Review>[] = []
  const state: ReviewState = freshReviewState()
  state.waiting = withCommit(state.waiting, { hash: HASH, title: 'Add total' }, 0)
  const ports: ReviewPorts = {
    settings: readSettings({}),
    now: async () => 1000,
    trace: () => undefined,
    deadline: { set: (name, at) => void deadlines.set(name, at), cancel: name => void deadlines.delete(name) },
    git: async args => (log.push(`git ${args[0]}`), { exitCode: 0, stdout: 'patch' }),
    changeQueue: async change => void (state.waiting = change(state.waiting)),
    setReview: async change => void tab.push(change),
    readReview: async () => ({ state: 'idle' }) as unknown as Review,
    health: () => HEALTHY,
    pressure: () => NO_PRESSURE,
    jobBlock: () => undefined,
    readPressure: async () => undefined,
    probeEnded: async () => void log.push('probeEnded'),
    isActive: () => true,
    agents: async () => [],
    // As the host's does: the reviewer's id is the review slot, so the plan does not start it again.
    startReview: async scope => {
      log.push(`start ${scope.kind}`)
      state.reviewAgentId = 'r1'

      return true
    },
    engagement: () => 1,
    reviewText: () => undefined,
    assess: async () => true,
    queueProgress: work => {
      log.push('queueProgress')
      void work()
    },
    fail: (what, error) => void log.push(`fail: ${what}: ${String(error)}`),
    ...overrides,
  }

  return { ports, state, log, deadlines, tab }
}

test('planning starts the review of the oldest waiting commit, once, and holds the slot while it starts', async () => {
  const w = world()
  await planReview(w.ports, w.state)

  expect(w.log.filter(line => line.startsWith('start'))).toEqual(['start commit'])
  expect(w.state.isReviewBusy).toBe(false)
})

test('nothing is planned while the tutor is not driving, and its deadlines are taken away', async () => {
  const w = world({ isActive: () => false })
  w.deadlines.set('review', 5)
  await planReview(w.ports, w.state)

  expect(w.log).toEqual([])
  expect(w.deadlines.size).toBe(0)
})

test('a review that ended for no stated reason is one try, timed for the next, and says so in the tab', async () => {
  const w = world()
  await reviewFailed(w.ports, w.state, { kind: 'commit', hash: HASH, title: 'Add total', patch: '' }, 'it said nothing', 'own')

  expect(w.state.waiting.commits[0]?.attempts).toBe(1)
  expect(w.state.reviewRetryAt).toBe(1000 + retryMs(1))
  expect(w.tab.at(-1)?.state).toBe('failed')
  expect(w.log).toContain('probeEnded')
})

test("an outage is no try: the commit keeps all its tries, and the verdict of a review that said only 'error' makes it so", async () => {
  const w = world({ health: () => ({ state: 'waiting', trouble: 'offline', detail: 'no connection', until: 5000, failures: 1 }) })
  w.state.endedReview = { agentId: 'r1', scope: { kind: 'commit', hash: HASH, title: 'Add total', patch: '' } }
  await reviewVerdict(w.ports, w.state, 'no connection')

  expect(w.state.waiting.commits[0]?.attempts).toBe(0)
  expect(w.state.endedReview).toBeNull()
  expect(w.tab.at(-1)?.state).toBe('failed')
  expect(w.log).not.toContain('probeEnded')
})

test('the slot is let go even when the work throws, and what waits is planned then', async () => {
  const w = world()
  await expect(
    withReviewSlot(w.ports, w.state, async () => {
      throw new Error('boom')
    }),
  ).rejects.toThrow('boom')

  expect(w.state.isReviewBusy).toBe(false)
  expect(w.log.some(line => line === 'start commit')).toBe(true)
})

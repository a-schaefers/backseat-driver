import { expect, test } from 'claude-code/testing'

import { HEALTHY, mayAsk, NO_PRESSURE, outcomeOf, outcomeOfError, pressureOf, retryDelayMs, stepHealth, troubleOf } from '../hooks/health'
import { claimed, isHeld, LEASE_BEAT_MS, LEASE_TTL_MS, nextLeaseCheck, NO_LEASE, released } from '../hooks/lease'
import type { Lease } from '../hooks/lease'
import type { Health, HealthEvent, Pressure, Trouble } from '../hooks/health'
import { isLookDue, playOf, wakeAt } from '../hooks/play'
import type { Play, PlayFacts, Why } from '../hooks/play'
import { current, isSpent, MAX_ATTEMPTS, MAX_WAIT_MS, MAX_WAITING, nextToAssess, nextToReview, reviewed, settledIn, withAttempt, withCommit, withoutCommit } from '../hooks/reviewqueue'
import type { ReviewQueue } from '../hooks/reviewqueue'
import { createScheduler } from '../hooks/scheduler'
import { afterRead, afterWrite, arming, changeStep, delayMs, dueNow, keepsBackup } from '../hooks/core'
import { READ_RETRY_MS, READ_TRIES, WRITE_TRIES } from '../hooks/store'
import { FOCUS_SCAN_MS, focusGapMs, HOT_FOR_MS, HOT_SCAN_MS, IDLE_AFTER_MS, IDLE_SCAN_MS, LONGEST_FOCUS_GAP_MS, LONGEST_SCAN_GAP_MS, PUSHED_FOCUS_MS, PUSHED_SCAN_MS, SCAN_MS, scanGapMs } from '../hooks/sensor'
import { clockTime, healthLine, playLine, watchOf } from '../hooks/status'

/** The pure parts of the kernel: deadlines, whether Claude is answering, what the play-by-play is doing, how often to scan. */

/** A clock and timers in memory. `advance` moves the clock and fires what comes due, earliest first. */
function timers() {
  const state = { now: 1000, failures: [] as string[], armed: 0 }
  let pending: { at: number; fn: () => void; isCancelled: boolean }[] = []
  const scheduler = createScheduler({
    now: async () => state.now,
    after: (ms, fn) => {
      state.armed += 1
      const timer = { at: state.now + ms, fn, isCancelled: false }
      pending.push(timer)

      return {
        cancel: () => {
          timer.isCancelled = true
        },
      }
    },
    fail: (name, error) => {
      state.failures.push(`${name}: ${String(error)}`)
    },
  })
  const settle = async (): Promise<void> => {
    for (let turn = 0; turn < 20; turn += 1) await Promise.resolve()
  }
  const advance = async (ms: number): Promise<void> => {
    const end = state.now + ms
    await settle()
    for (;;) {
      const next = pending.filter(timer => !timer.isCancelled && timer.at <= end).sort((a, b) => a.at - b.at)[0]
      if (next === undefined) break
      pending = pending.filter(timer => timer !== next)
      state.now = Math.max(state.now, next.at)
      next.fn()
      await settle()
    }
    state.now = end
    await settle()
  }

  return { state, scheduler, advance, live: () => pending.filter(timer => !timer.isCancelled).length }
}

test('a deadline runs when its time comes, and one timer serves them all', async () => {
  const { state, scheduler, advance, live } = timers()
  const ran: string[] = []
  scheduler.set('look', state.now + 10_000, () => ran.push('look'))
  scheduler.set('scan', state.now + 2000, () => ran.push('scan'))
  scheduler.set('flush', state.now + 30_000, () => ran.push('flush'))
  await advance(0)
  expect(live()).toBe(1)
  expect(scheduler.all()).toEqual({ look: 11_000, scan: 3000, flush: 31_000 })

  await advance(1999)
  expect(ran).toEqual([])
  await advance(1)
  expect(ran).toEqual(['scan'])
  expect(scheduler.at('scan')).toBe(null)
  expect(live()).toBe(1)

  await advance(8000)
  expect(ran).toEqual(['scan', 'look'])
  await advance(20_000)
  expect(ran).toEqual(['scan', 'look', 'flush'])
  expect(live()).toBe(0)
})

test('setting a deadline again moves it, and cancelling one drops it', async () => {
  const { state, scheduler, advance } = timers()
  const ran: string[] = []
  scheduler.set('look', state.now + 10_000, () => ran.push('first'))
  // A second save: the look moves out, and it is the later request that runs.
  scheduler.set('look', state.now + 14_000, () => ran.push('second'))
  await advance(12_000)
  expect(ran).toEqual([])
  await advance(2000)
  expect(ran).toEqual(['second'])

  scheduler.set('look', state.now + 1000, () => ran.push('third'))
  scheduler.cancel('look')
  scheduler.cancel('never-set')
  await advance(5000)
  expect(ran).toEqual(['second'])
  expect(scheduler.all()).toEqual({})
})

test('deadlines due together run in the order of their times, and one that throws does not stop the rest', async () => {
  const { state, scheduler, advance } = timers()
  const ran: string[] = []
  scheduler.set('b', state.now + 200, () => ran.push('b'))
  scheduler.set('a', state.now + 100, () => {
    throw new Error('no')
  })
  scheduler.set('c', state.now + 300, async () => {
    ran.push('c')
    throw new Error('later')
  })
  await advance(1000)
  expect(ran).toEqual(['b', 'c'])
  expect(state.failures).toEqual(['a: Error: no', 'c: Error: later'])
})

test('a deadline may set the next one of its own name, as a scan plans the scan after it', async () => {
  const { state, scheduler, advance } = timers()
  let scans = 0
  const scan = (): void => {
    scans += 1
    scheduler.set('scan', state.now + 2000, scan)
  }
  scheduler.set('scan', state.now + 2000, scan)
  await advance(10_000)
  expect(scans).toBe(5)

  // Everything is dropped at once when the tutor is switched off.
  scheduler.clear()
  await advance(10_000)
  expect(scans).toBe(5)
})

test('a deadline already past runs at once', async () => {
  const { state, scheduler, advance } = timers()
  const ran: string[] = []
  scheduler.set('scan', state.now - 500, () => ran.push('scan'))
  await advance(0)
  expect(ran).toEqual(['scan'])
})

test('what went wrong with a request, in the tutor\'s terms', async () => {
  expect(outcomeOf({ isAnswered: true })).toEqual({ ok: true })
  expect(outcomeOf({ isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded' })).toEqual({ ok: false, trouble: 'overloaded', detail: 'overloaded' })
  expect(outcomeOf({ isAnswered: false, reason: 'api-error', status: 429, error: 'rate_limit' })).toEqual({ ok: false, trouble: 'rate-limit', detail: 'rate limit' })
  expect(outcomeOf({ isAnswered: false, reason: 'api-error', status: 500, error: 'server_error' })).toEqual({ ok: false, trouble: 'server', detail: 'server error' })
  expect(outcomeOf({ isAnswered: false, reason: 'api-error', status: 500, error: 'unknown' })).toEqual({ ok: false, trouble: 'server', detail: 'error 500' })
  // No status at all: the request or its answer was lost on the way.
  expect(outcomeOf({ isAnswered: false, reason: 'api-error', status: null, error: 'unknown' })).toEqual({ ok: false, trouble: 'offline', detail: 'no connection' })
  expect(outcomeOf({ isAnswered: false, reason: 'aborted' })).toEqual({ ok: false, trouble: 'timeout', detail: 'timed out' })
  expect(outcomeOf({ isAnswered: false, reason: 'empty-reply' })).toEqual({ ok: false, trouble: 'reply', detail: 'empty reply' })
  expect(outcomeOf({ isAnswered: false, reason: 'api-error', status: 404, error: 'model_not_found' })).toEqual({ ok: false, trouble: 'job', detail: 'model not found' })

  for (const error of ['authentication_failed', 'oauth_org_not_allowed', 'account_on_hold', 'verification_required', 'billing_error']) {
    expect(troubleOf(error)).toBe('account')
  }
  expect(troubleOf('invalid_request')).toBe('job')
  expect(troubleOf('something_new')).toBe('server')
  expect(outcomeOfError('billing_error')).toEqual({ ok: false, trouble: 'account', detail: 'billing error' })
})

test('the wait after a failure doubles, stops at ten minutes, and is spread over its upper half', async () => {
  expect([1, 2, 3, 4, 5, 6, 9].map(failures => retryDelayMs('overloaded', failures, 1))).toEqual([30_000, 60_000, 120_000, 240_000, 480_000, 600_000, 600_000])
  expect(retryDelayMs('overloaded', 1, 0)).toBe(15_000)
  expect(retryDelayMs('overloaded', 3, 0.5)).toBe(90_000)
  // A lost connection is often back at once: its first retry comes sooner.
  expect(retryDelayMs('offline', 1, 1)).toBe(15_000)
  expect(retryDelayMs('timeout', 2, 1)).toBe(30_000)
})

const failed = (health: Health, at: number, trouble: 'overloaded' | 'rate-limit' | 'account' | 'job' | 'reply' | 'offline' = 'overloaded', resetsAt?: number): Health =>
  stepHealth(health, { type: 'failed', trouble, detail: trouble, at, random: 1, ...(resetsAt === undefined ? {} : { resetsAt }) })

test('a failure makes every job wait, longer each time, until one request is answered', async () => {
  let health = failed(HEALTHY, 1000)
  expect(health).toEqual({ state: 'waiting', trouble: 'overloaded', detail: 'overloaded', until: 31_000, failures: 1 })
  expect(mayAsk(health)).toBe(false)

  // The wait is over: the next job that wants to ask may, and while it asks the others still wait.
  health = stepHealth(health, { type: 'due' })
  expect(health.state).toBe('recovering')
  expect(mayAsk(health)).toBe(true)
  health = stepHealth(health, { type: 'probing' })
  expect(health.state).toBe('probing')
  expect(mayAsk(health)).toBe(false)

  // It failed too: twice as long.
  health = failed(health, 40_000)
  expect(health).toEqual({ state: 'waiting', trouble: 'overloaded', detail: 'overloaded', until: 100_000, failures: 2 })

  health = stepHealth(stepHealth(stepHealth(health, { type: 'due' }), { type: 'probing' }), { type: 'answered' })
  expect(health).toEqual(HEALTHY)
  // After an answer the count starts again.
  expect(failed(health, 200_000)).toEqual({ state: 'waiting', trouble: 'overloaded', detail: 'overloaded', until: 230_000, failures: 1 })
})

test('a second failure while waiting never brings the retry forward', async () => {
  const first = failed(failed(failed(HEALTHY, 0), 0), 0)
  expect(first.state === 'waiting' && first.until).toBe(120_000)
  const second = failed(first, 1000, 'offline')
  // The fourth in a row, a lost connection, would wait two minutes from now, which is later than what stood.
  expect(second.state === 'waiting' && second.until).toBe(121_000)
  expect(second.state === 'waiting' && second.failures).toBe(4)
})

test('a rate limit waits for the plan window to reopen, when the plan says which', async () => {
  const health = failed(HEALTHY, 1000, 'rate-limit', 3_600_000)
  // Up to half a minute after it reopens, so that every session does not ask in the same second.
  expect(health.state === 'waiting' && health.until).toBe(3_630_000)
  // A reset time already past says nothing: the ordinary wait.
  const stale = failed(HEALTHY, 1000, 'rate-limit', 500)
  expect(stale.state === 'waiting' && stale.until).toBe(31_000)
})

test('what is not the service\'s doing does not make the other jobs wait', async () => {
  expect(failed(HEALTHY, 0, 'job')).toEqual(HEALTHY)
  expect(failed(HEALTHY, 0, 'reply')).toEqual(HEALTHY)
  const waiting = failed(HEALTHY, 0)
  expect(failed(waiting, 5000, 'reply')).toEqual(waiting)
})

test('the request that finds out whether Claude is back cannot leave the others waiting for good', async () => {
  const waiting = failed(HEALTHY, 0)
  const recovering = stepHealth(waiting, { type: 'due' })
  const probing = stepHealth(recovering, { type: 'probing' })
  expect(mayAsk(probing)).toBe(false)
  // It was cut short, or never started: nothing was found out, so the next job asks.
  expect(stepHealth(probing, { type: 'abandoned' })).toEqual(recovering)
  // What came back was its own problem, such as an empty reply or a model that does not exist: the same.
  expect(failed(probing, 40_000, 'reply')).toEqual(recovering)
  expect(failed(probing, 40_000, 'job')).toEqual(recovering)
  expect(mayAsk(recovering)).toBe(true)
  // Only the one that was asking can be abandoned.
  expect(stepHealth(waiting, { type: 'abandoned' })).toEqual(waiting)
  expect(stepHealth(HEALTHY, { type: 'abandoned' })).toEqual(HEALTHY)
})

/** A small seeded generator, so that a history that breaks a rule can be found again by its seed. */
function seeded(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const EVERY_TROUBLE: Trouble[] = ['rate-limit', 'overloaded', 'server', 'offline', 'timeout', 'account', 'job', 'reply']

test('whatever happens and in whatever order, the health machine keeps its rules', { timeoutMs: 60_000 }, async () => {
  for (let seed = 1; seed <= 400; seed += 1) {
    const random = seeded(seed)
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
    let health: Health = HEALTHY
    let at = 1_790_000_000_000
    for (let turn = 0; turn < 50; turn += 1) {
      at += Math.floor(random() * 300_000)
      const kind = pick(['failed', 'failed', 'failed', 'answered', 'due', 'probing', 'abandoned'] as const)
      const event: HealthEvent =
        kind === 'failed'
          ? { type: 'failed', trouble: pick(EVERY_TROUBLE), detail: 'x', at, random: random(), resetsAt: pick([null, at + 60_000, at - 1]) }
          : { type: kind }
      const before = health
      health = stepHealth(health, event)
      const where = `seed ${seed}, turn ${turn}: ${JSON.stringify(before)} then ${JSON.stringify(event)} gave ${JSON.stringify(health)}`

      // An answer, from anyone, always ends the trouble.
      if (event.type === 'answered' && health.state !== 'ok') throw new Error(`an answer did not end it. ${where}`)
      // A refused account is left only by an answer.
      if (before.state === 'blocked' && event.type !== 'answered' && health.state !== 'blocked') throw new Error(`blocked was left without an answer. ${where}`)
      // The request that finds out cannot leave the others waiting for good: whatever follows it, it is over.
      if (before.state === 'probing' && (event.type === 'failed' || event.type === 'abandoned') && health.state === 'probing') {
        throw new Error(`a probe that ended is still probing. ${where}`)
      }
      // A failure never brings the retry forward, and never shortens the count.
      if (before.state === 'waiting' && health.state === 'waiting') {
        if (health.until < before.until) throw new Error(`the retry came forward. ${where}`)
        if (health.failures < before.failures) throw new Error(`the count went down. ${where}`)
      }
      // A wait is always in the future of the failure that set it.
      if (event.type === 'failed' && health.state === 'waiting' && before.state !== 'waiting' && health.until <= event.at) {
        throw new Error(`a wait that is already over. ${where}`)
      }
      // Only the service's own trouble makes everyone wait.
      if (event.type === 'failed' && (event.trouble === 'job' || event.trouble === 'reply') && before.state === 'ok' && health.state !== 'ok') {
        throw new Error(`a job's own problem made the others wait. ${where}`)
      }
      // Jobs ask by themselves exactly when nothing is known to be wrong, or the wait is over and nobody is finding out.
      if (mayAsk(health) !== (health.state === 'ok' || health.state === 'recovering')) throw new Error(`mayAsk disagrees with the state. ${where}`)
      // An event that changes nothing hands back the very object it was given: the shell tells a change by that.
      if (JSON.stringify(health) === JSON.stringify(before) && health !== before) throw new Error(`nothing changed, and the object did. ${where}`)
      if (health.state === 'ok' && health !== HEALTHY) throw new Error(`ok is not the one HEALTHY. ${where}`)
    }
  }
})

test('the wait after a failure is in the upper half of its step, for every trouble and every count', async () => {
  const random = seeded(99)
  for (let turn = 0; turn < 5000; turn += 1) {
    const trouble = EVERY_TROUBLE[Math.floor(random() * EVERY_TROUBLE.length)] as Trouble
    const failures = Math.floor(random() * 40) - 3
    const first = trouble === 'offline' || trouble === 'timeout' ? 15_000 : 30_000
    const whole = Math.min(600_000, first * 2 ** Math.max(0, failures - 1))
    const wait = retryDelayMs(trouble, failures, random())
    expect(wait >= whole / 2 && wait <= whole).toBe(true)
    expect(Number.isInteger(wait)).toBe(true)
  }
})

test('a model result with an error and no word for it names the status', async () => {
  expect(outcomeOf({ isAnswered: false, reason: 'api-error', status: 503, error: '' })).toEqual({ ok: false, trouble: 'server', detail: 'error 503' })
  expect(outcomeOf({ isAnswered: false, reason: 'api-error', status: 503 })).toEqual({ ok: false, trouble: 'server', detail: 'error 503' })
})

test('a refused account stops every job until something is answered', async () => {
  const blocked = failed(HEALTHY, 0, 'account')
  expect(blocked).toEqual({ state: 'blocked', detail: 'account' })
  expect(mayAsk(blocked)).toBe(false)
  expect(stepHealth(blocked, { type: 'due' })).toEqual(blocked)
  expect(failed(blocked, 1000)).toEqual(blocked)
  expect(stepHealth(blocked, { type: 'answered' })).toEqual(HEALTHY)
})

test('the plan\'s pressure is its tightest open window', async () => {
  expect(pressureOf([], 0)).toEqual(NO_PRESSURE)
  expect(pressureOf([{ kind: 'five_hour', percentUsed: 40 }, { kind: 'seven_day', percentUsed: 12 }], 0)).toEqual({ level: 'none', percent: 40, window: 'five_hour', resetsAt: null })
  expect(pressureOf([{ kind: 'five_hour', percentUsed: 85, resetsAt: '2026-10-05T00:50:00.000Z' }], 0)).toEqual({
    level: 'slowed',
    percent: 85,
    window: 'five_hour',
    resetsAt: Date.parse('2026-10-05T00:50:00.000Z'),
  })
  expect(pressureOf([{ kind: 'five_hour', percentUsed: 40 }, { kind: 'seven_day', percentUsed: 97 }], 0).level).toBe('held')
  expect(pressureOf([{ kind: 'five_hour', percentUsed: 40 }, { kind: 'seven_day', percentUsed: 97 }], 0).window).toBe('seven_day')

  // A window that has reopened since its figure was reported no longer counts.
  const reopened = Date.parse('2026-10-05T00:50:00.000Z')
  const limits = [{ kind: 'five_hour', percentUsed: 99, resetsAt: '2026-10-05T00:50:00.000Z' }, { kind: 'seven_day', percentUsed: 30 }]
  expect(pressureOf(limits, reopened - 1).level).toBe('held')
  expect(pressureOf(limits, reopened)).toEqual({ level: 'none', percent: 30, window: 'seven_day', resetsAt: null })
})

const slowed: Pressure = { level: 'slowed', percent: 85, window: 'five_hour', resetsAt: null }
const held: Pressure = { level: 'held', percent: 97, window: 'seven_day', resetsAt: 9_000_000 }

/** A tutor that is on, with a save at 100 s that no look has seen. */
const FACTS: PlayFacts = {
  mode: 'on',
  isReady: true,
  hasRepo: true,
  isFollowing: false,
  isAutomatic: true,
  hasPending: true,
  lastChangeAt: 100_000,
  lastLookAt: null,
  isLooking: false,
  failures: 0,
  failure: '',
  quietMs: 10_000,
  minGapMs: 60_000,
  health: HEALTHY,
  pressure: NO_PRESSURE,
  jobBlock: '',
}

test('a session that does not drive the project looks at nothing, and says who does', async () => {
  const following = { ...FACTS, isFollowing: true }
  expect(playOf(following)).toEqual({ at: 'following' })
  expect(wakeAt(following)).toBe(null)
  expect(isLookDue(following, 10_000_000)).toBe(false)
  expect(playLine({ at: 'following' })).toBe('On. Another session is driving this project. This one is for the conversation.')
  // Paused is still paused, and a folder that is no repository is still that.
  expect(playOf({ ...following, mode: 'paused' })).toEqual({ at: 'paused' })
  expect(playOf({ ...following, hasRepo: false })).toEqual({ at: 'no-git' })
})

test('what the play-by-play is doing follows from the facts', async () => {
  expect(playOf({ ...FACTS, isReady: false })).toEqual({ at: 'starting' })
  expect(playOf({ ...FACTS, hasRepo: false })).toEqual({ at: 'no-git' })
  expect(playOf({ ...FACTS, mode: 'paused' })).toEqual({ at: 'paused' })
  expect(playOf({ ...FACTS, isLooking: true })).toEqual({ at: 'looking' })
  expect(playOf({ ...FACTS, isAutomatic: false })).toEqual({ at: 'on-request' })
  expect(playOf({ ...FACTS, hasPending: false })).toEqual({ at: 'watching' })

  // A save: the look comes when the quiet time is over.
  expect(playOf(FACTS)).toEqual({ at: 'settling', dueAt: 110_000, isSpacing: false })
  // The last look was not long ago: the minimum gap decides.
  expect(playOf({ ...FACTS, lastLookAt: 90_000 })).toEqual({ at: 'settling', dueAt: 150_000, isSpacing: true })
  // Close to the plan's limit the gap is four times as long.
  expect(playOf({ ...FACTS, lastLookAt: 90_000, pressure: slowed })).toEqual({ at: 'settling', dueAt: 330_000, isSpacing: true })
})

test('a look that is wanted and held back says why, and until when', async () => {
  // The last look failed: the gap, and the wait that grows with each failure.
  expect(playOf({ ...FACTS, lastLookAt: 105_000, failures: 2, failure: 'empty reply' })).toEqual({
    at: 'waiting',
    until: 225_000,
    why: { kind: 'failed', detail: 'empty reply' },
  })
  // Another job found Claude overloaded.
  const waiting = failed(HEALTHY, 100_000)
  expect(playOf({ ...FACTS, health: waiting })).toEqual({ at: 'waiting', until: 130_000, why: { kind: 'trouble', trouble: 'overloaded', detail: 'overloaded' } })
  // The look's own pacing may be the later of the two.
  expect(playOf({ ...FACTS, lastLookAt: 105_000, failures: 1, failure: 'overloaded', health: waiting })).toEqual({
    at: 'waiting',
    until: 195_000,
    why: { kind: 'failed', detail: 'overloaded' },
  })
  // While another job asks first, there is no time to give.
  const probing = stepHealth(stepHealth(waiting, { type: 'due' }), { type: 'probing' })
  expect(playOf({ ...FACTS, health: probing })).toEqual({ at: 'waiting', until: null, why: { kind: 'trouble', trouble: 'overloaded', detail: 'overloaded' } })

  expect(playOf({ ...FACTS, pressure: held })).toEqual({ at: 'waiting', until: 9_000_000, why: { kind: 'plan', percent: 97, window: 'seven_day' } })
  expect(playOf({ ...FACTS, health: { state: 'blocked', detail: 'billing error' } })).toEqual({ at: 'waiting', until: null, why: { kind: 'account', detail: 'billing error' } })
  expect(playOf({ ...FACTS, jobBlock: 'model not found' })).toEqual({ at: 'waiting', until: null, why: { kind: 'job', detail: 'model not found' } })
  // With nothing pending, none of it matters.
  expect(playOf({ ...FACTS, hasPending: false, pressure: held, jobBlock: 'model not found' })).toEqual({ at: 'watching' })
})

test('when to come back for a look, and whether it may start', async () => {
  expect(wakeAt(FACTS)).toBe(110_000)
  expect(isLookDue(FACTS, 109_999)).toBe(false)
  expect(isLookDue(FACTS, 110_000)).toBe(true)
  expect(wakeAt({ ...FACTS, hasPending: false })).toBe(null)
  expect(wakeAt({ ...FACTS, isAutomatic: false })).toBe(null)

  // After a failure the look itself is what finds out whether Claude is back.
  const waiting = failed(HEALTHY, 100_000)
  expect(wakeAt({ ...FACTS, health: waiting })).toBe(130_000)
  expect(isLookDue({ ...FACTS, health: waiting }, 129_999)).toBe(false)
  expect(isLookDue({ ...FACTS, health: waiting }, 130_000)).toBe(true)
  expect(isLookDue({ ...FACTS, health: stepHealth(waiting, { type: 'due' }) }, 130_000)).toBe(true)

  // The plan's limit, a refused account and a wrong model are not got past by waiting.
  expect(wakeAt({ ...FACTS, pressure: held })).toBe(9_000_000)
  expect(isLookDue({ ...FACTS, pressure: held }, 9_000_000)).toBe(false)
  expect(wakeAt({ ...FACTS, health: { state: 'blocked', detail: 'billing error' } })).toBe(null)
  expect(wakeAt({ ...FACTS, jobBlock: 'model not found' })).toBe(null)
})

test('the status line says what is happening, and when a wait ends', async () => {
  expect(playLine({ at: 'starting' })).toBe('On. Getting ready.')
  expect(playLine({ at: 'no-git' })).toBe('On. This folder is not a git repository, so there is no play-by-play.')
  expect(playLine({ at: 'paused' })).toBe('Paused. /bsd resume to continue.')
  expect(playLine({ at: 'watching' })).toBe('On. Watching for your next save.')
  expect(playLine({ at: 'on-request' })).toBe('On. Looking only when you ask.')
  expect(playLine({ at: 'looking' })).toBe('On. Looking at your changes.')
  expect(playLine({ at: 'settling', dueAt: 110_000, isSpacing: false })).toBe('On. Saw your save. Looking when you pause.')

  const at = new Date(2026, 9, 4, 12, 7, 30).getTime()
  expect(clockTime(at)).toBe('12:07')
  expect(clockTime(new Date(2026, 9, 4, 9, 5).getTime())).toBe('09:05')
  expect(playLine({ at: 'settling', dueAt: at, isSpacing: true })).toBe('On. Saw your save. Next look after 12:07.')
  expect(playLine({ at: 'waiting', until: at, why: { kind: 'failed', detail: 'overloaded' } })).toBe('On. The last look failed (overloaded). Next try 12:07.')
  expect(playLine({ at: 'waiting', until: null, why: { kind: 'failed', detail: 'an error' } })).toBe('On. The last look failed (an error). It will try again.')
  expect(playLine({ at: 'waiting', until: at, why: { kind: 'trouble', trouble: 'overloaded', detail: 'overloaded' } })).toBe('On. Claude is overloaded. Next try 12:07.')
  expect(playLine({ at: 'waiting', until: at, why: { kind: 'trouble', trouble: 'offline', detail: 'no connection' } })).toBe('On. There is no connection to Claude. Next try 12:07.')
  expect(playLine({ at: 'waiting', until: null, why: { kind: 'trouble', trouble: 'rate-limit', detail: 'rate limit' } })).toBe('On. Claude is rate limited.')
  expect(playLine({ at: 'waiting', until: null, why: { kind: 'plan', percent: 97, window: 'seven_day' } })).toBe(
    'On. Holding back, because you are close to your plan limit. It still looks when you ask.',
  )
  expect(playLine({ at: 'waiting', until: at, why: { kind: 'plan', percent: 97, window: 'five_hour' } })).toBe(
    'On. Holding back until 12:07, because you are close to your plan limit. It still looks when you ask.',
  )
  expect(playLine({ at: 'waiting', until: null, why: { kind: 'account', detail: 'billing error' } })).toBe(
    'On. Claude is refusing this account (billing error). Nothing runs in the background until that is sorted out.',
  )
  expect(playLine({ at: 'waiting', until: null, why: { kind: 'job', detail: 'model not found' } })).toBe(
    'On. The play-by-play cannot run (model not found). Its model is set in /config.',
  )

  // The character takes its pose from the state: eyes up only while a look runs.
  expect(watchOf({ at: 'looking' }, 5).state).toBe('looking')
  expect(watchOf({ at: 'watching' }, 5)).toEqual({ state: 'idle', lastLookAt: 5, line: 'On. Watching for your next save.' })
  expect(watchOf({ at: 'on-request' }, null).state).toBe('idle')
  expect(watchOf({ at: 'paused' }, null).state).toBe('idle')
})

test('the row under the status line says what keeps going wrong, and not what the line above already says', async () => {
  const at = new Date(2026, 9, 4, 12, 7).getTime()
  const quiet = { play: { at: 'watching' } as const, health: HEALTHY, pressure: NO_PRESSURE, lastScanMs: 20, failing: [] }
  expect(healthLine(quiet)).toBe('')
  const waiting: Health = { state: 'waiting', trouble: 'overloaded', detail: 'overloaded', until: at, failures: 2 }
  expect(healthLine({ ...quiet, health: waiting })).toBe('Claude is overloaded. Background work waits until 12:07.')
  // A look that is held back says so itself, in the status line.
  expect(healthLine({ ...quiet, health: waiting, play: { at: 'waiting', until: at, why: { kind: 'trouble', trouble: 'overloaded', detail: 'overloaded' } } })).toBe('')
  expect(healthLine({ ...quiet, health: { state: 'blocked', detail: 'billing error' } })).toBe(
    'Claude is refusing this account (billing error). Nothing runs in the background until that is sorted out.',
  )
  expect(healthLine({ ...quiet, play: { at: 'on-request' }, pressure: { level: 'held', percent: 97, window: 'five_hour', resetsAt: at } })).toBe(
    'You are close to your plan limit. Nothing runs in the background until 12:07 unless you ask.',
  )
  expect(healthLine({ ...quiet, lastScanMs: 3200 })).toBe('git is slow here: the last look at the working tree took 3.2 s.')
  expect(healthLine({ ...quiet, failing: ['could not write the journal'] })).toBe('Keeps failing: could not write the journal. /bsd debug dump saves the details.')
  // Paused, or with another session driving, there is nothing in the background to speak of.
  expect(healthLine({ ...quiet, health: waiting, play: { at: 'paused' } })).toBe('')
  expect(healthLine({ ...quiet, health: waiting, play: { at: 'following' } })).toBe('')
  expect(watchOf({ at: 'watching' }, 5, 'git is slow here.')).toEqual({ state: 'idle', lastLookAt: 5, line: 'On. Watching for your next save.', health: 'git is slow here.' })
})

test('the working tree is scanned often after something happened, and seldom when nothing has for a while', async () => {
  const at = (quietFor: number | null, lastScanMs = 5, isPushed = false): number =>
    scanGapMs({ now: 1_000_000, activeAt: quietFor === null ? null : 1_000_000 - quietFor, lastScanMs, isPushed })
  expect(at(0)).toBe(HOT_SCAN_MS)
  expect(at(HOT_FOR_MS - 1)).toBe(HOT_SCAN_MS)
  expect(at(HOT_FOR_MS)).toBe(SCAN_MS)
  expect(at(IDLE_AFTER_MS - 1)).toBe(SCAN_MS)
  expect(at(IDLE_AFTER_MS)).toBe(IDLE_SCAN_MS)
  expect(at(null)).toBe(IDLE_SCAN_MS)

  // A slow `git status` is not run back to back: each quarter second it took adds two seconds.
  expect(at(0, 249)).toBe(HOT_SCAN_MS)
  expect(at(0, 250)).toBe(HOT_SCAN_MS + 2000)
  expect(at(HOT_FOR_MS, 1000)).toBe(SCAN_MS + 8000)
  expect(at(0, 60_000)).toBe(LONGEST_SCAN_GAP_MS)

  // While a file watcher pushes the changes, the scan is a safety net, whatever happened lately.
  expect(at(0, 5, true)).toBe(PUSHED_SCAN_MS)
  expect(at(null, 5, true)).toBe(PUSHED_SCAN_MS)
  expect(at(IDLE_AFTER_MS, 5, true)).toBe(PUSHED_SCAN_MS)
  expect(at(0, 60_000, true)).toBe(LONGEST_SCAN_GAP_MS)
  expect(PUSHED_SCAN_MS).toBeGreaterThan(IDLE_SCAN_MS)
})

test('the spot in focus is checked ten times a second while it is watched, and less often when a check is slow', async () => {
  const gap = (tookMs: number, isPushed = false): number => focusGapMs({ tookMs, isPushed })
  expect(gap(0)).toBe(FOCUS_SCAN_MS)
  expect(gap(25)).toBe(FOCUS_SCAN_MS)
  // A check that took a while is not run back to back: the wait is four times what it took.
  expect(gap(100)).toBe(400)
  expect(gap(60_000)).toBe(LONGEST_FOCUS_GAP_MS)
  // While a file watcher pushes the changes to the spot and the editor's focus file, the check is a safety net.
  expect(gap(0, true)).toBe(PUSHED_FOCUS_MS)
  expect(gap(60_000, true)).toBe(PUSHED_FOCUS_MS)
})

test('whatever the facts, no look starts by itself when it must not, and one that is held back says until when it can', { timeoutMs: 60_000 }, async () => {
  const random = seeded(21)
  const chance = (p: number): boolean => random() < p
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  for (let turn = 0; turn < 20_000; turn += 1) {
    const now = 1_790_000_000_000 + Math.floor(random() * 1e8)
    const health: Health = pick<Health>([
      HEALTHY,
      HEALTHY,
      { state: 'waiting', trouble: 'overloaded', detail: 'overloaded', until: now + Math.floor((random() - 0.3) * 400_000), failures: 2 },
      { state: 'recovering', trouble: 'offline', detail: 'no connection', failures: 1 },
      { state: 'probing', trouble: 'offline', detail: 'no connection', failures: 1 },
      { state: 'blocked', detail: 'billing error' },
    ])
    const percent = pick([0, 0, 50, 80, 94, 95, 100])
    const facts: PlayFacts = {
      mode: chance(0.1) ? 'paused' : 'on',
      isReady: !chance(0.05),
      hasRepo: !chance(0.05),
      isFollowing: chance(0.1),
      isAutomatic: !chance(0.1),
      hasPending: !chance(0.2),
      lastChangeAt: chance(0.1) ? null : now - Math.floor(random() ** 2 * 200_000),
      lastLookAt: chance(0.3) ? null : now - Math.floor(random() ** 2 * 900_000),
      isLooking: chance(0.1),
      failures: chance(0.6) ? 0 : Math.floor(random() * 6),
      failure: 'overloaded',
      quietMs: pick([5000, 10_000, 60_000]),
      minGapMs: pick([0, 60_000, 300_000]),
      health,
      pressure: { level: percent >= 95 ? 'held' : percent >= 80 ? 'slowed' : 'none', percent, window: 'five_hour', resetsAt: chance(0.5) ? null : now + 600_000 },
      jobBlock: chance(0.05) ? 'model not found' : '',
    }
    const play = playOf(facts)
    const wake = wakeAt(facts)
    const where = `turn ${turn}: ${JSON.stringify(facts)} is ${JSON.stringify(play)}`
    for (const at of [now - 500_000, now, now + 500_000]) {
      if (!isLookDue(facts, at)) continue
      // A look that is due is due because its time has come: there was a time, and it has passed.
      if (wake === null || wake > at) throw new Error(`due at ${at} with a wake time of ${wake}. ${where}`)
      if (facts.isLooking) throw new Error(`due while one runs. ${where}`)
      if (facts.mode === 'paused' || facts.isFollowing || !facts.hasRepo || !facts.isReady) throw new Error(`due while nothing should look. ${where}`)
      if (!facts.isAutomatic) throw new Error(`due though it looks only when asked. ${where}`)
      if (!facts.hasPending || facts.lastChangeAt === null) throw new Error(`due with nothing to look at. ${where}`)
      if (facts.jobBlock !== '' || health.state === 'blocked' || facts.pressure.level === 'held') throw new Error(`due though it is held back. ${where}`)
      // While another job is finding out whether Claude is back, this one waits for what it finds.
      if (health.state === 'probing') throw new Error(`due while another job is finding out. ${where}`)
      if (at < facts.lastChangeAt + facts.quietMs) throw new Error(`due before the quiet time is over. ${where}`)
    }
    // A save that is settling is due no sooner than the quiet time after it.
    if (play.at === 'settling' && facts.lastChangeAt !== null && play.dueAt < facts.lastChangeAt + facts.quietMs) throw new Error(`settling too early. ${where}`)
    // The time to come back is the state's own time, and there is none for a state that waits for nothing.
    if (play.at === 'settling' && wake !== play.dueAt) throw new Error(`wake is not the due time. ${where}`)
    if (play.at === 'waiting' && wake !== play.until) throw new Error(`wake is not the wait's end. ${where}`)
    if (play.at !== 'settling' && play.at !== 'waiting' && wake !== null) throw new Error(`a wake time with nothing to wait for. ${where}`)
  }
})

test('whoever asks and whenever, a lease that is held is never taken from its holder before it runs out', async () => {
  const random = seeded(31)
  const ids = ['a', 'b', 'c']
  let lease: Lease = NO_LEASE
  let now = 1_790_000_000_000
  for (let turn = 0; turn < 20_000; turn += 1) {
    now += Math.floor(random() ** 2 * 50_000)
    const me = ids[Math.floor(random() * ids.length)] as string
    const before = lease
    const wasHeld = isHeld(before, now)
    if (random() < 0.15) {
      lease = released(lease, me)
      // Only its holder gives a lease back.
      if (before.session !== me && lease !== before) throw new Error(`turn ${turn}: ${me} gave back ${JSON.stringify(before)}`)
      if (before.session === me && isHeld(lease, now)) throw new Error(`turn ${turn}: given back and still held`)
    } else {
      lease = claimed(lease, me, now)
      if (wasHeld && before.session !== me) {
        // Held by another: untouched, and the same object, so that nothing is written.
        if (lease !== before) throw new Error(`turn ${turn}: ${me} took ${JSON.stringify(before)} at ${now}`)
      } else if (lease.session !== me || lease.at !== now) {
        throw new Error(`turn ${turn}: ${me} did not get a lease that was free: ${JSON.stringify(lease)}`)
      }
    }
    // A lease run out is nobody's, whoever it names.
    if (lease.session !== '' && now - lease.at >= LEASE_TTL_MS && isHeld(lease, now)) throw new Error(`turn ${turn}: held past its time`)
    // The next look at it is in the future, and never further off than one beat.
    const next = nextLeaseCheck(lease, me, now, random())
    if (next <= now || next > now + LEASE_BEAT_MS) throw new Error(`turn ${turn}: the next check is at ${next - now} ms`)
  }
})

test('whatever commits come and whatever happens to them, the queue keeps its rules', async () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const random = seeded(seed)
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
    const hashes = ['a1b2c3d', 'b2c3d4e', 'c3d4e5f', 'd4e5f60', 'e5f6071']
    let queue: ReviewQueue = { v: 1, commits: [] }
    let now = 1_790_000_000_000
    for (let turn = 0; turn < 60; turn += 1) {
      now += pick([0, 1000, 3_600_000, MAX_WAIT_MS])
      const hash = pick(hashes)
      const before = queue
      const kind = pick(['commit', 'commit', 'without', 'reviewed', 'attempt', 'attempt', 'current'] as const)
      const where = `seed ${seed}, turn ${turn}: ${kind} ${hash} on ${JSON.stringify(before)}`
      const known = before.commits.find(commit => commit.hash === hash)
      if (kind === 'commit') {
        queue = withCommit(queue, { hash, title: 'x' }, now)
        // A commit already waiting stays as it is, and nothing is written.
        if (known !== undefined && queue !== before) throw new Error(`a waiting commit was added again. ${where}`)
        // A new one is the newest, at the start of its review.
        const last = queue.commits.at(-1)
        if (known === undefined && (last?.hash !== hash || last.isReviewed || last.attempts !== 0)) throw new Error(`a new commit is not last. ${where}`)
      } else if (kind === 'without') {
        queue = withoutCommit(queue, hash)
      } else if (kind === 'reviewed') {
        queue = reviewed(queue, hash)
        // Moving on to the look at progress starts its count again.
        const after = queue.commits.find(commit => commit.hash === hash)
        if (known !== undefined && (after?.isReviewed !== true || after.attempts !== 0)) throw new Error(`reviewed did not move it on. ${where}`)
      } else if (kind === 'attempt') {
        queue = withAttempt(queue, hash)
      } else {
        queue = current(queue, now)
        if (queue.commits.some(commit => now - commit.at >= MAX_WAIT_MS)) throw new Error(`a commit waited too long. ${where}`)
      }
      // At most a few, each once, oldest first.
      if (queue.commits.length > MAX_WAITING) throw new Error(`too many wait. ${where}`)
      if (new Set(queue.commits.map(commit => commit.hash)).size !== queue.commits.length) throw new Error(`a commit waits twice. ${where}`)
      if (queue.commits.some((commit, at) => at > 0 && commit.at < (queue.commits[at - 1]?.at ?? 0))) throw new Error(`out of order. ${where}`)
      for (const commit of queue.commits) {
        if (isSpent(queue, commit.hash) !== commit.attempts >= MAX_ATTEMPTS) throw new Error(`isSpent disagrees with the count. ${where}`)
      }
      // The next review is of the oldest commit still without one, and only one that wants it. The look at progress never comes before its review.
      const wanted = { wantsReview: true, wantsAssessment: true }
      if (nextToReview(queue, wanted)?.hash !== queue.commits.find(commit => !commit.isReviewed)?.hash) throw new Error(`not the oldest. ${where}`)
      if (nextToAssess(queue, wanted)?.isReviewed === false) throw new Error(`assessed before its review. ${where}`)
      if (nextToReview(queue, { wantsReview: false, wantsAssessment: true }) !== null) throw new Error(`reviewed though not wanted. ${where}`)
      // Kept progress never lets a commit go before its look.
      if (settledIn(queue, wanted).length > 0) throw new Error(`settled while progress is kept. ${where}`)
    }
  }
})

test('the store reads a broken file a few times, writes a few times, and always comes to an end', async () => {
  // A file that is there and parses, or is not there at all, is settled at the first read.
  expect(afterRead(1, 'parsed')).toEqual({ next: 'sound' })
  expect(afterRead(1, 'missing')).toEqual({ next: 'absent' })
  // One that is empty or broken is read again a moment later, and is broken after the last try.
  for (let attempt = 1; attempt < READ_TRIES; attempt += 1) expect(afterRead(attempt, 'unreadable')).toEqual({ next: 'again', waitMs: READ_RETRY_MS })
  expect(afterRead(READ_TRIES, 'unreadable')).toEqual({ next: 'broken' })

  for (const hasLock of [true, false]) {
    for (const isSound of [true, false]) {
      for (const isSame of [true, false]) {
        for (let attempt = 1; attempt <= WRITE_TRIES; attempt += 1) {
          const step = changeStep(attempt, { hasLock, isSound, isSame })
          // A change that changes nothing in a sound file is never written.
          if (isSound && isSame) expect(step).toBe('unchanged')
          // Without the lock it checks first, except on the last try, which writes regardless.
          else if (!hasLock && attempt < WRITE_TRIES) expect(step).toBe('check')
          else expect(step).toBe('write')
        }
      }
    }
  }

  // A write that is read back is done. One that is not is tried again, a little later each time, and then given up on.
  let waited = 0
  for (let attempt = 1; attempt <= WRITE_TRIES; attempt += 1) {
    expect(afterWrite(attempt, true)).toEqual({ next: 'done' })
    const after = afterWrite(attempt, false)
    if (attempt === WRITE_TRIES) expect(after).toEqual({ next: 'unconfirmed' })
    else {
      if (after.next !== 'again' || after.waitMs <= waited) throw new Error(`try ${attempt}: ${JSON.stringify(after)}`)
      waited = after.waitMs
    }
  }

  // The file as it was is kept only when it was asked for, was sound, and was there.
  expect(keepsBackup({ wantsBackup: true, isSound: true, exists: true })).toBe(true)
  expect(keepsBackup({ wantsBackup: false, isSound: true, exists: true })).toBe(false)
  expect(keepsBackup({ wantsBackup: true, isSound: false, exists: true })).toBe(false)
  expect(keepsBackup({ wantsBackup: true, isSound: true, exists: false })).toBe(false)
})

test('whatever the play-by-play is doing, a wait names when it ends, and the row under it never says what the line says', async () => {
  const TROUBLES: Trouble[] = ['rate-limit', 'overloaded', 'server', 'offline', 'timeout', 'account', 'job', 'reply']
  const random = seeded(41)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const lines = new Set<string>()
  const rows = new Set<string>()
  for (let turn = 0; turn < 20_000; turn += 1) {
    const now = 1_790_000_000_000 + Math.floor(random() * 86_400_000)
    const trouble = pick(TROUBLES)
    const until = pick([null, now + Math.floor(random() * 900_000)])
    const why: Why = pick<Why>([
      { kind: 'failed', detail: pick(['no connection', 'empty reply']) },
      { kind: 'trouble', trouble, detail: 'overloaded' },
      { kind: 'plan', percent: 96, window: 'five_hour' },
      { kind: 'account', detail: 'billing error' },
      { kind: 'job', detail: 'model not found' },
    ])
    const play: Play = pick<Play>([
      { at: 'starting' },
      { at: 'no-git' },
      { at: 'following' },
      { at: 'paused' },
      { at: 'watching' },
      { at: 'on-request' },
      { at: 'looking' },
      { at: 'settling', dueAt: now + 10_000, isSpacing: random() < 0.5 },
      { at: 'waiting', until, why },
    ])
    const health: Health = pick<Health>([
      { state: 'ok' },
      { state: 'waiting', trouble, detail: 'x', until: now + Math.floor(random() * 600_000), failures: 2 },
      { state: 'recovering', trouble, detail: 'x', failures: 2 },
      { state: 'probing', trouble, detail: 'x', failures: 3 },
      { state: 'blocked', detail: 'billing error' },
    ])
    const pressure: Pressure = {
      level: pick(['none', 'slowed', 'held'] as const),
      percent: Math.floor(random() * 100),
      window: 'five_hour',
      resetsAt: pick([null, now + 3_600_000]),
    }
    const facts = { play, health, pressure, lastScanMs: pick([0, 40, 1499, 1500, 2345, 31_999.5, random() * 5000]), failing: pick([[], ['a scan'], ['a scan', 'a lookup']]) }
    const line = playLine(play)
    const row = healthLine(facts)
    // A wait for a retry, the service or the plan names the time it ends, as the clock shows it.
    if (play.at === 'waiting' && play.until !== null && (play.why.kind === 'failed' || play.why.kind === 'trouble' || play.why.kind === 'plan')) {
      if (!line.includes(clockTime(play.until))) throw new Error(`turn ${turn}: "${line}" does not say ${clockTime(play.until)}`)
    }
    // A look that is held back already says why, so the row leaves the service and the plan out.
    if (play.at === 'waiting' && (row.includes('Claude') || row.includes('plan limit'))) throw new Error(`turn ${turn}: the row repeats the line: "${row}"`)
    // Nothing is said about the background while it is not this session's, or not running.
    if ((play.at === 'paused' || play.at === 'following' || play.at === 'starting' || play.at === 'no-git') && row !== '') throw new Error(`turn ${turn}: "${row}"`)
    if (watchOf(play, null, row).line !== line) throw new Error(`turn ${turn}: watchOf says another line`)
  }
})

test('whatever deadlines there are, the timer is armed for the first of them, and due ones run earliest first', async () => {
  const random = seeded(51)
  const names = ['scan', 'look', 'health', 'review', 'lease', 'journal']
  for (let turn = 0; turn < 20_000; turn += 1) {
    const now = 1_790_000_000_000
    const deadlines = names.filter(() => random() < 0.5).map(name => ({ name, at: now + Math.floor(random() * 5) * 1000 - 2000 }))
    const first = deadlines.length === 0 ? null : Math.min(...deadlines.map(deadline => deadline.at))
    const armedFor = [null, first, now][Math.floor(random() * 3)] ?? null
    const arm = arming(armedFor, deadlines)
    const where = `turn ${turn}: armed for ${armedFor}, ${JSON.stringify(deadlines)} gave ${JSON.stringify(arm)}`
    // Left alone when it is right already, never armed with nothing to do, and otherwise armed for the first.
    if (armedFor === first && arm.next !== 'keep') throw new Error(`a timer that was right was touched. ${where}`)
    if (armedFor !== first && first === null && arm.next !== 'disarm') throw new Error(`a timer is kept with nothing to do. ${where}`)
    if (armedFor !== first && first !== null && (arm.next !== 'arm' || arm.at !== first)) throw new Error(`not armed for the first. ${where}`)
    if (first !== null && delayMs(first, now) !== Math.max(0, first - now)) throw new Error(`the delay is wrong. ${where}`)
    // Every due deadline runs, none that is not, the earliest first, and in the order given among equals.
    const due = dueNow(deadlines, now)
    const expected = deadlines.filter(deadline => deadline.at <= now)
    if (due.length !== expected.length || !expected.every(deadline => due.includes(deadline.name))) throw new Error(`not what is due. ${where} ${JSON.stringify(due)}`)
    const at = (name: string) => deadlines.findIndex(deadline => deadline.name === name)
    for (let index = 1; index < due.length; index += 1) {
      const a = deadlines[at(due[index - 1] as string)]
      const b = deadlines[at(due[index] as string)]
      if (a === undefined || b === undefined || a.at > b.at || (a.at === b.at && at(a.name) > at(b.name))) throw new Error(`out of order. ${where} ${JSON.stringify(due)}`)
    }
  }
})

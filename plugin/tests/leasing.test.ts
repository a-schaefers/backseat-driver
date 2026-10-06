import { expect, test } from 'claude-code/testing'

import { freshLeaseState, keepLease } from '../core/leasing'
import type { LeasePorts } from '../core/leasing'
import { leasePath } from '../core/datahome'
import { plainStore } from '../core/store'
import { memoryDisk } from '../core/storage'

/** Holding the lease is host-neutral: it runs here with nothing but ports. */
function world(overrides: Partial<LeasePorts> = {}) {
  const log: string[] = []
  const disk = memoryDisk()
  const ports: LeasePorts = {
    now: async () => 1000,
    trace: () => undefined,
    fail: (what, error) => void log.push(`fail: ${what}: ${String(error)}`),
    isOn: () => true,
    engagement: () => 1,
    repoRoot: () => '/work',
    dataRoot: () => '/data',
    sessionId: async () => 'me',
    store: () => plainStore(disk),
    deadline: { set: name => void log.push(`set ${name}`) },
    startDriving: async run => void log.push(`start ${run}`),
    stopDriving: async () => void log.push('stop'),
    followDriver: async () => void log.push('follow'),
    ...overrides,
  }

  return { ports, log, disk }
}

test('a free lease is taken, driving starts once, and the next look is planned', async () => {
  const w = world()
  const state = freshLeaseState()
  state.isDriver = false
  await keepLease(w.ports, state, 1)

  expect(state.isDriver).toBe(true)
  expect(state.holder).toBe('me')
  expect(w.log).toEqual(['set lease', 'start 1'])
  // Renewed: still the driver, so nothing starts again.
  await keepLease(w.ports, state, 1)
  expect(w.log).toEqual(['set lease', 'start 1', 'set lease'])
})

test('a lease another session holds makes this one wait, once', async () => {
  const w = world()
  await w.ports.store().update(leasePath('/data', '/work'), () => ({ v: 1, session: 'other', at: 990 }))
  const state = freshLeaseState()
  await keepLease(w.ports, state, 1)

  expect(state.isDriver).toBe(false)
  // Waiting, it takes up what the driver writes, now and at every beat; it stops driving only once.
  expect(w.log).toEqual(['set lease', 'stop', 'follow'])
  await keepLease(w.ports, state, 1)
  expect(w.log).toEqual(['set lease', 'stop', 'follow', 'set lease', 'follow'])
})

test('with no repository there is no lease to hold, and a stale switch-on changes nothing', async () => {
  const w = world({ repoRoot: () => '' })
  const state = freshLeaseState()
  await keepLease(w.ports, state, 1)
  expect(state.isDriver).toBe(true)
  expect(w.log).toEqual([])

  await keepLease(world().ports, state, 2)
  expect(w.log).toEqual([])
})

import { expect, test } from 'claude-code/testing'

import { NO_PRESSURE } from '../core/health'
import { freshProgressState, placeFirst, queueProgress, setUpProgress } from '../core/progressing'
import type { ProgressPorts } from '../core/progressing'
import { readSettings } from '../core/settings'
import type { Profiles } from '../types'

/** The look at progress is host-neutral: it runs here with nothing but ports. */
function world(overrides: Partial<ProgressPorts> = {}) {
  const log: string[] = []
  const files = new Map<string, unknown>()
  const profiles: Profiles = { languages: ['python'], subjects: {} }
  const ports: ProgressPorts = {
    settings: readSettings({}),
    now: async () => 1000,
    ask: async job => (log.push(`ask ${job}`), { isAnswered: false, reason: 'aborted' }),
    git: async args => (log.push(`git ${args.join(' ')}`), { exitCode: 0, stdout: args.includes('--global') ? '' : 'me@example.com' }),
    store: () => ({ read: async (path: string) => files.get(path) ?? null, update: async () => undefined }) as never,
    repoRoot: () => '/work',
    dataRoot: () => '/data',
    projectName: () => 'work',
    isOn: () => true,
    isDriver: () => true,
    engagement: () => 1,
    profiles: () => profiles,
    instructions: () => '',
    readPressure: async () => NO_PRESSURE,
    mayAsk: () => true,
    setProgress: async change => void log.push(`progress ${Object.keys(change).join(',')}`),
    registerReviewer: async () => undefined,
    toast: () => undefined,
    fail: (what, error) => void log.push(`fail: ${what}: ${String(error)}`),
    ...overrides,
  }

  return { ports, log }
}

test('setting up reads the person\'s email, then the records in play, and shows them', async () => {
  const w = world()
  const state = freshProgressState()
  await setUpProgress(w.ports, state)

  expect(state.identity).toEqual(['me@example.com'])
  expect([...state.records.keys()]).toEqual(['python'])
  expect(w.log.at(-1)).toBe('progress isOn,identity,records')
})

test('a first placement does nothing without the person\'s email or while the plan is held back', async () => {
  // The identity is read again first, whatever was known: an email set after switch-on counts from then on.
  const IDENTITY = ['git config --get user.email', 'git config --global --get user.email']
  const w = world()
  const state = freshProgressState()
  await placeFirst({ ...w.ports, git: async args => (w.log.push(`git ${args.join(' ')}`), { exitCode: 1, stdout: '' }) }, state, 1)
  expect(w.log).toEqual(IDENTITY)
  expect(state.identity).toEqual([])

  w.log.length = 0
  await placeFirst({ ...w.ports, mayAsk: () => false }, state, 1)
  // The email found is news for the Growth tab, and the plan's limit stops the rest.
  expect(w.log).toEqual([...IDENTITY, 'progress isOn,identity,records'])
  expect(state.identity).toEqual(['me@example.com'])
})

test('progress work runs one piece after the other, and a failure does not stop the next', async () => {
  const w = world()
  const state = freshProgressState()
  const order: string[] = []
  queueProgress(state, w.ports.fail, async () => void order.push('a'))
  queueProgress(state, w.ports.fail, async () => {
    throw new Error('boom')
  })
  queueProgress(state, w.ports.fail, async () => void order.push('c'))
  await state.queue

  expect(order).toEqual(['a', 'c'])
  expect(w.log).toEqual(['fail: progress failed: Error: boom'])
})

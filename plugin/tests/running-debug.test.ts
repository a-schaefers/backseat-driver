import { expect, test } from 'claude-code/testing'

import { debugCommand, flushDebug, freshDebuggingState, startDebug, stopDebug, trace } from '../core/debugging'
import type { DebuggingPorts } from '../core/debugging'
import { FLUSH_MS } from '../core/debuglog'

/** Running the debug log is host-neutral: it runs here with nothing but ports and a map for a disk. */
function world(overrides: Partial<DebuggingPorts> = {}) {
  const files = new Map<string, string>()
  const timers: { ms: number; run: () => void; isCancelled: boolean }[] = []
  const ports: DebuggingPorts = {
    settings: null,
    now: async () => 5,
    after: (ms, run) => {
      const timer = { ms, run, isCancelled: false }
      timers.push(timer)

      return { cancel: () => void (timer.isCancelled = true) }
    },
    read: async path => {
      const text = files.get(path)
      if (text === undefined) throw new Error('missing')

      return text
    },
    write: async (path, text) => void files.set(path, text),
    list: async path => [...files.keys()].filter(key => key.startsWith(`${path}/`)).map(key => ({ name: key.slice(path.length + 1).split('/')[0]! })),
    remove: async path => {
      for (const key of [...files.keys()]) if (key.startsWith(`${path}/`)) files.delete(key)

      return true
    },
    markHome: async () => undefined,
    resolveHome: async () => undefined,
    dataRoot: () => '/data',
    repoRoot: () => '/work',
    mode: () => 'on',
    sessionId: async () => 'abcdefgh-1234',
    versions: async () => ({ host: { claudeCode: '2.1.289' }, plugin: '0.1.0' }),
    pluginRoot: () => '/plugin',
    fullState: async () => ({ pane: 1 }),
    log: () => undefined,
    ...overrides,
  }

  return { ports, files, timers, state: freshDebuggingState(() => 1) }
}

test('with the switch off nothing is written and nothing is armed', async () => {
  const w = world()
  await startDebug(w.ports, w.state)
  trace(w.ports, w.state, 'cmd', 'x')

  expect(w.state.tracer.isOn()).toBe(false)
  expect(w.files.size).toBe(0)
  expect(w.timers).toEqual([])
})

test('switched on, a trace arms one flush, and the flush writes the log and the state', async () => {
  const w = world()
  expect(await debugCommand(w.ports, w.state, 'on')).toContain('The debug log is on.')
  trace(w.ports, w.state, 'cmd', 'one')
  trace(w.ports, w.state, 'cmd', 'two')

  const armed = w.timers.filter(timer => !timer.isCancelled && timer.ms === FLUSH_MS)
  expect(armed.length).toBe(1)
  armed[0]!.run()
  await flushDebug(w.ports, w.state)
  const paths = [...w.files.keys()]
  expect(paths.some(path => path.endsWith('/state.json'))).toBe(true)
  expect(paths.some(path => path.endsWith('.jsonl'))).toBe(true)
})

test('stopping writes what is held and detaches the log', async () => {
  const w = world()
  await debugCommand(w.ports, w.state, 'on')
  await stopDebug(w.ports, w.state, 'a test')

  expect(w.state.tracer.isOn()).toBe(false)
  expect(w.state.flushTimer).toBe(null)
  expect([...w.files.values()].join('\n')).toContain('log stopped')
})

test('status, dump and clear answer from the folder', async () => {
  const w = world()
  expect(await debugCommand(w.ports, w.state, 'status')).toContain('The debug log is off.')
  await debugCommand(w.ports, w.state, 'on')
  expect(await debugCommand(w.ports, w.state, 'dump')).toContain('/data/debug/dump-')
  expect(await debugCommand(w.ports, w.state, 'clear')).toContain('carries on in a new one')
  expect(w.state.tracer.isOn()).toBe(true)
})

test('without a data folder there is nowhere to keep a log', async () => {
  const w = world({ dataRoot: () => '' })

  expect(await debugCommand(w.ports, w.state, 'on')).toContain('nowhere to keep a debug log')
})

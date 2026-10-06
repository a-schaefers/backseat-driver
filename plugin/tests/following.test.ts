import { expect, test } from 'claude-code/testing'

import { freshFollowState, isWatched, lookUp, readFocus } from '../core/following'
import type { FollowPorts } from '../core/following'

const REPORT = JSON.stringify({ v: 1, editor: 'neovim', pid: 1, at: 5000, changed: 5000, root: '/work', file: '/work/a.py', line: 3, column: 1 })

/** Following the focus is host-neutral: it runs here with nothing but ports. */
function world(overrides: Partial<FollowPorts> = {}) {
  const log: string[] = []
  const ports: FollowPorts = {
    now: async () => 6000,
    trace: () => undefined,
    fail: (what, error) => void log.push(`fail: ${what}: ${String(error)}`),
    repoRoot: () => '/work',
    dataRoot: () => '/data',
    isOn: () => true,
    isDriver: () => true,
    engagement: () => 1,
    stamp: async () => '',
    list: async () => [{ name: 'neovim-1.json', kind: 'file', size: REPORT.length, mtimeMs: 5000 }],
    readFile: async () => REPORT,
    writeFile: async path => void log.push(`write ${path}`),
    countStat: () => void log.push('stat'),
    readView: async () => {
      throw new Error('not asked')
    },
    setView: async () => undefined,
    showEditors: async line => void log.push(`editors ${line}`),
    isExplainShown: async () => false,
    markActive: () => undefined,
    feedJournal: () => undefined,
    isPushed: () => false,
    deadline: { set: name => void log.push(`set ${name}`), cancel: name => void log.push(`cancel ${name}`) },
    after: () => ({ cancel: () => undefined }),
    markHome: async () => undefined,
    ...overrides,
  }

  return { ports, log }
}

test('reading the editors names the connected one and takes what it says as the focus, once', async () => {
  const w = world()
  const state = freshFollowState()

  expect(await readFocus(w.ports, state)).toBe(true)
  expect(state.isAnyEditor).toBe(true)
  expect(state.focusText).toContain('"line":3')
  expect(w.log).toEqual(['stat', 'editors Neovim is connected.'])
  // Nothing changed in the file: it is not read again, and says nothing new.
  expect(await readFocus(w.ports, state)).toBe(false)
})

test('without a data folder no editor is read', async () => {
  const w = world({ dataRoot: () => '' })

  expect(await readFocus(w.ports, freshFollowState())).toBe(false)
  expect(w.log).toEqual([])
})

test('nobody watches an unseen tab, and a lookup without the engine answers nothing', async () => {
  const w = world()
  const state = freshFollowState()

  expect(await isWatched(w.ports, state)).toBe(false)
  expect(await lookUp(w.ports, state, { path: 'a.py', line: 1 })).toBe('')
})

test('an editor that moved its caret lately is watched by the driver, and by a session that does not drive only through its open tab', async () => {
  const state = freshFollowState()
  state.focus = { path: 'a.py', line: 3, source: 'editor' }
  state.editorFocusAt = 5500

  expect(await isWatched(world().ports, state)).toBe(true)
  expect(await isWatched(world({ isDriver: () => false }).ports, state)).toBe(false)
  expect(await isWatched(world({ isDriver: () => false, isExplainShown: async () => true }).ports, state)).toBe(true)
})

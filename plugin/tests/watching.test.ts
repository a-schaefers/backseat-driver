import { expect, test } from 'claude-code/testing'

import { backoffMs, shouldLook, slowedGapMs, throttle, usagePressure } from '../core/gate'
import { dirtyPaths, parseStatus } from '../core/git'
import { isNoiseFile, isTrivialChange, looksBinary } from '../core/noise'
import { createWatcher } from '../core/watcher'

test('parseStatus reads NUL-separated entries and skips the old name of a rename', async () => {
  const output = ' M src/a.py\0?? notes with space.txt\0R  new.py\0old.py\0 D gone.py\0D  staged-gone.py\0A  added.py\0'
  const entries = parseStatus(output)

  expect(entries.map(entry => entry.path)).toEqual([
    'src/a.py',
    'notes with space.txt',
    'new.py',
    'gone.py',
    'staged-gone.py',
    'added.py',
  ])
  expect(dirtyPaths(entries)).toEqual(['src/a.py', 'notes with space.txt', 'new.py', 'added.py'])
  expect(parseStatus('')).toEqual([])
})

test('isNoiseFile: lock files, generated folders and non-source files', async () => {
  for (const path of ['package-lock.json', 'web/yarn.lock', 'Cargo.lock', 'node_modules/x/index.js', 'dist/app.js', 'a/b/__pycache__/m.pyc', 'logo.png', 'app.min.js', 'out.js.map']) {
    expect(isNoiseFile(path)).toBe(true)
  }
  for (const path of ['src/a.py', 'Cargo.toml', 'package.json', 'build.rs', 'docs/target.md', 'distance.py']) {
    expect(isNoiseFile(path)).toBe(false)
  }
})

test('isTrivialChange: blank lines and trailing spaces are trivial, indentation is not', async () => {
  expect(isTrivialChange('a\nb\n', 'a\n\nb  \r\n')).toBe(true)
  expect(isTrivialChange('if x:\n    y()\n', 'if x:\ny()\n')).toBe(false)
  expect(isTrivialChange('a\n', 'a\nb\n')).toBe(false)
  expect(looksBinary('abc\0def')).toBe(true)
  expect(looksBinary('abc')).toBe(false)
})

const GATE = {
  now: 100_000,
  lastChangeAt: 80_000,
  lastLookAt: null,
  hasPendingChange: true,
  isLookRunning: false,
  quietMs: 10_000,
  minGapMs: 60_000,
  backoffMs: 0,
} as const

test('shouldLook: a look needs a change, quiet, the minimum gap and nothing running', async () => {
  expect(shouldLook(GATE)).toBe(true)
  expect(shouldLook({ ...GATE, hasPendingChange: false })).toBe(false)
  expect(shouldLook({ ...GATE, lastChangeAt: null })).toBe(false)
  expect(shouldLook({ ...GATE, isLookRunning: true })).toBe(false)
  // Still typing: the tree changed 4 seconds ago.
  expect(shouldLook({ ...GATE, lastChangeAt: 96_000 })).toBe(false)
  // The previous look ended 30 seconds ago, and the gap is a minute.
  expect(shouldLook({ ...GATE, lastLookAt: 70_000 })).toBe(false)
  expect(shouldLook({ ...GATE, lastLookAt: 40_000 })).toBe(true)
  // A failed look pushes the next one out further.
  expect(shouldLook({ ...GATE, lastLookAt: 40_000, backoffMs: 30_000 })).toBe(false)
  expect(shouldLook({ ...GATE, lastLookAt: 40_000, minGapMs: 0 })).toBe(true)
})

test('backoffMs doubles from 30 seconds and stops at 10 minutes', async () => {
  expect([0, 1, 2, 3, 6, 20].map(backoffMs)).toEqual([0, 30_000, 60_000, 120_000, 600_000, 600_000])
})

/** A working tree in memory: `files` is what is on disk, `head` what is committed. */
function tree(head: Record<string, string>, files: Record<string, string>) {
  let clock = 1
  const mtimes = new Map<string, number>()
  const gitCalls: string[][] = []

  const write = (path: string, text: string) => {
    files[path] = text
    clock += 1
    mtimes.set(path, clock)
  }

  const watcher = createWatcher({
    git: async args => {
      gitCalls.push([...args])
      if (args[0] === 'status') {
        const changed = Object.keys(files).filter(path => files[path] !== head[path])
        const gone = Object.keys(head).filter(path => !(path in files))
        const stdout = [
          ...changed.map(path => `${path in head ? ' M' : '??'} ${path}`),
          ...gone.map(path => ` D ${path}`),
        ]
          .map(entry => `${entry}\0`)
          .join('')

        return { exitCode: 0, stdout }
      }
      if (args[0] === 'show') {
        const path = String(args[1]).replace(/^HEAD:/, '')

        return path in head ? { exitCode: 0, stdout: head[path] ?? '' } : { exitCode: 128, stdout: '' }
      }

      return { exitCode: 1, stdout: '' }
    },
    read: async path => files[path] ?? null,
    stat: async path =>
      path in files ? { size: (files[path] ?? '').length, mtimeMs: mtimes.get(path) ?? 0 } : null,
  })

  return { watcher, write, commit: (path: string) => (head[path] = files[path] ?? ''), gitCalls }
}

test('work already uncommitted when the tutor starts is the baseline', async () => {
  const { watcher, write } = tree({ 'a.py': 'one\n' }, { 'a.py': 'one\ntwo\n' })
  expect(await watcher.start()).toBe(true)
  expect(await watcher.poll()).toBe(false)
  expect(watcher.hasPending()).toBe(false)

  write('a.py', 'one\ntwo\nthree\n')
  expect(await watcher.poll()).toBe(true)
  expect(watcher.hasPending()).toBe(true)

  const changes = await watcher.collect()
  expect(changes.map(change => change.path)).toEqual(['a.py'])
  // Only the line added since the tutor started, not the earlier uncommitted one.
  expect(changes[0]?.hunks[0]?.lines).toEqual([' one', ' two', '+three'])
})

test('a file that was clean is compared with HEAD', async () => {
  const { watcher, write } = tree({ 'a.py': 'one\n' }, { 'a.py': 'one\n' })
  await watcher.start()
  write('a.py', 'one\nTWO\n')
  await watcher.poll()

  const changes = await watcher.collect()
  expect(changes[0]?.before).toBe('one\n')
  expect(changes[0]?.hunks[0]?.lines).toEqual([' one', '+TWO'])
})

test('a new file is all additions, and a settled change is not collected twice', async () => {
  const { watcher, write } = tree({}, {})
  await watcher.start()
  write('new.py', 'x = 1\n')
  await watcher.poll()

  const changes = await watcher.collect()
  expect(changes[0]?.hunks[0]?.lines).toEqual(['+x = 1'])

  watcher.settle(changes)
  expect(watcher.hasPending()).toBe(false)
  expect(await watcher.collect()).toEqual([])
})

test('each look gets the net change since the previous look', async () => {
  const { watcher, write } = tree({ 'a.py': 'one\n' }, { 'a.py': 'one\n' })
  await watcher.start()
  write('a.py', 'one\ntwo\n')
  await watcher.poll()
  watcher.settle(await watcher.collect())

  write('a.py', 'one\ntwo\nthree\n')
  write('a.py', 'one\ntwo\nthree\nfour\n')
  await watcher.poll()
  const changes = await watcher.collect()
  expect(changes[0]?.hunks[0]?.lines).toEqual([' one', ' two', '+three', '+four'])
})

test('a file that changes again while a look runs stays pending', async () => {
  const { watcher, write } = tree({ 'a.py': 'one\n' }, { 'a.py': 'one\n' })
  await watcher.start()
  write('a.py', 'one\ntwo\n')
  await watcher.poll()
  const changes = await watcher.collect()

  write('a.py', 'one\ntwo\nthree\n')
  await watcher.poll()
  watcher.settle(changes)

  expect(watcher.hasPending()).toBe(true)
  const next = await watcher.collect()
  expect(next[0]?.hunks[0]?.lines).toEqual([' one', ' two', '+three'])
})

test('noise, whitespace-only edits and binary files never reach a look', async () => {
  const { watcher, write } = tree({ 'a.py': 'one\n' }, { 'a.py': 'one\n' })
  await watcher.start()
  write('a.py', 'one  \n\n')
  write('package-lock.json', '{}')
  write('blob.dat', 'a\0b')
  await watcher.poll()

  expect(await watcher.collect()).toEqual([])
  expect(watcher.hasPending()).toBe(false)
})

test('a committed file goes back to HEAD as its baseline', async () => {
  const { watcher, write, commit } = tree({ 'a.py': 'one\n' }, { 'a.py': 'one\n' })
  await watcher.start()
  write('a.py', 'one\ntwo\n')
  await watcher.poll()
  watcher.settle(await watcher.collect())

  commit('a.py')
  await watcher.poll()
  watcher.settle([])
  write('a.py', 'one\ntwo\nthree\n')
  await watcher.poll()

  const changes = await watcher.collect()
  expect(changes[0]?.before).toBe('one\ntwo\n')
})

test('a file fixed and committed between two polls is still looked at', async () => {
  const { watcher, write, commit } = tree({ 'a.py': 'one\n' }, { 'a.py': 'one\n' })
  await watcher.start()
  write('a.py', 'one\nbug\n')
  await watcher.poll()
  watcher.settle(await watcher.collect())
  expect(watcher.hasPending()).toBe(false)

  // The fix is saved and committed before the next poll: git lists nothing, and a note about `bug` is still open.
  write('a.py', 'one\nfixed\n')
  commit('a.py')
  expect(await watcher.poll()).toBe(true)
  expect(watcher.hasPending()).toBe(true)
  const changes = await watcher.collect()
  expect(changes.map(change => [change.path, change.before, change.after])).toEqual([['a.py', 'one\nbug\n', 'one\nfixed\n']])

  // A look that got no answer settles nothing, and the change is still there for the next.
  expect(watcher.hasPending()).toBe(true)
  expect((await watcher.collect()).length).toBe(1)
  watcher.settle(changes)
  expect(watcher.hasPending()).toBe(false)
  expect(await watcher.collect()).toEqual([])
  // From here the file is compared with HEAD again.
  write('a.py', 'one\nfixed\nmore\n')
  await watcher.poll()
  expect((await watcher.collect())[0]?.before).toBe('one\nfixed\n')
})

test('a file committed as the last look saw it, or put back to that, is not looked at again', async () => {
  const { watcher, write, commit } = tree({ 'a.py': 'one\n' }, { 'a.py': 'one\n' })
  await watcher.start()
  write('a.py', 'one\ntwo\n')
  await watcher.poll()
  watcher.settle(await watcher.collect())

  commit('a.py')
  await watcher.poll()
  expect(watcher.hasPending()).toBe(false)
  expect(await watcher.collect()).toEqual([])
})

test('a change that is thrown away after a look is a change too, and the look after it says so', async () => {
  const { watcher, write } = tree({ 'a.py': 'one\n' }, { 'a.py': 'one\n' })
  await watcher.start()
  write('a.py', 'one\nexperiment\n')
  await watcher.poll()
  watcher.settle(await watcher.collect())

  // `git checkout a.py`: the file is as committed again.
  write('a.py', 'one\n')
  await watcher.poll()
  expect(watcher.hasPending()).toBe(true)
  const changes = await watcher.collect()
  expect(changes[0]?.before).toBe('one\nexperiment\n')
  expect(changes[0]?.after).toBe('one\n')
  watcher.settle(changes)
  expect(watcher.hasPending()).toBe(false)
})

test('outside a git repository the watcher does not start', async () => {
  const watcher = createWatcher({
    git: async () => ({ exitCode: 128, stdout: '' }),
    read: async () => null,
    stat: async () => null,
  })

  expect(await watcher.start()).toBe(false)
  expect(await watcher.poll()).toBe(false)
})

test('usagePressure is the tightest window, and throttle holds back from 80% and stops at 95%', async () => {
  expect(usagePressure([])).toBe(0)
  expect(usagePressure([{ percentUsed: 12 }, { percentUsed: 81.5 }])).toBe(81.5)
  expect(throttle(50)).toEqual({ gapFactor: 1, isHeld: false })
  expect(throttle(80)).toEqual({ gapFactor: 4, isHeld: false })
  expect(throttle(95)).toEqual({ gapFactor: 1, isHeld: true })
  expect(slowedGapMs(60_000, 1)).toBe(60_000)
  expect(slowedGapMs(60_000, 4)).toBe(240_000)
  // "None" as the minimum gap still means four minutes while slowed down.
  expect(slowedGapMs(0, 4)).toBe(240_000)
  expect(slowedGapMs(300_000, 4)).toBe(1_200_000)
})

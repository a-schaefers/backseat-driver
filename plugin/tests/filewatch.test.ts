import { expect, test } from 'claude-code/testing'

import {
  escapeRegex,
  focusWatchArgv,
  ignoredFolders,
  isEstablished,
  lineSplitter,
  MAX_IGNORED,
  nudgeOf,
  nudgesOf,
  treeExclude,
  treeWatchArgv,
  watcherComplaint,
} from '../hooks/filewatch'
import { PUSHED_SCAN_MS } from '../hooks/sensor'
import { DATA_HOME, PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

const PLACES = { root: '/work/my proj', gitDir: '/work/my proj/.git', dataRoot: '/home/me/.local/share/backseat-driver' }

test('the folders git ignores are read from its listing, folders only, and only so many', async () => {
  expect(ignoredFolders('node_modules/\nbuild/\n.env\nsub/target/\n')).toEqual(['node_modules', 'build', 'sub/target'])
  expect(ignoredFolders('')).toEqual([])
  const many = Array.from({ length: MAX_IGNORED + 5 }, (_, n) => `d${n}/`).join('\n')
  expect(ignoredFolders(many).length).toBe(MAX_IGNORED)
})

test('the tree watcher leaves out .git but its logs, and what git ignores', async () => {
  expect(escapeRegex('a.b(1)+[x]')).toBe('a\\.b\\(1\\)\\+\\[x\\]')
  const pattern = new RegExp(treeExclude(PLACES, ['node_modules', 'out.d']))
  for (const path of ['/work/my proj/.git/objects/ab', '/work/my proj/.git/index', '/work/my proj/.git/refs/heads/main', '/work/my proj/node_modules', '/work/my proj/node_modules/x/y.js', '/work/my proj/out.d/a']) {
    expect(pattern.test(path)).toBe(true)
  }
  for (const path of ['/work/my proj/.git', '/work/my proj/.git/logs', '/work/my proj/.git/logs/HEAD', '/work/my proj/src/a.py', '/work/my proj/node_modules2/a', '/work/my proj/outxd/a']) {
    expect(pattern.test(path)).toBe(false)
  }

  const argv = treeWatchArgv(PLACES, ['node_modules'], ['objects', 'refs', 'logs', 'hooks'], false)
  expect(argv.slice(0, 5)).toEqual(['inotifywait', '-m', '-r', '--format', '%w%f'])
  expect(argv).toContain('/work/my proj')
  // What is left out is also kept out of the watch, which the pattern alone does not do.
  expect(argv.filter(arg => arg.startsWith('@'))).toEqual(['@/work/my proj/node_modules', '@/work/my proj/.git/objects', '@/work/my proj/.git/refs', '@/work/my proj/.git/hooks'])

  // A git folder elsewhere (a worktree) has its logs watched beside the tree, when they are there.
  const worktree = { ...PLACES, gitDir: '/repo/.git/worktrees/w' }
  expect(treeWatchArgv(worktree, [], ['logs', 'refs'], true)).toContain('/repo/.git/worktrees/w/logs')
  expect(treeWatchArgv(worktree, [], ['logs', 'refs'], false)).not.toContain('/repo/.git/worktrees/w/logs')
  expect(treeWatchArgv(worktree, [], ['logs', 'refs'], true).filter(arg => arg.startsWith('@'))).toEqual([])

  // Each running editor writes its own report into the editors folder.
  expect(focusWatchArgv(PLACES)).not.toContain('-r')
  expect(focusWatchArgv(PLACES)[focusWatchArgv(PLACES).length - 1]).toBe(`${PLACES.dataRoot}/editors`)
})

test('a reported path is a save, a move of HEAD, a report from an editor, or nothing', async () => {
  expect(nudgeOf('/work/my proj/src/a.py', PLACES)).toEqual({ kind: 'tree', paths: ['src/a.py'] })
  expect(nudgeOf('/work/my proj/.git/logs/HEAD', PLACES)).toEqual({ kind: 'head' })
  expect(nudgeOf('/work/my proj/.git/index', PLACES)).toBeNull()
  expect(nudgeOf(`${PLACES.dataRoot}/view.json`, PLACES)).toBeNull()
  expect(nudgeOf(`${PLACES.dataRoot}/editors/nvim-412.json`, PLACES)).toEqual({ kind: 'focus' })
  expect(nudgeOf(`${PLACES.dataRoot}/editors/.nvim-412.json.tmp`, PLACES)).toBeNull()
  expect(nudgeOf('/elsewhere/a.py', PLACES)).toBeNull()
  // The root's .git file, when the git folder is elsewhere.
  expect(nudgeOf('/work/my proj/.git', { ...PLACES, gitDir: '/repo/.git/worktrees/w' })).toBeNull()

  // A burst is one nudge of each kind, the tree's naming each file once.
  const burst = ['/work/my proj/a.py', '/work/my proj/a.py', '/work/my proj/b.py', '/work/my proj/.git/logs/HEAD', '/work/my proj/.git/logs/refs/heads/main']
  expect(nudgesOf(burst, PLACES)).toEqual([{ kind: 'head' }, { kind: 'tree', paths: ['a.py', 'b.py'] }])
  expect(nudgesOf([], PLACES)).toEqual([])
})

test('output is read in whole lines, whatever pieces it arrives in', async () => {
  const lines = lineSplitter()
  expect(lines('/a/b.p')).toEqual([])
  expect(lines('y\n/a/c.py\n/a/')).toEqual(['/a/b.py', '/a/c.py'])
  expect(lines('d.py\n')).toEqual(['/a/d.py'])
  expect(isEstablished('Setting up watches.  Beware: since -r was given, this may take a while!\nWatches established.\n')).toBe(true)
  expect(isEstablished('Setting up watches.\n')).toBe(false)
  expect(watcherComplaint('Setting up watches.\nFailed to watch /x; upper limit on inotify watches reached!\n')).toBe('Failed to watch /x; upper limit on inotify watches reached!')
})

sessionTest('without a file watcher on PATH, the scan does it all, as before', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await session.clock.advance(2000)

  // inotifywait was looked for, once, and is not there.
  expect(session.spawnedProcesses.filter(argv => argv[0] === 'inotifywait').length).toBe(1)
  const before = session.scans
  await session.clock.advance(10_000)
  expect(session.scans - before).toBeGreaterThan(5)
  await session.clock.advance(10_000)
  expect(session.spawnedProcesses.filter(argv => argv[0] === 'inotifywait').length).toBe(1)
})

sessionTest('with inotifywait, a save is pushed and the scan becomes a safety net', async ($, on) => {
  const session = stubSession(on, { hasInotify: true, ignored: ['node_modules'] })
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'What does this do for an empty list?' }] })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await session.clock.advance(1000)
  await session.clock.settle()

  const [tree, focusFile] = session.watchers
  expect(session.watchers.length).toBe(2)
  expect(tree?.argv).toContain(ROOT)
  expect(tree?.argv).toContain(`@${ROOT}/node_modules`)
  expect(focusFile?.argv[focusFile.argv.length - 1]).toBe(`${DATA_HOME}/editors`)
  // The folder is made before an editor has written, so that it can be watched.
  expect(session.disk.has(`${DATA_HOME}/editors/.keep`)).toBe(true)

  // Nothing happens, and nothing is scanned: the watcher would say.
  const before = session.scans
  await session.clock.advance(PUSHED_SCAN_MS - 2000)
  expect(session.scans).toBe(before)

  session.write('stats.py', 'def mean(xs):\n    return sum(xs) / len(xs)\n')
  tree?.report(`${ROOT}/stats.py`)
  await session.clock.settle()
  await session.clock.advance(1)
  expect(session.scans).toBe(before + 1)

  // The look is due ten seconds after the scan that saw the save, as ever.
  await session.clock.advance(9998)
  expect(session.requests.length).toBe(0)
  await session.clock.advance(2)
  expect(session.requests.length).toBe(1)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'What does this do for an empty list?' })).toBeDefined()
  await ui.unmount()

  // Switched off, the watchers end with it: at once in Claude Code, and in the kit at their next piece of output.
  await $.command.run(typed('bsd', 'off'))
  await session.clock.settle()
  const off = session.scans
  tree?.report(`${ROOT}/stats.py`)
  focusFile?.report(`${DATA_HOME}/editors/nvim-1.json`)
  await session.clock.settle()
  await session.clock.advance(1000)
  expect(tree?.isStopped).toBe(true)
  expect(focusFile?.isStopped).toBe(true)
  expect(session.scans).toBe(off)
})

sessionTest('with inotifywait, a commit is reviewed the moment HEAD moves', async ($, on) => {
  const session = stubSession(on, { hasInotify: true })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await session.clock.advance(1000)
  await session.clock.settle()
  const tree = session.watchers[0]

  session.write('stats.py', 'def mean(xs):\n    return sum(xs) / len(xs)\n')
  session.commit('Add mean')
  tree?.report(`${ROOT}/stats.py`, `${ROOT}/.git/logs/HEAD`, `${ROOT}/.git/logs/refs/heads/main`)
  await session.clock.settle()
  await session.clock.advance(1)
  expect(session.spawned.length).toBe(1)
  expect(session.spawned[0]?.prompt).toMatch('Review this commit.')
})

sessionTest('a watcher that gives up hands the work back to the scan', async ($, on) => {
  const session = stubSession(on, { hasInotify: true })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await session.clock.advance(1000)
  await session.clock.settle()

  session.watchers[0]?.end('Failed to watch /work; upper limit on inotify watches reached!')
  await session.clock.settle()
  const before = session.scans
  await session.clock.advance(10_000)
  expect(session.scans - before).toBeGreaterThan(1)
})

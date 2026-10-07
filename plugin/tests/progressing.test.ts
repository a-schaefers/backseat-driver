import { expect, test } from 'claude-code/testing'

import { NO_PRESSURE } from '../core/health'
import { progressPath, watchedPath } from '../core/datahome'
import { emptyRecord } from '../core/progress'
import { explainUnassessed, forgetWatched, freshProgressState, loadWatched, noteWatched, placeFirst, queueProgress, releaseSkipped, setUpProgress } from '../core/progressing'
import { memoryDisk } from '../core/storage'
import { plainStore } from '../core/store'
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
    latestReviewed: () => '',
    isWaiting: () => false,
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
  expect(w.log.at(-1)).toBe('progress isOn,identity,records,skipped')
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
  expect(w.log).toEqual([...IDENTITY, 'progress isOn,identity,records,skipped'])
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

test('the files the watcher saw change are kept in the project folder, so a restart does not halve a commit\'s weight', async () => {
  // The owner's first evening (2026-10-05): a restart between the saves and the commit, and the commit weighed 0.5.
  const store = plainStore(memoryDisk())
  const w = world({ store: () => store })
  const state = freshProgressState()
  await noteWatched(w.ports, state, ['stats.py', 'README.md'])
  await noteWatched(w.ports, state, ['stats.py'])
  expect(await store.read(watchedPath('/data', '/work'))).toEqual({ v: 1, paths: ['README.md', 'stats.py'], skipped: '' })

  const after = freshProgressState()
  await loadWatched(w.ports, after)
  expect([...after.watchedPaths].sort()).toEqual(['README.md', 'stats.py'])

  await forgetWatched(w.ports, after, ['stats.py', 'never-seen.py'])
  expect(await store.read(watchedPath('/data', '/work'))).toEqual({ v: 1, paths: ['README.md'], skipped: '' })
  // Outside a repository, or without a data folder, nothing is written.
  const nowhere = world({ store: () => store, repoRoot: () => '' })
  await noteWatched(nowhere.ports, freshProgressState(), ['x.py'])
  expect(await store.read(watchedPath('/data', ''))).toBe(null)
})

test('a record placed under the old bar is mended as it is read: its lines counted, and its level withdrawn when they are short, only where its commits are', async () => {
  const thin = {
    ...emptyRecord('python'),
    level: 'beginner' as const,
    isProvisional: true,
    observations: Array.from({ length: 15 }, (_, index) => ({ commit: (['a', 'b', 'c'][index % 3] ?? 'a').repeat(40), project: 'p', at: 1, skill: `s${index}`, verdict: 'shown' as const, level: 'beginner' as const, weight: 1, note: '' })),
    assessed: ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40)],
    linesRead: 0,
  }
  // The commits are here, with 14 lines of Python among them: short of the bar, so the level goes, and the lines are kept.
  const patch = ['diff --git a/stats.py b/stats.py', '--- a/stats.py', '+++ b/stats.py', '@@ -0,0 +1,14 @@', ...Array.from({ length: 14 }, (_, index) => `+x${index} = ${index}`)].join('\n')
  const store = plainStore(memoryDisk())
  await store.update(progressPath('/data', 'python'), () => thin)
  const here = world({ store: () => store, git: async args => ({ exitCode: 0, stdout: args[0] === 'show' ? patch : 'me@example.com' }) })
  const state = freshProgressState()
  await setUpProgress(here.ports, state)
  const mended = state.records.get('python')
  expect(mended?.level).toBe(null)
  expect(mended?.linesRead).toBe(42)
  expect((await store.read(progressPath('/data', 'python')) as { linesRead: number }).linesRead).toBe(42)

  // Opened in another repository, where its commits are not: left as it is, level and all.
  const other = { store: plainStore(memoryDisk()) }
  await other.store.update(progressPath('/data', 'python'), () => thin)
  const elsewhere = world({ store: () => other.store, git: async args => ({ exitCode: args[0] === 'show' ? 128 : 0, stdout: args[0] === 'show' ? '' : 'me@example.com' }) })
  const away = freshProgressState()
  await setUpProgress(elsewhere.ports, away)
  expect(away.records.get('python')?.level).toBe('beginner')
  expect(away.records.get('python')?.linesRead).toBe(0)
})

test('the latest reviewed commit that counted nowhere is judged again, and the tab says why, once', async () => {
  const info = ['a83b842d7f0e6c1b2a3f4e5d6c7b8a9f0e1d2c3b', 'f481c4a0000000000000000000000000000000000', 'me@example.com', 'Adam', 'fail loudly'].join('\0')
  const patch = ['diff --git a/run.sh b/run.sh', '--- a/run.sh', '+++ b/run.sh', '@@ -1,0 +2,2 @@', '+set -e', '+exit 1'].join('\n')
  const git = async (args: readonly string[]) => ({ exitCode: 0, stdout: args.includes('-s') ? info : args[0] === 'show' ? patch : 'me@example.com' })
  const store = plainStore(memoryDisk())
  const w = world({ store: () => store, git, latestReviewed: () => 'a83b842' })
  const state = freshProgressState()
  state.identity = ['me@example.com']
  await explainUnassessed(w.ports, state)
  expect(state.skipped).toBe('Commit a83b842 is too small to say anything about your progress.')
  expect((await store.read(watchedPath('/data', '/work')) as { skipped: string }).skipped).toBe('Commit a83b842 is too small to say anything about your progress.')
  expect(w.log.at(-1)).toBe('progress skipped')
  // Said once: with a reason on record, assessed, or waiting, nothing is judged.
  const before = w.log.length
  await explainUnassessed(w.ports, state)
  await explainUnassessed({ ...w.ports, isWaiting: () => true }, { ...freshProgressState(), identity: ['me@example.com'] })
  const assessed = freshProgressState()
  assessed.records.set('shell', { ...emptyRecord('shell'), assessed: ['a83b842d7f0e6c1b2a3f4e5d6c7b8a9f0e1d2c3b'] })
  await explainUnassessed(w.ports, assessed)
  expect(w.log.length).toBe(before)
})

test('the watched files of the commit the reason on record names are released at switch-on', async () => {
  const store = plainStore(memoryDisk())
  const git = async (args: readonly string[]) => ({ exitCode: 0, stdout: args.includes('--name-only') ? 'stats.py\nREADME.md\n' : 'me@example.com' })
  const w = world({ store: () => store, git })
  const state = freshProgressState()
  await noteWatched(w.ports, state, ['stats.py', 'README.md', 'other.py'])
  state.skipped = 'Commit abc1234 does not count toward your progress: it names a co-author.'
  await releaseSkipped(w.ports, state)
  expect([...state.watchedPaths]).toEqual(['other.py'])
  expect((await store.read(watchedPath('/data', '/work')) as { paths: string[] }).paths).toEqual(['other.py'])
  // No reason on record: nothing is asked of git.
  const quiet = world({ git: async args => { throw new Error(`asked ${args.join(' ')}`) } })
  await releaseSkipped(quiet.ports, freshProgressState())
})

test('a record never placed that keeps the model\'s words for a level is mended as it is read', async () => {
  const store = plainStore(memoryDisk())
  const stale = { ...emptyRecord('python'), report: { why: 'This is your first commit.', next: 'To reach junior, show more.', working: ['forms'], encouragement: 'Keep going.', at: 5 } }
  await store.update(progressPath('/data', 'python'), () => stale)
  const w = world({ store: () => store })
  const state = freshProgressState()
  await setUpProgress(w.ports, state)
  // The model's praise goes with the level too (the ninth ui-truth pass, 2026-10-07).
  expect(state.records.get('python')?.report).toEqual({ why: '', next: '', working: ['forms'], encouragement: '', at: 5 })
  expect((await store.read(progressPath('/data', 'python')) as { report: { why: string; next: string } }).report).toMatchObject({ why: '', next: '' })
})

test('a first placement that counts none of their commits says why the newest did not count', async () => {
  // The owner's first commit in a project was an import of 385 files, and the Growth tab said nothing of it (the eighth ui-truth pass, 2026-10-06).
  const hash = 'c'.repeat(40)
  const info = [hash, 'p'.repeat(40), 'someone@example.com', 'Someone', 'Import the site'].join('\0')
  const git = async (args: readonly string[]) => ({ exitCode: 0, stdout: args[0] === 'log' ? `${hash}\0me@example.com\n` : args.includes('-s') ? info : args[0] === 'show' ? '' : 'me@example.com' })
  const store = plainStore(memoryDisk())
  const w = world({ store: () => store, git })
  const state = freshProgressState()
  await placeFirst(w.ports, state, 1)
  expect(state.skipped).toBe('Commit ccccccc does not count toward your progress: it was written by Someone <someone@example.com>.')
  expect((await store.read(watchedPath('/data', '/work')) as { skipped: string }).skipped).toBe(state.skipped)
})

test('with no review of any commit, HEAD itself is judged and the reason put on record', async () => {
  // The owner's first commit in a project, an import of 385 files, was skipped silently (the ninth ui-truth pass, 2026-10-07).
  const info = ['d'.repeat(40), 'p'.repeat(40), 'me@example.com', 'Adam', 'First commit'].join('\0')
  const git = async (args: readonly string[]) => ({ exitCode: 0, stdout: args[0] === 'rev-parse' ? 'ddddddd\n' : args.includes('-s') ? info : args[0] === 'show' ? '' : 'me@example.com' })
  const store = plainStore(memoryDisk())
  const w = world({ store: () => store, git, latestReviewed: () => '' })
  const state = freshProgressState()
  state.identity = ['me@example.com']
  await explainUnassessed(w.ports, state)
  // Their own, and nothing added: too small to count, said so.
  expect(state.skipped).toBe('Commit ddddddd does not count toward your progress: it adds no source code.')
  // Outside a repository, or with git not answering, nothing is judged.
  const silent = world({ git: async () => ({ exitCode: 128, stdout: '' }), latestReviewed: () => '' })
  const quiet = freshProgressState()
  await explainUnassessed(silent.ports, quiet)
  expect(quiet.skipped).toBe('')
})

test('a commit whose patch the host cut short is skipped as larger than the tutor reads, and its lines are never counted', async () => {
  const info = ['e'.repeat(40), 'p'.repeat(40), 'me@example.com', 'Adam', 'Import the viewer'].join('\0')
  const patch = ['diff --git a/stats.py b/stats.py', '--- a/stats.py', '+++ b/stats.py', '@@ -0,0 +1,2 @@', '+x = 1', '+y = 2'].join('\n')
  const git = async (args: readonly string[]) => (args[0] === 'show' && !args.includes('-s') ? { exitCode: 0, stdout: patch, isCut: true } : { exitCode: 0, stdout: args[0] === 'rev-parse' ? 'eeeeeee\n' : args.includes('-s') ? info : 'me@example.com' })
  const store = plainStore(memoryDisk())
  const w = world({ store: () => store, git, latestReviewed: () => '' })
  const state = freshProgressState()
  state.identity = ['me@example.com']
  await explainUnassessed(w.ports, state)
  expect(state.skipped).toBe('Commit eeeeeee does not count toward your progress: its changes are larger than the tutor reads at once (over 4 MiB), which reads as an import or generated code.')
  // A record whose assessed commit's patch is cut gets no line count, and so no withdrawal, from here.
  const thin = { ...emptyRecord('python'), level: 'beginner' as const, isProvisional: true, assessed: ['e'.repeat(40)], linesRead: 0, observations: [], history: [] }
  await store.update(progressPath('/data', 'python'), () => thin)
  const read = freshProgressState()
  await setUpProgress(w.ports, read)
  expect(read.records.get('python')?.level).toBe('beginner')
  expect(read.records.get('python')?.linesRead).toBe(0)
})

test('a reason on record that counts a cut patch as whole is said again as the floor it is, once', async () => {
  const git = async (args: readonly string[]) => (args[0] === 'show' && !args.includes('-s') ? { exitCode: 0, stdout: '', isCut: true } : { exitCode: 0, stdout: 'me@example.com' })
  const store = plainStore(memoryDisk())
  const w = world({ store: () => store, git })
  const state = freshProgressState()
  state.skipped = 'Commit 570e787 does not count toward your progress: it adds 5400 lines in 16 files at once, which reads as an import or generated code.'
  await explainUnassessed(w.ports, state)
  expect(state.skipped).toBe('Commit 570e787 does not count toward your progress: it adds more than 5400 lines in at least 16 files at once, which reads as an import or generated code.')
  expect((await store.read(watchedPath('/data', '/work')) as { skipped: string }).skipped).toBe(state.skipped)
  // Said as a floor, it is not asked about again; a patch that is whole leaves its reason as it is.
  const before = w.log.length
  await explainUnassessed(w.ports, state)
  expect(w.log.length).toBe(before)
  const whole = world({ git: async args => (args[0] === 'show' && !args.includes('-s') ? { exitCode: 0, stdout: '' } : { exitCode: 0, stdout: 'me@example.com' }) })
  const kept = freshProgressState()
  kept.skipped = 'Commit 570e787 does not count toward your progress: it adds 700 lines in 3 files at once, which reads as an import or generated code.'
  await explainUnassessed(whole.ports, kept)
  expect(kept.skipped).toMatch('it adds 700 lines in 3 files')
  // Said before as "more than … in 16 files": the files were a floor too, and it is said again once.
  const older = freshProgressState()
  older.skipped = 'Commit 570e787 does not count toward your progress: it adds more than 5400 lines in 16 files at once, which reads as an import or generated code.'
  await explainUnassessed(world({ store: () => store, git }).ports, older)
  expect(older.skipped).toBe('Commit 570e787 does not count toward your progress: it adds more than 5400 lines in at least 16 files at once, which reads as an import or generated code.')
})

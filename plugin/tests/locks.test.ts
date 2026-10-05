import { expect, test } from 'claude-code/testing'

import { createLocks, LOCK_TTL_MS, LOCK_WAIT_MS, lockRef } from '../core/locks'
import type { LockPorts } from '../core/locks'

const REPO = '/d/locks.git'

/**
 * A git repository in memory that does what the real one does with refs:
 * `update-ref` changes a ref only while it holds what the caller expects.
 * Any number of sessions share it, each with locks of its own.
 */
function world() {
  const files = new Map<string, { text: string; at: number }>()
  const marks = new Map<string, string>()
  const state = {
    now: 1_000_000,
    isGitGone: false,
    inits: 0,
    slept: 0,
    whenAsleep: (): void => undefined,
    /** Runs right after a try for a lock was refused, before the session looks at who holds it. */
    whenRefused: (_file: string): void => undefined,
  }

  const git: LockPorts['git'] = async (args, stdin) => {
    const failed = { exitCode: 128, stdout: '' }
    if (state.isGitGone) return failed
    if (args[0] === 'init') {
      state.inits += 1
      files.set(`${REPO}/HEAD`, { text: 'ref: refs/heads/main\n', at: state.now })

      return { exitCode: 0, stdout: '' }
    }
    if (args[0] !== `--git-dir=${REPO}` || !files.has(`${REPO}/HEAD`)) return failed
    if (args[1] === 'hash-object') {
      const held = stdin ?? ''
      if (!marks.has(held)) marks.set(held, String(marks.size + 1).padStart(40, 'a'))

      return { exitCode: 0, stdout: `${marks.get(held) ?? ''}\n` }
    }
    const isDelete = args[2] === '-d'
    const [ref, next, expected] = isDelete ? [args[3], '', args[4]] : [args[2], args[3], args[4]]
    const file = `${REPO}/${ref ?? ''}`
    const current = files.get(file)?.text.trim()
    if (/^0+$/.test(expected ?? '') ? current !== undefined : current !== expected) {
      if (!isDelete) state.whenRefused(file)

      return failed
    }
    if (isDelete) files.delete(file)
    else files.set(file, { text: `${next ?? ''}\n`, at: state.now })

    return { exitCode: 0, stdout: '' }
  }

  const session = (owner: string) =>
    createLocks(
      {
        git,
        modifiedAt: async path => files.get(path)?.at ?? null,
        read: async path => files.get(path)?.text ?? null,
        write: async (path, text) => {
          files.set(path, { text, at: state.now })
        },
        now: async () => state.now,
        sleep: async ms => {
          state.slept += ms
          state.now += ms
          state.whenAsleep()
        },
        random: () => 0.5,
        owner: async () => owner,
      },
      REPO,
    )

  return { files, state, session, holder: (name: string) => files.get(`${REPO}/${lockRef(name)}`)?.text.trim() }
}

const FILE = '/d/profiles/python.json'

test('a lock is one flat ref, whatever the file is called', async () => {
  expect(/^refs\/locks\/[0-9a-f]{8}-python\.json$/.test(lockRef(FILE))).toBe(true)
  expect(lockRef(FILE)).toBe(lockRef(FILE))
  expect(lockRef('/d/progress/python.json') === lockRef(FILE)).toBe(false)
  // Names git would refuse for a ref are made safe.
  expect(lockRef('/d/odd/index.lock').endsWith('-index_lock')).toBe(true)
  expect(lockRef('/d/odd/name.').endsWith('-name')).toBe(true)
  expect(lockRef('/d/odd/a b?.json').endsWith('-a_b_.json')).toBe(true)
})

test('the first lock makes the repository, and a lock given back can be taken by another session', async () => {
  const { state, session, holder } = world()
  const one = session('session-one')
  const two = session('session-two')

  const held = await one.acquire(FILE)
  expect(held?.name).toBe(FILE)
  expect(state.inits).toBe(1)
  expect(holder(FILE)).toBe('1'.padStart(40, 'a'))

  await one.release(held ?? { name: '', ref: '' })
  expect(holder(FILE)).toBe(undefined)

  const next = await two.acquire(FILE)
  expect(next?.name).toBe(FILE)
  expect(holder(FILE)).toBe('2'.padStart(40, 'a'))
  // The repository was there already.
  expect(state.inits).toBe(1)
  expect(state.slept).toBe(0)
})

test('while one session holds a lock, another waits for it and then goes without', async () => {
  const { state, session, holder } = world()
  const one = session('session-one')
  const two = session('session-two')
  await one.acquire(FILE)

  const started = state.now
  expect(await two.acquire(FILE)).toBe(null)
  expect(state.now - started >= LOCK_WAIT_MS).toBe(true)
  expect(state.now - started < LOCK_WAIT_MS + 500).toBe(true)
  // It is still the first session's.
  expect(holder(FILE)).toBe('1'.padStart(40, 'a'))
  // A lock on another file is not in the way.
  expect((await two.acquire('/d/progress/python.json'))?.name).toBe('/d/progress/python.json')
})

test('a waiting session takes the lock as soon as it is given back', async () => {
  const { state, session, holder } = world()
  const one = session('session-one')
  const two = session('session-two')
  const held = await one.acquire(FILE)
  // The first session finishes its write while the second is asleep between tries.
  state.whenAsleep = () => {
    if (state.slept > 40 && held !== null) void one.release(held)
  }

  const taken = await two.acquire(FILE)
  expect(taken?.name).toBe(FILE)
  expect(state.slept < 200).toBe(true)
  expect(holder(FILE)).toBe('2'.padStart(40, 'a'))
})

test('a lock given back in the moment after a refused try is tried for again at once', async () => {
  const { files, state, session, holder } = world()
  await session('session-one').acquire(FILE)
  // The first session gives its lock back right after the second was refused it.
  state.whenRefused = file => {
    files.delete(file)
    state.whenRefused = () => undefined
  }

  const taken = await session('session-two').acquire(FILE)
  expect(taken?.name).toBe(FILE)
  expect(holder(FILE)).toBe('2'.padStart(40, 'a'))
  // No waiting, and the repository was not taken for broken and made again.
  expect(state.slept).toBe(0)
  expect(state.inits).toBe(1)
})

test('a lock left by a session that is gone is taken over, and its late release changes nothing', async () => {
  const { state, session, holder } = world()
  const gone = session('session-gone')
  const two = session('session-two')
  const left = await gone.acquire(FILE)

  // Not yet old enough: it is respected.
  state.now += LOCK_TTL_MS - LOCK_WAIT_MS - 1000
  expect(await two.acquire(FILE)).toBe(null)

  state.now += LOCK_WAIT_MS + 2000
  const taken = await two.acquire(FILE)
  expect(taken?.name).toBe(FILE)
  expect(holder(FILE)).toBe('2'.padStart(40, 'a'))

  // The session that was thought gone wakes up and gives its lock back: it is no longer its to give.
  await gone.release(left ?? { name: '', ref: '' })
  expect(holder(FILE)).toBe('2'.padStart(40, 'a'))
})

test('of two sessions that find a stale lock, one takes it over', async () => {
  const { state, session } = world()
  await session('session-gone').acquire(FILE)
  state.now += LOCK_TTL_MS + 1

  const won = await session('session-two').acquire(FILE, 0)
  const lost = await session('session-three').acquire(FILE, 0)
  expect(won?.name).toBe(FILE)
  expect(lost).toBe(null)
})

test('a lock this session left behind before a reload is its own to take', async () => {
  const { state, session, holder } = world()
  await session('session-one').acquire(FILE)

  // The mod reloaded: a new set of locks, the same session.
  const reloaded = session('session-one')
  const taken = await reloaded.acquire(FILE)
  expect(taken?.name).toBe(FILE)
  expect(state.slept).toBe(0)
  await reloaded.release(taken ?? { name: '', ref: '' })
  expect(holder(FILE)).toBe(undefined)
})

test('a lock file git cannot read is respected while it is new, and written afresh once it is old', async () => {
  const { files, state, session, holder } = world()
  const one = session('session-one')
  const held = await one.acquire(FILE)
  await one.release(held ?? { name: '', ref: '' })
  // Something other than git left the file empty.
  files.set(`${REPO}/${lockRef(FILE)}`, { text: '', at: state.now })

  expect(await one.acquire(FILE)).toBe(null)
  state.now += LOCK_TTL_MS
  const taken = await one.acquire(FILE)
  expect(taken?.name).toBe(FILE)
  expect(holder(FILE)).toBe('1'.padStart(40, 'a'))
  await one.release(taken ?? { name: '', ref: '' })
  expect(holder(FILE)).toBe(undefined)
})

test('without git there is no lock, and no waiting for one', async () => {
  const { state, session } = world()
  state.isGitGone = true
  expect(await session('session-one').acquire(FILE)).toBe(null)
  expect(state.slept).toBe(0)
})

test('a repository that was deleted is made again', async () => {
  const { files, state, session, holder } = world()
  const one = session('session-one')
  const held = await one.acquire(FILE)
  await one.release(held ?? { name: '', ref: '' })

  // Forgetting everything deletes the lock repository with the rest.
  files.clear()
  expect((await one.acquire(FILE))?.name).toBe(FILE)
  expect(state.inits).toBe(2)
  expect(holder(FILE) !== undefined).toBe(true)
})

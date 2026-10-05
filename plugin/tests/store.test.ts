import { expect, test } from 'claude-code/testing'

import type { Lock } from '../core/locks'
import { memoryDisk } from '../core/storage'
import { backupPath, brokenPath, createStore, plainStore, READ_RETRY_MS, toText, updateJson, WRITE_TRIES } from '../core/store'

const FILE = '/d/profiles/python.json'

type Counter = { count: number; hushed?: string[] }
const counter = (stored: unknown): Counter => (typeof stored === 'object' && stored !== null ? (stored as Counter) : { count: 0 })

/**
 * A disk in memory that another session can reach too: `beforeRead` and
 * `beforeWrite` run right before this session's read or write of a file, and
 * may change it, the way the other session's writes fall between this one's.
 */
function world(options: { hasLocks?: boolean } = {}) {
  const disk = memoryDisk()
  const state = {
    reads: 0,
    writes: [] as string[],
    slept: [] as number[],
    notes: [] as string[],
    locking: [] as string[],
    isLockHeldElsewhere: false,
    beforeRead: (_path: string, _count: number): void => undefined,
    beforeWrite: (_path: string, _count: number): void => undefined,
  }
  const store = createStore({
    disk: {
      ...disk,
      read: async path => {
        state.reads += 1
        state.beforeRead(path, state.reads)

        return disk.read(path)
      },
      write: async (path, text) => {
        state.beforeWrite(path, state.writes.length + 1)
        state.writes.push(path)
        await disk.write(path, text)
      },
    },
    locks:
      options.hasLocks === true
        ? {
            acquire: async (name): Promise<Lock | null> => {
              if (state.isLockHeldElsewhere) return null
              state.locking.push(`take ${name}`)

              return { name, ref: name }
            },
            release: async lock => {
              state.locking.push(`give ${lock.name}`)
            },
          }
        : null,
    sleep: async ms => {
      state.slept.push(ms)
    },
    note: what => {
      state.notes.push(what)
    },
  })

  return { disk, state, store, text: (path: string) => disk.files.get(path) }
}

test('reading: nothing there is null, and what is there is what it holds', async () => {
  const { disk, store } = world()
  expect(await store.read(FILE)).toBe(null)
  disk.files.set(FILE, '{"count": 3}')
  expect(await store.read(FILE)).toEqual({ count: 3 })
})

test('a file caught empty while another session writes it is read again, not taken for nothing', async () => {
  const { disk, state, store } = world()
  disk.files.set(FILE, '')
  // The other session finishes its write between this session's first read and its second.
  state.beforeRead = (path, count) => {
    if (count === 2) disk.files.set(path, '{"count": 7}')
  }
  expect(await store.read(FILE)).toEqual({ count: 7 })
  expect(state.slept).toEqual([READ_RETRY_MS])
  expect(state.notes).toEqual([])
})

test('a change is never made on top of a half-written file', async () => {
  const { disk, state, store } = world()
  disk.files.set(FILE, '{"count": 41, "hushed": ["glob')
  state.beforeRead = (path, count) => {
    if (count === 2) disk.files.set(path, '{"count": 41, "hushed": ["globals"]}')
  }
  const written = await updateJson(store, FILE, counter, current => ({ ...current, count: current.count + 1 }))
  // The other session's hush is still there: the change was made on what it wrote, not on nothing.
  expect(written).toEqual({ count: 42, hushed: ['globals'] })
  expect(JSON.parse(disk.files.get(FILE) ?? '')).toEqual({ count: 42, hushed: ['globals'] })
})

test('a file that stays broken is kept aside and the backup is used', async () => {
  const { disk, state, store, text } = world()
  disk.files.set(FILE, '{"count": 41, "hus')
  disk.files.set(backupPath(FILE), '{"count": 40}')

  expect(await store.read(FILE)).toEqual({ count: 40 })
  expect(text(brokenPath(FILE))).toBe('{"count": 41, "hus')
  expect(state.notes).toEqual(['a file is broken', 'a file was restored from its backup'])

  // The next change is made on the backup, and repairs the file. The broken text is not kept as the new backup.
  await updateJson(store, FILE, counter, current => ({ count: current.count + 1 }), { keepBackup: true })
  expect(JSON.parse(text(FILE) ?? '')).toEqual({ count: 41 })
  expect(text(backupPath(FILE))).toBe('{"count": 40}')
})

test('a broken file with no backup starts again, and is still kept aside', async () => {
  const { disk, store, text } = world()
  disk.files.set(FILE, 'not json at all')
  expect(await store.read(FILE)).toBe(null)
  expect(text(brokenPath(FILE))).toBe('not json at all')
})

test('a change writes the file, says what it wrote, and writes nothing when nothing changed', async () => {
  const { state, store, text } = world()
  expect(await store.update(FILE, () => ({ count: 1 }))).toEqual({ count: 1 })
  expect(text(FILE)).toBe(toText({ count: 1 }))
  expect(text(FILE)).toBe('{\n "count": 1\n}\n')
  expect(state.writes).toEqual([FILE])

  await store.update(FILE, stored => stored)
  expect(state.writes).toEqual([FILE])
})

test('the file as it was is kept as a backup when asked', async () => {
  const { store, text } = world()
  await store.update(FILE, () => ({ count: 1 }), { keepBackup: true })
  // There was nothing before the first write, so there is nothing to keep.
  expect(text(backupPath(FILE))).toBe(undefined)

  await store.update(FILE, () => ({ count: 2 }), { keepBackup: true })
  expect(text(backupPath(FILE))).toBe(toText({ count: 1 }))
  expect(text(FILE)).toBe(toText({ count: 2 }))

  await store.update(FILE, () => ({ count: 3 }))
  expect(text(backupPath(FILE))).toBe(toText({ count: 1 }))
})

test('changes to one file from this session are made one after another', async () => {
  const { store, text } = world()
  const bump = (stored: unknown): Counter => ({ count: counter(stored).count + 1 })
  // Started together, as two answers landing at once do.
  await Promise.all([store.update(FILE, bump), store.update(FILE, bump), store.update(FILE, bump), store.update('/d/other.json', bump)])
  expect(JSON.parse(text(FILE) ?? '')).toEqual({ count: 3 })
  expect(JSON.parse(text('/d/other.json') ?? '')).toEqual({ count: 1 })
})

test('a change that throws leaves the file alone, and the next change still runs', async () => {
  const { store, text } = world()
  await store.update(FILE, () => ({ count: 1 }))
  let message = ''
  await store
    .update(FILE, () => {
      throw new Error('no')
    })
    .catch((error: unknown) => {
      message = String(error)
    })
  expect(message).toBe('Error: no')
  await store.update(FILE, stored => ({ count: counter(stored).count + 1 }))
  expect(JSON.parse(text(FILE) ?? '')).toEqual({ count: 2 })
})

test('a change holds the lock from before it reads until after it has checked its write', async () => {
  const { state, store } = world({ hasLocks: true })
  state.beforeRead = () => state.locking.push('read')
  state.beforeWrite = () => state.locking.push('write')
  await store.update(FILE, () => ({ count: 1 }))
  expect(state.locking).toEqual([`take ${FILE}`, 'read', 'write', 'read', `give ${FILE}`])

  // The lock is given back when the change throws, and when the disk refuses the write.
  state.locking = []
  await store
    .update(FILE, () => {
      throw new Error('no')
    })
    .catch(() => undefined)
  expect(state.locking).toEqual([`take ${FILE}`, 'read', `give ${FILE}`])
})

test("without the lock, another session's write between the read and the write is noticed", async () => {
  const { disk, state, store, text } = world({ hasLocks: true })
  state.isLockHeldElsewhere = true
  disk.files.set(FILE, toText({ count: 1 }))
  // Reads: 1 the file, 2 the check before writing. The other session writes between them.
  state.beforeRead = (path, count) => {
    if (count === 2) disk.files.set(path, toText({ count: 10 }))
  }
  await updateJson(store, FILE, counter, current => ({ count: current.count + 1 }))
  expect(JSON.parse(text(FILE) ?? '')).toEqual({ count: 11 })
  expect(state.notes).toEqual(['a file is changed without its lock', 'a file changed while it was being changed'])
})

test("another session's write right after this one's is found by reading back, and the change is made again", async () => {
  const { disk, state, store, text } = world()
  disk.files.set(FILE, toText({ count: 1 }))
  // Reads: 1 the file, 2 the check before writing, 3 the read back. The other session writes over this one's write.
  state.beforeRead = (path, count) => {
    if (count === 3) disk.files.set(path, toText({ count: 10 }))
  }
  await updateJson(store, FILE, counter, current => ({ count: current.count + 1 }))
  expect(JSON.parse(text(FILE) ?? '')).toEqual({ count: 11 })
  expect(state.notes).toEqual(['another session wrote the file at the same moment'])
})

test('a change that keeps being written over is given up on, and says so', async () => {
  const { disk, state, store } = world({ hasLocks: true })
  disk.files.set(FILE, toText({ count: 1 }))
  // Somebody writes over every write this session makes.
  let theirs = 100
  state.beforeRead = (path, count) => {
    if (count % 2 === 0) {
      theirs += 1
      disk.files.set(path, toText({ count: theirs, hushed: ['theirs'] }))
    }
  }
  await store.update(FILE, stored => ({ count: counter(stored).count + 1 }))
  expect(state.writes.length).toBe(WRITE_TRIES)
  expect(state.notes.filter(note => note === 'another session wrote the file at the same moment').length).toBe(WRITE_TRIES - 1)
  expect(state.notes[state.notes.length - 1]).toBe('a change could not be confirmed')
})

test('a disk that refuses the write fails the change and nothing else', async () => {
  const disk = memoryDisk()
  let isFull = true
  const store = createStore({
    disk: {
      ...disk,
      write: async (path, text) => {
        if (isFull) throw new Error('disk full')
        await disk.write(path, text)
      },
    },
    locks: null,
    sleep: async () => undefined,
    note: () => undefined,
  })
  let message = ''
  await store.update(FILE, () => ({ count: 1 })).catch((error: unknown) => {
    message = String(error)
  })
  expect(message).toBe('Error: disk full')
  isFull = false
  expect(await store.update(FILE, () => ({ count: 2 }))).toEqual({ count: 2 })
})

test('a plain store does the same with no locks', async () => {
  const disk = memoryDisk()
  const store = plainStore(disk)
  expect(await updateJson(store, FILE, counter, current => ({ count: current.count + 5 }))).toEqual({ count: 5 })
  expect(await store.read(FILE)).toEqual({ count: 5 })
})

import { expect, test } from 'claude-code/testing'

import {
  CHUNK_CHARS,
  chunkIndex,
  chunkName,
  createDebugLog,
  createRing,
  createTracer,
  MAX_CHUNKS,
  MAX_STRING_CHARS,
  parseDebugRequest,
  parseSwitch,
  sessionFolder,
  toLine,
} from '../core/debuglog'
import type { DebugRecord } from '../core/debuglog'

/** A folder in memory, with the writes made to it in order. */
function folder(files: Map<string, string> = new Map()) {
  const writes: string[] = []

  return {
    files,
    writes,
    ports: {
      write: async (path: string, text: string) => {
        writes.push(path)
        files.set(path, text)
      },
      list: async (path: string) => [...files.keys()].filter(known => known.startsWith(`${path}/`)).map(known => known.slice(path.length + 1)),
    },
  }
}

const record = (seq: number, d?: unknown): DebugRecord => ({ t: 1000 + seq, seq, s: 'abcd1234', p: 'ride-1a2b3c4d', k: 'git', n: 'status', ...(d === undefined ? {} : { d }) })

const lines = (text: string | undefined): DebugRecord[] =>
  (text ?? '')
    .split('\n')
    .filter(line => line !== '')
    .map(line => JSON.parse(line) as DebugRecord)

test('chunk names sort in order and anything else in the folder is not a chunk', async () => {
  expect(chunkName(0)).toBe('000000.jsonl')
  expect(chunkName(42)).toBe('000042.jsonl')
  expect(chunkIndex('000042.jsonl')).toBe(42)
  expect(chunkIndex('state.json')).toBe(null)
  expect(chunkIndex('42.jsonl')).toBe(null)
})

test('a session keeps its folder, and a new one is named by the time and the start of its id', async () => {
  const at = Date.UTC(2026, 9, 4, 17, 3, 31)
  expect(sessionFolder([], at, '85000c72-9c95-47b7-8903-fddcb87e1b3f')).toBe('20261004-170331-85000c72')
  // The same session after a reload of the mod, hours later: the folder it already has.
  expect(sessionFolder(['20261004-170331-85000c72', '20261004-180000-ffffffff'], at + 7_200_000, '85000c72-9c95-47b7-8903-fddcb87e1b3f')).toBe(
    '20261004-170331-85000c72',
  )
  expect(sessionFolder(['20261004-170331-85000c72'], at, 'b8198550-ddfa')).toBe('20261004-170331-b8198550')
})

test('only an explicit on switches the log on', async () => {
  expect(parseSwitch({ on: true, since: 5 })).toBe(true)
  expect(parseSwitch({ on: false })).toBe(false)
  expect(parseSwitch({ on: 'yes' })).toBe(false)
  expect(parseSwitch(null)).toBe(false)
  expect(parseSwitch('on')).toBe(false)
})

test('a record is one line of JSON, whatever it holds', async () => {
  const plain = toLine(record(1, { args: ['status'], exitCode: 0 }))
  expect(plain.endsWith('\n')).toBe(true)
  expect(plain.trimEnd().includes('\n')).toBe(false)
  expect(JSON.parse(plain)).toEqual(record(1, { args: ['status'], exitCode: 0 }))

  // Newlines inside a prompt stay inside the line.
  expect(toLine(record(2, { prompt: 'one\ntwo' })).trimEnd().includes('\n')).toBe(false)

  // A huge string is cut, and says how long it was.
  const cut = JSON.parse(toLine(record(3, { prompt: 'x'.repeat(MAX_STRING_CHARS + 50) }))) as { d: { prompt: string } }
  expect(cut.d.prompt.length < MAX_STRING_CHARS + 60).toBe(true)
  expect(cut.d.prompt.includes(`${MAX_STRING_CHARS + 50} characters in all`)).toBe(true)

  // An error keeps its message, a map its entries, and a cycle does not throw.
  const error = JSON.parse(toLine(record(4, { error: new Error('boom'), seen: new Map([['a', 1]]), set: new Set([1, 2]) }))) as {
    d: { error: { message: string }; seen: Record<string, number>; set: number[] }
  }
  expect(error.d.error.message).toBe('boom')
  expect(error.d.seen).toEqual({ a: 1 })
  expect(error.d.set).toEqual([1, 2])
  const loop: Record<string, unknown> = {}
  loop.self = loop
  const looped = JSON.parse(toLine(record(5, loop))) as { seq: number; d: string }
  expect(looped.seq).toBe(5)
  expect(looped.d.includes('could not be written')).toBe(true)
})

test('the ring keeps the latest records and lets the oldest go', async () => {
  const ring = createRing(3)
  for (let seq = 1; seq <= 5; seq += 1) ring.push({ t: seq, seq, k: 'cmd', n: 'on' })
  expect(ring.entries().map(entry => entry.seq)).toEqual([3, 4, 5])
})

test('the log writes what it holds in one go, and writes the chunk again as it grows', async () => {
  const disk = folder()
  const log = createDebugLog(disk.ports, '/data/debug/s1')
  await log.open()
  log.add(record(1))
  log.add(record(2))
  expect(log.hasHeld()).toBe(true)
  expect(disk.writes).toEqual([])

  await log.flush()
  expect(disk.writes).toEqual(['/data/debug/s1/000000.jsonl'])
  expect(lines(disk.files.get('/data/debug/s1/000000.jsonl')).map(line => line.seq)).toEqual([1, 2])
  expect(log.hasHeld()).toBe(false)

  // Nothing new: nothing is written.
  await log.flush()
  expect(disk.writes.length).toBe(1)

  log.add(record(3))
  await log.flush()
  expect(lines(disk.files.get('/data/debug/s1/000000.jsonl')).map(line => line.seq)).toEqual([1, 2, 3])
  expect(log.current()).toBe('/data/debug/s1/000000.jsonl')
})

test('a full chunk is closed and the next record starts a new one', async () => {
  const disk = folder()
  const log = createDebugLog(disk.ports, '/d')
  await log.open()
  log.add(record(1, { text: 'x'.repeat(CHUNK_CHARS) }))
  await log.flush()
  expect(log.current()).toBe('/d/000001.jsonl')
  log.add(record(2))
  await log.flush()
  expect(lines(disk.files.get('/d/000000.jsonl')).map(line => line.seq)).toEqual([1])
  expect(lines(disk.files.get('/d/000001.jsonl')).map(line => line.seq)).toEqual([2])
})

test('after a reload the log carries on in a new chunk and leaves the old ones alone', async () => {
  const disk = folder(new Map([['/d/000000.jsonl', 'old\n'], ['/d/000001.jsonl', 'older\n'], ['/d/state.json', '{}']]))
  const log = createDebugLog(disk.ports, '/d')
  await log.open()
  log.add(record(1))
  await log.flush()
  expect(disk.files.get('/d/000001.jsonl')).toBe('older\n')
  expect(lines(disk.files.get('/d/000002.jsonl')).map(line => line.seq)).toEqual([1])
})

test('a session keeps a bounded number of chunks: the oldest is emptied', async () => {
  const disk = folder()
  const log = createDebugLog(disk.ports, '/d')
  await log.open()
  const big = 'x'.repeat(CHUNK_CHARS)
  for (let seq = 0; seq <= MAX_CHUNKS; seq += 1) {
    log.add(record(seq, { text: big }))
    await log.flush()
  }
  expect(disk.files.get('/d/000000.jsonl')).toBe('')
  expect(disk.files.get('/d/000001.jsonl')).toBe('')
  expect((disk.files.get('/d/000002.jsonl') ?? '').length > CHUNK_CHARS).toBe(true)
  expect([...disk.files.keys()].filter(path => disk.files.get(path) !== '').length).toBe(MAX_CHUNKS - 1)
})

test('a disk that refuses a write does not take anything down, and the chunk is written whole the next time', async () => {
  const disk = folder()
  let isBroken = true
  const log = createDebugLog(
    {
      ...disk.ports,
      write: async (path, text) => {
        if (isBroken) throw new Error('disk full')
        await disk.ports.write(path, text)
      },
    },
    '/d',
  )
  await log.open()
  log.add(record(1))
  await log.flush()
  expect(disk.files.size).toBe(0)

  isBroken = false
  log.add(record(2))
  await log.flush()
  expect(lines(disk.files.get('/d/000000.jsonl')).map(line => line.seq)).toEqual([1, 2])
})

test('nothing is written before the log is opened', async () => {
  const disk = folder()
  const log = createDebugLog(disk.ports, '/d')
  log.add(record(1))
  await log.flush()
  expect(disk.writes).toEqual([])
  await log.open()
  await log.flush()
  expect(lines(disk.files.get('/d/000000.jsonl')).map(line => line.seq)).toEqual([1])
})

test('the tracer always keeps the latest records, and works out details only while a log is attached', async () => {
  let now = 5000
  const tracer = createTracer(() => now)
  let worked = 0
  const detail = () => {
    worked += 1

    return { files: ['a.py'] }
  }

  tracer.note('watch', 'saved', detail)
  expect(worked).toBe(0)
  expect(tracer.isOn()).toBe(false)
  expect(tracer.ring()).toEqual([{ t: 5000, seq: 1, k: 'watch', n: 'saved' }])

  const disk = folder()
  const log = createDebugLog(disk.ports, '/d')
  await log.open()
  tracer.attach(log, '85000c72-9c95-47b7-8903-fddcb87e1b3f')
  tracer.inProject('ride-1a2b3c4d')
  now = 6000
  tracer.note('watch', 'saved', detail, 12)
  tracer.note('cmd', 'status')
  tracer.note('git', 'status', () => {
    throw new Error('no')
  })
  expect(worked).toBe(1)
  await log.flush()
  const written = lines(disk.files.get('/d/000000.jsonl'))
  expect(written[0]).toEqual({ t: 6000, seq: 2, s: '85000c72', p: 'ride-1a2b3c4d', k: 'watch', n: 'saved', ms: 12, d: { files: ['a.py'] } })
  expect(written[1]).toEqual({ t: 6000, seq: 3, s: '85000c72', p: 'ride-1a2b3c4d', k: 'cmd', n: 'status' })
  expect(String(written[2]?.d).includes('the detail threw')).toBe(true)
  expect(tracer.ring().map(entry => entry.seq)).toEqual([1, 2, 3, 4])

  expect(tracer.detach()).toBe(log)
  tracer.note('watch', 'saved', detail)
  expect(worked).toBe(1)
  expect(tracer.isOn()).toBe(false)
})

test('what /backseat debug is asked', async () => {
  expect(parseDebugRequest('')).toBe('status')
  expect(parseDebugRequest(' ON ')).toBe('on')
  expect(parseDebugRequest('off')).toBe('off')
  expect(parseDebugRequest('dump')).toBe('dump')
  expect(parseDebugRequest('clear')).toBe('clear')
  expect(parseDebugRequest('verbose')).toBe(null)
})

test('a chunk opened by a reload empties the one that falls out of the ring, as a chunk that fills does', async () => {
  const written = new Map<string, string>()
  const log = createDebugLog(
    {
      list: async () => Array.from({ length: MAX_CHUNKS }, (_, index) => chunkName(index)),
      write: async (path: string, text: string) => void written.set(path, text),
    },
    '/d/debug/s',
  )
  await log.open()
  expect(written.get(`/d/debug/s/${chunkName(0)}`)).toBe('')
  expect(written.size).toBe(1)
})

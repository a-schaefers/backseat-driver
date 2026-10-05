import { expect, test } from 'claude-code/testing'

import type { Mode } from '../types'
import { carryOn, checkBound, checkSelf, freshCarryState, sayLeft, sayOff, sayOn } from '../core/carrying'
import type { CarryPorts } from '../core/carrying'
import { sessionsPath } from '../core/datahome'
import { HANDOFF_MS, parseSessions, RECHECK_MS, SAY_EVERY_MS, SELF_CHECK_MS } from '../core/sessions'
import type { SessionBook } from '../core/sessions'
import { plainStore } from '../core/store'
import { memoryDisk } from '../core/storage'

/** Carrying the tutor from one process of a conversation to the next is host-neutral: it runs here with nothing but ports. */
function world(overrides: Partial<CarryPorts> = {}) {
  const log: string[] = []
  const disk = memoryDisk()
  const store = plainStore(disk)
  const state = { now: 10_000, mode: 'off' as Mode, surfaces: 1, id: 'me', born: 500 }
  const due = new Map<string, { at: number; run: () => Promise<unknown> | unknown }>()
  const ports: CarryPorts = {
    now: async () => state.now,
    trace: () => undefined,
    fail: (what, error) => void log.push(`fail: ${what}: ${String(error)}`),
    dataRoot: () => '/data',
    mode: () => state.mode,
    sessionId: async () => state.id,
    born: async () => state.born,
    cwd: async () => '/work',
    surfaces: async () => state.surfaces,
    store: () => store,
    deadline: { set: (name, at, run) => void due.set(name, { at, run }) },
    comeUp: async (mode, from) => {
      state.mode = mode
      log.push(`come up ${mode} from ${from}`)
    },
    standDown: async () => {
      state.mode = 'off'
      log.push('stand down')
    },
    ...overrides,
  }
  const book = async (): Promise<SessionBook> => parseSessions(await store.read(sessionsPath('/data')))
  const seed = (sessions: SessionBook['sessions']) => store.update(sessionsPath('/data'), () => ({ v: 1, sessions }))

  return { ports, log, state, due, book, seed }
}

const parent = { session: 'parent', born: 500, cwd: '/work', mode: 'on' as const, at: 9000, leftAt: 0 }

test('a process that continues a conversation with the tutor on comes up as it was, and any other starts off', async () => {
  const w = world()
  await w.seed([parent])
  expect(await carryOn(w.ports, freshCarryState())).toBe(true)
  expect(w.log).toEqual(['come up on from parent'])

  const paused = world()
  await paused.seed([{ ...parent, mode: 'paused' }])
  expect(await carryOn(paused.ports, freshCarryState())).toBe(true)
  expect(paused.log).toEqual(['come up paused from parent'])

  // Another conversation, nothing on record, no data folder, or a tutor that is already on here: nothing comes up.
  const other = world()
  other.state.born = 501
  await other.seed([parent])
  expect(await carryOn(other.ports, freshCarryState())).toBe(false)
  expect(await carryOn(world().ports, freshCarryState())).toBe(false)
  const homeless = world({ dataRoot: () => '' })
  expect(await carryOn(homeless.ports, freshCarryState())).toBe(false)
  const already = world()
  await already.seed([parent])
  already.state.mode = 'on'
  expect(await carryOn(already.ports, freshCarryState())).toBe(false)
  expect([...other.log, ...homeless.log, ...already.log]).toEqual([])
})

test('the session that carries on takes the place of the one it left: switched off, nothing is left to carry on from', async () => {
  const w = world()
  await w.seed([parent])
  const state = freshCarryState()
  expect(await carryOn(w.ports, state)).toBe(true)
  // It comes up, and says so: the entry of the session it left goes with that.
  await sayOn(w.ports, state, true)
  expect((await w.book()).sessions.map(one => one.session)).toEqual(['me'])

  await sayOff(w.ports, state)
  expect((await w.book()).sessions).toEqual([])
  w.state.mode = 'off'
  w.log.length = 0
  expect(await carryOn(w.ports, freshCarryState())).toBe(false)
  expect(w.log).toEqual([])
})

test('a session whose process ended more than a minute ago is not carried on from', async () => {
  const w = world()
  w.state.now = 500_000
  await w.seed([{ ...parent, leftAt: w.state.now - HANDOFF_MS }])
  expect(await carryOn(w.ports, freshCarryState())).toBe(true)

  const late = world()
  late.state.now = 500_000
  await late.seed([{ ...parent, leftAt: late.state.now - HANDOFF_MS - 1 }])
  expect(await carryOn(late.ports, freshCarryState())).toBe(false)
})

test('a session says that the tutor is on when that changes, and again only every five minutes', async () => {
  const w = world()
  const state = freshCarryState()
  await sayOn(w.ports, state, true)
  expect((await w.book()).sessions).toEqual([])

  w.state.mode = 'on'
  await sayOn(w.ports, state, true)
  expect((await w.book()).sessions).toEqual([{ session: 'me', born: 500, cwd: '/work', mode: 'on', at: 10_000, leftAt: 0 }])

  // Not due yet: nothing is written.
  w.state.now += SAY_EVERY_MS - 1
  await sayOn(w.ports, state, false)
  expect((await w.book()).sessions[0]?.at).toBe(10_000)
  w.state.now += 1
  await sayOn(w.ports, state, false)
  expect((await w.book()).sessions[0]?.at).toBe(10_000 + SAY_EVERY_MS)

  // Paused: said at once, whenever it was last said.
  w.state.mode = 'paused'
  await sayOn(w.ports, state, true)
  expect((await w.book()).sessions[0]?.mode).toBe('paused')
})

test('after /clear the session goes by another id, and what it said under the old one is taken back', async () => {
  const w = world()
  const state = freshCarryState()
  w.state.mode = 'on'
  await sayOn(w.ports, state, true)
  w.state.id = 'me-again'
  w.state.born = 777
  await sayOn(w.ports, state, true)
  expect((await w.book()).sessions).toEqual([{ session: 'me-again', born: 777, cwd: '/work', mode: 'on', at: 10_000, leftAt: 0 }])
})

test('a goodbye marks the session as gone, and switching off takes back what it said', async () => {
  const w = world()
  const state = freshCarryState()
  // Nothing was said: there is nothing to mark or take back.
  await sayLeft(w.ports, state)
  await sayOff(w.ports, state)
  expect((await w.book()).sessions).toEqual([])

  w.state.mode = 'on'
  await sayOn(w.ports, state, true)
  w.state.now += 500
  await sayLeft(w.ports, state)
  expect((await w.book()).sessions[0]?.leftAt).toBe(10_500)

  await sayOff(w.ports, state)
  expect((await w.book()).sessions).toEqual([])
  expect(state.saidAs).toBe('')
})

test('a terminal session that draws nowhere looks again, and lays the tutor down when it still draws nowhere', async () => {
  const w = world()
  const state = { ...freshCarryState(), isTerminal: true }
  w.state.mode = 'on'
  await sayOn(w.ports, state, true)

  expect(await checkBound(w.ports, state)).toBe(true)
  expect(w.due.size).toBe(0)

  w.state.surfaces = 0
  expect(await checkBound(w.ports, state)).toBe(true)
  expect(w.due.get('bound')?.at).toBe(10_000 + RECHECK_MS)
  expect(w.log).toEqual([])

  // It drew again in between: nothing happened.
  w.state.surfaces = 1
  expect(await checkBound(w.ports, state)).toBe(true)
  w.state.surfaces = 0
  expect(await checkBound(w.ports, state)).toBe(true)
  expect(w.log).toEqual([])

  expect(await checkBound(w.ports, state)).toBe(false)
  expect(w.log).toEqual(['stand down'])
  // It said goodbye, so that the process its conversation went to carries on.
  expect((await w.book()).sessions[0]?.leftAt).toBe(10_000)
})

test('a session a host runs headless is never taken to be gone, and one whose surfaces cannot be asked carries on', async () => {
  const headless = world()
  headless.state.mode = 'on'
  headless.state.surfaces = 0
  const state = freshCarryState()
  expect(await checkBound(headless.ports, state)).toBe(true)
  expect(await checkBound(headless.ports, state)).toBe(true)
  expect(headless.log).toEqual([])

  const mute = world({
    surfaces: async () => {
      throw new Error('no session is bound')
    },
  })
  mute.state.mode = 'on'
  expect(await checkBound(mute.ports, { ...freshCarryState(), isTerminal: true })).toBe(true)
  expect(mute.log).toEqual([])
})

test('the look a session takes at itself plans the next one, until the tutor is off or laid down', async () => {
  const w = world()
  const state = { ...freshCarryState(), isTerminal: true }
  let also = 0
  const more = async (): Promise<void> => void (also += 1)

  // Off: nothing is looked at, and nothing is planned.
  await checkSelf(w.ports, state, more)
  expect(w.due.size).toBe(0)

  w.state.mode = 'on'
  await checkSelf(w.ports, state, more)
  expect(also).toBe(1)
  expect(w.due.get('self')?.at).toBe(10_000 + SELF_CHECK_MS)
  // The first look says that the tutor is on here.
  expect((await w.book()).sessions.map(one => one.session)).toEqual(['me'])

  // The host's share of the look failing does not end the looks.
  w.due.clear()
  await checkSelf(w.ports, state, async () => {
    throw new Error('no such file')
  })
  expect(w.log).toEqual(['fail: could not finish the look at itself: Error: no such file'])
  expect(w.due.has('self')).toBe(true)
  w.log.length = 0

  // Nowhere to draw, twice: laid down, and no further look is planned.
  w.state.surfaces = 0
  w.due.clear()
  await checkSelf(w.ports, state, more)
  expect([...w.due.keys()].sort()).toEqual(['bound', 'self'])
  w.due.clear()
  await checkSelf(w.ports, state, more)
  expect(w.log).toEqual(['stand down'])
  expect(w.due.size).toBe(0)
  expect(also).toBe(2)
})

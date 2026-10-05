import { expect, test } from 'claude-code/testing'

import { ALIVE_MS, boundOf, carriedFrom, HANDOFF_MS, isSayDue, NO_SESSIONS, parseSessions, saidLeft, saidOn, SAY_EVERY_MS, SELF_CHECK_MS, SESSIONS_KEEP_MS, withdrawn } from '../core/sessions'
import type { SessionBook, SessionEntry } from '../core/sessions'

/** The sessions the tutor is on in, and which of them a new process carries on from (Kernel.Sessions). */

const entry = (over: Partial<SessionEntry> = {}): SessionEntry => ({ session: 'parent', born: 500, cwd: '/work', mode: 'on', at: 1000, leftAt: 0, ...over })
const asking = (now: number, over: { born?: number; cwd?: string } = {}) => ({ born: 500, cwd: '/work', now, ...over })

test('a process that forks or resumes a conversation carries on from a session that had the tutor on in it a moment ago', async () => {
  const book = saidOn(NO_SESSIONS, entry())
  expect(carriedFrom(book, asking(2000))).toEqual({ session: 'parent', mode: 'on' })
  expect(carriedFrom(saidOn(NO_SESSIONS, entry({ mode: 'paused' })), asking(2000))).toEqual({ session: 'parent', mode: 'paused' })

  // Another conversation, or the same one in another directory, is not this one.
  expect(carriedFrom(book, asking(2000, { born: 501 }))).toBeNull()
  expect(carriedFrom(book, asking(2000, { cwd: '/elsewhere' }))).toBeNull()
  expect(carriedFrom(NO_SESSIONS, asking(2000))).toBeNull()

  // A session that stopped saying so is gone without a goodbye.
  expect(carriedFrom(book, asking(1000 + ALIVE_MS))).toEqual({ session: 'parent', mode: 'on' })
  expect(carriedFrom(book, asking(1000 + ALIVE_MS + 1))).toBeNull()
})

test('a goodbye leaves a minute to carry on, and a conversation picked up later starts off', async () => {
  const gone = saidLeft(saidOn(NO_SESSIONS, entry()), 'parent', 5000)
  expect(gone.sessions[0]?.leftAt).toBe(5000)
  expect(carriedFrom(gone, asking(5000 + HANDOFF_MS))).toEqual({ session: 'parent', mode: 'on' })
  expect(carriedFrom(gone, asking(5000 + HANDOFF_MS + 1))).toBeNull()

  // The first goodbye stands, and another session's is its own.
  expect(saidLeft(gone, 'parent', 9000).sessions[0]?.leftAt).toBe(5000)
  expect(saidLeft(gone, 'someone-else', 9000)).toEqual(gone)
})

test('of several sessions of one conversation, the one that said so last is carried on from', async () => {
  const both = saidOn(saidOn(NO_SESSIONS, entry({ session: 'first', at: 1000 })), entry({ session: 'second', at: 3000, mode: 'paused' }))
  expect(carriedFrom(both, asking(4000))).toEqual({ session: 'second', mode: 'paused' })
  // The later one said goodbye long ago: the earlier one still stands.
  expect(carriedFrom(saidLeft(both, 'second', 3500), asking(3500 + HANDOFF_MS + 1))).toEqual({ session: 'first', mode: 'on' })
})

test('saying so again replaces what the session said, and switching off takes it back', async () => {
  const once = saidOn(NO_SESSIONS, entry())
  const again = saidOn(once, entry({ at: 7000, mode: 'paused' }))
  expect(again.sessions).toEqual([entry({ at: 7000, mode: 'paused' })])
  // Saying so again after a goodbye is being back.
  expect(saidOn(saidLeft(once, 'parent', 2000), entry({ at: 3000 })).sessions).toEqual([entry({ at: 3000 })])

  expect(withdrawn(again, 'parent')).toEqual(NO_SESSIONS)
  expect(withdrawn(again, 'someone-else')).toEqual(again)
  expect(carriedFrom(withdrawn(again, 'parent'), asking(7001))).toBeNull()
})

test('what nobody has stood behind for a day is dropped the next time anyone says anything', async () => {
  const old = saidOn(NO_SESSIONS, entry({ session: 'old', at: 1000 }))
  const kept = saidOn(old, entry({ session: 'new', at: 1000 + SESSIONS_KEEP_MS }))
  expect(kept.sessions.map(one => one.session)).toEqual(['old', 'new'])
  const dropped = saidOn(old, entry({ session: 'new', at: 1001 + SESSIONS_KEEP_MS }))
  expect(dropped.sessions.map(one => one.session)).toEqual(['new'])
  // A goodbye counts as standing behind it, for a day more.
  const left = saidLeft(old, 'old', 5000)
  expect(saidLeft(left, 'nobody', 5000 + SESSIONS_KEEP_MS).sessions.length).toBe(1)
  expect(saidLeft(left, 'nobody', 5001 + SESSIONS_KEEP_MS).sessions.length).toBe(0)
  // A session that last said so a day ago, on a laptop that slept since, still says its goodbye.
  const woke = saidLeft(old, 'old', 2000 + SESSIONS_KEEP_MS)
  expect(woke.sessions.map(one => one.leftAt)).toEqual([2000 + SESSIONS_KEEP_MS])
  expect(carriedFrom(woke, asking(2001 + SESSIONS_KEEP_MS))).toEqual({ session: 'old', mode: 'on' })
})

test('a session says again that the tutor is on every five minutes, and looks at itself every ten seconds', async () => {
  expect(SAY_EVERY_MS).toBe(300_000)
  expect(SELF_CHECK_MS).toBe(10_000)
  expect(isSayDue(1000, 1000 + SAY_EVERY_MS - 1)).toBe(false)
  expect(isSayDue(1000, 1000 + SAY_EVERY_MS)).toBe(true)
  // Two says may be missed before a session counts as gone.
  expect(ALIVE_MS > 2 * SAY_EVERY_MS).toBe(true)
})

test('a terminal session that draws nowhere twice running is gone, and one a host runs headless never is', async () => {
  expect(boundOf({ surfaces: 1, wasUnsure: false, isTerminal: true })).toBe('drawn')
  expect(boundOf({ surfaces: 0, wasUnsure: false, isTerminal: true })).toBe('unsure')
  expect(boundOf({ surfaces: 0, wasUnsure: true, isTerminal: true })).toBe('gone')
  // It drew again in between: back to sure.
  expect(boundOf({ surfaces: 1, wasUnsure: true, isTerminal: true })).toBe('drawn')
  expect(boundOf({ surfaces: 0, wasUnsure: true, isTerminal: false })).toBe('drawn')
})

test('the file as stored is read back, and anything that is not an entry is left out', async () => {
  const book: SessionBook = { v: 1, sessions: [entry(), entry({ session: 'b', mode: 'paused', leftAt: 9 })] }
  expect(parseSessions(JSON.parse(JSON.stringify(book)))).toEqual(book)
  expect(parseSessions(null)).toEqual(NO_SESSIONS)
  expect(parseSessions({ sessions: 'none' })).toEqual(NO_SESSIONS)
  expect(
    parseSessions({
      sessions: [entry(), { ...entry(), session: '' }, { ...entry(), mode: 'off' }, { ...entry(), born: 'yesterday' }, { ...entry(), at: -1 }, 'nonsense', null, { session: 'bare' }],
    }),
  ).toEqual({ v: 1, sessions: [entry()] })
  // A goodbye that does not parse is no goodbye.
  expect(parseSessions({ sessions: [{ ...entry(), leftAt: 'soon' }] }).sessions[0]?.leftAt).toBe(0)
})

/** A random number generator that gives the same numbers for the same seed, so that a failure can be found again. */
function seeded(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0

    return state / 4294967296
  }
}

test('whatever sessions say, leave and switch off, a new process only carries on from one that had the tutor on a moment ago', { timeoutMs: 60_000 }, async () => {
  const names = ['a', 'b', 'c', 'd']
  for (let seed = 1; seed <= 400; seed += 1) {
    const random = seeded(seed)
    let book = NO_SESSIONS
    let now = 1_000_000
    /** What each session last did, as this test keeps count of it. */
    const truth = new Map<string, { born: number; mode: 'on' | 'paused'; at: number; leftAt: number }>()
    for (let turn = 0; turn < 40; turn += 1) {
      now += Math.floor(random() * (random() < 0.1 ? SESSIONS_KEEP_MS : 400_000))
      const who = names[Math.floor(random() * names.length)] ?? 'a'
      const roll = random()
      /** Whoever says anything drops what nobody has stood behind for a day. */
      const forgetOld = (): void => {
        for (const [name, said] of [...truth]) if (now - Math.max(said.at, said.leftAt) > SESSIONS_KEEP_MS) truth.delete(name)
      }
      if (roll < 0.5) {
        const said = { born: 500 + Math.floor(random() * 2), mode: random() < 0.3 ? ('paused' as const) : ('on' as const), at: now, leftAt: 0 }
        truth.set(who, said)
        forgetOld()
        book = saidOn(book, { session: who, cwd: '/work', ...said })
      } else if (roll < 0.75) {
        const known = truth.get(who)
        if (known !== undefined && known.leftAt === 0) known.leftAt = now
        forgetOld()
        book = saidLeft(book, who, now)
      } else {
        truth.delete(who)
        book = withdrawn(book, who)
      }

      for (const born of [500, 501]) {
        const found = carriedFrom(book, { born, cwd: '/work', now })
        const where = `seed ${seed}, turn ${turn}, born ${born}`
        const fresh = [...truth].filter(([, said]) => said.born === born && (said.leftAt > 0 ? now - said.leftAt <= HANDOFF_MS : now - said.at <= ALIVE_MS))
        if (fresh.length === 0) {
          expect(`${where}: ${JSON.stringify(found)}`).toBe(`${where}: null`)
          continue
        }
        const latest = Math.max(...fresh.map(([, said]) => said.at))
        const allowed = fresh.filter(([, said]) => said.at === latest).map(([name, said]) => `${name}:${said.mode}`)
        expect(found === null ? `${where}: nothing` : allowed.includes(`${found.session}:${found.mode}`) ? 'ok' : `${where}: ${JSON.stringify(found)} not among ${allowed.join(' ')}`).toBe('ok')
      }
      // No session is in the file twice, and the file holds exactly the sessions that said so and were not switched off.
      expect(new Set(book.sessions.map(one => one.session)).size).toBe(book.sessions.length)
      expect(`${seed}/${turn}: ${book.sessions.map(one => one.session).sort().join(' ')}`).toBe(`${seed}/${turn}: ${[...truth.keys()].sort().join(' ')}`)
    }
  }
})

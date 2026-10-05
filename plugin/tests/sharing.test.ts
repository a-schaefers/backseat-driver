import { expect } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import type { Profile } from '../types'
import { MARKER } from '../hooks/datahome'
import { FORGET, PHRASE, SCOPE_EVERYTHING } from '../hooks/forget'
import { LOCK_TTL_MS, LOCK_WAIT_MS, lockRef } from '../hooks/locks'
import { emptyProfile, withAnswers, withHush } from '../hooks/profiles'
import { READ_RETRY_MS } from '../hooks/store'
import { DATA_HOME, SESSION, sessionTest, stubSession, typed } from './kit'

/** Several sessions share the tutor's data folder. These are the moments where they meet. */

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const PYTHON = `${DATA_HOME}/profiles/python.json`
const REF = lockRef(PYTHON)
const HUSHED: Profile = withHush(withAnswers(emptyProfile(), { level: 'Years of it' }), { topic: 'type-hints', text: 'missing type hints' })
const RECORD = { tool: 'mcp__backseat-driver__record', about: 'goals', language: 'python', answer: 'Faster code' } as const

/** Starts a session and switches the tutor on. */
async function on$(session: ReturnType<typeof stubSession>, $: Parameters<TestBody>[0]): Promise<void> {
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
}

const profile = (session: ReturnType<typeof stubSession>): Profile => session.data('profiles/python.json') as Profile

sessionTest('a change to a profile is made under its lock, and the profile as it was is kept beside it', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'profiles/python.json': HUSHED } })
  await on$(session, $)
  session.locking.length = 0

  await $.tool.call(RECORD)
  expect(session.locking).toEqual([`take ${REF}`, `give ${REF}`])
  expect(profile(session).answers).toEqual({ level: 'Years of it', goals: 'Faster code' })
  expect(profile(session).hushed).toEqual(HUSHED.hushed)
  // The backup is the file as it was before this change.
  expect((JSON.parse(session.disk.get(`${PYTHON}.bak`) ?? '{}') as Profile).answers).toEqual({ level: 'Years of it' })
  expect(session.disk.has(`${DATA_HOME}/${MARKER}`)).toBe(true)
  expect(session.disk.has(`${DATA_HOME}/locks.git/HEAD`)).toBe(true)
})

sessionTest('a profile caught half-written by another session is not taken for an empty one', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'profiles/python.json': HUSHED } })
  await on$(session, $)

  // The other session has emptied the file and not yet filled it: the next read finds nothing in it.
  session.halfWritten.set(PYTHON, 1)
  const call = $.tool.call(RECORD)
  await session.clock.advance(READ_RETRY_MS)
  await call

  // Their hush and the first answer are still there, with the new answer added.
  expect(profile(session).hushed).toEqual(HUSHED.hushed)
  expect(profile(session).answers).toEqual({ level: 'Years of it', goals: 'Faster code' })
})

sessionTest('a profile that stays broken is kept aside and its backup is used', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.disk.set(PYTHON, '{"answers": {"level": "Years of')
  session.disk.set(`${PYTHON}.bak`, JSON.stringify(HUSHED))
  await $.session.start(SESSION)
  const start = $.command.run(typed('bsd'))
  // Each look at the broken file waits a moment and looks again before giving up on it.
  for (let waits = 0; waits < 30; waits += 1) await session.clock.advance(READ_RETRY_MS)
  await start
  await session.clock.settle()

  const call = $.tool.call(RECORD)
  for (let waits = 0; waits < 6; waits += 1) await session.clock.advance(READ_RETRY_MS)
  await call
  expect(profile(session).hushed).toEqual(HUSHED.hushed)
  expect(profile(session).answers).toEqual({ level: 'Years of it', goals: 'Faster code' })
  expect(session.disk.get(`${PYTHON}.broken`)).toBe('{"answers": {"level": "Years of')
})

sessionTest("another session's lock is waited for, and then the change is made and checked without it", async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'profiles/python.json': HUSHED } })
  await on$(session, $)
  session.lockedElsewhere(REF)
  session.locking.length = 0

  const call = $.tool.call(RECORD)
  await session.clock.advance(LOCK_WAIT_MS / 2)
  // Still waiting: nothing is written while the other session may be writing.
  expect(profile(session).answers).toEqual({ level: 'Years of it' })
  await session.clock.advance(LOCK_WAIT_MS)
  await call

  expect(profile(session).answers).toEqual({ level: 'Years of it', goals: 'Faster code' })
  expect(session.locking.every(entry => entry === `refused ${REF}`)).toBe(true)
  expect(session.locking.length > 3).toBe(true)
  // The other session still holds its lock.
  expect(session.disk.has(`${DATA_HOME}/locks.git/${REF}`)).toBe(true)
})

sessionTest('a lock left by a session that died is taken over at once', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'profiles/python.json': HUSHED } })
  await on$(session, $)
  await session.clock.advance(LOCK_TTL_MS * 2)
  session.lockedElsewhere(REF, LOCK_TTL_MS + 1000)
  session.locking.length = 0

  await $.tool.call(RECORD)
  expect(session.locking).toEqual([`refused ${REF}`, `steal ${REF}`, `give ${REF}`])
  expect(profile(session).answers).toEqual({ level: 'Years of it', goals: 'Faster code' })
})

sessionTest('forgetting a language takes the copies beside its files, and forgetting everything takes the locks', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'profiles/python.json': HUSHED } })
  await on$(session, $)
  await $.tool.call(RECORD)
  await $.tool.call({ ...RECORD, about: 'focus', answer: 'Readability' })
  expect(session.disk.has(`${PYTHON}.bak`)).toBe(true)

  session.answers.push(FORGET)
  await $.command.run(typed('bsd', 'forget python'))
  await session.clock.settle()
  expect(session.removed).toEqual([PYTHON, `${PYTHON}.bak`])
  expect(session.disk.has(`${PYTHON}.bak`)).toBe(false)

  session.answers.push(SCOPE_EVERYTHING, FORGET, PHRASE)
  await $.command.run(typed('bsd', 'forget'))
  await session.clock.settle()
  expect(session.removed.includes(`${DATA_HOME}/locks.git`)).toBe(true)
  expect([...session.disk.keys()].filter(path => path.startsWith(`${DATA_HOME}/locks.git`))).toEqual([])

  // The next change makes the lock repository again and goes through.
  session.locking.length = 0
  await $.tool.call(RECORD)
  expect(session.locking).toEqual([`take ${REF}`, `give ${REF}`])
  expect(profile(session).answers).toEqual({ goals: 'Faster code' })
})

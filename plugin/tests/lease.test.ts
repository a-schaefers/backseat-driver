import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { projectId } from '../hooks/datahome'
import { claimed, isHeld, LEASE_BEAT_MS, LEASE_SLACK_MS, LEASE_TTL_MS, nextLeaseCheck, NO_LEASE, parseLease, released } from '../hooks/lease'
import type { Lease } from '../hooks/lease'
import { emptyProfile, withHush } from '../hooks/profiles'
import { COMPOSE, DATA_HOME, PANE, ROOT, SESSION, SESSION_ID, sessionTest, stubSession, typed } from './kit'

/** Which session drives a project, and what every session shares about the person. */

const MINE = 'me'
const OTHER = 'someone-else'

test('a lease is free until a session takes it, and again when that session stops saying so', async () => {
  expect(isHeld(NO_LEASE, 0)).toBe(false)
  const taken = claimed(NO_LEASE, MINE, 1000)
  expect(taken).toEqual({ v: 1, session: MINE, at: 1000 })
  expect(isHeld(taken, 1000 + LEASE_TTL_MS - 1)).toBe(true)
  expect(isHeld(taken, 1000 + LEASE_TTL_MS)).toBe(false)

  // Mine already: renewed.
  expect(claimed(taken, MINE, 21_000)).toEqual({ v: 1, session: MINE, at: 21_000 })
  // Another session's, and still held: it comes back as it was, the same object, so nothing is written.
  expect(claimed(taken, OTHER, 21_000)).toBe(taken)
  // Run out: it is whoever asks first.
  expect(claimed(taken, OTHER, 1000 + LEASE_TTL_MS)).toEqual({ v: 1, session: OTHER, at: 1000 + LEASE_TTL_MS })
  // /clear gave this session another id. The lease it held under the old one is still its own.
  expect(claimed(taken, 'me-after-clear', 5000, MINE)).toEqual({ v: 1, session: 'me-after-clear', at: 5000 })
  expect(claimed(taken, 'me-after-clear', 5000, 'not-the-holder')).toBe(taken)
})

test('a lease is given back only by the session that holds it', async () => {
  const taken = claimed(NO_LEASE, MINE, 1000)
  expect(released(taken, MINE)).toEqual(NO_LEASE)
  expect(released(taken, OTHER)).toBe(taken)
  expect(claimed(released(taken, MINE), OTHER, 2000).session).toBe(OTHER)
})

test('a stored lease is read back, and anything else is no lease', async () => {
  const taken: Lease = { v: 1, session: MINE, at: 1000 }
  expect(parseLease(JSON.parse(JSON.stringify(taken)))).toEqual(taken)
  expect(parseLease(null)).toEqual(NO_LEASE)
  expect(parseLease('lease')).toEqual(NO_LEASE)
  expect(parseLease({ session: 7, at: 1 })).toEqual(NO_LEASE)
  expect(parseLease({ session: MINE, at: 'now' })).toEqual(NO_LEASE)
})

test('the holder comes back in time to renew, and a waiting session when the lease may be free', async () => {
  const taken: Lease = { v: 1, session: MINE, at: 100_000 }
  expect(nextLeaseCheck(taken, MINE, 100_000, 0.5)).toBe(100_000 + LEASE_BEAT_MS)
  // Waiting: a beat from now, which is how soon a lease that was given back is noticed.
  expect(nextLeaseCheck(taken, OTHER, 101_000, 0)).toBe(101_000 + LEASE_BEAT_MS)
  // Or the moment it runs out, when that is sooner, and a little after it so that several do not ask at once.
  expect(nextLeaseCheck(taken, OTHER, 150_000, 0)).toBe(100_000 + LEASE_TTL_MS)
  expect(nextLeaseCheck(taken, OTHER, 150_000, 0.5)).toBe(100_000 + LEASE_TTL_MS + LEASE_SLACK_MS / 2)
  // Never at once: a lease that has just run out was tried for a moment ago.
  expect(nextLeaseCheck(taken, OTHER, 100_000 + LEASE_TTL_MS, 0)).toBe(100_000 + LEASE_TTL_MS + 1000)
})

type Session = ReturnType<typeof stubSession>
type Engine = Parameters<TestBody>[0]

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const LEASE = `projects/${projectId(ROOT)}/lease.json`
const QUIET = { options: { play_by_play: 'on request', explain: 'off', animated_persona: false, progress_report: false } } as const

async function start($: Engine, session: Session): Promise<void> {
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
}

const leaseIn = (session: Session): Lease => parseLease(session.data(LEASE))

async function statusLine($: Engine, text: string): Promise<boolean> {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const found = await ui.find({ type: 'Text', text })
  await ui.unmount()

  return found !== undefined
}

sessionTest('the session that is first in a project drives it, says so every twenty seconds, and gives the lease back when switched off', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  expect(leaseIn(session).session).toBe(SESSION_ID)
  const first = leaseIn(session).at

  await session.clock.advance(LEASE_BEAT_MS - 1)
  expect(leaseIn(session).at).toBe(first)
  await session.clock.advance(1)
  await session.clock.settle()
  expect(leaseIn(session).at).toBe(first + LEASE_BEAT_MS)
  expect(session.scans > 0).toBe(true)

  await $.command.run(typed('bsd', 'off'))
  await session.clock.settle()
  expect(leaseIn(session)).toEqual(NO_LEASE)
})

sessionTest('a second session in the same project is for the conversation, and takes over when the first is gone', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [LEASE]: { v: 1, session: OTHER, at: 0 } } })
  await start($, session)
  expect(leaseIn(session).session).toBe(OTHER)
  expect(await statusLine($, 'On. Another session is driving this project. This one is for the conversation.')).toBe(true)

  // Nothing here scans, looks or reviews: the other session does. The one reading of the tree was at switch-on.
  const atStart = session.scans
  session.write('stats.py', `${MEAN}# more\n`)
  session.commit('Add a comment')
  await session.clock.advance(30_000)
  expect(session.scans).toBe(atStart)
  expect(session.spawned).toEqual([])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'look' })
  await ui.press({ key: 'tab-review' })
  await ui.press({ key: 'review-now' })
  await ui.unmount()
  await session.clock.settle()
  expect(session.toasts.filter(toast => toast === 'Another session is driving Backseat Driver in this project. Ask for it there.').length).toBe(2)
  expect(session.requests).toEqual([])
  expect(session.spawned).toEqual([])
  // The conversation's tools work all the same.
  const told = (await $.tool.call({ tool: 'mcp__backseat-driver__hush', topic: 'type-hints', language: 'python', what: 'type hints' })) as { result: string }
  expect(told.result).toMatch('Recorded.')

  // The other session was killed: its lease is not renewed. A minute after its last word this session drives.
  await session.clock.advance(LEASE_TTL_MS - 30_000)
  await session.clock.settle()
  expect(leaseIn(session).session).toBe(SESSION_ID)
  expect(await statusLine($, 'On. Looking only when you ask.')).toBe(true)
  // What was in the tree when it took over is where it starts from. What comes after is its to review.
  session.write('stats.py', `${MEAN}# more\n# and more\n`)
  session.commit('Add another comment')
  await session.clock.advance(2000)
  expect(session.scans > atStart + 1).toBe(true)
  expect(session.spawned.length).toBe(1)
  expect(session.spawned[0]?.prompt).toMatch('Add another comment')
})

sessionTest('a lease given back is taken up within one beat', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [LEASE]: { v: 1, session: OTHER, at: 0 } } })
  await start($, session)
  expect(leaseIn(session).session).toBe(OTHER)
  // The other session is switched off, and says so in the file.
  session.disk.set(`${DATA_HOME}/${LEASE}`, JSON.stringify(NO_LEASE))
  await session.clock.advance(LEASE_BEAT_MS)
  await session.clock.settle()
  expect(leaseIn(session).session).toBe(SESSION_ID)
})

sessionTest('a session that was away longer than its lease lasts gives way to the one that took over', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  await session.clock.advance(5000)
  const before = session.scans
  expect(before > 0).toBe(true)

  // The laptop slept. Another session found the lease run out and took it.
  session.disk.set(`${DATA_HOME}/${LEASE}`, JSON.stringify({ v: 1, session: OTHER, at: session.clock.now() + LEASE_BEAT_MS }))
  await session.clock.advance(LEASE_BEAT_MS)
  await session.clock.settle()
  expect(leaseIn(session).session).toBe(OTHER)
  expect(await statusLine($, 'On. Another session is driving this project. This one is for the conversation.')).toBe(true)
  const after = session.scans
  await session.clock.advance(15_000)
  expect(session.scans).toBe(after)
})

sessionTest('/clear gives the session another id, and it goes on driving', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  expect(leaseIn(session).session).toBe(SESSION_ID)

  session.sessionId = 'feedc0de-0000-4000-8000-000000000002'
  await $.classic.SessionStart({ source: 'clear' })
  await session.clock.settle()
  expect(leaseIn(session).session).toBe('feedc0de-0000-4000-8000-000000000002')
  expect(await statusLine($, 'On. Looking only when you ask.')).toBe(true)
})

sessionTest('a hush made in another session takes its note out of this one, and the reviewers are told', { options: { explain: 'off', animated_persona: false, progress_report: false } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 1, kind: 'idiom', topic: 'type-hints', note: 'No type hints.' }] })
  await start($, session)
  session.write('stats.py', `${MEAN}\ndef total(xs):\n    return sum(xs)\n`)
  await session.clock.advance(14_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No type hints.' })).toBeDefined()
  const registered = session.agents.length

  // In another project, in another session, they say they never want to hear about type hints in Python.
  session.disk.set(`${DATA_HOME}/profiles/python.json`, JSON.stringify(withHush(emptyProfile(), { topic: 'type-hints', text: 'type hints' })))
  // Within one look at the shared files, which a scan takes every five seconds.
  await session.clock.advance(6000)
  await session.clock.settle()
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
  await ui.unmount()
  expect(session.agents.length).toBe(registered + 1)
  expect(session.agents[session.agents.length - 1]?.prompt).toMatch('type hints')
})

sessionTest('what another session recorded is in the next prompt, in a session that does not scan', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [LEASE]: { v: 1, session: OTHER, at: 0 } } })
  await start($, session)
  session.disk.set(`${DATA_HOME}/profiles/python.json`, JSON.stringify(withHush(emptyProfile(), { topic: 'type-hints', text: 'type hints in Python' })))

  await $.prompt.submit({ text: 'What is wrong with my mean function?', wait: false, origin: { kind: 'composer' } })
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections[sections.length - 1]?.text).toMatch('type hints in Python')
})

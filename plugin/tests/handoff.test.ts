import { expect } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { projectId } from '../core/datahome'
import { sourcePrint } from '../core/knowledge'
import { LEASE_BEAT_MS, NO_LEASE, parseLease } from '../core/lease'
import type { Lease } from '../core/lease'
import { HANDOFF_MS, parseSessions, RECHECK_MS, SELF_CHECK_MS } from '../core/sessions'
import type { SessionBook } from '../core/sessions'
import { DATA_HOME, LICENSE_ANSWERED, PANE, ROOT, SESSION, SESSION_ID, sessionTest, stubSession, typed } from './kit'

/**
 * A conversation that Claude Code moves into another process keeps its
 * tutor: a left arrow on an empty prompt sends it to the background as a
 * fork, in a process where the mod has only just loaded. And the process the
 * conversation left, which is told nothing and draws nowhere, lays it down.
 */

type Session = ReturnType<typeof stubSession>
type Engine = Parameters<TestBody>[0]

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const PARENT = 'feedc0de-0000-4000-8000-00000000000a'
const BORN = 123_456
const LEASE = `projects/${projectId(ROOT)}/lease.json`
const NOTES = `projects/${projectId(ROOT)}/notes.json`
const QUIET = { options: { play_by_play: 'on request', explain: 'off', animated_persona: false, progress_report: false } } as const
const CARRIED = 'Backseat Driver is still on. It came along with the conversation.'
const NOTE = { id: 7, file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-list', text: 'What does this do for an empty list?' }
const KEPT = { v: 1, notes: [NOTE], dismissed: [], prints: { 'stats.py': sourcePrint(MEAN) } }

const parent = (over: Record<string, unknown> = {}) => ({ session: PARENT, born: BORN, cwd: ROOT, mode: 'on', at: 0, leftAt: 0, ...over })
const leaseIn = (session: Session): Lease => parseLease(session.data(LEASE))
const sessionsIn = (session: Session): SessionBook => parseSessions(session.data('sessions.json'))

async function shows($: Engine, text: string): Promise<boolean> {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const found = await ui.find({ type: 'Text', text })
  await ui.unmount()

  return found !== undefined
}

sessionTest('a conversation sent to the background keeps its tutor: the new process comes up on, drives at once, and shows the notes', QUIET, async ($, on) => {
  const session = stubSession(on, {
    head: { 'stats.py': MEAN },
    data: { 'sessions.json': { v: 1, sessions: [parent()] }, [LEASE]: { v: 1, session: PARENT, at: 0 }, [NOTES]: KEPT, ...LICENSE_ANSWERED },
  })
  session.born = BORN
  await $.session.start(SESSION)
  // Off, as any process is at first: nothing has been opened.
  expect(session.opened).toEqual([])

  await $.classic.SessionStart({ source: 'fork' })
  await session.clock.settle()
  expect(session.opened).toEqual(['backseat-driver'])
  expect(session.logs.filter(line => line === CARRIED).length).toBe(1)
  // The lease of the process the conversation left is this one's at once, not a minute later.
  expect(leaseIn(session).session).toBe(SESSION_ID)
  expect(await shows($, 'On. Looking only when you ask.')).toBe(true)
  expect(await shows($, NOTE.text)).toBe(true)
  // Nothing is asked again, and the contract is in force.
  expect(session.asked).toEqual([])
  const composed = await $.prompt.compose({ model: 'claude-test', promptModel: 'claude-test', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] })
  expect(composed.sections.some(section => section.id === 'backseat-driver:contract')).toBe(true)
  // It says so itself now, in place of the session it left, for whatever carries on from it.
  expect(sessionsIn(session).sessions.map(one => one.session)).toEqual([SESSION_ID])

  // Switched off here, the conversation has no tutor: another process forked from it within the minute starts off.
  await $.command.run(typed('bsd', 'off'))
  await session.clock.settle()
  expect(sessionsIn(session).sessions).toEqual([])
})

sessionTest('a paused tutor comes along paused', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'sessions.json': { v: 1, sessions: [parent({ mode: 'paused' })] }, ...LICENSE_ANSWERED } })
  session.born = BORN
  await $.session.start(SESSION)
  await $.classic.SessionStart({ source: 'fork' })
  await session.clock.settle()
  expect(await shows($, 'Paused. /bsd resume to continue.')).toBe(true)
  expect(sessionsIn(session).sessions.find(one => one.session === SESSION_ID)?.mode).toBe('paused')
})

sessionTest('a new session starts off, and so does a conversation picked up after its session was long closed', QUIET, async ($, on) => {
  const session = stubSession(on, {
    head: { 'stats.py': MEAN },
    data: { 'sessions.json': { v: 1, sessions: [parent({ at: 1000, leftAt: 2000 })] }, ...LICENSE_ANSWERED },
  })
  session.born = BORN
  await session.clock.advance(2000 + HANDOFF_MS + 1)
  await $.session.start(SESSION)
  const before = session.diskReads.length
  // A session started afresh looks at nothing.
  await $.classic.SessionStart({ source: 'startup' })
  await session.clock.settle()
  expect(session.diskReads.length).toBe(before)

  // One resumed looks once, and finds a session that said goodbye more than a minute ago.
  await $.classic.SessionStart({ source: 'resume' })
  await session.clock.settle()
  expect(session.diskReads.slice(before)).toEqual([`${DATA_HOME}/sessions.json`])
  expect(session.opened).toEqual([])
  expect(session.logs).toEqual([])
  const composed = await $.prompt.compose({ model: 'claude-test', promptModel: 'claude-test', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] })
  expect(composed.sections.some(section => section.id === 'backseat-driver:contract')).toBe(false)
})

sessionTest('another conversation in the same folder does not come up on', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'sessions.json': { v: 1, sessions: [parent()] }, ...LICENSE_ANSWERED } })
  session.born = BORN + 1
  await $.session.start(SESSION)
  await $.classic.SessionStart({ source: 'resume' })
  await session.clock.settle()
  expect(session.opened).toEqual([])
})

sessionTest('the process a conversation left draws nowhere, and lays the tutor down: lease, scans and all', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { ...LICENSE_ANSWERED } })
  session.born = BORN
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(leaseIn(session).session).toBe(SESSION_ID)
  expect(sessionsIn(session).sessions).toEqual([{ session: SESSION_ID, born: BORN, cwd: ROOT, mode: 'on', at: session.clock.now(), leftAt: 0 }])

  // A left arrow on an empty prompt: no event, and nowhere to draw from then on.
  session.surfaces = []
  await session.clock.advance(SELF_CHECK_MS)
  await session.clock.settle()
  // Once is not believed.
  expect(leaseIn(session).session).toBe(SESSION_ID)
  await session.clock.advance(RECHECK_MS)
  await session.clock.settle()

  expect(leaseIn(session)).toEqual(NO_LEASE)
  expect(session.closed).toEqual(['backseat-driver'])
  // It said goodbye, and did not take back that the tutor was on: the process the conversation went to has a minute to carry on.
  const gone = sessionsIn(session).sessions[0]
  expect(gone?.session).toBe(SESSION_ID)
  expect((gone?.leftAt ?? 0) > 0).toBe(true)
  // Nothing runs here any more.
  const scans = session.scans
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(60_000)
  expect(session.scans).toBe(scans)
  expect(session.requests).toEqual([])
  const composed = await $.prompt.compose({ model: 'claude-test', promptModel: 'claude-test', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] })
  expect(composed.sections.some(section => section.id === 'backseat-driver:contract')).toBe(false)
})

sessionTest('a turn cut short is looked into at once, without waiting for the next look at itself', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { ...LICENSE_ANSWERED } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.surfaces = []
  await $.turn.complete({ turnId: 'turn-main', answer: '', durationMs: 1000, isAborted: true, reason: 'aborted' })
  await session.clock.advance(RECHECK_MS)
  await session.clock.settle()
  expect(leaseIn(session)).toEqual(NO_LEASE)
  expect(session.closed).toEqual(['backseat-driver'])
})

sessionTest('a session that still draws carries on, however long, and says every five minutes that the tutor is on', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { ...LICENSE_ANSWERED } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  const first = sessionsIn(session).sessions[0]?.at ?? -1

  await session.clock.advance(299_000)
  await session.clock.settle()
  expect(sessionsIn(session).sessions[0]?.at).toBe(first)
  await session.clock.advance(12_000)
  await session.clock.settle()
  expect((sessionsIn(session).sessions[0]?.at ?? 0) > first).toBe(true)
  expect(leaseIn(session).session).toBe(SESSION_ID)
  expect(session.closed).toEqual([])
})

sessionTest('switching off takes back what the session said, a pause is said at once, and leaving is a goodbye', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { ...LICENSE_ANSWERED } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  await $.command.run(typed('bsd', 'pause'))
  await session.clock.settle()
  expect(sessionsIn(session).sessions[0]?.mode).toBe('paused')
  await $.command.run(typed('bsd', 'resume'))
  await session.clock.settle()
  expect(sessionsIn(session).sessions[0]?.mode).toBe('on')

  await $.command.run(typed('bsd', 'off'))
  await session.clock.settle()
  expect(sessionsIn(session).sessions).toEqual([])

  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await session.clock.advance(1000)
  await $.session.end({ reason: 'prompt_input_exit', sessionId: SESSION_ID, resume: { id: SESSION_ID } })
  await session.clock.settle()
  expect(sessionsIn(session).sessions.map(one => one.leftAt > 0)).toEqual([true])
})

sessionTest('a pane that Claude Code opens without drawing it is said, once, with how to get it', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'sessions.json': { v: 1, sessions: [parent()] }, ...LICENSE_ANSWERED } })
  session.born = BORN
  session.paneWaits = 'the terminal is 100 columns wide, and an unasked pane needs 110'
  await $.session.start(SESSION)
  await $.classic.SessionStart({ source: 'fork' })
  await session.clock.settle()
  const waits = 'Backseat Driver is on. Its pane waits for a wider terminal: /bsd opens it now.'
  expect(session.logs.filter(line => line === waits).length).toBe(1)

  // Asked for, it is drawn at any width, and nothing more is said.
  session.paneWaits = ''
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.logs.filter(line => line === waits).length).toBe(1)
})

sessionTest('a session that took over a project shows what the pane held for the one before it', QUIET, async ($, on) => {
  const session = stubSession(on, {
    head: { 'stats.py': MEAN },
    data: { [LEASE]: { v: 1, session: PARENT, at: 0 }, [NOTES]: KEPT, ...LICENSE_ANSWERED },
  })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  // While another session drives, its notes are its own.
  expect(await shows($, NOTE.text)).toBe(false)

  await session.clock.advance(60_000 + 3000)
  await session.clock.settle()
  expect(leaseIn(session).session).toBe(SESSION_ID)
  expect(await shows($, NOTE.text)).toBe(true)
  await session.clock.advance(LEASE_BEAT_MS + 1000)
  await session.clock.settle()
  expect(leaseIn(session).at > 60_000).toBe(true)
})

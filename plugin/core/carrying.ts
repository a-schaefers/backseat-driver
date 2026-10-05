/**
 * Carrying the tutor on when Claude Code moves a conversation into another
 * process, and laying it down in the process the conversation left.
 *
 * A session with the tutor on says so in `sessions.json` (`sessions.ts`):
 * when it is switched on, when it is paused or resumed, and now and then
 * after. It says goodbye when it ends. A process that starts by forking or
 * resuming a conversation looks there once (`carryOn`) and comes up as the
 * conversation was left: on or paused, with its pane.
 *
 * The process the conversation left is told nothing. A left arrow on an empty
 * prompt sends the conversation to the background and leaves this mod
 * running there, timers and all, drawing nowhere. So a session with the
 * tutor on looks at itself now and then (`checkSelf`), and one that finds it
 * has nowhere left to draw says goodbye and lays everything down.
 *
 * The rules are the kernel's (kernel/src/Kernel/Sessions.purs). This is the
 * engine; the program it runs in gives it `CarryPorts`, and what it
 * remembers is `CarryState`.
 */

import type { Mode } from '../types'
import { sessionsPath } from './datahome'
import type { Trace } from './host'
import { boundOf, carriedFrom, isSayDue, parseSessions, RECHECK_MS, saidLeft, saidOn, SELF_CHECK_MS, withdrawn } from './sessions'
import type { SessionEntry } from './sessions'
import { updateJson } from './store'
import type { Store } from './store'

/** What carrying the tutor remembers. */
export type CarryState = {
  /** When this session last said, in `sessions.json`, that it has the tutor on. 0 before it has. */
  saidAt: number
  /** The id it said so under. `/clear` gives a session another, and what the old one said is taken back. */
  saidAs: string
  /** True after a look found nowhere to draw. The next one settles it. */
  wasUnsure: boolean
  /** Whether the session began in a terminal. Only such a session is gone for good once it draws nowhere. */
  isTerminal: boolean
}

export function freshCarryState(): CarryState {
  return { saidAt: 0, saidAs: '', wasUnsure: false, isTerminal: false }
}

/** What carrying the tutor needs from its host. Each is read or done when it is needed. */
export type CarryPorts = {
  now: () => Promise<number>
  trace: Trace
  fail: (what: string, error: unknown) => void
  dataRoot: () => string
  /** The mode as the session has it now. */
  mode: () => Mode
  /** The session's id now. */
  sessionId: () => Promise<string>
  /** When the session's conversation first began: the same for a conversation and every fork and resume of it. */
  born: () => Promise<number>
  /** The directory the session runs in. */
  cwd: () => Promise<string>
  /** How many surfaces the session draws on now. */
  surfaces: () => Promise<number>
  store: () => Pick<Store, 'read' | 'update'>
  deadline: { set: (name: string, at: number, run: () => Promise<unknown> | unknown) => void }
  /** Switches the tutor on as it was in `from`, the session this one carries on. */
  comeUp: (mode: 'on' | 'paused', from: string) => Promise<void>
  /** This session has nowhere left to draw: everything it runs is laid down. */
  standDown: () => Promise<void>
}

/**
 * For a process that started by forking or resuming a conversation: comes up
 * with the tutor on when that conversation had it on a moment ago. Answers
 * whether it did. One read, and nothing is written unless it does.
 */
export async function carryOn(ports: CarryPorts, state: CarryState): Promise<boolean> {
  if (ports.mode() !== 'off' || ports.dataRoot() === '') return false
  try {
    const [born, cwd, now] = await Promise.all([ports.born(), ports.cwd(), ports.now()])
    const book = parseSessions(await ports.store().read(sessionsPath(ports.dataRoot())))
    const from = carriedFrom(book, { born, cwd, now })
    ports.trace('state', 'carried on', () => ({ born, cwd, from, known: book.sessions }))
    if (from === null) return false
    // The conversation's tutor lives here from now on: when this session says so, what the one it left said is
    // taken back with it, as after `/clear`. Switched off here, nothing is left to carry on from.
    state.saidAs = from.session
    await ports.comeUp(from.mode, from.session)

    return true
  } catch (error) {
    ports.fail('could not look at the sessions the tutor is on in', error)

    return false
  }
}

/**
 * Says, where every session reads it, that this one has the tutor on. Asked
 * for at switch-on and when the mode changes (`isChanged`), and otherwise
 * only when it is time to say so again.
 */
export async function sayOn(ports: CarryPorts, state: CarryState, isChanged: boolean): Promise<void> {
  const mode = ports.mode()
  if (mode === 'off' || ports.dataRoot() === '') return
  try {
    const [me, now] = await Promise.all([ports.sessionId(), ports.now()])
    if (!isChanged && state.saidAs === me && !isSayDue(state.saidAt, now)) return
    const entry: SessionEntry = { session: me, born: await ports.born(), cwd: await ports.cwd(), mode, at: now, leftAt: 0 }
    // After `/clear` the session goes by another id: what it said under the old one is taken back.
    const before = state.saidAs !== '' && state.saidAs !== me ? state.saidAs : ''
    state.saidAt = now
    state.saidAs = me
    await updateJson(ports.store(), sessionsPath(ports.dataRoot()), parseSessions, book => saidOn(before === '' ? book : withdrawn(book, before), entry))
    ports.trace('state', 'said on', () => ({ entry, before }))
  } catch (error) {
    ports.fail('could not say that the tutor is on here', error)
  }
}

/** Says goodbye: the session ends, or has nowhere left to draw. A process that carries on from it has a minute to come up. */
export async function sayLeft(ports: Pick<CarryPorts, 'now' | 'dataRoot' | 'store' | 'fail' | 'trace'>, state: CarryState): Promise<void> {
  if (state.saidAs === '' || ports.dataRoot() === '') return
  const who = state.saidAs
  try {
    const now = await ports.now()
    await updateJson(ports.store(), sessionsPath(ports.dataRoot()), parseSessions, book => saidLeft(book, who, now))
    ports.trace('state', 'said goodbye', () => ({ session: who }))
  } catch (error) {
    ports.fail('could not say that this session is leaving', error)
  }
}

/** Takes back what this session said: the tutor was switched off in it. */
export async function sayOff(ports: Pick<CarryPorts, 'dataRoot' | 'store' | 'fail' | 'trace'>, state: CarryState): Promise<void> {
  if (state.saidAs === '' || ports.dataRoot() === '') return
  const who = state.saidAs
  state.saidAs = ''
  state.saidAt = 0
  try {
    await updateJson(ports.store(), sessionsPath(ports.dataRoot()), parseSessions, book => withdrawn(book, who))
    ports.trace('state', 'said off', () => ({ session: who }))
  } catch (error) {
    ports.fail('could not take back that the tutor is on here', error)
  }
}

/**
 * Whether the session still draws anywhere. One that began in a terminal and
 * finds nowhere twice running is in a process its conversation has left: it
 * says goodbye and lays everything down. Answers false when it did.
 */
export async function checkBound(ports: CarryPorts, state: CarryState): Promise<boolean> {
  // Only a terminal session is gone for good once it draws nowhere, so no other is asked.
  if (ports.mode() === 'off' || !state.isTerminal) return true
  let surfaces: number
  try {
    surfaces = await ports.surfaces()
  } catch {
    // It cannot be told, so nothing changes.
    return true
  }
  const bound = boundOf({ surfaces, wasUnsure: state.wasUnsure, isTerminal: state.isTerminal })
  if (bound === 'drawn') {
    state.wasUnsure = false

    return true
  }
  if (bound === 'unsure') {
    state.wasUnsure = true
    ports.deadline.set('bound', (await ports.now()) + RECHECK_MS, () => checkBound(ports, state))

    return true
  }
  state.wasUnsure = false
  ports.trace('state', 'nowhere to draw', () => ({ session: state.saidAs }))
  await sayLeft(ports, state)
  await ports.standDown()

  return false
}

/**
 * What a session with the tutor on looks at about itself, every
 * `SELF_CHECK_MS`: whether it still draws anywhere, and whether it is time to
 * say again that it is on. `also` is the host's own share of the look.
 */
export async function checkSelf(ports: CarryPorts, state: CarryState, also: () => Promise<void>): Promise<void> {
  if (ports.mode() === 'off') return
  if (!(await checkBound(ports, state))) return
  await sayOn(ports, state, false)
  try {
    await also()
  } catch (error) {
    // Whatever went wrong there, the next look still has to come.
    ports.fail('could not finish the look at itself', error)
  }
  if (ports.mode() === 'off') return
  ports.deadline.set('self', (await ports.now()) + SELF_CHECK_MS, () => checkSelf(ports, state, also))
}

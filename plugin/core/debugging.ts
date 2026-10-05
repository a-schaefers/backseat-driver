/**
 * Running the debug log: noting what the tutor does, writing it out a moment
 * later, starting and stopping this session's log, and the `/bsd debug`
 * command. The log's own parts (records, chunks, the ring, the tracer) are
 * `debuglog.ts`. This is the engine around them; the host gives it
 * `DebuggingPorts`, and what it remembers is
 * `DebuggingState`.
 *
 * Moved out of `hooks/register.tsx` with each call made in the order it was
 * made there. What the tutor's state is (`fullState`) is the host's.
 */

import { debugRoot, debugSwitchPath } from './datahome'
import { createDebugLog, createTracer, FLUSH_MS, parseSwitch, sessionFolder } from './debuglog'
import type { DebugRequest, Tracer } from './debuglog'
import type { Settings } from './settings'

/** What running the debug log remembers. */
export type DebuggingState = {
  /** Keeps the latest records in memory, and writes every one of them to a file while the log is on. */
  tracer: Tracer
  /** The write that is due `FLUSH_MS` after something was noted, while one is waiting. */
  flushTimer: { cancel: () => void } | null
  /** The tutor's state as last written beside the log, so that it is written again only when it changes. */
  stateWritten: string
}

export function freshDebuggingState(now: () => number): DebuggingState {
  return { tracer: createTracer(now), flushTimer: null, stateWritten: '' }
}

/** What running the debug log needs from its host. Each is read or done when it is needed. */
export type DebuggingPorts = {
  /** The settings the log starts by writing down. Null where a caller does not start or command it. */
  settings: Settings | null
  now: () => Promise<number>
  /** Runs `run` after `ms`, once. */
  after: (ms: number, run: () => void) => { cancel: () => void }
  read: (path: string) => Promise<string>
  write: (path: string, text: string) => Promise<void>
  list: (path: string) => Promise<{ name: string }[]>
  /** Deletes a folder of the data folder. False when it could not. */
  remove: (path: string) => Promise<boolean>
  /** Makes the data folder's marker, so that anything may be written to it. */
  markHome: () => Promise<void>
  /** Works out where the data folder is, when that is not known yet. */
  resolveHome: () => Promise<void>
  dataRoot: () => string
  repoRoot: () => string
  mode: () => string
  sessionId: () => Promise<string>
  /** The versions of Claude Code and of the plugin (null when it cannot be read), the plugin's folder. */
  versions: () => Promise<{ claudeCode: unknown; plugin: string | null }>
  pluginRoot: () => string
  /** The tutor's whole state: what is held in memory, and what the pane is drawn from. */
  fullState: () => Promise<Record<string, unknown>>
  /** Says something where only the log's developer reads it. */
  log: (text: string) => void
}

/** Records one thing the tutor did. Its details are worked out only while the debug log is on. */
export function trace(
  ports: DebuggingPorts,
  state: DebuggingState,
  kind: string,
  name: string,
  detail?: () => unknown,
  ms?: number,
): void {
  state.tracer.note(kind, name, detail, ms)
  if (!state.tracer.isOn() || state.flushTimer !== null) return
  state.flushTimer = ports.after(FLUSH_MS, () => {
    state.flushTimer = null
    void flushDebug(ports, state)
  })
}

/** Writes the debug log and, beside it, the tutor's whole state as it stands. */
export async function flushDebug(ports: DebuggingPorts, state: DebuggingState): Promise<void> {
  const log = state.tracer.log()
  if (log === null) return
  await log.flush()
  try {
    const text = JSON.stringify(await ports.fullState(), null, 1)
    if (text === state.stateWritten) return
    state.stateWritten = text
    await ports.write(`${log.dir()}/state.json`, `${text}\n`)
  } catch {
    // The state file is a convenience. The log itself has been written.
  }
}

/** Whether the debug log's switch in the data folder says on. */
async function isDebugSwitchedOn(ports: DebuggingPorts): Promise<boolean> {
  try {
    return parseSwitch(JSON.parse(await ports.read(debugSwitchPath(ports.dataRoot()))))
  } catch {
    // No switch, or not JSON: off.
    return false
  }
}

/** The names in a folder of the debug log, or none when it is not there. */
async function debugNames(ports: DebuggingPorts, path: string): Promise<string[]> {
  try {
    return (await ports.list(path)).map(entry => entry.name)
  } catch {
    return []
  }
}

/** Starts this session's debug log, when the switch in the data folder says it is on. */
export async function startDebug(ports: DebuggingPorts, state: DebuggingState): Promise<void> {
  if (state.tracer.isOn() || ports.dataRoot() === '') return
  try {
    if (!(await isDebugSwitchedOn(ports))) return
    const sessionId = await ports.sessionId()
    const root = debugRoot(ports.dataRoot())
    const dir = `${root}/${sessionFolder(await debugNames(ports, root), Date.now(), sessionId)}`
    const log = createDebugLog({ write: (path, text) => ports.write(path, text), list: path => debugNames(ports, path) }, dir)
    await ports.markHome()
    await log.open()
    state.tracer.attach(log, sessionId)
    state.stateWritten = ''
    const { claudeCode, plugin } = await ports.versions()
    trace(ports, state, 'meta', 'log started', () => ({
      sessionId,
      claudeCode,
      plugin,
      pluginRoot: ports.pluginRoot(),
      dataRoot: ports.dataRoot(),
      repoRoot: ports.repoRoot(),
      mode: ports.mode(),
      settings: ports.settings,
    }))
  } catch (error) {
    ports.log(`could not start the debug log: ${String(error)}`)
  }
}

/** Stops the debug log, writing what it still holds. */
export async function stopDebug(ports: DebuggingPorts, state: DebuggingState, why: string): Promise<void> {
  if (!state.tracer.isOn()) return
  trace(ports, state, 'meta', 'log stopped', () => ({ why }))
  state.flushTimer?.cancel()
  state.flushTimer = null
  await flushDebug(ports, state)
  state.tracer.detach()
}

/** `/bsd debug`: switches the debug log, says where it is, writes down what just happened, or deletes the logs. */
export async function debugCommand(ports: DebuggingPorts, state: DebuggingState, request: DebugRequest): Promise<string> {
  await ports.resolveHome()
  if (ports.dataRoot() === '') return 'There is no home directory, so there is nowhere to keep a debug log.'
  const root = debugRoot(ports.dataRoot())

  if (request === 'on' || request === 'off') {
    await ports.markHome()
    await ports.write(debugSwitchPath(ports.dataRoot()), `${JSON.stringify({ on: request === 'on', since: await ports.now() })}\n`)
    if (request === 'off') {
      await stopDebug(ports, state, 'switched off')

      return `The debug log is off. What was logged is kept in ${root}, and /bsd debug clear deletes it.`
    }
    if (ports.mode() !== 'off') await startDebug(ports, state)
    const where = state.tracer.log()?.dir()

    return [
      `The debug log is on. It records everything the tutor does, your code and prompts included, in ${root}.`,
      where === undefined ? 'It starts when the tutor is switched on.' : `This session writes ${where}.`,
    ].join(' ')
  }

  if (request === 'status') {
    const isOn = await isDebugSwitchedOn(ports)
    const where = state.tracer.log()?.current()

    return [
      `The debug log is ${isOn ? 'on' : 'off'}.`,
      where !== undefined ? `This session is writing ${where}.` : isOn ? 'It starts when the tutor is switched on.' : '',
      `Logs are kept in ${root}.`,
    ]
      .filter(part => part !== '')
      .join(' ')
  }

  if (request === 'dump') {
    const latest = state.tracer.ring()
    const path = `${root}/dump-${sessionFolder([], Date.now(), await ports.sessionId())}.json`
    await ports.markHome()
    await ports.write(path, `${JSON.stringify({ at: await ports.now(), state: await ports.fullState(), latest }, null, 1)}\n`)

    return `Wrote the tutor's state and its latest ${latest.length} records to ${path}.`
  }

  if ((await debugNames(ports, root)).length === 0) return `There are no debug logs in ${root}.`
  const wasOn = state.tracer.isOn()
  await stopDebug(ports, state, 'the logs were deleted')
  const isGone = await ports.remove(root)
  if (wasOn) await startDebug(ports, state)
  if (!isGone) return `Could not delete ${root}. Delete it by hand.`

  return wasOn ? `Deleted every debug log in ${root}. This session carries on in a new one.` : `Deleted every debug log in ${root}.`
}

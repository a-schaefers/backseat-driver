/**
 * The sessions the tutor is on in.
 *
 * The tutor is switched on in a conversation, and Claude Code can move that
 * conversation into another process without anyone asking for a new one. A
 * left arrow on an empty prompt sends it to the background, where it goes on
 * as a fork: another id, another process, this mod loaded afresh and off. To
 * the person it is the session they were in, and the tutor has to be too.
 *
 * So each session that has the tutor on says so in `sessions.json`, with
 * the moment its conversation first began (`born`), which a conversation
 * shares with every fork and resume of it:
 *
 *   {"v": 1, "sessions": [{"session": "7717bc93-…", "born": 1791230007000,
 *     "cwd": "/abs/repo", "mode": "on", "at": 1791230307000, "leftAt": 0}]}
 *
 * A process that starts by forking or resuming reads the file once, and
 * carries the tutor on when the conversation it continues had it on a moment
 * ago. Any other session starts off, as it always did.
 *
 * The rules are the kernel's (kernel/src/Kernel/Sessions.purs), through
 * core.ts. Reading the file is here.
 */

export type SessionEntry = {
  /** Claude Code's id for the session. */
  session: string
  /** When its conversation first began: a fork and a resume keep it, `/clear` starts it over. */
  born: number
  /** The directory it runs in. */
  cwd: string
  mode: 'on' | 'paused'
  /** When the session last said so, in clock milliseconds. */
  at: number
  /** When it said goodbye: its process ended, or has nowhere left to draw. 0 while it has not. */
  leftAt: number
}

export type SessionBook = { v: 1; sessions: SessionEntry[] }

export const NO_SESSIONS: SessionBook = { v: 1, sessions: [] }

/** Whether a session still has somewhere to draw: yes, nowhere just now (look again), or nowhere twice running. */
export type Bound = 'drawn' | 'unsure' | 'gone'

export { ALIVE_MS, boundOf, carriedFrom, HANDOFF_MS, isSayDue, RECHECK_MS, saidLeft, saidOn, SAY_EVERY_MS, SELF_CHECK_MS, SESSIONS_KEEP_MS, withdrawn } from './core'

function time(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function parseEntry(stored: unknown): SessionEntry | null {
  if (typeof stored !== 'object' || stored === null) return null
  const { session, born, cwd, mode, at, leftAt } = stored as Record<string, unknown>
  const bornAt = time(born)
  const saidAt = time(at)
  if (typeof session !== 'string' || session === '' || typeof cwd !== 'string' || bornAt === null || saidAt === null) return null
  if (mode !== 'on' && mode !== 'paused') return null

  return { session, born: bornAt, cwd, mode, at: saidAt, leftAt: time(leftAt) ?? 0 }
}

/** The file as stored. Anything that is not an entry is left out, and anything that is not the file is no sessions. */
export function parseSessions(stored: unknown): SessionBook {
  if (typeof stored !== 'object' || stored === null) return NO_SESSIONS
  const { sessions } = stored as { sessions?: unknown }
  if (!Array.isArray(sessions)) return NO_SESSIONS

  return { v: 1, sessions: sessions.flatMap(entry => parseEntry(entry) ?? []) }
}

/**
 * Which session drives a project.
 *
 * The tutor can be on in two sessions in one project: two terminals, or a
 * terminal and the desktop app. If both looked at every save and reviewed
 * every commit, each note would come twice and each review would be paid for
 * twice. So one of them drives: it holds the project's lease, a small file in
 * the project's folder that names the session and when it last said so, and
 * it says so again every `LEASE_BEAT_MS`. A session that finds the lease held
 * by another is for the conversation only. It takes over when the lease is
 * given back, or has not been renewed for `LEASE_TTL_MS`, which is what a
 * session that was killed leaves behind.
 *
 * The file is changed through the store, under its lock, so of two sessions
 * that try for a free lease in the same instant exactly one gets it.
 *
 * The rules are the kernel's (kernel/src/Kernel/Lease.purs), through core.ts.
 * Reading the file is here.
 */

export type Lease = {
  v: 1
  /** The session that drives, by Claude Code's id for it. '' when nobody does. */
  session: string
  /** When that session last said so, in clock milliseconds. */
  at: number
}

export { claimed, isHeld, LEASE_BEAT_MS, LEASE_SLACK_MS, LEASE_TTL_MS, nextLeaseCheck, NO_LEASE, released } from './core'

/** The lease as stored. Anything that is not one is no lease. */
export function parseLease(stored: unknown): Lease {
  if (typeof stored !== 'object' || stored === null) return { v: 1, session: '', at: 0 }
  const { session, at } = stored as { session?: unknown; at?: unknown }

  return typeof session === 'string' && typeof at === 'number' && Number.isFinite(at) ? { v: 1, session, at } : { v: 1, session: '', at: 0 }
}

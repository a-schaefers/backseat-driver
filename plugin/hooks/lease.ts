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
 */

export type Lease = {
  v: 1
  /** The session that drives, by Claude Code's id for it. '' when nobody does. */
  session: string
  /** When that session last said so, in clock milliseconds. */
  at: number
}

/** How often the driving session renews the lease. */
export const LEASE_BEAT_MS = 20_000
/** A lease not renewed for this long is free: its session is gone. */
export const LEASE_TTL_MS = 60_000
/**
 * A waiting session looks again up to this long after the lease runs out,
 * so that several waiting ones do not all ask in the same instant.
 */
export const LEASE_SLACK_MS = 2000
/** A waiting session never looks again sooner than this. */
const SOONEST_CHECK_MS = 1000

export const NO_LEASE: Lease = { v: 1, session: '', at: 0 }

/** The lease as stored. Anything that is not one is no lease. */
export function parseLease(stored: unknown): Lease {
  if (typeof stored !== 'object' || stored === null) return NO_LEASE
  const { session, at } = stored as { session?: unknown; at?: unknown }

  return typeof session === 'string' && typeof at === 'number' && Number.isFinite(at) ? { v: 1, session, at } : NO_LEASE
}

/** Whether some session holds the lease at `now`. */
export function isHeld(lease: Lease, now: number): boolean {
  return lease.session !== '' && now - lease.at < LEASE_TTL_MS
}

/**
 * The lease after `me` has tried for it at `now`. It becomes mine, or stays
 * mine and is renewed, when it is free, has run out, or is mine already.
 * `also` is an id this same session held it under before: `/clear` gives a
 * session a new one. Held by another, it comes back as it was, the same
 * object, so that the caller can tell nothing has to be written.
 */
export function claimed(lease: Lease, me: string, now: number, also = ''): Lease {
  const isMine = lease.session === me || (also !== '' && lease.session === also)

  return isMine || !isHeld(lease, now) ? { v: 1, session: me, at: now } : lease
}

/** The lease after `me` has given it back. Another session's is left alone. */
export function released(lease: Lease, me: string): Lease {
  return lease.session === me ? NO_LEASE : lease
}

/**
 * When to look at the lease again. Holding it: in time to renew it. Waiting
 * for it: a beat from now, which is how soon a lease that was given back is
 * noticed, or the moment it runs out when that is sooner. `random` is a
 * number from 0 up to 1.
 */
export function nextLeaseCheck(lease: Lease, me: string, now: number, random: number): number {
  if (lease.session === me) return now + LEASE_BEAT_MS
  const runsOut = lease.at + LEASE_TTL_MS + Math.round(random * LEASE_SLACK_MS)

  return Math.max(now + SOONEST_CHECK_MS, Math.min(now + LEASE_BEAT_MS, runsOut))
}

/**
 * Holding a project's lease: trying for it, renewing it, giving it back, and
 * saying when this session starts or stops driving. The rules (who may take
 * it, when to look at it again) are `lease.ts`'s, from the kernel. This is
 * the engine; the program it runs in gives it `LeasePorts`, and what it
 * remembers is `LeaseState`.
 *
 * Moved out of `hooks/register.tsx` with each call made in the order it was
 * made there. What taking up or laying down the driving does to the other
 * engines (`startDriving`, `stopDriving`) is the host's: it names them all.
 */

import { leasePath } from './datahome'
import { claimed, nextLeaseCheck, parseLease, released } from './lease'
import type { Lease } from './lease'
import type { Trace } from './host'
import { updateJson } from './store'
import type { Store } from './store'

/** What holding the lease remembers. */
export type LeaseState = {
  /**
   * Whether this session drives the project's background jobs. False while
   * another session holds the lease. True where there is no lease to hold:
   * outside a repository, or with no data folder.
   */
  isDriver: boolean
  /** The id this session holds the lease under. `/clear` gives a session another id, and the lease is still its own. */
  holder: string
}

export function freshLeaseState(): LeaseState {
  return { isDriver: true, holder: '' }
}

/** What holding the lease needs from its host. Each is read or done when it is needed. */
export type LeasePorts = {
  now: () => Promise<number>
  trace: Trace
  fail: (what: string, error: unknown) => void
  /** False while the tutor is off. */
  isOn: () => boolean
  engagement: () => number
  repoRoot: () => string
  dataRoot: () => string
  /** The session's id now. */
  sessionId: () => Promise<string>
  store: () => Pick<Store, 'read' | 'update'>
  deadline: { set: (name: string, at: number, run: () => Promise<unknown> | unknown) => void }
  /** This session drives from now on, or has to stop. `run` is the switch-on it belongs to. */
  startDriving: (run: number) => Promise<void>
  stopDriving: () => Promise<void>
}

/**
 * Tries for the project's lease, or renews it, and takes up or lays down the
 * driving when that changes who drives. Called at switch-on, when the
 * `lease` deadline comes, and after `/clear`, which gives the session
 * another id.
 */
export async function keepLease(ports: LeasePorts, state: LeaseState, run: number): Promise<void> {
  if (run !== ports.engagement() || !ports.isOn()) return
  if (ports.repoRoot() === '' || ports.dataRoot() === '') {
    // No lease to hold: nothing else can be driving.
    state.isDriver = true

    return
  }
  const path = leasePath(ports.dataRoot(), ports.repoRoot())
  const me = await ports.sessionId()
  const now = await ports.now()
  let lease: Lease
  try {
    // A session that is waiting reads first: it changes nothing while the lease is held, and so takes no lock.
    // The one that drives is here to renew, and goes straight to the change.
    const seen = state.isDriver && state.holder === me ? null : parseLease(await ports.store().read(path))
    lease =
      seen !== null && claimed(seen, me, now, state.holder) === seen
        ? seen
        : await updateJson(ports.store(), path, parseLease, stored => claimed(stored, me, now, state.holder))
  } catch (error) {
    // With no lease to go by, this session carries on as it was.
    ports.fail('could not read the lease', error)
    lease = { v: 1, session: state.isDriver ? me : '', at: now }
  }
  // Switched off, or on again, while the lease was being read: whoever did that decides who drives.
  if (run !== ports.engagement()) return
  const wasDriver = state.isDriver
  state.isDriver = lease.session === me
  if (state.isDriver) state.holder = me
  ports.deadline.set('lease', nextLeaseCheck(lease, me, now, Math.random()), () => keepLease(ports, state, ports.engagement()))
  if (state.isDriver === wasDriver) return
  ports.trace('state', 'lease', () => ({ isDriver: state.isDriver, lease, me }))
  if (state.isDriver) await ports.startDriving(run)
  else await ports.stopDriving()
}

/** Gives the lease back, so that a session waiting for it does not have to wait for it to run out. */
export async function giveLease(ports: Pick<LeasePorts, 'store' | 'fail'>, path: string, holder: string): Promise<void> {
  if (holder === '') return
  try {
    await updateJson(ports.store(), path, parseLease, stored => released(stored, holder))
  } catch (error) {
    ports.fail('could not give the lease back', error)
  }
}

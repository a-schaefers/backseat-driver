import { arming, delayMs, dueNow } from './core'

/**
 * Deadlines: what the tutor has to do at a time it already knows.
 *
 * A look is due ten seconds after the last save. The next scan of the working
 * tree is due in two. A failed request is tried again at a quarter past. Each
 * is a named deadline here, and one timer is kept armed for whichever comes
 * first. Nothing ticks in between, and nothing is compared against the clock
 * over and over to find out whether its time has come.
 *
 * When to arm the timer, for how long, and which deadlines are due in what
 * order are the kernel's (kernel/src/Kernel/Schedule.purs), through core.ts.
 * The work and the timer are here.
 */

export type SchedulerPorts = {
  now: () => Promise<number>
  /** Calls `fn` once, after `ms` milliseconds, unless cancelled first. */
  after: (ms: number, fn: () => void) => { cancel: () => void }
  /** Told when a deadline's work throws. */
  fail: (name: string, error: unknown) => void
}

type Deadline = { at: number; run: (now: number) => unknown }

export function createScheduler(ports: SchedulerPorts) {
  const deadlines = new Map<string, Deadline>()
  let timer: { cancel: () => void } | null = null
  /** The time the timer is armed for, or null when none is armed. */
  let armedFor: number | null = null
  /** Counts the times the timer was asked for, so that an older request that is still reading the clock gives way. */
  let request = 0

  function listed(): { name: string; at: number }[] {
    return [...deadlines].map(([name, deadline]) => ({ name, at: deadline.at }))
  }

  /** Arms the timer for the earliest deadline, when it is not armed for that already. */
  function arm(): void {
    const arm = arming(armedFor, listed())
    if (arm.next === 'keep') return
    request += 1
    const mine = request
    timer?.cancel()
    timer = null
    armedFor = arm.next === 'arm' ? arm.at : null
    if (arm.next === 'disarm') return
    const first = arm.at
    ports
      .now()
      .then(now => {
        // Asked again while the clock was being read: the later request arms it.
        if (mine !== request) return
        timer = ports.after(delayMs(first, now), () => {
          if (mine !== request) return
          timer = null
          armedFor = null
          fire().catch(() => undefined)
        })
      })
      // A clock that refuses is a host that is gone (the module unloaded under a timer): nothing is due in it.
      .catch(() => undefined)
  }

  /** Does everything that is due, earliest first. Work that takes long is started, not waited for. */
  async function fire(): Promise<void> {
    const now = await ports.now()
    const due = dueNow(listed(), now).map(name => [name, deadlines.get(name)] as const)
    for (const [name, deadline] of due) {
      // Moved or dropped by the work of one that came before it.
      if (deadline === undefined || deadlines.get(name) !== deadline) continue
      deadlines.delete(name)
      void Promise.resolve()
        .then(() => deadline.run(now))
        .catch(error => ports.fail(name, error))
    }
    arm()
  }

  return {
    /** Does `run` at `at`, handing it the time it fires at. A deadline of the same name is replaced, so each name is one thing to do. */
    set(name: string, at: number, run: (now: number) => unknown): void {
      deadlines.set(name, { at, run })
      arm()
    },

    /** Drops a deadline. Nothing happens when there is none of that name. */
    cancel(name: string): void {
      if (deadlines.delete(name)) arm()
    },

    /** When the deadline of that name is due, or null. */
    at(name: string): number | null {
      return deadlines.get(name)?.at ?? null
    },

    /** Every deadline and when it is due, for the debug log. */
    all(): Record<string, number> {
      return Object.fromEntries([...deadlines].map(([name, deadline]) => [name, deadline.at]))
    },

    /** Drops every deadline and the timer. */
    clear(): void {
      deadlines.clear()
      arm()
    },
  }
}

export type Scheduler = ReturnType<typeof createScheduler>

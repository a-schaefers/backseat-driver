/**
 * Deadlines: what the tutor has to do at a time it already knows.
 *
 * A look is due ten seconds after the last save. The next scan of the working
 * tree is due in two. A failed request is tried again at a quarter past. Each
 * is a named deadline here, and one timer is kept armed for whichever comes
 * first. Nothing ticks in between, and nothing is compared against the clock
 * over and over to find out whether its time has come.
 */

export type SchedulerPorts = {
  now: () => Promise<number>
  /** Calls `fn` once, after `ms` milliseconds, unless cancelled first. */
  after: (ms: number, fn: () => void) => { cancel: () => void }
  /** Told when a deadline's work throws. */
  fail: (name: string, error: unknown) => void
}

type Deadline = { at: number; run: () => unknown }

export function createScheduler(ports: SchedulerPorts) {
  const deadlines = new Map<string, Deadline>()
  let timer: { cancel: () => void } | null = null
  /** The time the timer is armed for, or null when none is armed. */
  let armedFor: number | null = null
  /** Counts the times the timer was asked for, so that an older request that is still reading the clock gives way. */
  let request = 0

  function earliest(): number | null {
    let first: number | null = null
    for (const deadline of deadlines.values()) {
      if (first === null || deadline.at < first) first = deadline.at
    }

    return first
  }

  /** Arms the timer for the earliest deadline, when it is not armed for that already. */
  function arm(): void {
    const first = earliest()
    if (first === armedFor) return
    request += 1
    const mine = request
    timer?.cancel()
    timer = null
    armedFor = first
    if (first === null) return
    void ports.now().then(now => {
      // Asked again while the clock was being read: the later request arms it.
      if (mine !== request) return
      timer = ports.after(Math.max(0, first - now), () => {
        if (mine !== request) return
        timer = null
        armedFor = null
        void fire()
      })
    })
  }

  /** Does everything that is due, earliest first. Work that takes long is started, not waited for. */
  async function fire(): Promise<void> {
    const now = await ports.now()
    const due = [...deadlines].filter(([, deadline]) => deadline.at <= now).sort((a, b) => a[1].at - b[1].at)
    for (const [name, deadline] of due) {
      // Moved or dropped by the work of one that came before it.
      if (deadlines.get(name) !== deadline) continue
      deadlines.delete(name)
      void Promise.resolve()
        .then(() => deadline.run())
        .catch(error => ports.fail(name, error))
    }
    arm()
  }

  return {
    /** Does `run` at `at`. A deadline of the same name is replaced, so each name is one thing to do. */
    set(name: string, at: number, run: () => unknown): void {
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

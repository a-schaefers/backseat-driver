import { throttle, usagePressure } from './gate'

// The decisions are the kernel's (kernel/src/Kernel/Health.purs), through core.ts. The types the rest of the
// mod uses for them, and the plan's pressure, are here.
export { HEALTHY, mayAsk, outcomeOf, outcomeOfError, retryDelayMs, stepHealth, troubleOf } from './core'

/**
 * Whether Claude is answering, and when to ask again if it is not.
 *
 * Every background job (a look, a lookup, a deep review, an assessment) says
 * here how its request went. One that failed because the service is in
 * trouble stops all of them from asking for a while, a little longer after
 * each failure in a row, so that an outage costs a handful of requests and
 * not hundreds. When the wait is over, one job goes first. If it is answered,
 * everything carries on. Nothing that was waiting is dropped in the meantime.
 */

/**
 * Why a request got no usable answer.
 * `rate-limit`, `overloaded`, `server`, `offline` and `timeout` clear by
 * themselves, sooner or later. `account` does not until the person does
 * something (a login, a bill). `job` is this one job's own setting, such as a
 * model that does not exist. `reply` is an answer with nothing in it.
 */
export type Trouble = 'rate-limit' | 'overloaded' | 'server' | 'offline' | 'timeout' | 'account' | 'job' | 'reply'

/** How a request went: answered, or not, why, and the why in a few words for the person. */
export type Outcome = { ok: true } | { ok: false; trouble: Trouble; detail: string }

/** What `$.model.complete` resolves to, as far as this module reads it. */
export type ModelResult = { isAnswered: true } | { isAnswered: false; reason: string; status?: number | null; error?: string }

export type Health =
  /** Requests are being answered, as far as anyone knows. */
  | { state: 'ok' }
  /** The service is in trouble. No job asks by itself before `until`. */
  | { state: 'waiting'; trouble: Trouble; detail: string; until: number; failures: number }
  /** The wait is over. The next job that wants to ask may, and is the one that finds out. */
  | { state: 'recovering'; trouble: Trouble; detail: string; failures: number }
  /** That job is asking now. The others wait for what it finds. */
  | { state: 'probing'; trouble: Trouble; detail: string; failures: number }
  /** The account is refused. No job asks by itself until something is answered again. */
  | { state: 'blocked'; detail: string }

export type HealthEvent =
  /** A request failed. `random` is a number from 0 up to 1. `resetsAt` is when the plan's window reopens, if that is why. */
  | { type: 'failed'; trouble: Trouble; detail: string; at: number; random: number; resetsAt?: number | null }
  /** A request was answered: a background job's, or the conversation's own. */
  | { type: 'answered' }
  /** The wait is over. */
  | { type: 'due' }
  /** A job starts asking while recovering. */
  | { type: 'probing' }
  /** The job that was asking ended without saying anything about Claude: it was cut short, or what came back was its own problem. */
  | { type: 'abandoned' }

/** How close the plan's usage limit is, from the tightest window still open. */
export type Pressure = {
  /** `slowed` from 80% of a window, `held` from 95%. */
  level: 'none' | 'slowed' | 'held'
  /** How much of that window is used, 0 to 100. */
  percent: number
  /** Which window: `five_hour`, `seven_day`. '' with no reading. */
  window: string
  /** When that window reopens, in clock milliseconds, or null when Claude Code does not say. */
  resetsAt: number | null
}

export const NO_PRESSURE: Pressure = { level: 'none', percent: 0, window: '', resetsAt: null }

/**
 * The plan's pressure from the windows Claude Code reports. A window whose
 * reset time has passed is left out: its figure is from before it reopened,
 * and no newer one arrives until something is asked.
 */
export function pressureOf(limits: readonly { kind?: string; percentUsed: number; resetsAt?: string }[], now: number): Pressure {
  const open = limits
    .map(limit => ({ ...limit, at: limit.resetsAt === undefined ? null : Date.parse(limit.resetsAt) }))
    .map(limit => ({ ...limit, at: limit.at !== null && Number.isFinite(limit.at) ? limit.at : null }))
    .filter(limit => limit.at === null || limit.at > now)
  const percent = usagePressure(open)
  const tightest = open.find(limit => limit.percentUsed === percent)
  const { gapFactor, isHeld } = throttle(percent)

  return {
    level: isHeld ? 'held' : gapFactor !== 1 ? 'slowed' : 'none',
    percent,
    window: tightest?.kind ?? '',
    resetsAt: tightest?.at ?? null,
  }
}

/** What the minimum gap between looks is multiplied by under this pressure. */
export function gapFactorOf(pressure: Pressure): number {
  return throttle(pressure.percent).gapFactor
}

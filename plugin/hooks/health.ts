import { throttle, usagePressure } from './gate'

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

const ACCOUNT_ERRORS = ['authentication_failed', 'oauth_org_not_allowed', 'account_on_hold', 'verification_required', 'billing_error']
const JOB_ERRORS = ['model_not_found', 'invalid_request', 'max_output_tokens']

/** The trouble behind one of Claude Code's words for an API error. One it does not know is taken to pass. */
export function troubleOf(error: string): Trouble {
  if (error === 'rate_limit') return 'rate-limit'
  if (error === 'overloaded') return 'overloaded'
  if (ACCOUNT_ERRORS.includes(error)) return 'account'
  if (JOB_ERRORS.includes(error)) return 'job'

  return 'server'
}

/** How a model call went. */
export function outcomeOf(result: ModelResult): Outcome {
  if (result.isAnswered) return { ok: true }
  if (result.reason === 'aborted') return { ok: false, trouble: 'timeout', detail: 'timed out' }
  if (result.reason !== 'api-error') return { ok: false, trouble: 'reply', detail: 'empty reply' }
  // No status at all: the request never reached the service, or its answer never came back.
  if (result.status === null || result.status === undefined) return { ok: false, trouble: 'offline', detail: 'no connection' }
  const error = result.error ?? 'unknown'

  return { ok: false, trouble: troubleOf(error), detail: error === 'unknown' ? `error ${result.status}` : error.replaceAll('_', ' ') }
}

/** How an API error that ended a turn, the conversation's or a subagent's, counts. */
export function outcomeOfError(error: string): Outcome {
  return { ok: false, trouble: troubleOf(error), detail: error.replaceAll('_', ' ') }
}

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

export const HEALTHY: Health = { state: 'ok' }

export type HealthEvent =
  /** A request failed. `random` is a number from 0 up to 1. `resetsAt` is when the plan's window reopens, if that is why. */
  | { type: 'failed'; trouble: Trouble; detail: string; at: number; random: number; resetsAt?: number | null }
  /** A request was answered: a background job's, or the conversation's own. */
  | { type: 'answered' }
  /** The wait is over. */
  | { type: 'due' }
  /** A job starts asking while recovering. */
  | { type: 'probing' }

const FIRST_WAIT_MS = 30_000
/** With no connection, or no answer in time, the first retry comes sooner: a dropped connection is often back at once. */
const FIRST_WAIT_OFFLINE_MS = 15_000
const LONGEST_WAIT_MS = 600_000
/** After a plan window reopens, a retry waits up to this much longer, so that every session does not ask in the same second. */
const RESET_SLACK_MS = 30_000

/**
 * How long to wait after the nth failure in a row: 30 seconds, doubling, ten
 * minutes at most, and somewhere in the upper half of that, so that several
 * sessions do not all come back at the same moment.
 */
export function retryDelayMs(trouble: Trouble, failures: number, random: number): number {
  const first = trouble === 'offline' || trouble === 'timeout' ? FIRST_WAIT_OFFLINE_MS : FIRST_WAIT_MS
  const whole = Math.min(LONGEST_WAIT_MS, first * 2 ** Math.max(0, failures - 1))

  return Math.round(whole / 2 + (random * whole) / 2)
}

export function stepHealth(health: Health, event: HealthEvent): Health {
  switch (event.type) {
    case 'answered':
      return HEALTHY
    case 'due':
      return health.state === 'waiting' ? { state: 'recovering', trouble: health.trouble, detail: health.detail, failures: health.failures } : health
    case 'probing':
      return health.state === 'recovering' ? { ...health, state: 'probing' } : health
    case 'failed': {
      if (event.trouble === 'account') return { state: 'blocked', detail: event.detail }
      // Not the service's doing: the job that asked deals with it.
      if (event.trouble === 'job' || event.trouble === 'reply') return health
      if (health.state === 'blocked') return health
      const failures = health.state === 'ok' ? 1 : health.failures + 1
      const reopens = event.trouble === 'rate-limit' && typeof event.resetsAt === 'number' && event.resetsAt > event.at ? event.resetsAt : null
      const until =
        reopens !== null
          ? reopens + Math.round(event.random * RESET_SLACK_MS)
          : event.at + retryDelayMs(event.trouble, failures, event.random)
      // A failure reported while already waiting never brings the retry forward.
      const kept = health.state === 'waiting' ? Math.max(health.until, until) : until

      return { state: 'waiting', trouble: event.trouble, detail: event.detail, until: kept, failures }
    }
  }
}

/** Whether a job may ask by itself now. What the person asks for is always tried. */
export function mayAsk(health: Health): boolean {
  return health.state === 'ok' || health.state === 'recovering'
}

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

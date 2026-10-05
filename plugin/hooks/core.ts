import type { Health, HealthEvent, ModelResult, Outcome, Trouble } from './health'
import * as K from './kernel.js'
import type { HealthWire } from './kernel.js'

/**
 * The one bridge between the kernel and the rest of the mod.
 *
 * The kernel is PureScript (kernel/src in the repository), compiled into
 * kernel.js. Its types carry the rules: a state that cannot happen cannot be
 * built there, and a transition that is not handled does not compile. What
 * crosses to TypeScript is plain data, and this file is where it crosses:
 * PureScript's curried functions are called here, and the flat records the
 * kernel speaks are turned into the tagged unions the rest of the mod uses,
 * and back. Nothing else imports kernel.js.
 *
 * Keep this file thin. A decision made here is a decision the kernel's types
 * did not check.
 */

export const HEALTHY: Health = { state: 'ok' }

function healthToWire(health: Health): HealthWire {
  switch (health.state) {
    case 'ok':
      return { state: 'ok', trouble: '', detail: '', until: 0, failures: 0 }
    case 'waiting':
      return { state: 'waiting', trouble: health.trouble, detail: health.detail, until: health.until, failures: health.failures }
    case 'recovering':
    case 'probing':
      return { state: health.state, trouble: health.trouble, detail: health.detail, until: 0, failures: health.failures }
    case 'blocked':
      return { state: 'blocked', trouble: '', detail: health.detail, until: 0, failures: 0 }
  }
}

function healthFromWire(wire: HealthWire): Health {
  const trouble = wire.trouble as Trouble
  switch (wire.state) {
    case 'waiting':
      return { state: 'waiting', trouble, detail: wire.detail, until: wire.until, failures: wire.failures }
    case 'recovering':
      return { state: 'recovering', trouble, detail: wire.detail, failures: wire.failures }
    case 'probing':
      return { state: 'probing', trouble, detail: wire.detail, failures: wire.failures }
    case 'blocked':
      return { state: 'blocked', detail: wire.detail }
    default:
      return HEALTHY
  }
}

function isSameHealth(a: HealthWire, b: HealthWire): boolean {
  return a.state === b.state && a.trouble === b.trouble && a.detail === b.detail && a.until === b.until && a.failures === b.failures
}

/**
 * The health after an event. When the event changes nothing, the health that
 * was passed in comes back, the same object, so that the caller can tell.
 */
export function stepHealth(health: Health, event: HealthEvent): Health {
  const before = healthToWire(health)
  const failed = event.type === 'failed' ? event : null
  const after = K.stepWire(before)({
    kind: event.type,
    trouble: failed?.trouble ?? '',
    detail: failed?.detail ?? '',
    at: failed?.at ?? 0,
    random: failed?.random ?? 0,
    hasResetsAt: typeof failed?.resetsAt === 'number',
    resetsAt: typeof failed?.resetsAt === 'number' ? failed.resetsAt : 0,
  })

  return isSameHealth(before, after) ? health : healthFromWire(after)
}

/** Whether a job may ask by itself now. What the person asks for is always tried. */
export function mayAsk(health: Health): boolean {
  return K.mayAskWire(healthToWire(health))
}

/**
 * How long to wait after the nth failure in a row: 30 seconds, doubling, ten
 * minutes at most, and somewhere in the upper half of that.
 */
export function retryDelayMs(trouble: Trouble, failures: number, random: number): number {
  return K.retryDelayMsWire(trouble)(Math.trunc(failures))(random)
}

/** The trouble behind one of Claude Code's words for an API error. One it does not know is taken to pass. */
export function troubleOf(error: string): Trouble {
  return K.troubleOfWire(error) as Trouble
}

function outcomeFromWire(wire: K.OutcomeWire): Outcome {
  return wire.ok ? { ok: true } : { ok: false, trouble: wire.trouble as Trouble, detail: wire.detail }
}

/** How a model call went. */
export function outcomeOf(result: ModelResult): Outcome {
  if (result.isAnswered) return { ok: true }
  const status = typeof result.status === 'number' && Number.isFinite(result.status) ? Math.trunc(result.status) : null

  return outcomeFromWire(
    K.outcomeOfWire({ isAnswered: false, reason: result.reason, hasStatus: status !== null, status: status ?? 0, error: result.error ?? '' }),
  )
}

/** How an API error that ended a turn, the conversation's or a subagent's, counts. */
export function outcomeOfError(error: string): Outcome {
  return outcomeFromWire(K.outcomeOfErrorWire(error))
}

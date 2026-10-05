/**
 * What kernel.js exports: the kernel of the mod, compiled from PureScript
 * (kernel/src in the repository, entry `Kernel.Main`). Functions are curried,
 * as PureScript's are, and take and return plain records. Only core.ts
 * imports this.
 */

/** Every field is always there. The ones a state does not have are empty. */
export type HealthWire = { state: string; trouble: string; detail: string; until: number; failures: number }
/** `kind` is `failed`, `answered`, `due`, `probing` or `abandoned`. */
export type HealthEventWire = {
  kind: string
  trouble: string
  detail: string
  at: number
  random: number
  hasResetsAt: boolean
  resetsAt: number
}
export type ResultWire = { isAnswered: boolean; reason: string; hasStatus: boolean; status: number; error: string }
export type OutcomeWire = { ok: boolean; trouble: string; detail: string }

export const stepWire: (health: HealthWire) => (event: HealthEventWire) => HealthWire
export const mayAskWire: (health: HealthWire) => boolean
export const retryDelayMsWire: (trouble: string) => (failures: number) => (random: number) => number
export const troubleOfWire: (error: string) => string
export const outcomeOfWire: (result: ResultWire) => OutcomeWire
export const outcomeOfErrorWire: (error: string) => OutcomeWire

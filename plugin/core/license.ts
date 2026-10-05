/**
 * Personal or commercial use, and the commercial key. Light by design: the
 * person says once how they use the tutor, a commercial user pastes a key,
 * and nothing ever stops working. Where they stand only picks a line for the
 * pane (`licenseLine`), and most of the time that line is empty.
 *
 * Kept in `license.json` in the data folder, beside the profiles: it is about
 * the person, not a project, and it outlives a reinstall. The decisions (the
 * standing, when to ask the server) are the kernel's (`Kernel.License`).
 */

import { licenseStanding, nextLicenseCheck } from './core'
import type { KeyCheck } from './licensekey'

export { licenseStanding, nextLicenseCheck }

export type Use = 'personal' | 'commercial'

/** What the server last said about the key. */
export type Answer = 'active' | 'revoked' | 'unknown'

/** `license.json`. */
export type LicenseRecord = {
  v: 1
  /** Null until the person says. */
  use: Use | null
  /** Whether the question was put to them, answered or not. It is never put again unprompted. */
  isAsked: boolean
  /** The key as pasted, cleaned, or ''. */
  key: string
  /** When the key was pasted. */
  keySince: number
  answer: Answer | null
  answeredAt: number
  triedAt: number
}

export const NO_LICENSE: LicenseRecord = { v: 1, use: null, isAsked: false, key: '', keySince: 0, answer: null, answeredAt: 0, triedAt: 0 }

export type Standing = 'unchosen' | 'personal' | 'licensed' | 'needs-key' | 'bad-key' | 'expired' | 'withdrawn' | 'unchecked'

/** What the kernel decides from. */
export type LicenseFacts = {
  use: string
  key: string
  expiresAt: number
  keySince: number
  hasServer: boolean
  answer: string
  answeredAt: number
  triedAt: number
  now: number
}

/**
 * Where the license server answers, or '' while there is none. With none,
 * nothing is ever sent anywhere about a key. It answers
 * `GET <server>/v1/keys/<id>` with `{ "status": "active" | "revoked" | "unknown" }`.
 */
export const LICENSE_SERVER = ''

/** Where commercial licenses will be sold. Nowhere yet. */
export const BUY_URL = ''

function isUse(value: unknown): value is Use {
  return value === 'personal' || value === 'commercial'
}

function isAnswer(value: unknown): value is Answer {
  return value === 'active' || value === 'revoked' || value === 'unknown'
}

function numberOr(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** `license.json` as read, or nothing chosen for anything that is not one. */
export function parseLicense(data: unknown): LicenseRecord {
  if (typeof data !== 'object' || data === null) return NO_LICENSE
  const record = data as Record<string, unknown>

  return {
    v: 1,
    use: isUse(record.use) ? record.use : null,
    isAsked: record.isAsked === true,
    key: typeof record.key === 'string' ? record.key : '',
    keySince: numberOr(record.keySince),
    answer: isAnswer(record.answer) ? record.answer : null,
    answeredAt: numberOr(record.answeredAt),
    triedAt: numberOr(record.triedAt),
  }
}

/** The record with a new key: what the server said about the old one no longer applies. */
export function withKey(record: LicenseRecord, key: string, now: number): LicenseRecord {
  return { ...record, use: 'commercial', isAsked: true, key, keySince: now, answer: null, answeredAt: 0, triedAt: 0 }
}

/** The facts for the kernel. `check` is what the plugin made of the key, null when there is none. */
export function licenseFacts(record: LicenseRecord, check: KeyCheck | null, now: number, hasServer: boolean): LicenseFacts {
  return {
    use: record.use ?? '',
    key: check === null ? 'none' : check.state,
    expiresAt: check === null || check.state === 'malformed' ? 0 : check.payload.exp,
    keySince: record.keySince,
    hasServer,
    answer: record.answer ?? '',
    answeredAt: record.answeredAt,
    triedAt: record.triedAt,
    now,
  }
}

/** The question put once, at the first switch-on. */
export const USE_QUESTION = 'How are you using Backseat Driver?'
export const USE_HEADER = 'License'
export const PERSONAL_CHOICE = 'Personal: learning, hobby or unpaid open source (free)'
export const COMMERCIAL_CHOICE = 'Commercial: for a business, paid work or a paid product'
export const USE_CHOICES: readonly string[] = [PERSONAL_CHOICE, COMMERCIAL_CHOICE]

export const KEY_QUESTION = 'Paste your commercial license key, or pick an answer.'
export const KEY_HEADER = 'License key'
export const LATER_CHOICE = 'Add it later with /bsd license <key>'
export const KEY_CHOICES: readonly string[] = [LATER_CHOICE]

/** An answer to the use question as a use, or null for anything else. */
export function useOfAnswer(answer: string): Use | null {
  if (answer === PERSONAL_CHOICE) return 'personal'
  if (answer === COMMERCIAL_CHOICE) return 'commercial'

  return null
}

/** What `/bsd license <words>` asks for. */
export type LicenseRequest = { kind: 'status' } | { kind: 'use'; use: Use } | { kind: 'key'; key: string } | { kind: 'clear-key' }

export function parseLicenseRequest(rest: string): LicenseRequest {
  const words = rest.trim()
  const word = words.toLowerCase()
  if (word === '' || word === 'status') return { kind: 'status' }
  if (word === 'personal') return { kind: 'use', use: 'personal' }
  if (word === 'commercial') return { kind: 'use', use: 'commercial' }
  if (word === 'clear' || word === 'remove') return { kind: 'clear-key' }

  return { kind: 'key', key: words }
}

function day(at: number): string {
  return new Date(at).toISOString().slice(0, 10)
}

const BUY = BUY_URL === '' ? '' : ` ${BUY_URL}`

/** The pane's line for a standing, or '' for none. It never asks twice for the same thing in different words. */
export function licenseLine(standing: Standing, check: KeyCheck | null, record: LicenseRecord): string {
  switch (standing) {
    case 'needs-key':
      return `Commercial use: add your license key with /bsd license <key>.${BUY}`
    case 'bad-key':
      return 'That license key does not check out. /bsd license <key> tries another.'
    case 'expired':
      return check !== null && check.state !== 'malformed' ? `Your commercial license ended on ${day(check.payload.exp)}. Renewing it keeps the lights on.${BUY}` : ''
    case 'withdrawn':
      return 'This license key has been withdrawn. /bsd license <key> adds another.'
    case 'unchecked':
      return `The license server has not answered since ${day(Math.max(record.answeredAt, record.keySince))}. Nothing changes; it keeps trying.`
    case 'unchosen':
    case 'personal':
    case 'licensed':
      return ''
  }
}

/** What `/bsd license` says about where the person stands. */
export function licenseStatus(standing: Standing, check: KeyCheck | null): string {
  const holder = check !== null && check.state !== 'malformed' ? ` for ${check.payload.to}, ${check.payload.seats} seat${check.payload.seats === 1 ? '' : 's'}` : ''
  switch (standing) {
    case 'unchosen':
      return 'Not chosen yet. /bsd license personal or /bsd license commercial.'
    case 'personal':
      return 'Personal use: free. /bsd license commercial if that changes.'
    case 'licensed':
      return `Commercial use, licensed${holder}. Thank you.`
    case 'needs-key':
      return `Commercial use, no key yet. /bsd license <key> adds one.${BUY}`
    case 'bad-key':
      return 'Commercial use, and the key does not check out. /bsd license <key> tries another.'
    case 'expired':
      return `Commercial use, and the key${holder} has run out.${BUY}`
    case 'withdrawn':
      return `Commercial use, and the key${holder} was withdrawn.`
    case 'unchecked':
      return `Commercial use, licensed${holder}. The license server has not answered for a while, which changes nothing.`
  }
}

/** The address to ask about a key. */
export function checkUrl(server: string, id: string): string {
  return `${server.replace(/\/+$/, '')}/v1/keys/${encodeURIComponent(id)}`
}

/** The server's answer, or null for anything that is not one (which counts as no answer). */
export function parseAnswer(status: number, text: string): Answer | null {
  if (status === 404) return 'unknown'
  if (status < 200 || status >= 300) return null
  try {
    const data = JSON.parse(text) as { status?: unknown }

    return isAnswer(data.status) ? data.status : null
  } catch {
    return null
  }
}

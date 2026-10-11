/**
 * Personal or commercial use, and the commercial key. Light by design: the
 * person says once how they use the tutor, a commercial user pastes a key,
 * and nothing ever stops working. Where they stand only picks a line for the
 * pane (`licenseLine`), and most of the time that line is empty.
 *
 * Never a false alarm for someone whose company paid: seats are on the honor
 * system, and installs can't tell people from machines, so the pane asks for
 * more seats only when the license server says the license has outgrown them
 * (installs far beyond its seats for two weeks; the server writes to the buyer
 * too), nothing when the server can't be reached, and "withdrawn" only when
 * the server says the whole license is.
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
  /** This install's anonymous id: random, made once, sent with the check so the server can count the license's installs. */
  install: string
  /** The license's seats from the server's last answer, which can be more than this key's after seats were added; 0 when unknown. */
  seats: number
  /** Whether the server's last answer said the license has outgrown its seats. */
  isOutgrown: boolean
}

export const NO_LICENSE: LicenseRecord = { v: 1, use: null, isAsked: false, key: '', keySince: 0, answer: null, answeredAt: 0, triedAt: 0, install: '', seats: 0, isOutgrown: false }

const INSTALL_ID = /^[A-Za-z0-9_-]{8,64}$/

/** A new anonymous install id from 16 random bytes (`crypto.getRandomValues`, or `Math.random` where that is missing). */
export function newInstall(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export type Standing = 'unchosen' | 'personal' | 'licensed' | 'needs-key' | 'bad-key' | 'expired' | 'withdrawn' | 'outgrown' | 'unchecked'

/** What the kernel decides from. */
export type LicenseFacts = {
  use: string
  key: string
  expiresAt: number
  keySince: number
  hasServer: boolean
  answer: string
  isOutgrown: boolean
  answeredAt: number
  triedAt: number
  now: number
}

/**
 * Where the license server answers, or '' for none (then nothing is ever sent
 * anywhere about a key). It answers `GET <server>/v1/keys/<id>` with
 * `{ "status": "active" | "revoked" | "unknown", "seats", "outgrown" }`.
 */
export const LICENSE_SERVER: string = 'https://licenses.adamschaefers.com'

/** Where commercial licenses are sold, and seats added. */
export const BUY_URL: string = 'https://adamschaefers.com/backseat-driver/'

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
    install: typeof record.install === 'string' && INSTALL_ID.test(record.install) ? record.install : '',
    seats: numberOr(record.seats),
    isOutgrown: record.isOutgrown === true,
  }
}

/** The record with a new key: what the server said about the old one no longer applies. */
export function withKey(record: LicenseRecord, key: string, now: number): LicenseRecord {
  return { ...record, use: 'commercial', isAsked: true, key, keySince: now, answer: null, answeredAt: 0, triedAt: 0, seats: 0, isOutgrown: false }
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
    isOutgrown: record.isOutgrown,
    answeredAt: record.answeredAt,
    triedAt: record.triedAt,
    now,
  }
}

/** The question put once, at the first switch-on. */
export const USE_QUESTION = 'How are you using Backseat Driver?'
export const USE_HEADER = 'License'
export const PERSONAL_CHOICE = 'Personal: your own learning, hobby or unpaid open source (free)'
export const COMMERCIAL_CHOICE = 'Commercial: for or through a business (training too), paid work or a paid product'
export const USE_CHOICES: readonly string[] = [PERSONAL_CHOICE, COMMERCIAL_CHOICE]

export const KEY_QUESTION = 'Paste your commercial license key, or pick an answer.'
export const KEY_HEADER = 'License key'
export const LATER_CHOICE = 'Add it later with /backseat license <key>'
export const KEY_CHOICES: readonly string[] = [LATER_CHOICE]

/** An answer to the use question as a use, or null for anything else. */
export function useOfAnswer(answer: string): Use | null {
  if (answer === PERSONAL_CHOICE) return 'personal'
  if (answer === COMMERCIAL_CHOICE) return 'commercial'

  return null
}

/** What `/backseat license <words>` asks for. */
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

const SUPPORT = 'https://adamschaefers.com/#inquiries'

/** The license's seats: the server's when it said (they grow when seats are added), else the key's; 0 for no key. */
function seatsOf(check: KeyCheck | null, record: LicenseRecord): number {
  if (check === null || check.state === 'malformed') return 0

  return record.seats > 0 ? record.seats : check.payload.seats
}

function seatsText(seats: number): string {
  return `${seats} seat${seats === 1 ? '' : 's'}`
}

/** "for Acme Ltd, 12 seats": the licensee from the key, and the license's seats. */
function holderOf(check: KeyCheck | null, record: LicenseRecord): string {
  if (check === null || check.state === 'malformed') return ''

  return ` for ${check.payload.to}, ${seatsText(seatsOf(check, record))}`
}

/** "more than 3 people use it", "more than one person uses it". */
function moreThan(seats: number): string {
  return seats === 1 ? 'more than one person uses it' : `more than ${seats} people use it`
}

/** The pane's ask when a license has outgrown its seats. Seats are on the honor system, so it asks, and allows that installs aren't people. */
function moreSeats(check: KeyCheck | null, record: LicenseRecord): string {
  const seats = seatsOf(check, record)

  return seats > 0
    ? `This license has ${seatsText(seats)} and far more installs. If ${moreThan(seats)}, please add seats.${BUY}`
    : `This license has far more installs than seats. If more people use it than it has seats, please add seats.${BUY}`
}

/** The pane's line for a standing, or '' for none. It never asks twice for the same thing in different words. */
export function licenseLine(standing: Standing, check: KeyCheck | null, record: LicenseRecord): string {
  switch (standing) {
    case 'needs-key':
      return `Commercial use: add your license key with /backseat license <key>.${BUY}`
    case 'bad-key':
      return 'That license key does not check out. /backseat license <key> tries another.'
    case 'expired':
      return check !== null && check.state !== 'malformed' ? `Your commercial license ended on ${day(check.payload.exp)}. Renewing it keeps the lights on.${BUY}` : ''
    case 'withdrawn':
      return `This license was withdrawn (refunded, for one). If that's a mistake: ${SUPPORT}`
    case 'outgrown':
      return moreSeats(check, record)
    // A server that can't be reached, a firewall in the way: nothing the person can or should do.
    case 'unchecked':
    case 'licensed':
    case 'unchosen':
    case 'personal':
      return ''
  }
}

/** What `/backseat license` says about where the person stands. */
export function licenseStatus(standing: Standing, check: KeyCheck | null, record: LicenseRecord = NO_LICENSE): string {
  const holder = holderOf(check, record)
  switch (standing) {
    case 'unchosen':
      return 'Not chosen yet. /backseat license personal or /backseat license commercial.'
    case 'personal':
      return 'Personal use: free. /backseat license commercial if that changes.'
    case 'licensed':
      return `Commercial use, licensed${holder}. Thank you.`
    case 'needs-key':
      return `Commercial use, no key yet. /backseat license <key> adds one.${BUY}`
    case 'bad-key':
      return 'Commercial use, and the key does not check out. /backseat license <key> tries another.'
    case 'expired':
      return `Commercial use, and the key${holder} has run out.${BUY}`
    case 'withdrawn':
      return `Commercial use, and the license${holder} was withdrawn. If that's a mistake: ${SUPPORT}`
    case 'outgrown': {
      const seats = seatsOf(check, record)

      return seats > 0
        ? `Commercial use, licensed${holder}. Thank you. Far more installs than that check in with it, though: if ${moreThan(seats)}, please add seats.${BUY}`
        : `Commercial use, licensed. ${moreSeats(check, record)}`
    }
    case 'unchecked':
      return `Commercial use, licensed${holder}. Thank you. (The license server hasn't been reached since ${day(Math.max(record.answeredAt, record.keySince))}; that changes nothing.)`
  }
}

/** The address to ask about a key, with this install's anonymous id when there is one. */
export function checkUrl(server: string, id: string, install = ''): string {
  const url = `${server.replace(/\/+$/, '')}/v1/keys/${encodeURIComponent(id)}`

  return install === '' ? url : `${url}?install=${encodeURIComponent(install)}`
}

/** The license's seats in the server's answer, or 0 when it doesn't say (an older server). */
export function parseSeats(status: number, text: string): number {
  if (status < 200 || status >= 300) return 0
  try {
    const seats = numberOr((JSON.parse(text) as { seats?: unknown }).seats)

    return Number.isInteger(seats) && seats > 0 ? seats : 0
  } catch {
    return 0
  }
}

/** Whether the server's answer says the license has outgrown its seats; false when it doesn't say (an older server). */
export function parseOutgrown(status: number, text: string): boolean {
  if (status < 200 || status >= 300) return false
  try {
    return (JSON.parse(text) as { outgrown?: unknown }).outgrown === true
  } catch {
    return false
  }
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

import { expect, test } from 'claude-code/testing'

import {
  checkUrl,
  COMMERCIAL_CHOICE,
  LATER_CHOICE,
  licenseFacts,
  licenseLine,
  licenseStanding,
  nextLicenseCheck,
  NO_LICENSE,
  parseAnswer,
  parseLicense,
  parseLicenseRequest,
  PERSONAL_CHOICE,
  withKey,
} from '../core/license'
import type { LicenseFacts, LicenseRecord } from '../core/license'
import { checkKey, fromBase64url, KEY_PREFIX, parseKey, verifyP256 } from '../core/licensekey'
import type { KeyPayload, PublicKey } from '../core/licensekey'
import { PANE, SESSION, sessionTest, stubSession, typed } from './kit'

/** Personal or commercial use, the commercial key, and the kernel's light touch. */

const DAY = 86_400_000

// --- Keys. The plugin's environment can check a signature but not make one, so
// these were signed once with Node's crypto, the way license-server/ signs
// them, by a test key whose private half was thrown away.

const TEST_KEY: PublicKey = {kid: 'test-1', x: 'ljY0ZN4daI87A4qNNvcqKkoagZO4mzWTnLUM1SNj0sU', y: '_HZ2JQ9G-_fU-5zx7RvD_X-Wy-CEVlHi751zofjASXY'}
const KEYS = {
  valid: 'BSD1.eyJ2IjoxLCJraWQiOiJ0ZXN0LTEiLCJpZCI6ImxpY18xMjMiLCJ0byI6IkFjbWUgTHRkIiwic2VhdHMiOjUsImlhdCI6MTAwMCwiZXhwIjowfQ.OK_4SVaCHzv_CCiVEvHJy2zIqsHeE6IeIVtuinRZITjYx3EVBby4meoauEHOgeT_jt9Iz-qkq8M94T5kDFGfgg',
  /** The same license, with a term that ends on 2027-01-01. */
  ending: 'BSD1.eyJ2IjoxLCJraWQiOiJ0ZXN0LTEiLCJpZCI6ImxpY18xMjMiLCJ0byI6IkFjbWUgTHRkIiwic2VhdHMiOjUsImlhdCI6MTAwMCwiZXhwIjoxNzk4NzYxNjAwMDAwfQ.N3v_Js6L0O3rqcDHobepUSYb3a0I-hs48P9FU-4Isx_gnDXOY-OEn_gl93ZkG4cqP_dwHDbrlaLpWHgGI-lUIA',
  /** Licensed to "Müller & Söhne GmbH". */
  unicode: 'BSD1.eyJ2IjoxLCJraWQiOiJ0ZXN0LTEiLCJpZCI6ImxpY18xMjMiLCJ0byI6Ik3DvGxsZXIgJiBTw7ZobmUgR21iSCIsInNlYXRzIjo1LCJpYXQiOjEwMDAsImV4cCI6MH0.uciBNP6xpyEpnnakC-oMapLHdVM9G8ZwKwOOQes2lZK6ic8TZV_ZVtHxtLD1nfRuRY5kAUiMI6mqIxokAk2j8A',
  /** Claims the test key's id, signed by another key. */
  otherSigner: 'BSD1.eyJ2IjoxLCJraWQiOiJ0ZXN0LTEiLCJpZCI6ImxpY18xMjMiLCJ0byI6IkFjbWUgTHRkIiwic2VhdHMiOjUsImlhdCI6MTAwMCwiZXhwIjowfQ.oizOA8TTDFbBrpfmo4qkcPzWJpT3fbH0hqM12UdaA3lumDkTJNQaw2XxLyU9BffWVpQEvTPhsnHlEKEoq5hxiQ',
  /** Signed by another key, under its own id "test-2". */
  otherKid: 'BSD1.eyJ2IjoxLCJraWQiOiJ0ZXN0LTIiLCJpZCI6ImxpY18xMjMiLCJ0byI6IkFjbWUgTHRkIiwic2VhdHMiOjUsImlhdCI6MTAwMCwiZXhwIjowfQ.1QImkYXW2u8cQdfC6ZZ9pb_XI7vpymAe0ZTJ2COhhTkKL_ys8-FbB6wgAFhyI4i_cgn0wWSAVaEU-MY1FdBa4Q',
}

function toBase64url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let out = ''
  let bits = 0
  let value = 0
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff
    bits += 8
    while (bits >= 6) {
      bits -= 6
      out += alphabet[(value >> bits) & 63]
    }
  }

  return bits > 0 ? out + alphabet[(value << (6 - bits)) & 63] : out
}

function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, char => char.charCodeAt(0))
}

const PAYLOAD: KeyPayload = { v: 1, kid: 'test-1', id: 'lic_123', to: 'Acme Ltd', seats: 5, iat: 1000, exp: 0 }

test('base64url reads back what was written, and refuses what is not base64url', async () => {
  const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253, 254, 255])
  expect(Array.from(fromBase64url(toBase64url(bytes)) ?? [])).toEqual(Array.from(bytes))
  expect(fromBase64url('a+b/')).toBe(null)
  expect(fromBase64url('abcde')).toBe(null)
})

test('a signed key is valid, a changed one is forged, and rubbish is malformed', async () => {
  expect(await checkKey(KEYS.valid, [TEST_KEY])).toEqual({ state: 'valid', payload: PAYLOAD })
  expect(await checkKey(KEYS.unicode, [TEST_KEY])).toEqual({ state: 'valid', payload: { ...PAYLOAD, to: 'Müller & Söhne GmbH' } })
  // Copying a key out of an email adds line breaks and spaces.
  expect((await checkKey(`  ${KEYS.valid.slice(0, 40)}\n${KEYS.valid.slice(40)} `, [TEST_KEY])).state).toBe('valid')

  // Someone gives themselves more seats.
  const [, , signature = ''] = KEYS.valid.split('.')
  const raised = `${KEY_PREFIX}.${toBase64url(ascii(JSON.stringify({ ...PAYLOAD, seats: 500 })))}.${signature}`
  expect((await checkKey(raised, [TEST_KEY])).state).toBe('forged')
  // A signature that is off by one bit.
  const flipped = `${KEYS.valid.slice(0, -2)}${KEYS.valid.endsWith('A') ? 'B' : 'A'}${KEYS.valid.slice(-1)}`
  expect((await checkKey(flipped, [TEST_KEY])).state).toBe('forged')
  // Signed by a key the plugin does not have.
  expect((await checkKey(KEYS.otherSigner, [TEST_KEY])).state).toBe('forged')
  expect((await checkKey(KEYS.otherKid, [TEST_KEY])).state).toBe('forged')

  expect(await checkKey('hello', [TEST_KEY])).toEqual({ state: 'malformed' })
  expect(await checkKey(`${KEY_PREFIX}.e30.${signature}`, [TEST_KEY])).toEqual({ state: 'malformed' })
  expect(parseKey(`${KEY_PREFIX}.${toBase64url(ascii(JSON.stringify(PAYLOAD)))}.short`)).toBe(null)
})

test('a public key that is not a point on the curve checks nothing', async () => {
  expect(await verifyP256({ ...TEST_KEY, y: TEST_KEY.x }, ascii('x'), new Uint8Array(64).fill(1))).toBe(false)
})

test('with no public key to check against, a well-formed key is taken on trust', async () => {
  expect(await checkKey(KEYS.valid, [])).toEqual({ state: 'unverified', payload: PAYLOAD })
  expect((await checkKey('BSD1.nope.nope', [])).state).toBe('malformed')
})

// --- The standing and the checks, decided by the kernel.

function facts(change: Partial<LicenseFacts> = {}): LicenseFacts {
  return { use: 'commercial', key: 'valid', expiresAt: 0, keySince: 0, hasServer: true, answer: 'active', answeredAt: 0, triedAt: 0, now: DAY, ...change }
}

test('where the person stands', async () => {
  expect(licenseStanding(facts({ use: '' }))).toBe('unchosen')
  expect(licenseStanding(facts({ use: 'personal', key: 'malformed' }))).toBe('personal')
  expect(licenseStanding(facts())).toBe('licensed')
  expect(licenseStanding(facts({ key: 'unverified' }))).toBe('licensed')
  expect(licenseStanding(facts({ key: 'none' }))).toBe('needs-key')
  expect(licenseStanding(facts({ key: 'malformed' }))).toBe('bad-key')
  expect(licenseStanding(facts({ key: 'forged' }))).toBe('bad-key')
  expect(licenseStanding(facts({ expiresAt: DAY }))).toBe('expired')
  expect(licenseStanding(facts({ expiresAt: DAY + 1 }))).toBe('licensed')
  expect(licenseStanding(facts({ answer: 'revoked' }))).toBe('withdrawn')
  // A server that does not know the key is behind, not a sign of forgery.
  expect(licenseStanding(facts({ answer: 'unknown' }))).toBe('licensed')
  // No answer for thirty days is mentioned, and changes nothing else.
  expect(licenseStanding(facts({ answer: '', now: 30 * DAY - 1 }))).toBe('licensed')
  expect(licenseStanding(facts({ answer: '', now: 30 * DAY }))).toBe('unchecked')
  expect(licenseStanding(facts({ answer: '', now: 30 * DAY, hasServer: false }))).toBe('licensed')
  expect(licenseStanding(facts({ answeredAt: 10 * DAY, now: 39 * DAY }))).toBe('licensed')
})

test('the server is asked about once a week, a day after a try that got no answer, and never without a key or a server', async () => {
  expect(nextLicenseCheck(facts({ triedAt: 0 }))).toBe(DAY)
  expect(nextLicenseCheck(facts({ triedAt: 5 * DAY, answeredAt: 5 * DAY }))).toBe(12 * DAY)
  expect(nextLicenseCheck(facts({ triedAt: 5 * DAY, answeredAt: 2 * DAY }))).toBe(6 * DAY)
  expect(nextLicenseCheck(facts({ use: 'personal' }))).toBe(null)
  expect(nextLicenseCheck(facts({ key: 'none' }))).toBe(null)
  expect(nextLicenseCheck(facts({ key: 'forged' }))).toBe(null)
  expect(nextLicenseCheck(facts({ hasServer: false }))).toBe(null)
})

test('over random histories, nothing but a commercial choice ever shows a line, and a check is never due in the past of its last try', async () => {
  const uses = ['', 'personal', 'commercial', 'nonsense']
  const keys = ['none', 'malformed', 'forged', 'unverified', 'valid', 'nonsense']
  const answers = ['', 'active', 'revoked', 'unknown', 'nonsense']
  let seed = 7
  const random = (): number => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31

    return seed / 2 ** 31
  }
  const pick = <T,>(from: readonly T[]): T => from[Math.floor(random() * from.length)] as T
  for (let turn = 0; turn < 2000; turn += 1) {
    const now = Math.floor(random() * 100 * DAY)
    const triedAt = random() < 0.3 ? 0 : Math.floor(random() * now)
    const f = facts({
      use: pick(uses),
      key: pick(keys),
      expiresAt: random() < 0.5 ? 0 : Math.floor(random() * 100 * DAY),
      keySince: Math.floor(random() * now),
      hasServer: random() < 0.5,
      answer: pick(answers),
      answeredAt: random() < 0.5 ? 0 : Math.floor(random() * (triedAt + 1)),
      triedAt,
      now,
    })
    const standing = licenseStanding(f)
    if (f.use !== 'commercial') expect([standing, turn]).toEqual([f.use === 'personal' ? 'personal' : 'unchosen', turn])
    const due = nextLicenseCheck(f)
    if (due !== null) {
      expect(f.hasServer).toBe(true)
      expect(due >= f.triedAt || f.triedAt === 0).toBe(true)
    }
  }
})

// --- The record, the command words, the server's answer.

test('license.json reads back, and anything else is nothing chosen', async () => {
  expect(parseLicense(null)).toEqual(NO_LICENSE)
  expect(parseLicense({ use: 'enterprise', key: 3, answer: 'maybe' })).toEqual(NO_LICENSE)
  const record: LicenseRecord = { v: 1, use: 'commercial', isAsked: true, key: 'BSD1.a.b', keySince: 5, answer: 'active', answeredAt: 6, triedAt: 6 }
  expect(parseLicense(JSON.parse(JSON.stringify(record)))).toEqual(record)
  // A new key starts over with the server.
  expect(withKey(record, 'BSD1.c.d', 9)).toEqual({ ...record, key: 'BSD1.c.d', keySince: 9, answer: null, answeredAt: 0, triedAt: 0 })
})

test('/bsd license words', async () => {
  expect(parseLicenseRequest('')).toEqual({ kind: 'status' })
  expect(parseLicenseRequest(' Personal ')).toEqual({ kind: 'use', use: 'personal' })
  expect(parseLicenseRequest('commercial')).toEqual({ kind: 'use', use: 'commercial' })
  expect(parseLicenseRequest('clear')).toEqual({ kind: 'clear-key' })
  expect(parseLicenseRequest('BSD1.abc.def')).toEqual({ kind: 'key', key: 'BSD1.abc.def' })
})

test('what the server says, and what counts as no answer', async () => {
  expect(checkUrl('https://licenses.example/', 'lic 1')).toBe('https://licenses.example/v1/keys/lic%201')
  expect(parseAnswer(200, '{"status":"active"}')).toBe('active')
  expect(parseAnswer(200, '{"status":"revoked"}')).toBe('revoked')
  expect(parseAnswer(404, 'not found')).toBe('unknown')
  expect(parseAnswer(500, '{"status":"revoked"}')).toBe(null)
  expect(parseAnswer(200, '<html>')).toBe(null)
})

test('the pane says nothing unless something needs saying', async () => {
  const check = await checkKey(KEYS.ending, [TEST_KEY])
  for (const quiet of ['unchosen', 'personal', 'licensed'] as const) expect(licenseLine(quiet, check, NO_LICENSE)).toBe('')
  expect(licenseLine('needs-key', null, NO_LICENSE)).toMatch('/bsd license <key>')
  expect(licenseLine('expired', check, NO_LICENSE)).toMatch('2027-01-01')
  expect(licenseLine('unchecked', check, { ...NO_LICENSE, keySince: Date.UTC(2026, 9, 5) })).toMatch('since 2026-10-05')
  expect(licenseFacts(NO_LICENSE, null, 5, false)).toEqual({ use: '', key: 'none', expiresAt: 0, keySince: 0, hasServer: false, answer: '', answeredAt: 0, triedAt: 0, now: 5 })
})

// --- In a session. The background question was answered long ago, so the license question is the only one.

const KNOWN = { 'profiles/general.json': { answers: {}, isAsked: true, hushed: [], topics: {} } }

sessionTest('the first switch-on asks once how it is used; personal is remembered and shows nothing', async ($, on) => {
  const session = stubSession(on, { data: KNOWN })
  session.answers.push(PERSONAL_CHOICE)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(session.asked).toEqual(['How are you using Backseat Driver?'])
  expect(session.data('license.json')).toMatchObject({ use: 'personal', isAsked: true })
  await $.command.run(typed('bsd', 'off'))
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.asked.length).toBe(1)
  expect((await $.command.run(typed('bsd', 'license'))).text).toMatch('Personal use: free.')
})

sessionTest('dismissing the question chooses nothing, asks nothing again, and the tutor works', async ($, on) => {
  const session = stubSession(on, { data: KNOWN })
  await $.session.start(SESSION)
  const started = await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(started.text).toMatch(/^Backseat Driver is on. You drive./)
  expect(session.data('license.json')).toMatchObject({ use: null, isAsked: true })
  await $.command.run(typed('bsd', 'off'))
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.asked.length).toBe(1)
})

sessionTest('commercial asks for the key; without one the pane says how to add it, and a pasted key quiets it', async ($, on) => {
  const session = stubSession(on, { data: KNOWN })
  session.answers.push(COMMERCIAL_CHOICE, LATER_CHOICE)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(session.asked).toEqual(['How are you using Backseat Driver?', 'Paste your commercial license key, or pick an answer.'])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Commercial use: add your license key/ })).toBeDefined()

  // The shipped plugin carries no public key yet, so a well-formed key is taken on trust.
  const answer = await $.command.run(typed('bsd', `license ${KEYS.valid}`))
  expect(answer.text).toBe('Commercial use, licensed for Acme Ltd, 5 seats. Thank you.')
  expect(String((session.data('license.json') as { key: string }).key).startsWith('BSD1.')).toBe(true)
  expect(await ui.find({ type: 'Text', text: /license key/ })).toBeUndefined()
  await ui.unmount()

  expect((await $.command.run(typed('bsd', 'license not-a-key'))).text).toMatch('That is not a license key')
  expect((await $.command.run(typed('bsd', 'license personal'))).text).toMatch('Personal use')
})

sessionTest('a key pasted into the first question is taken as commercial use with that key', async ($, on) => {
  const session = stubSession(on, { data: KNOWN })
  session.answers.push(KEYS.valid)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(session.asked.length).toBe(1)
  expect(session.data('license.json')).toMatchObject({ use: 'commercial', isAsked: true })
})

sessionTest('/bsd license works while the tutor is off, and asks nothing', async ($, on) => {
  const session = stubSession(on, { data: KNOWN })
  await $.session.start(SESSION)
  expect((await $.command.run(typed('bsd', 'license'))).text).toMatch('Not chosen yet.')
  expect((await $.command.run(typed('bsd', 'license commercial'))).text).toMatch('no key yet')
  expect(session.asked).toEqual([])
  expect(session.data('license.json')).toMatchObject({ use: 'commercial', isAsked: true })
})

/**
 * Commercial license keys: what one looks like, and checking its signature.
 *
 * A key is `BSD1.<payload>.<signature>`. The payload is JSON in base64url:
 * `{ v: 1, kid, id, to, seats, iat, exp }`. `kid` names the signing key, `id`
 * the license, `to` the licensee, `exp` the end of its term in epoch
 * milliseconds, or 0 for none. The signature is ECDSA P-256 with SHA-256 over
 * the payload's base64url text, as the 64 bytes of r and s.
 *
 * The plugin carries only public keys, so a key is checked offline (the
 * arithmetic is below: the mod's environment has SHA-256 and no ECDSA), and the
 * license server (license-server/ in the repository) is asked now and then
 * only whether a key was withdrawn. This file imports nothing, so that the
 * server's tests can check that what it signs is what the plugin accepts.
 */

export const KEY_PREFIX = 'BSD1'

export type KeyPayload = {
  v: 1
  /** The signing key's id, as in `PublicKey.kid`. */
  kid: string
  /** The license's id, which is what the server is asked about. */
  id: string
  /** Who the license is for. */
  to: string
  seats: number
  /** When it was issued, epoch milliseconds. */
  iat: number
  /** When its term ends, epoch milliseconds, or 0 for no end. */
  exp: number
}

/** A public key for checking signatures, as the coordinates of a P-256 JWK. */
export type PublicKey = { kid: string; x: string; y: string }

/** What a pasted key is, as far as the plugin can tell by itself. */
export type KeyCheck =
  | { state: 'malformed' }
  /** Well formed, and its signature fails, or it names a signing key the plugin does not have while it has some. */
  | { state: 'forged'; payload: KeyPayload }
  /** Well formed, and nothing to check it with: no public key, or no SHA-256. */
  | { state: 'unverified'; payload: KeyPayload }
  | { state: 'valid'; payload: KeyPayload }

/**
 * The public keys that sign commercial license keys. Empty until the owner
 * makes the first signing key (`node license-server/src/cli.ts keygen`) and
 * pastes its public half here. While it is empty, a well-formed key counts as
 * good without its signature being checked.
 */
export const PUBLIC_KEYS: readonly PublicKey[] = []

/** SHA-256, which the mod's environment promises through `crypto.subtle.digest`. Null where it is missing. */
async function sha256(bytes: Uint8Array): Promise<Uint8Array | null> {
  const subtle = (globalThis as unknown as { crypto?: { subtle?: { digest?: (algorithm: string, data: Uint8Array) => Promise<ArrayBuffer> } } }).crypto?.subtle
  if (subtle?.digest === undefined) return null

  return new Uint8Array(await subtle.digest('SHA-256', bytes))
}

// ECDSA over P-256, verification only, in BigInt. The mod's environment
// promises SHA-256 and nothing else of WebCrypto (no importKey, no verify),
// so the curve arithmetic is done here. It checks public data only: no
// secret goes near it, so it need not be constant-time.

const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n
const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn
const G: Point = {
  x: 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n,
  y: 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n,
}

type Point = { x: bigint; y: bigint } | null

function mod(a: bigint, m: bigint): bigint {
  const r = a % m

  return r < 0n ? r + m : r
}

function inverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [mod(a, m), m]
  let [oldS, s] = [1n, 0n]
  while (r !== 0n) {
    const q = oldR / r
    ;[oldR, r] = [r, oldR - q * r]
    ;[oldS, s] = [s, oldS - q * s]
  }

  return mod(oldS, m)
}

function isOnCurve(point: { x: bigint; y: bigint }): boolean {
  const { x, y } = point
  if (x < 0n || x >= P || y < 0n || y >= P) return false

  return mod(y * y - (x * x * x - 3n * x + B), P) === 0n
}

function add(a: Point, b: Point): Point {
  if (a === null) return b
  if (b === null) return a
  let slope: bigint
  if (a.x === b.x) {
    if (mod(a.y + b.y, P) === 0n) return null
    slope = mod((3n * a.x * a.x - 3n) * inverse(2n * a.y, P), P)
  } else {
    slope = mod((b.y - a.y) * inverse(b.x - a.x, P), P)
  }
  const x = mod(slope * slope - a.x - b.x, P)

  return { x, y: mod(slope * (a.x - x) - a.y, P) }
}

/** u1·G + u2·Q, both scalars at once (Shamir's trick). */
function twoTimes(u1: bigint, u2: bigint, q: Point): Point {
  const both = add(G, q)
  let result: Point = null
  for (let bit = 255n; bit >= 0n; bit -= 1n) {
    result = add(result, result)
    const one = (u1 >> bit) & 1n
    const two = (u2 >> bit) & 1n
    if (one === 1n && two === 1n) result = add(result, both)
    else if (one === 1n) result = add(result, G)
    else if (two === 1n) result = add(result, q)
  }

  return result
}

function toBig(bytes: Uint8Array): bigint {
  let value = 0n
  for (const byte of bytes) value = (value << 8n) | BigInt(byte)

  return value
}

/** Whether `signature` (r and s, 32 bytes each) signs `data` for the public key. */
export async function verifyP256(key: PublicKey, data: Uint8Array, signature: Uint8Array): Promise<boolean | null> {
  const x = fromBase64url(key.x)
  const y = fromBase64url(key.y)
  if (x === null || y === null || signature.length !== 64) return false
  const q = { x: toBig(x), y: toBig(y) }
  if (!isOnCurve(q)) return false
  const r = toBig(signature.subarray(0, 32))
  const s = toBig(signature.subarray(32))
  if (r <= 0n || r >= N || s <= 0n || s >= N) return false
  const digest = await sha256(data)
  if (digest === null) return null
  const e = toBig(digest)
  const w = inverse(s, N)
  const point = twoTimes(mod(e * w, N), mod(r * w, N), q)

  return point !== null && mod(point.x, N) === r
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** base64url (no padding) as bytes, or null when it is not base64url. */
export function fromBase64url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const char of text) {
    value = (value << 6) | ALPHABET.indexOf(char)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }

  return Uint8Array.from(bytes)
}

/** The bytes of ASCII text, which is all the signature covers. */
function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, char => char.charCodeAt(0))
}

/** Text from UTF-8 bytes, or null when they are not UTF-8. */
function fromUtf8(bytes: Uint8Array): string | null {
  try {
    return decodeURIComponent(Array.from(bytes, byte => `%${byte.toString(16).padStart(2, '0')}`).join(''))
  } catch {
    return null
  }
}

/** A pasted key, cleaned of the spaces and line breaks that copying adds. */
export function cleanKey(text: string): string {
  return text.replace(/\s+/g, '')
}

/** Whether text looks like a key at all, before anything is checked. */
export function looksLikeKey(text: string): boolean {
  return cleanKey(text).startsWith(`${KEY_PREFIX}.`)
}

/** The payload of a well-formed key, and the parts the signature covers, or null. */
export function parseKey(text: string): { payload: KeyPayload; signed: string; signature: Uint8Array } | null {
  const parts = cleanKey(text).split('.')
  if (parts.length !== 3 || parts[0] !== KEY_PREFIX) return null
  const [, signed = '', sig = ''] = parts
  const json = fromBase64url(signed)
  const signature = fromBase64url(sig)
  if (json === null || signature === null || signature.length !== 64) return null
  const decoded = fromUtf8(json)
  if (decoded === null) return null
  let data: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(decoded)
    if (typeof parsed !== 'object' || parsed === null) return null
    data = parsed as Record<string, unknown>
  } catch {
    return null
  }
  const { v, kid, id, to, seats, iat, exp } = data
  if (v !== 1 || typeof kid !== 'string' || typeof id !== 'string' || id === '' || typeof to !== 'string') return null
  if (typeof seats !== 'number' || typeof iat !== 'number' || typeof exp !== 'number') return null

  return { payload: { v: 1, kid, id, to, seats, iat, exp }, signed, signature }
}

/** Checks a pasted key against the public keys. Never throws. */
export async function checkKey(text: string, keys: readonly PublicKey[] = PUBLIC_KEYS): Promise<KeyCheck> {
  const parsed = parseKey(text)
  if (parsed === null) return { state: 'malformed' }
  const { payload, signed, signature } = parsed
  if (keys.length === 0) return { state: 'unverified', payload }
  const known = keys.find(key => key.kid === payload.kid)
  if (known === undefined) return { state: 'forged', payload }
  try {
    const isGood = await verifyP256(known, ascii(signed), signature)
    if (isGood === null) return { state: 'unverified', payload }

    return isGood ? { state: 'valid', payload } : { state: 'forged', payload }
  } catch {
    // Nothing above should throw. If it does, that is not the key's fault.
    return { state: 'unverified', payload }
  }
}

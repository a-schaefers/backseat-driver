/**
 * Making and signing commercial license keys. The format is the plugin's
 * (plugin/core/licensekey.ts): `BSD1.<payload>.<signature>`, the payload
 * JSON in base64url, the signature ECDSA P-256 with SHA-256 over the payload's
 * base64url text, as r and s (64 bytes). The tests check every key made here
 * with the plugin's own checker.
 */

import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import type { KeyObject } from 'node:crypto'

import type { KeyPayload, PublicKey } from '../../plugin/core/licensekey.ts'

export const KEY_PREFIX = 'BSD1'

export type SigningKey = { kid: string; privateKey: KeyObject }

export type NewLicense = { to: string; seats: number; exp?: number }

/** A new signing key pair: the private half as PEM, to be kept secret, and the public half for the plugin's `PUBLIC_KEYS`. */
export function makeSigningKey(kid: string): { privatePem: string; publicKey: PublicKey } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const jwk = publicKey.export({ format: 'jwk' })
  if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') throw new Error('the public key has no coordinates')

  return { privatePem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), publicKey: { kid, x: jwk.x, y: jwk.y } }
}

/** A signing key from its PEM. */
export function loadSigningKey(kid: string, privatePem: string): SigningKey {
  return { kid, privateKey: createPrivateKey(privatePem) }
}

/** The public half of a signing key, as the plugin carries it. */
export function publicKeyOf(key: SigningKey): PublicKey {
  const jwk = createPublicKey(key.privateKey).export({ format: 'jwk' })

  return { kid: key.kid, x: String(jwk.x), y: String(jwk.y) }
}

/** A new license id: short, unguessable, safe in a URL. */
export function newLicenseId(): string {
  return `lic_${randomBytes(12).toString('base64url')}`
}

export function payloadOf(key: SigningKey, id: string, license: NewLicense, now: number): KeyPayload {
  if (license.to.trim() === '') throw new Error('a license needs a licensee')
  if (!Number.isInteger(license.seats) || license.seats < 1) throw new Error('a license needs at least one seat')

  return { v: 1, kid: key.kid, id, to: license.to.trim(), seats: license.seats, iat: now, exp: license.exp ?? 0 }
}

/** Signs a payload into a license key. */
export function signKey(key: SigningKey, payload: KeyPayload): string {
  const signed = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = sign('sha256', Buffer.from(signed), { key: key.privateKey, dsaEncoding: 'ieee-p1363' })

  return `${KEY_PREFIX}.${signed}.${signature.toString('base64url')}`
}

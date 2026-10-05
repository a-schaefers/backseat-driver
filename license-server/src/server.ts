/**
 * The license server: a reference implementation, not deployed anywhere.
 *
 * Public, asked by the plugin about once a week:
 *   GET  /v1/keys/<id>            { status: "active" | "revoked" | "unknown" }
 *   GET  /v1/public-keys          the public keys the plugin should carry
 *
 * For the owner, with `Authorization: Bearer <admin token>`:
 *   POST /v1/licenses             { to, seats, exp? }  ->  { id, key }
 *   POST /v1/licenses/<id>/revoke                      ->  { id, status }
 *   POST /v1/licenses/<id>/restore                     ->  { id, status }
 *   GET  /v1/licenses                                  ->  every license
 *
 * Without an admin token configured, the owner's routes answer 403. Payment
 * is not here: whatever takes the money calls POST /v1/licenses and emails
 * the key.
 */

import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { timingSafeEqual } from 'node:crypto'

import { newLicenseId, payloadOf, publicKeyOf, signKey } from './keys.ts'
import type { SigningKey } from './keys.ts'
import { statusOf } from './store.ts'
import type { LicenseStore } from './store.ts'

export type Request = { method: string; path: string; authorization?: string; body?: string }
export type Response = { status: number; body: unknown }

export type ServerOptions = {
  store: LicenseStore
  signingKey: SigningKey
  /** The owner's token for issuing and revoking, or '' for none (those routes are then closed). */
  adminToken: string
  now?: () => number
}

const MAX_BODY = 16 * 1024

function isAdmin(options: ServerOptions, authorization: string | undefined): boolean {
  if (options.adminToken === '' || authorization === undefined) return false
  const given = Buffer.from(authorization.replace(/^Bearer\s+/i, ''))
  const wanted = Buffer.from(options.adminToken)

  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

function parseBody(body: string | undefined): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(body ?? '')

    return typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** One request, answered. Plain data in and out, so the tests need no sockets. */
export function handle(options: ServerOptions, request: Request): Response {
  const now = options.now ?? Date.now
  const parts = request.path.split('?')[0]?.split('/').filter(part => part !== '') ?? []
  const [version, noun, id, verb] = parts.map(part => decodeURIComponent(part))
  if (version !== 'v1') return { status: 404, body: { error: 'not found' } }

  if (request.method === 'GET' && noun === 'keys' && id !== undefined && verb === undefined) {
    return { status: 200, body: { status: statusOf(options.store.get(id)) } }
  }
  if (request.method === 'GET' && noun === 'public-keys' && id === undefined) {
    return { status: 200, body: [publicKeyOf(options.signingKey)] }
  }
  if (noun !== 'licenses') return { status: 404, body: { error: 'not found' } }
  if (!isAdmin(options, request.authorization)) return { status: 403, body: { error: 'forbidden' } }

  if (request.method === 'GET' && id === undefined) return { status: 200, body: options.store.list() }
  if (request.method === 'POST' && id === undefined) {
    const data = parseBody(request.body)
    if (data === null) return { status: 400, body: { error: 'a JSON object, please' } }
    const { to, seats, exp } = data
    if (typeof to !== 'string' || typeof seats !== 'number' || (exp !== undefined && typeof exp !== 'number')) {
      return { status: 400, body: { error: 'to (text), seats (a number) and optionally exp (epoch milliseconds)' } }
    }
    try {
      const payload = payloadOf(options.signingKey, newLicenseId(), { to, seats, ...(exp === undefined ? {} : { exp }) }, now())
      options.store.put({ id: payload.id, to: payload.to, seats: payload.seats, iat: payload.iat, exp: payload.exp, revokedAt: 0 })

      return { status: 201, body: { id: payload.id, key: signKey(options.signingKey, payload) } }
    } catch (error) {
      return { status: 400, body: { error: String((error as Error).message) } }
    }
  }
  if (request.method === 'POST' && id !== undefined && (verb === 'revoke' || verb === 'restore')) {
    const license = options.store.get(id)
    if (license === null) return { status: 404, body: { error: 'no such license' } }
    const changed = { ...license, revokedAt: verb === 'revoke' ? license.revokedAt || now() : 0 }
    options.store.put(changed)

    return { status: 200, body: { id, status: statusOf(changed) } }
  }

  return { status: 404, body: { error: 'not found' } }
}

/** The handler on a socket. */
export function listen(options: ServerOptions, port: number, host = '127.0.0.1'): Server {
  const server = createServer((incoming, outgoing) => {
    let body = ''
    incoming.setEncoding('utf8')
    incoming.on('data', (chunk: string) => {
      body += chunk
      if (body.length > MAX_BODY) incoming.destroy()
    })
    incoming.on('end', () => {
      const answer = handle(options, {
        method: incoming.method ?? 'GET',
        path: incoming.url ?? '/',
        ...(incoming.headers.authorization === undefined ? {} : { authorization: incoming.headers.authorization }),
        body,
      })
      outgoing.writeHead(answer.status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      outgoing.end(JSON.stringify(answer.body))
    })
  })
  server.listen(port, host)

  return server
}

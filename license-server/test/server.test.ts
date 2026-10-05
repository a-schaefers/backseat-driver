import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { checkKey } from '../../plugin/core/licensekey.ts'
import type { KeyPayload } from '../../plugin/core/licensekey.ts'
import { loadSigningKey, makeSigningKey, payloadOf, publicKeyOf, signKey } from '../src/keys.ts'
import { handle, listen } from '../src/server.ts'
import type { ServerOptions } from '../src/server.ts'
import { fileStore, memoryStore } from '../src/store.ts'

const ADMIN = 'Bearer owner-token'

function setUp(change: Partial<ServerOptions> = {}): ServerOptions {
  const { privatePem } = makeSigningKey('k1')

  return { store: memoryStore(), signingKey: loadSigningKey('k1', privatePem), adminToken: 'owner-token', now: () => 5000, ...change }
}

function issue(options: ServerOptions, body: object): { id: string; key: string } {
  const answer = handle(options, { method: 'POST', path: '/v1/licenses', authorization: ADMIN, body: JSON.stringify(body) })
  assert.equal(answer.status, 201)

  return answer.body as { id: string; key: string }
}

test('a key the server issues is one the plugin checks as valid, offline', async () => {
  const options = setUp()
  const { id, key } = issue(options, { to: 'Acme Ltd', seats: 5 })
  const check = await checkKey(key, [publicKeyOf(options.signingKey)])
  assert.equal(check.state, 'valid')
  assert.deepEqual((check as { payload: KeyPayload }).payload, { v: 1, kid: 'k1', id, to: 'Acme Ltd', seats: 5, iat: 5000, exp: 0 })
  // Another signing key's public half does not vouch for it.
  assert.equal((await checkKey(key, [{ ...makeSigningKey('k1').publicKey }])).state, 'forged')
})

test('many keys, every one checked by the plugin', async () => {
  const options = setUp()
  const publicKey = publicKeyOf(options.signingKey)
  for (let index = 0; index < 25; index += 1) {
    const payload = payloadOf(options.signingKey, `lic_${index}`, { to: `Company ${index} ünïcode`, seats: index + 1, exp: index * 1000 }, index)
    assert.equal((await checkKey(signKey(options.signingKey, payload), [publicKey])).state, 'valid')
  }
})

test('the plugin asks about an id, and hears active, revoked or unknown', () => {
  const options = setUp()
  const { id } = issue(options, { to: 'Acme Ltd', seats: 1, exp: 99_000 })
  assert.deepEqual(handle(options, { method: 'GET', path: `/v1/keys/${id}` }), { status: 200, body: { status: 'active' } })
  assert.deepEqual(handle(options, { method: 'GET', path: '/v1/keys/lic_nobody' }), { status: 200, body: { status: 'unknown' } })

  assert.deepEqual(handle(options, { method: 'POST', path: `/v1/licenses/${id}/revoke`, authorization: ADMIN }).body, { id, status: 'revoked' })
  assert.deepEqual(handle(options, { method: 'GET', path: `/v1/keys/${id}` }).body, { status: 'revoked' })
  // Mistakes happen: a revoked license can be restored.
  assert.deepEqual(handle(options, { method: 'POST', path: `/v1/licenses/${id}/restore`, authorization: ADMIN }).body, { id, status: 'active' })
})

test('issuing, revoking and listing need the owner token, and are closed without one', () => {
  const options = setUp()
  assert.equal(handle(options, { method: 'POST', path: '/v1/licenses', body: '{"to":"x","seats":1}' }).status, 403)
  assert.equal(handle(options, { method: 'POST', path: '/v1/licenses', authorization: 'Bearer wrong', body: '{"to":"x","seats":1}' }).status, 403)
  assert.equal(handle(options, { method: 'GET', path: '/v1/licenses', authorization: ADMIN }).status, 200)
  const closed = setUp({ adminToken: '' })
  assert.equal(handle(closed, { method: 'GET', path: '/v1/licenses', authorization: 'Bearer ' }).status, 403)
  // The public routes stay open.
  assert.equal(handle(closed, { method: 'GET', path: '/v1/public-keys' }).status, 200)
})

test('bad requests are refused with a reason', () => {
  const options = setUp()
  assert.equal(handle(options, { method: 'POST', path: '/v1/licenses', authorization: ADMIN, body: 'nope' }).status, 400)
  assert.equal(handle(options, { method: 'POST', path: '/v1/licenses', authorization: ADMIN, body: '{"to":"","seats":1}' }).status, 400)
  assert.equal(handle(options, { method: 'POST', path: '/v1/licenses', authorization: ADMIN, body: '{"to":"x","seats":0}' }).status, 400)
  assert.equal(handle(options, { method: 'POST', path: '/v1/licenses/lic_x/revoke', authorization: ADMIN }).status, 404)
  assert.equal(handle(options, { method: 'GET', path: '/v2/keys/x' }).status, 404)
})

test('the file store keeps licenses across restarts', () => {
  const folder = mkdtempSync(join(tmpdir(), 'bsd-licenses-'))
  try {
    const path = join(folder, 'licenses.json')
    const options = setUp({ store: fileStore(path) })
    const { id } = issue(options, { to: 'Acme Ltd', seats: 3 })
    assert.equal(fileStore(path).get(id)?.seats, 3)
    assert.equal(JSON.parse(readFileSync(path, 'utf8'))[id].to, 'Acme Ltd')
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})

test('over HTTP, the answer is the one the plugin parses', async () => {
  const options = setUp()
  const { id } = issue(options, { to: 'Acme Ltd', seats: 1 })
  const server = listen(options, 0)
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const { port } = server.address() as { port: number }
    const response = await fetch(`http://127.0.0.1:${port}/v1/keys/${id}`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'active' })
  } finally {
    server.close()
  }
})

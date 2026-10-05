/**
 * The owner's tool for license keys. Nothing here talks to a network except
 * `serve`, which listens on 127.0.0.1 unless told otherwise.
 *
 *   node license-server/src/cli.ts keygen <kid> <private-key-file>
 *       Makes a signing key. The private half goes to the file (keep it out of
 *       the repository); the public half is printed, for PUBLIC_KEYS in
 *       plugin/hooks/licensekey.ts.
 *   node license-server/src/cli.ts issue <to> <seats> [<exp YYYY-MM-DD>]
 *   node license-server/src/cli.ts revoke <id>
 *   node license-server/src/cli.ts serve [port]
 *
 * issue, revoke and serve read BSD_SIGNING_KEY (the private key file),
 * BSD_SIGNING_KID, BSD_LICENSES (the licenses' JSON file) and, for serve,
 * BSD_ADMIN_TOKEN.
 */

import { readFileSync, writeFileSync } from 'node:fs'

import { loadSigningKey, makeSigningKey, newLicenseId, payloadOf, signKey } from './keys.ts'
import { listen } from './server.ts'
import { fileStore } from './store.ts'

function env(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') throw new Error(`${name} is not set`)

  return value
}

const [command, ...args] = process.argv.slice(2)

switch (command) {
  case 'keygen': {
    const [kid, file] = args
    if (kid === undefined || file === undefined) throw new Error('keygen <kid> <private-key-file>')
    const { privatePem, publicKey } = makeSigningKey(kid)
    writeFileSync(file, privatePem, { mode: 0o600, flag: 'wx' })
    console.log(JSON.stringify(publicKey))
    break
  }
  case 'issue': {
    const [to, seats, until] = args
    if (to === undefined || seats === undefined) throw new Error('issue <to> <seats> [<exp YYYY-MM-DD>]')
    const key = loadSigningKey(env('BSD_SIGNING_KID'), readFileSync(env('BSD_SIGNING_KEY'), 'utf8'))
    const payload = payloadOf(key, newLicenseId(), { to, seats: Number(seats), ...(until === undefined ? {} : { exp: Date.parse(`${until}T00:00:00Z`) }) }, Date.now())
    fileStore(env('BSD_LICENSES')).put({ id: payload.id, to: payload.to, seats: payload.seats, iat: payload.iat, exp: payload.exp, revokedAt: 0 })
    console.log(signKey(key, payload))
    break
  }
  case 'revoke': {
    const [id] = args
    const store = fileStore(env('BSD_LICENSES'))
    const license = id === undefined ? null : store.get(id)
    if (license === null) throw new Error('revoke <id>: no such license')
    store.put({ ...license, revokedAt: license.revokedAt || Date.now() })
    console.log(`${license.id} revoked`)
    break
  }
  case 'serve': {
    const port = Number(args[0] ?? 8787)
    const key = loadSigningKey(env('BSD_SIGNING_KID'), readFileSync(env('BSD_SIGNING_KEY'), 'utf8'))
    listen({ store: fileStore(env('BSD_LICENSES')), signingKey: key, adminToken: process.env.BSD_ADMIN_TOKEN ?? '' }, port)
    console.log(`license server on http://127.0.0.1:${port}`)
    break
  }
  default:
    console.log('keygen <kid> <file> | issue <to> <seats> [<exp>] | revoke <id> | serve [port]')
}

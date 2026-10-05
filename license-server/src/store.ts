/**
 * The licenses issued: who, how many seats, until when, and whether one was
 * withdrawn. Only what the server needs to answer "does this key still
 * stand?". The keys themselves are not kept: a key is its payload, signed,
 * and can be made again from the record.
 *
 * Two stores: in memory for tests, and one JSON file, written whole to a
 * temporary file and renamed over the old one, so a crash never leaves half
 * a file. A reference implementation: one process writes it.
 */

import { readFileSync, renameSync, writeFileSync } from 'node:fs'

export type License = {
  id: string
  to: string
  seats: number
  /** Issued, epoch milliseconds. */
  iat: number
  /** End of term, epoch milliseconds, or 0 for none. */
  exp: number
  /** When it was withdrawn, or 0. */
  revokedAt: number
}

export type LicenseStore = {
  get(id: string): License | null
  put(license: License): void
  list(): License[]
}

export function memoryStore(): LicenseStore {
  const licenses = new Map<string, License>()

  return {
    get: id => licenses.get(id) ?? null,
    put: license => void licenses.set(license.id, license),
    list: () => [...licenses.values()],
  }
}

export function fileStore(path: string): LicenseStore {
  const load = (): Record<string, License> => {
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as Record<string, License>
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return {}
      throw error
    }
  }

  return {
    get: id => load()[id] ?? null,
    put: license => {
      const all = { ...load(), [license.id]: license }
      writeFileSync(`${path}.tmp`, `${JSON.stringify(all, null, 2)}\n`)
      renameSync(`${path}.tmp`, path)
    },
    list: () => Object.values(load()),
  }
}

/** What the server says about a license id: the plugin's `Answer`. */
export function statusOf(license: License | null): 'active' | 'revoked' | 'unknown' {
  if (license === null) return 'unknown'

  return license.revokedAt > 0 ? 'revoked' : 'active'
}

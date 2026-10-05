/**
 * Fingerprints of text. Not cryptography: they answer "is this the same text
 * as before?", for cache keys and for the rule that nothing stale is shown.
 */

function hex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0')
}

/** FNV-1a over the string's code units, 32 bits. */
function fnv(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash
}

/** A second, independent 32 bits, mixed the way MurmurHash3 mixes. */
function mix(text: string): number {
  let hash = 0x9747b28c
  for (let index = 0; index < text.length; index += 1) {
    let unit = Math.imul(text.charCodeAt(index), 0xcc9e2d51)
    unit = (unit << 15) | (unit >>> 17)
    hash ^= Math.imul(unit, 0x1b873593)
    hash = (hash << 13) | (hash >>> 19)
    hash = Math.imul(hash, 5) + 0xe6546b64
  }
  hash ^= text.length
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)

  return hash ^ (hash >>> 16)
}

/** Sixteen hex digits that change when the text does. Line endings are compared as written. */
export function fingerprint(text: string): string {
  return hex(fnv(text)) + hex(mix(text))
}

/** Eight hex digits: enough to tell two paths apart in a folder name. */
export function shortHash(text: string): string {
  return hex(fnv(text))
}

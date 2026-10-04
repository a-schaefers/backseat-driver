/**
 * The disk as the tutor's own files need it. register.tsx supplies these
 * from `$.fs` and `$.process`, and tests supply a map in memory.
 */
export type Disk = {
  /** The file's text, or null when it is not there. */
  read: (path: string) => Promise<string | null>
  /** Writes the whole file, creating its folders. */
  write: (path: string, text: string) => Promise<void>
  /** The names in a folder, or none when it is not there. */
  list: (path: string) => Promise<string[]>
  /** Deletes a file or a folder and everything in it. False when it was refused or failed. */
  remove: (path: string) => Promise<boolean>
}

/**
 * A JSON file's value, or null when the file is missing or does not parse.
 * A write is not atomic, so a file caught half-written reads as missing, and
 * whatever reads it starts again from nothing instead of failing.
 */
export async function readJson(disk: Disk, path: string): Promise<unknown> {
  const text = await disk.read(path)
  if (text === null || text.trim() === '') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export async function writeJson(disk: Disk, path: string, value: unknown): Promise<void> {
  await disk.write(path, `${JSON.stringify(value, null, 1)}\n`)
}

/** A disk in memory, for tests: paths to text. */
export function memoryDisk(files: Map<string, string> = new Map()): Disk & { files: Map<string, string> } {
  return {
    files,
    read: async path => files.get(path) ?? null,
    write: async (path, text) => {
      files.set(path, text)
    },
    list: async path => {
      const names = new Set<string>()
      for (const known of files.keys()) {
        if (known.startsWith(`${path}/`)) names.add(known.slice(path.length + 1).split('/')[0] ?? '')
      }

      return [...names]
    },
    remove: async path => {
      for (const known of [...files.keys()]) {
        if (known === path || known.startsWith(`${path}/`)) files.delete(known)
      }

      return true
    },
  }
}

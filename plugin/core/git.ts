/** One entry of `git status`: a path from the repository root and its two status letters. */
export type StatusEntry = {
  path: string
  /** The index column: staged state. */
  index: string
  /** The working tree column. */
  worktree: string
}

/**
 * Parses `git status --porcelain=v1 -z`. Entries are NUL-separated as
 * "XY path", and a rename or copy is followed by its original path.
 */
export function parseStatus(output: string): StatusEntry[] {
  const fields = output.split('\0')
  const entries: StatusEntry[] = []
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i]
    if (field === undefined || field.length < 4) continue
    const index = field.charAt(0)
    const worktree = field.charAt(1)
    entries.push({ path: field.slice(3), index, worktree })
    // A rename or copy is followed by its original path, in the index column or, after `git add -N`, the work tree's.
    if (index === 'R' || index === 'C' || worktree === 'R' || worktree === 'C') i += 1
  }

  return entries
}

/** The changed files that still exist: modified, added, renamed or untracked, but not deleted. */
export function dirtyPaths(entries: readonly StatusEntry[]): string[] {
  return entries
    .filter(entry => entry.worktree !== 'D' && !(entry.index === 'D' && entry.worktree === ' '))
    .map(entry => entry.path)
}

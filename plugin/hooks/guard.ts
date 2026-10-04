/** What Claude reads in place of the edit it tried to make. */
export const DENIAL =
  'Backseat Driver is on, so the user writes every change to their files, and this edit was not made. Do not try another way to make it. Tell them in one line that they are driving, then help them make the change themselves, starting with a hint.'

/** Resolves `.` and `..` by text alone, with `/` as the separator. No file system access. */
export function normalizePath(path: string): string {
  const parts: string[] = []
  for (const part of path.replaceAll('\\', '/').split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  const isAbsolute = path.startsWith('/') || path.startsWith('\\')

  return (isAbsolute ? '/' : '') + parts.join('/')
}

/** Claude Code's scratch folder for a session: /tmp/claude-<uid>/, or /private/tmp/... on macOS. */
const SCRATCH = /^(\/private)?\/tmp\/claude-\d+\//

/**
 * Whether an edit to `path` would change one of the user's own files.
 *
 * Everything counts as theirs except what Claude Code keeps for itself: its
 * folder under the home directory (memory, plans, settings) and its scratch
 * folder. Without those two the tutor could not take notes.
 */
export function isUsersFile(path: string, home: string): boolean {
  const target = normalizePath(path)
  if (SCRATCH.test(`${target}/`)) return false
  if (home === '') return true

  return !`${target}/`.startsWith(`${normalizePath(home)}/.claude/`)
}

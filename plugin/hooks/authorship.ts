import { languageOf } from './languages'
import { isNoiseFile } from './noise'

/**
 * Whose work a commit is. Progress is only ever judged on the person's own
 * work, so that hacking on someone else's excellent codebase says nothing
 * about them except what their own change shows.
 */

/** One commit's author, parents and message, from `git show -s`. */
export type CommitInfo = { hash: string; parents: string[]; email: string; name: string; message: string }

export function commitInfoArgs(hash: string): string[] {
  return ['show', '-s', '--format=%H%x00%P%x00%ae%x00%an%x00%B', hash]
}

/** The commit's patch with no context lines: what it added, and nothing around it. */
export function commitPatchArgs(hash: string): string[] {
  return ['show', '--format=', '--no-color', '--no-ext-diff', '--unified=0', hash]
}

/** Recent commits, newest first, with their author's email: where a first placement looks. */
export const RECENT_COMMITS_ARGS = ['log', '--no-merges', '--format=%H%x00%ae', '-n', '60'] as const

export function parseCommitInfo(stdout: string): CommitInfo | null {
  const [hash = '', parents = '', email = '', name = '', ...rest] = stdout.split('\0')
  if (!/^[0-9a-f]{7,64}$/.test(hash.trim())) return null

  return {
    hash: hash.trim(),
    parents: parents.trim() === '' ? [] : parents.trim().split(/\s+/),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    message: rest.join('\0').trim(),
  }
}

/** `git log` output from `RECENT_COMMITS_ARGS`: each commit's hash and author email, newest first. */
export function parseRecent(stdout: string): { hash: string; email: string }[] {
  return stdout
    .split('\n')
    .map(line => line.split('\0'))
    .filter(([hash = '']) => /^[0-9a-f]{7,64}$/.test(hash.trim()))
    .map(([hash = '', email = '']) => ({ hash: hash.trim(), email: email.trim().toLowerCase() }))
}

/** The person's email addresses: the repository's git config, and the global one when it differs. */
export function identityOf(...emails: readonly string[]): string[] {
  return [...new Set(emails.map(email => email.trim().toLowerCase()).filter(email => email.includes('@')))]
}

/**
 * Whether the message says someone or something else wrote part of it: a
 * `Co-authored-by` trailer, or a line a coding tool adds to its commits.
 */
export function hasOtherAuthor(message: string): boolean {
  return (
    /^co-authored-by:/im.test(message) ||
    /generated (with|by) .*(claude|copilot|chatgpt|gpt|codex|gemini|cursor|aider|devin|windsurf)/i.test(message) ||
    message.includes('🤖')
  )
}

/** What one file gained in a commit, for a language the tutor knows. */
export type AddedLines = { path: string; language: string; lines: string[] }

/**
 * The lines a patch adds, by file. Lock files, generated folders and the
 * like are left out, and so is any file in no language the tutor knows.
 */
export function addedLines(patch: string): AddedLines[] {
  const files: AddedLines[] = []
  let current: AddedLines | null = null
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      current = null
      continue
    }
    if (line.startsWith('+++ ')) {
      const path = line.slice(4).trim().replace(/^b\//, '')
      const language = path === '/dev/null' || isNoiseFile(path) ? null : languageOf(path)
      current = language === null ? null : { path, language, lines: [] }
      if (current !== null) files.push(current)
      continue
    }
    if (current !== null && line.startsWith('+')) current.lines.push(line.slice(1))
  }

  return files.filter(file => file.lines.some(line => line.trim() !== ''))
}

/** Above either of these, a commit reads as an import, a vendored library or generated code. */
export const MAX_ADDED_LINES = 600
export const MAX_FILES = 25

export type Verdict = { isYours: true; files: AddedLines[] } | { isYours: false; reason: string }

/**
 * Whether a commit can count as the person's own work, and if so the lines
 * to judge. Each refusal says why, in words the Progress tab can show.
 */
export function judge(info: CommitInfo, identity: readonly string[], files: readonly AddedLines[]): Verdict {
  if (identity.length === 0) return { isYours: false, reason: 'git has no user.email here, so no commit can be confirmed as yours' }
  if (!identity.includes(info.email)) return { isYours: false, reason: `it was written by ${info.name} <${info.email}>` }
  if (info.parents.length > 1) return { isYours: false, reason: 'it is a merge' }
  if (hasOtherAuthor(info.message)) return { isYours: false, reason: 'it names a co-author, or says a tool wrote it' }
  const added = files.reduce((sum, file) => sum + file.lines.length, 0)
  if (added === 0) return { isYours: false, reason: 'it adds no source code' }
  if (added > MAX_ADDED_LINES || files.length > MAX_FILES) {
    return { isYours: false, reason: `it adds ${added} lines in ${files.length} files at once, which reads as an import or generated code` }
  }

  return { isYours: true, files: [...files] }
}

/** Fewer added lines than this in a language say too little about anyone to be worth an assessment. */
export const MIN_LINES = 3

/** How many non-blank lines these files add. */
export function sizeOf(files: readonly AddedLines[]): number {
  return files.reduce((sum, file) => sum + file.lines.filter(line => line.trim() !== '').length, 0)
}

/** The files of a commit by language, the languages with the most added lines first. */
export function byLanguage(files: readonly AddedLines[]): Map<string, AddedLines[]> {
  const grouped = new Map<string, AddedLines[]>()
  for (const file of files) grouped.set(file.language, [...(grouped.get(file.language) ?? []), file])
  const size = (group: readonly AddedLines[]): number => group.reduce((sum, file) => sum + file.lines.length, 0)

  return new Map([...grouped].sort((a, b) => size(b[1]) - size(a[1])))
}

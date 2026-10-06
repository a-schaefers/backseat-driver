import type { ExplainView, Spot } from '../types'

/**
 * Where the person is looking, and the two small files that let an editor
 * take part.
 *
 * Each running editor reports its caret in a file of its own (`editors.ts`):
 *
 *   {"file": "/abs/path/to/stats.py", "line": 12, "endLine": 15}
 *
 * `line` is 1-based. `endLine` is there only while lines are selected. The
 * tutor answers by writing `view.json` in its data folder: what it knows about that
 * spot, already checked against the file on disk.
 */

/** What moved the focus. The most recent move wins, whatever made it. */
export type FocusSource = 'editor' | 'command' | 'pane' | 'save'

export type Focus = Spot & { source: FocusSource }

function trimSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

/** A file's path from the repository root, or null when it is outside the repository or climbs out of it. */
export function relativeTo(repoRoot: string, file: string): string | null {
  const root = trimSlash(repoRoot)
  const path = file.trim()
  if (path === '' || root === '') return null
  const relative = path.startsWith('/') ? (path.startsWith(`${root}/`) ? path.slice(root.length + 1) : null) : path.replace(/^\.\//, '')
  if (relative === null || relative === '') return null

  // The repository's own folder is not the project's code: a caret in `.git/COMMIT_EDITMSG` (a commit written in the
  // editor) is nowhere Explain can follow, and the journal would otherwise credit the time to it (seen 2026-10-05).
  return relative.split('/').some(segment => segment === '' || segment === '.' || segment === '..' || segment === '.git') ? null : relative
}

function lineNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : null
}

/** The spot an editor's report names, or null when it does not parse or names a file outside this repository. */
export function parseFocusFile(text: string, repoRoot: string): Spot | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const stored = data as Record<string, unknown>
  const path = typeof stored.file === 'string' ? relativeTo(repoRoot, stored.file) : null
  const line = lineNumber(stored.line)
  if (path === null || line === null) return null
  const endLine = lineNumber(stored.endLine)

  return endLine !== null && endLine > line ? { path, line, endLine } : { path, line }
}

/** What `/backseat explain <target>` names: `path`, `path:12` or `path:12-20`. Null when it names nothing. */
export function parseTarget(rest: string, repoRoot: string): Spot | null {
  const match = /^(.+?)(?::(\d+)(?:-(\d+))?)?$/.exec(rest.trim())
  if (match === null) return null
  const path = relativeTo(repoRoot, match[1] ?? '')
  if (path === null) return null
  const line = match[2] === undefined ? 1 : Math.max(1, Number(match[2]))
  const endLine = match[3] === undefined ? undefined : Number(match[3])

  return endLine !== undefined && endLine > line ? { path, line, endLine } : { path, line }
}

/** `view.json` as written for an editor: the view, where it is, and when. */
export function viewFile(view: ExplainView, repoRoot: string, source: FocusSource, at: number): string {
  return `${JSON.stringify({ v: 1, at, root: repoRoot, source, ...view }, null, 1)}\n`
}

/** The spot in a few words, for the command's answer and the pane's heading. */
export function describeSpot(spot: Spot): string {
  if (spot.endLine !== undefined && spot.endLine > spot.line) return `${spot.path}, lines ${spot.line} to ${spot.endLine}`

  return `${spot.path}, line ${spot.line}`
}

/** What the tutor is told about the spot in focus, and what a lookup answers. Empty when there is nothing to say. */
export function viewText(view: ExplainView): string {
  if (view.spot === null || view.status === 'off' || view.status === 'no-file') return ''
  const lines: string[] = []
  if (view.fileSummary !== '') lines.push(`${view.spot.path}: ${view.fileSummary}`)
  if (view.target !== null) {
    const { name, kind, startLine, endLine, summary } = view.target
    lines.push(`${name} (${kind}, lines ${startLine} to ${endLine})${summary === '' ? '' : `: ${summary}`}`)
  }
  if (view.detail !== null) {
    lines.push(`What: ${view.detail.what}`)
    if (view.detail.how !== '') lines.push(`How: ${view.detail.how}`)
    if (view.detail.why !== '') lines.push(`Why: ${view.detail.why}`)
    if (view.detail.watch !== '') lines.push(`Watch: ${view.detail.watch}`)
    if (view.detail.uses.length > 0) lines.push(`Relies on: ${view.detail.uses.join(', ')}`)
  }
  for (const insight of view.insights) lines.push(`From the deep review: ${insight}`)
  if (view.outline.length > 0 && view.target === null) {
    lines.push('In this file:', ...view.outline.map(row => `- ${row.name} (${row.kind}, line ${row.startLine}): ${row.summary}`))
  }

  return lines.join('\n')
}

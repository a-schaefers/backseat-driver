import { relativeTo } from './focus'

/**
 * The editors that report to the tutor, and which of them speaks for this
 * project.
 *
 * Every running editor with the Backseat Driver plugin keeps one file in the
 * data folder, `editors/<editor>-<pid>.json`, written whole (temp file and
 * rename) whenever the caret, the selection or the open files change, and
 * again every `EDITOR_BEAT_MS` while nothing does, so that the tutor can tell
 * an editor that is open from one that crashed:
 *
 *   {"v": 1, "editor": "neovim", "pid": 4242, "at": 1759653120000, "changed": 1759653118000,
 *    "root": "/abs/repo", "file": "/abs/repo/stats.py", "line": 12, "column": 5, "endLine": 15,
 *    "modified": true, "buffers": ["/abs/..."], "visible": ["/abs/..."], "active": true}
 *
 * `at` is when the file was written, `changed` when what it says last
 * changed (both milliseconds since 1970). `root` is the repository the file
 * with the caret is in, as the editor found it: the nearest folder upward
 * with a `.git`. Everything after `root` is what `focus.ts` and
 * `attention.ts` read.
 *
 * Several tutors may run at once, one per project (and in one project only
 * the session holding the lease looks). Each reads every editor's file and
 * keeps only what is about its own repository: the caret when `root` is its
 * repository, or, from an editor that sends no `root`, when the file is
 * inside it. So one editor serves every project it has files open in, and
 * a caret in a repository inside another one belongs to the inner one's tutor. When two editors have their caret in one project, the one whose
 * caret moved last speaks for it.
 */

/** How often an editor writes its file while nothing changes. */
export const EDITOR_BEAT_MS = 20_000
/** An editor whose file is older than this is closed, or crashed. */
export const EDITOR_TTL_MS = 60_000

/** How an editor's `editor` field is shown. */
const NAMES: Record<string, string> = { emacs: 'Emacs', neovim: 'Neovim', vim: 'Vim', vscode: 'VS Code' }

/** One editor's file, as read. */
export type EditorSeen = {
  /** What the pane calls it. */
  name: string
  /** When the file was written. */
  at: number
  /** When what it says last changed. */
  changed: number
  /** The repository of the file with the caret, as the editor found it, or null when it did not say. */
  root: string | null
  /** The file with the caret, absolute. */
  file: string
  /** The open files, absolute, the caret's first. */
  open: string[]
  /** What `focus.ts` and `attention.ts` read: the editor's file without what changes on every write. */
  text: string
}

function trimSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

function time(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/** The editor's name for a person to read. */
export function editorName(editor: unknown): string {
  if (typeof editor !== 'string' || editor.trim() === '') return 'An editor'
  const key = editor.trim().toLowerCase()

  return NAMES[key] ?? editor.trim().slice(0, 30)
}

/** One editor's file, or null when it does not parse, says nothing of its caret, or does not say when it was written. */
export function parseEditorFile(text: string): EditorSeen | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const stored = data as Record<string, unknown>
  const at = time(stored.at)
  if (at === null || typeof stored.file !== 'string' || stored.file.trim() === '') return null
  const file = stored.file.trim()
  const open = [file, ...(Array.isArray(stored.buffers) ? stored.buffers.filter((item): item is string => typeof item === 'string') : [])]
  const { v: _v, editor, pid: _pid, at: _at, changed, root, ...report } = stored

  return {
    name: editorName(editor),
    at,
    changed: time(changed) ?? at,
    root: typeof root === 'string' && root.trim() !== '' ? trimSlash(root.trim()) : null,
    file,
    open: [...new Set(open)],
    text: JSON.stringify(report),
  }
}

/** Whether the editor has written lately enough to be open still. */
export function isConnected(seen: EditorSeen, now: number): boolean {
  return now - seen.at <= EDITOR_TTL_MS
}

/** Whether the editor's caret is in this repository. */
export function isCaretHere(seen: EditorSeen, repoRoot: string): boolean {
  if (repoRoot === '' || relativeTo(repoRoot, seen.file) === null) return false

  return seen.root === null || seen.root === trimSlash(repoRoot)
}

/** Whether the editor has anything of this repository open: the caret, or another file. */
export function isHere(seen: EditorSeen, repoRoot: string): boolean {
  return isCaretHere(seen, repoRoot) || seen.open.some(path => relativeTo(repoRoot, path) !== null)
}

/** The editor that speaks for this project: open, its caret here, and the last to move it. Null when there is none. */
export function speaker(editors: readonly EditorSeen[], repoRoot: string, now: number): EditorSeen | null {
  let best: EditorSeen | null = null
  for (const seen of editors) {
    if (!isConnected(seen, now) || !isCaretHere(seen, repoRoot)) continue
    if (best === null || seen.changed > best.changed) best = seen
  }

  return best
}

/** The names of the open editors with something of this project open, each once, in order. */
export function connectedHere(editors: readonly EditorSeen[], repoRoot: string, now: number): string[] {
  const names = editors.filter(seen => isConnected(seen, now) && isHere(seen, repoRoot)).map(seen => seen.name)

  return [...new Set(names)].sort()
}

/** The pane's line about connected editors, '' for none. */
export function editorsLine(names: readonly string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return `${names[0]} is connected.`

  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are connected.`
}

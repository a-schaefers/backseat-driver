import { shortHash } from './hash'

/**
 * Where the tutor keeps what it knows: one folder, outside every project.
 *
 *   profiles/<language>.json   answers, hushes, lesson memory
 *   progress/<language>.json   evidence, level, report
 *   projects/<name>-<hash>/    one project's journal and cache
 *   editors/<editor>-<pid>.json one per running editor: where its caret is (editors.ts)
 *   debug.json, debug/         the debug log's switch, and the log (debuglog.ts)
 *   sessions.json              the sessions the tutor is on in (sessions.ts)
 *   locks.git/                 a bare git repository whose refs are the locks on these files (locks.ts)
 */

/** The folder's own name under the user's data directory. */
const FOLDER = 'backseat-driver'

/** A file the tutor writes into its folder, so that it never deletes inside a folder it did not make. */
export const MARKER = '.backseat-driver'

export const MARKER_TEXT =
  'Backseat Driver keeps what it knows about you and your projects in this folder.\nDelete the folder to forget all of it, or run /backseat forget.\n'

export type HomeEnv = {
  /** `BACKSEAT_DRIVER_HOME`, which points the tutor at another folder. */
  override: string | undefined
  /** `XDG_DATA_HOME`. */
  xdg: string | undefined
  /** `HOME`, or `USERPROFILE` on Windows. */
  home: string
}

function trimSlash(path: string): string {
  return path.length > 1 ? path.replace(/[\\/]+$/, '') : path
}

/** The data folder, or '' when there is no home directory to put it under. */
export function dataHome(env: HomeEnv): string {
  if (env.override !== undefined && env.override.trim() !== '') return trimSlash(env.override.trim())
  if (env.xdg !== undefined && env.xdg.trim() !== '') return `${trimSlash(env.xdg.trim())}/${FOLDER}`
  if (env.home.trim() === '') return ''

  return `${trimSlash(env.home.trim())}/.local/share/${FOLDER}`
}

/** A name that is safe as one path segment: no separators, no dots alone, not too long. */
export function safeName(text: string): string {
  const cleaned = text
    .trim()
    .replace(/[^A-Za-z0-9._+-]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .slice(0, 60)

  return cleaned === '' ? '_' : cleaned
}

function baseName(path: string): string {
  return trimSlash(path).split(/[\\/]/).pop() ?? ''
}

export function profilePath(root: string, subject: string): string {
  return `${root}/profiles/${safeName(subject)}.json`
}

export function progressPath(root: string, language: string): string {
  return `${root}/progress/${safeName(language)}.json`
}

/** Where they are in each lesson of one language: a folder, so that forgetting the language takes it whole. */
export function lessonsDir(root: string, language: string): string {
  return `${root}/lessons/${safeName(language)}`
}

/** Where they are in one lesson. */
export function lessonPath(root: string, language: string, id: string): string {
  return `${lessonsDir(root, language)}/${safeName(id)}.json`
}

/** A project is its repository's root folder: its name for a person to read, and a hash of the path to tell two apart. */
export function projectId(repoRoot: string): string {
  return `${safeName(baseName(repoRoot))}-${shortHash(trimSlash(repoRoot))}`
}

export function projectDir(root: string, repoRoot: string): string {
  return `${root}/projects/${projectId(repoRoot)}`
}

/** The file that says which session drives a project's background jobs (`lease.ts`). */
export function leasePath(root: string, repoRoot: string): string {
  return `${projectDir(root, repoRoot)}/lease.json`
}

/** The folders that hold what is on record about the person, which every session reads and any may change. */
export function sharedFolders(root: string): string[] {
  return [`${root}/profiles`, `${root}/progress`]
}

/** The file that holds a project's journal: what the person has been doing in its code. */
export function journalPath(root: string, repoRoot: string): string {
  return `${projectDir(root, repoRoot)}/journal.json`
}

/** The files the watcher saw change since the last commit: work watched arrive counts in full toward progress. */
export function watchedPath(root: string, repoRoot: string): string {
  return `${projectDir(root, repoRoot)}/watched.json`
}

/** The folder in which each running editor keeps one file to say where its caret is. Every tutor reads them all and keeps what is about its own repository. */
export function editorsPath(root: string): string {
  return `${root}/editors`
}

/** The bare repository whose refs are the locks that hold across sessions. */
export function lockRepoPath(root: string): string {
  return `${root}/locks.git`
}

/** Personal or commercial use, and the commercial key: about the person, like the profiles. */
export function licensePath(root: string): string {
  return `${root}/license.json`
}

/** The file in which each session that has the tutor on says so (`sessions.ts`). */
export function sessionsPath(root: string): string {
  return `${root}/sessions.json`
}

/** The file that says whether the debug log is on, for every session. */
export function debugSwitchPath(root: string): string {
  return `${root}/debug.json`
}

/** The folder that holds every session's debug log. */
export function debugRoot(root: string): string {
  return `${root}/debug`
}

/** The file that holds what is known about one source file of a project. */
export function fileEntryPath(root: string, repoRoot: string, path: string): string {
  return `${projectDir(root, repoRoot)}/files/${shortHash(path)}-${safeName(baseName(path))}.json`
}

/**
 * Whether a folder holds nothing but what the tutor puts there, judged by
 * the names directly in it. Only then may the folder itself be deleted.
 */
export function isOwnFolder(names: readonly string[]): boolean {
  return names.includes(MARKER) && names.every(name => name === MARKER || REMOVABLE.some(own => own === name))
}

/** What the tutor may delete: only these, directly under its own folder. */
export const REMOVABLE = ['profiles', 'progress', 'lessons', 'projects', 'editors', 'focus.json', 'view.json', 'update.json', 'license.json', 'sessions.json', 'debug', 'debug.json', 'locks.git'] as const

/**
 * Whether `path` is something the tutor may delete: inside one of its own
 * subfolders, with no way of climbing out. Anything else is refused, so a
 * wrong data folder cannot cost the user a file of theirs.
 */
export function isRemovable(root: string, path: string): boolean {
  if (root === '' || !path.startsWith(`${root}/`)) return false
  const segments = path.slice(root.length + 1).split('/')
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) return false

  return REMOVABLE.some(name => name === segments[0])
}

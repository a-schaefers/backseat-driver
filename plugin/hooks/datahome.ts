import { shortHash } from './hash'

/**
 * Where the tutor keeps what it knows: one folder, outside every project.
 *
 *   profiles/<language>.json   answers, hushes, lesson memory
 *   progress/<language>.json   evidence, level, report
 *   projects/<name>-<hash>/    one project's cache
 */

/** The folder's own name under the user's data directory. */
const FOLDER = 'backseat-driver'

/** A file the tutor writes into its folder, so that it never deletes inside a folder it did not make. */
export const MARKER = '.backseat-driver'

export const MARKER_TEXT =
  'Backseat Driver keeps what it knows about you and your projects in this folder.\nDelete the folder to forget all of it, or run /bsd forget.\n'

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

/** A project is its repository's root folder: its name for a person to read, and a hash of the path to tell two apart. */
export function projectId(repoRoot: string): string {
  return `${safeName(baseName(repoRoot))}-${shortHash(trimSlash(repoRoot))}`
}

export function projectDir(root: string, repoRoot: string): string {
  return `${root}/projects/${projectId(repoRoot)}`
}

/** The file that holds what is known about one source file of a project. */
export function fileEntryPath(root: string, repoRoot: string, path: string): string {
  return `${projectDir(root, repoRoot)}/files/${shortHash(path)}-${safeName(baseName(path))}.json`
}

/** What the tutor may delete: only these, directly under its own folder. */
export const REMOVABLE = ['profiles', 'progress', 'projects', 'focus.json', 'view.json', 'update.json'] as const

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

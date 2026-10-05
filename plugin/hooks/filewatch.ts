/**
 * Changes pushed to the tutor instead of found by its scan.
 *
 * Claude Code does not say when the person saves a file in their editor,
 * commits in their own terminal or moves their caret. The scan finds those by
 * looking (`sensor.ts`). Where a file watcher is on the person's PATH, it
 * tells the tutor the moment they happen, and the scan becomes a safety net.
 * Where none is, nothing changes: the scan does it all, as before.
 *
 * A watcher is one source of changes among others to come (an editor plugin
 * will be another). Whatever the source, a change it reports is a path, and
 * `nudgeOf` says what that path means to the tutor. The shell (register.tsx)
 * acts on the nudge: a scan now, or a check of the spot in focus now. The
 * scan still decides what changed. A source only says when to look.
 *
 * The watcher is inotifywait, from inotify-tools (Linux), in two children:
 * one over the working tree, recursive, leaving out what git ignores and
 * everything in `.git` but its logs (a commit writes `.git/logs/HEAD`); one
 * over the data folder's `editors` folder, not recursive, where each running
 * editor writes what it says about its caret.
 */

/** What a reported path means to the tutor. */
export type Nudge =
  /** Files of the working tree, by path from its root: scan now. */
  | { kind: 'tree'; paths: string[] }
  /** HEAD's log, or another of git's logs: a commit or a checkout. Scan now. */
  | { kind: 'head' }
  /** An editor's report in the editors folder: read it now. */
  | { kind: 'focus' }

/** The places a watcher looks at, as absolute paths without a trailing slash. */
export type WatchPlaces = {
  root: string
  /** The repository's git folder (`git rev-parse --absolute-git-dir`). */
  gitDir: string
  /** The tutor's data folder, whose editors folder holds each running editor's report. '' for none. */
  dataRoot: string
}

/** What one watcher child is for. */
export type WatchRole = 'tree' | 'focus'

/** How many folders git ignores are left out of the watch by name. More than that are watched like any other. */
export const MAX_IGNORED = 200

/** The watcher's name on PATH. */
export const INOTIFYWAIT = 'inotifywait'

/** What inotifywait says on stderr once every watch is in place. */
const ESTABLISHED = 'Watches established.'

/** The events that mean a file was written, made, removed or renamed. */
const EVENTS = ['close_write', 'create', 'delete', 'moved_to', 'moved_from']

/** `text` as an extended regular expression that matches only itself. */
export function escapeRegex(text: string): string {
  return text.replace(/[.^$|?*+()[\]{}\\]/g, '\\$&')
}

/**
 * The folders git ignores, from `git ls-files --others --ignored
 * --exclude-standard --directory`: only the lines that are folders (they end
 * in a slash), without the slash. A folder git ignores holds nothing the
 * tutor looks at, and watching it can cost thousands of watches
 * (node_modules).
 */
export function ignoredFolders(stdout: string): string[] {
  return stdout
    .split('\n')
    .filter(line => line.endsWith('/') && line.length > 1)
    .map(line => line.slice(0, -1))
    .slice(0, MAX_IGNORED)
}

/**
 * The pattern of what the tree's watcher does not report: inside `.git`
 * everything but `logs`, and the folders git ignores. inotifywait matches it
 * against every event's path. It still watches what it matches, so the same
 * folders are also named with `@`, which keeps them out of the watch
 * (`treeWatchArgv`); the pattern covers what appears after the start.
 */
export function treeExclude(places: WatchPlaces, ignored: readonly string[]): string {
  const root = escapeRegex(places.root)
  const notLogs = '\\.git/([^l]|l[^o]|lo[^g]|log[^s]|logs[^/])'
  const folders = ignored.map(folder => `${escapeRegex(folder)}(/|$)`)

  return `^${root}/(${[notLogs, ...folders].join('|')})`
}

/** One argument per event, as inotifywait takes them. */
function eventArgs(): string[] {
  return EVENTS.flatMap(event => ['-e', event])
}

/**
 * The tree's watcher. `ignored` are the folders git ignores, from the root.
 * `gitFolders` are the names of the folders in the git folder when it is the
 * root's `.git`: all but `logs` are left out of the watch (objects alone can
 * be hundreds of folders). A git folder outside the working tree (a
 * worktree, a submodule) has its logs watched beside it, when
 * `hasOutsideLogs` says they are there to be watched.
 */
export function treeWatchArgv(
  places: WatchPlaces,
  ignored: readonly string[],
  gitFolders: readonly string[],
  hasOutsideLogs: boolean,
): string[] {
  const isGitInside = places.gitDir === `${places.root}/.git`
  const paths = [places.root, ...(!isGitInside && hasOutsideLogs ? [`${places.gitDir}/logs`] : [])]
  const gitLeftOut = isGitInside ? gitFolders.filter(name => name !== 'logs').map(name => `${places.gitDir}/${name}`) : []
  const leftOut = [...ignored.map(folder => `${places.root}/${folder}`), ...gitLeftOut].map(path => `@${path}`)

  return [INOTIFYWAIT, '-m', '-r', '--format', '%w%f', ...eventArgs(), '--exclude', treeExclude(places, ignored), ...paths, ...leftOut]
}

/** The folder of the data folder where each running editor writes its own report (the editor plugins). */
export const EDITORS_FOLDER = 'editors'

/**
 * The editors' watcher: the `editors` folder of the data folder, where each
 * running editor writes its report, not recursively. The folder is made
 * before the watch is placed.
 */
export function focusWatchArgv(places: WatchPlaces): string[] {
  return [INOTIFYWAIT, '-m', '--format', '%w%f', ...eventArgs(), `${places.dataRoot}/${EDITORS_FOLDER}`]
}

/** True once a watcher's stderr says every watch is in place. */
export function isEstablished(stderr: string): boolean {
  return stderr.includes(ESTABLISHED)
}

/**
 * What stderr says that is worth keeping when a watcher stops: inotifywait's
 * own words without its chatter about setting up.
 */
export function watcherComplaint(stderr: string): string {
  return stderr
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith('Setting up watches') && line !== ESTABLISHED)
    .join(' ')
    .slice(0, 400)
}

/**
 * Splits a stream into lines. A piece of output can end inside a line, so
 * what follows the last newline is kept for the next piece.
 */
export function lineSplitter(): (text: string) => string[] {
  let rest = ''

  return text => {
    const lines = (rest + text).split('\n')
    rest = lines.pop() ?? ''

    return lines.filter(line => line !== '')
  }
}

/** What a path a watcher reported means to the tutor, or null when nothing. */
export function nudgeOf(path: string, places: WatchPlaces): Nudge | null {
  if (places.gitDir !== '' && path.startsWith(`${places.gitDir}/`)) {
    return path.startsWith(`${places.gitDir}/logs/`) ? { kind: 'head' } : null
  }
  if (places.dataRoot !== '' && path.startsWith(`${places.dataRoot}/${EDITORS_FOLDER}/`)) return path.endsWith('.json') ? { kind: 'focus' } : null
  if (!path.startsWith(`${places.root}/`)) return null
  const relative = path.slice(places.root.length + 1)
  // The repository's own `.git` folder, when the git folder is elsewhere it is a file. Nothing to look at.
  if (relative === '.git' || relative.startsWith('.git/')) return null

  return { kind: 'tree', paths: [relative] }
}

/**
 * The nudges in a batch of reported paths, one of each kind at most, the
 * tree's with every file named once: the tutor acts on a burst (a checkout
 * touching a thousand files) once.
 */
export function nudgesOf(paths: readonly string[], places: WatchPlaces): Nudge[] {
  const byKind = new Map<Nudge['kind'], Nudge>()
  const tree = new Set<string>()
  for (const path of paths) {
    const nudge = nudgeOf(path, places)
    if (nudge === null) continue
    if (nudge.kind === 'tree') for (const file of nudge.paths) tree.add(file)
    else byKind.set(nudge.kind, nudge)
  }
  if (tree.size > 0) byKind.set('tree', { kind: 'tree', paths: [...tree] })

  return [...byKind.values()]
}

/**
 * Staying up to date. A release is a tag on the upstream repository whose
 * `plugin.json` carries the same version: `backseat-driver--v0.2.0`, the
 * name `claude plugin tag` gives it, or plain `v0.2.0`. The tutor compares
 * its own version with the newest such tag, and `/backseat update` fetches the
 * release the way this copy was installed.
 */

/** How this copy of the plugin got onto the machine, which decides how it is updated and removed. */
export type Install =
  /** A git clone, loaded with `--plugin-dir`: updated with `git pull`. */
  | { kind: 'clone'; top: string }
  /** Installed from a marketplace: updated and removed with `claude plugin`, at the scope it was installed at. */
  | { kind: 'installed'; id: string; marketplace: string; scope: string }
  /** Pushed by claude.ai into `plugins/synced/`: updates arrive by themselves, and are removed there. */
  | { kind: 'synced' }
  /** Anything else, such as a copied folder: the person is told what to do. */
  | { kind: 'unknown' }

export type Version = [number, number, number]

/** `1.2.3` or `v1.2.3` as numbers, or null for anything else. */
export function parseVersion(text: string): Version | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text.trim())

  return match === null ? null : [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

export function versionText(version: Version): string {
  return version.join('.')
}

/** The version in a `plugin.json`, or null when it has none. */
export function manifestVersion(text: string): Version | null {
  try {
    const data = JSON.parse(text) as { version?: unknown }

    return typeof data.version === 'string' ? parseVersion(data.version) : null
  } catch {
    return null
  }
}

/** The repository URL in a `plugin.json`, or ''. */
export function manifestRepository(text: string): string {
  try {
    const data = JSON.parse(text) as { repository?: unknown }

    return typeof data.repository === 'string' ? data.repository.trim() : ''
  } catch {
    return ''
  }
}

/** Asks for the release tags only: `git ls-remote --tags --refs <url>`. */
export function tagsArgs(url: string): string[] {
  return ['ls-remote', '--tags', '--refs', url]
}

/** The newest release among the tags `git ls-remote --tags --refs` printed, or null when there is none. */
export function newestRelease(stdout: string): Version | null {
  let newest: Version | null = null
  for (const line of stdout.split('\n')) {
    const tag = /\trefs\/tags\/(?:backseat-driver--)?(v\d+\.\d+\.\d+)$/.exec(line.trim())?.[1]
    const version = tag === undefined ? null : parseVersion(tag)
    if (version !== null && (newest === null || compareVersions(version, newest) > 0)) newest = version
  }

  return newest
}

/**
 * Which installed plugin this copy is, from `installed_plugins.json`: the
 * entry whose install path holds the plugin's folder. Null when none does.
 */
export function installedEntry(text: string, root: string): { id: string; marketplace: string; scope: string } | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  const plugins = (data as { plugins?: unknown }).plugins
  if (typeof plugins !== 'object' || plugins === null) return null
  for (const [id, entries] of Object.entries(plugins as Record<string, unknown>)) {
    for (const entry of Array.isArray(entries) ? entries : [entries]) {
      const path = (entry as { installPath?: unknown } | null)?.installPath
      const scope = (entry as { scope?: unknown } | null)?.scope
      if (typeof path !== 'string' || path === '') continue
      const base = path.replace(/\/+$/, '')
      if (root === base || root.startsWith(`${base}/`) || base.startsWith(`${root}/`)) {
        const marketplace = id.includes('@') ? id.slice(id.indexOf('@') + 1) : ''

        return { id, marketplace, scope: scope === 'project' || scope === 'local' ? scope : 'user' }
      }
    }
  }

  return null
}

/**
 * Where Claude Code keeps its copy of a marketplace, from
 * `known_marketplaces.json`: a git clone whose `origin` is where releases
 * come from, which may be a fork. '' when there is none.
 */
export function marketplaceLocation(text: string, name: string): string {
  try {
    const entry = (JSON.parse(text) as Record<string, { installLocation?: unknown } | undefined>)[name]

    return typeof entry?.installLocation === 'string' ? entry.installLocation : ''
  } catch {
    return ''
  }
}

/** How often the tutor asks upstream for a newer release. */
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

/** What is remembered between sessions about the last check, in `update.json`. `checkedAt` is null before the first. */
export type UpdateRecord = { checkedAt: number | null; latest: string }

export function parseUpdateRecord(value: unknown): UpdateRecord {
  const stored = (typeof value === 'object' && value !== null ? value : {}) as { checkedAt?: unknown; latest?: unknown }

  return {
    checkedAt: typeof stored.checkedAt === 'number' ? stored.checkedAt : null,
    latest: typeof stored.latest === 'string' && parseVersion(stored.latest) !== null ? stored.latest : '',
  }
}

export function isCheckDue(record: UpdateRecord, now: number): boolean {
  return record.checkedAt === null || now - record.checkedAt >= CHECK_EVERY_MS
}

/** What the pane says when a newer release is out, or '' when this copy is current. */
export function updateNotice(current: Version | null, latest: Version | null): string {
  if (current === null || latest === null || compareVersions(latest, current) <= 0) return ''

  return `Backseat Driver ${versionText(latest)} is out. You have ${versionText(current)}. /backseat update fetches it.`
}

/** The commands that update an installed copy, in the order they run. */
export function updateCommands(install: Extract<Install, { kind: 'installed' }>): string[][] {
  return [
    ['claude', 'plugin', 'marketplace', 'update', install.marketplace],
    ['claude', 'plugin', 'update', install.id],
  ]
}

/** The command that removes an installed copy, at the scope it was installed at: the CLI's default is the user's. */
export function uninstallCommand(install: Extract<Install, { kind: 'installed' }>): string[] {
  return ['claude', 'plugin', 'uninstall', install.id, '--scope', install.scope, '--yes']
}

/** A command as a person would type it. */
export function shellLine(argv: readonly string[]): string {
  return argv.map(part => (/^[\w@./:=+-]+$/.test(part) ? part : `'${part.replaceAll("'", "'\\''")}'`)).join(' ')
}

export const UNINSTALL_QUESTION = 'Uninstall Backseat Driver?'
export const UNINSTALL_KEEP = 'Keep it'
export const UNINSTALL_ERASE = 'Uninstall, and erase everything it remembers'
export const UNINSTALL_ONLY = 'Uninstall, and keep what it remembers'

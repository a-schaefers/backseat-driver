/**
 * The journal: a timestamped record of what the person has been doing in one
 * project's code, kept in the tutor's data folder.
 *
 *   projects/<name>-<hash>/journal.json
 *
 * It holds paths, line numbers, names and commit titles, and never a line of
 * their code. No model the tutor calls remembers its previous call, so
 * whatever a prompt says about what is going on is read back from here.
 */

/** A run of lines in a file: the first and the last, 1-based. */
export type Span = [first: number, last: number]

/** One thing that happened. `at` is in clock milliseconds. */
export type Entry =
  /** The tutor was switched on. `text` is the branch. */
  | { at: number; kind: 'on'; text: string }
  /** A run of saves of one file: when the last one was, how many, the lines they added and removed, and where. */
  | {
      at: number
      kind: 'save'
      path: string
      until: number
      saves: number
      added: number
      removed: number
      lines: Span[]
      where: string
    }
  /** A stretch with the caret in one part of a file, as an editor reported it. No `lines` when it was all over the file. */
  | { at: number; kind: 'focus'; path: string; ms: number; lines: Span[]; where: string }
  /** Time a file spent on screen beside the one with the caret, as in a split. */
  | { at: number; kind: 'screen'; path: string; ms: number }
  | { at: number; kind: 'commit'; hash: string; text: string }
  /** HEAD moved without a commit: a checkout, pull, reset or rebase. `text` is what git calls the move. */
  | { at: number; kind: 'head'; hash: string; text: string }
  /** A play-by-play note was raised, dealt with in the code, or dismissed. `text` is its topic. */
  | { at: number; kind: 'note' | 'fixed' | 'dismissed'; path: string; line: number; text: string }
  /** A deep review arrived. `text` is what it reviewed. */
  | { at: number; kind: 'review'; text: string }
  /** They said what they are working on, or took it back with ''. */
  | { at: number; kind: 'said'; text: string }

/** What they said they are working on, and when. `text` is '' once they have taken it back. */
export type Said = { text: string; at: number }

/** What the play-by-play made of their activity at one look, and the files that look was shown. */
export type Inferred = { text: string; at: number; paths: string[] }

/** An earlier sitting, rolled up into a few lines. */
export type Sitting = {
  from: number
  to: number
  /** Where the work was, most first: saves, and time when an editor reported it. */
  files: { path: string; saves: number; ms: number }[]
  /** How many commits were made, and the titles of the last few. */
  commitCount: number
  commits: string[]
  /** What they last said they were working on in that sitting, or ''. */
  said: string
}

export type Journal = {
  said: Said | null
  inferred: Inferred | null
  /** The sitting that is still going on, oldest entry first. */
  entries: Entry[]
  /** The sittings before it, oldest first. */
  sittings: Sitting[]
}

/** Saves of one file this close together are one run, and one entry. */
export const SAVE_RUN_MS = 120_000
/** This long without an entry ends a sitting. */
export const SITTING_GAP_MS = 60 * 60_000
/** Past this many entries the oldest are dropped. A long sitting has a few hundred. */
export const MAX_ENTRIES = 1500
export const MAX_SITTINGS = 20
/** An entry names at most this many runs of lines. More are joined up. */
const MAX_SPANS = 4
/** A save entry names at most this many definitions. */
export const MAX_NAMES = 3
const MAX_TEXT_CHARS = 200
/** Under this much editor time, a sitting with no save and no commit is not worth a line. */
const QUIET_MS = 60_000

/** The files saved this sitting, as the journal has them: where the play-by-play shows the serious issues on record. */
export function savedPathsOf(journal: Journal): string[] {
  return [...new Set(journal.entries.flatMap(entry => (entry.kind === 'save' ? [entry.path] : [])))]
}

export function emptyJournal(): Journal {
  return { said: null, inferred: null, entries: [], sittings: [] }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function time(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function words(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT_CHARS) : ''
}

function spans(value: unknown): Span[] {
  const read: Span[] = []
  for (const item of Array.isArray(value) ? value : []) {
    if (!Array.isArray(item)) continue
    const first = count(item[0])
    const last = count(item[1])
    if (first >= 1 && last >= first) read.push([first, last])
  }

  return read.slice(0, MAX_SPANS)
}

/** Runs of lines in order, with those that overlap or sit within `gap` lines of each other joined. */
function joined(spans: readonly Span[], gap: number): Span[] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: Span[] = []
  for (const [first, last] of sorted) {
    const previous = merged[merged.length - 1]
    if (previous !== undefined && first <= previous[1] + gap + 1) previous[1] = Math.max(previous[1], last)
    else merged.push([first, last])
  }

  return merged
}

/** The same lines as a few runs: neighbours are joined, and then wider gaps, until there are few enough. */
export function mergeSpans(spans: readonly Span[]): Span[] {
  for (const gap of [3, 15, 60, 250]) {
    const merged = joined(spans, gap)
    if (merged.length <= MAX_SPANS) return merged
  }

  return joined(spans, Number.POSITIVE_INFINITY)
}

/** The names a save entry's `where` holds, which it keeps as one comma-separated string. */
export function namesOf(where: string): string[] {
  return where
    .split(',')
    .map(name => name.trim())
    .filter(name => name !== '')
}

/** The `where` of a run of saves: the latest names first, each once. */
export function mergeNames(latest: string, earlier: string): string {
  const names: string[] = []
  for (const name of [...namesOf(latest), ...namesOf(earlier)]) {
    if (!names.includes(name)) names.push(name)
  }

  return names.slice(0, MAX_NAMES).join(', ')
}

/**
 * One entry as read from the file, or null when it does not fit. Entries made
 * in this session go through here too, so that an entry always has the same
 * fields in the same order: `sync` tells entries apart by their JSON.
 */
export function parseEntry(value: unknown): Entry | null {
  const row = asRecord(value)
  const at = time(row?.at)
  if (row === null || at === null) return null
  const kind = row.kind
  const text = words(row.text)
  const path = words(row.path)

  switch (kind) {
    case 'on':
    case 'review':
    case 'said':
      return { at, kind, text }
    case 'commit':
    case 'head':
      return { at, kind, hash: words(row.hash), text }
    case 'note':
    case 'fixed':
    case 'dismissed':
      return path === '' ? null : { at, kind, path, line: Math.max(1, count(row.line)), text }
    case 'save':
      if (path === '') return null

      return {
        at,
        kind: 'save',
        path,
        until: Math.max(at, time(row.until) ?? at),
        saves: Math.max(1, count(row.saves)),
        added: count(row.added),
        removed: count(row.removed),
        lines: spans(row.lines),
        where: words(row.where),
      }
    case 'focus':
      return path === '' ? null : { at, kind: 'focus', path, ms: count(row.ms), lines: spans(row.lines), where: words(row.where) }
    case 'screen':
      return path === '' ? null : { at, kind: 'screen', path, ms: count(row.ms) }
    default:
      return null
  }
}

function parseSitting(value: unknown): Sitting | null {
  const row = asRecord(value)
  const from = time(row?.from)
  const to = time(row?.to)
  if (row === null || from === null || to === null || to < from) return null

  const files: Sitting['files'] = []
  for (const item of Array.isArray(row.files) ? row.files : []) {
    const file = asRecord(item)
    if (file !== null && typeof file.path === 'string' && file.path !== '') {
      files.push({ path: words(file.path), saves: count(file.saves), ms: count(file.ms) })
    }
  }
  const commits = (Array.isArray(row.commits) ? row.commits : []).filter(title => typeof title === 'string').map(words)

  return { from, to, files, commitCount: Math.max(count(row.commitCount), commits.length), commits, said: words(row.said) }
}

/**
 * The journal as read from its file. A person can edit that file and an
 * older version of the plugin may have written it, so nothing in it is
 * trusted: whatever does not fit is dropped.
 */
export function parseJournal(value: unknown): Journal {
  const stored = asRecord(value)
  if (stored === null) return emptyJournal()

  const said = asRecord(stored.said)
  const saidAt = time(said?.at)
  const inferred = asRecord(stored.inferred)
  const inferredAt = time(inferred?.at)
  const entries = (Array.isArray(stored.entries) ? stored.entries : []).map(parseEntry).filter(entry => entry !== null)
  const sittings = (Array.isArray(stored.sittings) ? stored.sittings : []).map(parseSitting).filter(sitting => sitting !== null)

  return {
    said: said === null || saidAt === null ? null : { text: words(said.text), at: saidAt },
    inferred:
      inferred === null || inferredAt === null || words(inferred.text) === ''
        ? null
        : {
            text: words(inferred.text),
            at: inferredAt,
            paths: (Array.isArray(inferred.paths) ? inferred.paths : []).filter(path => typeof path === 'string').map(words),
          },
    entries: entries.sort((a, b) => a.at - b.at).slice(-MAX_ENTRIES),
    sittings: sittings.sort((a, b) => a.from - b.from).slice(-MAX_SITTINGS),
  }
}

/** When what an entry records was over. */
export function endOf(entry: Entry): number {
  if (entry.kind === 'save') return entry.until
  if (entry.kind === 'focus' || entry.kind === 'screen') return entry.at + entry.ms

  return entry.at
}

/**
 * The entries with one more. A save of a file that was saved moments ago
 * joins that run, unless a commit or another move of HEAD came in between.
 */
export function withEntry(entries: readonly Entry[], entry: Entry): Entry[] {
  if (entry.kind === 'save') {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const earlier = entries[index]
      if (earlier === undefined || earlier.kind === 'commit' || earlier.kind === 'head') break
      if (earlier.kind !== 'save' || earlier.path !== entry.path) continue
      if (entry.at - earlier.until > SAVE_RUN_MS) break

      const run: Entry = {
        ...earlier,
        until: entry.until,
        saves: earlier.saves + entry.saves,
        added: earlier.added + entry.added,
        removed: earlier.removed + entry.removed,
        // The lines of earlier saves have moved since, so this is roughly where, not exactly.
        lines: mergeSpans([...earlier.lines, ...entry.lines]),
        where: mergeNames(entry.where, earlier.where),
      }

      return [...entries.slice(0, index), run, ...entries.slice(index + 1)]
    }
  }

  return [...entries, entry].slice(-MAX_ENTRIES)
}

/** The entries as sittings: a new one starts after `SITTING_GAP_MS` with nothing recorded. */
export function splitSittings(entries: readonly Entry[]): Entry[][] {
  const sittings: Entry[][] = []
  let end = Number.NEGATIVE_INFINITY
  for (const entry of entries) {
    const current = sittings[sittings.length - 1]
    if (current === undefined || entry.at - end > SITTING_GAP_MS) sittings.push([entry])
    else current.push(entry)
    end = Math.max(end, endOf(entry))
  }

  return sittings
}

/** A sitting in a few lines, or null for one in which nothing was saved, committed or looked at for long. Time a file was only beside the one in front is not counted. */
export function digest(entries: readonly Entry[]): Sitting | null {
  const first = entries[0]
  if (first === undefined) return null

  const files = new Map<string, { path: string; saves: number; ms: number }>()
  const commits: string[] = []
  let said = ''
  let to = first.at
  for (const entry of entries) {
    to = Math.max(to, endOf(entry))
    if (entry.kind === 'commit') commits.push(entry.text)
    if (entry.kind === 'said') said = entry.text
    if (entry.kind !== 'save' && entry.kind !== 'focus') continue
    const file = files.get(entry.path) ?? { path: entry.path, saves: 0, ms: 0 }
    if (entry.kind === 'save') file.saves += entry.saves
    else file.ms += entry.ms
    files.set(entry.path, file)
  }

  const ranked = [...files.values()].sort((a, b) => b.saves - a.saves || b.ms - a.ms || a.path.localeCompare(b.path))
  const editorMs = ranked.reduce((total, file) => total + file.ms, 0)
  if (commits.length === 0 && ranked.every(file => file.saves === 0) && editorMs < QUIET_MS) return null

  return { from: first.at, to, files: ranked.slice(0, 5), commitCount: commits.length, commits: commits.slice(-3), said }
}

/**
 * The journal with every sitting that is over rolled up. Only the sitting
 * still going on keeps its entries, which is what keeps the file small.
 */
export function compact(journal: Journal, now: number): Journal {
  const groups = splitSittings(journal.entries)
  const last = groups[groups.length - 1]
  const lastEnd = last === undefined ? 0 : last.reduce((end, entry) => Math.max(end, endOf(entry)), 0)
  const isOpen = last !== undefined && now - lastEnd <= SITTING_GAP_MS
  const closed = isOpen ? groups.slice(0, -1) : groups

  const sittings = [...journal.sittings]
  for (const group of closed) {
    const rolled = digest(group)
    // The same sitting may have been rolled up by another session already.
    if (rolled !== null && !sittings.some(known => known.from === rolled.from)) sittings.push(rolled)
  }

  return {
    ...journal,
    entries: isOpen ? last : [],
    sittings: sittings.sort((a, b) => a.from - b.from).slice(-MAX_SITTINGS),
  }
}

/** The later of what the file holds and what this session holds. A tie goes to this session, which acted last. */
function later<T extends { at: number }>(stored: T | null, held: T | null): T | null {
  if (stored === null) return held
  if (held === null) return stored

  return held.at >= stored.at ? held : stored
}

/**
 * What goes back into the file: what this session holds, plus whatever
 * another session has added to the file in the meantime. `known` is every
 * entry this session last read or wrote, as JSON, which is how an entry of
 * its own is told from somebody else's.
 */
export function sync(stored: Journal, held: Journal, known: ReadonlySet<string>, now: number): Journal {
  const others = stored.entries.filter(entry => !known.has(JSON.stringify(entry)))
  const seen = new Set<string>()
  const entries: Entry[] = []
  for (const entry of [...others, ...held.entries].sort((a, b) => a.at - b.at)) {
    const text = JSON.stringify(entry)
    if (seen.has(text)) continue
    seen.add(text)
    entries.push(entry)
  }

  const sittings = [...held.sittings]
  for (const sitting of stored.sittings) {
    if (!sittings.some(known => known.from === sitting.from)) sittings.push(sitting)
  }

  return compact(
    {
      said: later(stored.said, held.said),
      inferred: later(stored.inferred, held.inferred),
      entries: entries.slice(-MAX_ENTRIES),
      sittings: sittings.sort((a, b) => a.from - b.from),
    },
    now,
  )
}

/** The entries as the strings `sync` knows them by. */
export function knownEntries(journal: Journal): Set<string> {
  return new Set(journal.entries.map(entry => JSON.stringify(entry)))
}

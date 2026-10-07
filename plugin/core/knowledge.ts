import { fingerprint } from './hash'

/**
 * What the tutor knows about one source file, and the rule that keeps it
 * honest: nothing here is shown unless it still matches the file on disk.
 *
 * Every symbol carries a fingerprint of the exact lines it covers. After an
 * edit, a symbol whose lines are unchanged is found again wherever they
 * moved to, and one whose lines changed is simply no longer there.
 */

/** The fuller explanation of a symbol or a region. */
export type Detail = {
  what: string
  how: string
  why: string
  /** What to be careful about, or '' when there is nothing. */
  watch: string
  /** The other symbols this explanation leans on, each with the fingerprint it had when this was written. */
  uses: Use[]
  /** When it was written, in clock milliseconds, and by which model. */
  at: number
  model: string
}

export type Use = { file: string; name: string; print: string }

/** One named thing in a file: a function, a class, a method, a constant. */
export type Sym = {
  name: string
  kind: string
  /** 1-based, as of the last time the symbol was found in the file. */
  startLine: number
  endLine: number
  /** Its first line, trimmed: where to look for it after the file has changed. */
  head: string
  /** Fingerprint of the lines it covers. */
  print: string
  /** One sentence: what it is for. */
  summary: string
  detail?: Detail
}

/** A stretch of lines the person selected, explained by itself. */
export type Region = { print: string; lines: number; head: string; detail: Detail }

export type FileKnowledge = {
  v: 1
  /** Path from the repository root. */
  path: string
  /** Fingerprint of the whole file when its outline was written. */
  print: string
  summary: string
  symbols: Sym[]
  regions: Region[]
  /** When the outline was written. */
  at: number
}

/** How many symbols one file's outline keeps, and how many selected regions. */
export const MAX_SYMBOLS = 120
export const MAX_REGIONS = 20

export function splitSource(text: string): string[] {
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()

  return lines.map(line => (line.endsWith('\r') ? line.slice(0, -1) : line))
}

/**
 * Where an edit begins: the first line of `after` that differs from
 * `before`, moved past blank lines to the code. 1-based. When lines were
 * only taken off the end, the last line.
 */
export function firstChange(before: readonly string[], after: readonly string[]): number {
  let index = 0
  while (index < before.length && index < after.length && before[index] === after[index]) index += 1
  while (index < after.length - 1 && (after[index] ?? '').trim() === '') index += 1

  return Math.max(1, Math.min(after.length, index + 1))
}

/** The fingerprint of a whole file's text, however its lines end. */
export function sourcePrint(text: string): string {
  return fingerprint(splitSource(text).join('\n'))
}

/** The fingerprint of lines `start` to `end`, 1-based and inclusive. */
export function printOf(lines: readonly string[], start: number, end: number): string {
  return fingerprint(lines.slice(start - 1, end).join('\n'))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0
}

function parseDetail(value: unknown): Detail | undefined {
  const stored = asRecord(value)
  if (stored === null || text(stored.what) === '') return undefined
  const uses: Use[] = []
  for (const item of Array.isArray(stored.uses) ? stored.uses : []) {
    const use = asRecord(item)
    if (use !== null && text(use.file) !== '' && text(use.name) !== '' && text(use.print) !== '') {
      uses.push({ file: text(use.file), name: text(use.name), print: text(use.print) })
    }
  }

  return {
    what: text(stored.what),
    how: text(stored.how),
    why: text(stored.why),
    watch: text(stored.watch),
    uses,
    at: whole(stored.at),
    model: text(stored.model),
  }
}

/**
 * A file's knowledge as read from disk. The file can be edited by hand, torn
 * by a crash or written by an older version, so whatever does not fit is
 * dropped, and an entry about another path is no entry at all.
 */
export function parseKnowledge(value: unknown, path: string): FileKnowledge | null {
  const stored = asRecord(value)
  if (stored === null || stored.v !== 1 || stored.path !== path || text(stored.print) === '') return null

  const symbols: Sym[] = []
  for (const item of Array.isArray(stored.symbols) ? stored.symbols : []) {
    const symbol = asRecord(item)
    if (symbol === null) continue
    const startLine = whole(symbol.startLine)
    const endLine = whole(symbol.endLine)
    if (text(symbol.name) === '' || text(symbol.print) === '' || startLine < 1 || endLine < startLine) continue
    const detail = parseDetail(symbol.detail)
    symbols.push({
      name: text(symbol.name),
      kind: text(symbol.kind) || 'symbol',
      startLine,
      endLine,
      head: text(symbol.head),
      print: text(symbol.print),
      summary: text(symbol.summary),
      ...(detail === undefined ? {} : { detail }),
    })
  }

  const regions: Region[] = []
  for (const item of Array.isArray(stored.regions) ? stored.regions : []) {
    const region = asRecord(item)
    const detail = parseDetail(region?.detail)
    if (region !== null && detail !== undefined && text(region.print) !== '' && whole(region.lines) > 0) {
      regions.push({ print: text(region.print), lines: whole(region.lines), head: text(region.head), detail })
    }
  }

  return {
    v: 1,
    path,
    print: text(stored.print),
    summary: text(stored.summary),
    symbols: symbols.slice(0, MAX_SYMBOLS),
    regions: regions.slice(-MAX_REGIONS),
    at: whole(stored.at),
  }
}

/** Where a block of `count` lines with this fingerprint now starts, or 0 when it is gone. */
function findBlock(lines: readonly string[], count: number, print: string, head: string, near: number): number {
  const fits = (start: number): boolean =>
    start >= 1 && start + count - 1 <= lines.length && printOf(lines, start, start + count - 1) === print
  if (fits(near)) return near

  // Elsewhere: only lines that read like its first line are worth fingerprinting.
  let best = 0
  for (let start = 1; start + count - 1 <= lines.length; start += 1) {
    if ((lines[start - 1] ?? '').trim() !== head) continue
    if (fits(start) && (best === 0 || Math.abs(start - near) < Math.abs(best - near))) best = start
  }

  return best
}

/**
 * The symbols that are still exactly what they were, at the lines they are
 * on now. A symbol whose text changed in any way is left out: what was
 * written about it describes code that no longer exists.
 */
export function freshSymbols(knowledge: FileKnowledge, lines: readonly string[]): Sym[] {
  const fresh: Sym[] = []
  for (const symbol of knowledge.symbols) {
    const count = symbol.endLine - symbol.startLine + 1
    const start = findBlock(lines, count, symbol.print, symbol.head, symbol.startLine)
    if (start > 0) fresh.push({ ...symbol, startLine: start, endLine: start + count - 1 })
  }

  return fresh.sort((a, b) => a.startLine - b.startLine || b.endLine - a.endLine)
}

/** The innermost symbol that covers `line`, or undefined when the line is in none. */
export function symbolAt(symbols: readonly Sym[], line: number): Sym | undefined {
  let found: Sym | undefined
  for (const symbol of symbols) {
    if (line < symbol.startLine || line > symbol.endLine) continue
    if (found === undefined || symbol.endLine - symbol.startLine <= found.endLine - found.startLine) found = symbol
  }

  return found
}

/** The explanation of a selected region, when these exact lines were explained before. */
export function regionFor(knowledge: FileKnowledge, lines: readonly string[], start: number, end: number): Region | undefined {
  const print = printOf(lines, start, end)

  return knowledge.regions.find(region => region.print === print)
}

/** A symbol as the model's outline describes it, before it has been checked against the file. */
export type OutlineEntry = { name: string; kind: string; start: number; end: number; head: string; summary: string }

/**
 * Turns an outline into symbols, checking every entry against the file. The
 * model has to quote each symbol's first line, and the quote has to be found
 * at the line it names or within a few lines of it. An entry that fails is
 * dropped, so a wrong line number never points an explanation at the wrong code.
 */
export function placeSymbols(entries: readonly OutlineEntry[], lines: readonly string[]): Sym[] {
  const symbols: Sym[] = []
  for (const entry of entries) {
    const head = entry.head.trim()
    if (entry.name.trim() === '' || head === '') continue
    let start = 0
    for (const shift of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
      if ((lines[entry.start + shift - 1] ?? '').trim() === head) {
        start = entry.start + shift
        break
      }
    }
    if (start === 0) continue
    const end = Math.min(lines.length, Math.max(start, entry.end + (start - entry.start)))
    symbols.push({
      name: entry.name.trim(),
      kind: entry.kind.trim() || 'symbol',
      startLine: start,
      endLine: end,
      head,
      print: printOf(lines, start, end),
      summary: entry.summary.trim(),
    })
  }

  return symbols.sort((a, b) => a.startLine - b.startLine || b.endLine - a.endLine).slice(0, MAX_SYMBOLS)
}

/**
 * A file's knowledge after a new outline. An explanation written for a symbol
 * is kept when the new outline has a symbol with exactly the same text, so
 * that mapping a file again costs nothing for the parts that did not change.
 */
export function withOutline(
  previous: FileKnowledge | null,
  path: string,
  lines: readonly string[],
  summary: string,
  symbols: readonly Sym[],
  at: number,
): FileKnowledge {
  const known = new Map<string, Detail>()
  for (const symbol of previous?.symbols ?? []) {
    if (symbol.detail !== undefined) known.set(symbol.print, symbol.detail)
  }

  return {
    v: 1,
    path,
    print: fingerprint(lines.join('\n')),
    summary,
    symbols: symbols.map(symbol => {
      const detail = known.get(symbol.print)

      return detail === undefined ? symbol : { ...symbol, detail }
    }),
    regions: previous?.regions ?? [],
    at,
  }
}

/** The knowledge with a symbol's explanation added. The symbol is named by its fingerprint, which survives a move. */
export function withDetail(knowledge: FileKnowledge, print: string, detail: Detail): FileKnowledge {
  return {
    ...knowledge,
    symbols: knowledge.symbols.map(symbol => (symbol.print === print ? { ...symbol, detail } : symbol)),
  }
}

/**
 * `theirs` with what `mine` explains that theirs does not: two sessions
 * explaining one file each keep the other's work (the caching audit,
 * 2026-10-06: a second session's write took the first's explanations away).
 * Theirs as it is when the two are of different texts.
 */
export function mergeKnowledge(mine: FileKnowledge, theirs: FileKnowledge): FileKnowledge {
  if (theirs.print !== mine.print) return theirs
  let merged = theirs
  for (const symbol of mine.symbols) {
    if (symbol.detail !== undefined && merged.symbols.some(other => other.print === symbol.print && other.detail === undefined)) merged = withDetail(merged, symbol.print, symbol.detail)
  }
  for (const region of mine.regions) {
    if (!merged.regions.some(other => other.print === region.print)) merged = withRegion(merged, region)
  }

  return merged
}

export function withRegion(knowledge: FileKnowledge, region: Region): FileKnowledge {
  const others = knowledge.regions.filter(other => other.print !== region.print)

  return { ...knowledge, regions: [...others, region].slice(-MAX_REGIONS) }
}

/**
 * Whether an explanation can still be trusted: every symbol it leaned on is
 * still exactly what it was. `currentPrint` answers a symbol's fingerprint as
 * it is now, or null when the symbol can no longer be found.
 */
export function isDetailFresh(detail: Detail, currentPrint: (use: Use) => string | null): boolean {
  return detail.uses.every(use => currentPrint(use) === use.print)
}

/**
 * The first line (1-based) that mentions a name, or -1: as written, else as
 * a bare word without a leading sigil or trailing parentheses (`$cm`, `cm`,
 * `run()`). What a deep review's insight is tied to when its name is no
 * symbol of the outline (a variable, a reviewer's own word for a stretch).
 */
export function mentionedAt(lines: readonly string[], name: string): number {
  if (name === '') return -1
  // As a whole word, never inside a longer one: `m` is not mentioned by `mean`.
  const asWord = (text: string) => new RegExp(`(^|[^A-Za-z0-9_])${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9_])`)
  const exact = lines.findIndex(line => asWord(name).test(line))
  if (exact !== -1) return exact + 1
  const bare = name.replace(/^[$@:]+/, '').replace(/\(\)$/, '')
  if (bare === '' || bare === name) return -1
  const loose = lines.findIndex(line => asWord(bare).test(line))

  return loose === -1 ? -1 : loose + 1
}

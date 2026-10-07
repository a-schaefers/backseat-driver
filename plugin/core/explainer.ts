import { detailRequest, isMappable, outlineRequest, parseDetailReply, parseOutline } from './explain-prompts'
import type { ProjectContext } from './explain-prompts'
import { freshSymbols,
  isDetailFresh,
  parseKnowledge,
  placeSymbols,
  printOf,
  firstChange,
  regionFor,
  sourcePrint,
  splitSource,
  symbolAt,
  withDetail,
  withOutline,
  withRegion,
mergeKnowledge, mentionedAt } from './knowledge'
import type { ExplainStatus, ExplainView, OutlineRow, Spot } from '../types'
import type { Detail, FileKnowledge, Sym, Use } from './knowledge'
import type { Store } from './store'

/**
 * The lookup engine behind the Explain tab: what is known about a spot in
 * the code, served from memory and disk at once, with whatever is missing
 * fetched in the background.
 *
 * Two rules shape it. A read never waits on a model. And nothing is shown or
 * stored unless it matches the file as it is on disk at that moment: an
 * answer that arrives for text that has since changed is thrown away.
 */

export const NO_VIEW: ExplainView = {
  spot: null,
  status: 'off',
  fileSummary: '',
  outline: [],
  isOutlineCurrent: false,
  isMappable: true,
  target: null,
  detail: null,
  insights: [],
}

/**
 * Why a spot is being looked at, which decides how eagerly it is looked up.
 * `asked`: the person named it, so it is fetched whatever the settings say.
 * `browsing`: their cursor is on it. `following`: they saved it.
 */
export type Intent = 'asked' | 'browsing' | 'following'

/** How close the plan's usage limit is. `slowed` stops what nobody is looking at, `held` all but what is asked for. */
export type Pressure = 'none' | 'slowed' | 'held'

export type ExplainPorts = {
  /** A source file's text as it is on disk now, by path from the repository root. Null when it cannot be read. */
  read: (path: string) => Promise<string | null>
  /** Something that changes whenever the file does, or '' when it is not there. */
  stamp: (path: string) => Promise<string>
  /** The tutor's own files, where what is known about each source file is kept. */
  store: Pick<Store, 'read' | 'update'>
  /** The file that holds what is known about a source file. */
  entryPath: (path: string) => string
  /** The entry's size and time on disk, or '' when there is none: what another session wrote since is read again. Without it, once read is final. */
  entryStamp?: (path: string) => Promise<string>
  /** One request to the explain model. Null when it did not answer. */
  complete: (prompt: string, maxTokens: number, signal: AbortSignal) => Promise<string | null>
  now: () => Promise<number>
  project: () => ProjectContext
  /**
   * What a deep review said about a symbol, or about its file when `name` is
   * '', that still applies to code with these fingerprints.
   */
  insights: (path: string, name: string, symbolPrint: string, filePrint: string, isMentioned: (name: string) => boolean) => string[]
  /** `automatic`: fetch what the person looks at and saves. `on request`: only what they ask for. */
  mode: () => 'automatic' | 'on request' | 'off'
  pressure: () => Pressure
  /** The name the model goes by, recorded with each explanation. */
  model: string
  /** Called after anything known has changed. */
  onChange: () => void
  /**
   * Says when `wake` should next be called: the moment the first waiting
   * lookup becomes ready by the passing of time alone. Null when none is
   * waiting for a time.
   */
  wakeAt: (at: number | null) => void
  log: (line: string) => void
}

/** How long a saved file has to stay unchanged before it is mapped again. */
export const SETTLE_MS = 2500
/** How long a failed lookup waits before it is tried again. */
export const RETRY_MS = 60_000
/** A lookup that keeps failing waits twice as long each time, up to this: one that the model keeps answering unusably cost a request a minute for as long as the spot was in focus (the caching audit, 2026-10-06). */
export const MAX_RETRY_MS = 60 * 60_000
/** Lookups in flight at once. One more is allowed for what the person is looking at. */
const PARALLEL = 2
/** After a file is mapped, this many of its unexplained symbols are explained ahead of being asked. */
const PREFETCH = 2
/** How many files' texts are held in memory at once. */
const MAX_HELD_FILES = 40
/** In a file too large to map, the cursor's line is explained with this many lines on each side. */
const WINDOW = 15
/** The fingerprint a file's knowledge carries before the file has been mapped. No real file has it. */
const UNMAPPED = 'unmapped'

/**
 * How urgent a lookup is. The first two are for a spot someone is looking
 * at, and get a slot of their own. Only `ASKED` skips the wait for a file to
 * settle: the person named the spot, so they get it now.
 */
const ASKED = 0
const LOOKING = 1
const SAVED = 2
const AHEAD = 3

type Job = {
  key: string
  kind: 'outline' | 'detail'
  path: string
  priority: number
  /** For a detail: the fingerprint of the lines to explain, how many there are, and where they were. */
  print: string
  count: number
  near: number
  isRegion: boolean
}

type Source = { stamp: string; text: string; lines: string[]; print: string }

export function createExplainer(ports: ExplainPorts) {
  const known = new Map<string, FileKnowledge | null>()
  const sources = new Map<string, Source>()
  const queue = new Map<string, Job>()
  const running = new Map<string, AbortController>()
  const failedAt = new Map<string, { at: number; count: number }>()
  /** Each file's entry on disk as it was last read, so that another session's write is noticed. */
  const entryStamps = new Map<string, string>()
  const writing = new Map<string, Promise<void>>()
  /** When each file was last seen to change on disk. A file is not mapped while it may still be being typed. */
  const changedAt = new Map<string, number>()
  /** Where that change began, for the focus to follow a save to. */
  const changedLine = new Map<string, number>()
  /** Whoever is waiting for the next lookup to end. */
  let waiters: (() => void)[] = []
  let isStopped = false
  /** Counts `reset()`s, so that a lookup started before one leaves nothing behind. */
  let generation = 0

  /** The file as it is on disk now. The text is read again only when its stamp has changed. */
  async function source(path: string): Promise<Source | null> {
    const stamp = await ports.stamp(path)
    if (stamp === '') {
      sources.delete(path)

      return null
    }
    const cached = sources.get(path)
    if (cached !== undefined && cached.stamp === stamp) return cached
    const text = await ports.read(path)
    if (text === null) return null
    const lines = splitSource(text)
    // Seen before and different now: it was just saved.
    if (cached !== undefined && cached.text !== text) {
      changedAt.set(path, await ports.now())
      changedLine.set(path, firstChange(cached.lines, lines))
    }
    const read = { stamp, text, lines, print: sourcePrint(text) }
    sources.delete(path)
    sources.set(path, read)
    // Only the files looked at lately are kept in memory. The oldest goes first.
    for (const oldest of sources.keys()) {
      if (sources.size <= MAX_HELD_FILES) break
      sources.delete(oldest)
    }

    return read
  }

  async function knowledge(path: string): Promise<FileKnowledge | null> {
    const held = known.get(path)
    // What is held stands until the entry on disk changes under it: another session explained the file too (or
    // explained it at all, where this one held "nothing"). The caching audit, 2026-10-06.
    const stamp = ports.entryStamp === undefined ? undefined : await ports.entryStamp(path)
    if (held !== undefined && (stamp === undefined || stamp === entryStamps.get(path))) return held
    const loaded = parseKnowledge(await ports.store.read(ports.entryPath(path)), path)
    if (stamp !== undefined) entryStamps.set(path, stamp)
    const latest = held === undefined || held === null ? loaded : loaded === null ? held : mergeKnowledge(held, loaded)
    known.set(path, latest)

    return latest
  }

  /**
   * Changes what is known about a file. Lookups run side by side, so the
   * change is applied to the latest state with nothing awaited in between:
   * two answers landing together both count. The file on disk is then
   * written one write at a time, each of the latest state.
   */
  function commit(path: string, change: (current: FileKnowledge | null) => FileKnowledge): Promise<void> {
    const born = generation
    known.set(path, change(known.get(path) ?? null))
    const write = (writing.get(path) ?? Promise.resolve()).then(async () => {
      const latest = known.get(path)
      // Forgotten in the meantime, or since the lookup began: writing it back would undo that.
      if (latest === undefined || latest === null || born !== generation) return
      try {
        // On top of the entry as it is on disk: another session may have explained the same file, and its work stays.
        let written = latest
        await ports.store.update(ports.entryPath(path), stored => {
          const theirs = parseKnowledge(stored, path)
          written = theirs === null ? latest : mergeKnowledge(theirs, latest)

          return written
        })
        if (known.get(path) === latest && born === generation) known.set(path, written)
        if (ports.entryStamp !== undefined) entryStamps.set(path, await ports.entryStamp(path))
      } catch (error) {
        ports.log(`could not save what is known about ${path}: ${String(error)}`)
      }
    })
    writing.set(path, write)

    return write
  }

  function enqueue(job: Job): void {
    if (isStopped || running.has(job.key)) return
    const waiting = queue.get(job.key)
    if (waiting !== undefined) {
      // Wanted again, and more urgently: it moves up.
      if (job.priority < waiting.priority) queue.set(job.key, { ...waiting, priority: job.priority })

      return
    }
    queue.set(job.key, job)
  }

  function outlineJob(path: string, priority: number): Job {
    return { key: `outline ${path}`, kind: 'outline', path, priority, print: '', count: 0, near: 0, isRegion: false }
  }

  function detailJob(path: string, print: string, count: number, near: number, isRegion: boolean, priority: number): Job {
    return { key: `detail ${path} ${print}`, kind: 'detail', path, priority, print, count, near, isRegion }
  }

  /**
   * When a job may start, as far as time decides, and 0 when no time has to
   * pass. A lookup that failed waits before it is tried again. Mapping a
   * file waits until the file has stayed unchanged for a moment, unless the
   * person asked for it by name. An explanation does not wait for that: it
   * is of text that is in the file right now.
   */
  function readyAt(job: Job): number {
    const failed = failedAt.get(job.key)
    const afterFailure = failed === undefined ? 0 : failed.at + Math.min(MAX_RETRY_MS, RETRY_MS * 2 ** Math.max(0, failed.count - 1))
    if (job.kind !== 'outline' || job.priority === ASKED) return afterFailure
    const changed = changedAt.get(job.path)

    return Math.max(afterFailure, changed === undefined ? 0 : changed + SETTLE_MS)
  }

  /** The moment the first waiting lookup becomes ready by time alone, or null when none waits for a time. */
  function nextWakeAt(now: number): number | null {
    let earliest: number | null = null
    for (const job of queue.values()) {
      const at = readyAt(job)
      if (at > now && (earliest === null || at < earliest)) earliest = at
    }

    return earliest
  }

  /** The fingerprints the symbols named in `uses` have right now. */
  async function currentPrints(uses: readonly Use[]): Promise<Map<string, string>> {
    const prints = new Map<string, string>()
    for (const file of new Set(uses.map(use => use.file))) {
      const read = await source(file)
      const held = await knowledge(file)
      if (read === null || held === null) continue
      // The first of two symbols with one name (a getter and a setter, overloads) is the one an explanation records.
      for (const symbol of freshSymbols(held, read.lines)) {
        const key = `${file}\n${symbol.name}`
        if (!prints.has(key)) prints.set(key, symbol.print)
      }
    }

    return prints
  }

  /** An explanation, when every symbol it leaned on is still what it was. */
  async function trusted(detail: Detail | undefined): Promise<Detail | null> {
    if (detail === undefined) return null
    const prints = await currentPrints(detail.uses)

    return isDetailFresh(detail, use => prints.get(`${use.file}\n${use.name}`) ?? null) ? detail : null
  }

  function row(symbol: Sym): OutlineRow {
    return { name: symbol.name, kind: symbol.kind, startLine: symbol.startLine, endLine: symbol.endLine, summary: symbol.summary }
  }

  /**
   * What is known about a spot right now. Never waits on a model: whatever is
   * missing is queued, when the intent and the settings allow, and the view
   * says which.
   */
  async function view(spot: Spot, intent: Intent): Promise<ExplainView> {
    const mode = ports.mode()
    if (mode === 'off') return { ...NO_VIEW, spot, status: 'off' }
    const read = await source(spot.path)
    if (read === null) return { ...NO_VIEW, spot, status: 'no-file' }

    const pressure = ports.pressure()
    const isHeldBack = intent === 'browsing' ? pressure === 'held' : intent === 'following' && pressure !== 'none'
    const mayFetch = intent === 'asked' || (mode === 'automatic' && !isHeldBack)
    const priority = intent === 'asked' ? ASKED : intent === 'browsing' ? LOOKING : SAVED
    const now = await ports.now()
    const held = await knowledge(spot.path)
    const canMap = isMappable(read.text, read.lines)
    const isOutlineCurrent = held !== null && held.print === read.print
    const fresh = held === null ? [] : freshSymbols(held, read.lines)

    let isIncomplete = false
    const want = (job: Job): void => {
      isIncomplete = true
      if (!mayFetch) return
      // One spot at a time for a file: a caret moving through a file too large to map, or a selection growing line by
      // line, queued a lookup for every line it passed (the caching audit, 2026-10-06). What was asked for by name,
      // and what is explained ahead after a mapping, stay.
      if (job.kind === 'detail' && job.priority === LOOKING) {
        for (const [key, queued] of queue) {
          if (key !== job.key && queued.path === job.path && queued.kind === 'detail' && queued.priority === LOOKING) queue.delete(key)
        }
      }
      enqueue(job)
    }
    if (!isOutlineCurrent && canMap) want(outlineJob(spot.path, priority))

    const at = Math.max(1, Math.min(read.lines.length, spot.line))
    const isSelection = spot.endLine !== undefined && spot.endLine > spot.line
    // A file too large to map has no symbols, so the lines around the cursor stand in for one.
    const line = isSelection || canMap ? at : Math.max(1, at - WINDOW)
    const end = isSelection ? Math.max(line, Math.min(read.lines.length, spot.endLine ?? line)) : canMap ? line : Math.min(read.lines.length, at + WINDOW)
    let target: OutlineRow | null = null
    let detail: Detail | null = null
    let wanted = ''
    // What the deep review said about the file. A symbol in focus narrows it to that symbol.
    let insights = ports.insights(spot.path, '', '', read.print, name => mentionedAt(read.lines, name) !== -1)

    if (end > line) {
      // A selection is explained as what it is, whatever symbols it cuts across.
      const print = printOf(read.lines, line, end)
      target = { name: `lines ${line} to ${end}`, kind: 'selection', startLine: line, endLine: end, summary: '' }
      detail = await trusted(held === null ? undefined : regionFor(held, read.lines, line, end)?.detail)
      if (detail === null) {
        const job = detailJob(spot.path, print, end - line + 1, line, true, priority)
        wanted = job.key
        want(job)
      }
    } else {
      const symbol = symbolAt(fresh, line)
      if (symbol !== undefined) {
        target = row(symbol)
        insights = ports.insights(spot.path, symbol.name, symbol.print, read.print, name => mentionedAt(read.lines.slice(symbol.startLine - 1, symbol.endLine), name) !== -1)
        detail = await trusted(symbol.detail)
        if (detail === null) {
          const job = detailJob(spot.path, symbol.print, symbol.endLine - symbol.startLine + 1, symbol.startLine, false, priority)
          wanted = job.key
          want(job)
        }
      }
    }
    pump(now)

    const hasFailed =
      (wanted !== '' && isRecentFailure(wanted, now)) || (!isOutlineCurrent && canMap && isRecentFailure(`outline ${spot.path}`, now))
    const status: ExplainStatus = !isIncomplete
      ? 'fresh'
      : hasFailed
        ? 'failed'
        : mayFetch
          ? 'updating'
          : mode === 'automatic'
            ? 'held'
            : 'waiting'

    return {
      spot: { path: spot.path, line: at, ...(isSelection ? { endLine: end } : {}) },
      status,
      fileSummary: isOutlineCurrent ? (held?.summary ?? '') : '',
      outline: fresh.map(row),
      isOutlineCurrent,
      isMappable: canMap,
      target,
      detail:
        detail === null
          ? null
          : { what: detail.what, how: detail.how, why: detail.why, watch: detail.watch, uses: detail.uses.map(use => use.name) },
      insights,
    }
  }

  function isRecentFailure(key: string, now: number): boolean {
    const at = failedAt.get(key)?.at

    return at !== undefined && now - at < RETRY_MS
  }

  /**
   * Starts whatever may start now: the most urgent first, a few at a time.
   * Whatever is left waiting for a time is woken when that time comes.
   */
  function pump(now: number): void {
    if (isStopped) return
    // A failure older than the longest wait is forgotten: the map does not grow with every spot ever failed.
    for (const [key, failed] of failedAt) {
      if (now - failed.at > MAX_RETRY_MS) failedAt.delete(key)
    }
    const level = ports.pressure()
    const waiting = [...queue.values()].filter(job => readyAt(job) <= now).sort((a, b) => a.priority - b.priority)
    for (const job of waiting) {
      const isUrgent = job.priority <= LOOKING
      if (running.size >= (isUrgent ? PARALLEL + 1 : PARALLEL)) continue
      // Slowed, nothing is fetched that nobody is looking at. Held, only what the person asked for by name:
      // a request made while Claude is not answering fails, and makes everything else wait longer.
      if (level === 'held' ? job.priority !== ASKED : level !== 'none' && !isUrgent) continue
      queue.delete(job.key)
      const control = new AbortController()
      running.set(job.key, control)
      const born = generation
      void run(job, control.signal)
        .catch(error => {
          if (!isStopped) ports.log(`lookup failed (${job.key}): ${String(error)}`)

          return 'failed' as const
        })
        .then(async outcome => {
          running.delete(job.key)
          // Stopped while it ran (switched off, the project forgotten): nothing of it is taken up, and the host may
          // be gone with the module (the kit unloads it at a file's end, and a clock read then was a rejection
          // nothing handled: `filewatch.test.ts`, 2026-10-06).
          if (isStopped) return
          const finished = await ports.now()
          if (born !== generation) {
            // Started before the project's cache was forgotten: nothing of it is taken up again.
          } else if (outcome === 'failed' && ports.pressure() === 'held') {
            // Claude is not answering, or the plan is spent: that is not this lookup's failure. It waits with
            // the rest and goes again when they do, as something looked at and not asked for a second time.
            failedAt.delete(job.key)
            enqueue({ ...job, priority: Math.max(job.priority, LOOKING) })
          } else if (outcome === 'failed') failedAt.set(job.key, { at: finished, count: (failedAt.get(job.key)?.count ?? 0) + 1 })
          else failedAt.delete(job.key)
          // Saved again while it was being mapped: once more, after it has settled.
          if (outcome === 'again' && born === generation) enqueue(outlineJob(job.path, Math.max(job.priority, LOOKING)))
          const told = waiters
          waiters = []
          for (const tell of told) tell()
          if (isStopped) return
          ports.onChange()
          pump(finished)
        })
    }
    ports.wakeAt(nextWakeAt(now))
  }

  /**
   * What a lookup came to. `stale` and `again` both mean the code changed
   * while it ran, so its answer was not kept. `again` asks for another try.
   */
  type Outcome = 'done' | 'failed' | 'stale' | 'again'

  async function run(job: Job, signal: AbortSignal): Promise<Outcome> {
    const before = await source(job.path)
    if (before === null) return 'stale'

    return job.kind === 'outline' ? mapFile(job, before, signal) : explain(job, before, signal)
  }

  async function mapFile(job: Job, before: Source, signal: AbortSignal): Promise<Outcome> {
    if (!isMappable(before.text, before.lines)) return 'done'
    // Queued twice by two things that noticed the same gap: the first one has already filled it.
    if ((await knowledge(job.path))?.print === before.print) return 'done'
    const reply = await ports.complete(outlineRequest(ports.project(), job.path, before.lines), 6000, signal)
    // Cut short by a save. The save could not queue the next mapping while this one ran, so this asks for it.
    if (signal.aborted) return 'again'
    const outline = reply === null ? null : parseOutline(reply)
    if (outline === null) return 'failed'

    // The file may have been saved again while the model was reading the old one.
    const after = await source(job.path)
    if (after === null) return 'stale'
    if (after.print !== before.print) return 'again'

    const symbols = placeSymbols(outline.entries, after.lines)
    const at = await ports.now()
    await knowledge(job.path)
    await commit(job.path, current => withOutline(current, job.path, after.lines, outline.summary, symbols, at))

    // The parts that are new are the parts being worked on: explain a couple ahead of being asked.
    const unexplained = (known.get(job.path)?.symbols ?? []).filter(symbol => symbol.detail === undefined && symbol.kind !== 'class')
    for (const symbol of unexplained.slice(0, PREFETCH)) {
      if (ports.mode() !== 'automatic') break
      enqueue(detailJob(job.path, symbol.print, symbol.endLine - symbol.startLine + 1, symbol.startLine, false, AHEAD))
    }

    return 'done'
  }

  /**
   * A symbol of that name in another file that has been mapped, when exactly
   * one file has one. Two files with the same name in them tell nothing.
   */
  async function findElsewhere(name: string, except: string): Promise<Use | null> {
    const found: Use[] = []
    for (const [file, held] of known) {
      if (file === except || held === null || !held.symbols.some(symbol => symbol.name === name)) continue
      const read = await source(file)
      const symbol = read === null ? undefined : freshSymbols(held, read.lines).find(candidate => candidate.name === name)
      if (symbol !== undefined) found.push({ file, name, print: symbol.print })
    }

    return found.length === 1 ? (found[0] ?? null) : null
  }

  /** Where the lines a detail job is about are now, or null when they are no longer in the file. */
  function locate(job: Job, lines: readonly string[], held: FileKnowledge | null): { start: number; end: number; name: string } | null {
    if (!job.isRegion) {
      const symbol = (held === null ? [] : freshSymbols(held, lines)).find(candidate => candidate.print === job.print)

      return symbol === undefined ? null : { start: symbol.startLine, end: symbol.endLine, name: symbol.name }
    }
    const end = job.near + job.count - 1

    return end <= lines.length && printOf(lines, job.near, end) === job.print ? { start: job.near, end, name: '' } : null
  }

  async function explain(job: Job, before: Source, signal: AbortSignal): Promise<Outcome> {
    const held = await knowledge(job.path)
    const found = locate(job, before.lines, held)
    if (found === null) return 'stale'
    const fresh = held === null ? [] : freshSymbols(held, before.lines)
    // The same: an explanation that is already there and still holds is not asked for again.
    const existing = job.isRegion
      ? held?.regions.find(region => region.print === job.print)?.detail
      : fresh.find(symbol => symbol.print === job.print)?.detail
    if ((await trusted(existing)) !== null) return 'done'

    const reply = await ports.complete(
      detailRequest(ports.project(), {
        path: job.path,
        fileSummary: held !== null && held.print === before.print ? held.summary : '',
        outline: fresh,
        lines: before.lines,
        start: found.start,
        end: found.end,
        name: found.name,
        insights: found.name === '' ? [] : ports.insights(job.path, found.name, job.print, before.print, name => mentionedAt(before.lines.slice(found.start - 1, found.end), name) !== -1),
      }),
      1500,
      signal,
    )
    if (signal.aborted) return 'stale'
    const parsed = reply === null ? null : parseDetailReply(reply)
    if (parsed === null) return 'failed'

    // Kept only if the lines it explains are still there, exactly as they were.
    const after = await source(job.path)
    const latest = await knowledge(job.path)
    if (after === null || locate(job, after.lines, latest) === null) return 'stale'

    // What it leans on is recorded with today's fingerprints, so a change there is noticed later.
    const here = latest === null ? [] : freshSymbols(latest, after.lines)
    // A section of a script relies on what came before it, never on a later section that reads what it builds: the
    // other way round pointed the never-stale check the wrong way (the twelfth ui-truth pass, 2026-10-07).
    const isSection = here.find(candidate => candidate.startLine === found.start && candidate.endLine === found.end)?.kind === 'section'
    const uses: Use[] = []
    for (const name of parsed.uses) {
      const symbol = here.find(candidate => candidate.name === name || candidate.name.endsWith(`.${name}`))
      if (symbol !== undefined) {
        if (isSection && symbol.startLine > found.end) continue
        if (symbol.print !== job.print) uses.push({ file: job.path, name: symbol.name, print: symbol.print })
        continue
      }
      const elsewhere = await findElsewhere(name, job.path)
      if (elsewhere !== null) uses.push(elsewhere)
    }
    const detail: Detail = { what: parsed.what, how: parsed.how, why: parsed.why, watch: parsed.watch, uses, at: await ports.now(), model: ports.model }
    const head = (after.lines[job.near - 1] ?? '').trim()
    await commit(job.path, current => {
      const base: FileKnowledge = current ?? { v: 1, path: job.path, print: UNMAPPED, summary: '', symbols: [], regions: [], at: 0 }

      return job.isRegion ? withRegion(base, { print: job.print, lines: job.count, head, detail }) : withDetail(base, job.print, detail)
    })

    return 'done'
  }

  return {
    view,
    /** A file was saved. It is mapped again once it has stayed unchanged for a moment. */
    async touch(path: string): Promise<void> {
      if (isStopped || ports.mode() !== 'automatic') return
      // A mapping in flight is of text that no longer exists. An explanation in
      // flight may still be good: its symbol is looked for again when it lands.
      running.get(`outline ${path}`)?.abort()
      const now = await ports.now()
      changedAt.set(path, now)
      enqueue(outlineJob(path, SAVED))
      ports.wakeAt(nextWakeAt(now))
    },
    /**
     * Where the person is most likely working in a file they just saved: the
     * line where their latest change began, when the file was read before it.
     * Otherwise the first symbol that changed since the file was mapped, and
     * otherwise the file's first line.
     */
    async where(path: string): Promise<number> {
      const read = await source(path)
      if (read === null) return 1
      const changed = changedLine.get(path)
      if (changed !== undefined) return Math.min(changed, read.lines.length)
      const held = await knowledge(path)
      if (held === null) return 1
      const unchanged = new Set(freshSymbols(held, read.lines).map(symbol => symbol.print))
      const edited = held.symbols.find(symbol => !unchanged.has(symbol.print))

      return edited === undefined ? 1 : Math.max(1, Math.min(read.lines.length, edited.startLine))
    },
    /**
     * The fingerprint of a symbol as it is now, for something that wants to
     * be tied to that code. Falls back to the whole file's when the symbol is
     * not known by that name. Null when the file cannot be read.
     */
    async printFor(path: string, name: string): Promise<{ print: string; of: 'symbol' | 'file'; symbol: string } | null> {
      const read = await source(path)
      if (read === null) return null
      const held = await knowledge(path)
      const fresh = held === null ? [] : freshSymbols(held, read.lines)
      const symbol = name === '' ? undefined : fresh.find(candidate => candidate.name === name)
      if (symbol !== undefined) return { print: symbol.print, of: 'symbol', symbol: symbol.name }
      // A name the outline does not know (a variable, the reviewer's own word for a stretch of code) is tied to the
      // symbol whose lines first mention it, so that it shows beside that code; mentioned outside every symbol, to
      // the file. Not in the file at all, it keeps its name, and nothing shows it (the seventh ui-truth pass,
      // 2026-10-06: four insights for `$accountType` and the like, which the Explain tab could never reach).
      const line = mentionedAt(read.lines, name)
      if (line === -1) return { print: read.print, of: 'file', symbol: name }
      const around = fresh.find(candidate => candidate.startLine <= line && line <= candidate.endLine)

      return around === undefined ? { print: read.print, of: 'file', symbol: '' } : { print: around.print, of: 'symbol', symbol: around.name }
    },
    /**
     * Lets waiting lookups start if they may. Called when the time `wakeAt`
     * named has come, and when something that held lookups back has changed.
     */
    async wake(): Promise<void> {
      if (queue.size > 0) pump(await ports.now())
    },
    /** Resolves when the next lookup has ended, whatever came of it, or when the engine is stopped. */
    changed(): Promise<void> {
      return new Promise(resolve => {
        if (isStopped) resolve()
        else waiters.push(resolve)
      })
    },
    /** How many lookups are waiting or in flight. */
    pending(): number {
      return queue.size + running.size
    },
    /** Forgets everything held in memory, as after the project's cache was deleted. */
    reset(): void {
      // What is in flight would write the cache back into the folder that was just deleted.
      generation += 1
      for (const control of running.values()) control.abort()
      known.clear()
      sources.clear()
      queue.clear()
      failedAt.clear()
      entryStamps.clear()
      writing.clear()
      changedAt.clear()
      changedLine.clear()
    },
    stop(): void {
      isStopped = true
      queue.clear()
      for (const control of running.values()) control.abort()
      const told = waiters
      waiters = []
      for (const tell of told) tell()
    },
  }
}

export type Explainer = ReturnType<typeof createExplainer>

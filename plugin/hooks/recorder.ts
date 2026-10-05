import type { Working } from '../types'
import { createAttention, parseEditorReport } from './attention'
import { diffLines, formatHunks, splitLines } from './diff'
import { enclosingName } from './enclosing'
import { briefText, changesText, glanceText, workingOf } from './glance'
import type { Change, Seen } from './glance'
import { compact, emptyJournal, knownEntries, MAX_NAMES, mergeSpans, parseEntry, parseJournal, sync, withEntry } from './journal'
import type { Entry, Journal, Span } from './journal'
import { isTrivialChange, looksBinary } from './noise'
import type { Store } from './store'
import { tidy } from './working'

/** The effects the recorder needs. register.tsx supplies them as closures over `$`. */
export type RecorderPorts = {
  /** The tutor's own files, where the journal is kept. */
  store: Pick<Store, 'read' | 'update'>
  /** The journal's file, or '' when there is no data folder and nothing is kept between sessions. */
  file: string
  /** The repository's root, which an editor's absolute paths are taken from. */
  root: string
  /** A file's text by its path from the repository root, or null when it cannot be read. */
  read: (path: string) => Promise<string | null>
  /** The file as committed at HEAD, or null when git does not have it. */
  head: (path: string) => Promise<string | null>
  /**
   * Says when the journal next has something to do by itself, which is when
   * `tick` and `flush` should be called: a write that is due, or a slice of
   * attention long enough to keep. Null when there is nothing to wait for.
   */
  wakeAt?: (at: number | null) => void
}

/** The journal is written at most this often while entries keep coming. */
export const FLUSH_MS = 30_000
/** Larger files are saved without a word on what changed in them. */
const MAX_FILE_CHARS = 200_000
/** How many files' last saved text is kept, to tell what the next save changed. */
const MAX_TEXTS = 50
/** The activity tool shows the latest change to this many files, each cut to this length. */
const MAX_CHANGES = 3
const MAX_CHANGE_CHARS = 2500

/** The first line of a change that has anything on it. A new function often arrives with a blank line before it. */
function firstCodeLine(lines: readonly string[], start: number, count: number): number {
  for (let line = start; line < start + count; line += 1) {
    if ((lines[line - 1] ?? '').trim() !== '') return line
  }

  return start
}

/**
 * Keeps one project's journal while the tutor is on: what was saved and
 * where, where the editor's caret was, and what the person said they are
 * working on. It holds the journal in memory, writes it every so often, and
 * answers every question about what is going on from it.
 */
export function createRecorder(ports: RecorderPorts) {
  let held: Journal = emptyJournal()
  /** Every entry the file had when it was last read or written, which is how another session's entries are told from these. */
  let known = new Set<string>()
  let isDirty = false
  let isFlushing = false
  let flushedAt = 0
  /** Each changed file as it was at its last save, which the next save is compared with. */
  const texts = new Map<string, string>()
  /** What the latest saves changed, newest first, one per file. Kept in memory only: the journal holds no code. */
  let changes: Change[] = []
  const attention = createAttention()

  function remember(path: string, text: string): void {
    texts.delete(path)
    texts.set(path, text)
    const oldest = texts.keys().next()
    if (texts.size > MAX_TEXTS && oldest.done !== true) texts.delete(oldest.value)
  }

  /** Tells whoever keeps the time when the journal next has something to do. */
  function plan(): void {
    const flushAt = isDirty ? flushedAt + FLUSH_MS : null
    const sliceAt = attention.dueAt()
    ports.wakeAt?.(flushAt === null ? sliceAt : sliceAt === null ? flushAt : Math.min(flushAt, sliceAt))
  }

  function add(entry: Entry): void {
    const fitted = parseEntry(entry)
    if (fitted === null) return
    held = { ...held, entries: withEntry(held.entries, fitted) }
    isDirty = true
    plan()
  }

  function seen(now: number): Seen {
    return { journal: held, live: attention.rows(), caret: attention.caret(now), now }
  }

  return {
    /**
     * Reads the journal and rolls up the sittings that are over. `branch` is
     * null when the tutor was already on and only the module reloaded, which
     * is not a switch-on worth an entry. `dirty` are the files that already
     * differ from HEAD: their text now is what their next save is compared with.
     */
    async start(now: number, branch: string | null, dirty: readonly string[]): Promise<void> {
      const stored = ports.file === '' ? emptyJournal() : parseJournal(await ports.store.read(ports.file))
      known = knownEntries(stored)
      held = compact(stored, now)
      flushedAt = now
      for (const path of dirty.slice(0, MAX_TEXTS)) {
        const text = await ports.read(path)
        if (text !== null && text.length <= MAX_FILE_CHARS) remember(path, text)
      }
      // Being switched on is not worth a write. It is kept once something happens.
      if (branch !== null) {
        add({ at: now, kind: 'on', text: branch })
        isDirty = false
      }
      plan()
    },

    /** These files were saved since the previous poll: records what each save changed, and where. */
    async saved(paths: readonly string[], now: number): Promise<void> {
      for (const path of paths) {
        const after = await ports.read(path)
        if (after === null || after.length > MAX_FILE_CHARS || looksBinary(after)) continue
        const before = texts.get(path) ?? (await ports.head(path)) ?? ''
        remember(path, after)
        if (before === after || isTrivialChange(before, after)) continue

        const hunks = diffLines(before, after, 0)
        const lines = splitLines(after)
        const names: string[] = []
        // The biggest changes are the ones worth naming.
        for (const hunk of [...hunks].sort((a, b) => b.lines.length - a.lines.length)) {
          const name = enclosingName(lines, firstCodeLine(lines, hunk.newStart, hunk.newLines), path)
          if (name !== '' && !names.includes(name)) names.push(name)
        }
        const changed = hunks.flatMap(hunk => hunk.lines)
        const diff = formatHunks(diffLines(before, after, 2))
        changes = [
          { path, at: now, diff: diff.length <= MAX_CHANGE_CHARS ? diff : `${diff.slice(0, MAX_CHANGE_CHARS)}\n(cut)` },
          ...changes.filter(change => change.path !== path),
        ].slice(0, MAX_CHANGES)
        add({
          at: now,
          kind: 'save',
          path,
          until: now,
          saves: 1,
          added: changed.filter(line => line.startsWith('+')).length,
          removed: changed.filter(line => line.startsWith('-')).length,
          lines: mergeSpans(
            hunks.map((hunk): Span => [Math.max(1, hunk.newStart), Math.max(1, hunk.newStart) + Math.max(hunk.newLines, 1) - 1]),
          ),
          where: names.slice(0, MAX_NAMES).join(', '),
        })
      }
    },

    /** The files that differ from HEAD now. One that no longer does is compared with HEAD when it is next saved. */
    settle(dirty: readonly string[]): void {
      for (const path of [...texts.keys()]) {
        if (!dirty.includes(path)) texts.delete(path)
      }
    },

    /** Records something that happened: a commit, a move of HEAD, a note, a review. */
    add,

    /** What they said they are working on, in their words. '' takes it back. */
    say(text: string, now: number): void {
      const said = tidy(text)
      held = { ...held, said: { text: said, at: now } }
      add({ at: now, kind: 'said', text: said })
    },

    /** What a look made of their activity, and the files that look was shown. '' leaves the previous reading. */
    infer(text: string, paths: readonly string[], now: number): void {
      const inferred = tidy(text)
      if (inferred === '') return
      held = { ...held, inferred: { text: inferred, at: now, paths: [...paths] } }
      isDirty = true
      plan()
    },

    /** HEAD moved to other work, so what was made of the activity before no longer applies. */
    moved(now: number): void {
      held = { ...held, inferred: { text: '', at: now, paths: [] } }
    },

    /**
     * What the editor's file says, or null when it is gone. `isBaseline` is
     * true for what it said before the tutor was watching. This is called as
     * often as the editor writes, so it reads nothing.
     */
    editor(text: string | null, now: number, isBaseline: boolean): void {
      attention.observe(text === null ? null : parseEditorReport(text, ports.root), now, isBaseline)
      plan()
    },

    /**
     * Names the definition the caret moved into, which takes a read of that
     * file, brings the time the caret has spent up to now, and turns a slice
     * of it that is long enough into entries.
     */
    async tick(now: number): Promise<void> {
      const caret = attention.unnamed(now)
      if (caret !== null) {
        const source = await ports.read(caret.path)
        const isReadable = source !== null && source.length <= MAX_FILE_CHARS && !looksBinary(source)
        attention.name(isReadable ? enclosingName(splitLines(source), caret.line, caret.path) : '')
      }
      attention.tick(now)
      if (attention.isDue(now)) {
        for (const entry of attention.drain()) add(entry)
      }
      plan()
    },

    /**
     * Writes the journal when there is something new and the last write was
     * a while ago. `isForced` writes now, with the attention added up so far:
     * for what must not be lost, and for switching off.
     */
    async flush(now: number, isForced = false): Promise<void> {
      if (isFlushing || (!isForced && (!isDirty || now - flushedAt < FLUSH_MS))) return
      isFlushing = true
      const knownBefore = known
      try {
        if (isForced) {
          for (const entry of attention.drain()) add(entry)
        }
        if (!isDirty) return
        isDirty = false
        flushedAt = now
        // Merged with what the file holds as it is written: another session may have added to it.
        // Entries recorded while the write is under way stay in `held`, and go out with the next one.
        let written = held
        const merge = (stored: Journal): Journal => {
          held = sync(stored, held, knownBefore, now)
          written = held

          return held
        }
        if (ports.file === '') merge(emptyJournal())
        else await ports.store.update(ports.file, stored => ({ v: 1, ...merge(parseJournal(stored)) }))
        known = knownEntries(written)
      } catch (error) {
        // Whatever was not written is still held, and goes out with the next write.
        isDirty = true
        known = knownBefore
        throw error
      } finally {
        isFlushing = false
        plan()
      }
    },

    /** Forgets everything held, for when the person has the project forgotten. */
    reset(): void {
      held = emptyJournal()
      known = new Set()
      isDirty = false
      texts.clear()
      changes = []
      attention.drain()
    },

    /** What the pane's "Working on" line is made from. */
    working: (now: number): Working => workingOf(seen(now)),
    /** What a reviewer is told about what they have been doing, or ''. */
    glance: (now: number): string => glanceText(seen(now)),
    /** What the conversation is told with each prompt, or ''. */
    brief: (now: number): string => briefText(seen(now)),
    /** What the tutor's activity tool answers with: the glance, then what the latest saves changed. '' when there is nothing. */
    activity: (now: number): string =>
      [glanceText(seen(now)), changesText(changes, now)].filter(part => part !== '').join('\n\n'),
    /** The journal as held, for tests. */
    journal: (): Journal => held,
  }
}

export type Recorder = ReturnType<typeof createRecorder>

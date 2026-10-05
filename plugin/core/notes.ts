import type { Note, NoteKind } from '../types'

/**
 * What the play-by-play model sends back: notes it adds, the ids of open
 * notes that no longer apply, the animated persona's line, and what the
 * person appears to be working on. Each of the last two is '' for none.
 */
export type ReviewReply = {
  resolved: number[]
  notes: Omit<Note, 'id'>[]
  say: string
  workingOn: string
}

/**
 * Most important first. A decision point comes after what will or may break,
 * and before what only teaches. An insight comes last: it is never a problem.
 */
const KINDS: readonly NoteKind[] = ['bug', 'risk', 'decision', 'idiom', 'tip', 'insight']

/** Kinds that point out something to learn from rather than something wrong. They are not lessons that keep coming back. */
export function isProblem(kind: NoteKind): boolean {
  return kind !== 'decision' && kind !== 'insight'
}

/** The pane never holds more than this many notes: more than a person reads is noise. */
export const MAX_OPEN_NOTES = 8
/** One look adds at most this many. */
export const MAX_NEW_NOTES = 3
/** How many dismissed notes are remembered. Past that, the oldest are forgotten. */
export const MAX_DISMISSED = 30
const MAX_NOTE_CHARS = 600

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Reads the model's reply. The reply is asked for as one JSON object, but
 * models wrap JSON in prose or a code fence often enough that only the
 * outermost braces are trusted. Anything malformed is dropped, never shown.
 */
export function parseReply(text: string): ReviewReply | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null

  let data: unknown
  try {
    data = JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
  const reply = asRecord(data)
  if (reply === null) return null

  const resolved = Array.isArray(reply.resolved)
    ? reply.resolved.filter((id): id is number => typeof id === 'number' && Number.isInteger(id))
    : []

  const notes: Omit<Note, 'id'>[] = []
  for (const item of Array.isArray(reply.notes) ? reply.notes : []) {
    const note = asRecord(item)
    if (note === null) continue
    const kind = KINDS.find(known => known === note.kind)
    const body = typeof note.note === 'string' ? note.note.trim() : ''
    if (kind === undefined || body === '' || typeof note.file !== 'string' || note.file === '') continue

    notes.push({
      file: note.file,
      line: typeof note.line === 'number' && note.line >= 1 ? Math.floor(note.line) : 1,
      kind,
      topic: slug(typeof note.topic === 'string' && note.topic !== '' ? note.topic : body),
      text: body.slice(0, MAX_NOTE_CHARS),
    })
  }

  return {
    resolved,
    notes: notes.slice(0, MAX_NEW_NOTES),
    say: typeof reply.say === 'string' ? reply.say.trim() : '',
    workingOn: typeof reply.working_on === 'string' ? reply.working_on.replace(/\s+/g, ' ').trim() : '',
  }
}

/** Most important first, then in reading order. */
export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort(
    (a, b) =>
      KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.file.localeCompare(b.file) || a.line - b.line || a.id - b.id,
  )
}

function isSamePoint(a: Pick<Note, 'file' | 'topic'>, b: Pick<Note, 'file' | 'topic'>): boolean {
  return a.file === b.file && a.topic === b.topic
}

/** The dismissed notes with one more. The same point about the same file is kept once. */
export function withDismissed(dismissed: readonly Note[], note: Note): Note[] {
  return [...dismissed.filter(other => !isSamePoint(other, note)), note].slice(-MAX_DISMISSED)
}

/**
 * The open notes after a look: resolved ones gone, new ones numbered and
 * added. A new note is skipped when its file was not part of the look, when
 * an open note already makes the same point about the same file, or when the
 * person dismissed that point about that file.
 */
export function applyReply(
  open: readonly Note[],
  reply: Pick<ReviewReply, 'resolved' | 'notes'>,
  lookedAt: readonly string[],
  nextId: number,
  dismissed: readonly Note[] = [],
): { notes: Note[]; nextId: number } {
  const notes = open.filter(note => !reply.resolved.includes(note.id))
  let id = nextId
  for (const added of reply.notes) {
    if (!lookedAt.includes(added.file)) continue
    if (notes.some(note => isSamePoint(note, added))) continue
    if (dismissed.some(note => isSamePoint(note, added))) continue
    notes.push({ ...added, id })
    id += 1
  }

  // Over the limit, the least important and, among those, the oldest go first.
  const byWorth = [...notes].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || b.id - a.id)
  const kept = sortNotes(byWorth.slice(0, MAX_OPEN_NOTES))

  return { notes: kept, nextId: id }
}

/** The dismissed notes as the reviewer reads them. No line numbers: the code has moved on since. */
export function listDismissed(notes: readonly Note[]): string {
  return notes.map(note => `- ${note.file} (${note.topic}) ${note.text}`).join('\n')
}

/** The open notes as the conversation and the reviewer read them. */
export function listNotes(notes: readonly Note[]): string {
  return sortNotes(notes)
    .map(note => `${note.id}. [${note.kind}] ${note.file}:${note.line} (${note.topic}) ${note.text}`)
    .join('\n')
}

/**
 * The open and dismissed notes as kept on disk for the project, so that a
 * session that closes without switching off finds them again. `prints` holds
 * the fingerprint of each noted file's text as the look that raised the note
 * saw it: a note comes back only while its file still reads that way.
 */
export type KeptNotes = { v: 1; notes: Note[]; dismissed: Note[]; prints: Record<string, string> }

export const NO_KEPT_NOTES: KeptNotes = { v: 1, notes: [], dismissed: [], prints: {} }

function parseNote(value: unknown): Note | null {
  const note = asRecord(value)
  if (note === null) return null
  const kind = KINDS.find(known => known === note.kind)
  if (kind === undefined || typeof note.file !== 'string' || note.file === '' || typeof note.text !== 'string' || note.text === '') return null
  if (typeof note.id !== 'number' || !Number.isInteger(note.id) || note.id < 1) return null

  return {
    id: note.id,
    file: note.file,
    line: typeof note.line === 'number' && note.line >= 1 ? Math.floor(note.line) : 1,
    kind,
    topic: typeof note.topic === 'string' ? note.topic : '',
    text: note.text.slice(0, MAX_NOTE_CHARS),
  }
}

function parseNotes(value: unknown, limit: number): Note[] {
  return (Array.isArray(value) ? value : []).map(parseNote).filter(note => note !== null).slice(-limit)
}

export function parseKeptNotes(value: unknown): KeptNotes {
  const kept = asRecord(value)
  if (kept === null) return NO_KEPT_NOTES
  const prints: Record<string, string> = {}
  for (const [file, print] of Object.entries(asRecord(kept.prints) ?? {})) {
    if (typeof print === 'string' && print !== '') prints[file] = print
  }

  return { v: 1, notes: parseNotes(kept.notes, MAX_OPEN_NOTES), dismissed: parseNotes(kept.dismissed, MAX_DISMISSED), prints }
}

/** What to keep on disk: the notes, and the fingerprint of each noted file that one is known for. */
export function keepNotes(notes: readonly Note[], dismissed: readonly Note[], prints: ReadonlyMap<string, string>): KeptNotes {
  const kept: Record<string, string> = {}
  for (const note of notes) {
    const print = prints.get(note.file)
    if (print !== undefined) kept[note.file] = print
  }

  return { v: 1, notes: [...notes], dismissed: [...dismissed], prints: kept }
}

/**
 * The kept notes that still hold: those whose file reads now as it did when
 * the note was raised. `now` maps a file to its fingerprint today, and has no
 * entry for a file that is gone. A note about text that has changed since is
 * never shown: the next look at that file says what is true of it.
 */
export function stillOpen(kept: KeptNotes, now: ReadonlyMap<string, string>): Note[] {
  return kept.notes.filter(note => {
    const print = kept.prints[note.file]

    return print !== undefined && now.get(note.file) === print
  })
}

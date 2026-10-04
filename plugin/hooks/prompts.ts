import type { ExplainView, Note, Review } from '../types'
import { formatHunks, splitLines } from './diff'
import type { Hunk } from './diff'
import { describeSpot, viewText } from './focus'
import { languageName, languageOf } from './languages'
import { listDismissed, listNotes } from './notes'

/** One file's change since the previous look. */
export type FileChange = {
  /** Path from the repository root. */
  path: string
  before: string
  after: string
  hunks: Hunk[]
}

/** A file this short is shown whole. A longer one is shown around its changes. */
const WHOLE_FILE_LINES = 300
/** How many lines are shown on each side of a change in a long file. */
const WINDOW = 30
/** Roughly 12,000 tokens. Files that do not fit wait for the next look. */
const MAX_PROMPT_CHARS = 48_000

function numbered(lines: readonly string[], from: number, to: number): string {
  const width = String(to).length
  const shown: string[] = []
  for (let line = from; line <= to; line += 1) {
    shown.push(`${String(line).padStart(width)} | ${lines[line - 1] ?? ''}`)
  }

  return shown.join('\n')
}

/** The file as it is now, with line numbers: all of it when short, otherwise the parts around the changes. */
export function excerpt(after: string, hunks: readonly Hunk[]): string {
  const lines = splitLines(after)
  if (lines.length <= WHOLE_FILE_LINES) return numbered(lines, 1, lines.length)

  const windows: { from: number; to: number }[] = []
  for (const hunk of hunks) {
    const from = Math.max(1, hunk.newStart - WINDOW)
    const to = Math.min(lines.length, hunk.newStart + hunk.newLines + WINDOW)
    const last = windows[windows.length - 1]
    if (last !== undefined && from <= last.to + 1) last.to = Math.max(last.to, to)
    else windows.push({ from, to })
  }

  return windows.map(window => numbered(lines, window.from, window.to)).join('\n...\n')
}

function fileSection(change: FileChange): string {
  const language = languageOf(change.path)

  return [
    `=== ${change.path}${language === null ? '' : ` (${languageName(language)})`} ===`,
    'What changed since your last look:',
    formatHunks(change.hunks),
    '',
    'The file as it is now, with line numbers:',
    excerpt(change.after, change.hunks),
  ].join('\n')
}

/**
 * The user message for one look, and which files it shows. Files that would
 * push it past the size limit are left out, and wait for the next look.
 */
export function playByPlayPrompt<Change extends FileChange>(
  changes: readonly Change[],
  open: readonly Note[],
  dismissed: readonly Note[] = [],
): { prompt: string; shown: Change[] } {
  // Only what was dismissed in the files of this look: the rest cannot come up.
  const gone = dismissed.filter(note => changes.some(change => change.path === note.file))
  const head = [
    'Notes still open in the pane:',
    open.length === 0 ? '(none)' : listNotes(open),
    '',
    ...(gone.length === 0 ? [] : ['Notes they dismissed. Do not raise these again:', listDismissed(gone), '']),
    'Changes since your last look:',
  ].join('\n')

  const sections: string[] = []
  const shown: Change[] = []
  let size = head.length
  for (const change of changes) {
    const section = fileSection(change)
    // The first file is always shown, however large, or nothing would ever be looked at.
    if (shown.length > 0 && size + section.length > MAX_PROMPT_CHARS) continue
    sections.push(section)
    shown.push(change)
    size += section.length
  }

  return { prompt: [head, ...sections].join('\n\n'), shown }
}

/** The reviewer's system prompt: its instructions, then what is known about the person, then the persona. */
export function reviewerSystem(instructions: string, extras: readonly string[], persona: string): string {
  return [instructions, ...extras, persona].filter(part => part !== '').join('\n\n')
}

/** What the conversation is told about the notes, attached to each prompt while there are any. */
export function notesContext(notes: readonly Note[]): string {
  return [
    'Backseat Driver: these play-by-play notes are open in the pane beside this conversation. The user can see them and may refer to them by number.',
    listNotes(notes),
  ].join('\n')
}

/** Everything the pane shows that the conversation should know about, or '' when it shows nothing. */
export function paneContext(notes: readonly Note[], review: Review): string {
  const parts: string[] = []
  if (notes.length > 0) parts.push(notesContext(notes))
  if (review.state === 'done') {
    parts.push(
      [
        `Backseat Driver: the pane also shows this deep review of ${review.subject}. The user has it in front of them and may ask about it or contest it.`,
        review.text,
      ].join('\n'),
    )
  }

  return parts.join('\n\n')
}

/**
 * What pressing "explain" on a note sends into the conversation. The note
 * was the nudge, so this asks for the next step of the contract's ladder.
 */
export function explainRequest(note: Note): string {
  return `Explain play-by-play note ${note.id} (${note.file} line ${note.line}): "${note.text}" I have read the nudge. Give me the concept behind it.`
}

/** What the conversation is told about the Explain tab, or '' when it shows nothing worth telling. */
export function explainContext(view: ExplainView): string {
  const shown = viewText(view)
  if (view.spot === null || shown === '') return ''

  return `The pane's Explain tab is on ${describeSpot(view.spot)}. It shows:\n${shown}`
}

/** What "ask about this" in the Explain tab sends into the conversation. */
export function explainAsk(view: ExplainView): string {
  if (view.spot === null) return ''
  if (view.target === null) return `Tell me more about ${view.spot.path}.`

  return `Tell me more about ${view.target.name} in ${view.spot.path} (lines ${view.target.startLine} to ${view.target.endLine}).`
}

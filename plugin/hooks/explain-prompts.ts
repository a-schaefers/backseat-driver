import type { OutlineEntry, Sym } from './knowledge'
import { languageName, languageOf } from './languages'

/** A file longer than this is not mapped as a whole. Its parts are still explained when asked about. */
export const MAX_SOURCE_LINES = 2500
/** Roughly 30,000 tokens. */
export const MAX_SOURCE_CHARS = 120_000
/** A selection or a symbol longer than this is explained from its first lines. */
const MAX_DETAIL_LINES = 220

/** What is known about the project as a whole. Empty until a deep review or a survey has written it. */
export type ProjectContext = { name: string; overview: string }

function numbered(lines: readonly string[], from: number, to: number): string {
  const width = String(to).length
  const shown: string[] = []
  for (let line = from; line <= to; line += 1) {
    shown.push(`${String(line).padStart(width)} | ${lines[line - 1] ?? ''}`)
  }

  return shown.join('\n')
}

function fileLabel(path: string): string {
  const language = languageOf(path)

  return language === null ? path : `${path} (${languageName(language)})`
}

function projectLines(project: ProjectContext): string[] {
  return project.overview === ''
    ? [`Project: ${project.name}`]
    : [`Project: ${project.name}`, `What is known about it: ${project.overview}`]
}

/** Whether a file is small enough to be mapped in one request. */
export function isMappable(text: string, lines: readonly string[]): boolean {
  return lines.length <= MAX_SOURCE_LINES && text.length <= MAX_SOURCE_CHARS
}

/** The request for a file's outline: what it is for, and every named thing in it. */
export function outlineRequest(project: ProjectContext, path: string, lines: readonly string[]): string {
  return [
    ...projectLines(project),
    `File: ${fileLabel(path)}`,
    '',
    'Map this file.',
    '',
    numbered(lines, 1, lines.length),
  ].join('\n')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** The outermost JSON object in a reply, or null. Models wrap JSON in prose or a code fence often enough. */
function jsonIn(reply: string): Record<string, unknown> | null {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return asRecord(JSON.parse(reply.slice(start, end + 1)))
  } catch {
    return null
  }
}

const MAX_SUMMARY_CHARS = 400
const MAX_FIELD_CHARS = 700

/** An outline as the model sent it. Entries are checked against the file later, by `placeSymbols`. */
export function parseOutline(reply: string): { summary: string; entries: OutlineEntry[] } | null {
  const data = jsonIn(reply)
  if (data === null) return null

  const entries: OutlineEntry[] = []
  for (const item of Array.isArray(data.symbols) ? data.symbols : []) {
    const symbol = asRecord(item)
    if (symbol === null) continue
    const start = typeof symbol.start === 'number' ? Math.floor(symbol.start) : 0
    const end = typeof symbol.end === 'number' ? Math.floor(symbol.end) : start
    if (text(symbol.name) === '' || text(symbol.head) === '' || start < 1 || end < start) continue
    entries.push({
      name: text(symbol.name).slice(0, 120),
      kind: text(symbol.kind).slice(0, 30),
      start,
      end,
      head: text(symbol.head),
      summary: text(symbol.summary).slice(0, MAX_SUMMARY_CHARS),
    })
  }

  return { summary: text(data.summary).slice(0, MAX_SUMMARY_CHARS), entries }
}

export type DetailTarget = {
  path: string
  fileSummary: string
  /** The file's outline, so the explanation can name what else is there. */
  outline: readonly Sym[]
  lines: readonly string[]
  start: number
  end: number
  /** The symbol's name, or '' for a selected region. */
  name: string
  /** What a deep review said about this code, when it said anything. */
  insights: readonly string[]
}

/** The request for the fuller explanation of one symbol or one selected region. */
export function detailRequest(project: ProjectContext, target: DetailTarget): string {
  const shownEnd = Math.min(target.end, target.start + MAX_DETAIL_LINES - 1)
  const others = target.outline
    .filter(symbol => symbol.startLine !== target.start || symbol.endLine !== target.end)
    .map(symbol => `- ${symbol.name} (${symbol.kind}): ${symbol.summary}`)

  return [
    ...projectLines(project),
    `File: ${fileLabel(target.path)}${target.fileSummary === '' ? '' : `. ${target.fileSummary}`}`,
    ...(others.length === 0 ? [] : ['', 'Also in this file:', ...others]),
    ...(target.insights.length === 0 ? [] : ['', 'What the last deep review said about this code:', ...target.insights.map(insight => `- ${insight}`)]),
    '',
    target.name === ''
      ? `Explain the selected lines, ${target.start} to ${target.end}.`
      : `Explain ${target.name}, lines ${target.start} to ${target.end}.`,
    ...(shownEnd < target.end ? [`Only its first ${MAX_DETAIL_LINES} lines are shown.`] : []),
    '',
    numbered(target.lines, target.start, shownEnd),
  ].join('\n')
}

export type DetailReply = { what: string; how: string; why: string; watch: string; uses: string[] }

export function parseDetailReply(reply: string): DetailReply | null {
  const data = jsonIn(reply)
  if (data === null || text(data.what) === '') return null
  const uses = (Array.isArray(data.uses) ? data.uses : [])
    .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
    .map(name => name.trim())
    .slice(0, 12)

  return {
    what: text(data.what).slice(0, MAX_FIELD_CHARS),
    how: text(data.how).slice(0, MAX_FIELD_CHARS),
    why: text(data.why).slice(0, MAX_FIELD_CHARS),
    watch: text(data.watch).slice(0, MAX_FIELD_CHARS),
    uses,
  }
}

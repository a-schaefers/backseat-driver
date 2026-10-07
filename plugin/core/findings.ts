/**
 * The project's ledger of issues, at the edge: its types, reading it from the
 * project folder (`findings.json`), the reviewer's fence of issues, placing an
 * issue in a file's current text, and the words each surface says.
 *
 * The rules (who may rule on an issue, when a candidate is an issue on record,
 * the ranking and the views) are the kernel's (`Kernel.Ledger`), through
 * `core.ts`, and are re-exported here.
 *
 * Why there is a ledger (owner, 2026-10-07): in a real codebase the pane said
 * nothing, and its silence read as "he wrote a perfect codebase". The
 * play-by-play judges saves, a review judged one commit in prose that scrolled
 * away, and the first look around was told not to judge at all. The ledger is
 * one ranked list of the issues found, kept until they are fixed or dismissed,
 * that every surface draws.
 */

import { isCommentLine } from './noise'
import type { Actor, Category, Coverage, Finding, IssueOrigin, IssueStatus, Ledger, PersonAction, Severity } from '../types'
import type { IssueSpot } from './notes'
import { askedIssues, coveredLedger, foundIssues, LEDGER_MAX_CLOSED, LEDGER_NEAR_LINES, ledgerViews, normalLedger, personIssue, ruledIssues } from './core'

export { askedIssues, coveredLedger, foundIssues, LEDGER_MAX_CLOSED, LEDGER_NEAR_LINES, ledgerViews, normalLedger, personIssue, ruledIssues }

// The ledger's shapes are the pane's state too, and the plugin's types file must stand alone: they are declared there.
export type { Actor, Category, Coverage, Finding, IssueOrigin, IssueStatus, Ledger, PersonAction, Severity } from '../types'

export const SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low']
export const CATEGORIES: readonly Category[] = ['security', 'bug', 'edge-case', 'logic', 'robustness', 'quality']


/** An issue a review raised, placed in the file. */
export type Candidate = Pick<Finding, 'file' | 'line' | 'lineText' | 'severity' | 'category' | 'topic' | 'title' | 'text' | 'condition'>

/** What a model or the person says of an issue on record. `severity` '' leaves it as it is. */
export type Ruling = { id: number; status: string; note: string; severity: Severity | '' }

export type LedgerViews = {
  ranked: number[]
  folded: number[]
  closed: number[]
  counts: Record<Severity, number>
  serious: number
  play: number[]
  playMore: number
}

export const EMPTY_COVERAGE: Coverage = { at: 0, commit: '', files: 0, read: [], skipped: [] }
export const EMPTY_LEDGER: Ledger = { nextId: 1, findings: [], coverage: EMPTY_COVERAGE }

/** The project's file of issues, beside its notes and reviews. */
export const FINDINGS_FILE = 'findings.json'

/** How many issues one review or audit may raise: the most serious first. */
export const MAX_FROM_REVIEW = 12
export const MAX_FROM_AUDIT = 20

/** A quoted line found this near the line a review named is that line. */
export const NEAR_LINES = 5

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function text(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function moment(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** A path as a model wrote it: one inside the project, or `.` for the project as a whole. '' otherwise. */
function cleanPath(value: unknown): string {
  const path = text(value, 300).replace(/^\.\//, '')
  if (path === '.' || path === '') return path
  const isInside = !path.startsWith('/') && !path.split('/').some(part => part === '' || part === '.' || part === '..')

  return isInside ? path : ''
}

function severityOf(value: unknown): Severity {
  const word = text(value, 20).toLowerCase()

  return (SEVERITIES as readonly string[]).includes(word) ? (word as Severity) : 'medium'
}

function categoryOf(value: unknown): Category {
  const word = text(value, 20).toLowerCase().replace(/[ _]/g, '-')

  return (CATEGORIES as readonly string[]).includes(word) ? (word as Category) : 'quality'
}

function statusOf(value: unknown): IssueStatus {
  const word = text(value, 20).toLowerCase()

  return word === 'partly' || word === 'resolved' || word === 'dismissed' ? word : 'open'
}

function actorOf(value: unknown): '' | Actor {
  const word = text(value, 20)

  return word === 'person' || word === 'review' || word === 'look' ? word : ''
}

/** `findings.json` as stored, or anything else: what is not an issue is dropped, and the kernel keeps its rules. */
export function parseLedger(stored: unknown): Ledger {
  const record = asRecord(stored)
  if (record === null) return EMPTY_LEDGER
  const findings: Finding[] = []
  for (const item of Array.isArray(record.findings) ? record.findings : []) {
    const f = asRecord(item)
    if (f === null) continue
    findings.push({
      id: whole(f.id),
      file: cleanPath(f.file),
      line: whole(f.line),
      lineText: text(f.lineText, 400),
      severity: severityOf(f.severity),
      category: categoryOf(f.category),
      topic: slug(text(f.topic, 80)),
      title: text(f.title, 120),
      text: text(f.text, 900),
      condition: text(f.condition, 240),
      origin: f.origin === 'audit' ? 'audit' : 'review',
      commit: text(f.commit, 40),
      at: moment(f.at),
      status: statusOf(f.status),
      statusAt: moment(f.statusAt),
      statusBy: actorOf(f.statusBy),
      statusNote: text(f.statusNote, 400),
      isPinned: f.isPinned === true,
    })
  }
  const coverage = asRecord(record.coverage)
  const skipped: Coverage['skipped'] = []
  for (const item of Array.isArray(coverage?.skipped) ? coverage.skipped : []) {
    const skip = asRecord(item)
    const path = text(skip?.path, 200)
    if (path !== '') skipped.push({ path, why: text(skip?.why, 200) })
  }

  return normalLedger({
    nextId: Math.max(1, whole(record.nextId)),
    findings,
    coverage:
      coverage === null
        ? EMPTY_COVERAGE
        : {
            at: moment(coverage.at),
            commit: text(coverage.commit, 40),
            files: whole(coverage.files),
            read: (Array.isArray(coverage.read) ? coverage.read : []).map(path => text(path, 300)).filter(path => path !== '').slice(0, 400),
            skipped: skipped.slice(0, 60),
          },
  })
}

/** An issue as the reviewer wrote it in its fence, before it is placed. */
export type FenceIssue = Omit<Candidate, 'lineText'> & { quote: string }

export type FenceCoverage = { read: string[]; skipped: { path: string; why: string }[] }

/** The reviewer's issues, one JSON object a line, so that a line that does not parse loses one issue and not the rest. */
const FINDINGS_FENCE = /```backseat-findings[ \t]*\n([\s\S]*?)```/g

/** A review's text without its fence of issues, which the person never sees. */
export function withoutFindingsFence(answer: string): string {
  return answer.replace(FINDINGS_FENCE, '')
}

/**
 * The issues, rulings and coverage a review wrote in its fence. A line with
 * an `id` is a ruling on an issue on record; one with `read` is what an
 * audit read; any other is an issue.
 */
export function parseFindingsFence(answer: string): { issues: FenceIssue[]; rulings: Ruling[]; coverage: FenceCoverage | null } {
  const issues: FenceIssue[] = []
  const rulings: Ruling[] = []
  let coverage: FenceCoverage | null = null
  for (const match of answer.matchAll(FINDINGS_FENCE)) {
    for (const line of (match[1] ?? '').split('\n')) {
      let data: unknown
      try {
        data = JSON.parse(line.trim())
      } catch {
        continue
      }
      const item = asRecord(data)
      if (item === null) continue
      if (item.id !== undefined) {
        const id = whole(item.id)
        if (id > 0) rulings.push({ id, status: text(item.status, 20).toLowerCase(), note: text(item.note, 400), severity: item.severity === undefined || item.severity === '' ? '' : severityOf(item.severity) })
        continue
      }
      if (Array.isArray(item.read)) {
        const skipped: FenceCoverage['skipped'] = []
        for (const entry of Array.isArray(item.skipped) ? item.skipped : []) {
          const skip = asRecord(entry)
          const path = text(skip?.path, 200)
          if (path !== '') skipped.push({ path, why: text(skip?.why, 200) })
        }
        coverage = { read: item.read.map(path => cleanPath(path)).filter(path => path !== '' && path !== '.').slice(0, 400), skipped: skipped.slice(0, 60) }
        continue
      }
      const file = cleanPath(item.file)
      const words = text(item.text, 900)
      if (file === '' || words === '') continue
      const title = text(item.title, 120)
      issues.push({
        file,
        line: whole(item.line),
        quote: text(item.quote, 400),
        severity: severityOf(item.severity),
        category: categoryOf(item.category),
        topic: slug(text(item.topic, 80)) || slug(title) || 'issue',
        title: title === '' ? words.split(/(?<=[.!?])\s/)[0]?.slice(0, 120) ?? '' : title,
        text: words,
        condition: text(item.condition, 240),
      })
    }
  }

  return { issues, rulings, coverage }
}

/** Whether a line of a file is the quoted one: the same text, trimmed, or a long enough quote it contains. */
function isQuoted(line: string, quote: string): boolean {
  const said = line.trim()
  const wanted = quote.trim()
  // The line commented out since is not the line: the issue there was dealt with, or the line is gone.
  if (isCommentLine(said) && !isCommentLine(wanted)) return false

  // The line itself, a long enough part of it, or its start up to a value left out: a secret's line is quoted so, and
  // the first live audit's "DB password committed" was dropped for a start of eleven characters (2026-10-07).
  return said === wanted || (wanted.length >= 12 && said.includes(wanted)) || (wanted.length >= 6 && said.startsWith(wanted))
}

/** Where a quoted line is in a file: the occurrence nearest the line named, or null when it is nowhere. */
export function placeLine(lines: readonly string[], quote: string, line: number): number | null {
  if (quote.trim() === '') return null
  let best: number | null = null
  lines.forEach((candidate, index) => {
    if (!isQuoted(candidate, quote)) return
    const at = index + 1
    if (best === null || Math.abs(at - line) < Math.abs(best - line)) best = at
  })

  return best
}

/**
 * An issue as the reviewer wrote it, placed: at the line it quotes in the
 * file as it is now, else in the file as the reviewed commit left it (shown
 * then as "the code here changed since"), else nowhere, and dropped: a quote
 * that is in neither is the model's. An issue about the whole file, or the
 * project (`.`), needs no line.
 */
export function anchorIssue(issue: FenceIssue, current: readonly string[] | null, atCommit: readonly string[] | null): Candidate | null {
  const { quote, ...rest } = issue
  if (issue.file === '.' || (issue.line === 0 && quote === '')) return issue.file !== '.' && current === null && atCommit === null ? null : { ...rest, line: 0, lineText: '' }
  if (quote === '') {
    // No quote: the line named, when the file has it. Placement later holds it to that line's text.
    const said = current?.[issue.line - 1]?.trim() ?? ''

    return said === '' ? null : { ...rest, lineText: said }
  }
  for (const lines of [current, atCommit]) {
    if (lines === null) continue
    const at = placeLine(lines, quote, issue.line)
    // The quote is what is kept, not the whole line: a line that holds a secret is quoted only up to its value, and
    // placement finds a long enough quote inside its line.
    if (at !== null) return { ...rest, line: at, lineText: quote.trim() }
  }

  // A quote in neither text, in a file that is there: the issue is kept for the file, never lost without a word.
  return current === null && atCommit === null ? null : { ...rest, line: 0, lineText: '' }
}

/**
 * Where an issue's line stands now: still at its line, or moved when its text
 * is once in the file. Twice or more, which of them it was cannot be told:
 * null, "changed since", rather than another line of the same text (the
 * thirteenth ui-truth pass: a debug echo fixed away would have moved its
 * issue onto the real output line).
 */
export function standsAt(lines: readonly string[], quote: string, line: number): number | null {
  if (quote.trim() === '') return null
  if (isQuoted(lines[line - 1] ?? '', quote)) return line
  const at = lines.flatMap((candidate, index) => (isQuoted(candidate, quote) ? [index + 1] : []))

  return at.length === 1 ? (at[0] ?? null) : null
}

/**
 * Where each open issue of a file stands in its current text: its line, or
 * null when its line no longer reads as it did ("the code here changed since
 * it was found"). An issue about the whole file stands at 0. Placement never
 * changes an issue's status: only a ruling does.
 */
export function placeIssues(ledger: Ledger, file: string, lines: readonly string[]): Map<number, number | null> {
  const placed = new Map<number, number | null>()
  for (const finding of ledger.findings) {
    if (finding.file !== file || finding.status === 'resolved' || finding.status === 'dismissed') continue
    placed.set(finding.id, finding.line === 0 || finding.lineText === '' ? 0 : standsAt(lines, finding.lineText, finding.line))
  }

  return placed
}

/** Where an issue is, as a person reads it: "index.php:95", "index.php", "the project". */
export function issueWhere(finding: Pick<Finding, 'file' | 'line'>, placed?: number | null): string {
  if (finding.file === '.') return 'the project'
  const line = placed === undefined ? finding.line : placed
  if (line === null) return `${finding.file}:${finding.line}`

  return line > 0 ? `${finding.file}:${line}` : finding.file
}

/** The issues a review is told about, with their ids, so that it rules on them by id. */
export function issuesForRequest(ledger: Ledger, ids: readonly number[], placed?: ReadonlyMap<number, number | null>): string[] {
  const byId = new Map(ledger.findings.map(finding => [finding.id, finding]))

  return ids.flatMap(id => {
    const finding = byId.get(id)
    if (finding === undefined) return []
    const partly = finding.status === 'partly' ? ` (partly fixed: ${finding.statusNote})` : ''
    const stands = placed?.get(id)
    const moved = stands === null ? ' (its line has changed since it was found)' : ''

    return [`${id}. [${finding.severity}, ${finding.category}] ${issueWhere(finding, stands)} (${finding.topic}) ${finding.title}${partly}${moved}`, `   ${finding.text}`]
  })
}

/**
 * The open issues of the files a look is shown, placed in each file's text
 * as it is now: the lines its request lists, and where each stands, so that
 * a note about the same thing is not raised beside it.
 */
export function lookIssues(ledger: Ledger, texts: ReadonlyMap<string, string>): { lines: string[]; spots: IssueSpot[] } {
  const byId = new Map(ledger.findings.map(finding => [finding.id, finding]))
  const placed = new Map<number, number | null>()
  const spots: IssueSpot[] = []
  for (const [file, text] of texts) {
    for (const [id, line] of placeIssues(ledger, file, text.split('\n'))) {
      const finding = byId.get(id)
      if (finding === undefined) continue
      placed.set(id, line)
      spots.push({ id, file, topic: finding.topic, line: line ?? 0 })
    }
  }

  return { lines: issuesForRequest(ledger, [...placed.keys()], placed), spots }
}

/** The issues the person dismissed, which a review never raises again. */
export function dismissedForRequest(ledger: Ledger, ids: readonly number[]): string[] {
  const byId = new Map(ledger.findings.map(finding => [finding.id, finding]))

  return ids.flatMap(id => {
    const finding = byId.get(id)

    return finding === undefined ? [] : [`- ${issueWhere(finding)} (${finding.topic}): ${finding.title}`]
  })
}

/** The counts by severity, in a few words: "1 critical, 2 high, 3 medium". '' when nothing is open. */
export function countsWords(counts: Record<Severity, number>, withLow = true): string {
  return SEVERITIES.filter(severity => counts[severity] > 0 && (withLow || severity !== 'low'))
    .map(severity => `${counts[severity]} ${severity}`)
    .join(', ')
}

/** Why an audit skipped a file of someone else's: vendored, generated, third-party, minified or bundled code. */
export const VENDORED_WHY = /\b(vendored|generated|third[- ]party|minified|bundled)\b/i

/**
 * Their own source files among those an audit was given: less what the audit
 * itself skipped as someone else's, a file or a folder of them. "Read 11 of 16
 * source files" counted PDF.js files its own line called vendored (the
 * fourteenth ui-truth pass, 2026-10-07).
 */
export function ownFiles(sources: readonly string[], skipped: readonly { path: string; why: string }[]): string[] {
  const theirs = skipped.filter(skip => VENDORED_WHY.test(skip.why)).map(skip => skip.path)

  return sources.filter(path => !theirs.some(other => path === other || (other.endsWith('/') && path.startsWith(other))))
}

/** What the last audit covered, in a line, or '' before any audit. `clock` says a time of day. */
export function coverageLine(coverage: Coverage, clock: (ms: number) => string): string {
  if (coverage.at <= 0) return ''
  // A commit marked `+` was read with the changes not yet committed (the first live audit read an uncommitted line).
  const isDirty = coverage.commit.endsWith('+')
  const hash = (isDirty ? coverage.commit.slice(0, -1) : coverage.commit).slice(0, 7)
  const commit = hash === '' ? '' : isDirty ? ` at ${hash} with uncommitted changes` : ` at ${hash}`
  const read =
    coverage.read.length === 0
      ? coverage.files > 0
        ? `it did not say which of the ${coverage.files} source files it read`
        : 'it did not say what it read'
      : coverage.files > 0
        ? `read ${Math.min(coverage.read.length, coverage.files)} of ${coverage.files} source files`
        : `read ${coverage.read.length} files`
  const skipped = coverage.skipped.length === 0 ? '' : `; skipped ${coverage.skipped.map(skip => (skip.why === '' ? skip.path : `${skip.path} (${skip.why})`)).join(', ')}`

  return `Audited ${clock(coverage.at)}${commit}: ${read}${skipped}.`
}

/**
 * What the conversation is told of the ledger, so that "is my code healthy?"
 * is answered from what was found and what was read, never from silence.
 */
export function issuesBrief(ledger: Ledger, views: LedgerViews, clock: (ms: number) => string, max = 5): string {
  const coverage = coverageLine(ledger.coverage, clock)
  const byId = new Map(ledger.findings.map(finding => [finding.id, finding]))
  const worst = [...views.ranked, ...views.folded].slice(0, max).flatMap(id => {
    const finding = byId.get(id)

    return finding === undefined ? [] : [`- [${finding.severity}] ${issueWhere(finding)}: ${finding.title}${finding.condition === '' ? '' : ` (${finding.condition})`}`]
  })
  const open = countsWords(views.counts)
  if (coverage === '' && open === '') return 'Issues on record: none, and the codebase has not been audited, so that says nothing about its health.'

  return [
    `Issues on record: ${open === '' ? 'none open' : `${open} open`}.${coverage === '' ? ' The codebase has not been audited: only reviewed changes were looked at.' : ` ${coverage}`}`,
    ...worst,
  ].join('\n')
}

/** What the Deep review tab says before any audit was started. */
export const NOT_AUDITED = 'Not audited for issues yet: press a to audit the codebase.'

/** What it says when an audit was started and never finished. */
export const AUDIT_UNFINISHED = 'The audit did not finish: press a to audit again.'

/** The character's line when an audit is in. No model call. */
export function auditLine(counts: Record<Severity, number>): string {
  const open = countsWords(counts)

  return open === '' ? "Audit's in. Nothing open in what it read." : `Audit's in: ${open}. They're on the Deep review tab.`
}

/** What `e` on an issue asks the conversation, in their name. */
export function issueQuestion(finding: Pick<Finding, 'file' | 'line' | 'title' | 'text'>): string {
  return `Explain the issue the deep review found at ${issueWhere(finding)}: ${finding.title}. ${finding.text} What is the idea behind it, and why does it matter here? Don't write the fix.`
}

/**
 * The play-by-play's line about the ledger, under its empty tab, so that its
 * silence never reads as an all-clear: the serious issues open, the lesser
 * ones, what the audit read when nothing is open, or that nothing was audited.
 */
export function ledgerLine(views: LedgerViews, isAudited: boolean, coverage: Coverage): string {
  // In the Deep review tab's own words ("Open: 5 low"), and never a `2: Deep review` that looks like a key and is not one.
  const open = countsWords(views.counts)
  if (open !== '') return `Open in the deep review: ${open}.`
  if (coverage.at > 0) return coverage.read.length === 0 ? 'The audit found nothing open.' : `The audit found nothing open in the ${coverage.read.length} files it read.`
  if (isAudited) return 'The audit has not finished.'

  return 'Not audited for issues yet.'
}

import type { DecisionPoint, ReviewText } from '../types'
import { withoutFindingsFence } from './findings'

/**
 * What is known about a project as a whole: the part of the per-project
 * cache that the deep review writes and that Explain and the play-by-play
 * read. It lives in `projects/<id>/project.json` and `reviews.json`.
 *
 * A deep review ends with a block the person never sees:
 *
 *   ```backseat-notes
 *   {"overview": "...", "files": [{"file": "...", "role": "..."}],
 *    "insights": [{"file": "...", "symbol": "...", "text": "..."}]}
 *   ```
 */

/** Something a deep review said about a file, or about one symbol in it when `symbol` is not ''. */
export type Insight = { file: string; symbol: string; text: string }

/** What a deep review leaves for the tutor's memory. */
export type ReviewNotes = {
  overview: string
  files: { file: string; role: string }[]
  insights: Insight[]
  /** The meaningful decision points the review found, for the pane to put first. */
  decisions: DecisionPoint[]
}

/**
 * An insight as kept: with the commit it was written at, and a fingerprint
 * of the code it is about. It is shown beside the code only while that
 * fingerprint still matches, like everything else Explain shows.
 */
export type KeptInsight = Insight & {
  /** The commit it was written at, short. '' for uncommitted work. */
  commit: string
  at: number
  /** The fingerprint of the symbol's lines, or of the whole file when the symbol could not be found. */
  print: string
  /** Which of the two `print` is. */
  of: 'symbol' | 'file'
}

export type ProjectKnowledge = {
  v: 1
  /** The repository's root when this was written. */
  root: string
  /** Two to four sentences: what the project is and how it is put together. */
  overview: string
  /** The commit the overview was written at, short, and when. '' until there is one. */
  overviewCommit: string
  overviewAt: number
  /** What each file is for, by path. */
  roles: Record<string, string>
  insights: KeptInsight[]
  /** True once the deep review model has surveyed the project. */
  isSurveyed: boolean
  /**
   * True once an audit of the project was started: one per project, after its
   * first look around, and again only when the person asks (`a`). Marked when
   * it starts, so that one that fails is not started again at every switch-on.
   */
  isAudited: boolean
  /**
   * The first look around, as the Deep review tab showed it, so that a new project's tab has it back after a
   * restart (owner, 2026-10-06). Kept here and not with the reviews: it reviewed nobody's work, and the next
   * reviewer is not told of it as an earlier review. Null until the survey.
   */
  survey: ReviewRecord | null
}

/** One deep review, as remembered: enough for the next one to follow up on. */
export type ReviewRecord = {
  commit: string
  subject: string
  at: number
  text: string
  /** What the Deep review tab showed beside the text. Absent in records written before they were kept. */
  decisions?: DecisionPoint[]
  insights?: string[]
}

export const MAX_ROLES = 300
export const MAX_INSIGHTS = 200
export const MAX_REVIEWS = 12
const MAX_TEXT = 600
const MAX_OVERVIEW = 900

export function emptyProject(root: string): ProjectKnowledge {
  return { v: 1, root, overview: '', overviewCommit: '', overviewAt: 0, roles: {}, insights: [], isSurveyed: false, isAudited: false, survey: null }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown, limit = MAX_TEXT): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0
}

/** A path as a model wrote it, when it could be a file of the project. */
function cleanPath(value: unknown): string {
  const path = text(value, 300).replace(/^\.\//, '')
  const isInside = path !== '' && !path.startsWith('/') && !path.split('/').some(part => part === '' || part === '.' || part === '..')

  return isInside ? path : ''
}

const FENCE = /```backseat-notes[ \t]*\n([\s\S]*?)```/g

/**
 * A deep review as the person reads it, and the notes that followed it. The
 * block is taken out of the text whether or not it parses, so that the pane
 * never shows it.
 */
export function splitReview(answer: string): { text: string; notes: ReviewNotes | null } {
  let notes: ReviewNotes | null = null
  for (const match of answer.matchAll(FENCE)) {
    notes = parseNotes(match[1] ?? '') ?? notes
  }

  // The fence of issues goes too: its issues are the ledger's (`findings.ts`), never the review's text.
  return { text: withoutFindingsFence(answer.replace(FENCE, '')).trim(), notes }
}

function parseNotes(block: string): ReviewNotes | null {
  let data: unknown
  try {
    data = JSON.parse(block)
  } catch {
    return null
  }
  const stored = asRecord(data)
  if (stored === null) return null

  const files: ReviewNotes['files'] = []
  for (const item of Array.isArray(stored.files) ? stored.files : []) {
    const file = asRecord(item)
    const path = cleanPath(file?.file)
    if (path !== '' && text(file?.role) !== '') files.push({ file: path, role: text(file?.role) })
  }
  const insights: Insight[] = []
  for (const item of Array.isArray(stored.insights) ? stored.insights : []) {
    const insight = asRecord(item)
    const path = cleanPath(insight?.file)
    if (path !== '' && text(insight?.text) !== '') {
      insights.push({ file: path, symbol: text(insight?.symbol, 120), text: text(insight?.text) })
    }
  }

  return {
    overview: text(stored.overview, MAX_OVERVIEW),
    files: files.slice(0, 40),
    insights: insights.slice(0, 20),
    decisions: parseDecisions(stored.decisions),
  }
}

function parseDecisions(value: unknown): DecisionPoint[] {
  const decisions: DecisionPoint[] = []
  for (const item of Array.isArray(value) ? value : []) {
    const decision = asRecord(item)
    const path = cleanPath(decision?.file)
    if (decision === null || path === '' || text(decision.choice) === '') continue
    decisions.push({ file: path, line: Math.max(0, whole(decision.line)), choice: text(decision.choice, 200), tradeoff: text(decision.tradeoff, 400) })
  }

  return decisions.slice(0, MAX_DECISIONS)
}

/** A review names at most this many decision points: more than that and none of them stands out. */
export const MAX_DECISIONS = 3

/** The project file as read from disk. Whatever does not fit is dropped. */
export function parseProject(value: unknown, root: string): ProjectKnowledge {
  const stored = asRecord(value)
  if (stored === null || stored.v !== 1) return emptyProject(root)

  const roles: Record<string, string> = {}
  for (const [path, role] of Object.entries(asRecord(stored.roles) ?? {})) {
    if (cleanPath(path) !== '' && text(role) !== '') roles[path] = text(role)
  }
  const insights: KeptInsight[] = []
  for (const item of Array.isArray(stored.insights) ? stored.insights : []) {
    const insight = asRecord(item)
    const path = cleanPath(insight?.file)
    if (insight === null || path === '' || text(insight.text) === '' || text(insight.print) === '') continue
    insights.push({
      file: path,
      symbol: text(insight.symbol, 120),
      text: text(insight.text),
      commit: text(insight.commit, 12),
      at: whole(insight.at),
      print: text(insight.print, 40),
      of: insight.of === 'symbol' ? 'symbol' : 'file',
    })
  }

  return {
    v: 1,
    root,
    overview: text(stored.overview, MAX_OVERVIEW),
    overviewCommit: text(stored.overviewCommit, 12),
    overviewAt: whole(stored.overviewAt),
    roles,
    insights: insights.slice(0, MAX_INSIGHTS),
    isSurveyed: stored.isSurveyed === true,
    isAudited: stored.isAudited === true,
    survey: parseReviews([stored.survey])[0] ?? null,
  }
}

/** The project with its audit started. The same object when it was already. */
export function withAudited(project: ProjectKnowledge): ProjectKnowledge {
  return project.isAudited ? project : { ...project, isAudited: true }
}

/**
 * The project after a deep review's notes. A new insight on a file replaces
 * the older ones on that file and symbol, and what the review said about a
 * file's role replaces what was said before. `printOf` answers the
 * fingerprint the code an insight is about has right now.
 */
export function withReviewNotes(
  project: ProjectKnowledge,
  notes: ReviewNotes,
  commit: string,
  at: number,
  printOf: (insight: Insight) => { print: string; of: 'symbol' | 'file'; symbol?: string } | null,
): ProjectKnowledge {
  const roles = { ...project.roles }
  for (const { file, role } of notes.files) roles[file] = role
  const keptRoles = Object.fromEntries(Object.entries(roles).slice(-MAX_ROLES))

  const fresh: KeptInsight[] = []
  for (const insight of notes.insights) {
    const print = printOf(insight)
    // No fingerprint means no way to tell later whether it still applies, so it is not kept.
    if (print !== null) fresh.push({ ...insight, commit, at, ...print })
  }
  const isReplaced = (old: KeptInsight): boolean => fresh.some(insight => insight.file === old.file && insight.symbol === old.symbol)

  return {
    ...project,
    overview: notes.overview === '' ? project.overview : notes.overview,
    overviewCommit: notes.overview === '' ? project.overviewCommit : commit,
    overviewAt: notes.overview === '' ? project.overviewAt : at,
    roles: keptRoles,
    insights: [...fresh, ...project.insights.filter(old => !isReplaced(old))].slice(0, MAX_INSIGHTS),
  }
}

/**
 * What a deep review said about a symbol, or about its file, that still
 * applies: the code it was written about has to be exactly what it was.
 */
export function insightsFor(
  project: ProjectKnowledge,
  file: string,
  symbol: string,
  symbolPrint: string,
  filePrint: string,
  isMentioned: (name: string) => boolean = () => false,
): KeptInsight[] {
  return project.insights.filter(insight => {
    if (insight.file !== file) return false
    // One kept for the whole file under a name the outline does not know (from before 2026-10-06, or a file unmapped
    // at its review) shows where that name is mentioned: beside the symbol in focus, or at the file level.
    if (insight.of === 'file') return insight.print === filePrint && (insight.symbol === '' || insight.symbol === symbol || isMentioned(insight.symbol))

    return insight.symbol === symbol && insight.print === symbolPrint
  })
}

/**
 * An insight as one line of text, with where it comes from: a deep review of
 * its commit, or the first look around the project, which keeps its insights
 * under HEAD as it stood (`surveyAt` is that look's time; the Explain tab
 * credited them to "a deep review of 570e787" that the Deep review tab did
 * not have: the ninth ui-truth pass, 2026-10-07).
 */
export function insightLine(insight: KeptInsight, surveyAt?: number): string {
  if (insight.commit === '') return insight.text
  if (surveyAt !== undefined && insight.at === surveyAt) return `${insight.text} (from the first look around, at ${insight.commit})`

  return `${insight.text} (deep review of ${insight.commit})`
}

/** The overview with the commit it was written at, or '' when there is none. */
export function overviewLine(project: ProjectKnowledge): string {
  if (project.overview === '') return ''

  return project.overviewCommit === '' ? project.overview : `${project.overview} (as of commit ${project.overviewCommit})`
}

/**
 * What the play-by-play is told about the project before it looks at a
 * change: the overview, what each file is for, and what the deep review said
 * about the parts of these files that have not changed since. `isCurrent`
 * answers whether an insight still describes the code as it is now: one
 * about code that has changed is left out, never shown as if it still held.
 * Empty when there is nothing.
 */
export function projectBrief(
  project: ProjectKnowledge,
  files: readonly string[],
  isCurrent: (insight: KeptInsight) => boolean,
): string {
  const lines: string[] = []
  if (project.overview !== '') lines.push(`About this project: ${overviewLine(project)}`)
  const about: string[] = []
  for (const file of files) {
    const role = project.roles[file]
    if (role !== undefined) about.push(`- ${file}: ${role}`)
    for (const insight of project.insights.filter(kept => kept.file === file && isCurrent(kept)).slice(0, 4)) {
      about.push(`- ${file}${insight.symbol === '' ? '' : `, ${insight.symbol}`}: ${insightLine(insight, project.survey?.at)}`)
    }
  }
  if (about.length > 0) lines.push('What the deep review has said about these files, where that code has not changed since:', ...about)

  return lines.join('\n')
}

/** The project with its first look around on record, as the tab showed it. */
export function withSurvey(project: ProjectKnowledge, survey: ReviewRecord): ProjectKnowledge {
  return { ...project, isSurveyed: true, survey }
}

/** Every review the tab can go back to, newest first: the reviews kept, then the first look around, which came before them all. */
export function historyTexts(reviews: readonly ReviewRecord[], survey: ReviewRecord | null): ReviewText[] {
  return [...reviewTexts(reviews), ...(survey === null ? [] : reviewTexts([survey]))]
}

/** The reviews so far with one more, newest last, and only the latest few. */
export function withReview(reviews: readonly ReviewRecord[], review: ReviewRecord): ReviewRecord[] {
  return [...reviews.filter(old => old.commit === '' || old.commit !== review.commit), review].slice(-MAX_REVIEWS)
}

/** The stored reviews as the Deep review tab reads them: newest first, with when and about what. */
export function reviewTexts(reviews: readonly ReviewRecord[]): ReviewText[] {
  return [...reviews].reverse().map(review => ({
    subject: review.subject,
    text: review.text,
    decisions: review.decisions ?? [],
    insights: review.insights ?? [],
    at: review.at,
    ...(review.commit === '' ? {} : { commit: review.commit }),
  }))
}

export function parseReviews(value: unknown): ReviewRecord[] {
  const reviews: ReviewRecord[] = []
  for (const item of Array.isArray(value) ? value : []) {
    const review = asRecord(item)
    if (review !== null && text(review.text, 12_000) !== '') {
      const decisions = parseDecisions(review.decisions)
      const insights = (Array.isArray(review.insights) ? review.insights : []).map(insight => text(insight)).filter(insight => insight !== '').slice(0, 20)
      reviews.push({
        commit: text(review.commit, 12),
        subject: text(review.subject, 200),
        at: whole(review.at),
        text: text(review.text, 12_000),
        ...(decisions.length > 0 ? { decisions } : {}),
        ...(insights.length > 0 ? { insights } : {}),
      })
    }
  }

  return reviews.slice(-MAX_REVIEWS)
}

/** How much of each earlier review the next one is shown. */
const DIGEST_CHARS = 700

/**
 * What the deep reviewer is told about its own earlier reviews, newest first,
 * so that it can say whether something it raised was dealt with. Empty when
 * there are none.
 */
export function reviewDigest(reviews: readonly ReviewRecord[], limit = 3): string {
  return [...reviews]
    .reverse()
    .slice(0, limit)
    .map(review => `### ${review.subject}\n${review.text.length <= DIGEST_CHARS ? review.text : `${review.text.slice(0, DIGEST_CHARS)}…`}`)
    .join('\n\n')
}

/** A review's insights as the Deep review tab lists them. */
export function insightLines(notes: ReviewNotes | null): string[] {
  return (notes?.insights ?? []).map(insight => `${insight.file}${insight.symbol === '' ? '' : `, ${insight.symbol}`}: ${insight.text}`)
}

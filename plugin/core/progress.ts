import type { Level, LevelChange, Observation, ProgressRecord, Report } from '../types'
import { languageName } from './languages'

/**
 * The progress ledger, and the rules for moving a level. The model reads
 * the code and says what it saw; these rules decide what that adds up to,
 * so that one good afternoon or one bad commit cannot swing the level.
 */

export const LEVELS: readonly Level[] = ['beginner', 'junior', 'mid', 'senior']

/** No level until this many observations, from at least this many commits. */
export const PLACE_OBSERVATIONS = 8
export const PLACE_COMMITS = 3
/** Of the person's own added lines read, in all: eight lines of a toy script are no basis for a level (owner, 2026-10-05). */
export const PLACE_LINES = 80
/** A step up needs this much new evidence at the next level, from this many commits. */
export const UP_WEIGHT = 4
export const UP_COMMITS = 2
/** A step down needs this much evidence of missing what the level assumes, from this many commits. */
export const DOWN_WEIGHT = 2
export const DOWN_COMMITS = 2
/** A level stays provisional until it rests on this much work. */
export const CONFIRM_OBSERVATIONS = 12
export const CONFIRM_COMMITS = 4

const MAX_OBSERVATIONS = 300
const MAX_PER_COMMIT = 6
const MAX_ASSESSED = 600
const MAX_HISTORY = 50

export function emptyRecord(language: string): ProgressRecord {
  return { v: 1, language, level: null, isProvisional: true, observations: [], history: [], report: null, assessed: [], linesRead: 0 }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown, limit = 600): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0
}

function levelOf(value: unknown): Level | null {
  return LEVELS.find(level => level === value) ?? null
}

function rank(level: Level): number {
  return LEVELS.indexOf(level)
}

function slug(value: unknown): string {
  return text(value, 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A record as read from disk. It may be hand-edited or torn, so whatever does not fit is dropped. */
export function parseRecord(value: unknown, language: string): ProgressRecord {
  const stored = asRecord(value)
  if (stored === null || stored.v !== 1 || stored.language !== language) return emptyRecord(language)

  const observations: Observation[] = []
  for (const item of Array.isArray(stored.observations) ? stored.observations : []) {
    const seen = asRecord(item)
    const level = levelOf(seen?.level)
    if (seen === null || level === null || slug(seen.skill) === '' || (seen.verdict !== 'shown' && seen.verdict !== 'missed')) continue
    const weight = typeof seen.weight === 'number' && seen.weight > 0 && seen.weight <= 1 ? seen.weight : 0.5
    observations.push({
      commit: text(seen.commit, 64),
      project: text(seen.project, 80),
      at: whole(seen.at),
      skill: slug(seen.skill),
      verdict: seen.verdict,
      level,
      weight,
      note: text(seen.note),
    })
  }
  const history: LevelChange[] = []
  for (const item of Array.isArray(stored.history) ? stored.history : []) {
    const change = asRecord(item)
    const to = levelOf(change?.to)
    if (change !== null && to !== null) {
      history.push({ at: whole(change.at), from: levelOf(change.from), to, reason: text(change.reason), observationCount: whole(change.observationCount) })
    }
  }
  const report = asRecord(stored.report)

  return {
    v: 1,
    language,
    level: levelOf(stored.level),
    isProvisional: stored.isProvisional !== false,
    observations: observations.slice(-MAX_OBSERVATIONS),
    history: history.slice(-MAX_HISTORY),
    report:
      report === null
        ? null
        : {
            why: text(report.why, 900),
            next: text(report.next, 900),
            working: (Array.isArray(report.working) ? report.working : []).map(item => text(item, 200)).filter(item => item !== '').slice(0, 4),
            encouragement: text(report.encouragement, 400),
            at: whole(report.at),
          },
    assessed: (Array.isArray(stored.assessed) ? stored.assessed : []).filter((hash): hash is string => typeof hash === 'string').slice(-MAX_ASSESSED),
    linesRead: whole(stored.linesRead),
  }
}

/** What one assessment says, once read from the model's reply. */
export type Assessment = {
  observations: { commit: string; skill: string; verdict: 'shown' | 'missed'; level: Level; note: string }[]
  /** The level the model would give, all evidence considered. Code decides whether it moves. */
  level: Level | null
  why: string
  next: string
  working: string[]
  encouragement: string
}

export function parseAssessment(reply: string): Assessment | null {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  let data: unknown
  try {
    data = JSON.parse(reply.slice(start, end + 1))
  } catch {
    return null
  }
  const stored = asRecord(data)
  if (stored === null) return null

  const observations: Assessment['observations'] = []
  for (const item of Array.isArray(stored.observations) ? stored.observations : []) {
    const seen = asRecord(item)
    const level = levelOf(seen?.level)
    if (seen === null || level === null || slug(seen.skill) === '' || text(seen.note) === '') continue
    if (seen.verdict !== 'shown' && seen.verdict !== 'missed') continue
    observations.push({ commit: text(seen.commit, 40), skill: slug(seen.skill), verdict: seen.verdict, level, note: text(seen.note, 300) })
  }

  return {
    observations,
    level: levelOf(stored.level),
    why: text(stored.why, 900),
    next: text(stored.next, 900),
    working: (Array.isArray(stored.working) ? stored.working : []).map(item => text(item, 200)).filter(item => item !== '').slice(0, 4),
    encouragement: text(stored.encouragement, 400),
  }
}

function commitsIn(observations: readonly Observation[]): number {
  return new Set(observations.map(seen => `${seen.project}\n${seen.commit}`)).size
}

function weightOf(observations: readonly Observation[]): number {
  return observations.reduce((sum, seen) => sum + seen.weight, 0)
}

/** The highest level with at least two observations' worth of evidence shown at or above it. */
/**
 * The highest level with two weight of evidence shown at it or above. Beginner
 * needs evidence as the others do: two weight missed at junior or below. With
 * neither, nothing has been shown either way, and there is no level (owner,
 * 2026-10-05: two toy commits called a devops engineer of years a beginner).
 */
function supportedLevel(observations: readonly Observation[]): Level | null {
  for (const level of LEVELS.slice(1).reverse()) {
    if (weightOf(observations.filter(seen => seen.verdict === 'shown' && rank(seen.level) >= rank(level))) >= 2) return level
  }

  return weightOf(observations.filter(seen => seen.verdict === 'missed' && rank(seen.level) <= rank('junior'))) >= DOWN_WEIGHT ? 'beginner' : null
}

/** Whether there is enough to place anyone: the observations, the commits they come from, and the lines read. */
export function isPlaceable(record: Pick<ProgressRecord, 'observations' | 'linesRead'>): boolean {
  return record.observations.length >= PLACE_OBSERVATIONS && commitsIn(record.observations) >= PLACE_COMMITS && record.linesRead >= PLACE_LINES
}

/** Where the level goes after new evidence, and why, under the rules above. */
export function decideLevel(
  record: ProgressRecord,
  proposed: Level | null,
): { level: Level | null; isProvisional: boolean; reason: string } {
  const all = record.observations
  const isConfirmed = all.length >= CONFIRM_OBSERVATIONS && commitsIn(all) >= CONFIRM_COMMITS
  const current = record.level

  // A provisional level that no longer rests on enough is withdrawn: a record from before the bar was raised.
  if (current !== null && record.isProvisional && !isPlaceable(record)) {
    return { level: null, isProvisional: true, reason: `Withdrawn: a level needs ${PLACE_OBSERVATIONS} observations from ${PLACE_COMMITS} commits and ${PLACE_LINES} lines of your own read.` }
  }
  if (current === null) {
    if (!isPlaceable(record)) return { level: null, isProvisional: true, reason: '' }
    const supported = supportedLevel(all)
    if (supported === null) return { level: null, isProvisional: true, reason: '' }
    const placed = proposed === null || rank(proposed) > rank(supported) ? supported : proposed

    return { level: placed, isProvisional: !isConfirmed, reason: `First placement, from ${all.length} observations over ${commitsIn(all)} commits and ${record.linesRead} lines.` }
  }

  const since = all.slice(record.history[record.history.length - 1]?.observationCount ?? 0)
  const missed = since.filter(seen => seen.verdict === 'missed' && rank(seen.level) <= rank(current))
  const shownHere = since.filter(seen => seen.verdict === 'shown' && rank(seen.level) >= rank(current))
  const isDownSupported = weightOf(missed) >= DOWN_WEIGHT && commitsIn(missed) >= DOWN_COMMITS
  const lower = LEVELS[rank(current) - 1]
  if (lower !== undefined && isDownSupported && ((proposed !== null && rank(proposed) < rank(current)) || weightOf(missed) > weightOf(shownHere))) {
    return {
      level: lower,
      isProvisional: !isConfirmed,
      reason: `Down a step: ${missed.length} recent observations show ${current} work not yet solid (${[...new Set(missed.map(seen => seen.skill))].join(', ')}).`,
    }
  }

  const higher = LEVELS[rank(current) + 1]
  const ahead = since.filter(seen => seen.verdict === 'shown' && higher !== undefined && rank(seen.level) >= rank(higher))
  const isUpSupported = weightOf(ahead) >= UP_WEIGHT && commitsIn(ahead) >= UP_COMMITS && weightOf(missed) < DOWN_WEIGHT
  if (higher !== undefined && isUpSupported && proposed !== null && rank(proposed) > rank(current)) {
    return {
      level: higher,
      isProvisional: !isConfirmed,
      reason: `Up a step: ${higher} work shown ${ahead.length} times over ${commitsIn(ahead)} commits (${[...new Set(ahead.map(seen => seen.skill))].join(', ')}).`,
    }
  }

  return { level: current, isProvisional: record.isProvisional && !isConfirmed, reason: '' }
}

/** A commit an assessment covered: its full hash and short one, and how much what is seen in it counts. */
export type AssessedCommit = { hash: string; short: string; weight: number; lines: number }

/**
 * The record after an assessment of one or more commits in a project. An
 * observation is kept against the commit it names, or the first one. A
 * commit already assessed adds nothing, so no work counts twice, in any project.
 * `commits` come oldest first, and observations are kept in that order
 * whatever order the model listed them in: what came later decides whether
 * a skill is slipping.
 */
export function withAssessment(
  record: ProgressRecord,
  assessment: Assessment,
  commits: readonly AssessedCommit[],
  project: string,
  at: number,
): { record: ProgressRecord; change: LevelChange | null } {
  const fresh = commits.filter(commit => !record.assessed.includes(commit.hash))
  const first = fresh[0]
  if (first === undefined) return { record, change: null }

  const added: Observation[] = []
  for (const seen of assessment.observations) {
    const commit = fresh.find(candidate => seen.commit !== '' && (candidate.short.startsWith(seen.commit) || seen.commit.startsWith(candidate.short))) ?? first
    if (added.filter(other => other.commit === commit.hash).length >= MAX_PER_COMMIT) continue
    added.push({ commit: commit.hash, project, at, skill: seen.skill, verdict: seen.verdict, level: seen.level, weight: commit.weight, note: seen.note })
  }

  const order = (seen: Observation): number => fresh.findIndex(commit => commit.hash === seen.commit)
  const chronological = added.map((seen, index) => ({ seen, index })).sort((a, b) => order(a.seen) - order(b.seen) || a.index - b.index)
  const observations = [...record.observations, ...chronological.map(({ seen }) => seen)]
  // The oldest go past the limit. A level change counts the observations before it, so its count goes down with them.
  const dropped = Math.max(0, observations.length - MAX_OBSERVATIONS)
  const grown: ProgressRecord = {
    ...record,
    observations: observations.slice(dropped),
    history: record.history.map(change => ({ ...change, observationCount: Math.max(0, change.observationCount - dropped) })),
    assessed: [...record.assessed, ...fresh.map(commit => commit.hash)].slice(-MAX_ASSESSED),
    linesRead: record.linesRead + fresh.reduce((sum, commit) => sum + Math.max(0, commit.lines), 0),
  }
  const decided = decideLevel(grown, assessment.level)
  const change: LevelChange | null =
    decided.level !== null && decided.level !== record.level
      ? { at, from: record.level, to: decided.level, reason: decided.reason, observationCount: grown.observations.length }
      : null
  const report: Report = {
    why: assessment.why,
    next: assessment.next,
    working: assessment.working,
    encouragement: assessment.encouragement,
    at,
  }

  return {
    record: {
      ...grown,
      level: decided.level,
      isProvisional: decided.isProvisional,
      history: change === null ? grown.history : [...grown.history, change].slice(-MAX_HISTORY),
      // An assessment that had nothing to say leaves the last report standing.
      report: assessment.why === '' ? record.report : report,
    },
    change,
  }
}

/**
 * Each skill as it stands, judged by the latest commit that touched it:
 * shown there (even if partly missed too), slipping (shown in an earlier
 * commit, only missed in the latest), or still being worked on (missed,
 * and never shown before). Showing and missing a skill in one commit is a
 * mixed result, not a regression.
 */
export function skillStates(record: ProgressRecord): { shown: string[]; slipping: string[]; working: string[] } {
  const latest = new Map<string, { commit: string; verdicts: Set<'shown' | 'missed'>; isShownBefore: boolean }>()
  for (const seen of record.observations) {
    const known = latest.get(seen.skill)
    if (known !== undefined && known.commit === seen.commit) {
      known.verdicts.add(seen.verdict)
      continue
    }
    const isShownBefore = known !== undefined && (known.isShownBefore || known.verdicts.has('shown'))
    latest.set(seen.skill, { commit: seen.commit, verdicts: new Set([seen.verdict]), isShownBefore })
  }
  const states = { shown: [] as string[], slipping: [] as string[], working: [] as string[] }
  for (const [skill, { verdicts, isShownBefore }] of latest) {
    if (verdicts.has('shown')) states.shown.push(skill)
    else if (isShownBefore) states.slipping.push(skill)
    else states.working.push(skill)
  }

  return states
}

/** The level as one short phrase: "junior (provisional)", or how far there is to go before there is one. */
export function levelPhrase(record: ProgressRecord): string {
  if (record.level !== null) return record.isProvisional ? `${record.level} (provisional)` : record.level
  const commits = commitsIn(record.observations)

  const counts = `${Math.min(record.observations.length, PLACE_OBSERVATIONS)} of ${PLACE_OBSERVATIONS} observations, from ${Math.min(commits, PLACE_COMMITS)} of ${PLACE_COMMITS} commits, ${Math.min(record.linesRead, PLACE_LINES)} of ${PLACE_LINES} lines read`

  return isPlaceable(record) ? `no level yet: nothing shows one either way (${counts})` : `no level yet: ${counts}`
}

/** The last few things seen, newest first, as the "lately" lines. */
export function lately(record: ProgressRecord, count = 4): string[] {
  return [...record.observations]
    .reverse()
    .slice(0, count)
    .map(seen => `${seen.verdict === 'shown' ? 'Showed' : 'Missed'} ${seen.skill.replaceAll('-', ' ')} in ${seen.project} (${seen.commit.slice(0, 7)}): ${seen.note}`)
}

/** One language's progress as plain text, for the progress tool and for the tutor to talk about. */
export function recordText(record: ProgressRecord): string {
  const lines = [`${languageName(record.language)}: ${levelPhrase(record)}`]
  const { report } = record
  if (report !== null) {
    if (report.why !== '') lines.push(`Why: ${report.why}`)
    if (report.next !== '') lines.push(`For the next level: ${report.next}`)
    if (report.working.length > 0) lines.push(`Working on: ${report.working.join('; ')}`)
  }
  const states = skillStates(record)
  if (states.shown.length > 0) lines.push(`Shown: ${states.shown.join(', ')}`)
  if (states.slipping.length > 0) lines.push(`Slipping: ${states.slipping.join(', ')}`)
  const recent = lately(record)
  if (recent.length > 0) lines.push('Lately:', ...recent.map(line => `- ${line}`))
  const last = record.history[record.history.length - 1]
  if (last !== undefined) lines.push(`Last change: ${last.reason}`)

  return lines.join('\n')
}

/**
 * What every prompt is told about the person's observed level, for the
 * languages in play that have one. Empty when none has.
 */
export function progressText(records: readonly ProgressRecord[]): string {
  const known = records.filter(record => record.level !== null)
  if (known.length === 0) return ''
  const lines = known.map(record => {
    const states = skillStates(record)
    const parts = [`- ${languageName(record.language)}: observed level ${levelPhrase(record)}.`]
    if (states.slipping.length > 0) parts.push(`Slipping: ${states.slipping.join(', ')}.`)
    if (states.working.length > 0) parts.push(`Working on: ${states.working.slice(0, 5).join(', ')}.`)

    return parts.join(' ')
  })

  return [
    '## What the tutor has seen of their own work',
    "This comes from their own commits, judged on the lines they wrote. Where it differs from what they said about themselves, pitch what you say at this.",
    ...lines,
  ].join('\n')
}

/** A commit as the assessment is shown it: its short hash, its title, and the lines it added in this language. */
export type CommitForAssessment = { short: string; title: string; files: { path: string; lines: string[] }[] }

/** Roughly 15,000 tokens of added code. A commit that does not fit is cut, and the cut is said. */
const MAX_REQUEST_CODE = 60_000

/** The request for one assessment: what is on record, then the person's own lines, then the deep review when there is one. */
export function assessmentRequest(input: {
  language: string
  project: string
  record: ProgressRecord
  /** What they said about themselves, which is not evidence. '' when nothing. */
  said: string
  commits: readonly CommitForAssessment[]
  /** The deep review of this commit, for context. '' when there is none. */
  review: string
}): string {
  const states = skillStates(input.record)
  const onRecord = [
    `Level on record: ${levelPhrase(input.record)}.`,
    ...(states.shown.length > 0 ? [`Skills shown: ${states.shown.join(', ')}.`] : []),
    ...(states.slipping.length > 0 ? [`Skills slipping: ${states.slipping.join(', ')}.`] : []),
    ...(states.working.length > 0 ? [`Skills missed so far: ${states.working.join(', ')}.`] : []),
    ...lately(input.record, 6).map(line => `- ${line}`),
  ]

  let room = MAX_REQUEST_CODE
  const code: string[] = []
  for (const commit of input.commits) {
    code.push(`### Commit ${commit.short}: ${commit.title}`)
    for (const file of commit.files) {
      const body = file.lines.map(line => `+${line}`).join('\n')
      if (room <= 0) {
        code.push(`(${file.path}: left out, the request is full)`)
        continue
      }
      code.push(`--- ${file.path}`, body.length <= room ? body : `${body.slice(0, room)}\n(cut here)`)
      room -= body.length
    }
  }

  return [
    `Language: ${languageName(input.language)}. Project: ${input.project}.`,
    '',
    'What is on record:',
    ...onRecord,
    ...(input.said === '' ? [] : ['', `What they said about themselves. It is not evidence, and it does not move the level: ${input.said}`]),
    '',
    `The lines they added, which are all you judge${input.commits.length > 1 ? `, from ${input.commits.length} of their recent commits` : ''}:`,
    ...code,
    ...(input.review === '' ? [] : ['', 'The deep review of this commit, for context. Judge the lines yourself:', input.review]),
  ].join('\n')
}

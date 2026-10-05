import type { Hush, Profile, Profiles, TopicStats } from '../types'
import { languageName } from './languages'

/** The subject for what is not tied to one language. */
export const GENERAL = 'general'

/**
 * A profile's key in the plugin's store, where profiles lived before they
 * moved into files. Only the move reads it now.
 */
export function subjectKey(subject: string): string {
  return `subject/${subject}`
}

/** The subject a store key holds a profile for, or null when the key is something else. */
export function storedSubject(key: string): string | null {
  return key.startsWith('subject/') && key.length > 'subject/'.length ? key.slice('subject/'.length) : null
}

export function emptyProfile(): Profile {
  return { answers: {}, isAsked: false, hushed: [], topics: {}, looks: 0 }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function count(value: unknown): number {
  return typeof value === 'number' && value > 0 ? Math.floor(value) : 0
}

/**
 * A profile as read from the store. The store is a JSON file a person can
 * edit and an older version of the plugin may have written, so nothing in it
 * is trusted: whatever does not fit is dropped.
 */
export function parseProfile(value: unknown): Profile {
  const stored = asRecord(value)
  if (stored === null) return emptyProfile()

  const answers: Record<string, string> = {}
  for (const [id, answer] of Object.entries(asRecord(stored.answers) ?? {})) {
    if (typeof answer === 'string' && answer !== '') answers[id] = answer
  }

  const hushed: Hush[] = []
  for (const item of Array.isArray(stored.hushed) ? stored.hushed : []) {
    const hush = asRecord(item)
    if (hush !== null && typeof hush.topic === 'string' && hush.topic !== '') {
      hushed.push({ topic: hush.topic, text: typeof hush.text === 'string' ? hush.text : hush.topic })
    }
  }

  const topics: Record<string, TopicStats> = {}
  for (const [topic, stats] of Object.entries(asRecord(stored.topics) ?? {})) {
    const record = asRecord(stats)
    if (record !== null) topics[topic] = { flagged: count(record.flagged), explained: count(record.explained), lastLook: count(record.lastLook) }
  }
  const looks = count(stored.looks)

  // A topic raised before looks were counted is taken as raised at the latest look: nothing is called improved on no evidence.
  for (const stats of Object.values(topics)) if (stats.lastLook === 0 && stats.flagged > 0) stats.lastLook = looks

  return { answers, isAsked: stored.isAsked === true, hushed, topics, looks }
}

/** The first-run questions were answered, or skipped when `answers` is empty. */
export function withAnswers(profile: Profile, answers: Record<string, string>): Profile {
  return { ...profile, answers: { ...profile.answers, ...answers }, isAsked: true }
}

/**
 * Something the person said about themselves in conversation. Unlike
 * `withAnswers`, it does not count as having been asked the questions.
 */
export function withAnswer(profile: Profile, id: string, answer: string): Profile {
  return { ...profile, answers: { ...profile.answers, [id]: answer } }
}

export function withHush(profile: Profile, hush: Hush): Profile {
  return { ...profile, hushed: [...profile.hushed.filter(other => other.topic !== hush.topic), hush] }
}

export function withoutHush(profile: Profile, topic: string): Profile {
  return { ...profile, hushed: profile.hushed.filter(hush => hush.topic !== topic) }
}

/** The lesson memory holds this many topics. Past that, the ones that came up least are forgotten. */
const MAX_TOPICS = 150

function bump(profile: Profile, topics: readonly string[], field: 'flagged' | 'explained'): Profile {
  if (topics.length === 0) return profile
  const next: Record<string, TopicStats> = { ...profile.topics }
  for (const topic of topics) {
    const stats = next[topic] ?? { flagged: 0, explained: 0, lastLook: profile.looks }
    next[topic] = { ...stats, [field]: stats[field] + 1, ...(field === 'flagged' ? { lastLook: profile.looks } : {}) }
  }
  const kept = Object.entries(next)
    // On a tie, what just came up stays: otherwise a full memory would forget every new topic at once.
    .sort((a, b) => b[1].flagged + b[1].explained - (a[1].flagged + a[1].explained) || Number(topics.includes(b[0])) - Number(topics.includes(a[0])))
    .slice(0, MAX_TOPICS)

  return { ...profile, topics: Object.fromEntries(kept) }
}

/** A look of the play-by-play saw their code in this subject. Counted, so that a topic that stopped coming back can be told from one that was never looked for. */
export function withLooked(profile: Profile): Profile {
  return { ...profile, looks: profile.looks + 1 }
}

/** The play-by-play raised these ideas. */
export function withFlagged(profile: Profile, topics: readonly string[]): Profile {
  return bump(profile, topics, 'flagged')
}

/** The person asked for this idea to be explained. */
export function withExplained(profile: Profile, topic: string): Profile {
  return bump(profile, [topic], 'explained')
}

/** An idea is a recurring theme once it has been raised this many times. */
const RECURRING = 3

/** The ideas that keep coming back, most often first. */
export function recurring(profile: Profile): { topic: string; times: number }[] {
  return Object.entries(profile.topics)
    .filter(([, stats]) => stats.flagged >= RECURRING)
    .sort((a, b) => b[1].flagged - a[1].flagged || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([topic, stats]) => ({ topic, times: stats.flagged }))
}

/** The ideas already explained to them, most often first. */
export function explained(profile: Profile): string[] {
  return Object.entries(profile.topics)
    .filter(([, stats]) => stats.explained > 0)
    .sort((a, b) => b[1].explained - a[1].explained || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([topic]) => topic)
}

/** Whether a note on `topic` in `language` is one the person asked not to see. */
export function isHushed(profiles: Profiles, language: string | null, topic: string): boolean {
  const subjects = language === null ? [GENERAL] : [GENERAL, language]

  return subjects.some(subject => profiles.subjects[subject]?.hushed.some(hush => hush.topic === topic) === true)
}

/** The labels the first-run questions are stored under, as the tutor and the pane read them. */
export const ANSWER_LABELS: Record<string, string> = {
  knows: 'Knows best',
  level: 'Has written',
  goals: 'Wants to',
  focus: 'Watch most closely',
}

/** The language they know best is not about any one language. Every other answer is. */
const GENERAL_ANSWERS: readonly string[] = ['knows']

/**
 * Where an answer given in conversation is kept: the subject, or null when
 * `id` is not one of the questions or a language is needed and none was given.
 */
export function answerSubject(id: string, language: string): string | null {
  if (!Object.keys(ANSWER_LABELS).includes(id)) return null
  if (GENERAL_ANSWERS.includes(id)) return GENERAL

  return language === GENERAL || language === '' ? null : language
}

/** One subject's profile as lines of text, or none when there is nothing on record. */
export function profileLines(profile: Profile): string[] {
  const lines: string[] = []
  for (const [id, answer] of Object.entries(profile.answers)) {
    lines.push(`${ANSWER_LABELS[id] ?? id}: ${answer}`)
  }
  if (profile.hushed.length > 0) {
    lines.push(`Do not bring up: ${profile.hushed.map(hush => `${hush.text} (${hush.topic})`).join('; ')}`)
  }
  const done = explained(profile)
  if (done.length > 0) lines.push(`Already explained to them: ${done.join(', ')}`)
  const themes = recurring(profile)
  if (themes.length > 0) {
    lines.push(`Keeps coming back: ${themes.map(theme => `${theme.topic} (${theme.times} times)`).join(', ')}`)
  }

  return lines
}

/**
 * What the tutor and both reviewers are told about the person: the general
 * profile and the profile of each language in play. Empty when nothing is on
 * record, so that a first session adds nothing to any prompt.
 */
export function personText(profiles: Profiles): string {
  const sections: string[] = []
  for (const subject of [GENERAL, ...profiles.languages]) {
    const profile = profiles.subjects[subject]
    const lines = profile === undefined ? [] : profileLines(profile)
    if (lines.length > 0) sections.push([`${languageName(subject)}:`, ...lines.map(line => `- ${line}`)].join('\n'))
  }
  if (sections.length === 0) return ''

  return [
    '## What is on record about this person',
    'Pitch what you say at this level. Honor "Do not bring up" without exception. For an idea already explained, refer back to it instead of explaining it again.',
    ...sections,
  ].join('\n\n')
}

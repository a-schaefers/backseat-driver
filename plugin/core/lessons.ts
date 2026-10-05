import type { LessonStepView, LessonView, Level } from '../types'
import { languageName } from './languages'

/**
 * Lessons: learning paths, one markdown file each, in the plugin's `lessons/`
 * folder. A file merged there is a lesson every install offers: nothing lists
 * them, the folder is read at switch-on. This file reads a path and keeps the
 * record of where someone is in it. Doing a step is the person's work, in
 * their own code; the tutor teaches it under the contract and never writes it.
 *
 * A path file:
 *
 *     ---
 *     title: Errors in Python
 *     language: python
 *     level: junior
 *     skills: error-handling, exceptions
 *     summary: One line on what it covers.
 *     ---
 *     What the path is about, read before the first step.
 *
 *     ## Catch only what you can handle
 *     The step: what to learn, then what to try in their own code.
 *
 *     ## The next step
 *     …
 */

/** The folder of the plugin the paths live in. */
export const LESSONS_FOLDER = 'lessons'

const LEVELS: readonly Level[] = ['beginner', 'junior', 'mid', 'senior']

export type LessonStep = { title: string; body: string }

export type LessonPath = {
  /** The file's name without `.md`. */
  id: string
  title: string
  /** A language id, or `general` for a path about no one language. */
  language: string
  level: Level
  skills: string[]
  summary: string
  /** What comes before the first step. */
  intro: string
  steps: LessonStep[]
}

/** The most steps a path may have, and the longest a step may be: a lesson is short. */
const MAX_STEPS = 20
const MAX_STEP_CHARS = 6000

function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A path read from its file, or why the file is not one. */
export function parsePath(fileName: string, text: string): { path: LessonPath } | { problem: string } {
  const id = slug(fileName.replace(/\.md$/i, ''))
  if (id === '') return { problem: `${fileName}: the file has no usable name` }
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text.replace(/^﻿/, ''))
  if (match === null) return { problem: `${fileName}: no front matter (title, language, level) between --- lines` }
  const fields: Record<string, string> = {}
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at > 0) fields[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim()
  }
  const title = fields.title ?? ''
  const language = slug(fields.language ?? '')
  const level = LEVELS.find(candidate => candidate === (fields.level ?? '').toLowerCase())
  if (title === '') return { problem: `${fileName}: no title` }
  if (language === '') return { problem: `${fileName}: no language (use general for a path about no one language)` }
  if (level === undefined) return { problem: `${fileName}: level must be beginner, junior, mid or senior` }

  const body = match[2] ?? ''
  const parts = body.split(/^## +/m)
  const intro = (parts[0] ?? '').trim()
  const steps = parts
    .slice(1)
    .map(part => {
      const newline = part.indexOf('\n')
      const heading = (newline === -1 ? part : part.slice(0, newline)).trim()

      return { title: heading, body: (newline === -1 ? '' : part.slice(newline + 1)).trim().slice(0, MAX_STEP_CHARS) }
    })
    .filter(step => step.title !== '')
  if (steps.length === 0) return { problem: `${fileName}: no steps (each step starts with a "## " heading)` }

  return {
    path: {
      id,
      title,
      language,
      level,
      skills: (fields.skills ?? '').split(',').map(slug).filter(skill => skill !== ''),
      summary: fields.summary ?? '',
      intro,
      steps: steps.slice(0, MAX_STEPS),
    },
  }
}

/** One step's record: when it was started and done, by whom, and how often they needed help in it. */
export type StepRecord = { startedAt: number; doneAt: number; by: 'tutor' | 'self' | ''; helped: number }

/** Where someone is in one path. Kept in the data folder, by language. */
export type LessonRecord = { v: 1; id: string; language: string; steps: Record<string, StepRecord> }

export function emptyLessonRecord(id: string, language: string): LessonRecord {
  return { v: 1, id, language, steps: {} }
}

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** A record as read from disk. Whatever does not fit is dropped. */
export function parseLessonRecord(value: unknown, id: string, language: string): LessonRecord {
  const stored = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  if (stored === null || stored.v !== 1 || stored.id !== id) return emptyLessonRecord(id, language)
  const steps: Record<string, StepRecord> = {}
  const raw = typeof stored.steps === 'object' && stored.steps !== null ? (stored.steps as Record<string, unknown>) : {}
  for (const [key, item] of Object.entries(raw)) {
    if (!/^\d+$/.test(key) || typeof item !== 'object' || item === null) continue
    const step = item as Record<string, unknown>
    const by = step.by === 'tutor' || step.by === 'self' ? step.by : ''
    steps[key] = { startedAt: whole(step.startedAt), doneAt: by === '' ? 0 : whole(step.doneAt), by, helped: whole(step.helped) }
  }

  return { v: 1, id, language, steps }
}

function stepOf(record: LessonRecord, step: number): StepRecord {
  return record.steps[String(step)] ?? { startedAt: 0, doneAt: 0, by: '', helped: 0 }
}

function withStep(record: LessonRecord, step: number, change: (known: StepRecord) => StepRecord): LessonRecord {
  return { ...record, steps: { ...record.steps, [String(step)]: change(stepOf(record, step)) } }
}

/** They started a step. Starting it again changes nothing. */
export function withStarted(record: LessonRecord, step: number, at: number): LessonRecord {
  return withStep(record, step, known => (known.startedAt > 0 ? known : { ...known, startedAt: at }))
}

/**
 * A step is done. The tutor seeing them do it counts for more than their
 * word, so a step the tutor confirmed stays confirmed, and one they marked
 * done themselves is upgraded when the tutor confirms it.
 */
export function withDone(record: LessonRecord, step: number, by: 'tutor' | 'self', at: number): LessonRecord {
  const known = stepOf(record, step)
  if (known.by === 'tutor' || known.by === by) return record

  return withStep(record, step, () => ({ ...known, startedAt: known.startedAt > 0 ? known.startedAt : at, doneAt: at, by }))
}

/** They needed the tutor to walk them through part of a step. */
export function withHelp(record: LessonRecord, step: number, at: number): LessonRecord {
  return withStep(record, step, known => ({ ...known, startedAt: known.startedAt > 0 ? known.startedAt : at, helped: known.helped + 1 }))
}

/** The first step not done, or -1 when every step is. */
export function nextStep(path: LessonPath, record: LessonRecord): number {
  return path.steps.findIndex((_, index) => stepOf(record, index).by === '')
}

/** One path as the Lessons tab shows it. */
export function lessonView(path: LessonPath, record: LessonRecord): LessonView {
  const steps: LessonStepView[] = path.steps.map((step, index) => {
    const known = stepOf(record, index)
    const state = known.by === 'tutor' ? 'checked' : known.by === 'self' ? 'done' : known.startedAt > 0 ? 'started' : ''

    return { title: step.title, state, helped: known.helped }
  })

  return {
    id: path.id,
    title: path.title,
    language: path.language,
    level: path.level,
    summary: path.summary,
    skills: path.skills,
    steps,
    next: nextStep(path, record),
  }
}

/**
 * The paths in the order the tab lists them: those of the languages in play
 * first, in the order of those languages, then `general`, then the rest; by
 * level within a language, then by title.
 */
export function lessonOrder(paths: readonly LessonView[], languages: readonly string[]): LessonView[] {
  const place = (language: string): number => {
    const index = languages.indexOf(language)
    if (index !== -1) return index

    return language === 'general' ? languages.length : languages.length + 1
  }

  return [...paths].sort(
    (a, b) =>
      place(a.language) - place(b.language) ||
      a.language.localeCompare(b.language) ||
      LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) ||
      a.title.localeCompare(b.title),
  )
}

/** How far along a path is, in a few words: "2 of 5 steps", "not started", "done". */
export function lessonProgress(view: LessonView): string {
  const done = view.steps.filter(step => step.state === 'checked' || step.state === 'done').length
  if (view.next === -1) return 'done'
  if (done === 0) return view.steps.some(step => step.state === 'started') ? 'started' : 'not started'

  return `${done} of ${view.steps.length} steps`
}

/** The path's language as a person reads it: "Python", or "Any language" for `general`. */
export function lessonLanguage(language: string): string {
  return language === 'general' ? 'Any language' : languageName(language)
}

/**
 * What is sent to the conversation when they start a step from the tab, as
 * their own message: the step's text and how it is to be taught. A prompt the
 * mod submits skips the mod's own `prompt.submit` hook, so it carries
 * everything the tutor needs here.
 */
export function stepRequest(path: LessonPath, step: number): string {
  const current = path.steps[step]
  if (current === undefined) return ''
  const first = step === 0 && path.intro !== '' ? [`About the path:\n${path.intro}`, ''] : []

  return [
    `I am starting step ${step + 1} of ${path.steps.length} of the lesson "${path.title}" (${lessonLanguage(path.language)}, ${path.level}, id ${path.id}): ${current.title}.`,
    '',
    ...first,
    current.body,
    '',
    'Teach me this step in my own code, the way you teach anything else: I write it. When I have shown you I can do it, record the step as done.',
  ].join('\n')
}

/** A path as the lesson tool reads it to the tutor: the whole text, and where they are. */
export function pathText(path: LessonPath, record: LessonRecord): string {
  const view = lessonView(path, record)
  const lines = [
    `Lesson "${path.title}" (id ${path.id}): ${lessonLanguage(path.language)}, ${path.level}. ${lessonProgress(view)}.`,
    ...(path.summary === '' ? [] : [path.summary]),
    ...(path.intro === '' ? [] : ['', path.intro]),
  ]
  path.steps.forEach((step, index) => {
    const shown = view.steps[index]
    const mark = shown?.state === 'checked' ? 'done, you saw it' : shown?.state === 'done' ? 'done, by their word' : shown?.state === 'started' ? 'started' : 'not started'
    lines.push('', `## Step ${index + 1}: ${step.title} (${mark}${(shown?.helped ?? 0) > 0 ? `, needed help ${shown?.helped} times` : ''})`, step.body)
  })

  return lines.join('\n')
}

/** Every path in a line each, for the lesson tool called without a path. */
export function pathsText(views: readonly LessonView[]): string {
  if (views.length === 0) return 'No lessons are installed.'

  return [
    'The lessons installed. Call the tool again with a path id to read one.',
    ...views.map(view => `- ${view.id}: ${view.title} (${lessonLanguage(view.language)}, ${view.level}, ${lessonProgress(view)})${view.summary === '' ? '' : `. ${view.summary}`}`),
  ].join('\n')
}

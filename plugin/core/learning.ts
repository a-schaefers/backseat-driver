/**
 * Keeping the lessons: finding the paths in the plugin's `lessons/` folder,
 * where they are in each (one record per path in the data folder, by
 * language), and what changes it: a step started from the Lessons tab, a step
 * marked done there, and the tutor's lesson tool. This is the engine; the
 * program it runs in gives it `LearningPorts`, and what it remembers is
 * `LearningState`. The paths and the records are `lessons.ts`'s.
 */

import type { LessonsView, LessonView } from '../types'
import { lessonPath } from './datahome'
import type { Host } from './host'
import { emptyLessonRecord, LESSONS_FOLDER, lessonOrder, lessonView, nextStep, parseLessonRecord, parsePath, pathsText, pathText, stepRequest, withDone, withHelp, withStarted } from './lessons'
import type { LessonPath, LessonRecord } from './lessons'
import { updateJson } from './store'

export type LearningState = {
  paths: LessonPath[]
  /** Where they are in each path, by path id. */
  records: Map<string, LessonRecord>
  /** Files of the lessons folder that are not a path, and why. */
  problems: string[]
  /** The path opened in the Lessons tab. */
  selected: string | null
}

export function freshLearningState(): LearningState {
  return { paths: [], records: new Map<string, LessonRecord>(), problems: [], selected: null }
}

/** What the lessons need from their host. Each is read when it is needed. */
export type LearningPorts = Pick<Host, 'now' | 'store' | 'dataRoot' | 'list' | 'readFile' | 'trace' | 'fail'> & {
  /** The plugin's own folder, where `lessons/` is. */
  pluginRoot: () => string
  /** The languages in play, main ones first. */
  languages: () => readonly string[]
  /** Changes what the Lessons tab shows. */
  setLessons: (view: LessonsView) => Promise<void>
}

/** Every path as the tab lists it. */
export function lessonViews(state: LearningState, languages: readonly string[]): LessonView[] {
  return lessonOrder(
    state.paths.map(path => lessonView(path, state.records.get(path.id) ?? emptyLessonRecord(path.id, path.language))),
    languages,
  )
}

export async function showLessons(ports: Pick<LearningPorts, 'languages' | 'setLessons'>, state: LearningState): Promise<void> {
  await ports.setLessons({ paths: lessonViews(state, ports.languages()), selected: state.selected, problems: state.problems })
}

/**
 * Reads the lessons folder and where they are in each path. A file that is
 * not a path is left out and named in the tab, so that a path merged with a
 * mistake in it is noticed rather than missing.
 */
export async function loadLessons(ports: LearningPorts, state: LearningState): Promise<void> {
  const folder = `${ports.pluginRoot()}/${LESSONS_FOLDER}`
  let names: string[] = []
  try {
    names = (await ports.list(folder)).filter(entry => entry.kind === 'file' && entry.name.toLowerCase().endsWith('.md')).map(entry => entry.name).sort()
  } catch {
    // No folder: no lessons. Not an error.
  }
  const paths: LessonPath[] = []
  const problems: string[] = []
  for (const name of names) {
    try {
      const read = parsePath(name, await ports.readFile(`${folder}/${name}`))
      if ('problem' in read) problems.push(read.problem)
      else if (paths.some(path => path.id === read.path.id)) problems.push(`${name}: another path already has the id ${read.path.id}`)
      else paths.push(read.path)
    } catch (error) {
      ports.fail(`reading the lesson ${name}`, error)
    }
  }
  const records = new Map<string, LessonRecord>()
  for (const path of paths) records.set(path.id, await loadLessonRecord(ports, path))
  state.paths = paths
  state.records = records
  state.problems = problems
  if (state.selected !== null && !paths.some(path => path.id === state.selected)) state.selected = null
  ports.trace('lessons', 'loaded', () => ({ paths: paths.map(path => path.id), problems }))
  await showLessons(ports, state)
}

async function loadLessonRecord(ports: Pick<LearningPorts, 'store' | 'dataRoot'>, path: LessonPath): Promise<LessonRecord> {
  if (ports.dataRoot() === '') return emptyLessonRecord(path.id, path.language)

  return parseLessonRecord(await ports.store().read(lessonPath(ports.dataRoot(), path.language, path.id)), path.id, path.language)
}

export function findPath(state: LearningState, id: string): LessonPath | undefined {
  const wanted = id.trim().toLowerCase().replace(/\.md$/, '')

  return state.paths.find(path => path.id === wanted) ?? state.paths.find(path => path.title.toLowerCase() === wanted)
}

/** Changes the record of one path, on disk as it stands there (another session may change it too), and everywhere it is shown. */
async function changeRecord(ports: LearningPorts, state: LearningState, path: LessonPath, apply: (record: LessonRecord) => LessonRecord): Promise<LessonRecord> {
  const record =
    ports.dataRoot() === ''
      ? apply(state.records.get(path.id) ?? emptyLessonRecord(path.id, path.language))
      : await updateJson(ports.store(), lessonPath(ports.dataRoot(), path.language, path.id), stored => parseLessonRecord(stored, path.id, path.language), apply)
  state.records.set(path.id, record)
  await showLessons(ports, state)

  return record
}

/** Opens a path in the tab, or goes back to the list with null. */
export async function selectLesson(ports: LearningPorts, state: LearningState, id: string | null): Promise<void> {
  state.selected = id
  await showLessons(ports, state)
}

/**
 * Starts the next step of a path: marks it started, and gives back what is
 * sent to the conversation. '' when the path is unknown or every step is done.
 */
export async function startStep(ports: LearningPorts, state: LearningState, id: string): Promise<string> {
  const path = findPath(state, id)
  if (path === undefined) return ''
  const step = nextStep(path, state.records.get(path.id) ?? emptyLessonRecord(path.id, path.language))
  if (step === -1) return ''
  const at = await ports.now()
  await changeRecord(ports, state, path, record => withStarted(record, step, at))
  ports.trace('lessons', 'started', () => ({ path: path.id, step }))

  return stepRequest(path, step)
}

/** They say the next step of a path is done. Their word counts for less than the tutor seeing it. */
export async function markDone(ports: LearningPorts, state: LearningState, id: string): Promise<string> {
  const path = findPath(state, id)
  if (path === undefined) return ''
  const step = nextStep(path, state.records.get(path.id) ?? emptyLessonRecord(path.id, path.language))
  if (step === -1) return ''
  const at = await ports.now()
  await changeRecord(ports, state, path, record => withDone(record, step, 'self', at))
  ports.trace('lessons', 'done by their word', () => ({ path: path.id, step }))

  return path.steps[step]?.title ?? ''
}

/**
 * The tutor's lesson tool. With no path it lists the paths; with a path and
 * no outcome it reads that path and where they are; with an outcome it
 * records it for the step named, or the next one.
 */
export async function lessonTool(
  ports: LearningPorts,
  state: LearningState,
  input: { path?: string; step?: number; outcome?: string },
): Promise<string> {
  const id = String(input.path ?? '').trim()
  if (id === '') return pathsText(lessonViews(state, ports.languages()))
  const path = findPath(state, id)
  if (path === undefined) return `There is no lesson "${id}". ${pathsText(lessonViews(state, ports.languages()))}`
  const known = state.records.get(path.id) ?? emptyLessonRecord(path.id, path.language)
  if (input.outcome !== 'done' && input.outcome !== 'help') return pathText(path, known)

  const named = Math.floor(Number(input.step))
  const step = Number.isFinite(named) && named >= 1 && named <= path.steps.length ? named - 1 : nextStep(path, known)
  if (step === -1) return `Every step of "${path.title}" is already done.`
  const at = await ports.now()
  const outcome = input.outcome
  const record = await changeRecord(ports, state, path, current => (outcome === 'done' ? withDone(current, step, 'tutor', at) : withHelp(current, step, at)))
  ports.trace('lessons', outcome, () => ({ path: path.id, step }))
  const title = path.steps[step]?.title ?? ''
  if (outcome === 'help') return `Recorded that they needed help with step ${step + 1} (${title}). It shows on the Growth tab, and costs them nothing.`
  const next = nextStep(path, record)

  return next === -1
    ? `Recorded step ${step + 1} (${title}) as done. That was the last step of "${path.title}".`
    : `Recorded step ${step + 1} (${title}) as done. Next is step ${next + 1}: ${path.steps[next]?.title ?? ''}. They start it from the Lessons tab, or ask you.`
}

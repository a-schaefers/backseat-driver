import type { LessonView, Level, Profile, ProgressRecord } from '../types'
import { growthOfFacts } from './core'
import { LEVELS } from './progress'
import { languageName } from './languages'

/**
 * Growth: one score per language, from their own commits, the lessons they
 * did, the help they needed and the habits they changed. The rules, the
 * score and the picking of what to show are the kernel's (`Kernel.Growth`);
 * this file gathers the facts from the records and words what comes back.
 */

export type GrowthItem = { kind: string; what: string; count: number; total: number }

export type Growth = {
  /** Null until their own commits give enough to go on. */
  level: Level | null
  /** The level times a hundred plus how far toward the next; -1 before a level. */
  score: number
  toNext: number
  /** The weight of what their own commits showed and missed. */
  shown: number
  missed: number
  lessonSteps: number
  habitsImproved: number
  stillComing: number
  workOn: GrowthItem[]
  neededHelp: GrowthItem[]
  improved: GrowthItem[]
  toRaise: GrowthItem[]
  encouragement: GrowthItem | null
}

export type GrowthFacts = {
  seen: { commit: string; skill: string; level: Level; isShown: boolean; weight: number }[]
  lessons: { id: string; title: string; level: Level; steps: number; done: number; checked: number; helped: number; isCounted: boolean; skills: string[] }[]
  topics: { topic: string; flagged: number; explained: number; sinceLooks: number }[]
  /** The person's own added lines the assessments have read. */
  linesRead: number
}

/** The facts for one language: its progress record, its profile, and the lessons of that language and of no one language. */
export function growthFacts(record: ProgressRecord, profile: Profile | undefined, lessons: readonly LessonView[]): GrowthFacts {
  const language = record.language

  return {
    seen: record.observations.map(seen => ({
      // Two projects can have commits with one hash; the record keeps them apart the same way.
      commit: `${seen.project}\n${seen.commit}`,
      skill: seen.skill,
      level: seen.level,
      isShown: seen.verdict === 'shown',
      weight: seen.weight,
    })),
    lessons: lessons
      .filter(lesson => lesson.language === language || lesson.language === 'general')
      .map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        level: lesson.level,
        steps: lesson.steps.length,
        done: lesson.steps.filter(step => step.state === 'checked' || step.state === 'done').length,
        checked: lesson.steps.filter(step => step.state === 'checked').length,
        helped: lesson.steps.reduce((sum, step) => sum + step.helped, 0),
        // A path about no one language is listed and suggested, and moves no language's level.
        isCounted: lesson.language === language,
        skills: lesson.skills,
      })),
    topics: Object.entries(profile?.topics ?? {}).map(([topic, stats]) => ({
      topic,
      flagged: stats.flagged,
      explained: stats.explained,
      sinceLooks: Math.max(0, (profile?.looks ?? 0) - stats.lastLook),
    })),
    linesRead: record.linesRead,
  }
}

export function growthOf(record: ProgressRecord, profile: Profile | undefined, lessons: readonly LessonView[]): Growth {
  return growthOfFacts(growthFacts(record, profile, lessons))
}

const LEVEL_AFTER: Record<Level, Level | null> = { beginner: 'junior', junior: 'mid', mid: 'senior', senior: null }

function words(slug: string): string {
  return slug.replaceAll('-', ' ')
}

function times(count: number): string {
  return count === 1 ? 'once' : `${count} times`
}

/** The headline: "junior · growth 162, 62 of the way to mid", or how far there is to a first level. */
export function growthHeadline(growth: Growth): string {
  if (growth.level === null) return 'Not placed yet'
  const next = LEVEL_AFTER[growth.level]

  return next === null ? `${growth.level} · growth ${growth.score}` : `${growth.level} · growth ${growth.score}, ${growth.toNext} of the way to ${next}`
}

/** The bar's color, by how far toward the next level: red, orange, yellow, then green, like a health bar filling up. */
export type GrowthBand = 'red' | 'orange' | 'yellow' | 'green'

/** A nickname per level, for the ladder's top row (owner, 2026-10-05: "why not make some humor"). The honest level word stays beside it. */
export const LEVEL_NICKNAMES: Record<Level, string> = { beginner: 'Padawan', junior: 'Apprentice', mid: 'Journeyman', senior: 'Gandalf' }

/** One rung of the ladder: a level, passed (full), current (filling toward the next) or ahead (empty). */
export type LadderRung = { level: Level; nick: string; state: 'passed' | 'current' | 'ahead'; filled: number; empty: number }

/** The headline as a ladder of the four levels, each `width` cells wide, the current one filling toward the next. */
export type GrowthLadder = { rungs: LadderRung[]; width: number; band: GrowthBand }

/** The fewest and most cells a rung has: four rungs with their brackets and gaps have to fit the pane. */
export const RUNG_MIN = 6
export const RUNG_MAX = 14

/**
 * Null until there is a level. The current rung shows any way made as a cell
 * at least, and is never full short of the next level; at senior, which has
 * no next, it fills with the way on. Rungs passed are full, rungs ahead empty.
 */
export function growthLadder(growth: Growth, columns: number): GrowthLadder | null {
  if (growth.level === null) return null
  const width = Math.max(RUNG_MIN, Math.min(RUNG_MAX, Math.floor((columns - 3) / 4) - 2))
  const way = Math.min(99, Math.max(0, growth.toNext))
  const filled = way === 0 ? 0 : Math.min(width - 1, Math.max(1, Math.round((way * width) / 100)))
  const at = LEVELS.indexOf(growth.level)
  const rungs = LEVELS.map((level, index): LadderRung => {
    const state = index < at ? 'passed' : index === at ? 'current' : 'ahead'
    const cells = state === 'passed' ? width : state === 'current' ? filled : 0

    return { level, nick: LEVEL_NICKNAMES[level], state, filled: cells, empty: width - cells }
  })

  return { rungs, width, band: bandOf(way) }
}

/** The words beside the bar: "10% to junior · growth 10"; at senior, which has no next, only the score. */
export function growthMeterLabel(growth: Growth): string {
  if (growth.level === null) return growthHeadline(growth)
  const next = LEVEL_AFTER[growth.level]

  return next === null ? `growth ${growth.score}` : `${growth.toNext}% to ${next} · growth ${growth.score}`
}

/** A rung's word, centered over its cells and brackets: the nickname above, the level below. */
export function rungWord(word: string, width: number): string {
  const room = width + 2
  const cut = word.length > room ? word.slice(0, room) : word
  const left = Math.floor((room - cut.length) / 2)

  return `${' '.repeat(left)}${cut}${' '.repeat(room - cut.length - left)}`
}

function bandOf(way: number): GrowthBand {
  if (way < 25) return 'red'
  if (way < 50) return 'orange'
  if (way < 75) return 'yellow'

  return 'green'
}

/** What went into the score, in a line. */
export function growthCounts(growth: Growth, seen?: { shown: number; missed: number }): string {
  // The observations by verdict, with what they weigh when that differs: "6.5 shown, 3.5 missed" were weights read as
  // counts (the seventeenth ui-truth pass, 2026-10-07).
  const isWeighed = seen !== undefined && (seen.shown !== growth.shown || seen.missed !== growth.missed)
  const own =
    seen === undefined
      ? `own commits weigh ${round(growth.shown)} shown and ${round(growth.missed)} missed`
      : `own commits: ${seen.shown} shown, ${seen.missed} missed${isWeighed ? ` (weighing ${round(growth.shown)} and ${round(growth.missed)})` : ''}`
  const parts = [own]
  if (growth.lessonSteps > 0) parts.push(`lesson steps done: ${growth.lessonSteps}`)
  if (growth.habitsImproved > 0) parts.push(`habits fixed: ${growth.habitsImproved}`)
  if (growth.stillComing > 0) parts.push(`still coming back: ${growth.stillComing}`)

  return `Counted: ${parts.join('; ')}.`
}

function round(weight: number): string {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1)
}

/** A thing to work on, as a line. */
export function workOnLine(item: GrowthItem): string {
  switch (item.kind) {
    case 'slipping':
      return `${words(item.what)}: shown before, missed in your latest work`
    case 'recurring':
      return `${words(item.what)}: raised ${times(item.count)} while you worked, and still coming up`
    case 'missed':
      return `${words(item.what)}: missed in your commits, not shown yet`
    case 'lesson':
      return `Finish "${item.what}": ${item.count} of ${item.total} steps done`
    default:
      return words(item.what)
  }
}

/** Where they needed help, as a line. */
export function helpLine(item: GrowthItem): string {
  switch (item.kind) {
    case 'asked':
      return `${words(item.what)}: you asked for it to be explained ${times(item.count)}`
    case 'flagged':
      return `${words(item.what)}: the play-by-play raised it ${times(item.count)}`
    case 'lesson':
      return `"${item.what}": walked through ${times(item.count)}`
    default:
      return words(item.what)
  }
}

/** What they improved, as a line. */
export function improvedLine(item: GrowthItem): string {
  switch (item.kind) {
    case 'habit':
      return `${words(item.what)}: raised ${times(item.count)} before, not once in your last ${item.total} looks`
    case 'skill':
      return `${words(item.what)}: missed in an earlier commit, shown in your latest`
    case 'lesson':
      return `Finished "${item.what}"`
    default:
      return words(item.what)
  }
}

const LEVEL_NAMES: readonly Level[] = ['beginner', 'junior', 'mid', 'senior']

/** What would raise the score, as a line. */
export function raiseLine(item: GrowthItem): string {
  switch (item.kind) {
    case 'place':
      return `Commit work of your own. A level needs ${item.count} more observations from ${item.total} more commits.`
    case 'lines':
      return `A level needs ${item.count} more lines of your own read: ${item.total} in all, from real work, not a toy script.`
    case 'evidence':
      return 'Nothing yet shows a level either way: more of your own work, and the first one shows.'
    case 'skill':
      return `Show ${words(item.what)} in your own commits: it is ${LEVEL_NAMES[item.count] ?? 'next-level'} work you missed`
    case 'own':
      return `Your own commits count most: ${LEVEL_NAMES[item.count] ?? 'next-level'} work in them is what moves the level, not lessons alone`
    case 'lesson':
      return `Lesson "${item.what}"${item.count > 0 ? `, ${item.count} of ${item.total} steps done` : ''} (5: Lessons)`
    default:
      return words(item.what)
  }
}

/** One plain line about what improved, or '' when nothing did. Never praise for its own sake. */
export function encouragementLine(growth: Growth): string {
  const item = growth.encouragement
  if (item === null) return ''
  switch (item.kind) {
    case 'habit':
      return `${words(item.what)} used to come up a lot. It has not in your last ${item.total} looks. That is a habit changed.`
    case 'skill':
      return `You missed ${words(item.what)} once and got it right since.`
    case 'lesson':
      return `You finished "${item.what}".`
    default:
      return ''
  }
}

/** Growth in one language as plain text, for the progress tool and every prompt. */
export function growthText(language: string, growth: Growth, seen?: { shown: number; missed: number }): string {
  const lines = [`${languageName(language)} growth: ${growthHeadline(growth)}. ${growthCounts(growth, seen)}`]
  if (growth.workOn.length > 0) lines.push(`Work on: ${growth.workOn.map(workOnLine).join('; ')}.`)
  if (growth.neededHelp.length > 0) lines.push(`Needed help with: ${growth.neededHelp.map(helpLine).join('; ')}.`)
  if (growth.improved.length > 0) lines.push(`Improved: ${growth.improved.map(improvedLine).join('; ')}.`)
  if (growth.toRaise.length > 0) lines.push(`To raise it: ${growth.toRaise.map(raiseLine).join('; ')}`)

  return lines.join('\n')
}

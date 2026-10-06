import { expect, test } from 'claude-code/testing'

import { encouragementLine, growthFacts, growthHeadline, growthMeter, growthMeterLabel, growthOf, growthText, improvedLine, raiseLine, workOnLine } from '../core/growth'
import { emptyLessonRecord, lessonView, parsePath, withDone, withHelp, withStarted } from '../core/lessons'
import type { LessonPath } from '../core/lessons'
import { emptyProfile, withFlagged, withLooked } from '../core/profiles'
import { emptyRecord } from '../core/progress'
import type { LessonView, Level, Observation, Profile, ProgressRecord } from '../types'

function seen(commit: string, skill: string, verdict: 'shown' | 'missed', level: Level, weight = 1): Observation {
  return { commit, project: 'stats', at: 1, skill, verdict, level, weight, note: '' }
}

function record(observations: Observation[]): ProgressRecord {
  return { ...emptyRecord('python'), observations }
}

const PATH = (() => {
  const read = parsePath(
    'python-errors.md',
    '---\ntitle: Errors\nlanguage: python\nlevel: mid\nskills: error-handling\n---\nIntro.\n\n## One\nDo one.\n\n## Two\nDo two.\n\n## Three\nDo three.\n\n## Four\nDo four.\n',
  )
  if (!('path' in read)) throw new Error(read.problem)

  return read.path
})()

function lesson(path: LessonPath, change: (record: ReturnType<typeof emptyLessonRecord>) => ReturnType<typeof emptyLessonRecord>): LessonView {
  return lessonView(path, change(emptyLessonRecord(path.id, path.language)))
}

/** Junior work from two commits: placed at junior. */
const JUNIOR = [
  seen('a', 'naming', 'shown', 'junior'),
  seen('a', 'tests', 'shown', 'junior'),
  seen('a', 'functions', 'shown', 'junior'),
  seen('b', 'loops', 'shown', 'junior'),
  seen('b', 'naming', 'shown', 'junior'),
  seen('b', 'edge-cases', 'missed', 'junior', 0.5),
]

test('nothing is placed before five observations from two commits, and the score says so', () => {
  const growth = growthOf(record(JUNIOR.slice(0, 4)), undefined, [])
  expect(growth.level).toBe(null)
  expect(growth.score).toBe(-1)
  expect(growthHeadline(growth)).toBe('Not placed yet')
  expect(growth.toRaise[0]?.kind).toBe('place')
  expect(raiseLine(growth.toRaise[0] ?? { kind: '', what: '', count: 0, total: 0 })).toBe('Commit work of your own. A level needs 1 more observations from 0 more commits.')
})

test('own commits place the level, and the score is the level times a hundred plus the way to the next', () => {
  const growth = growthOf(record(JUNIOR), undefined, [])
  expect(growth.level).toBe('junior')
  expect(Math.floor(growth.score / 100)).toBe(1)
  expect(growth.score % 100).toBe(growth.toNext)
  expect(growthHeadline(growth)).toBe(`junior · growth ${growth.score}, ${growth.toNext} of the way to mid`)
})

test('the growth bar fills with the way to the next level, and goes from red to green', () => {
  const growth = growthOf(record(JUNIOR), undefined, [])
  const meter = growthMeter(growth, 20)
  expect(meter?.level).toBe('junior')
  expect(meter?.next).toBe('mid')
  expect((meter?.filled ?? 0) + (meter?.empty ?? 0)).toBe(20)
  expect(growthMeterLabel(growth)).toBe(`${growth.toNext}% to mid · growth ${growth.score}`)
  // Nothing to draw before a level: the headline says so instead.
  const unplaced = growthOf(record(JUNIOR.slice(0, 4)), undefined, [])
  expect(growthMeter(unplaced, 20)).toBe(null)
  expect(growthMeterLabel(unplaced)).toBe('Not placed yet')

  const at = (toNext: number) => growthMeter({ ...growth, toNext }, 20)
  expect(at(0)).toEqual({ level: 'junior', next: 'mid', filled: 0, empty: 20, band: 'red' })
  // Any way made shows as a cell, and the bar is never full short of the next level.
  expect(at(1)?.filled).toBe(1)
  expect(at(24)?.band).toBe('red')
  expect(at(25)?.band).toBe('orange')
  expect(at(50)?.band).toBe('yellow')
  expect(at(75)?.band).toBe('green')
  expect(at(99)).toEqual({ level: 'junior', next: 'mid', filled: 19, empty: 1, band: 'green' })
  // Senior has no next level: the bar still fills, and the label is the score alone.
  const senior = { ...growth, level: 'senior' as const, score: 350, toNext: 50 }
  expect(growthMeter(senior, 20)?.next).toBe(null)
  expect(growthMeterLabel(senior)).toBe('growth 350')
})

test('lessons move the score toward the next level, and never carry a level alone', () => {
  const before = growthOf(record(JUNIOR), undefined, [])
  const done = lesson(PATH, record => [0, 1, 2, 3].reduce((current, step) => withDone(current, step, 'tutor', 5), record))
  const after = growthOf(record(JUNIOR), undefined, [done])
  expect(after.toNext > before.toNext).toBe(true)
  expect(after.level).toBe('junior')
  expect(after.lessonSteps).toBe(4)
  expect(after.improved.some(item => item.kind === 'lesson')).toBe(true)

  // However many lessons, a level needs work of their own shown at it.
  const many = Array.from({ length: 6 }, (_, index) => ({ ...done, id: `path-${index}`, title: `Path ${index}` }))
  expect(growthOf(record(JUNIOR), undefined, many).level).toBe('junior')
})

test('a lesson skipped or left half done costs nothing, and one in progress is listed as something to work on', () => {
  const plain = growthOf(record(JUNIOR), undefined, [])
  const untouched = growthOf(record(JUNIOR), undefined, [lesson(PATH, record => record)])
  const halfway = growthOf(record(JUNIOR), undefined, [lesson(PATH, record => withHelp(withStarted(record, 1, 2), 1, 3))])
  expect(untouched.score).toBe(plain.score)
  expect(halfway.score).toBe(plain.score)

  const begun = growthOf(record(JUNIOR), undefined, [lesson(PATH, record => withDone(record, 0, 'self', 2))])
  expect(begun.score >= plain.score).toBe(true)
  expect(begun.workOn.map(workOnLine)).toContain('Finish "Errors": 1 of 4 steps done')
  expect(halfway.neededHelp.map(item => item.kind)).toContain('lesson')
})

test('a step the tutor saw counts for more than one taken on their word', () => {
  const history = [...JUNIOR, seen('c', 'design', 'shown', 'mid')]
  const checked = growthOf(record(history), undefined, [lesson(PATH, record => withDone(record, 0, 'tutor', 2))])
  const said = growthOf(record(history), undefined, [lesson(PATH, record => withDone(record, 0, 'self', 2))])
  expect(checked.toNext > said.toNext).toBe(true)
})

function looked(profile: Profile, times: number): Profile {
  return Array.from({ length: times }).reduce<Profile>(current => withLooked(current), profile)
}

test('a topic that kept coming back and stopped is a habit improved, and one still coming back holds the score down within the level', () => {
  const raised = [1, 2, 3].reduce<Profile>(current => withFlagged(withLooked(current), ['unclosed-file']), emptyProfile())
  const coming = growthOf(record(JUNIOR), raised, [])
  const plain = growthOf(record(JUNIOR), undefined, [])
  expect(coming.stillComing).toBe(1)
  expect(coming.toNext <= plain.toNext).toBe(true)
  expect(coming.level).toBe('junior')
  expect(coming.workOn.map(workOnLine)).toContain('unclosed file: raised 3 times while you worked, and still coming up')

  const fixed = growthOf(record(JUNIOR), looked(raised, 12), [])
  expect(fixed.habitsImproved).toBe(1)
  expect(fixed.toNext >= plain.toNext).toBe(true)
  expect(fixed.improved.map(improvedLine)).toContain('unclosed file: raised 3 times before, not once in your last 12 looks')
  expect(encouragementLine(fixed)).toBe('unclosed file used to come up a lot. It has not in your last 12 looks. That is a habit changed.')
})

test('asking for an explanation is listed as help needed, and costs nothing', () => {
  const asked: Profile = { ...emptyProfile(), topics: { 'off-by-one': { flagged: 0, explained: 2, lastLook: 0 } } }
  const growth = growthOf(record(JUNIOR), asked, [])
  expect(growth.score).toBe(growthOf(record(JUNIOR), undefined, []).score)
  expect(growth.neededHelp).toEqual([{ kind: 'asked', what: 'off-by-one', count: 2, total: 0 }])
})

test('a skill missed and then shown is improved; one shown and then missed is slipping', () => {
  const history = [...JUNIOR, seen('c', 'edge-cases', 'shown', 'junior'), seen('c', 'naming', 'missed', 'junior')]
  const growth = growthOf(record(history), undefined, [])
  expect(growth.improved).toContainEqual({ kind: 'skill', what: 'edge-cases', count: 0, total: 0 })
  expect(growth.workOn[0]).toEqual({ kind: 'slipping', what: 'naming', count: 0, total: 0 })
  expect(encouragementLine(growth)).toBe('You missed edge cases once and got it right since.')
})

test('misses at the level bring it back down', () => {
  const misses = [seen('c', 'naming', 'missed', 'junior'), seen('d', 'loops', 'missed', 'junior'), seen('d', 'functions', 'missed', 'junior')]
  expect(growthOf(record([...JUNIOR, ...misses]), undefined, []).level).toBe('beginner')
})

test('what would raise the score: next-level skills missed, then a lesson that fits what they are working on', () => {
  const history = [...JUNIOR, seen('c', 'error-handling', 'missed', 'mid')]
  const growth = growthOf(record(history), undefined, [lesson(PATH, record => record)])
  expect(growth.toRaise.map(item => item.kind)).toEqual(['skill', 'own', 'lesson'])
  expect(raiseLine(growth.toRaise[0] ?? { kind: '', what: '', count: 0, total: 0 })).toBe('Show error handling in your own commits: it is mid work you missed')
  expect(growth.toRaise[2]?.what).toBe('Errors')
})

test('a path about no one language is suggested and moves no level', () => {
  const general = { ...lesson(PATH, record => [0, 1, 2, 3].reduce((current, step) => withDone(current, step, 'tutor', 5), record)), language: 'general' }
  const facts = growthFacts(record(JUNIOR), undefined, [general])
  expect(facts.lessons[0]?.isCounted).toBe(false)
  expect(growthOf(record(JUNIOR), undefined, [general]).toNext).toBe(growthOf(record(JUNIOR), undefined, []).toNext)
})

test('growthText says it all in a few lines for the tutor', () => {
  const text = growthText('python', growthOf(record(JUNIOR), undefined, []))
  expect(text).toMatch(/^Python growth: junior · growth 1\d\d/)
  expect(text).toMatch('Counted: own commits: 5 shown, 0.5 missed.')
})

function seededRandom(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0

    return state / 4294967296
  }
}

const LEVELS: readonly Level[] = ['beginner', 'junior', 'mid', 'senior']

test('whatever their history, lessons never lower the score, and the score stays in its level', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const random = seededRandom(seed)
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
    const history = Array.from({ length: Math.floor(random() * 30) }, () =>
      seen(`c${Math.floor(random() * 8)}`, pick(['naming', 'loops', 'edge-cases', 'error-handling', 'tests']), random() < 0.7 ? 'shown' : 'missed', pick(LEVELS), random() < 0.5 ? 1 : 0.5),
    )
    let profile = emptyProfile()
    for (let look = 0; look < Math.floor(random() * 30); look += 1) {
      profile = withFlagged(withLooked(profile), random() < 0.3 ? [pick(['unclosed-file', 'naming', 'magic-number'])] : [])
    }
    const base = growthOf(record(history), profile, [])
    const steps = Math.floor(random() * 5)
    const withLessons = growthOf(record(history), profile, [
      lesson({ ...PATH, level: pick(LEVELS) }, current => {
        let next = withStarted(current, steps % 4, 1)
        for (let step = 0; step < steps && step < 4; step += 1) next = withDone(next, step, random() < 0.5 ? 'tutor' : 'self', 2)

        return random() < 0.5 ? withHelp(next, 0, 3) : next
      }),
    ])
    const where = `seed ${seed}`
    expect(`${where}: ${withLessons.score >= base.score}`).toBe(`${where}: true`)
    if (base.level !== null) {
      expect(`${where}: ${Math.floor(base.score / 100)}`).toBe(`${where}: ${LEVELS.indexOf(base.level)}`)
      expect(`${where}: ${base.toNext >= 0 && base.toNext <= 99}`).toBe(`${where}: true`)
      const meter = growthMeter(base, 20)
      expect(`${where}: ${meter !== null && meter.filled >= 0 && meter.filled <= 19 && meter.filled + meter.empty === 20}`).toBe(`${where}: true`)
    }
  }
})

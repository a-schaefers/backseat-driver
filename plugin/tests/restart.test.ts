import { expect, test } from 'claude-code/testing'

import { addedLines, unquoted } from '../core/authorship'
import { projectId } from '../core/datahome'
import { parseStatus } from '../core/git'
import { sourcePrint } from '../core/knowledge'
import { applyReply, keepNotes, parseKeptNotes, stillOpen } from '../core/notes'
import { emptyProfile, withFlagged } from '../core/profiles'
import { emptyRecord, withAssessment } from '../core/progress'
import type { Assessment } from '../core/progress'
import { parseReviews } from '../core/project'
import type { Note } from '../types'
import { PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const MEDIAN = `${MEAN}\ndef median(xs):\n    return sorted(xs)[len(xs) // 2]\n`
const NOTES = `projects/${projectId(ROOT)}/notes.json`
const REVIEWS = `projects/${projectId(ROOT)}/reviews.json`
const EVEN = {
  resolved: [],
  notes: [{ file: 'stats.py', line: 5, kind: 'bug', topic: 'even-length', note: 'What is the median of four numbers?' }],
}

const note = (id: number, file: string, text: string): Note => ({ id, file, line: 1, kind: 'tip', topic: `topic-${id}`, text })

test('kept notes come back only while their file reads as the look saw it', () => {
  const kept = keepNotes(
    [note(1, 'a.py', 'About a.'), note(2, 'b.py', 'About b.'), note(3, 'c.py', 'About c.')],
    [note(4, 'a.py', 'Dismissed.')],
    new Map([
      ['a.py', 'print-a'],
      ['b.py', 'print-b'],
    ]),
  )
  // c.py's print was never known, so its note cannot be shown as true later.
  expect(kept.prints).toEqual({ 'a.py': 'print-a', 'b.py': 'print-b' })
  const parsed = parseKeptNotes(JSON.parse(JSON.stringify(kept)))
  expect(parsed).toEqual(kept)
  // b.py changed since, and c.py is gone.
  expect(stillOpen(parsed, new Map([
    ['a.py', 'print-a'],
    ['b.py', 'other'],
  ])).map(open => open.id)).toEqual([1])
  expect(parseKeptNotes('rubbish')).toEqual({ v: 1, notes: [], dismissed: [], prints: {} })
  expect(parseKeptNotes({ notes: [{ id: 'x' }, { id: 1, file: 'a.py', kind: 'nonsense', text: 't' }] }).notes).toEqual([])
})

sessionTest('the notes are kept in the project folder after every look', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply(EVEN)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', MEDIAN)
  await session.clock.advance(12_000)
  await session.clock.settle()
  const kept = parseKeptNotes(session.data(NOTES))
  expect(kept.notes.map(open => open.text)).toEqual(['What is the median of four numbers?'])
  expect(kept.prints).toEqual({ 'stats.py': sourcePrint(MEDIAN) })
})

sessionTest('after a restart the pane shows the notes that still hold and the last deep review', async ($, on) => {
  const session = stubSession(on, {
    head: { 'stats.py': MEDIAN, 'other.py': 'x = 1\n' },
    data: {
      [NOTES]: {
        v: 1,
        notes: [
          { id: 7, file: 'stats.py', line: 5, kind: 'bug', topic: 'even-length', text: 'What is the median of four numbers?' },
          { id: 8, file: 'other.py', line: 1, kind: 'tip', topic: 'name', text: 'A note about text that has changed since.' },
        ],
        dismissed: [],
        prints: { 'stats.py': sourcePrint(MEDIAN), 'other.py': sourcePrint('x = 0\n') },
      },
      [REVIEWS]: [{ commit: 'abc1234', subject: 'commit abc1234: Add median', at: 1, text: 'The median sorts a copy. Good.', decisions: [], insights: [] }],
    },
  })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'What is the median of four numbers?' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'A note about text that has changed since.' })).toBeUndefined()
  await ui.press({ key: 'tab-review' })
  expect((await ui.find({ type: 'Markdown', text: 'The median sorts a copy. Good.' })) ?? (await ui.find({ type: 'Text', text: 'The median sorts a copy. Good.' }))).toBeDefined()
  await ui.unmount()
})

test('a new note is kept over the oldest of its kind when the pane is full', () => {
  const open = Array.from({ length: 8 }, (_, index) => note(index + 1, 'a.py', `Tip ${index + 1}.`))
  const after = applyReply(open, { resolved: [], notes: [{ file: 'b.py', line: 1, kind: 'tip', topic: 'new', text: 'New tip.' }] }, ['b.py'], 9)
  expect(after.notes.map(kept => kept.id).sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9])
})

test('a full lesson memory still learns a new topic', () => {
  let profile = emptyProfile()
  for (let index = 0; index < 150; index += 1) profile = withFlagged(profile, [`old-${index}`])
  for (let count = 0; count < 3; count += 1) profile = withFlagged(profile, ['new-topic'])
  expect(profile.topics['new-topic']?.flagged).toBe(3)
})

test('the level still moves once the record holds as many observations as it keeps', () => {
  const at = (level: 'junior' | 'mid' | 'senior', verdict: 'shown' | 'missed'): Assessment => ({
    observations: Array.from({ length: 6 }, (_, index) => ({ commit: '', skill: `skill-${index}`, verdict, level, note: '' })),
    level,
    why: 'Because.',
    next: '',
    working: [],
    encouragement: '',
  })
  let record = emptyRecord('python')
  let hash = 0
  const assess = (assessment: Assessment): void => {
    hash += 1
    const commit = { hash: `${hash}`.padStart(40, '0'), short: `${hash}`, weight: 1 }
    record = withAssessment(record, assessment, [commit], 'stats', hash).record
  }
  for (let index = 0; index < 60; index += 1) assess(at('junior', 'shown'))
  expect(record.level).toBe('junior')
  expect(record.observations.length).toBe(300)
  for (let index = 0; index < 3; index += 1) assess(at('mid', 'shown'))
  expect(record.level).toBe('mid')
  for (let index = 0; index < 3; index += 1) assess(at('senior', 'shown'))
  expect(record.level).toBe('senior')
})

test('a rename in the work tree does not swallow the entry after it', () => {
  // `git add -N` and a rename: the original path follows, as with a rename in the index.
  expect(parseStatus(' R new.py\0README.md\0 M stats.py\0').map(entry => entry.path)).toEqual(['new.py', 'stats.py'])
})

test('a path git quotes is read as the file it names, and an added line starting ++ is a line', () => {
  expect(unquoted('"b/caf\\303\\251.py"')).toBe('b/café.py')
  expect(unquoted('"b/say \\"hi\\".py"')).toBe('b/say "hi".py')
  expect(unquoted('b/plain.py')).toBe('b/plain.py')
  const files = addedLines(['diff --git a/caf.py b/caf.py', '--- /dev/null', '+++ "b/caf\\303\\251.py"', '@@ -0,0 +1,2 @@', '+x = 1', '+++ y'].join('\n'))
  expect(files).toEqual([{ path: 'café.py', language: 'python', lines: ['x = 1', '++ y'] }])
})

test('a review on record keeps what the tab showed beside it', () => {
  const decision = { file: 'stats.py', line: 3, choice: 'Sort or select', tradeoff: 'Speed against clarity.' }
  expect(parseReviews([{ commit: 'a', subject: 's', at: 1, text: 't', decisions: [decision], insights: ['stats.py: copies'] }])).toEqual([
    { commit: 'a', subject: 's', at: 1, text: 't', decisions: [decision], insights: ['stats.py: copies'] },
  ])
})

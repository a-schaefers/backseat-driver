import { expect, test } from 'claude-code/testing'

import type { Note } from '../types'
import { diffLines } from '../core/diff'
import { applyReply, listNotes, MAX_DISMISSED, MAX_OPEN_NOTES, parseReply, sortNotes, withDismissed } from '../core/notes'
import { excerpt, notesContext, playByPlayPrompt, reviewerSystem } from '../core/prompts'

const note = (id: number, overrides: Partial<Note> = {}): Note => ({
  id,
  file: 'a.py',
  line: 1,
  kind: 'risk',
  topic: `topic-${id}`,
  text: `note ${id}`,
  ...overrides,
})

test('parseReply reads the JSON object the reviewer was asked for', async () => {
  const reply = parseReply(
    '{"resolved": [2], "notes": [{"file": "a.py", "line": 12, "kind": "bug", "topic": "Off by One!", "note": " Look at the last index. "}], "say": " Count the fence posts. ", "working_on": " adding a\\n median "}',
  )

  expect(reply).toEqual({
    resolved: [2],
    notes: [{ file: 'a.py', line: 12, kind: 'bug', topic: 'off-by-one', text: 'Look at the last index.' }],
    say: 'Count the fence posts.',
    workingOn: 'adding a median',
  })
})

test('parseReply finds the object inside prose or a code fence', async () => {
  const fenced = 'Here you go:\n```json\n{"resolved": [], "notes": []}\n```\nDone.'

  expect(parseReply(fenced)).toEqual({ resolved: [], notes: [], say: '', workingOn: '' })
})

test('parseReply drops what it cannot trust and never throws', async () => {
  expect(parseReply('no json here')).toBe(null)
  expect(parseReply('{"notes": [')).toBe(null)
  expect(parseReply('[1, 2]')).toBe(null)

  const reply = parseReply(
    JSON.stringify({
      resolved: [1, 'two', 3.5],
      notes: [
        { file: 'a.py', line: 3, kind: 'nitpick', note: 'unknown kind' },
        { file: 'a.py', line: 3, kind: 'tip', note: '   ' },
        { file: '', line: 3, kind: 'tip', note: 'no file' },
        'not an object',
        { file: 'a.py', kind: 'tip', note: 'No line or topic given.' },
      ],
    }),
  )
  expect(reply).toEqual({
    resolved: [1],
    notes: [{ file: 'a.py', line: 1, kind: 'tip', topic: 'no-line-or-topic-given', text: 'No line or topic given.' }],
    say: '',
    workingOn: '',
  })
})

test('parseReply keeps at most three notes from one look', async () => {
  const many = Array.from({ length: 6 }, (_, i) => ({ file: 'a.py', line: i + 1, kind: 'tip', topic: `t${i}`, note: `n${i}` }))

  expect(parseReply(JSON.stringify({ resolved: [], notes: many }))?.notes.length).toBe(3)
})

test('applyReply removes resolved notes and numbers new ones', async () => {
  const reply = { resolved: [1], notes: [{ file: 'a.py', line: 9, kind: 'bug' as const, topic: 'new', text: 'new' }] }
  const { notes, nextId } = applyReply([note(1), note(2)], reply, ['a.py'], 3)

  expect(notes.map(open => open.id)).toEqual([3, 2])
  expect(nextId).toBe(4)
})

test('applyReply skips a repeat of an open note and notes about files it was not shown', async () => {
  const reply = {
    resolved: [],
    notes: [
      { file: 'a.py', line: 9, kind: 'risk' as const, topic: 'topic-1', text: 'same point again' },
      { file: 'other.py', line: 1, kind: 'bug' as const, topic: 'elsewhere', text: 'not in this look' },
    ],
  }
  const { notes, nextId } = applyReply([note(1)], reply, ['a.py'], 2)

  expect(notes).toEqual([note(1)])
  expect(nextId).toBe(2)
})

test('applyReply keeps the most important notes when the pane is full', async () => {
  const open = Array.from({ length: MAX_OPEN_NOTES }, (_, i) => note(i + 1, { kind: 'tip' }))
  const reply = { resolved: [], notes: [{ file: 'a.py', line: 1, kind: 'bug' as const, topic: 'crash', text: 'crash' }] }
  const { notes } = applyReply(open, reply, ['a.py'], 100)

  expect(notes.length).toBe(MAX_OPEN_NOTES)
  expect(notes[0]?.kind).toBe('bug')
})

test('sortNotes puts bugs first, then reading order', async () => {
  const sorted = sortNotes([
    note(1, { kind: 'tip' }),
    note(2, { kind: 'bug', file: 'b.py' }),
    note(3, { kind: 'bug', file: 'a.py', line: 9 }),
    note(4, { kind: 'bug', file: 'a.py', line: 2 }),
  ])

  expect(sorted.map(open => open.id)).toEqual([4, 3, 2, 1])
})

test('listNotes is what the reviewer and the conversation read', async () => {
  expect(listNotes([note(7, { kind: 'idiom', line: 18, topic: 'option-map', text: 'Option has a method for this.' })])).toBe(
    '7. [idiom] a.py:18 (option-map) Option has a method for this.',
  )
  expect(notesContext([note(7)])).toMatch('7. [risk] a.py:1')
})

test('excerpt shows a short file whole and a long file around its changes', async () => {
  expect(excerpt('a\nb\n', [])).toBe('1 | a\n2 | b')

  const before = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`)
  const after = [...before]
  after[249] = 'changed'
  const shown = excerpt(after.join('\n'), diffLines(before.join('\n'), after.join('\n')))

  expect(shown).toMatch('250 | changed')
  expect(shown).not.toMatch('100 | ')
  expect(shown.split('\n').length < 80).toBe(true)
})

test('playByPlayPrompt lists open notes, the diff and the numbered file', async () => {
  const change = { path: 'a.py', before: 'x = 1\n', after: 'x = 1\ny = 2\n', hunks: diffLines('x = 1\n', 'x = 1\ny = 2\n') }
  const { prompt, shown } = playByPlayPrompt([change], [note(1)])

  expect(shown).toEqual([change])
  expect(prompt).toMatch('1. [risk] a.py:1')
  expect(prompt).toMatch('=== a.py (Python) ===')
  expect(prompt).toMatch('+y = 2')
  expect(prompt).toMatch('2 | y = 2')
  expect(playByPlayPrompt([change], []).prompt).toMatch('(none)')
})

test('playByPlayPrompt leaves out files that do not fit, but never the first', async () => {
  const big = `${'x = 1  # padding padding padding padding\n'.repeat(250)}`
  const changes = ['a.py', 'b.py', 'c.py', 'd.py', 'e.py', 'f.py'].map(path => ({
    path,
    before: '',
    after: big,
    hunks: diffLines('', big),
  }))
  const { shown } = playByPlayPrompt(changes, [])

  expect(shown.length >= 1).toBe(true)
  expect(shown.length < changes.length).toBe(true)
  expect(shown[0]?.path).toBe('a.py')
})

test('reviewerSystem puts the persona after the instructions and what is known about the person', async () => {
  expect(reviewerSystem('INSTRUCTIONS', ['PROFILE', ''], 'PERSONA')).toBe('INSTRUCTIONS\n\nPROFILE\n\nPERSONA')
  expect(reviewerSystem('INSTRUCTIONS', [], '')).toBe('INSTRUCTIONS')
})

test('applyReply does not bring back a point the person dismissed in that file', async () => {
  const dismissed = [note(1, { topic: 'empty-input' })]
  const reply = {
    resolved: [],
    notes: [
      { file: 'a.py', line: 9, kind: 'bug' as const, topic: 'empty-input', text: 'the dismissed point again' },
      { file: 'b.py', line: 2, kind: 'bug' as const, topic: 'empty-input', text: 'the same idea in another file' },
      { file: 'a.py', line: 4, kind: 'risk' as const, topic: 'shadowed-name', text: 'a different point' },
    ],
  }
  const { notes } = applyReply([], reply, ['a.py', 'b.py'], 2, dismissed)

  expect(notes.map(open => `${open.file}:${open.topic}`)).toEqual(['b.py:empty-input', 'a.py:shadowed-name'])
})

test('withDismissed keeps one entry per point and forgets the oldest', async () => {
  const once = withDismissed([note(1)], note(7, { topic: 'topic-1', text: 'later wording' }))
  expect(once).toEqual([note(7, { topic: 'topic-1', text: 'later wording' })])

  const many = Array.from({ length: MAX_DISMISSED + 5 }, (_, i) => note(i + 1)).reduce(withDismissed, [] as Note[])
  expect(many.length).toBe(MAX_DISMISSED)
  expect(many[0]?.id).toBe(6)
})

test('playByPlayPrompt tells the reviewer what was dismissed in the files it is shown', async () => {
  const change = { path: 'a.py', before: '', after: 'x = 1\n', hunks: diffLines('', 'x = 1\n') }
  const dismissed = [note(1, { text: 'seen and waved off' }), note(2, { file: 'other.py', text: 'not in this look' })]
  const { prompt } = playByPlayPrompt([change], [], dismissed)

  expect(prompt).toMatch('Notes they dismissed. Do not raise these again:\n- a.py (topic-1) seen and waved off\n')
  expect(prompt.includes('not in this look')).toBe(false)
  expect(playByPlayPrompt([change], [], []).prompt.includes('dismissed')).toBe(false)
})

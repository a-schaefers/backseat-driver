/**
 * Decision points and insights: the Learning and Explanatory modes of
 * Anthropic's learning-output-style plugin, turned read-only. See
 * THIRD_PARTY_NOTICES.md.
 */
import { expect, test } from 'claude-code/testing'

import { stripComments } from '../hooks/contract'
import { isProblem, parseReply, sortNotes } from '../hooks/notes'
import { DECISION_HEADING, INSIGHT_HEADING } from '../hooks/pane'
import { parseProfile, subjectKey } from '../hooks/profiles'
import { MAX_DECISIONS, splitReview } from '../hooks/project'
import { explainRequest } from '../hooks/prompts'
import type { Note } from '../types'
import { PANE, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'

const note = (id: number, kind: Note['kind'], overrides: Partial<Note> = {}): Note => ({
  id,
  file: 'stats.py',
  line: id,
  kind,
  topic: `topic-${id}`,
  text: `note ${id}`,
  ...overrides,
})

const LOOK = {
  resolved: [],
  notes: [
    { file: 'stats.py', line: 2, kind: 'decision', topic: 'empty-input-contract', note: 'How mean() treats an empty list is a contract every caller inherits. Raise, or return None?' },
    { file: 'stats.py', line: 2, kind: 'bug', topic: 'division-by-zero', note: 'What happens for an empty list?' },
    { file: 'stats.py', line: 1, kind: 'insight', topic: 'plain-functions', note: 'This module keeps every helper a plain function over a list, with no class.' },
  ],
}

test('the reply may carry decision points and insights, and they sort around the problems', async () => {
  const reply = parseReply(JSON.stringify(LOOK))
  expect(reply?.notes.map(item => item.kind)).toEqual(['decision', 'bug', 'insight'])
  expect(parseReply('{"notes": [{"file": "a.py", "line": 1, "kind": "lecture", "note": "x"}]}')?.notes).toEqual([])

  // What will break comes first, then the choices that are theirs, then what reads better, then insights.
  const sorted = sortNotes([note(1, 'insight'), note(2, 'tip'), note(3, 'decision'), note(4, 'bug'), note(5, 'idiom'), note(6, 'risk')])
  expect(sorted.map(item => item.kind)).toEqual(['bug', 'risk', 'decision', 'idiom', 'tip', 'insight'])
  expect(['bug', 'risk', 'idiom', 'tip'].every(kind => isProblem(kind as Note['kind']))).toBe(true)
  expect(isProblem('decision')).toBe(false)
  expect(isProblem('insight')).toBe(false)
})

test('explain asks for what fits the kind of note, and leaves the choice to them', async () => {
  expect(explainRequest(note(3, 'decision', { text: 'Raise, or return None?' }))).toBe(
    'Talk me through decision point 3 (stats.py line 3): "Raise, or return None?" Lay out the ways I could go and what each costs. The choice stays mine.',
  )
  expect(explainRequest(note(4, 'insight', { text: 'Plain functions.' }))).toMatch('Where else does it show up in this codebase?')
  expect(explainRequest(note(1, 'bug'))).toMatch('Give me the concept behind it.')
})

test('a deep review names its decision points in the notes block, and only real ones are kept', async () => {
  const block = {
    overview: '',
    files: [],
    insights: [],
    decisions: [
      { file: 'stats.py', line: 2, choice: 'Empty input: raise or return None', tradeoff: 'Raising surfaces bad input early; None keeps callers simple.' },
      { file: '../etc/passwd', line: 1, choice: 'outside the project', tradeoff: 'x' },
      { file: 'stats.py', line: 5, choice: '', tradeoff: 'no choice named' },
      { file: 'shapes.py', choice: 'Validate in each function or once', tradeoff: 'Once keeps the rules in one place.' },
      { file: 'a.py', line: 1, choice: 'three', tradeoff: '' },
      { file: 'b.py', line: 1, choice: 'four', tradeoff: '' },
    ],
  }
  const { text, notes } = splitReview(`Fine.\n\n\`\`\`backseat-notes\n${JSON.stringify(block)}\n\`\`\``)
  expect(text).toBe('Fine.')
  expect(notes?.decisions.length).toBe(MAX_DECISIONS)
  expect(notes?.decisions[0]).toEqual({ file: 'stats.py', line: 2, choice: 'Empty input: raise or return None', tradeoff: 'Raising surfaces bad input early; None keeps callers simple.' })
  // A decision point with no line is still kept, at line 0.
  expect(notes?.decisions[1]).toEqual({ file: 'shapes.py', line: 0, choice: 'Validate in each function or once', tradeoff: 'Once keeps the rules in one place.' })
})

test('credits in HTML comments are taken out before instructions reach a model', async () => {
  const file = '<!--\nAdapted from learning-output-style (Apache-2.0).\n-->\n\n# Play-by-play\n\nText.\n\n<!-- a note -->\n\n\nMore.\n'
  expect(stripComments(file)).toBe('# Play-by-play\n\nText.\n\nMore.')
  expect(stripComments('No comments here.')).toBe('No comments here.')
})

sessionTest('decision points and insights each get their own section in the play-by-play, apart from the problems', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply(LOOK)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(14_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const texts = (await ui.findAll({ type: 'Text' })).map(found => found.text)
  const decisionAt = texts.indexOf(DECISION_HEADING)
  const insightAt = texts.indexOf(INSIGHT_HEADING)
  const bugAt = texts.findIndex(text => text === 'What happens for an empty list?')
  // The decision point is first and set apart; the insight is last.
  expect(decisionAt >= 0 && decisionAt < bugAt && bugAt < insightAt).toBe(true)
  expect((await ui.find({ type: 'Text', text: DECISION_HEADING }))?.props.color).toBe('magenta')
  expect(await ui.find({ key: 'note-1', text: '1  stats.py · line 2' })).toBeDefined()
  expect(await ui.find({ key: 'note-2', text: '2  bug · line 2' })).toBeDefined()
  expect(await ui.find({ key: 'note-3', text: '3  stats.py · line 1' })).toBeDefined()

  // Selecting the decision point and pressing e asks to have it laid out, without deciding.
  await ui.press({ key: 'note-1' })
  await ui.press({ key: 'explain' })
  expect(session.submitted[0]).toMatch('Talk me through decision point 1 (stats.py line 2)')
  await ui.unmount()

  // Only the bug is a lesson that can keep coming back.
  expect(parseProfile(session.data('profiles/python.json')).topics).toEqual({ 'division-by-zero': { flagged: 1, explained: 0 } })
  expect(subjectKey('python')).toBe('subject/python')
})

sessionTest("a deep review's decision points come first in its tab, and its insights after it", async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN}\ndef median(xs):\n    pass  # TODO: what for an even count?\n`)
  session.commit('Start median')
  await session.clock.advance(2000)

  const block = {
    overview: '',
    files: [],
    insights: [{ file: 'stats.py', symbol: 'mean', text: 'Every helper here takes a plain list and returns a float.' }],
    decisions: [{ file: 'stats.py', line: 5, choice: 'Median of an even count', tradeoff: 'Averaging the two middles is the textbook answer; picking one keeps the type of the input.' }],
  }
  await $.turn.complete(session.finish(1, `A good start.\n\n\`\`\`backseat-notes\n${JSON.stringify(block)}\n\`\`\``))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  const texts = (await ui.findAll({ type: 'Text' })).map(found => found.text)
  expect(texts).toContain('stats.py:5  Median of an even count')
  expect(texts).toContain('Averaging the two middles is the textbook answer; picking one keeps the type of the input.')
  expect(texts).toContain('- stats.py, mean: Every helper here takes a plain list and returns a float.')
  expect(texts.indexOf(DECISION_HEADING) < texts.indexOf(INSIGHT_HEADING)).toBe(true)
  expect((await ui.find({ key: 'review' }))?.props.text).toBe('A good start.')
  await ui.unmount()
})

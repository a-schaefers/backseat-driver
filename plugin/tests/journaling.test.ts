import { expect } from 'claude-code/testing'

import { MARKER, projectId } from '../core/datahome'
import { FORGET } from '../core/forget'
import { parseJournal } from '../core/journal'
import { NOT_CLEAR } from '../hooks/pane'
import { LET_IT_INFER, WORKING_QUESTION } from '../core/working'
import { DATA_HOME, PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const WITH_TOTAL = `${MEAN}\ndef total(xs):\n    return sum(xs)\n`
const JOURNAL = `projects/${projectId(ROOT)}/journal.json`

function resultOf(answer: unknown): string {
  return String((answer as { result: unknown }).result)
}

sessionTest('saves go into the journal, and the play-by-play reads it with the changes', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply({ resolved: [], notes: [], working_on: 'adding a total' })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  session.write('stats.py', WITH_TOTAL)
  await session.clock.advance(14_000)
  expect(session.requests.length).toBe(1)
  const prompt = session.requests[0]?.prompt ?? ''
  expect(prompt).toMatch('What they have been doing in the code.')
  expect(prompt).toMatch('saved stats.py once, +3 -0 in total (lines 3 to 5)')
  // The record comes first, so that the changes are read in its light.
  expect(prompt.indexOf('What they have been doing')).toBeLessThan(prompt.indexOf('Changes since your last look:'))

  // What the look made of it is in the pane, so they never had to say it.
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'adding a total' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Worked out from your activity. Lately: stats.py, in total.' })).toBeDefined()
  await ui.unmount()

  // Written within half a minute, and holding no line of their code.
  await session.clock.advance(30_000)
  const written = JSON.stringify(session.data(JOURNAL))
  expect(written).toMatch('"where":"total"')
  expect(written).not.toMatch('sum(xs)')
  expect(parseJournal(session.data(JOURNAL)).inferred?.text).toBe('adding a total')
})

sessionTest('/backseat working says it in their words, and "clear" leaves it to the tutor again', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  const said = await $.command.run(typed('backseat', 'working on the median'))
  expect(said.text).toBe('Noted. Working on: the median')
  await session.clock.settle()
  // Saved at once: it is the one thing they typed.
  expect(parseJournal(session.data(JOURNAL)).said?.text).toBe('the median')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'the median' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'You said so.' })).toBeDefined()

  // The play-by-play is told, in their words.
  session.write('stats.py', WITH_TOTAL)
  await session.clock.advance(14_000)
  expect(session.requests[0]?.prompt).toMatch('Working on, in their own words (said just now): the median')

  const cleared = await $.command.run(typed('backseat', 'working clear'))
  expect(cleared.text).toBe('Cleared. The tutor goes by your activity again.')
  await session.clock.settle()
  expect(await ui.find({ type: 'Text', text: 'stats.py, in total' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'From your activity: saved once in the last 10 minutes.' })).toBeDefined()
  await ui.unmount()
})

sessionTest('w asks the one question: Esc changes nothing, free text is theirs, and they can take it back', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: NOT_CLEAR })).toBeDefined()

  // Dismissed: nothing is recorded.
  const asked = session.asked.length
  await ui.press({ key: 'working' })
  expect(session.asked.slice(asked)).toEqual([WORKING_QUESTION])
  expect(session.data(JOURNAL)).toBeUndefined()

  session.answers.push('the parser')
  await ui.press({ key: 'working' })
  expect(await ui.find({ type: 'Text', text: 'the parser' })).toBeDefined()
  expect(parseJournal(session.data(JOURNAL)).said?.text).toBe('the parser')

  session.answers.push(LET_IT_INFER)
  await ui.press({ key: 'working' })
  expect(await ui.find({ type: 'Text', text: NOT_CLEAR })).toBeDefined()
  expect(parseJournal(session.data(JOURNAL)).said).toEqual({ text: '', at: expect.any(Number) })
  await ui.unmount()
})

sessionTest('the tutor can record what they say they are working on, and read the whole journal', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  // Nothing has happened yet, and the tool says so.
  expect(resultOf(await $.tool.call({ tool: 'mcp__backseat-driver__activity' }))).toMatch('Nothing has been recorded yet')

  expect(await $.tool.call({ tool: 'mcp__backseat-driver__working', on: '  the parser ' })).toEqual({
    result: 'Recorded: they are working on "the parser". The pane shows it, and the background reviewers are told.',
  })
  session.write('stats.py', WITH_TOTAL)
  await session.clock.advance(4000)

  const activity = resultOf(await $.tool.call({ tool: 'mcp__backseat-driver__activity' }))
  expect(activity).toMatch('Working on, in their own words (said just now): the parser')
  expect(activity).toMatch('saved stats.py once, +3 -0 in total (lines 3 to 5)')
  // The tutor, and only the tutor, also sees what the last save changed.
  expect(activity).toMatch('=== stats.py, saved just now ===')
  expect(activity).toMatch('+def total(xs):')

  // A call that leaves `on` out takes nothing back: seen once in a live session.
  const missing = { tool: 'mcp__backseat-driver__working' } as unknown as { tool: 'mcp__backseat-driver__working'; on: string }
  expect(resultOf(await $.tool.call(missing))).toMatch('Nothing was recorded')
  expect(resultOf(await $.tool.call({ tool: 'mcp__backseat-driver__activity' }))).toMatch('the parser')

  expect(resultOf(await $.tool.call({ tool: 'mcp__backseat-driver__working', on: '' }))).toBe(
    'Cleared. What they are working on is worked out from their activity again.',
  )
})

const EDITOR_REPORT = {
  modified: true,
  buffers: [`${ROOT}/stats.py`, `${ROOT}/test_stats.py`, `${ROOT}/README.md`],
  visible: [`${ROOT}/test_stats.py`],
}

sessionTest("one read of the editor's focus file moves Explain and tells the conversation where the caret is", async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN, 'test_stats.py': 'import stats\n' } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  session.editor(`${ROOT}/stats.py`, 2, undefined, EDITOR_REPORT)
  await session.clock.advance(4000)
  expect(session.diskReads.filter(path => path.includes('/editors/')).length).toBe(1)

  await $.prompt.submit({ text: 'why does this fail?', wait: false, origin: { kind: 'composer' } })
  const context = session.contexts[0] ?? []
  const brief = context.find(block => block.startsWith('Backseat Driver: what the user is doing in their code right now')) ?? ''
  expect(brief).toMatch('Caret now: stats.py line 2, in mean. That buffer has changes that are not saved.')

  // Explain followed the same spot: nothing else could have given it one.
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-explain' })
  expect(await ui.find({ type: 'Text', text: 'Nothing in focus yet.' })).toBeUndefined()
  await ui.unmount()
})

sessionTest("an editor's time goes into the journal: where the caret stayed, and what was on screen beside it", { options: { explain: 'off' } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN, 'test_stats.py': 'import stats\n' } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  session.editor(`${ROOT}/stats.py`, 2, undefined, EDITOR_REPORT)
  await session.clock.advance(20_000)
  const activity = resultOf(await $.tool.call({ tool: 'mcp__backseat-driver__activity' }))
  expect(activity).toMatch('Most of the activity is in: stats.py, in mean (line 2)')
  expect(activity).toMatch('- stats.py: 100% of the time in the editor, the caret mostly in mean (line 2)')
  expect(activity).toMatch('- test_stats.py: on screen beside the file in front for 100% of the time')
  expect(activity).toMatch('On screen beside it: test_stats.py')
  expect(activity).toMatch('Also open in the editor: README.md')

  // Two minutes on, the time becomes entries, and the next write keeps them.
  await session.clock.advance(150_000)
  const entries = parseJournal(session.data(JOURNAL)).entries
  expect(entries.some(entry => entry.kind === 'focus' && entry.path === 'stats.py' && entry.where === 'mean')).toBe(true)
  expect(entries.some(entry => entry.kind === 'screen' && entry.path === 'test_stats.py')).toBe(true)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'stats.py, in mean' })).toBeDefined()
  await ui.unmount()
})

sessionTest('notes, dismissals and commits are in the journal, and switching off writes it', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply({
    resolved: [],
    notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'What does this do for an empty list?' }],
  })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  session.write('stats.py', WITH_TOTAL)
  await session.clock.advance(14_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'dismiss' })
  await ui.unmount()
  session.commit('Add a total')
  await session.clock.advance(2000)

  await $.command.run(typed('backseat', 'off'))
  await session.clock.settle()
  const kinds = parseJournal(session.data(JOURNAL)).entries.map(entry => entry.kind)
  expect(kinds).toEqual(['on', 'save', 'note', 'dismissed', 'commit'])
})

sessionTest('while the tutor is off, nothing reads the editor file or writes a journal', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.editor(`${ROOT}/stats.py`, 2)
  await $.session.start(SESSION)
  session.write('stats.py', WITH_TOTAL)
  await session.clock.advance(60_000)

  expect(session.diskReads).toEqual([])
  expect(session.data(JOURNAL)).toBeUndefined()
})

sessionTest('forgetting this project takes the journal with it, and nothing held is written back', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.disk.set(`${DATA_HOME}/${MARKER}`, 'marker')
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  await $.command.run(typed('backseat', 'working on the parser'))
  await session.clock.settle()
  expect(session.data(JOURNAL)).toBeDefined()

  session.answers.push(FORGET)
  await $.command.run(typed('backseat', 'forget project'))
  await session.clock.settle()
  expect(session.data(JOURNAL)).toBeUndefined()
  expect(session.logs.some(line => line.startsWith('Forgot the journal and cache of this project'))).toBe(true)

  await session.clock.advance(60_000)
  expect(session.data(JOURNAL)).toBeUndefined()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: NOT_CLEAR })).toBeDefined()
  await ui.unmount()
})

sessionTest('outside a git repository there is no journal, and the pane does not offer one', async ($, on) => {
  const session = stubSession(on, { isRepository: false })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.findAll({ key: 'working' })).length).toBe(0)
  await ui.unmount()
  const answered = await $.command.run(typed('backseat', 'working on the parser'))
  expect(answered.text).toMatch('There is no journal to put that in')
})

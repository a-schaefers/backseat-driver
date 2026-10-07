import { expect } from 'claude-code/testing'

import { projectId } from '../core/datahome'
import { parseLedger } from '../core/findings'
import { PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const FIXED = 'def mean(xs):\n    if not xs:\n        raise ValueError("empty")\n    return sum(xs) / len(xs)\n'
const MORE = `${MEAN}\ndef total(xs):\n    return sum(xs)\n`
const OTHER = 'def f(a):\n    return a\n'
const FOLDER = `projects/${projectId(ROOT)}`
const QUIET = { resolved: [], notes: [], issues: [], working_on: '' }

/** One issue on record, open, as an audit left it. */
function issue(id: number, severity: string, file: string, line: number, lineText: string, title: string, more: Record<string, unknown> = {}) {
  return {
    id, file, line, lineText, severity, category: 'bug', topic: `topic-${id}`, title, text: 'Why it matters.', condition: '', origin: 'audit', commit: '0000000',
    at: 1, status: 'open', statusAt: 1, statusBy: 'review', statusNote: '', isPinned: false, ...more,
  }
}

function ledgerOf(...findings: ReturnType<typeof issue>[]) {
  return { v: 1, nextId: findings.length + 1, findings, coverage: { at: 1000, commit: '0000000', files: 2, read: ['stats.py', 'other.py'], skipped: [] } }
}

const EMPTY_INPUT = issue(1, 'high', 'stats.py', 2, 'return sum(xs) / len(xs)', 'mean of an empty list', { topic: 'empty-input' })
const NAMING = issue(2, 'medium', 'other.py', 1, 'def f(a):', 'a name that says nothing')

function onDisk(session: ReturnType<typeof stubSession>) {
  return parseLedger(session.data(`${FOLDER}/findings.json`))
}

sessionTest('a look is told the issues on record in the files it is shown, and its word that one is fixed closes it in every view', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN, 'other.py': OTHER }, data: { [`${FOLDER}/findings.json`]: ledgerOf(EMPTY_INPUT, NAMING) } })
  // Fixed, it says, and a word it may not give: the look never dismisses, reopens or judges.
  session.reply({ ...QUIET, issues: [{ id: 1, status: 'resolved', note: 'an empty list raises' }, { id: 2, status: 'dismissed', note: 'not mine' }] })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', FIXED)
  await session.clock.advance(14_000)

  const prompt = session.requests.find(request => request.prompt.includes('Changes since your last look'))?.prompt ?? ''
  expect(prompt).toMatch('Issues on record in these files')
  // Where it stands now, in the file as it is.
  expect(prompt).toMatch('1. [high, bug] stats.py:4 (empty-input) mean of an empty list')
  // Only the files it is shown.
  expect(prompt).not.toMatch('a name that says nothing')
  expect(onDisk(session).findings.map(finding => [finding.id, finding.status, finding.statusBy, finding.statusNote])).toEqual([
    [1, 'resolved', 'look', 'an empty list raises'],
    [2, 'open', 'review', ''],
  ])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ key: 'issue-1' })).toBeUndefined()
  expect((await ui.find({ key: 'issues-closed' }))?.props.label).toBe('▸ Closed (1)')
  await ui.unmount()
})

sessionTest('a note about an issue on record is not raised beside it', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [`${FOLDER}/findings.json`]: ledgerOf(EMPTY_INPUT) } })
  session.reply({
    ...QUIET,
    notes: [
      { file: 'stats.py', line: 2, kind: 'bug', topic: 'division', note: 'What does this do for an empty list?' },
      { file: 'stats.py', line: 4, kind: 'idiom', topic: 'builtins', note: 'Is there a builtin that does this?' },
    ],
  })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', MORE)
  await session.clock.advance(14_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // The same line as the issue: the issue says it already.
  expect(await ui.find({ type: 'Text', text: 'What does this do for an empty list?' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Is there a builtin that does this?' })).toBeDefined()
  await ui.unmount()
})

sessionTest('the play-by-play shows the serious issues of the files saved this sitting and those tracked, and a dismissal there is one for every view', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN, 'other.py': OTHER }, data: { [`${FOLDER}/findings.json`]: ledgerOf(EMPTY_INPUT, NAMING) } })
  session.reply(QUIET)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // Nothing saved yet this sitting: none shown.
  expect(await ui.find({ type: 'Text', text: 'From the deep review' })).toBeUndefined()

  session.write('stats.py', MORE)
  await session.clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: 'From the deep review' })).toBeDefined()
  expect((await ui.find({ key: 'issue-1' }))?.props.label).toBe('❯ high · stats.py:2')
  // A medium issue in a file not saved: not shown until it is tracked.
  expect(await ui.find({ key: 'issue-2' })).toBeUndefined()
  await ui.press({ key: 'tab-review' })
  await ui.press({ key: 'issue-2' })
  await ui.press({ key: 'issue-track' })
  await session.clock.settle()
  expect(onDisk(session).findings[1]?.isPinned).toBe(true)
  await ui.press({ key: 'tab-play' })
  expect(await ui.find({ key: 'issue-2' })).toBeDefined()

  // The play-by-play's keys act on the issue picked there: dismissed once, gone from both tabs.
  await ui.press({ key: 'issue-1' })
  expect(await ui.find({ key: 'mute' })).toBeUndefined()
  await ui.press({ key: 'dismiss' })
  await session.clock.settle()
  expect(onDisk(session).findings[0]?.status).toBe('dismissed')
  expect(await ui.find({ key: 'issue-1' })).toBeUndefined()
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ key: 'issue-1' })).toBeUndefined()
  await ui.unmount()
})

sessionTest('the Deep review tab lists the bugs and risks the play-by-play raised, a press away from their keys', async ($, on) => {
  const session = stubSession(on)
  session.reply({
    ...QUIET,
    notes: [
      { file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'What does this do for an empty list?' },
      { file: 'stats.py', line: 1, kind: 'tip', topic: 'statistics', note: 'The standard library has a module for this.' },
    ],
  })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ type: 'Text', text: 'Raised while you worked' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'What does this do for an empty list?' })).toBeDefined()
  // A tip teaches; it is no issue.
  expect(await ui.find({ type: 'Text', text: 'The standard library has a module for this.' })).toBeUndefined()
  await ui.press({ key: 'raised-1' })
  expect(await ui.find({ key: 'note-1' })).toBeDefined()
  await ui.unmount()
})

import { expect } from 'claude-code/testing'

import { projectId } from '../core/datahome'
import { parseLedger } from '../core/findings'
import { PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const FOLDER = `projects/${projectId(ROOT)}`

/** One issue on record, open, as an audit left it. */
function issue(id: number, severity: string, file: string, line: number, lineText: string, title: string, more: Record<string, unknown> = {}) {
  return {
    id, file, line, lineText, severity, category: 'bug', topic: `topic-${id}`, title, text: 'Why it matters.', condition: '', origin: 'audit', commit: '0000000',
    at: 1, status: 'open', statusAt: 1, statusBy: 'review', statusNote: '', isPinned: false, ...more,
  }
}

function ledgerOf(...findings: ReturnType<typeof issue>[]) {
  return { v: 1, nextId: findings.length + 1, findings, coverage: { at: 1000, commit: '0000000', files: 1, read: ['stats.py'], skipped: [] } }
}

const EMPTY_INPUT = issue(1, 'high', 'stats.py', 2, 'return sum(xs) / len(xs)', 'mean of an empty list', { topic: 'empty-input' })

function resultOf(answer: unknown): string {
  return String((answer as { result?: unknown }).result ?? '')
}

sessionTest('Explain shows the issues placed in the code in focus', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [`${FOLDER}/findings.json`]: ledgerOf(EMPTY_INPUT) } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  await $.command.run(typed('backseat', 'explain stats.py:2'))
  await session.clock.advance(7000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-explain' })
  expect(await ui.find({ type: 'Text', text: 'Issue: high · line 2  mean of an empty list' })).toBeDefined()
  await ui.unmount()
})

sessionTest("the issue tool lists the issues with their ids, and keeps the reviewer's verdict on a contested one", async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [`${FOLDER}/findings.json`]: ledgerOf(EMPTY_INPUT, issue(2, 'low', 'stats.py', 1, 'def mean(xs):', 'xs says little', { status: 'dismissed', statusBy: 'person' })) } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  const listed = resultOf(await $.tool.call({ tool: 'mcp__backseat-driver__issue' }))
  expect(listed).toMatch('1. [high, bug] stats.py:2 (empty-input) mean of an empty list')
  expect(listed).not.toMatch('xs says little')
  expect(listed).toMatch('Audited')

  // The reviewer weighed it lower on a second look.
  const ruled = resultOf(await $.tool.call({ tool: 'mcp__backseat-driver__issue', id: 1, status: 'open', severity: 'medium', note: 'callers never pass an empty list' }))
  expect(ruled).toBe('Issue 1 (mean of an empty list) is now open, medium: callers never pass an empty list. The pane shows it.')
  expect(parseLedger(session.data(`${FOLDER}/findings.json`)).findings[0]).toMatchObject({ severity: 'medium', statusBy: 'review', statusNote: 'callers never pass an empty list' })
  // What the person dismissed stands.
  expect(resultOf(await $.tool.call({ tool: 'mcp__backseat-driver__issue', id: 2, status: 'open', note: 'it is real' }))).toBe('Issue 2 was not changed: they dismissed it, and that stands.')
  expect(resultOf(await $.tool.call({ tool: 'mcp__backseat-driver__issue', id: 9, status: 'resolved' }))).toBe('There is no issue 9.')
})

sessionTest("a commit review adopts the play-by-play's open bug as an issue, and the note leaves the pane", async ($, on) => {
  const session = stubSession(on)
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'What does this do for an empty list?' }], issues: [], working_on: '' })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'note-1' })).toBeDefined()

  session.commit('Add mean')
  await session.clock.advance(2000)
  const asked = session.spawned.at(-1)?.prompt ?? ''
  expect(asked).toMatch('Bugs and risks the play-by-play raised in these files that are still open.')
  expect(asked).toMatch('- [bug] stats.py:2 (empty-input) What does this do for an empty list?')
  const fence = ['```backseat-findings', JSON.stringify({ file: 'stats.py', line: 2, quote: 'return sum(xs) / len(xs)', severity: 'high', category: 'bug', topic: 'empty-input', title: 'mean of an empty list', text: 'An empty list divides by zero.', condition: '' }), '```'].join('\n')
  await $.turn.complete(session.finish(session.spawned.length, `The mean has no answer for an empty list.\n\n${fence}`))
  await session.clock.settle()

  expect(parseLedger(session.data(`${FOLDER}/findings.json`)).findings.map(finding => [finding.id, finding.title, finding.status])).toEqual([[1, 'mean of an empty list', 'open']])
  // One record: the note left the pane, and the issue stands in its place.
  expect(await ui.find({ key: 'note-1' })).toBeUndefined()
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ key: 'issue-1' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Raised while you worked' })).toBeUndefined()
  await ui.unmount()
})

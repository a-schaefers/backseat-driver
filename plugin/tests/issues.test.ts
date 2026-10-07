import { expect } from 'claude-code/testing'

import { projectId } from '../core/datahome'
import { coverageLine, parseLedger } from '../core/findings'
import { parseProject } from '../core/project'
import { clockTime } from '../core/status'
import { PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const FOLDER = `projects/${projectId(ROOT)}`
const UNAUDITED = { [`${FOLDER}/project.json`]: { v: 1, root: ROOT, isSurveyed: true, isAudited: false } }

/** A reviewer's fence of issues, one object a line. */
function fence(...lines: unknown[]): string {
  return ['```backseat-findings', ...lines.map(line => JSON.stringify(line)), '```'].join('\n')
}

const EMPTY_INPUT = {
  file: 'stats.py',
  line: 2,
  quote: 'return sum(xs) / len(xs)',
  severity: 'high',
  category: 'bug',
  topic: 'empty-input',
  title: 'mean of an empty list',
  text: 'An empty list divides by zero: a precondition nobody checks.',
  condition: '',
}
const NAMING = { file: 'stats.py', line: 1, quote: 'def mean(xs):', severity: 'low', category: 'quality', topic: 'naming', title: 'xs says little', text: 'A name that says what the list holds reads better.', condition: '' }

/** One open issue on record, as an audit left it. */
const ON_RECORD = {
  v: 1,
  nextId: 2,
  findings: [
    { id: 1, file: 'stats.py', line: 2, lineText: 'return sum(xs) / len(xs)', severity: 'high', category: 'bug', topic: 'empty-input', title: 'mean of an empty list', text: 'Divides by zero.', condition: '', origin: 'audit', commit: '0000000', at: 1, status: 'open', statusAt: 1, statusBy: 'review', statusNote: '', isPinned: false },
  ],
  coverage: { at: 1000, commit: '0000000', files: 1, read: ['stats.py'], skipped: [] },
}

sessionTest('an unaudited project gets one audit, and its issues fill the Deep review tab, worst first', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: UNAUDITED })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  expect(session.spawned.length).toBe(1)
  expect(session.spawned[0]?.prompt).toMatch('Audit this project for issues.')
  expect(session.spawned[0]?.prompt).toMatch('- stats.py')
  // Marked when it starts, so that one that fails is not started again at every switch-on.
  expect(parseProject(session.data(`${FOLDER}/project.json`), ROOT).isAudited).toBe(true)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  // The kit's clock starts at 0, so the banner has no time to name yet.
  expect(await ui.find({ type: 'Text', text: 'Auditing this project.' })).toBeDefined()

  await $.turn.complete(session.finish(1, ['I read stats.py. The mean has no answer for an empty list.', '', fence(EMPTY_INPUT, NAMING, { read: ['stats.py'], skipped: [] })].join('\n')))
  await session.clock.settle()
  const ledger = parseLedger(session.data(`${FOLDER}/findings.json`))
  expect(ledger.findings.map(finding => [finding.id, finding.severity, finding.line, finding.status])).toEqual([
    [1, 'high', 2, 'open'],
    [2, 'low', 1, 'open'],
  ])
  // The tab leads with what was read, the counts, and the worst issue; the low one is folded.
  expect(await ui.find({ type: 'Text', text: coverageLine(ledger.coverage, clockTime) })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Open: 1 high, 1 low' })).toBeDefined()
  expect((await ui.find({ key: 'issue-1' }))?.props.label).toBe('❯ high · stats.py:2')
  expect(await ui.find({ type: 'Text', text: 'mean of an empty list' })).toBeDefined()
  expect(await ui.find({ key: 'issue-2' })).toBeUndefined()
  await ui.press({ key: 'issues-low' })
  expect((await ui.find({ key: 'issue-2' }))?.props.label).toBe('  low · stats.py:1')
  expect(await ui.find({ type: 'Text', text: 'xs says little' })).toBeDefined()
  // The person never reads the fence.
  expect((await ui.find({ key: 'review' }))?.props.text).toBe('I read stats.py. The mean has no answer for an empty list.')
  // Kept in the history by its subject, naming no commit: it reviewed nobody's commit.
  const kept = session.data(`${FOLDER}/reviews.json`) as { commit: string; subject: string }[]
  expect(kept.map(review => [review.commit, review.subject])).toEqual([['', 'an audit of this project']])

  // Elsewhere the tab's badge counts the serious ones, and the empty play-by-play says what is open.
  await ui.press({ key: 'tab-play' })
  expect(await ui.find({ key: 'tab-review', text: 'Review (1)' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'The deep review has 1 high open: 2: Deep review.' })).toBeDefined()
  await ui.unmount()

  // Switched off and on: no second audit.
  await $.command.run(typed('backseat', 'off'))
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  expect(session.spawned.length).toBe(1)
})

sessionTest("an audit is told which code is someone else's: a vendored folder, a minified file, a file too large to be hand-written", async ($, on) => {
  const head = { 'stats.py': MEAN, 'web/viewer.js': `${'x'.repeat(210_000)}\n`, 'web/app.js': 'run()\n', 'lib/node_modules/left/pad.js': 'pad()\n', 'js/chart.min.js': 'x\n' }
  const session = stubSession(on, { head, data: UNAUDITED })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  const prompt = session.spawned[0]?.prompt ?? ''
  expect(prompt).toMatch('Their source files, as git lists them:\n- stats.py\n- web/app.js\n')
  // The vendored folder itself, never the folder above it, which holds their own code too; a file by its name or its size.
  expect(prompt).toMatch('Folders and files that look generated or vendored. Do not audit them; a known-vulnerable version of what is in one is one issue:\n- web/viewer.js\n- lib/node_modules/\n- js/chart.min.js')
})

sessionTest('a commit review rules on the issues on record in its files, and adds its own', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [`${FOLDER}/findings.json`]: ON_RECORD } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', 'def mean(xs):\n    if not xs:\n        raise ValueError("empty")\n    return sum(xs) / len(xs)\n')
  session.commit('Refuse an empty list')
  await session.clock.advance(2000)
  expect(session.spawned[0]?.prompt).toMatch('Issues on record here, with their ids.')
  expect(session.spawned[0]?.prompt).toMatch('1. [high, bug] stats.py:2 (empty-input) mean of an empty list')

  const raised = { ...EMPTY_INPUT, line: 3, quote: 'raise ValueError("empty")', severity: 'low', category: 'quality', topic: 'error-message', title: 'the message says little', text: 'An error that names what was empty helps the caller.' }
  await $.turn.complete(session.finish(1, ['It refuses an empty list now.', '', fence({ id: 1, status: 'resolved', note: 'an empty list raises' }, raised)].join('\n')))
  await session.clock.settle()
  const ledger = parseLedger(session.data(`${FOLDER}/findings.json`))
  expect(ledger.findings.map(finding => [finding.id, finding.status, finding.statusBy])).toEqual([
    [1, 'resolved', 'review'],
    [2, 'open', 'review'],
  ])
})

sessionTest('dismissing an issue in a session that does not drive takes it out of every view, and it can come back', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [`${FOLDER}/lease.json`]: { v: 1, session: 'someone-else', at: 0 }, [`${FOLDER}/findings.json`]: ON_RECORD } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ key: 'issue-1' })).toBeDefined()
  // A session that does not drive audits nothing.
  expect(await ui.find({ key: 'audit' })).toBeUndefined()

  await ui.press({ key: 'issue-dismiss' })
  await session.clock.settle()
  expect(parseLedger(session.data(`${FOLDER}/findings.json`)).findings[0]?.status).toBe('dismissed')
  expect(await ui.find({ key: 'issue-1' })).toBeUndefined()
  expect((await ui.find({ key: 'issues-closed' }))?.props.label).toBe('▸ Closed (1)')
  await ui.press({ key: 'issues-closed' })
  await ui.press({ key: 'issue-restore-1' })
  await session.clock.settle()
  expect(parseLedger(session.data(`${FOLDER}/findings.json`)).findings[0]?.status).toBe('open')
  expect(await ui.find({ key: 'issue-1' })).toBeDefined()
  await ui.unmount()
})

sessionTest(
  'before any audit the pane says so, and a press audits the codebase',
  { options: { deep_review_after_commit: false } },
  async ($, on) => {
    const session = stubSession(on, { head: { 'stats.py': MEAN }, data: UNAUDITED })
    await $.session.start(SESSION)
    await $.command.run(typed('backseat'))
    await session.clock.settle()
    // Deep reviews only on request: nothing audits by itself.
    expect(session.spawned.length).toBe(0)
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: 'Not audited for issues yet: 2: Deep review.' })).toBeDefined()
    await ui.press({ key: 'tab-review' })
    expect(await ui.find({ type: 'Text', text: 'Not audited for issues yet. a: audit the codebase.' })).toBeDefined()
    await ui.press({ key: 'audit' })
    await session.clock.settle()
    expect(session.spawned.length).toBe(1)
    expect(session.spawned[0]?.prompt).toMatch('Audit this project for issues.')
    await ui.unmount()
  },
)

sessionTest('the conversation is told the worst open issues and what was read, and e asks about one without the fix', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { [`${FOLDER}/findings.json`]: ON_RECORD } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  await $.prompt.submit({ text: 'is my code healthy?', wait: false, origin: { kind: 'composer' } })
  const brief = (session.contexts[0] ?? []).find(part => part.startsWith('Issues on record:')) ?? ''
  expect(brief).toMatch('Issues on record: 1 high open. Audited')
  expect(brief).toMatch('- [high] stats.py:2: mean of an empty list')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  await ui.press({ key: 'issue-explain' })
  await session.clock.settle()
  expect(session.submitted.at(-1)).toMatch("Explain the issue the deep review found at stats.py:2: mean of an empty list. Divides by zero. What is the idea behind it, and why does it matter here? Don't write the fix.")
  await ui.unmount()
})

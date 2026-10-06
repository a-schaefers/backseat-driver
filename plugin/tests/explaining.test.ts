import { expect, test } from 'claude-code/testing'

import { projectId } from '../core/datahome'
import { NO_VIEW, SETTLE_MS } from '../core/explainer'
import { describeSpot, parseFocusFile, parseTarget, relativeTo, viewText } from '../core/focus'
import { FORGET, SCOPE_PROJECT } from '../core/forget'
import { detailMarkdown, explainNotice, outlineLine, tabRow } from '../hooks/pane'
import { explainAsk, explainContext } from '../core/prompts'
import type { ExplainView, Review } from '../types'
import { DATA_HOME, PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

const STATS = [
  'def mean(xs):',
  '    return sum(xs) / len(xs)',
  '',
  '',
  'def variance(xs):',
  '    m = mean(xs)',
  '    return sum((x - m) ** 2 for x in xs) / len(xs)',
  '',
].join('\n')

const OUTLINE = {
  summary: 'Small statistics helpers.',
  symbols: [
    { name: 'mean', kind: 'function', start: 1, end: 2, head: 'def mean(xs):', summary: 'The average of a list.' },
    { name: 'variance', kind: 'function', start: 5, end: 7, head: 'def variance(xs):', summary: 'How spread out a list is.' },
  ],
}
const ABOUT_MEAN = { what: 'The average.', how: 'Sum over count.', why: 'Variance needs it.', watch: 'Fails on an empty list.', uses: [] }
const ABOUT_VARIANCE = { what: 'How spread out the values are.', how: 'Mean squared distance.', why: 'For the deviation.', watch: '', uses: ['mean'] }

/** The explain model, answering each request by what it asks. */
function answers(session: ReturnType<typeof stubSession>): void {
  session.explain(OUTLINE, 'Map this file.')
  session.explain(ABOUT_MEAN, 'Explain mean')
  session.explain(ABOUT_VARIANCE, 'Explain variance')
}

/** What the explain model was asked, in order, in a few words each. */
function asked(session: ReturnType<typeof stubSession>): (string | undefined)[] {
  return session.lookups.map(request => /Map this file\.|Explain [\w ]+?(?=,|\.)/.exec(request.prompt)?.[0])
}

const VIEW: ExplainView = {
  spot: { path: 'stats.py', line: 6 },
  status: 'fresh',
  fileSummary: 'Small statistics helpers.',
  outline: [
    { name: 'mean', kind: 'function', startLine: 1, endLine: 2, summary: 'The average of a list.' },
    { name: 'variance', kind: 'function', startLine: 5, endLine: 7, summary: 'How spread out a list is.' },
  ],
  isOutlineCurrent: true,
  isMappable: true,
  target: { name: 'variance', kind: 'function', startLine: 5, endLine: 7, summary: 'How spread out a list is.' },
  detail: { ...ABOUT_VARIANCE },
  insights: [],
}

test('relativeTo and the two ways a spot is named', async () => {
  expect(relativeTo('/work', '/work/src/a.py')).toBe('src/a.py')
  expect(relativeTo('/work/', './src/a.py')).toBe('src/a.py')
  expect(relativeTo('/work', '/elsewhere/a.py')).toBe(null)
  expect(relativeTo('/work', '/workshop/a.py')).toBe(null)
  expect(relativeTo('/work', '../secrets')).toBe(null)
  expect(relativeTo('/work', 'src/../../secrets')).toBe(null)
  // A commit message written in the editor is in the repository's own folder, not in the project.
  expect(relativeTo('/work', '/work/.git/COMMIT_EDITMSG')).toBe(null)
  expect(relativeTo('/work', '/work/vendor/.git/config')).toBe(null)
  expect(relativeTo('/work', '/work/.gitignore')).toBe('.gitignore')
  expect(relativeTo('/work', '')).toBe(null)

  expect(parseTarget('stats.py', '/work')).toEqual({ path: 'stats.py', line: 1 })
  expect(parseTarget(' src/a.py:42 ', '/work')).toEqual({ path: 'src/a.py', line: 42 })
  expect(parseTarget('/work/src/a.py:10-20', '/work')).toEqual({ path: 'src/a.py', line: 10, endLine: 20 })
  expect(parseTarget('/etc/passwd:1', '/work')).toBe(null)
  expect(parseTarget('', '/work')).toBe(null)

  expect(parseFocusFile('{"file": "/work/stats.py", "line": 6}', '/work')).toEqual({ path: 'stats.py', line: 6 })
  expect(parseFocusFile('{"file": "/work/stats.py", "line": 6, "endLine": 9, "column": 3}', '/work')).toEqual({ path: 'stats.py', line: 6, endLine: 9 })
  // Another project's file, a line that is not one, and a file caught half-written.
  expect(parseFocusFile('{"file": "/other/stats.py", "line": 6}', '/work')).toBe(null)
  expect(parseFocusFile('{"file": "/work/stats.py", "line": 0}', '/work')).toBe(null)
  expect(parseFocusFile('{"file": "/work/sta', '/work')).toBe(null)

  expect(describeSpot({ path: 'a.py', line: 3 })).toBe('a.py, line 3')
  expect(describeSpot({ path: 'a.py', line: 3, endLine: 9 })).toBe('a.py, lines 3 to 9')
})

test('viewText is what the tutor is told, and it says nothing when there is nothing', async () => {
  expect(viewText(VIEW)).toBe(
    [
      'stats.py: Small statistics helpers.',
      'variance (function, lines 5 to 7): How spread out a list is.',
      'What: How spread out the values are.',
      'How: Mean squared distance.',
      'Why: For the deviation.',
      'Relies on: mean',
    ].join('\n'),
  )
  // Between symbols, the file's outline stands in.
  expect(viewText({ ...VIEW, target: null, detail: null })).toMatch('In this file:\n- mean (function, line 1): The average of a list.')
  expect(viewText(NO_VIEW)).toBe('')
  expect(viewText({ ...VIEW, status: 'no-file' })).toBe('')

  expect(explainContext(VIEW)).toMatch("The pane's Explain tab is on stats.py, line 6. It shows:\nstats.py: Small")
  expect(explainContext(NO_VIEW)).toBe('')
  expect(explainAsk(VIEW)).toBe('Tell me more about variance in stats.py (lines 5 to 7).')
  expect(explainAsk({ ...VIEW, target: null })).toBe('Tell me more about stats.py.')
})

test('the pane: what the Explain tab says while it is not the whole story', async () => {
  expect(explainNotice(VIEW)).toBe('')
  expect(explainNotice({ ...VIEW, status: 'updating', isOutlineCurrent: false })).toBe('Mapping this file.')
  expect(explainNotice({ ...VIEW, status: 'updating' })).toBe('Looking this up.')
  expect(explainNotice({ ...VIEW, status: 'waiting' })).toMatch('Lookups are on request')
  expect(explainNotice({ ...VIEW, status: 'failed' })).toMatch('The last lookup failed.')
  expect(explainNotice({ ...VIEW, status: 'off' })).toMatch('switched off')

  expect(detailMarkdown({ ...ABOUT_VARIANCE })).toBe(
    '**What** How spread out the values are.\n\n**How** Mean squared distance.\n\n**Why** For the deviation.\n\n**Relies on** mean',
  )
})

test('the outline gives each symbol one line, however long its summary', async () => {
  const row = { name: 'variance', kind: 'function', startLine: 5, endLine: 7, summary: 'Computes the mean squared deviation from the mean, then subtracts one from the result.' }
  expect(outlineLine(row, true, 60)).toBe('> variance  Computes the mean squared deviation from the me…')
  expect(outlineLine(row, true, 60).length).toBe(60)
  expect(outlineLine(row, false, 200)).toBe(`  variance  ${row.summary}`)
  // No room for a summary worth reading: the name alone.
  expect(outlineLine(row, false, 20)).toBe('  variance')
  expect(outlineLine({ ...row, summary: '' }, false, 60)).toBe('  variance')
})

test('the tabs keep to one line: full names when they fit, short ones when they do not', async () => {
  const seen: Review = { state: 'none', subject: '', text: '', isUnseen: false, decisions: [], insights: [] }
  expect(tabRow({ columns: 90, review: seen })).toEqual({ labels: ['Play-by-play', 'Deep review', 'Explain', 'Growth', 'Lessons', 'Settings'], gap: 3 })
  expect(tabRow({ columns: 84, review: seen }).gap).toBe(3)
  expect(tabRow({ columns: 83, review: seen })).toEqual({ labels: ['Play', 'Review', 'Explain', 'Growth', 'Lessons', 'Settings'], gap: 2 })
  expect(tabRow({ columns: 60, review: { ...seen, isUnseen: true, decisions: [], insights: [] } }).labels[1]).toBe('Review (new)')
  expect(tabRow({ columns: 90, review: { ...seen, isUnseen: true, decisions: [], insights: [] } }).labels[1]).toBe('Deep review (new)')
})

sessionTest('saving a file maps it once it has settled, and the Explain tab follows the save', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': 'x = 1\n' } })
  answers(session)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', STATS)
  await session.clock.advance(2000)
  // Seen, but not mapped while it may still be being typed.
  expect(session.lookups.length).toBe(0)
  await session.clock.advance(SETTLE_MS + 2000)

  expect(session.lookups[0]?.model).toBe('sonnet')
  expect(session.lookups[0]?.effort).toBe('low')
  // Both functions are new, so both are explained ahead of being asked about.
  expect(asked(session)).toEqual(['Map this file.', 'Explain mean', 'Explain variance'])
  // None of it went to the play-by-play's model, or into the conversation.
  expect(session.submitted).toEqual([])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-explain' })
  expect(await ui.find({ type: 'Text', text: 'stats.py · mean' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'In this file' })).toBeDefined()
  expect((await ui.find({ key: 'explanation' }))?.props.text).toMatch('**What** The average.')

  // n moves to the next symbol. Its explanation is already there: no request.
  await ui.press({ key: 'explain-next' })
  expect(await ui.find({ type: 'Text', text: 'stats.py · variance' })).toBeDefined()
  expect((await ui.find({ key: 'explanation' }))?.props.text).toMatch('**Relies on** mean')
  expect(asked(session).length).toBe(3)

  // A row of the outline is a button too: back to mean by its line (owner, 2026-10-05: "n and p they should be clickable as well").
  await ui.press({ key: 'explain-row-1' })
  expect(await ui.find({ type: 'Text', text: 'stats.py · mean' })).toBeDefined()
  await ui.press({ key: 'explain-next' })
  // e takes it to the conversation, naming the spot so that the tutor can look it up.
  await ui.press({ key: 'explain-ask' })
  expect(session.submitted).toEqual(['Tell me more about variance in stats.py (lines 5 to 7).'])
  await ui.unmount()

  // A question the person types is sent with what the tab shows, so "why is this here?" means something.
  await $.prompt.submit({ text: 'why is this here?', wait: false, origin: { kind: 'composer' } })
  expect(session.contexts[1]?.some(context => context.startsWith("The pane's Explain tab is on stats.py, line 5. It shows:"))).toBe(true)

  // What was learned is on disk, under this project.
  const entries = [...session.disk.keys()].filter(path => path.startsWith(`${DATA_HOME}/projects/${projectId(ROOT)}/files/`))
  expect(entries.length).toBe(1)
  expect(entries[0]).toMatch(/-stats\.py\.json$/)
})

sessionTest('/bsd explain turns the pane to a spot and looks it up', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS } })
  answers(session)
  await $.session.start(SESSION)
  expect((await $.command.run(typed('bsd', 'explain stats.py:6'))).text).toBe('Backseat Driver is off. Run /bsd to start it.')
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect((await $.command.run(typed('bsd', 'explain nowhere/../../x.py'))).text).toBe('That is not a file in this project: nowhere/../../x.py')
  expect((await $.command.run(typed('bsd', 'explain'))).text).toBe('Name a file and a line: /bsd explain src/app.py:42')

  const answer = await $.command.run(typed('bsd', 'explain stats.py:6'))
  expect(answer.text).toBe('Explaining stats.py, line 6 in the pane.')
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // The command switched to the tab.
  expect(await ui.find({ type: 'Text', text: 'stats.py · variance' })).toBeDefined()
  expect((await ui.find({ key: 'explanation' }))?.props.text).toMatch('How spread out the values are.')
  await ui.unmount()
})

sessionTest('an editor moves the focus by writing a file, and the tutor answers in another', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS } })
  answers(session)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.editor(`${ROOT}/stats.py`, 6)
  await session.clock.advance(2000)
  const first = session.data('view.json') as { v: number; root: string; source: string; spot: { path: string; line: number }; target: { name: string } | null; detail: { what: string } | null }
  expect(first.v).toBe(1)
  expect(first.root).toBe(ROOT)
  expect(first.source).toBe('editor')
  expect(first.spot).toEqual({ path: 'stats.py', line: 6 })
  expect(first.target?.name).toBe('variance')
  expect(first.detail?.what).toBe('How spread out the values are.')

  // Once an editor is there, its file is checked ten times a second.
  session.editor(`${ROOT}/stats.py`, 2)
  await session.clock.advance(100)
  const second = session.data('view.json') as typeof first
  expect(second.spot.line).toBe(2)
  expect(second.target?.name).toBe('mean')

  // A cursor in another project's file is not this session's business.
  session.editor('/other/project/x.py', 1)
  await session.clock.advance(100)
  expect((session.data('view.json') as typeof first).spot.path).toBe('stats.py')

  // A save does not pull the focus away from an editor that is reporting its cursor.
  session.write('other.py', 'y = 2\n')
  await session.clock.advance(2000)
  expect((session.data('view.json') as typeof first).spot.path).toBe('stats.py')
})

sessionTest('the lookup tool answers from the same cache, and turns the tab to the spot', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS } })
  answers(session)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.tools.map(tool => tool.name)).toContain('lookup')

  // It answers the moment the lookups land: the clock does not have to move for it.
  const call = $.tool.call({ tool: 'mcp__backseat-driver__lookup', file: `${ROOT}/stats.py`, line: 6 })
  const answer = String(((await call) as { result: unknown }).result)
  expect(answer).toMatch('variance (function, lines 5 to 7): How spread out a list is.')
  expect(answer).toMatch('What: How spread out the values are.')

  // Asked again, it is instant: nothing new goes to the model.
  const before = session.lookups.length
  const again = await $.tool.call({ tool: 'mcp__backseat-driver__lookup', file: 'stats.py', line: 6 })
  expect(String((again as { result: unknown }).result)).toBe(answer)
  expect(session.lookups.length).toBe(before)

  expect(await $.tool.call({ tool: 'mcp__backseat-driver__lookup', file: '/etc/passwd' })).toEqual({ result: 'That file is not in this project.' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-explain' })
  expect(await ui.find({ type: 'Text', text: 'stats.py · variance' })).toBeDefined()
  await ui.unmount()
})

sessionTest('with Explain off, nothing is looked up and the tab says so', { options: { explain: 'off' } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${STATS}# more\n`)
  await session.clock.advance(SETTLE_MS + 4000)

  expect(session.lookups).toEqual([])
  expect((await $.command.run(typed('bsd', 'explain stats.py:6'))).text).toBe('Explain is switched off. Its setting is in /config.')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-explain' })
  expect(await ui.find({ type: 'Text', text: 'Nothing in focus yet.' })).toBeDefined()
  await ui.unmount()
})

sessionTest('on request, a save is shown but not looked up until f is pressed', { options: { explain: 'on request' } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': 'x = 1\n' } })
  answers(session)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', STATS)
  await session.clock.advance(SETTLE_MS + 4000)
  expect(session.lookups).toEqual([])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-explain' })
  expect(await ui.find({ type: 'Text', text: 'Not looked up yet. Lookups are on request: f fetches this.' })).toBeDefined()
  await ui.press({ key: 'explain-fetch' })
  expect(session.lookups[0]?.prompt).toMatch('Map this file.')
  // Nothing is explained ahead of being asked for.
  expect(session.lookups.filter(request => request.prompt.includes('Explain')).length <= 1).toBe(true)
  await ui.unmount()
})

sessionTest('near the plan limit, a saved file is not mapped until someone asks about it', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': 'x = 1\n' } })
  session.limits.push({ kind: 'five_hour', percentUsed: 85 })
  answers(session)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', STATS)
  await session.clock.advance(SETTLE_MS + 6000)
  // A save is followed, but following is not asking.
  expect(session.lookups).toEqual([])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-explain' })
  expect(await ui.find({ type: 'Text', text: 'Not looked up: you are close to your plan limit. f fetches this anyway.' })).toBeDefined()
  await ui.unmount()

  // Asking is: the file is mapped and the spot explained. Nothing else is explained ahead.
  await $.command.run(typed('bsd', 'explain stats.py:6'))
  await session.clock.settle()
  expect(asked(session)).toEqual(['Map this file.', 'Explain variance'])
})

sessionTest('forgetting this project empties what Explain knows about it', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS } })
  answers(session)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await $.command.run(typed('bsd', 'explain stats.py:6'))
  await session.clock.settle()
  const files = `${DATA_HOME}/projects/${projectId(ROOT)}/files/`
  expect([...session.disk.keys()].some(path => path.startsWith(files))).toBe(true)

  session.answers.push(SCOPE_PROJECT, FORGET)
  await $.command.run(typed('bsd', 'forget'))
  await session.clock.settle()
  expect([...session.disk.keys()].some(path => path.startsWith(files))).toBe(false)

  // Asked again, it starts from nothing: the file is mapped anew.
  const before = session.lookups.length
  await $.command.run(typed('bsd', 'explain stats.py:6'))
  await session.clock.settle()
  expect(session.lookups[before]?.prompt).toMatch('Map this file.')
})

sessionTest('with the Explain tab open, an edit takes the old explanation off the screen in a tenth of a second', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS } })
  answers(session)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await $.command.run(typed('bsd', 'explain stats.py:6'))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'explanation' }))?.props.text).toMatch('How spread out the values are.')
  const before = session.lookups.length

  // The body of variance changes. The watcher's own poll is up to two seconds away.
  session.write('stats.py', STATS.replace('** 2 for', '** 3 for'))
  await session.clock.advance(100)
  expect(await ui.find({ key: 'explanation' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Mapping this file.' })).toBeDefined()
  // The function that did not change is still listed. The one that did is not.
  // The outline is a table: the name is the row's button, the summary a dim text beside it.
  expect((await ui.find({ key: 'explain-row-1' }))?.props.label).toBe('▸ mean')
  expect(await ui.find({ type: 'Text', text: 'The average of a list.' })).toBeDefined()
  expect((await ui.findAll({ type: 'Text', text: 'stats.py · variance' })).length).toBe(0)
  // And nothing is asked of the model while the file may still be being typed.
  expect(session.lookups.length).toBe(before)

  await session.clock.advance(SETTLE_MS + 2000)
  expect(session.lookups.length > before).toBe(true)
  await ui.unmount()
})

sessionTest('after a reload the Explain tab is still on the spot it was showing', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS } })
  answers(session)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await $.command.run(typed('bsd', 'explain stats.py:6'))
  await session.clock.settle()
  const before = session.lookups.length

  // What a reload does: the module starts over and `session.start` fires again. `$.state` is kept.
  await $.session.start(SESSION)
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'stats.py · variance' })).toBeDefined()
  expect((await ui.find({ key: 'explanation' }))?.props.text).toMatch('How spread out the values are.')
  // Read back from disk: nothing was asked again.
  expect(session.lookups.length).toBe(before)
  await ui.unmount()
})

sessionTest('a saved file is mapped the moment it has stayed unchanged long enough, whenever the next scan is', { options: { play_by_play: 'on request', animated_persona: false, progress_report: false } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS } })
  answers(session)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  const mapped = (): number => asked(session).filter(what => what === 'Map this file.').length
  const before = mapped()

  // The scan a second in sees the save. Scans are then a second apart, and the file has settled between two of them.
  session.write('stats.py', `${STATS}\n# more\n`)
  await session.clock.advance(1000)
  await session.clock.advance(SETTLE_MS - 1)
  expect(mapped()).toBe(before)
  await session.clock.advance(1)
  expect(mapped()).toBe(before + 1)
})

sessionTest('the lookup tool gives up waiting after six seconds and says more is coming', { options: { play_by_play: 'on request', animated_persona: false, progress_report: false } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS } })
  // No answer is ready for the model: its lookups stay open.
  session.stall('explain')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  let answer = ''
  const call = $.tool.call({ tool: 'mcp__backseat-driver__lookup', file: 'stats.py', line: 6 }).then(reply => {
    answer = String((reply as { result: unknown }).result)
  })
  await session.clock.advance(5999)
  expect(answer).toBe('')
  await session.clock.advance(1)
  await call
  expect(answer).toMatch('More is being looked up and will be in the Explain tab shortly.')
  session.release()
  await session.clock.settle()
})

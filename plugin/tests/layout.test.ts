import { expect, test } from 'claude-code/testing'

import type { Review } from '../types'
import { moreLine, noteMark, previewLine, statusEntry, stripColumns, unifiedTabs } from '../hooks/pane'
import { layoutOf, readSettings } from '../hooks/settings'
import { BAND, HINT, PANE, SESSION, sessionTest, stubSession, typed } from './kit'

const NO_REVIEW: Review = { state: 'none', subject: '', text: '', isUnseen: false, decisions: [], insights: [] }

test('the layout is unified unless /config says otherwise, and a word that is not a layout is no layout', async () => {
  expect(readSettings({}).layout).toBe('unified')
  expect(readSettings({ layout: 'vertical' }).layout).toBe('vertical')
  expect(readSettings({ layout: 'sideways' }).layout).toBe('unified')
  expect(layoutOf(' Horizontal ')).toBe('horizontal')
  expect(layoutOf('pane')).toBe(null)
})

test('the horizontal layout splits into two columns only where both have room', async () => {
  expect(stripColumns(160)).toEqual({ side: 48, body: 105 })
  expect(stripColumns(100)).toEqual({ side: 33, body: 60 })
  // Too narrow for a side column and a tab beside it: the parts stack inside the frame.
  expect(stripColumns(80)).toBe(null)
})

test('the unified layout says each note in one line, marked by its kind, and how many it leaves out', async () => {
  const note = { id: 1, file: 'stats.py', line: 5, kind: 'decision', topic: 'even', text: 'Your call.' } as const
  expect(previewLine(note)).toBe('stats.py:5  Your call.')
  expect(noteMark(note)).toEqual({ mark: '◆', color: 'magenta' })
  expect(noteMark({ kind: 'bug' }).mark).toBe('!')
  expect(noteMark({ kind: 'tip' }).mark).toBe('·')
  expect(moreLine(3)).toBe('')
  expect(moreLine(4)).toBe('One more note. 1 opens the play-by-play.')
  expect(moreLine(6)).toBe('3 more notes. 1 opens the play-by-play.')
  expect(unifiedTabs({ review: { ...NO_REVIEW, isUnseen: true }, notes: [{ ...note }] })).toEqual(['Play (1)', 'Review (new)', 'Explain', 'Progress'])
  expect(statusEntry({ mode: 'paused', watch: { state: 'idle', lastLookAt: null, line: 'On.' } })).toBe('Backseat: Paused. /bsd resume to continue.')
})

sessionTest('unified, the default, opens no pane: it draws above the prompt and ends the hint line', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  const quiet = await $.ui.mount({ ...BAND, surface: 'terminal' })
  // Off, the band is Claude Code's own.
  expect(await quiet.find({ key: 'tab-play' })).toBeUndefined()
  await quiet.unmount()

  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.opened).toEqual([])

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ key: 'tab-play' })).toBeDefined()
  // Folded, no tab's contents are drawn.
  expect(await band.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeUndefined()
  await band.unmount()

  const hint = await $.ui.mount({ ...HINT, surface: 'terminal' })
  expect(JSON.stringify(await hint.drawn())).toContain('Backseat: On. Watching for your next save.')
  await hint.unmount()

  await $.command.run(typed('bsd', 'off'))
  const after = await $.ui.mount({ ...HINT, surface: 'terminal' })
  expect(JSON.stringify(await after.drawn())).not.toContain('Backseat:')
  await after.unmount()
})

sessionTest('unified, a tab key opens the tab above the prompt, and the same key or x folds it', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.press({ key: 'tab-play' })
  expect(await band.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
  expect(await band.find({ key: 'fold' })).toBeDefined()

  await band.press({ key: 'tab-play' })
  expect(await band.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeUndefined()

  await band.press({ key: 'tab-review' })
  expect(await band.find({ type: 'Text', text: 'No deep review yet.' })).toBeDefined()
  await band.press({ key: 'fold' })
  expect(await band.find({ type: 'Text', text: 'No deep review yet.' })).toBeUndefined()
  await band.unmount()
})

sessionTest('unified, the open notes show above the prompt one line each', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': 'def mean(xs):\n    return sum(xs) / len(xs)\n' } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', 'def mean(xs):\n    return sum(xs) / len(xs)\n\n\ndef total(xs):\n    return sum(xs)\n')
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty', note: 'An empty list divides by zero.' }], working_on: '' })
  await session.clock.advance(15_000)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: 'stats.py:2  An empty list divides by zero.' })).toBeDefined()
  expect((await band.find({ key: 'tab-play' }))?.props.label).toBe('Play (1)')
  await band.unmount()
})

sessionTest('horizontal draws the whole view in a frame above the prompt, and opens no pane', { options: { layout: 'horizontal' } }, async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.opened).toEqual([])

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(JSON.stringify(await band.drawn())).toContain('"borderStyle":"round"')
  expect(await band.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
  await band.press({ key: 'tab-review' })
  expect(await band.find({ type: 'Text', text: 'No deep review yet.' })).toBeDefined()
  await band.unmount()

  const hint = await $.ui.mount({ ...HINT, surface: 'terminal' })
  expect(JSON.stringify(await hint.drawn())).not.toContain('Backseat:')
  await hint.unmount()
})

sessionTest('vertical opens the pane and leaves the band and the hint line to Claude Code', { options: { layout: 'vertical' } }, async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.opened).toEqual(['backseat-driver'])

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ key: 'tab-play' })).toBeUndefined()
  await band.unmount()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
  await pane.unmount()
})

sessionTest('the band gives way to a survey', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })
  expect(await band.find({ key: 'tab-play' })).toBeUndefined()
  await band.unmount()
})

sessionTest('/bsd layout changes the layout in /config, shows it at once, and steps to the next when bare', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const vertical = await $.command.run(typed('bsd', 'layout vertical'))
  expect(vertical.text).toBe('Layout: vertical. It is kept for next time.')
  expect(session.configured).toEqual([{ key: 'backseat-driver.layout', value: 'vertical' }])
  expect(session.opened).toEqual(['backseat-driver'])

  // Bare, it steps on: after vertical comes unified again, and the pane closes.
  const next = await $.command.run(typed('bsd', 'layout'))
  expect(next.text).toBe('Layout: unified. It is kept for next time.')
  expect(session.closed).toEqual(['backseat-driver'])

  const wrong = await $.command.run(typed('bsd', 'layout sideways'))
  expect(wrong.text).toMatch('The layouts are unified, horizontal and vertical')

  session.configDeny = 'set by your organization'
  const denied = await $.command.run(typed('bsd', 'layout horizontal'))
  expect(denied.text).toBe('The layout stays unified: set by your organization')
})

sessionTest('/bsd layout works while the tutor is off, and opens nothing', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)

  const set = await $.command.run(typed('bsd', 'layout vertical'))
  expect(set.text).toBe('Layout: vertical. It is kept for next time. It shows when you run /bsd.')
  expect(session.opened).toEqual([])

  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.opened).toEqual(['backseat-driver'])
})

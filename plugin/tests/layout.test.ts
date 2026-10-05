import { expect, test } from 'claude-code/testing'

import type { Review } from '../types'
import { drawnOrder, hasDigits, moreLine, noteMark, previewCount, previewLine, statusEntry, steppedNote, stripColumns, unifiedTabs } from '../hooks/pane'
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
  // A bug and a risk differ in their mark too, not only in color: Claude Code's own marks for an error and a warning.
  expect(noteMark({ kind: 'bug' }).mark).toBe('✘')
  expect(noteMark({ kind: 'risk' }).mark).toBe('⚠')
  expect(noteMark({ kind: 'tip' }).mark).toBe('·')
  expect(moreLine(3, 3)).toBe('')
  expect(moreLine(4, 3)).toBe('and one more note')
  expect(moreLine(6, 2)).toBe('and 4 more notes')
  expect(previewCount(30)).toBe(2)
  expect(previewCount(48)).toBe(3)
  expect(unifiedTabs({ review: { ...NO_REVIEW, isUnseen: true }, notes: [{ ...note }] })).toEqual(['Play (1)', 'Review (new)', 'Explain', 'Progress', 'Settings'])
})

test('every layout draws the notes in one order, decisions first, and the keys start on the first one drawn', async () => {
  const notes = [
    { id: 1, file: 'a.py', line: 1, kind: 'insight', topic: 'i', text: 'i' },
    { id: 2, file: 'a.py', line: 2, kind: 'bug', topic: 'b', text: 'b' },
    { id: 3, file: 'a.py', line: 3, kind: 'decision', topic: 'd', text: 'd' },
  ] as const
  expect(drawnOrder([...notes]).map(note => note.id)).toEqual([3, 2, 1])
  expect(steppedNote({ notes: [...notes], selected: null }, 1)?.id).toBe(2)
  expect(steppedNote({ notes: [...notes], selected: 3 }, -1)?.id).toBe(1)
})

test('the hint line says what the play-by-play is doing in a word or two, and where the keyboard is', async () => {
  const watch = (state: 'idle' | 'waiting' | 'looking', line: string) => ({ state, lastLookAt: null, line })
  expect(statusEntry({ mode: 'on', watch: watch('idle', 'On. Watching for your next save.') }, false)).toBe('backseat watching · ctrl+x tab for keys')
  expect(statusEntry({ mode: 'paused', watch: watch('idle', 'On.') }, true)).toBe('backseat paused · esc to leave')
  expect(statusEntry({ mode: 'on', watch: watch('looking', 'On. Looking at your changes.') }, false)).toBe('backseat looking… · ctrl+x tab for keys')
  expect(statusEntry({ mode: 'on', watch: watch('waiting', 'On. Claude is overloaded. Next try 12:07.') }, false)).toBe('backseat waiting, next try 12:07 · ctrl+x tab for keys')
})

test('above the prompt the tabs carry their digits only while the band has the keyboard', async () => {
  // Claude Code lets a bare digit in an empty prompt press a band's button: answering Claude with "2" must not open a tab.
  expect(hasDigits({ layout: 'unified', isFocused: false })).toBe(false)
  expect(hasDigits({ layout: 'horizontal', isFocused: true })).toBe(true)
  expect(hasDigits({ layout: 'vertical', isFocused: false })).toBe(true)
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
  expect(JSON.stringify(await hint.drawn())).toContain('backseat watching · ctrl+x tab for keys')
  // The band's tabs carry no digits until it has the keyboard.
  expect((await (await $.ui.mount({ ...BAND, surface: 'terminal' })).find({ key: 'tab-play' }))?.props.hotkey).toBeUndefined()
  await hint.unmount()

  await $.command.run(typed('bsd', 'off'))
  const after = await $.ui.mount({ ...HINT, surface: 'terminal' })
  expect(JSON.stringify(await after.drawn())).not.toContain('backseat')
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
  expect(JSON.stringify(await hint.drawn())).not.toContain('backseat')
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

sessionTest('unified, switching on says where the notes are, and an open tab folds when the conversation goes on', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  const started = await $.command.run(typed('bsd'))
  expect(started.text).toMatch('Notes show above the prompt. Ctrl+X Tab gives it the keyboard')
  await session.clock.settle()

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.press({ key: 'tab-review' })
  expect(await band.find({ type: 'Text', text: 'No deep review yet.' })).toBeDefined()
  await $.prompt.submit({ text: 'what is a median?', wait: false, origin: { kind: 'composer' } })
  expect(await band.find({ type: 'Text', text: 'No deep review yet.' })).toBeUndefined()
  await band.unmount()
})

sessionTest('j and k move between notes in the order they are drawn', { options: { layout: 'vertical' } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': 'def mean(xs):\n    return sum(xs) / len(xs)\n' } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', 'def mean(xs):\n    return sum(xs) / len(xs)\n\n\ndef total(xs):\n    return sum(xs)\n')
  session.reply({
    resolved: [],
    notes: [
      { file: 'stats.py', line: 2, kind: 'bug', topic: 'empty', note: 'An empty list divides by zero.' },
      { file: 'stats.py', line: 5, kind: 'decision', topic: 'total', note: 'What should total of nothing be?' },
    ],
    working_on: '',
  })
  await session.clock.advance(15_000)

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // The decision is drawn first, so the keys start on it.
  expect((await pane.find({ key: 'note-2' }))?.props.label).toMatch(/^❯/)
  await pane.press({ key: 'next-note' })
  expect((await pane.find({ key: 'note-1' }))?.props.label).toMatch(/^❯/)
  await pane.press({ key: 'previous-note' })
  expect((await pane.find({ key: 'note-2' }))?.props.label).toMatch(/^❯/)
  await pane.unmount()
})


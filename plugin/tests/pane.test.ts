import { expect, test } from 'claude-code/testing'

import type { Note } from '../types'
import { NO_VIEW } from '../hooks/explainer'
import { currentNote, detailMarkdown, explainNotice, KEYBOARD_HINT, personaLine, statusLine } from '../hooks/pane'
import type { PaneView } from '../hooks/pane'
import { PANE, SESSION, sessionTest, stubSession, typed } from './kit'

const VIEW: PaneView = {
  progress: { isOn: true, identity: [], records: [], busy: '', skipped: '' },
  update: '',
  mode: 'on',
  tab: 'play',
  persona: { voice: 'default', engineering: 'default' },
  notes: [],
  selected: null,
  watch: { state: 'idle', lastLookAt: null, detail: '' },
  isAutomatic: true,
  review: { state: 'none', subject: '', text: '', isUnseen: false },
  reviewSchedule: 'after each commit',
  profiles: { languages: [], subjects: {} },
  explain: NO_VIEW,
  working: { said: '', saidAgo: '', inferred: '', where: '', share: '' },
  isFocused: true,
  columns: 76,
  character: null,
  isCompact: false,
}

const note = (id: number, overrides: Partial<Note> = {}): Note => ({
  id,
  file: 'a.py',
  line: 1,
  kind: 'risk',
  topic: `topic-${id}`,
  text: `note ${id}`,
  ...overrides,
})

test('statusLine says what the watcher is doing, in what voice and with whose judgment', async () => {
  expect(statusLine(VIEW)).toBe('On. Watching for your next save.')
  expect(statusLine({ ...VIEW, persona: { voice: 'eli5-tldr-kiss-terse', engineering: 'knuth' } })).toBe(
    'On. Watching for your next save. Voice: eli5-tldr-kiss-terse. Engineering: knuth.',
  )
  expect(statusLine({ ...VIEW, isAutomatic: false })).toBe('On. Looking only when you ask.')
  expect(statusLine({ ...VIEW, mode: 'paused' })).toBe('Paused. /bsd resume to continue.')
  expect(statusLine({ ...VIEW, watch: { ...VIEW.watch, state: 'looking' } })).toBe('On. Looking at your changes.')
  expect(statusLine({ ...VIEW, watch: { ...VIEW.watch, state: 'no-git' } })).toMatch('not a git repository')
  expect(statusLine({ ...VIEW, watch: { state: 'failed', lastLookAt: 1, detail: 'rate limit' } })).toBe(
    'On. The last look failed (rate limit). It will try again.',
  )
})

test('personaLine leaves out a half that is the default, and names a persona chosen for both once', async () => {
  expect(personaLine({ voice: 'default', engineering: 'default' })).toBe('')
  expect(personaLine({ voice: 'torvalds', engineering: 'default' })).toBe('Voice: torvalds.')
  expect(personaLine({ voice: 'default', engineering: 'primeagen' })).toBe('Engineering: primeagen.')
  expect(personaLine({ voice: 'knuth', engineering: 'knuth' })).toBe('Voice and engineering: knuth.')
  expect(personaLine({ voice: 'torvalds', engineering: 'knuth' })).toBe('Voice: torvalds. Engineering: knuth.')
})

test('currentNote is the selected note while it is open, otherwise the most important one', async () => {
  const notes = [note(1, { kind: 'tip' }), note(2, { kind: 'bug' })]

  expect(currentNote({ notes, selected: null })?.id).toBe(2)
  expect(currentNote({ notes, selected: 1 })?.id).toBe(1)
  expect(currentNote({ notes, selected: 99 })?.id).toBe(2)
  expect(currentNote({ notes: [], selected: 1 })).toBeUndefined()
})

sessionTest('the pane opens on the play-by-play and switches tabs, on every surface that draws panes', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'On. Watching for your next save.' })).toBeDefined()

    await ui.press({ key: 'tab-review' })
    expect(await ui.find({ type: 'Text', text: 'No deep review yet.' })).toBeDefined()

    await ui.press({ key: 'tab-profile' })
    expect(await ui.find({ type: 'Text', text: 'Judged only on commits by me@example.com, and only on the lines they add.' })).toBeDefined()

    await ui.press({ key: 'tab-play' })
    await ui.unmount()
  }
})

sessionTest('the pane shows a pause', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await $.command.run(typed('bsd', 'pause'))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Paused' })).toBeDefined()
  await ui.unmount()
})

sessionTest('the pane says how to give it the keyboard, until it has it', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const away = await $.ui.mount({ ...PANE, props: { ...PANE.props, isFocused: false }, surface: 'terminal' })
  expect(await away.find({ type: 'Text', text: KEYBOARD_HINT })).toBeDefined()
  await away.unmount()

  const focused = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await focused.findAll({ type: 'Text', text: KEYBOARD_HINT })).length).toBe(0)
  await focused.unmount()
})

test('just switched on, the pane says it is getting ready', async () => {
  expect(statusLine({ ...VIEW, watch: { state: 'starting', lastLookAt: null, detail: '' } })).toBe('On. Getting ready.')
})

import { expect, test } from 'claude-code/testing'

import type { Note } from '../types'
import { currentNote, statusLine } from '../hooks/pane'
import type { PaneView } from '../hooks/pane'
import { PANE, SESSION, stubSession, typed } from './kit'

const VIEW: PaneView = {
  mode: 'on',
  tab: 'play',
  persona: 'none',
  notes: [],
  selected: null,
  watch: { state: 'idle', lastLookAt: null, detail: '' },
  isAutomatic: true,
  review: { state: 'none', subject: '', text: '', isUnseen: false },
  reviewSchedule: 'after each commit',
  profiles: { languages: [], subjects: {} },
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

test('statusLine says what the watcher is doing and in what voice', async () => {
  expect(statusLine(VIEW)).toBe('On. Watching for your next save.')
  expect(statusLine({ ...VIEW, persona: 'knuth' })).toBe('On. Watching for your next save. Persona: knuth.')
  expect(statusLine({ ...VIEW, isAutomatic: false })).toBe('On. Looking only when you ask.')
  expect(statusLine({ ...VIEW, mode: 'paused' })).toBe('Paused. /bsd resume to continue.')
  expect(statusLine({ ...VIEW, watch: { ...VIEW.watch, state: 'looking' } })).toBe('On. Looking at your changes.')
  expect(statusLine({ ...VIEW, watch: { ...VIEW.watch, state: 'no-git' } })).toMatch('not a git repository')
  expect(statusLine({ ...VIEW, watch: { state: 'failed', lastLookAt: 1, detail: 'rate limit' } })).toBe(
    'On. The last look failed (rate limit). It will try again.',
  )
})

test('currentNote is the selected note while it is open, otherwise the most important one', async () => {
  const notes = [note(1, { kind: 'tip' }), note(2, { kind: 'bug' })]

  expect(currentNote({ notes, selected: null })?.id).toBe(2)
  expect(currentNote({ notes, selected: 1 })?.id).toBe(1)
  expect(currentNote({ notes, selected: 99 })?.id).toBe(2)
  expect(currentNote({ notes: [], selected: 1 })).toBeUndefined()
})

test('the pane opens on the play-by-play and switches tabs, on every surface that draws panes', async ($, on) => {
  stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'On. Watching for your next save.' })).toBeDefined()

    await ui.press({ key: 'tab-review' })
    expect(await ui.find({ type: 'Text', text: 'No deep review yet.' })).toBeDefined()

    await ui.press({ key: 'tab-profile' })
    expect(await ui.find({ type: 'Text', text: 'Nothing on record yet.' })).toBeDefined()

    await ui.press({ key: 'tab-play' })
    await ui.unmount()
  }
})

test('the pane shows a pause', async ($, on) => {
  stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await $.command.run(typed('bsd', 'pause'))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Paused' })).toBeDefined()
  await ui.unmount()
})

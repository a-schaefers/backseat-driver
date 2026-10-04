import { expect, test } from 'claude-code/testing'

import { statusLine } from '../hooks/pane'
import { SESSION, stubSession, typed } from './kit'

/** What Claude Code passes a `ui.render` hook for this pane, apart from the surface. */
const PANE = {
  plugin: 'backseat-driver',
  component: 'Pane',
  requestId: 'backseat-driver',
  viewport: { columns: 160, rows: 48 },
  props: {
    title: 'Backseat',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('statusLine says whether the tutor is looking and in what voice', async () => {
  expect(statusLine({ mode: 'on', tab: 'play', persona: 'none' })).toBe('On.')
  expect(statusLine({ mode: 'on', tab: 'play', persona: 'knuth' })).toBe('On. Persona: knuth.')
  expect(statusLine({ mode: 'paused', tab: 'play', persona: 'none' })).toBe('Paused. /bsd resume to continue.')
})

test('the pane opens on the play-by-play and switches tabs, on every surface that draws panes', async ($, on) => {
  stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'play-by-play is not built' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'On.' })).toBeDefined()

    await ui.press({ key: 'tab-review' })
    expect(await ui.find({ type: 'Text', text: 'deep review is not built' })).toBeDefined()

    await ui.press({ key: 'tab-profile' })
    expect(await ui.find({ type: 'Text', text: 'Profiles are not built' })).toBeDefined()

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

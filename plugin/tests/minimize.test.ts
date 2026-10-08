import { expect } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { projectId } from '../core/datahome'
import { STRIP_HINT } from '../hooks/pane'
import { BAND, ENGINE_BAND, PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

/**
 * The owner (2026-10-06): the pane's close should minimize, restoring should be obvious, and only /backseat off shuts
 * the tutor down. A test's `$` cannot raise the person's own close of the pane (its mark, Ctrl+X X), so these go
 * through the pane's `x` button, which ends in the same place; the mark is checked live.
 */

/** Presses `x` in the pane, as the person would. */
async function minimize($: Parameters<TestBody>[0], session: ReturnType<typeof stubSession>): Promise<void> {
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'minimize' })
  await session.clock.settle()
  await pane.unmount()
}

sessionTest('x puts the pane away as a strip above the prompt, and a tab on the strip brings it back on that tab', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  expect(session.opened).toEqual(['backseat-driver'])

  // With the pane open, nothing of the tutor is above the prompt.
  const before = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await before.find({ type: 'Text', text: ENGINE_BAND })).toBeDefined()
  expect(await before.find({ key: 'restore' })).toBeUndefined()
  await before.unmount()

  await minimize($, session)
  expect(session.closed).toEqual(['backseat-driver'])
  // Still on: only /backseat off switches it off.
  expect((await $.command.run(typed('backseat', 'status'))).text).toMatch('Backseat Driver is on.')

  const strip = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await strip.find({ key: 'restore' })).toBeDefined()
  expect(await strip.find({ key: 'restore-settings' })).toBeDefined()
  expect(await strip.find({ type: 'Text', text: STRIP_HINT })).toBeDefined()
  // No button on the strip has a key: a bare digit typed into an empty prompt would press it.
  expect((await strip.find({ key: 'restore-play' }))?.props.hotkey).toBeUndefined()
  await strip.press({ key: 'restore-review' })
  await session.clock.settle()
  await strip.unmount()
  expect(session.opened).toEqual(['backseat-driver', 'backseat-driver'])

  const back = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await back.find({ key: 'review-now' })).toBeDefined()
  await back.unmount()
  const after = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await after.find({ key: 'restore' })).toBeUndefined()
  await after.unmount()
})

sessionTest('/backseat brings back a pane that was put away, and /backseat off ends it', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  await minimize($, session)
  const strip = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await strip.find({ key: 'restore' })).toBeDefined()
  await strip.unmount()

  // Asking for the tutor again brings the pane back as it was.
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  expect(session.opened).toEqual(['backseat-driver', 'backseat-driver'])
  const gone = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await gone.find({ key: 'restore' })).toBeUndefined()
  await gone.unmount()

  // Put away and then switched off: nothing of it stays above the prompt.
  await minimize($, session)
  await $.command.run(typed('backseat', 'off'))
  await session.clock.settle()
  const off = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await off.find({ key: 'restore' })).toBeUndefined()
  expect(await off.find({ type: 'Text', text: ENGINE_BAND })).toBeDefined()
  await off.unmount()
  // Switched on again, it is the pane that comes up, not the strip.
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  expect(session.opened.length).toBe(3)
})

sessionTest('a pane put away stays put away through /clear', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  await minimize($, session)

  await $.classic.SessionStart({ source: 'clear' })
  await session.clock.settle()
  expect(session.opened).toEqual(['backseat-driver'])
  const strip = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await strip.find({ key: 'restore' })).toBeDefined()
  // The name brings the pane back on the tab it was on.
  await strip.press({ key: 'restore' })
  await session.clock.settle()
  await strip.unmount()
  expect(session.opened).toEqual(['backseat-driver', 'backseat-driver'])
})

sessionTest("the strip's tabs carry the tab row's badges: the serious issues on Review", async ($, on) => {
  // The twentieth ui-truth pass (2026-10-07): the pane said "Review (4)" and the strip a bare "Review".
  const folder = `projects/${projectId(ROOT)}`
  const issue = { id: 1, file: 'stats.py', line: 1, lineText: 'x = 1', severity: 'high', category: 'bug', topic: 't', title: 'a high one', text: 'Bad.', condition: '', origin: 'audit', commit: '0000000', at: 1, status: 'open', statusAt: 1, statusBy: 'review', statusNote: '', isPinned: false }
  const session = stubSession(on, { head: { 'stats.py': 'x = 1\n' }, data: { [`${folder}/findings.json`]: { v: 1, nextId: 2, findings: [issue], coverage: null } } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  await minimize($, session)
  const strip = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await strip.find({ key: 'restore-review', text: 'Review (1)' })).toBeDefined()
  await strip.unmount()
})

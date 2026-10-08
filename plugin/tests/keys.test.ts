import { expect, test } from 'claude-code/testing'

import { MARKER } from '../core/datahome'
import { FLUSH_MS } from '../core/debuglog'
import { rowKeysOf } from '../hooks/shown'
import { ALREADY_ASKED, FOCUSED_HINT, FOCUSED_HINT_NO_ROWS } from '../hooks/pane'
import { PANE, SESSION, sessionTest, stubSession, typed } from './kit'

type Session = ReturnType<typeof stubSession>

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const QUIET = { options: { explain: 'off', animated_persona: false, progress_report: false } } as const
// The kit has no implementation of `$.ui.focus` ("no implementation for ui.focus"), so where j and k put the ring is
// read from the debug log, which notes each move with the row it was for.
const LOGGED = { 'debug.json': { on: true }, [MARKER]: 'Backseat Driver keeps its data here.' }

async function lastRing(session: Session): Promise<string | undefined> {
  await session.clock.advance(FLUSH_MS)
  const rings = session.debugLog().filter(record => record.k === 'ui' && record.n === 'ring')

  return (rings.at(-1)?.d as { key?: string } | undefined)?.key
}

test('the rows j and k walk are the buttons without a key, in the order drawn', () => {
  const button = (key: string, hotkey?: string) => ({ type: 'Button', props: { key, label: key, ...(hotkey === undefined ? {} : { hotkey }) } })
  const tree = {
    type: 'Box',
    props: {},
    children: [
      button('row-next', 'j'),
      { type: 'Box', props: {}, children: [button('setting-voice'), { type: 'Text', props: {}, children: ['Voice'] }] },
      [button('option-voice-knuth'), button('look', 'l')],
      button('setting-engineering'),
    ],
  }
  expect(rowKeysOf(tree)).toEqual(['setting-voice', 'option-voice-knuth', 'setting-engineering'])
  expect(rowKeysOf(null)).toEqual([])
})

test('the keys row says how the pane is driven, without Tab', () => {
  // Owner, 2026-10-07: "remove tab/shift+tab for navigation, and rely solely on 1-6 for the upper tabs, and j/k".
  expect(FOCUSED_HINT).not.toMatch('Tab')
  expect(FOCUSED_HINT).toMatch('j k move')
  expect(FOCUSED_HINT).toMatch('PgUp PgDn scroll')
})

sessionTest('j and k put the ring on the rows of the Settings tab, one after another, into a list opened downward', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: LOGGED })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-settings' })
  await session.clock.settle()
  const rows = (await ui.findAll({ type: 'Button' })).map(found => String(found.props.key)).filter(key => key.startsWith('setting-'))
  expect(rows.length).toBeGreaterThan(1)
  const [first, second] = rows
  await ui.press({ key: 'row-next' })
  await session.clock.settle()
  expect(await lastRing(session)).toBe(first)
  await ui.press({ key: 'row-next' })
  await session.clock.settle()
  expect(await lastRing(session)).toBe(second)
  await ui.press({ key: 'row-previous' })
  await session.clock.settle()
  expect(await lastRing(session)).toBe(first)
  // Enter on it opens its options under it, and j carries on into them.
  await ui.press({ key: String(first) })
  await session.clock.settle()
  await ui.press({ key: 'row-next' })
  await session.clock.settle()
  expect(await lastRing(session)).toMatch(/^option-/)
  await ui.unmount()
})

sessionTest('on the Play-by-play tab j and k walk the notes, and the one the ring is on is the one e, d and m act on', QUIET, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: LOGGED })
  session.reply({
    resolved: [],
    notes: [
      { file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'An empty list divides by zero.' },
      { file: 'stats.py', line: 1, kind: 'idiom', topic: 'naming', note: 'xs says little about what it holds.' },
    ],
  })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN}\ndef total(xs):\n    return sum(xs)\n`)
  await session.clock.advance(14_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const marked = async (): Promise<string[]> =>
    (await ui.findAll({ type: 'Button' })).filter(found => String(found.props.key).startsWith('note-') && String(found.props.label).startsWith('❯')).map(found => String(found.props.key))
  const first = await marked()
  expect(first.length).toBe(1)
  await ui.press({ key: 'row-next' })
  await session.clock.settle()
  const second = await marked()
  expect(second).not.toEqual(first)
  expect(await lastRing(session)).toBe(second[0])
  // Dismissed: the note the ring was on goes, and the other stays.
  await ui.press({ key: 'dismiss' })
  await session.clock.settle()
  expect(await ui.find({ key: String(second[0]) })).toBeUndefined()
  expect(await ui.find({ key: String(first[0]) })).toBeDefined()
  await ui.unmount()
})

sessionTest('a dialog asked from the pane hands the keyboard back to it once answered', QUIET, async ($, on) => {
  // The eighteenth ui-truth pass, 2026-10-07: after `w`, the keys pressed for the pane went into the prompt ("jj").
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const before = session.focusAsked.length
  session.answers.push('the parser')
  await ui.press({ key: 'working' })
  await session.clock.settle()
  expect(session.focusAsked.slice(before)).toEqual(['backseat-driver'])
  await ui.unmount()
  // From a pane without the keyboard nothing is asked back.
  const away = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, isFocused: false } })
  const after = session.focusAsked.length
  session.answers.push('the parser again')
  await away.press({ key: 'working' })
  await session.clock.settle()
  expect(session.focusAsked.length).toBe(after)
  await away.unmount()
})

sessionTest('the same question is not sent twice before the conversation has answered it', QUIET, async ($, on) => {
  // `e` pressed five times while the first answer was being written (the eighteenth ui-truth pass, 2026-10-07).
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'An empty list divides by zero.' }] })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN}\ndef total(xs):\n    return sum(xs)\n`)
  await session.clock.advance(14_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const before = session.submitted.length
  await ui.press({ key: 'explain' })
  await session.clock.settle()
  await ui.press({ key: 'explain' })
  await session.clock.settle()
  expect(session.submitted.length - before).toBe(1)
  expect(session.toasts).toContain(ALREADY_ASKED)
  // Its answer's turn has ended: the same question may be asked again.
  await $.turn.complete(session.turnEnded())
  await session.clock.settle()
  await ui.press({ key: 'explain' })
  await session.clock.settle()
  expect(session.submitted.length - before).toBe(2)
  await ui.unmount()
})

sessionTest('the keys row promises j and k only on a tab that offers them, and /backseat settings names them', QUIET, async ($, on) => {
  // "j k move" on Growth, and "then Tab to it" in the answer to /backseat settings (the nineteenth ui-truth pass, 2026-10-07).
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-profile' })
  expect(await ui.find({ key: 'row-next' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: FOCUSED_HINT_NO_ROWS })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: FOCUSED_HINT })).toBeUndefined()
  await ui.press({ key: 'tab-settings' })
  expect(await ui.find({ key: 'row-next' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: FOCUSED_HINT })).toBeDefined()
  await ui.unmount()
  const answer = await $.command.run(typed('backseat', 'settings'))
  expect(String((answer as { text?: string }).text ?? '')).toMatch('then j and k to it and Enter')
  expect(String((answer as { text?: string }).text ?? '')).not.toMatch('Tab to it')
})

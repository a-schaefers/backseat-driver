import { expect, test } from 'claude-code/testing'

import { PANE, SESSION, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const EMPTY_LIST = {
  resolved: [],
  notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'What does this do for an empty list?' }],
}

test('a save becomes a note only after the tree has been quiet', async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))

  session.write('stats.py', MEAN)
  await session.clock.advance(2000)
  // The poll noticed the save. Nothing has gone to a model.
  expect(session.requests.length).toBe(0)

  await session.clock.advance(6000)
  expect(session.requests.length).toBe(0)

  // Ten seconds of quiet have now passed.
  await session.clock.advance(4000)
  expect(session.requests.length).toBe(1)

  const request = session.requests[0]
  expect(request?.model).toBe('sonnet')
  expect(request?.effort).toBe('medium')
  expect(request?.system).toBe('PLAY-BY-PLAY INSTRUCTIONS')
  expect(request?.prompt).toMatch('=== stats.py ===')
  expect(request?.prompt).toMatch('+def mean(xs):')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'What does this do for an empty list?' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'stats.py' })).toBeDefined()
  expect(await ui.find({ key: 'note-1' })).toBeDefined()
  await ui.unmount()
})

test('saving again while typing restarts the quiet time, and a burst of saves is one look', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))

  session.write('stats.py', 'def mean(xs):\n')
  await session.clock.advance(8000)
  session.write('stats.py', MEAN)
  await session.clock.advance(8000)
  expect(session.requests.length).toBe(0)

  await session.clock.advance(4000)
  expect(session.requests.length).toBe(1)
  // The look carries the net change, not each save.
  expect(session.requests[0]?.prompt).toMatch('+    return sum(xs) / len(xs)')
})

test('the minimum gap holds a second look back', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))

  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)
  expect(session.requests.length).toBe(1)

  session.write('stats.py', `${MEAN}\ndef total(xs):\n    return sum(xs)\n`)
  await session.clock.advance(30_000)
  // Quiet for long enough, but the previous look was under a minute ago.
  expect(session.requests.length).toBe(1)

  await session.clock.advance(40_000)
  expect(session.requests.length).toBe(2)
  // The second look sees only what changed since the first.
  expect(session.requests[1]?.prompt).toMatch('+def total(xs):')
  expect(session.requests[1]?.prompt).not.toMatch('+def mean(xs):')
})

test('work already uncommitted when the tutor is switched on is not reviewed', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.write('stats.py', `${MEAN}# half-finished\n`)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))

  await session.clock.advance(120_000)
  expect(session.requests.length).toBe(0)
})

test('a note the reviewer marks resolved leaves the pane', async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  session.reply({ resolved: [1], notes: [] })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))

  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)
  session.write('stats.py', 'def mean(xs):\n    if not xs:\n        raise ValueError("empty")\n    return sum(xs) / len(xs)\n')
  await session.clock.advance(80_000)
  expect(session.requests.length).toBe(2)
  // The reviewer was told which notes are open.
  expect(session.requests[1]?.prompt).toMatch('1. [bug] stats.py:2')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
  await ui.unmount()
})

test('a reply that is not the JSON asked for shows nothing and is not retried', async ($, on) => {
  const session = stubSession(on)
  session.reply('I think the code looks fine!')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))

  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)
  await session.clock.advance(120_000)
  expect(session.requests.length).toBe(1)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
  await ui.unmount()
})

test('explain sends the note into the conversation, dismiss removes it', async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'explain' })
  expect(session.submitted.length).toBe(1)
  expect(session.submitted[0]).toMatch('Explain play-by-play note 1 (stats.py line 2)')
  expect(session.submitted[0]).toMatch('What does this do for an empty list?')

  await ui.press({ key: 'dismiss' })
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
  await ui.unmount()
})

test('the conversation is told which notes are open', async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))

  await $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } })
  // With no notes open, nothing is attached.
  expect(session.contexts).toEqual([[]])

  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)
  await $.prompt.submit({ text: 'explain note 1', wait: false, origin: { kind: 'composer' } })
  expect(session.submitted).toEqual(['hello', 'explain note 1'])
  expect(session.contexts[1]?.length).toBe(1)
  expect(session.contexts[1]?.[0]).toMatch('1. [bug] stats.py:2 (empty-input) What does this do for an empty list?')
})

test('a paused tutor does not look, and catches up when resumed', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await $.command.run(typed('bsd', 'pause'))

  session.write('stats.py', MEAN)
  await session.clock.advance(120_000)
  expect(session.requests.length).toBe(0)

  await $.command.run(typed('bsd', 'resume'))
  await session.clock.advance(14_000)
  expect(session.requests.length).toBe(1)
})

test('"on request" looks only when asked from the pane', { options: { play_by_play: 'on request' } }, async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))

  session.write('stats.py', MEAN)
  await session.clock.advance(120_000)
  expect(session.requests.length).toBe(0)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Looking only when you ask.' })).toBeDefined()
  await ui.press({ key: 'look' })
  expect(session.requests.length).toBe(1)
  expect(await ui.find({ type: 'Text', text: 'What does this do for an empty list?' })).toBeDefined()
  await ui.unmount()
})

test('the chosen model and thinking level are what the look uses', { options: { play_by_play_model: 'haiku', play_by_play_thinking: 'low', quiet_time: '5 seconds', persona: 'knuth' } }, async ($, on) => {
  const session = stubSession(on, { pluginFiles: { '/personas/knuth.md': '# Persona: knuth\n' } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))

  session.write('stats.py', MEAN)
  await session.clock.advance(8000)
  expect(session.requests.length).toBe(1)
  expect(session.requests[0]?.model).toBe('haiku')
  expect(session.requests[0]?.effort).toBe('low')
  expect(session.requests[0]?.system).toBe('PLAY-BY-PLAY INSTRUCTIONS\n\n# Persona: knuth')
})

test('outside a git repository the pane says why there is no play-by-play', async ($, on) => {
  const session = stubSession(on, { isRepository: false })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  session.write('stats.py', MEAN)
  await session.clock.advance(60_000)
  expect(session.requests.length).toBe(0)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'not a git repository' })).toBeDefined()
  await ui.unmount()
})

test('switching the tutor off stops the watcher and clears the notes', async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)
  expect(session.requests.length).toBe(1)

  await $.command.run(typed('bsd', 'off'))
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(300_000)
  expect(session.requests.length).toBe(1)

  await $.command.run(typed('bsd'))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
  await ui.unmount()
})

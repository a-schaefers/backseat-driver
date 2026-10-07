import { expect } from 'claude-code/testing'

import { PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'
import { NO_LOOK_YET, NO_NOTES } from '../hooks/pane'
import { NO_SAVE_YET, NOTHING_NEW } from '../core/look'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const EMPTY_LIST = {
  resolved: [],
  notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'What does this do for an empty list?' }],
}

sessionTest('a save becomes a note only after the tree has been quiet', async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

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
  expect(request?.system).toBe('PLAY-BY-PLAY INSTRUCTIONS\n\nSPEECH BUBBLE INSTRUCTIONS')
  expect(request?.prompt).toMatch('=== stats.py (Python) ===')
  expect(request?.prompt).toMatch('+def mean(xs):')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'What does this do for an empty list?' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'stats.py' })).toBeDefined()
  expect(await ui.find({ key: 'note-1' })).toBeDefined()
  await ui.unmount()
})

sessionTest('saving again while typing restarts the quiet time, and a burst of saves is one look', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

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

sessionTest('the minimum gap holds a second look back', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

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

sessionTest('work already uncommitted when the tutor is switched on is not reviewed', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.write('stats.py', `${MEAN}# half-finished\n`)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  await session.clock.advance(120_000)
  expect(session.requests.length).toBe(0)
})

sessionTest('a note the reviewer marks resolved leaves the pane', async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  session.reply({ resolved: [1], notes: [] })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

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

sessionTest('a reply that is not the JSON asked for shows nothing and is not retried', async ($, on) => {
  const session = stubSession(on)
  session.reply('I think the code looks fine!')
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)
  await session.clock.advance(120_000)
  expect(session.requests.length).toBe(1)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
  await ui.unmount()
})

sessionTest('explain sends the note into the conversation, dismiss removes it', async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
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

sessionTest('the conversation is told which notes are open', async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  await $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } })
  // With no notes open, nothing is attached.
  expect(session.contexts).toEqual([[]])

  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)
  await $.prompt.submit({ text: 'explain note 1', wait: false, origin: { kind: 'composer' } })
  expect(session.submitted).toEqual(['hello', 'explain note 1'])
  // The notes, and after them what the journal says they are doing.
  expect(session.contexts[1]?.length).toBe(2)
  expect(session.contexts[1]?.[0]).toMatch('1. [bug] stats.py:2 (empty-input) What does this do for an empty list?')
})

sessionTest('a paused tutor does not look, and catches up when resumed', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  await $.command.run(typed('backseat', 'pause'))

  session.write('stats.py', MEAN)
  await session.clock.advance(120_000)
  expect(session.requests.length).toBe(0)

  await $.command.run(typed('backseat', 'resume'))
  await session.clock.advance(14_000)
  expect(session.requests.length).toBe(1)
})

sessionTest('"on request" looks only when asked from the pane', { options: { play_by_play: 'on request' } }, async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

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

sessionTest('the chosen model and thinking level are what the look uses', { options: { play_by_play_model: 'haiku', play_by_play_thinking: 'low', quiet_time: '5 seconds', engineering: 'knuth' } }, async ($, on) => {
  const session = stubSession(on, { pluginFiles: { '/personas/engineering/knuth.md': '# Engineering: knuth\n' } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  session.write('stats.py', MEAN)
  await session.clock.advance(8000)
  expect(session.requests.length).toBe(1)
  expect(session.requests[0]?.model).toBe('haiku')
  expect(session.requests[0]?.effort).toBe('low')
  expect(session.requests[0]?.system).toBe('PLAY-BY-PLAY INSTRUCTIONS\n\nSPEECH BUBBLE INSTRUCTIONS\n\n# Engineering: knuth')
})

sessionTest('outside a git repository the pane says why there is no play-by-play', async ($, on) => {
  const session = stubSession(on, { isRepository: false })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', MEAN)
  await session.clock.advance(60_000)
  expect(session.requests.length).toBe(0)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'not a git repository' })).toBeDefined()
  await ui.unmount()
})

sessionTest('switching the tutor off stops the watcher and clears the notes', async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)
  expect(session.requests.length).toBe(1)

  await $.command.run(typed('backseat', 'off'))
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(300_000)
  expect(session.requests.length).toBe(1)

  await $.command.run(typed('backseat'))
  await session.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: NO_LOOK_YET })).toBeDefined()
  await ui.unmount()
})

sessionTest('close to the plan limit, looks are spaced further apart', async ($, on) => {
  const session = stubSession(on)
  session.limits.push({ kind: 'five_hour', percentUsed: 85 })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)
  expect(session.requests.length).toBe(1)

  session.write('stats.py', `${MEAN}# more\n`)
  // The setting says one minute. At 85% of the window it is four.
  await session.clock.advance(120_000)
  expect(session.requests.length).toBe(1)
  await session.clock.advance(130_000)
  expect(session.requests.length).toBe(2)
})

sessionTest('at the plan limit, the play-by-play waits to be asked', async ($, on) => {
  const session = stubSession(on)
  session.limits.push({ kind: 'five_hour', percentUsed: 40 }, { kind: 'seven_day', percentUsed: 97 })
  session.reply(EMPTY_LIST)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  session.write('stats.py', MEAN)
  await session.clock.advance(120_000)
  expect(session.requests.length).toBe(0)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Holding back, because you are close to your plan limit.' })).toBeDefined()
  // Asked for by hand, it still looks.
  await ui.press({ key: 'look' })
  expect(session.requests.length).toBe(1)
  expect(await ui.find({ type: 'Text', text: 'What does this do for an empty list?' })).toBeDefined()
  await ui.unmount()
})

sessionTest('"look now" with nothing new says so', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'look' })
  // Before any look, the answer says what the baseline is (the eighth ui-truth pass, 2026-10-06).
  expect(session.toasts).toEqual([NO_SAVE_YET])
  expect(session.requests.length).toBe(0)
  await ui.unmount()
})

sessionTest('the reviewer is told which language each file is in', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', MEAN)
  session.write('notes.txt', 'plain text\n')
  await session.clock.advance(14_000)

  expect(session.requests[0]?.prompt).toMatch('=== stats.py (Python) ===')
  expect(session.requests[0]?.prompt).toMatch('=== notes.txt ===')
})

sessionTest('a dismissed note does not come back on the next save', async ($, on) => {
  const session = stubSession(on)
  session.reply(EMPTY_LIST)
  // The reviewer raises the same point again, and one new one.
  session.reply({
    resolved: [],
    notes: [
      ...EMPTY_LIST.notes,
      { file: 'stats.py', line: 5, kind: 'idiom', topic: 'builtin-sum', note: 'There is a built-in for this.' },
    ],
  })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', MEAN)
  await session.clock.advance(14_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'dismiss' })
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()

  session.write('stats.py', `${MEAN}\ndef total(xs):\n    return 0\n`)
  await session.clock.advance(80_000)
  expect(session.requests.length).toBe(2)
  // The reviewer was told, and the pane holds the line even though it repeated itself.
  expect(session.requests[1]?.prompt).toMatch('Notes they dismissed. Do not raise these again:')
  expect(session.requests[1]?.prompt).toMatch('- stats.py (empty-input) What does this do for an empty list?')
  expect(await ui.find({ type: 'Text', text: 'There is a built-in for this.' })).toBeDefined()
  expect((await ui.findAll({ type: 'Text', text: 'What does this do for an empty list?' })).length).toBe(0)
  await ui.unmount()
})

sessionTest('the repository is found from the session\'s directory, which may be below its top', async ($, on) => {
  // The owner's session in ~/repos/php-hello/public_html, where .git is, was told the folder was not a repository:
  // git had been run where the process was started (2026-10-06).
  const session = stubSession(on, { head: { 'stats.py': 'x = 1\n' } })
  session.cwd = `${ROOT}/public_html`
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  await session.clock.advance(1000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'On. Watching for your next save.' })).toBeDefined()
  await ui.unmount()
  expect(session.scans).toBeGreaterThan(0)
})

sessionTest('a look asked for before any save says that the tree at switch-on is the baseline', async ($, on) => {
  // The owner pressed `l` with a file changed before switch-on and was told nothing had changed "since the last look",
  // with no look ever run (the eighth ui-truth pass, 2026-10-06).
  const session = stubSession(on, { head: { 'stats.py': 'x = 1\n' } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'look' })
  await session.clock.settle()
  expect(session.toasts.at(-1)).toBe(NO_SAVE_YET)
  // After a look, the usual answer.
  session.reply({ resolved: [], notes: [] })
  session.write('stats.py', 'x = 2\n')
  await session.clock.advance(12_000)
  await session.clock.settle()
  expect(await ui.find({ type: 'Text', text: NO_NOTES })).toBeDefined()
  await ui.press({ key: 'look' })
  await session.clock.settle()
  expect(session.toasts.at(-1)).toBe(NOTHING_NEW)
  await ui.unmount()
})

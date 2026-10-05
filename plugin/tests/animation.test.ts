import { expect } from 'claude-code/testing'
import type { Mounted } from 'claude-code/testing'

import type { Pose } from '../hooks/avatar'
import { AVATARS, TALK_MS } from '../hooks/avatar'
import { ASLEEP } from '../hooks/pane'
import { rasterCells } from '../hooks/sprite'
import { PANE, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const FAST = { quiet_time: '5 seconds', minimum_gap: 'none' }
/** Long enough to say any line the tests give the character. */
const SAY_ALL = TALK_MS * 12

/** The character's pixels as the pane draws them: which voice's, in which pose, and whether dim. */
async function drawnAs(ui: Mounted<'terminal', 'Pane'>, voice: keyof typeof AVATARS, pose: Pose, isDim: boolean): Promise<boolean> {
  const raster = await ui.find({ type: 'Raster', key: 'persona' })

  return raster?.props.cells === rasterCells(AVATARS[voice].art, pose, isDim ? 'dark' : null)
}

sessionTest('switched on, the character says hello one word at a time', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const talking = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await talking.find({ type: 'Text', text: /─┤ Riding +│/ })).toBeDefined()
  // Mouth open on the first word, and lit up while it talks.
  expect(await drawnAs(talking, 'default', 'talk', false)).toBe(true)
  await talking.unmount()

  await session.clock.advance(SAY_ALL)
  const done = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await done.find({ type: 'Text', text: 'Riding along. You drive.' })).toBeDefined()
  // At rest it is dim.
  expect(await drawnAs(done, 'default', 'rest', true)).toBe(true)
  await done.unmount()
})

sessionTest("the character is the voice persona's", { options: { voice: 'torvalds' } }, async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.advance(SAY_ALL)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await drawnAs(ui, 'torvalds', 'rest', true)).toBe(true)
  expect(await ui.find({ type: 'Text', text: `-| ${AVATARS.torvalds.hello} |` })).toBeDefined()
  await ui.unmount()
})

sessionTest('the keep-it-simple voice gets the KISS penguin in its top hat', { options: { voice: 'eli5-tldr-kiss-terse' } }, async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.advance(SAY_ALL)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await drawnAs(ui, 'eli5-tldr-kiss-terse', 'rest', true)).toBe(true)
  // Beside the penguin a pane 60 columns wide fits the quote in two lines, with the tail on the second, level with the beak.
  expect(await ui.find({ type: 'Text', text: ' | "whatsoever a man soweth, that |' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '-| shall he also reap."' })).toBeDefined()
  await ui.unmount()
})

sessionTest('a look gives the character its line, and a quiet look leaves it quiet', { options: FAST }, async ($, on) => {
  const session = stubSession(on)
  session.reply({ resolved: [], notes: [], say: 'Count the fence posts.' })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', MEAN)
  await session.clock.advance(8000)
  expect(session.requests.length).toBe(1)
  expect(session.requests[0]?.system).toMatch('SPEECH BUBBLE INSTRUCTIONS')
  expect(session.requests[0]?.prompt).toMatch('Speech bubble: only for something that matters in this change.')

  await session.clock.advance(SAY_ALL)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Count the fence posts.' })).toBeDefined()

  // The conversation knows what it said, so a question about it makes sense.
  await $.prompt.submit({ text: 'what does the bubble mean?', wait: false, origin: { kind: 'composer' } })
  expect(session.contexts[session.contexts.length - 1]?.join('\n')).toMatch('It last said: "Count the fence posts."')

  // The next look has nothing to say, so the old line, about older code, goes.
  session.write('stats.py', `${MEAN}# done\n`)
  await session.clock.advance(8000)
  expect(session.requests.length).toBe(2)
  expect(await ui.find({ type: 'Text', text: 'Count the fence posts.' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '╭' })).toBeUndefined()
  await ui.unmount()
})

sessionTest('after four quiet looks in a row, a look may give the character a light remark', { options: FAST }, async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  for (let look = 1; look <= 5; look += 1) {
    session.write('stats.py', `${MEAN}# look ${look}\n`)
    await session.clock.advance(8000)
  }
  expect(session.requests.length).toBe(5)
  expect(session.requests.slice(0, 4).every(request => request.prompt.includes('only for something that matters'))).toBe(true)
  expect(session.requests[4]?.prompt).toMatch('a light remark is welcome')
})

sessionTest("a finished deep review gives the character the review's closing line", async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', MEAN)
  session.commit('Add mean')
  await session.clock.advance(2000)
  await $.turn.complete(session.finish(1, 'Good change.\n\n**Next:** test `mean` when empty.'))
  await session.clock.advance(SAY_ALL)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Review's in\. Next: test mean when/ })).toBeDefined()
  await ui.unmount()
})

sessionTest('paused, the character sleeps', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.advance(SAY_ALL)
  await $.command.run(typed('bsd', 'pause'))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: ASLEEP })).toBeDefined()
  expect(await drawnAs(ui, 'default', 'blink', true)).toBe(true)
  await ui.unmount()
})

sessionTest('above the prompt, where rows are scarce, the character takes one line', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.advance(SAY_ALL)

  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, placement: 'inline' }, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: AVATARS.default.mini.rest })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Riding along. You drive.' })).toBeDefined()
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

sessionTest('now and then a resting character blinks', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.advance(SAY_ALL)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  let blinks = 0
  for (let step = 0; step < 100; step += 1) {
    await session.clock.advance(100)
    if (await drawnAs(ui, 'default', 'blink', true)) blinks += 1
  }
  expect(blinks).toBeGreaterThan(0)
  expect(blinks).toBeLessThan(5)
  await ui.unmount()
})

sessionTest('with the animation off, there is no character and the reviewer is not asked for its line', { options: { ...FAST, animated_persona: false } }, async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', MEAN)
  await session.clock.advance(8000)
  expect(session.requests[0]?.system).toBe('PLAY-BY-PLAY INSTRUCTIONS')
  expect(session.requests[0]?.prompt).not.toMatch('Speech bubble')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Riding along.' })).toBeUndefined()
  await ui.unmount()
})

sessionTest('switching off silences the character, and switching on again starts it afresh', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.advance(SAY_ALL)
  await $.command.run(typed('bsd', 'off'))
  await session.clock.advance(SAY_ALL)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /─┤ Riding +│/ })).toBeDefined()
  await ui.unmount()
})

sessionTest('the character stands on the play-by-play and deep review tabs only', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.advance(SAY_ALL)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ type: 'Text', text: 'Riding along. You drive.' })).toBeDefined()
  await ui.press({ key: 'tab-profile' })
  expect(await ui.find({ type: 'Text', text: 'Riding along. You drive.' })).toBeUndefined()
  await ui.press({ key: 'tab-explain' })
  expect(await ui.find({ type: 'Text', text: 'Riding along. You drive.' })).toBeUndefined()
  await ui.unmount()
})

sessionTest("the character never reads out the notes a deep review leaves for the tutor's memory", async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', MEAN)
  session.commit('Add mean')
  await session.clock.advance(2000)
  const notes = { overview: 'A statistics library.', files: [], insights: [] }
  await $.turn.complete(session.finish(1, `Good change.\n\n**Next:** test \`mean\` when empty.\n\n\`\`\`backseat-notes\n${JSON.stringify(notes)}\n\`\`\`\n`))
  await session.clock.advance(SAY_ALL)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Review's in\. Next: test mean when/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /backseat-notes|overview/ })).toBeUndefined()
  await ui.unmount()
})

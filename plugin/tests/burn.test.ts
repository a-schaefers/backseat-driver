import { expect } from 'claude-code/testing'

import { PANE, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'

sessionTest('burn token mode sends every answered request once more, to the most capable model at maximum thinking, and drops the answer', { options: { burn_tokens: true } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  // Switch-on probed for the most capable model: one small request, answered, so fable it is.
  expect(session.requests.length).toBe(1)
  expect(session.requests[0]).toMatchObject({ model: 'fable', effort: 'low', maxTokens: 5 })

  session.write('stats.py', `${MEAN}\ndef total(xs):\n    return sum(xs)\n`)
  // The scan sees the save within a second, and the look comes ten seconds of quiet after that.
  await session.clock.advance(12_000)
  await session.clock.settle()
  const looks = session.requests.slice(1)
  expect(looks.length).toBe(2)
  expect(looks[0]).toMatchObject({ model: 'sonnet', effort: 'medium' })
  expect(looks[1]).toMatchObject({ model: 'fable', effort: 'max' })
  expect(looks[1]?.prompt).toBe(looks[0]?.prompt)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'On. Watching for your next save.' })).toBeDefined()
  await ui.unmount()
})

sessionTest('a plan without fable burns on opus, and a plan without either burns nothing', { options: { burn_tokens: true } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.failing.push('look:model_not_found')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.requests.map(request => request.model)).toEqual(['fable', 'opus'])

  session.write('stats.py', `${MEAN}\ndef total(xs):\n    return sum(xs)\n`)
  await session.clock.advance(12_000)
  await session.clock.settle()
  expect(session.requests.slice(2).map(request => [request.model, request.effort])).toEqual([
    ['sonnet', 'medium'],
    ['opus', 'max'],
  ])
})

sessionTest('off by default: nothing is probed and nothing is burned', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.requests.length).toBe(0)

  session.write('stats.py', `${MEAN}\ndef total(xs):\n    return sum(xs)\n`)
  await session.clock.advance(12_000)
  await session.clock.settle()
  expect(session.requests.map(request => request.model)).toEqual(['sonnet'])
})

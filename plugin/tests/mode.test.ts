import { expect, test } from 'claude-code/testing'

import { HELP, helpText, isModeRequest, parseRequest, transition } from '../hooks/mode'
import { parseProfile, subjectKey } from '../hooks/profiles'
import { SESSION, sessionTest, stubSession, typed } from './kit'

test('parseRequest: no argument means on, an unknown word means help', async () => {
  expect(parseRequest('')).toEqual({ request: 'on', rest: '' })
  expect(parseRequest('  ON ').request).toBe('on')
  for (const word of ['off', 'pause', 'resume', 'status', 'questions', 'help'] as const) {
    expect(parseRequest(word).request).toBe(word)
  }
  expect(parseRequest('faster please')).toEqual({ request: 'help', rest: 'please', unknown: 'faster' })
  expect(parseRequest('questions  now ')).toEqual({ request: 'questions', rest: 'now' })
  expect(isModeRequest('pause')).toBe(true)
  expect(isModeRequest('questions')).toBe(false)
})

test('helpText lists every command, and names a word that is not one', async () => {
  for (const word of ['off', 'pause', 'resume', 'status', 'questions', 'help']) expect(HELP).toMatch(`/bsd ${word}`)
  expect(helpText()).toBe(HELP)
  expect(helpText('faster')).toMatch('There is no /bsd faster.')
})

test('transition: pause and resume do nothing while the tutor is off', async () => {
  expect(transition('off', 'pause').to).toBe('off')
  expect(transition('off', 'resume').to).toBe('off')
  expect(transition('on', 'pause').to).toBe('paused')
  expect(transition('paused', 'resume').to).toBe('on')
  expect(transition('paused', 'on').to).toBe('on')
  expect(transition('paused', 'off').to).toBe('off')
})

test('transition: status never changes the mode', async () => {
  expect(transition('paused', 'status')).toEqual({ to: 'paused', text: 'Backseat Driver is paused.' })
})

sessionTest('/bsd and /backseat-driver switch the same tutor', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)

  const started = await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(started.text).toBe('Backseat Driver is on. You drive.')

  const again = await $.command.run(typed('backseat-driver'))
  await session.clock.settle()
  expect(again.text).toBe('Backseat Driver is already on.')

  const paused = await $.command.run(typed('bsd', 'pause'))
  expect(paused.text).toMatch('paused')

  const status = await $.command.run(typed('backseat-driver', 'status'))
  expect(status.text).toBe('Backseat Driver is paused. Voice: default. Engineering: default.')

  const stopped = await $.command.run(typed('bsd', 'off'))
  expect(stopped.text).toBe('Backseat Driver is off. Claude Code is back to normal.')
})

sessionTest('the pane opens with the tutor, closes with it, and stays through a pause', async ($, on) => {
  const calls = stubSession(on)
  await $.session.start(SESSION)
  expect(calls.opened).toEqual([])

  await $.command.run(typed('bsd'))
  await calls.clock.settle()
  expect(calls.opened).toEqual(['backseat-driver'])

  await $.command.run(typed('bsd', 'pause'))
  await $.command.run(typed('bsd', 'resume'))
  expect(calls.opened).toEqual(['backseat-driver'])
  expect(calls.closed).toEqual([])

  // Asking for "on" again brings back a pane the user closed by hand.
  await $.command.run(typed('bsd'))
  await calls.clock.settle()
  expect(calls.opened).toEqual(['backseat-driver', 'backseat-driver'])

  await $.command.run(typed('bsd', 'off'))
  expect(calls.closed).toEqual(['backseat-driver'])
})

sessionTest('the tutor is still on after /clear', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await $.classic.SessionStart({ source: 'clear' })

  const status = await $.command.run(typed('bsd', 'status'))
  expect(status.text).toBe('Backseat Driver is on. Voice: default. Engineering: default.')
})

sessionTest('/bsd answers before its setup has finished', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': 'x = 1\n' } })
  await $.session.start(SESSION)

  const started = await $.command.run(typed('bsd'))
  expect(started.text).toBe('Backseat Driver is on. You drive.')
  // The pane is up and the contract is in force. The questions have not been asked yet.
  expect(session.opened).toEqual(['backseat-driver'])
  expect(session.asked).toEqual([])

  await session.clock.settle()
  expect(session.asked.length).toBe(1)
  expect(session.tools.length > 0).toBe(true)
})

sessionTest('switching off while the tutor is still starting leaves nothing running', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)

  await $.command.run(typed('bsd'))
  await $.command.run(typed('bsd', 'off'))
  await session.clock.settle()

  session.write('stats.py', 'def mean(xs):\n    return sum(xs) / len(xs)\n')
  await session.clock.advance(60_000)
  expect(session.requests).toEqual([])
  expect(session.asked).toEqual([])
})

sessionTest('/bsd help and an unknown word print the commands, and change nothing', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)

  expect((await $.command.run(typed('bsd', 'help'))).text).toMatch('/bsd questions')
  expect((await $.command.run(typed('bsd', 'faster'))).text).toMatch('There is no /bsd faster.')
  expect(session.opened).toEqual([])
})

sessionTest('/bsd questions asks again, about everything in play', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': 'x = 1\n' } })
  expect((await $.command.run(typed('bsd', 'questions'))).text).toBe('Backseat Driver is off. Run /bsd to start it.')

  await $.session.start(SESSION)
  session.answers.push('Python', 'None yet', 'Understand what happens underneath', 'Idioms and style')
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.asked.length).toBe(4)

  session.answers.push('C, C++ or Rust', 'Regularly: I build real things in it')
  const again = await $.command.run(typed('bsd', 'questions'))
  expect(again.text).toMatch('Here are the questions again.')
  await session.clock.settle()

  // All four are asked again. The two answered replace the old answers, and the dialog was then dismissed.
  expect(session.asked.length).toBe(7)
  expect(parseProfile(session.data('profiles/general.json')).answers).toEqual({ knows: 'C, C++ or Rust' })
  expect(parseProfile(session.data('profiles/python.json')).answers).toEqual({
    level: 'Regularly: I build real things in it',
    goals: 'Understand what happens underneath',
    focus: 'Idioms and style',
  })
})

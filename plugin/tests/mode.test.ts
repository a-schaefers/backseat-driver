import { expect, test } from 'claude-code/testing'

import { parseRequest, transition, USAGE } from '../hooks/mode'
import { SESSION, stubSession, typed } from './kit'

test('parseRequest: no argument means on, an unknown word means help', async () => {
  expect(parseRequest('')).toBe('on')
  expect(parseRequest('  ON ')).toBe('on')
  expect(parseRequest('off')).toBe('off')
  expect(parseRequest('pause')).toBe('pause')
  expect(parseRequest('resume')).toBe('resume')
  expect(parseRequest('status')).toBe('status')
  expect(parseRequest('faster')).toBe('help')
})

test('transition: pause and resume do nothing while the tutor is off', async () => {
  expect(transition('off', 'pause').to).toBe('off')
  expect(transition('off', 'resume').to).toBe('off')
  expect(transition('on', 'pause').to).toBe('paused')
  expect(transition('paused', 'resume').to).toBe('on')
  expect(transition('paused', 'on').to).toBe('on')
  expect(transition('paused', 'off').to).toBe('off')
})

test('transition: status and help never change the mode', async () => {
  expect(transition('paused', 'status')).toEqual({ to: 'paused', text: 'Backseat Driver is paused.' })
  expect(transition('on', 'help')).toEqual({ to: 'on', text: USAGE })
})

test('/bsd and /backseat-driver switch the same tutor', async ($, on) => {
  stubSession(on)
  await $.session.start(SESSION)

  const started = await $.command.run(typed('bsd'))
  expect(started.text).toBe('Backseat Driver is on. You drive.')

  const again = await $.command.run(typed('backseat-driver'))
  expect(again.text).toBe('Backseat Driver is already on.')

  const paused = await $.command.run(typed('bsd', 'pause'))
  expect(paused.text).toMatch('paused')

  const status = await $.command.run(typed('backseat-driver', 'status'))
  expect(status.text).toBe('Backseat Driver is paused. Persona: none.')

  const stopped = await $.command.run(typed('bsd', 'off'))
  expect(stopped.text).toBe('Backseat Driver is off. Claude Code is back to normal.')
})

test('the pane opens with the tutor, closes with it, and stays through a pause', async ($, on) => {
  const calls = stubSession(on)
  await $.session.start(SESSION)
  expect(calls.opened).toEqual([])

  await $.command.run(typed('bsd'))
  expect(calls.opened).toEqual(['backseat-driver'])

  await $.command.run(typed('bsd', 'pause'))
  await $.command.run(typed('bsd', 'resume'))
  expect(calls.opened).toEqual(['backseat-driver'])
  expect(calls.closed).toEqual([])

  // Asking for "on" again brings back a pane the user closed by hand.
  await $.command.run(typed('bsd'))
  expect(calls.opened).toEqual(['backseat-driver', 'backseat-driver'])

  await $.command.run(typed('bsd', 'off'))
  expect(calls.closed).toEqual(['backseat-driver'])
})

test('the tutor is still on after /clear', async ($, on) => {
  stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await $.classic.SessionStart({ source: 'clear' })

  const status = await $.command.run(typed('bsd', 'status'))
  expect(status.text).toBe('Backseat Driver is on. Persona: none.')
})

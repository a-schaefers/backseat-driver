import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { outcomeOfError } from '../hooks/health'
import { clockTime } from '../hooks/status'
import { PANE, SESSION, sessionTest, stubSession, typed } from './kit'

/**
 * The tutor when things do not go to plan: Claude overloaded, rate limited or
 * unreachable, a refused account, a wrong model, the plan's limit. And the
 * timing that deadlines make exact.
 */

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const NOTE = { resolved: [], notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'What does this do for an empty list?' }] }

type Session = ReturnType<typeof stubSession>
type Engine = Parameters<TestBody>[0]

/** Starts a session, switches the tutor on and lets it read the working tree. */
async function start($: Engine, session: Session): Promise<void> {
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
}

/** Whether the pane, as it is drawn now, has this text in it. */
async function says($: Engine, text: string): Promise<boolean> {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const found = await ui.find({ type: 'Text', text })
  await ui.unmount()

  return found !== undefined
}

sessionTest('a save is acknowledged at once, and the look comes the moment the quiet time is over', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply(NOTE)
  await start($, session)
  expect(await says($, 'On. Watching for your next save.')).toBe(true)

  session.write('stats.py', `${MEAN}# more\n`)
  // Just switched on, the working tree is scanned every second.
  await session.clock.advance(1000)
  expect(await says($, 'On. Saw your save. Looking when you pause.')).toBe(true)

  // Ten seconds of quiet, counted from when the save was seen: not a moment sooner, and not a scan later.
  await session.clock.advance(9999)
  expect(session.requests.length).toBe(0)
  await session.clock.advance(1)
  expect(session.requests.length).toBe(1)
  await session.clock.settle()
  expect(await says($, 'What does this do for an empty list?')).toBe(true)
  expect(await says($, 'On. Watching for your next save.')).toBe(true)
})

sessionTest('a second save puts the look off, and the minimum gap is said as a time', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  session.write('stats.py', `${MEAN}# one\n`)
  await session.clock.advance(11_000)
  expect(session.requests.length).toBe(1)
  const looked = session.clock.now()

  session.write('stats.py', `${MEAN}# two\n`)
  await session.clock.advance(1000)
  // A minute has to pass since the last look, which is later than the quiet time.
  expect(await says($, `On. Saw your save. Next look after ${clockTime(looked + 60_000)}.`)).toBe(true)
  await session.clock.advance(58_999)
  expect(session.requests.length).toBe(1)
  await session.clock.advance(1)
  expect(session.requests.length).toBe(2)
})

sessionTest('when Claude is overloaded the look is tried again later, the pane says when, and nothing is lost', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.failing.push('look:overloaded')
  session.reply(NOTE)
  await start($, session)
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(11_000)
  expect(session.requests.length).toBe(1)
  const failedAt = session.clock.now()

  // The minimum gap of a minute, and half a minute more after the first failure.
  expect(await says($, `On. The last look failed (overloaded). Next try ${clockTime(failedAt + 90_000)}.`)).toBe(true)
  await session.clock.advance(89_999)
  expect(session.requests.length).toBe(1)
  await session.clock.advance(1)
  expect(session.requests.length).toBe(2)
  // The same change, sent again whole.
  expect(session.requests[1]?.prompt.includes('# more')).toBe(true)
  await session.clock.settle()
  expect(await says($, 'What does this do for an empty list?')).toBe(true)
  expect(await says($, 'On. Watching for your next save.')).toBe(true)
})

sessionTest('each failure in a row pushes the next try further out', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.failing.push('look:server_error', 'look:offline', 'look:timeout')
  await start($, session)
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(11_000)
  expect(session.requests.length).toBe(1)
  expect(await says($, 'The last look failed (server error).')).toBe(true)

  await session.clock.advance(90_000)
  expect(session.requests.length).toBe(2)
  expect(await says($, 'The last look failed (no connection).')).toBe(true)
  // One minute, and now a whole minute more.
  await session.clock.advance(119_999)
  expect(session.requests.length).toBe(2)
  await session.clock.advance(1)
  expect(session.requests.length).toBe(3)
  expect(await says($, 'The last look failed (timed out).')).toBe(true)
  await session.clock.advance(180_000)
  expect(session.requests.length).toBe(4)
  await session.clock.settle()
  expect(await says($, 'On. Watching for your next save.')).toBe(true)
})

sessionTest('while Claude is not answering, Explain asks for nothing by itself, and the first answer ends the wait', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  // The conversation's own turn dies on an API error. No background request has been spent finding that out.
  await $.classic.StopFailure({ error: 'overloaded' })
  session.write('stats.py', `${MEAN}\n\ndef total(xs):\n    return sum(xs)\n`)
  await session.clock.advance(12_000)
  expect(session.lookups.length).toBe(0)
  expect(session.requests.length).toBe(0)
  expect(await says($, 'On. Claude is overloaded. Next try')).toBe(true)

  // Half a minute at most, and then the look is the one request that finds out.
  await session.clock.advance(30_000)
  expect(session.requests.length).toBe(1)
  await session.clock.advance(5000)
  expect(session.lookups.length > 0).toBe(true)
})

sessionTest('an answer in the conversation ends the wait at once', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  await $.classic.StopFailure({ error: 'overloaded' })
  await $.classic.StopFailure({ error: 'overloaded' })
  await $.classic.StopFailure({ error: 'overloaded' })
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(15_000)
  // Three failures in a row: the wait is up to two minutes.
  expect(session.requests.length).toBe(0)

  await $.turn.complete(session.turnEnded())
  await session.clock.settle()
  expect(session.requests.length).toBe(1)
})

sessionTest('a model that does not exist stops its own job and no other', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.failing.push('look:model_not_found')
  await start($, session)
  session.write('stats.py', `${MEAN}\n\ndef total(xs):\n    return sum(xs)\n`)
  // The scan a second later sees the save, and the look ten seconds after that is refused.
  await session.clock.advance(11_000)
  expect(session.requests.length).toBe(1)
  expect(await says($, 'On. The play-by-play cannot run (model not found). Its model is set in /config.')).toBe(true)

  // It is not tried again by itself, however long it waits. Explain carries on.
  await session.clock.advance(600_000)
  expect(session.requests.length).toBe(1)
  expect(session.lookups.length > 0).toBe(true)

  // Asked for, it is tried, and an answer clears it.
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'look' })
  await ui.unmount()
  expect(session.requests.length).toBe(2)
  await session.clock.settle()
  expect(await says($, 'On. Watching for your next save.')).toBe(true)
})

sessionTest('a refused account stops every background job until a turn succeeds', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.failing.push('authentication_failed')
  await start($, session)
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(11_000)
  const spent = session.requests.length + session.lookups.length
  expect(spent > 0).toBe(true)
  expect(await says($, 'Claude is refusing this account (authentication failed). Nothing runs in the background until that is sorted out.')).toBe(true)

  session.write('stats.py', `${MEAN}# and more\n`)
  await session.clock.advance(900_000)
  expect(session.requests.length + session.lookups.length).toBe(spent)

  // They logged in again, and the conversation answered.
  await $.turn.complete(session.turnEnded())
  await session.clock.advance(11_000)
  expect(session.requests.length + session.lookups.length > spent).toBe(true)
})

sessionTest('the plan limit arrives without being asked for, and the look goes when the window reopens', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(1000)
  expect(await says($, 'On. Saw your save. Looking when you pause.')).toBe(true)

  // Claude Code measures the session and says the five-hour window is nearly spent.
  const reopens = session.clock.now() + 1_800_000
  session.limits.push({ kind: 'five_hour', percentUsed: 97, resetsAt: new Date(reopens).toISOString() })
  await $.session.measure({ context: { window: 200_000 }, rateLimits: session.limits, changed: ['rateLimits'] })
  expect(await says($, `On. Holding back until ${clockTime(reopens)}, because you are close to your plan limit. It still looks when you ask.`)).toBe(true)
  await session.clock.advance(1_700_000)
  expect(session.requests.length).toBe(0)

  // The window reopens. Its old figure says nothing any more, so the look goes.
  await session.clock.advance(100_000)
  expect(session.requests.length).toBe(1)
})

sessionTest('with the plan window spent, no request is made to find that out', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(5000)
  // The plan was fine when the save was seen. Before the look is due, another session spends the window.
  const reopens = session.clock.now() + 3_600_000
  session.limits.push({ kind: 'five_hour', percentUsed: 100, resetsAt: new Date(reopens).toISOString() })
  await session.clock.advance(60_000)
  // The plan is read, for free, right before anything would be spent.
  expect(session.requests.length).toBe(0)
  expect(await says($, `On. Holding back until ${clockTime(reopens)}, because you are close to your plan limit.`)).toBe(true)

  await session.clock.advance(3_600_000)
  expect(session.requests.length).toBe(1)
})

sessionTest('a rate limit that is the plan window waits for the window to reopen, not for a guess', { options: { explain: 'off' } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.failing.push('look:rate_limit')
  await start($, session)
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(2000)
  const reopens = session.clock.now() + 3_600_000
  session.limits.push({ kind: 'five_hour', percentUsed: 100, resetsAt: new Date(reopens).toISOString() })

  // Asked for by hand, the look is made whatever the plan says, and it is refused.
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'look' })
  await ui.unmount()
  expect(session.requests.length).toBe(1)

  // Not after half a minute, nor after ten: when the window reopens, give or take half a minute.
  await session.clock.advance(3_590_000)
  expect(session.requests.length).toBe(1)
  await session.clock.advance(45_000)
  expect(session.requests.length).toBe(2)
})

sessionTest('a prompt, the end of a turn and a key in the pane each make the tutor look at the working tree at once', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  // Long enough with nothing happening for the scans to be five seconds apart.
  await session.clock.advance(900_000)

  session.write('stats.py', `${MEAN}# one\n`)
  await $.prompt.submit({ text: 'why does this fail?', wait: false, origin: { kind: 'composer' } })
  await session.clock.settle()
  expect(await says($, 'On. Saw your save. Looking when you pause.')).toBe(true)

  await session.clock.advance(900_000)
  const before = session.scans
  await $.turn.complete(session.turnEnded())
  await session.clock.settle()
  expect(session.scans).toBe(before + 1)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  await session.clock.settle()
  await ui.unmount()
  expect(session.scans).toBe(before + 2)
})

sessionTest('the working tree is scanned every second after something happened, and every five when nothing has for ten minutes', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await start($, session)
  const count = async (ms: number): Promise<number> => {
    const before = session.scans
    await session.clock.advance(ms)

    return session.scans - before
  }
  // Switched on a moment ago.
  expect(await count(10_000)).toBe(10)
  await session.clock.advance(60_000)
  expect(await count(10_000)).toBe(5)
  await session.clock.advance(600_000)
  expect(await count(10_000)).toBe(2)

  // A save brings them close together again.
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(5000)
  expect(await count(10_000)).toBe(10)
})

sessionTest('paused, nothing is scanned, and resumed, the tree is looked at straight away', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply(NOTE)
  await start($, session)
  await $.command.run(typed('bsd', 'pause'))
  const before = session.scans
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(120_000)
  expect(session.scans).toBe(before)
  expect(session.requests.length).toBe(0)
  expect(await says($, 'Paused. /bsd resume to continue.')).toBe(true)

  await $.command.run(typed('bsd', 'resume'))
  await session.clock.settle()
  expect(session.scans).toBe(before + 1)
  expect(await says($, 'On. Saw your save. Looking when you pause.')).toBe(true)
  await session.clock.advance(10_000)
  expect(session.requests.length).toBe(1)
})

sessionTest('"look now" looks at once, whatever the pacing says', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply(NOTE)
  await start($, session)
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(2000)
  expect(await says($, 'Saw your save')).toBe(true)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'look' })
  expect(session.requests.length).toBe(1)
  expect(await ui.find({ type: 'Text', text: 'What does this do for an empty list?' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'On. Watching for your next save.' })).toBeDefined()
  await ui.unmount()
})

sessionTest('a request Claude Code refuses to send cannot leave every job waiting', { options: { explain: 'off' } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.failing.push('offline', 'refused')
  await start($, session)
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(11_000)
  expect(session.requests.length).toBe(1)

  // The next look is the request that finds out whether Claude is back, and it is refused before it is sent.
  await session.clock.advance(90_000)
  expect(session.requests.length).toBe(2)
  // That says nothing about Claude: the look after it may ask.
  await session.clock.advance(300_000)
  expect(session.requests.length).toBe(3)
})

test('expired cloud credentials are the account, not an outage', () => {
  expect(outcomeOfError('cloud_credential_error').ok === false && outcomeOfError('cloud_credential_error')).toMatchObject({ trouble: 'account' })
})

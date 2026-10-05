import { expect } from 'claude-code/testing'

import { MARKER } from '../core/datahome'
import { DEBUG_USAGE, FLUSH_MS } from '../core/debuglog'
import { FORGET, PHRASE, SCOPE_EVERYTHING } from '../core/forget'
import { DATA_HOME, ROOT, SESSION, SESSION_ID, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const DEBUG = `${DATA_HOME}/debug`
const NOTE = { resolved: [], notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'What if xs is empty?' }] }

/** The debug log's files, by path. */
const logFiles = (session: ReturnType<typeof stubSession>): string[] => [...session.disk.keys()].filter(path => path.startsWith(`${DEBUG}/`))

sessionTest('the debug log is off until it is asked for, and then nothing is written', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply(NOTE)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(14_000)

  expect(session.requests.length).toBe(1)
  expect(logFiles(session)).toEqual([])
  expect(session.data('debug.json')).toBe(undefined)
  expect((await $.command.run(typed('bsd', 'debug'))).text).toBe(`The debug log is off. Logs are kept in ${DEBUG}.`)
  expect((await $.command.run(typed('bsd', 'debug loud'))).text).toBe(DEBUG_USAGE)
})

sessionTest('/bsd debug on records everything the tutor does from then on', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply(NOTE)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const answer = (await $.command.run(typed('bsd', 'debug on'))).text ?? ''
  expect(answer.startsWith(`The debug log is on. It records everything the tutor does, your code and prompts included, in ${DEBUG}.`)).toBe(true)
  expect(answer.includes(`This session writes ${DEBUG}/`)).toBe(true)
  expect((session.data('debug.json') as { on: boolean }).on).toBe(true)
  expect(session.disk.has(`${DATA_HOME}/${MARKER}`)).toBe(true)

  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(14_000)
  await session.clock.advance(FLUSH_MS)

  const log = session.debugLog()
  const named = (kind: string, name: string) => log.find(record => record.k === kind && record.n === name)
  // Who is logging, and with what.
  const started = named('meta', 'log started')?.d as { sessionId: string; dataRoot: string; settings: { playByPlay: { model: string } } }
  expect(started.sessionId).toBe(SESSION_ID)
  expect(started.dataRoot).toBe(DATA_HOME)
  expect(started.settings.playByPlay.model).toBe('sonnet')
  // The save, the look it led to, the request and the reply in full, and what the pane was told.
  expect((named('watch', 'saved')?.d as { files: string[] }).files).toEqual(['stats.py'])
  expect((named('look', 'start')?.d as { files: string[] }).files).toEqual(['stats.py'])
  const model = named('model', 'play-by-play')?.d as { request: { prompt: string; model: string }; result: { text: string } }
  expect(model.request.prompt.includes('# more')).toBe(true)
  expect(model.request.model).toBe('sonnet')
  expect(JSON.parse(model.result.text)).toEqual(NOTE)
  expect((named('look', 'done')?.d as { added: { topic: string }[] }).added.map(note => note.topic)).toEqual(['empty-input'])
  expect(log.some(record => record.k === 'state' && record.n === 'watch' && (record.d as { state?: string }).state === 'looking')).toBe(true)
  expect(log.some(record => record.k === 'git' && record.n === 'status')).toBe(true)
  // Every record says which session and which project it is from, and they count up.
  expect(log.every(record => record.s === SESSION_ID.slice(0, 8))).toBe(true)
  expect(named('look', 'start')?.p.startsWith('work-')).toBe(true)
  expect(log.map(record => record.seq)).toEqual([...log.map(record => record.seq)].sort((a, b) => a - b))

  // Beside the log, the tutor's whole state as it stands.
  const state = JSON.parse(session.disk.get(logFiles(session).find(path => path.endsWith('/state.json')) ?? '') ?? '{}') as {
    mode: string
    repoRoot: string
    pane: { notes: { topic: string }[]; watch: { state: string } }
  }
  expect(state.mode).toBe('on')
  expect(state.repoRoot).toBe(ROOT)
  expect(state.pane.notes.map(note => note.topic)).toEqual(['empty-input'])

  const status = (await $.command.run(typed('bsd', 'debug status'))).text ?? ''
  expect(status.startsWith('The debug log is on. This session is writing ')).toBe(true)
})

sessionTest('switched on while the tutor is off, the log starts when the tutor does', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)

  const answer = (await $.command.run(typed('bsd', 'debug on'))).text ?? ''
  expect(answer.endsWith('It starts when the tutor is switched on.')).toBe(true)
  expect(logFiles(session)).toEqual([])
  expect((await $.command.run(typed('bsd', 'debug status'))).text).toBe(`The debug log is on. It starts when the tutor is switched on. Logs are kept in ${DEBUG}.`)

  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await session.clock.advance(FLUSH_MS)
  const log = session.debugLog()
  expect(log[0]?.n).toBe('log started')
  expect(log.some(record => record.k === 'start' && record.n === 'engaged')).toBe(true)

  // Switching the tutor off ends the log, and says why.
  await $.command.run(typed('bsd', 'off'))
  await session.clock.settle()
  const last = session.debugLog().pop()
  expect(last?.n).toBe('log stopped')
  expect(last?.d).toEqual({ why: 'the tutor was switched off' })
})

sessionTest('/bsd debug off stops the log and keeps what was written', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'debug.json': { on: true } } })
  session.disk.set(`${DATA_HOME}/${MARKER}`, 'marker')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await session.clock.advance(FLUSH_MS)
  expect(session.debugLog().length > 0).toBe(true)

  const answer = await $.command.run(typed('bsd', 'debug off'))
  expect(answer.text).toBe(`The debug log is off. What was logged is kept in ${DEBUG}, and /bsd debug clear deletes it.`)
  expect((session.data('debug.json') as { on: boolean }).on).toBe(false)
  const written = session.debugLog().length
  expect(session.debugLog().pop()?.d).toEqual({ why: 'switched off' })

  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(14_000)
  expect(session.debugLog().length).toBe(written)
})

sessionTest('/bsd debug dump writes down what just happened, with the log off', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(4000)

  const answer = (await $.command.run(typed('bsd', 'debug dump'))).text ?? ''
  const path = answer.slice(answer.indexOf(DEBUG), -1)
  expect(path.startsWith(`${DEBUG}/dump-`)).toBe(true)
  const dump = JSON.parse(session.disk.get(path) ?? '{}') as { state: { mode: string; watcher: { dirty: string[] } }; latest: { k: string; n: string }[] }
  expect(dump.state.mode).toBe('on')
  expect(dump.state.watcher.dirty).toEqual(['stats.py'])
  expect(dump.latest.some(record => record.k === 'watch' && record.n === 'saved')).toBe(true)
  expect(dump.latest.some(record => record.k === 'cmd' && record.n === 'debug')).toBe(true)
  // A dump is not a log: nothing else was written.
  expect(logFiles(session)).toEqual([path])
})

sessionTest('/bsd debug clear deletes the logs, and a session that is logging carries on in a new one', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'debug.json': { on: true }, 'debug/20260101-000000-0ld5e551/000000.jsonl': 'old' } })
  session.disk.set(`${DATA_HOME}/${MARKER}`, 'marker')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await session.clock.advance(FLUSH_MS)

  const answer = await $.command.run(typed('bsd', 'debug clear'))
  expect(answer.text).toBe(`Deleted every debug log in ${DEBUG}. This session carries on in a new one.`)
  expect(session.removed).toEqual([DEBUG])
  await session.clock.advance(FLUSH_MS)
  expect(logFiles(session).some(path => path.includes('0ld5e551'))).toBe(false)
  expect(session.debugLog()[0]?.n).toBe('log started')
  expect((session.data('debug.json') as { on: boolean }).on).toBe(true)

  // With nothing there, it says so and deletes nothing.
  await $.command.run(typed('bsd', 'debug off'))
  await $.command.run(typed('bsd', 'debug clear'))
  expect((await $.command.run(typed('bsd', 'debug clear'))).text).toBe(`There are no debug logs in ${DEBUG}.`)
  expect(session.removed).toEqual([DEBUG, DEBUG])
})

sessionTest('forgetting everything takes the debug log and its switch with it', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'debug.json': { on: true } } })
  session.disk.set(`${DATA_HOME}/${MARKER}`, 'marker')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await session.clock.advance(FLUSH_MS)
  expect(session.debugLog().length > 0).toBe(true)

  session.answers.push(SCOPE_EVERYTHING, FORGET, PHRASE)
  await $.command.run(typed('bsd', 'forget'))
  await session.clock.settle()
  await session.clock.advance(FLUSH_MS)

  expect(session.removed.includes(DEBUG)).toBe(true)
  expect(session.removed.includes(`${DATA_HOME}/debug.json`)).toBe(true)
  expect(logFiles(session)).toEqual([])
  expect(session.data('debug.json')).toBe(undefined)
})

sessionTest('when the session ends, the journal and the log are written', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'debug.json': { on: true } } })
  session.disk.set(`${DATA_HOME}/${MARKER}`, 'marker')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN}# more\n`)
  // The save is seen, and the journal's next write is not due for half a minute.
  await session.clock.advance(4000)
  const journal = () => JSON.stringify(session.disk.get(`${session.projectFolder}/journal.json`) ?? '')
  expect(journal().includes('stats.py')).toBe(false)

  await $.session.end({ reason: 'other', sessionId: SESSION_ID, resume: { id: SESSION_ID } })
  expect(journal().includes('stats.py')).toBe(true)
  const last = session.debugLog().pop()
  expect(last?.n).toBe('log stopped')
  expect(last?.d).toEqual({ why: 'the session ended (other)' })
})

sessionTest('a /clear ends the conversation but not the log', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'debug.json': { on: true } } })
  session.disk.set(`${DATA_HOME}/${MARKER}`, 'marker')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  await $.session.end({ reason: 'clear', sessionId: SESSION_ID, resume: { id: SESSION_ID } })
  const written = session.debugLog().length
  expect(session.debugLog().pop()?.n).toBe('session.end')

  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(4000)
  await session.clock.advance(FLUSH_MS)
  expect(session.debugLog().length > written).toBe(true)
})

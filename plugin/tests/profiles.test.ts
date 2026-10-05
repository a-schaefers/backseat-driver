import { expect, test } from 'claude-code/testing'

import type { Profile } from '../types'
import { languageName, languageOf, mainLanguages } from '../core/languages'
import {
  emptyProfile,
  explained,
  isHushed,
  parseProfile,
  personText,
  profileLines,
  recurring,
  subjectKey,
  withAnswers,
  withExplained,
  withFlagged,
  withHush,
  withoutHush,
} from '../core/profiles'
import { firstRunQuestions, groupAnswers, MAX_QUESTIONS } from '../core/questions'
import { COMPOSE, LICENSE_ANSWERED, PANE, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'

test('languageOf goes by extension, and names read well', async () => {
  expect(languageOf('src/app/main.py')).toBe('python')
  expect(languageOf('lib.rs')).toBe('rust')
  expect(languageOf('a/b/Component.TSX')).toBe('typescript')
  expect(languageOf('deploy.sh')).toBe('shell')
  expect(languageOf('README.md')).toBe(null)
  expect(languageOf('Makefile')).toBe(null)
  expect(languageOf('.gitignore')).toBe(null)
  expect(languageName('cpp')).toBe('C++')
  expect(languageName('python')).toBe('Python')
  expect(languageName('general')).toBe('In general')
})

test('mainLanguages: the biggest always counts, a stray script does not', async () => {
  const python = Array.from({ length: 20 }, (_, i) => `src/m${i}.py`)

  expect(mainLanguages([...python, 'deploy.sh', 'README.md', 'package-lock.json'])).toEqual(['python'])
  expect(mainLanguages([...python, ...python.map(path => path.replace('.py', '.ts'))])).toEqual(['python', 'typescript'])
  expect(mainLanguages(['only.sh'])).toEqual(['shell'])
  expect(mainLanguages(['README.md'])).toEqual([])
  // Vendored and generated code does not make a project's language.
  expect(mainLanguages(['a.py', ...Array.from({ length: 50 }, (_, i) => `node_modules/x/${i}.js`)])).toEqual(['python'])
})

test('parseProfile trusts nothing it reads from the store', async () => {
  expect(parseProfile(undefined)).toEqual(emptyProfile())
  expect(parseProfile('nonsense')).toEqual(emptyProfile())
  expect(
    parseProfile({
      answers: { level: 'None yet', broken: 7 },
      isAsked: true,
      hushed: [{ topic: 'type-hints', text: 'type hints' }, { text: 'no topic' }, 'junk'],
      topics: { 'empty-input': { flagged: 4, explained: 1 }, bad: 'x', negative: { flagged: -2 } },
    }),
  ).toEqual({
    answers: { level: 'None yet' },
    isAsked: true,
    hushed: [{ topic: 'type-hints', text: 'type hints' }],
    topics: { 'empty-input': { flagged: 4, explained: 1 }, negative: { flagged: 0, explained: 0 } },
  })
})

test('a hush is recorded once per topic and can be undone', async () => {
  const hushed = withHush(withHush(emptyProfile(), { topic: 'type-hints', text: 'old' }), { topic: 'type-hints', text: 'type hints' })
  expect(hushed.hushed).toEqual([{ topic: 'type-hints', text: 'type hints' }])
  expect(withoutHush(hushed, 'type-hints').hushed).toEqual([])

  const profiles = { languages: ['python'], subjects: { python: hushed, general: withHush(emptyProfile(), { topic: 'naming', text: 'naming' }) } }
  expect(isHushed(profiles, 'python', 'type-hints')).toBe(true)
  expect(isHushed(profiles, 'rust', 'type-hints')).toBe(false)
  // A general hush holds for every language, and for files in none.
  expect(isHushed(profiles, 'rust', 'naming')).toBe(true)
  expect(isHushed(profiles, null, 'naming')).toBe(true)
})

test('lesson memory counts what was raised and what was explained', async () => {
  let profile = emptyProfile()
  for (let i = 0; i < 3; i += 1) profile = withFlagged(profile, ['empty-input', 'naming'])
  profile = withFlagged(profile, ['empty-input'])
  profile = withExplained(profile, 'empty-input')

  expect(profile.topics['empty-input']).toEqual({ flagged: 4, explained: 1 })
  expect(recurring(profile)).toEqual([
    { topic: 'empty-input', times: 4 },
    { topic: 'naming', times: 3 },
  ])
  expect(explained(profile)).toEqual(['empty-input'])
  expect(recurring(withFlagged(emptyProfile(), ['once']))).toEqual([])
})

test('personText is empty until something is on record', async () => {
  expect(personText({ languages: ['python'], subjects: { general: emptyProfile(), python: emptyProfile() } })).toBe('')

  const python: Profile = {
    answers: { level: 'A little: tutorials and small scripts', goals: 'Write idiomatic code without looking things up' },
    isAsked: true,
    hushed: [{ topic: 'type-hints', text: 'missing type hints' }],
    topics: { 'empty-input': { flagged: 3, explained: 1 } },
  }
  const text = personText({
    languages: ['python'],
    subjects: { general: withAnswers(emptyProfile(), { knows: 'JavaScript or TypeScript' }), python },
  })

  expect(text).toMatch('## What is on record about this person')
  expect(text).toMatch('In general:\n- Knows best: JavaScript or TypeScript')
  expect(text).toMatch('Python:\n- Has written: A little: tutorials and small scripts')
  expect(text).toMatch('- Do not bring up: missing type hints (type-hints)')
  expect(text).toMatch('- Already explained to them: empty-input')
  expect(text).toMatch('- Keeps coming back: empty-input (3 times)')
  expect(profileLines(emptyProfile())).toEqual([])
})

test('the first run asks about the background once, then three questions per new language', async () => {
  const first = firstRunQuestions(['python'], false)
  expect(first.map(question => `${question.subject}.${question.id}`)).toEqual([
    'general.knows',
    'python.level',
    'python.goals',
    'python.focus',
  ])
  expect(first[1]?.question).toBe('How much Python have you written?')
  for (const question of first) {
    expect(question.header.length <= 12).toBe(true)
    expect(question.options.length >= 2 && question.options.length <= 4).toBe(true)
  }

  expect(firstRunQuestions(['rust'], true).length).toBe(3)
  expect(firstRunQuestions([], true)).toEqual([])
  // Never more than ten, however many languages a project has.
  expect(firstRunQuestions(['a', 'b', 'c', 'd', 'e'], false).length <= MAX_QUESTIONS).toBe(true)
})

test('groupAnswers keeps a skipped subject, with no answers', async () => {
  const questions = firstRunQuestions(['python'], false)

  expect(groupAnswers(questions, ['Python', 'None yet'])).toEqual({
    general: { knows: 'Python' },
    python: { level: 'None yet' },
  })
  expect(groupAnswers(questions, [])).toEqual({ general: {}, python: {} })
})

sessionTest('the first time in a project, the questions are asked and the answers are stored by language', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: LICENSE_ANSWERED })
  session.answers.push('JavaScript or TypeScript', 'A little: tutorials and small scripts', 'Write idiomatic code without looking things up', 'Bugs and risky code')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(session.asked.length).toBe(4)
  expect(session.asked[1]).toBe('How much Python have you written?')
  expect(session.data('profiles/general.json')).toEqual({
    answers: { knows: 'JavaScript or TypeScript' },
    isAsked: true,
    hushed: [],
    topics: {},
  })
  expect(parseProfile(session.data('profiles/python.json')).answers.level).toBe('A little: tutorials and small scripts')

  // The tutor and both reviewers are told.
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections[sections.length - 1]?.text).toMatch('- Has written: A little: tutorials and small scripts')
  expect(session.agents[session.agents.length - 1]?.prompt).toMatch('- Knows best: JavaScript or TypeScript')
})

sessionTest('dismissing the questions skips them for good, and the tutor works without them', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: LICENSE_ANSWERED })
  await $.session.start(SESSION)
  const started = await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(started.text).toMatch(/^Backseat Driver is on. You drive./)
  expect(session.asked.length).toBe(1)
  expect(parseProfile(session.data('profiles/python.json'))).toEqual({ ...emptyProfile(), isAsked: true })

  await $.command.run(typed('bsd', 'off'))
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.asked.length).toBe(1)
})

sessionTest('a language already on record is not asked about again, in any project', async ($, on) => {
  const known = withAnswers(emptyProfile(), { level: 'For years: I know it well' })
  const session = stubSession(on, {
    head: { 'stats.py': MEAN },
    data: { ...LICENSE_ANSWERED, 'profiles/python.json': known, 'profiles/general.json': withAnswers(emptyProfile(), { knows: 'Python' }) },
  })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(session.asked).toEqual([])
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections[sections.length - 1]?.text).toMatch('- Has written: For years: I know it well')
})

sessionTest('while the tutor is off, starting a session touches nothing', async ($, on) => {
  const session = stubSession(on, { data: { 'profiles/python.json': emptyProfile() } })
  await $.session.start(SESSION)

  // No read of the store or the data folder, no pane, no tools, no model.
  expect(session.storeReads).toEqual([])
  expect(session.diskReads).toEqual([])
  expect(session.opened).toEqual([])
  expect(session.tools).toEqual([])
  expect(session.agents).toEqual([])
})

sessionTest('the hush tool stops a topic at once, for good, and removes its notes', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 1, kind: 'idiom', topic: 'type-hints', note: 'No type hints.' }] })
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 1, kind: 'idiom', topic: 'type-hints', note: 'Still no type hints.' }] })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.tools.map(tool => tool.name)).toEqual(['hush', 'unhush', 'record', 'lookup', 'progress', 'profile', 'working', 'activity'])

  session.write('stats.py', `${MEAN}\ndef total(xs):\n    return sum(xs)\n`)
  await session.clock.advance(14_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'No type hints.' })).toBeDefined()

  const answer = await $.tool.call({ tool: 'mcp__backseat-driver__hush', topic: 'type-hints', language: 'python', what: 'missing type hints' })
  expect(answer).toEqual({
    result: 'Recorded. "type-hints" will not be brought up again for python, in this project or any other. Removed from the pane: 1.',
  })
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
  expect(parseProfile(session.data('profiles/python.json')).hushed).toEqual([{ topic: 'type-hints', text: 'missing type hints' }])

  // The reviewer is told, and a note on the topic is dropped even if it sends one.
  session.write('stats.py', `${MEAN}\ndef total(xs):\n    return sum(xs)\n\ndef count(xs):\n    return len(xs)\n`)
  await session.clock.advance(80_000)
  expect(session.requests.length).toBe(2)
  expect(session.requests[1]?.system).toMatch('- Do not bring up: missing type hints (type-hints)')
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()

  await $.tool.call({ tool: 'mcp__backseat-driver__unhush', topic: 'type-hints', language: 'python' })
  expect(parseProfile(session.data('profiles/python.json')).hushed).toEqual([])
  await ui.unmount()
})

sessionTest('a hush that names a note uses the note\'s own topic, whatever the model calls it', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 5, kind: 'tip', topic: 'builtin-sum', note: 'A built-in does this.' }] })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(14_000)

  // The model's slug and language do not match the note's. The note number settles it.
  const answer = await $.tool.call({
    tool: 'mcp__backseat-driver__hush',
    note: 1,
    topic: 'builtin-instead-of-loop',
    language: 'general',
    what: 'using built-ins instead of my own loops',
  })
  expect(String((answer as { result: unknown }).result)).toMatch('"builtin-sum" will not be brought up again for python')
  expect(String((answer as { result: unknown }).result)).toMatch('Removed from the pane: 1.')
  expect(parseProfile(session.data('profiles/python.json')).hushed).toEqual([
    { topic: 'builtin-sum', text: 'using built-ins instead of my own loops' },
  ])

  // With no open note to match, the tool says so, and the tutor has nothing to claim.
  const other = await $.tool.call({ tool: 'mcp__backseat-driver__hush', topic: 'naming', language: 'python', what: 'naming' })
  expect(String((other as { result: unknown }).result)).toMatch('No open note matched, so the pane is unchanged.')
})

sessionTest('"m" on a note hushes its topic, and the Profile tab can undo it', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 1, kind: 'idiom', topic: 'type-hints', note: 'No type hints.' }] })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(14_000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'mute' })
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()

  await ui.press({ key: 'tab-profile' })
  expect(await ui.find({ type: 'Text', text: 'Muted: type hints' })).toBeDefined()
  await ui.press({ key: 'unhush-python-type-hints' })
  expect(await ui.find({ type: 'Text', text: 'Muted: type hints' })).toBeUndefined()
  await ui.unmount()
})

sessionTest('what the play-by-play raises and what gets explained goes into the lesson memory', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'Empty list?' }] })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(14_000)
  expect(parseProfile(session.data('profiles/python.json')).topics).toEqual({ 'empty-input': { flagged: 1, explained: 0 } })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'explain' })
  expect(parseProfile(session.data('profiles/python.json')).topics).toEqual({ 'empty-input': { flagged: 1, explained: 1 } })
  await ui.press({ key: 'tab-profile' })
  expect(await ui.find({ type: 'Text', text: 'Explained so far: empty-input' })).toBeDefined()
  await ui.unmount()
})

sessionTest('a language first met mid-session comes into play without questions', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  const askedAtStart = session.asked.length

  session.write('deploy.sh', '#!/bin/sh\nrm -rf $DIR/*\n')
  await session.clock.advance(14_000)
  expect(session.asked.length).toBe(askedAtStart)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-profile' })
  expect(await ui.find({ type: 'Text', text: 'Shell scripting' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'shell scripting' })).toBeDefined()
  // The questions are offered there, for when the user has a minute.
  expect(await ui.find({ type: 'Text', text: 'No answers yet.' })).toBeDefined()
  expect(await ui.find({ key: 'questions' })).toBeDefined()
  await ui.unmount()
})

sessionTest('the profile tool reads a language that is not in play', async ($, on) => {
  const rust = withHush(withAnswers(emptyProfile(), { level: 'None yet' }), { topic: 'lifetimes', text: 'lifetime elision' })
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: { 'profiles/rust.json': rust } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const known = await $.tool.call({ tool: 'mcp__backseat-driver__profile', language: 'rust' })
  expect(String((known as { result: unknown }).result)).toMatch('Rust:\n- Has written: None yet')
  expect(await $.tool.call({ tool: 'mcp__backseat-driver__profile', language: 'go' })).toEqual({
    result: 'Nothing is on record for go.',
  })
})

sessionTest('while the tutor is off, its tools change nothing', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await $.command.run(typed('bsd', 'off'))

  const answer = await $.tool.call({ tool: 'mcp__backseat-driver__hush', topic: 'x', language: 'python', what: 'x' })
  expect(answer).toEqual({ result: 'Backseat Driver is off, so nothing was recorded.' })
  expect(session.data('profiles/python.json')).toBeUndefined()
})

sessionTest('a note the reviewer repeats while it is still open is counted once in the lesson memory', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  const sameNote = { resolved: [], notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'Empty list?' }] }
  session.reply(sameNote)
  session.reply(sameNote)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(14_000)
  session.write('stats.py', `${MEAN}# more\n# and more\n`)
  await session.clock.advance(80_000)

  expect(session.requests.length).toBe(2)
  expect(parseProfile(session.data('profiles/python.json')).topics).toEqual({ 'empty-input': { flagged: 1, explained: 0 } })
})

sessionTest('the record tool keeps what the user says about themselves', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const level = await $.tool.call({ tool: 'mcp__backseat-driver__record', about: 'level', language: 'Python', answer: 'For years, mostly data work' })
  expect(level).toEqual({
    result: 'Recorded for Python: "Has written: For years, mostly data work". It is kept across sessions and projects.',
  })
  expect(parseProfile(session.data('profiles/python.json')).answers).toEqual({ level: 'For years, mostly data work' })

  // The language they know best is kept once, not once per language.
  const knows = await $.tool.call({ tool: 'mcp__backseat-driver__record', about: 'knows', language: 'python', answer: 'Go' })
  expect(String((knows as { result: unknown }).result)).toMatch('Recorded: "Knows best: Go".')
  expect(parseProfile(session.data('profiles/general.json')).answers).toEqual({ knows: 'Go' })

  // The tutor and the deep reviewer are told.
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections[sections.length - 1]?.text).toMatch('- Has written: For years, mostly data work')
  expect(session.agents[session.agents.length - 1]?.prompt).toMatch('- Knows best: Go')
})

sessionTest('the record tool does not count as the first-run questions, and refuses what it cannot file', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  // Rust is not in this project. Its questions are still asked when it first is.
  await $.tool.call({ tool: 'mcp__backseat-driver__record', about: 'goals', language: 'rust', answer: 'Understand ownership' })
  expect(parseProfile(session.data('profiles/rust.json'))).toEqual({ ...emptyProfile(), answers: { goals: 'Understand ownership' } })

  const before = JSON.stringify([...session.disk.entries()])
  for (const bad of [
    { about: 'mood', language: 'python', answer: 'fine' },
    { about: 'constructor', language: 'python', answer: 'x' },
    { about: 'level', language: 'general', answer: 'some' },
    { about: 'level', language: 'python', answer: '   ' },
  ]) {
    const refused = await $.tool.call({ tool: 'mcp__backseat-driver__record', ...bad })
    expect(String((refused as { result: unknown }).result)).toMatch('Nothing was recorded')
  }
  expect(JSON.stringify([...session.disk.entries()])).toBe(before)
})

sessionTest('the questions can be answered again from the Profile tab', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, data: LICENSE_ANSWERED })
  session.answers.push('Python', 'None yet', 'Understand what happens underneath', 'Idioms and style')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(parseProfile(session.data('profiles/python.json')).answers.level).toBe('None yet')

  session.answers.push('JavaScript or TypeScript', 'Regularly: I build real things in it', 'Design larger programs well', 'Performance')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-profile' })
  await ui.press({ key: 'questions' })

  // All four again, and the new answers replace the old.
  expect(session.asked.length).toBe(8)
  expect(parseProfile(session.data('profiles/python.json')).answers).toEqual({
    level: 'Regularly: I build real things in it',
    goals: 'Design larger programs well',
    focus: 'Performance',
  })
  expect(parseProfile(session.data('profiles/general.json')).answers).toEqual({ knows: 'JavaScript or TypeScript' })
  await ui.unmount()
})

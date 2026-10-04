import { expect, test } from 'claude-code/testing'

import { dataHome, fileEntryPath, isRemovable, MARKER, profilePath, progressPath, projectDir, projectId, safeName } from '../hooks/datahome'
import {
  confirmQuestion,
  FORGET,
  isPhrase,
  KEEP,
  knownLanguages,
  parseScope,
  PHRASE,
  SCOPE_EVERYTHING,
  SCOPE_LANGUAGE,
  SCOPE_PROJECT,
  scopeOf,
  scopePaths,
} from '../hooks/forget'
import { fingerprint, shortHash } from '../hooks/hash'
import { emptyProfile, parseProfile, withAnswers, withHush } from '../hooks/profiles'
import { memoryDisk, readJson, writeJson } from '../hooks/storage'
import { DATA_HOME, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const MARKER_PATH = `${DATA_HOME}/${MARKER}`

test('dataHome: the override, then XDG, then ~/.local/share', async () => {
  expect(dataHome({ override: undefined, xdg: undefined, home: '/home/me' })).toBe('/home/me/.local/share/backseat-driver')
  expect(dataHome({ override: undefined, xdg: '/data/', home: '/home/me' })).toBe('/data/backseat-driver')
  expect(dataHome({ override: ' /tmp/bsd/ ', xdg: '/data', home: '/home/me' })).toBe('/tmp/bsd')
  // Nowhere to keep anything: the tutor still works, and remembers nothing.
  expect(dataHome({ override: '', xdg: '', home: '' })).toBe('')
})

test('safeName keeps a name inside one path segment', async () => {
  expect(safeName('python')).toBe('python')
  expect(safeName('c++')).toBe('c++')
  expect(safeName('../../etc/passwd')).toBe('_._etc_passwd')
  expect(safeName('a/b\\c d')).toBe('a_b_c_d')
  expect(safeName('..')).toBe('_')
  expect(safeName('')).toBe('_')
  expect(safeName('x'.repeat(200)).length).toBe(60)
})

test('a project is its root folder: readable, and distinct from another of the same name', async () => {
  const here = projectId('/home/me/code/stats')
  expect(here).toMatch(/^stats-[0-9a-f]{8}$/)
  expect(projectId('/home/me/code/stats/')).toBe(here)
  expect(projectId('/home/me/other/stats')).not.toBe(here)
  expect(projectDir('/d', '/home/me/code/stats')).toBe(`/d/projects/${here}`)
  expect(fileEntryPath('/d', '/home/me/code/stats', 'src/lib/stats.py')).toMatch(
    new RegExp(`^/d/projects/${here}/files/[0-9a-f]{8}-stats\\.py\\.json$`),
  )
  expect(profilePath('/d', 'python')).toBe('/d/profiles/python.json')
  expect(progressPath('/d', '../x')).toBe('/d/progress/_x.json')
})

test('isRemovable: only the tutor\'s own subfolders, and no climbing out', async () => {
  const root = '/home/me/.local/share/backseat-driver'
  expect(isRemovable(root, `${root}/profiles/python.json`)).toBe(true)
  expect(isRemovable(root, `${root}/projects/stats-1a2b3c4d`)).toBe(true)
  expect(isRemovable(root, `${root}/projects`)).toBe(true)
  expect(isRemovable(root, `${root}/focus.json`)).toBe(true)

  expect(isRemovable(root, root)).toBe(false)
  expect(isRemovable(root, `${root}/`)).toBe(false)
  expect(isRemovable(root, `${root}/notes.txt`)).toBe(false)
  expect(isRemovable(root, `${root}/profiles/../../../Documents`)).toBe(false)
  expect(isRemovable(root, '/home/me/Documents')).toBe(false)
  expect(isRemovable(root, `${root}-other/profiles`)).toBe(false)
  expect(isRemovable('', '/profiles')).toBe(false)
})

test('fingerprint changes with the text and with nothing else', async () => {
  const one = fingerprint('def mean(xs):\n    return sum(xs) / len(xs)\n')
  expect(one).toMatch(/^[0-9a-f]{16}$/)
  expect(fingerprint('def mean(xs):\n    return sum(xs) / len(xs)\n')).toBe(one)
  expect(fingerprint('def mean(xs):\n    return sum(xs) / len(xs) \n')).not.toBe(one)
  expect(fingerprint('')).not.toBe(fingerprint(' '))
  // Two texts that differ only in the order of two characters.
  expect(fingerprint('ab')).not.toBe(fingerprint('ba'))
  expect(shortHash('src/a.py')).toMatch(/^[0-9a-f]{8}$/)
})

test('readJson treats a missing or half-written file as nothing', async () => {
  const disk = memoryDisk()
  expect(await readJson(disk, '/d/x.json')).toBe(null)

  await writeJson(disk, '/d/x.json', { a: [1, 2] })
  expect(await readJson(disk, '/d/x.json')).toEqual({ a: [1, 2] })

  disk.files.set('/d/torn.json', '{"a": [1, 2')
  expect(await readJson(disk, '/d/torn.json')).toBe(null)
  disk.files.set('/d/empty.json', '')
  expect(await readJson(disk, '/d/empty.json')).toBe(null)

  expect(await disk.list('/d')).toEqual(['x.json', 'torn.json', 'empty.json'])
  expect(await disk.list('/nowhere')).toEqual([])
  await disk.remove('/d')
  expect(disk.files.size).toBe(0)
})

test('forget: what a word names, and what each scope deletes', async () => {
  expect(parseScope('')).toBe(null)
  expect(parseScope(' Project ')).toEqual({ kind: 'project' })
  expect(parseScope('everything')).toEqual({ kind: 'everything' })
  expect(parseScope('Python')).toEqual({ kind: 'language', language: 'python' })

  expect(scopeOf(SCOPE_PROJECT)).toBe('project')
  expect(scopeOf(SCOPE_LANGUAGE)).toBe('language')
  expect(scopeOf(SCOPE_EVERYTHING)).toBe('everything')
  expect(scopeOf('something typed')).toBe(null)

  expect(scopePaths('/d', '/work', { kind: 'project' })).toEqual([projectDir('/d', '/work')])
  expect(scopePaths('/d', '', { kind: 'project' })).toEqual([])
  expect(scopePaths('/d', '/work', { kind: 'language', language: 'python' })).toEqual(['/d/profiles/python.json', '/d/progress/python.json'])
  expect(scopePaths('/d', '/work', { kind: 'everything' })).toEqual([
    '/d/profiles',
    '/d/progress',
    '/d/projects',
    '/d/focus.json',
    '/d/view.json',
    '/d/update.json',
  ])

  expect(knownLanguages(['python.json', 'general.json', 'rust.json', 'python.json', 'notes.txt'])).toEqual(['python', 'rust'])
  expect(isPhrase(' Forget Everything ')).toBe(true)
  expect(isPhrase('yes')).toBe(false)
  expect(confirmQuestion({ kind: 'language', language: 'python' }, 'stats')).toBe(
    'Forget your Python profile and progress? This cannot be undone.',
  )
})

sessionTest('profiles left in the plugin store move into files, once', async ($, on) => {
  const stored = withHush(withAnswers(emptyProfile(), { level: 'None yet' }), { topic: 'type-hints', text: 'type hints' })
  const session = stubSession(on, {
    head: { 'stats.py': MEAN },
    store: { 'subject/python': stored, 'subject/general': withAnswers(emptyProfile(), { knows: 'Go' }), other: 1 },
  })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(parseProfile(session.data('profiles/python.json'))).toEqual(stored)
  expect(parseProfile(session.data('profiles/general.json')).answers).toEqual({ knows: 'Go' })
  // The store keeps only what was never a profile, and the folder is marked as the tutor's own.
  expect([...session.store.keys()]).toEqual(['other'])
  expect(session.disk.has(MARKER_PATH)).toBe(true)
  // Already asked in the old place, so not asked again in the new one.
  expect(session.asked).toEqual([])
})

sessionTest('a profile already in a file is not overwritten by an older one in the store', async ($, on) => {
  const session = stubSession(on, {
    head: { 'stats.py': MEAN },
    store: { 'subject/python': withAnswers(emptyProfile(), { level: 'None yet' }) },
    data: { 'profiles/python.json': withAnswers(emptyProfile(), { level: 'For years: I know it well' }) },
  })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(parseProfile(session.data('profiles/python.json')).answers.level).toBe('For years: I know it well')
  expect([...session.store.keys()]).toEqual([])
})

sessionTest('BACKSEAT_DRIVER_HOME moves the data folder', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, env: { BACKSEAT_DRIVER_HOME: '/elsewhere' } })
  session.answers.push('Python', 'None yet')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(session.disk.has('/elsewhere/profiles/python.json')).toBe(true)
  expect(session.disk.has(`/elsewhere/${MARKER}`)).toBe(true)
  expect([...session.disk.keys()].some(path => path.startsWith(DATA_HOME))).toBe(false)
})

sessionTest('/bsd forget python deletes that language only after an explicit yes', async ($, on) => {
  const session = stubSession(on, {
    head: { 'stats.py': MEAN },
    data: {
      'profiles/python.json': withAnswers(emptyProfile(), { level: 'None yet' }),
      'profiles/rust.json': withAnswers(emptyProfile(), { level: 'None yet' }),
      'progress/python.json': { level: 'junior' },
    },
  })
  session.disk.set(MARKER_PATH, 'marker')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  // Dismissed: nothing happens.
  const answered = await $.command.run(typed('bsd', 'forget python'))
  expect(answered.text).toBe('Nothing is forgotten until you confirm it. Esc keeps everything.')
  await session.clock.settle()
  expect(session.asked[session.asked.length - 1]).toBe('Forget your Python profile and progress? This cannot be undone.')
  expect(session.removed).toEqual([])
  expect(session.logs).toContain('Nothing was forgotten.')

  // "Keep it", which is the first option: nothing happens.
  session.answers.push(KEEP)
  await $.command.run(typed('bsd', 'forget python'))
  await session.clock.settle()
  expect(session.removed).toEqual([])

  session.answers.push(FORGET)
  await $.command.run(typed('bsd', 'forget python'))
  await session.clock.settle()
  expect(session.removed).toEqual([`${DATA_HOME}/profiles/python.json`, `${DATA_HOME}/progress/python.json`])
  expect(session.data('profiles/python.json')).toBeUndefined()
  expect(session.data('profiles/rust.json')).toBeDefined()
  expect(session.logs).toContain('Forgot your Python profile and progress.')
})

sessionTest('/bsd forget asks what, and forgetting everything takes the words typed out', async ($, on) => {
  const session = stubSession(on, {
    head: { 'stats.py': MEAN },
    data: {
      'profiles/python.json': withAnswers(emptyProfile(), { level: 'None yet' }),
      [`projects/${projectId(ROOT)}/project.json`]: { overview: 'A statistics library.' },
    },
  })
  session.disk.set(MARKER_PATH, 'marker')
  await $.session.start(SESSION)

  // Works with the tutor off. A yes without the phrase keeps everything.
  session.answers.push(SCOPE_EVERYTHING, FORGET, 'yes')
  await $.command.run(typed('bsd', 'forget'))
  await session.clock.settle()
  expect(session.asked.slice(-3)[0]).toBe('What should be forgotten?')
  expect(session.removed).toEqual([])

  session.answers.push(SCOPE_EVERYTHING, FORGET, PHRASE)
  await $.command.run(typed('bsd', 'forget'))
  await session.clock.settle()
  expect(session.removed).toEqual([`${DATA_HOME}/profiles`, `${DATA_HOME}/projects`])
  expect([...session.disk.keys()]).toEqual([MARKER_PATH])
  expect(session.logs).toContain("Forgot every profile, every progress record and every project's journal and cache.")
})

sessionTest('/bsd forget project clears this project and leaves the languages alone', async ($, on) => {
  const session = stubSession(on, {
    head: { 'stats.py': MEAN },
    data: {
      'profiles/python.json': withAnswers(emptyProfile(), { level: 'None yet' }),
      [`projects/${projectId(ROOT)}/project.json`]: { overview: 'A statistics library.' },
      'projects/other-00000000/project.json': { overview: 'Another project.' },
    },
  })
  session.disk.set(MARKER_PATH, 'marker')
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 2, kind: 'bug', topic: 'empty-input', note: 'Empty list?' }] })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN}# more\n`)
  await session.clock.advance(14_000)

  session.answers.push(SCOPE_PROJECT, FORGET)
  await $.command.run(typed('bsd', 'forget'))
  await session.clock.settle()

  expect(session.removed).toEqual([`${DATA_HOME}/projects/${projectId(ROOT)}`])
  expect(session.data('projects/other-00000000/project.json')).toBeDefined()
  expect(parseProfile(session.data('profiles/python.json')).answers.level).toBe('None yet')
  // The open notes were about this project, so they go too.
  const ui = await $.ui.mount({ component: 'Pane', requestId: 'backseat-driver', plugin: 'backseat-driver', surface: 'terminal', viewport: { columns: 160, rows: 48 }, props: { title: 'Backseat', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } })
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
  await ui.unmount()
})

sessionTest('nothing is deleted from a folder that does not carry the tutor\'s marker', async ($, on) => {
  const session = stubSession(on, {
    head: { 'stats.py': MEAN },
    env: { BACKSEAT_DRIVER_HOME: '/home/me/Documents' },
  })
  // Somebody else's folder, which happens to have a `profiles` folder in it.
  session.disk.set('/home/me/Documents/profiles/python.json', '{"answers": {}}')
  await $.session.start(SESSION)

  session.answers.push(FORGET)
  await $.command.run(typed('bsd', 'forget python'))
  await session.clock.settle()

  expect(session.removed).toEqual([])
  expect(session.disk.has('/home/me/Documents/profiles/python.json')).toBe(true)
  expect(session.logs.some(line => line.startsWith('Could not delete /home/me/Documents/profiles/python.json'))).toBe(true)
})

import { expect, test } from 'claude-code/testing'

import { isOwnFolder, MARKER } from '../core/datahome'
import {
  CHECK_EVERY_MS,
  compareVersions,
  installedEntry,
  marketplaceLocation,
  isCheckDue,
  newestRelease,
  parseVersion,
  shellLine,
  UNINSTALL_ERASE,
  UNINSTALL_KEEP,
  UNINSTALL_ONLY,
  updateNotice,
} from '../core/update'
import { PHRASE } from '../core/forget'
import { DATA_HOME, HOME, PANE, SESSION, sessionTest, stubSession, typed } from './kit'

const MANIFEST = { '/.claude-plugin/plugin.json': JSON.stringify({ name: 'backseat-driver', version: '0.2.0', repository: 'https://github.com/a-schaefers/backseat-driver' }) }
const NOTICE = 'Backseat Driver 0.3.0 is out. You have 0.2.0. /backseat update fetches it.'

test('versions, release tags and the notice', async () => {
  expect(parseVersion('v1.2.3')).toEqual([1, 2, 3])
  expect(parseVersion('1.2')).toBe(null)
  expect(compareVersions([0, 10, 0], [0, 9, 9]) > 0).toBe(true)

  const tags = ['aaa\trefs/tags/v0.2.0', 'bbb\trefs/tags/backseat-driver--v0.10.0', 'ccc\trefs/tags/v0.9.1', 'ddd\trefs/tags/nightly', 'eee\trefs/tags/other--v9.0.0'].join('\n')
  // Both namings count. Another plugin's tags and anything not a version do not. 0.10 is newer than 0.9.
  expect(newestRelease(tags)).toEqual([0, 10, 0])
  expect(newestRelease('')).toBe(null)

  expect(updateNotice([0, 2, 0], [0, 3, 0])).toBe(NOTICE)
  expect(updateNotice([0, 3, 0], [0, 3, 0])).toBe('')
  expect(updateNotice([0, 4, 0], [0, 3, 0])).toBe('')
  expect(updateNotice(null, [0, 3, 0])).toBe('')

  expect(isCheckDue({ checkedAt: null, latest: '' }, 0)).toBe(true)
  expect(isCheckDue({ checkedAt: 0, latest: '' }, CHECK_EVERY_MS)).toBe(true)
  expect(isCheckDue({ checkedAt: 1000, latest: '' }, CHECK_EVERY_MS)).toBe(false)
  expect(shellLine(['claude', 'plugin', 'update', 'backseat-driver@backseat-driver'])).toBe('claude plugin update backseat-driver@backseat-driver')
  expect(shellLine(['echo', "it's here"])).toBe("echo 'it'\\''s here'")
})

test('installedEntry finds this copy among the installed plugins by its folder', async () => {
  const installed = JSON.stringify({
    version: 2,
    plugins: {
      'github@claude-plugins-official': [{ installPath: '/home/me/.claude/plugins/cache/claude-plugins-official/github/abc' }],
      'backseat-driver@backseat-driver': [{ installPath: '/home/me/.claude/plugins/cache/backseat-driver/backseat-driver/0.2.0' }],
    },
  })
  expect(installedEntry(installed, '/home/me/.claude/plugins/cache/backseat-driver/backseat-driver/0.2.0')).toEqual({ id: 'backseat-driver@backseat-driver', marketplace: 'backseat-driver', scope: 'user' })
  const local = installed.replace('"installPath":"/home/me/.claude/plugins/cache/backseat-driver', '"scope":"local","installPath":"/home/me/.claude/plugins/cache/backseat-driver')
  expect(installedEntry(local, '/home/me/.claude/plugins/cache/backseat-driver/backseat-driver/0.2.0')?.scope).toBe('local')
  expect(installedEntry(installed, '/home/me/code/backseat-driver/plugin')).toBe(null)
  expect(installedEntry('not json', '/x')).toBe(null)
})

test('the data folder itself is removed only when everything in it is the tutor\'s own', async () => {
  expect(isOwnFolder([MARKER, 'profiles', 'projects', 'update.json'])).toBe(true)
  expect(isOwnFolder([MARKER])).toBe(true)
  // No marker: not known to be the tutor's.
  expect(isOwnFolder(['profiles'])).toBe(false)
  // Something the tutor did not put there.
  expect(isOwnFolder([MARKER, 'profiles', 'thesis.docx'])).toBe(false)
})

sessionTest('a newer release upstream is said in the pane, and asked about at most every six hours', async ($, on) => {
  const session = stubSession(on, { install: 'clone', tags: ['v0.2.0', 'v0.3.0'], pluginFiles: MANIFEST })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  expect(session.ran).toEqual(['git ls-remote --tags --refs git@example.com:me/backseat-driver.git'])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: NOTICE })).toBeDefined()
  await ui.unmount()
  expect(session.data('update.json')).toEqual({ checkedAt: 0, latest: '0.3.0' })

  // On again an hour later: the notice comes from what was kept, with no request.
  await $.command.run(typed('backseat', 'off'))
  await session.clock.advance(60 * 60 * 1000)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  expect(session.ran.length).toBe(1)
  const again = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await again.find({ type: 'Text', text: NOTICE })).toBeDefined()
  await again.unmount()
})

sessionTest('no notice when this copy is the newest, and no request when the check is off', { options: { update_check: false } }, async ($, on) => {
  const session = stubSession(on, { install: 'clone', tags: ['v0.3.0'], pluginFiles: MANIFEST })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  expect(session.ran).toEqual([])
})

sessionTest('offline, a release already known still shows', async ($, on) => {
  const session = stubSession(on, { install: 'clone', pluginFiles: MANIFEST, data: { 'update.json': { checkedAt: 0, latest: '0.3.0' } } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: NOTICE })).toBeDefined()
  await ui.unmount()
})

sessionTest('offline, the check fails quietly and is tried again at the next switch-on', async ($, on) => {
  const session = stubSession(on, { install: 'clone', pluginFiles: MANIFEST })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  expect(session.data('update.json')).toBeUndefined()

  await $.command.run(typed('backseat', 'off'))
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  expect(session.ran.length).toBe(2)
})

sessionTest('in a clone, /backseat update pulls, unless the clone has changes of its own', async ($, on) => {
  const session = stubSession(on, { install: 'clone', tags: ['v0.3.0'], pluginFiles: MANIFEST })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  expect((await $.command.run(typed('backseat', 'update'))).text).toBe('Looking for a newer release.')
  await session.clock.settle()
  expect(session.ran).toContain('git pull --ff-only')
  expect(session.logs).toContain('Updated. The plugin reloads by itself in a moment, and the tutor stays as it is.')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Text', text: NOTICE })).length).toBe(0)
  await ui.unmount()
})

sessionTest('a clone with changes of its own is never pulled', async ($, on) => {
  const session = stubSession(on, { install: 'clone', tags: ['v0.3.0'], pluginFiles: MANIFEST, isCloneDirty: true })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat', 'update'))
  await session.clock.settle()

  expect(session.ran.includes('git pull --ff-only')).toBe(false)
  expect(session.logs.some(line => /^This copy, in \/.+, has changes of its own, so it was not updated\./.test(line))).toBe(true)
})

sessionTest('installed from a marketplace, /backseat update updates through claude plugin', async ($, on) => {
  const session = stubSession(on, { install: 'installed', tags: ['v0.3.0'], pluginFiles: MANIFEST })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat', 'update'))
  await session.clock.settle()

  expect(session.ran).toEqual(['claude plugin marketplace update backseat-driver', 'claude plugin update backseat-driver@backseat-driver'])
  // The fake `claude plugin update` changes nothing, and that is what is said.
  expect(session.logs.some(line => line.startsWith('Already up to date') || line.startsWith('Updated'))).toBe(true)
})

sessionTest('/backseat uninstall keeps everything unless told otherwise', async ($, on) => {
  const session = stubSession(on, { install: 'installed', head: { 'stats.py': 'x = 1\n' } })
  session.disk.set(`${DATA_HOME}/${MARKER}`, 'marker')
  session.disk.set(`${DATA_HOME}/profiles/python.json`, '{}')
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  // Dismissed, then "Keep it", then erase without the typed words: nothing happens.
  await $.command.run(typed('backseat', 'uninstall'))
  await session.clock.settle()
  session.answers.push(UNINSTALL_KEEP)
  await $.command.run(typed('backseat', 'uninstall'))
  await session.clock.settle()
  session.answers.push(UNINSTALL_ERASE, 'yes')
  await $.command.run(typed('backseat', 'uninstall'))
  await session.clock.settle()

  expect(session.ran.some(line => line.startsWith('claude plugin uninstall'))).toBe(false)
  expect(session.disk.has(`${DATA_HOME}/profiles/python.json`)).toBe(true)
  expect((await $.command.run(typed('backseat', 'status'))).text).toMatch('Backseat Driver is on.')
})

sessionTest('/backseat uninstall with erase removes the plugin and everything it remembered', async ($, on) => {
  const session = stubSession(on, { install: 'installed', head: { 'stats.py': 'x = 1\n' } })
  session.disk.set(`${DATA_HOME}/${MARKER}`, 'marker')
  session.disk.set(`${DATA_HOME}/profiles/python.json`, '{}')
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  session.answers.push(UNINSTALL_ERASE, PHRASE)
  expect((await $.command.run(typed('backseat', 'uninstall'))).text).toBe('Nothing is removed until you confirm it. Esc keeps everything.')
  await session.clock.settle()

  expect(session.ran).toContain('claude plugin uninstall backseat-driver@backseat-driver --scope user --yes')
  expect(session.removed).toContain(DATA_HOME)
  expect([...session.disk.keys()].some(path => path.startsWith(DATA_HOME))).toBe(false)
  // Switched off, pane closed.
  expect((await $.command.run(typed('backseat', 'status'))).text).toMatch('Backseat Driver is off.')
  const said = session.logs[session.logs.length - 1] ?? ''
  expect(said).toMatch('Everything it remembered is erased. The plugin is uninstalled.')
  expect(said).toMatch('claude plugin marketplace remove backseat-driver removes it.')
  expect(session.disk.has(`${HOME}/.claude/plugins/installed_plugins.json`)).toBe(true)
})

sessionTest('/backseat uninstall keeping the data leaves the folder alone, and a folder with files of yours is never removed', async ($, on) => {
  const session = stubSession(on, { install: 'installed', head: { 'stats.py': 'x = 1\n' } })
  session.disk.set(`${DATA_HOME}/${MARKER}`, 'marker')
  session.disk.set(`${DATA_HOME}/notes-of-mine.txt`, 'mine')
  await $.session.start(SESSION)

  session.answers.push(UNINSTALL_ONLY)
  await $.command.run(typed('backseat', 'uninstall'))
  await session.clock.settle()
  expect(session.removed).toEqual([])
  expect(session.logs[session.logs.length - 1]).toMatch(`What it remembers is kept in ${DATA_HOME}.`)

  session.answers.push(UNINSTALL_ERASE, PHRASE)
  await $.command.run(typed('backseat', 'uninstall'))
  await session.clock.settle()
  expect(session.removed).toEqual([])
  expect(session.disk.has(`${DATA_HOME}/notes-of-mine.txt`)).toBe(true)
  expect(session.logs[session.logs.length - 1]).toMatch('holds files it did not make, so it was left alone.')
})

test('marketplaceLocation finds Claude Code\'s clone of a marketplace', async () => {
  const known = JSON.stringify({ 'backseat-driver': { source: { source: 'git', url: 'git@example.com:fork/backseat-driver.git' }, installLocation: '/home/me/.claude/plugins/marketplaces/backseat-driver' } })
  expect(marketplaceLocation(known, 'backseat-driver')).toBe('/home/me/.claude/plugins/marketplaces/backseat-driver')
  expect(marketplaceLocation(known, 'other')).toBe('')
  expect(marketplaceLocation('nope', 'backseat-driver')).toBe('')
})

sessionTest('an installed copy asks the marketplace it came from for releases, and falls back to the manifest', async ($, on) => {
  const session = stubSession(on, { install: 'installed', tags: ['backseat-driver--v0.3.0'], pluginFiles: MANIFEST })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()

  // No known_marketplaces.json in this fake home, so the manifest's repository is asked.
  expect(session.ran).toEqual(['git ls-remote --tags --refs https://github.com/a-schaefers/backseat-driver'])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: NOTICE })).toBeDefined()
  await ui.unmount()
})

sessionTest('/backseat update in a clone that has everything says so', async ($, on) => {
  const session = stubSession(on, { install: 'clone', tags: ['v0.2.0'], pluginFiles: MANIFEST, isCloneCurrent: true })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat', 'update'))
  await session.clock.settle()

  expect(session.ran).toContain('git pull --ff-only')
  expect(session.logs.some(line => /^Already up to date: .+ has everything its origin has\.$/.test(line))).toBe(true)
})

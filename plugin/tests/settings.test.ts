import { expect, test } from 'claude-code/testing'

import { SETTINGS_OFF } from '../core/mode'
import { SETTINGS_HINT } from '../hooks/pane'
import {
  catchUp,
  changedFields,
  changedText,
  configValue,
  durationMs,
  notReloadedText,
  readSettings,
  RELOAD_WAIT_MS,
  SETTING_EFFECTS,
  settingRows,
  unclassified,
  withSetting,
} from '../core/settings'
import type { ConfigRowLike } from '../core/settings'
import { PANE, SESSION, sessionTest, stubSession, typed } from './kit'

test('durationMs reads the labels the /config pickers offer', async () => {
  expect(durationMs('5 seconds', -1)).toBe(5000)
  expect(durationMs('1 minute', -1)).toBe(60_000)
  expect(durationMs('180 minutes', -1)).toBe(10_800_000)
  expect(durationMs('none', -1)).toBe(0)
})

test('durationMs falls back on anything it does not recognise', async () => {
  expect(durationMs('soon', 42)).toBe(42)
  expect(durationMs(undefined, 42)).toBe(42)
  expect(durationMs(10, 42)).toBe(42)
})

test('readSettings applies the documented defaults to empty options', async () => {
  expect(readSettings({})).toEqual({
    persona: { voice: 'default', engineering: 'default' },
    layout: 'vertical',
    isAnimated: true,
    isProgressOn: true,
    isUpdateCheckOn: true,
    isBurning: false,
    playByPlay: {
      isAutomatic: true,
      quietMs: 5_000,
      minGapMs: 0,
      model: 'sonnet',
      thinking: 'medium',
    },
    deepReview: {
      isAfterCommit: true,
      everyMs: 0,
      model: 'opus',
      thinking: 'high',
    },
    explain: { mode: 'automatic', model: 'sonnet', thinking: 'low' },
  })
})

test('readSettings takes what the user chose', async () => {
  const settings = readSettings({
    voice: 'eli5-tldr-kiss-terse',
    engineering: 'knuth',
    animated_persona: false,
    play_by_play: 'on request',
    quiet_time: '30 seconds',
    minimum_gap: 'none',
    play_by_play_model: 'haiku',
    play_by_play_thinking: 'low',
    deep_review_after_commit: false,
    deep_review_every: '45 minutes',
    deep_review_model: 'fable',
    deep_review_thinking: 'max',
  })

  expect(settings.persona).toEqual({ voice: 'eli5-tldr-kiss-terse', engineering: 'knuth' })
  expect(settings.isAnimated).toBe(false)
  expect(settings.playByPlay).toEqual({
    isAutomatic: false,
    quietMs: 30_000,
    minGapMs: 0,
    model: 'haiku',
    thinking: 'low',
  })
  expect(settings.deepReview).toEqual({
    isAfterCommit: false,
    everyMs: 2_700_000,
    model: 'fable',
    thinking: 'max',
  })
})

test('readSettings treats a persona that could not name a file as the default', async () => {
  expect(readSettings({ voice: '../../secrets', engineering: 'Knuth' }).persona).toEqual({
    voice: 'default',
    engineering: 'default',
  })
  expect(readSettings({ voice: '', engineering: 3 }).persona).toEqual({ voice: 'default', engineering: 'default' })
})

const row = (overrides: Partial<ConfigRowLike> = {}): ConfigRowLike => ({
  key: 'backseat-driver.voice',
  label: 'Voice persona',
  description: 'How the tutor talks.',
  kind: 'choice',
  value: 'knuth',
  options: ['default', 'knuth'],
  provider: { plugin: 'backseat-driver' },
  isLocked: false,
  ...overrides,
})

test('settingRows keeps only this plugin\'s rows, toggles as on and off', async () => {
  const rows = settingRows(
    [
      row(),
      row({ key: 'backseat-driver.animated_persona', label: 'Animated persona', description: undefined, kind: 'boolean', value: false, options: undefined }),
      row({ key: 'theme', label: 'Theme', provider: { plugin: 'engine' } }),
      row({ key: 'backseat-driver.note', kind: 'text', value: 'hi', options: undefined }),
    ],
    'backseat-driver',
  )
  expect(rows).toEqual([
    { key: 'backseat-driver.voice', label: 'Voice persona', description: 'How the tutor talks.', kind: 'choice', value: 'knuth', options: ['default', 'knuth'], isLocked: false },
    { key: 'backseat-driver.animated_persona', label: 'Animated persona', description: '', kind: 'boolean', value: 'off', options: ['on', 'off'], isLocked: false },
  ])
})

test('a pick goes to /config as the row takes it, and shows in the rows at once', async () => {
  expect(configValue({ kind: 'boolean' }, 'on')).toBe(true)
  expect(configValue({ kind: 'boolean' }, 'off')).toBe(false)
  expect(configValue({ kind: 'choice' }, 'knuth')).toBe('knuth')
  const [voice] = settingRows([row()], 'backseat-driver')
  expect(withSetting([voice!], 'backseat-driver.voice', 'default')[0]?.value).toBe('default')
  expect(withSetting([voice!], 'backseat-driver.other', 'default')[0]?.value).toBe('knuth')
})

sessionTest('the Settings tab changes a setting as /config would', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-settings' })
  await session.clock.settle()
  expect(await ui.find({ type: 'Text', text: SETTINGS_HINT })).toBeDefined()
  expect(await ui.find({ key: 'setting-backseat-driver.voice' })).toBeDefined()
  expect(await ui.find({ key: 'setting-backseat-driver.animated_persona' })).toBeDefined()
  // Another plugin's row, or Claude Code's own, is not this tab's business.
  expect(await ui.find({ key: 'setting-theme' })).toBe(undefined)

  await ui.select({ key: 'setting-backseat-driver.voice', value: 'knuth' })
  await ui.select({ key: 'setting-backseat-driver.animated_persona', value: 'off' })
  await session.clock.settle()
  expect(session.configured).toEqual([
    { key: 'backseat-driver.voice', value: 'knuth' },
    { key: 'backseat-driver.animated_persona', value: false },
  ])
  // Claude Code loads the mod again after a change, which cancels this module's timers. The kit does not, which is
  // the case where nothing reloaded: the person is told, for the last pick only.
  await session.clock.advance(RELOAD_WAIT_MS)
  expect(session.logs).toContain(notReloadedText('Animated persona', 'off'))
  expect(session.logs).not.toContain(notReloadedText('Voice persona', 'knuth'))

  // Refused: the row goes back to what it was, and a toast says why.
  session.configDeny = 'managed elsewhere'
  await ui.select({ key: 'setting-backseat-driver.voice', value: 'torvalds' })
  await session.clock.settle()
  expect(session.toasts).toContain('Voice persona stays knuth: managed elsewhere')
  // Refused, nothing was saved, so no reload is owed.
  await session.clock.advance(RELOAD_WAIT_MS)
  expect(session.logs.filter(line => line.includes('/reload-plugins'))).toHaveLength(1)
  await ui.unmount()
})

sessionTest('/bsd settings opens the Settings tab, and says where they are while off', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  expect((await $.command.run(typed('bsd', 'settings'))).text).toBe(SETTINGS_OFF)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await $.command.run(typed('bsd', 'settings'))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'setting-backseat-driver.voice' })).toBeDefined()
  await ui.unmount()
})

sessionTest('every setting in plugin.json says when a change to it takes effect', async ($, on) => {
  const session = stubSession(on)
  // Claude Code hands the module every field of userConfig, defaults filled in. One missing from SETTING_EFFECTS is reported.
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.logs.filter(line => line.includes('SETTING_EFFECTS'))).toEqual([])
})

test('unclassified names the fields with no entry', async () => {
  expect(unclassified({ voice: 'knuth', layout: 'unified' })).toEqual([])
  expect(unclassified({ voice: 'knuth', sound: true })).toEqual(['sound'])
  expect(Object.keys(SETTING_EFFECTS)).toContain('update_check')
})

test('changedFields lists what a reload changed, a value left to its default included', async () => {
  expect(changedFields({ voice: 'knuth', quiet_time: '10 seconds' }, { voice: 'knuth', quiet_time: '10 seconds' })).toEqual([])
  expect(changedFields({ voice: 'knuth', quiet_time: '10 seconds' }, { voice: 'torvalds', quiet_time: '30 seconds' })).toEqual(['voice', 'quiet_time'])
  expect(changedFields({ animated_persona: true }, {})).toEqual(['animated_persona'])
})

test('catchUp starts the work that otherwise waits for the next switch-on', async () => {
  const off = readSettings({ update_check: false, progress_report: false, deep_review_after_commit: false })
  expect(catchUp(off, readSettings({ progress_report: false, deep_review_after_commit: false }))).toEqual({
    isUpdateCheck: true,
    isPlacement: false,
    isSurvey: false,
  })
  expect(catchUp(off, readSettings({ update_check: false, deep_review_after_commit: false }))).toEqual({
    isUpdateCheck: false,
    isPlacement: true,
    isSurvey: false,
  })
  expect(catchUp(off, readSettings({ update_check: false, progress_report: false, deep_review_after_commit: false, deep_review_every: '5 minutes' })).isSurvey).toBe(true)
  // Already on, or switched off: nothing to catch up on.
  expect(catchUp(readSettings({}), readSettings({}))).toEqual({ isUpdateCheck: false, isPlacement: false, isSurvey: false })
  expect(catchUp(readSettings({}), off)).toEqual({ isUpdateCheck: false, isPlacement: false, isSurvey: false })
})

test('changedText names each change and from when it counts', async () => {
  expect(changedText([])).toBe('')
  expect(
    changedText([
      { field: 'voice', label: 'Voice persona', value: 'torvalds' },
      { field: 'deep_review_model', label: 'Deep review model', value: 'sonnet' },
    ]),
  ).toBe('Voice persona: torvalds, in effect now. Deep review model: sonnet, from the next review.')
})

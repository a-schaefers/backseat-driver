import { expect, test } from 'claude-code/testing'

import { SETTINGS_OFF } from '../hooks/mode'
import { SETTINGS_HINT } from '../hooks/pane'
import { configValue, durationMs, readSettings, settingRows, withSetting } from '../hooks/settings'
import type { ConfigRowLike } from '../hooks/settings'
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
    isAnimated: true,
    isProgressOn: true,
    isUpdateCheckOn: true,
    playByPlay: {
      isAutomatic: true,
      quietMs: 10_000,
      minGapMs: 60_000,
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

  // Refused: the row goes back to what it was, and a toast says why.
  session.configDeny = 'managed elsewhere'
  await ui.select({ key: 'setting-backseat-driver.voice', value: 'torvalds' })
  await session.clock.settle()
  expect(session.toasts).toContain('Voice persona stays knuth: managed elsewhere')
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

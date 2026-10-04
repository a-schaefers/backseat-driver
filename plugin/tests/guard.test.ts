import { expect, test } from 'claude-code/testing'

import { isUsersFile, normalizePath } from '../hooks/guard'

test('normalizePath resolves dots without touching the file system', async () => {
  expect(normalizePath('/work/src/../lib/./a.py')).toBe('/work/lib/a.py')
  expect(normalizePath('/work//src/')).toBe('/work/src')
  expect(normalizePath('src/a.py')).toBe('src/a.py')
  expect(normalizePath('C:\\Users\\me\\.claude\\x.md')).toBe('C:/Users/me/.claude/x.md')
})

test("isUsersFile: everything is the user's except what Claude Code keeps for itself", async () => {
  const home = '/home/me'

  expect(isUsersFile('/work/src/a.py', home)).toBe(true)
  expect(isUsersFile('src/a.py', home)).toBe(true)
  expect(isUsersFile('/home/me/other-project/a.py', home)).toBe(true)
  expect(isUsersFile('/home/me/.bashrc', home)).toBe(true)

  // Claude Code's own memory, plans and settings.
  expect(isUsersFile('/home/me/.claude/projects/work/memory/note.md', home)).toBe(false)
  expect(isUsersFile('/home/me/.claude/plans/plan.md', home)).toBe(false)
  // Its scratch folder.
  expect(isUsersFile('/tmp/claude-1000/work/scratchpad/try.py', home)).toBe(false)
  expect(isUsersFile('/private/tmp/claude-501/work/scratchpad/try.py', home)).toBe(false)
})

test('isUsersFile is not fooled by dots or look-alike folders', async () => {
  const home = '/home/me'

  expect(isUsersFile('/home/me/.claude/../project/a.py', home)).toBe(true)
  expect(isUsersFile('/home/me/.claude-backup/a.py', home)).toBe(true)
  expect(isUsersFile('/work/.claude/settings.json', home)).toBe(true)
  expect(isUsersFile('/tmp/claude-1000/../../work/a.py', home)).toBe(true)
  expect(isUsersFile('/tmp/other/a.py', home)).toBe(true)
  // With no home directory known, nothing is treated as Claude Code's own.
  expect(isUsersFile('/home/me/.claude/plans/plan.md', '')).toBe(true)
})

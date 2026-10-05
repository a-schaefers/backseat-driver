import { expect, test } from 'claude-code/testing'

import { diffLines, formatHunks, splitLines } from '../core/diff'

const lines = (count: number, prefix = 'line') => Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`)

test('splitLines treats a final newline as the end of the last line', async () => {
  expect(splitLines('')).toEqual([])
  expect(splitLines('a\nb\n')).toEqual(['a', 'b'])
  expect(splitLines('a\r\nb')).toEqual(['a', 'b'])
  expect(splitLines('a\n\n')).toEqual(['a', ''])
})

test('identical texts have no hunks', async () => {
  expect(diffLines('a\nb\n', 'a\nb\n')).toEqual([])
  expect(diffLines('', '')).toEqual([])
})

test('a changed line comes with three lines of context on each side', async () => {
  const before = lines(10)
  const after = [...before]
  after[4] = 'changed'

  expect(formatHunks(diffLines(before.join('\n'), after.join('\n')))).toBe(
    ['@@ -2,7 +2,7 @@', ' line 2', ' line 3', ' line 4', '-line 5', '+changed', ' line 6', ' line 7', ' line 8'].join(
      '\n',
    ),
  )
})

test('a new file is one hunk of additions', async () => {
  const hunks = diffLines('', 'a\nb\n')

  expect(hunks.length).toBe(1)
  expect(hunks[0]?.lines).toEqual(['+a', '+b'])
  expect(hunks[0]?.newStart).toBe(1)
  expect(hunks[0]?.newLines).toBe(2)
})

test('lines added at the end and removed from the start', async () => {
  expect(formatHunks(diffLines('a\nb\n', 'a\nb\nc\n'))).toBe('@@ -1,2 +1,3 @@\n a\n b\n+c')
  expect(formatHunks(diffLines('a\nb\nc\n', 'b\nc\n'))).toBe('@@ -1,3 +1,2 @@\n-a\n b\n c')
})

test('changes close together share a hunk, changes far apart do not', async () => {
  const before = lines(30)
  const near = [...before]
  near[4] = 'x'
  near[9] = 'y'
  expect(diffLines(before.join('\n'), near.join('\n')).length).toBe(1)

  const far = [...before]
  far[4] = 'x'
  far[24] = 'y'
  const hunks = diffLines(before.join('\n'), far.join('\n'))
  expect(hunks.length).toBe(2)
  expect(hunks[0]?.newStart).toBe(2)
  expect(hunks[1]?.newStart).toBe(22)
  expect(hunks[1]?.lines).toEqual([' line 22', ' line 23', ' line 24', '-line 25', '+y', ' line 26', ' line 27', ' line 28'])
})

test('every hunk counts its own lines correctly', async () => {
  const before = lines(40)
  const after = [...before.slice(0, 10), 'inserted a', 'inserted b', ...before.slice(10, 25), ...before.slice(27)]

  for (const hunk of diffLines(before.join('\n'), after.join('\n'))) {
    const removed = hunk.lines.filter(line => line.startsWith('-')).length
    const added = hunk.lines.filter(line => line.startsWith('+')).length
    const context = hunk.lines.filter(line => line.startsWith(' ')).length
    expect(hunk.oldLines).toBe(context + removed)
    expect(hunk.newLines).toBe(context + added)
  }
})

test('a pair of huge, wholly different texts still diffs', async () => {
  const hunks = diffLines(lines(2500, 'old').join('\n'), lines(2500, 'new').join('\n'))

  expect(hunks.length).toBe(1)
  expect(hunks[0]?.oldLines).toBe(2500)
  expect(hunks[0]?.newLines).toBe(2500)
})

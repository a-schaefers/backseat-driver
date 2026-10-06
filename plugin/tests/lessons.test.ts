import { expect, test } from 'claude-code/testing'

import { emptyLessonRecord, lessonOrder, lessonProgress, lessonView, nextStep, parseLessonRecord, parsePath, stepRequest, withDone, withHelp, withStarted } from '../core/lessons'
import type { LessonPath } from '../core/lessons'
import { LESSONS_HINT, NO_LESSONS } from '../hooks/pane'
import { PANE, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'

const ERRORS = `---
title: Errors in Python
language: python
level: junior
skills: error-handling, Exceptions
summary: Catch only what you can handle.
---
Most bugs are errors handled badly.

## Find every bare except
Search for \`except:\`.

Try it: narrow each one.

## Raise errors that say what went wrong
Name the value.
`

const COMMITS = `---
title: Commits that explain themselves
language: general
level: beginner
---
## One change per commit
Split it.
`

function read(name: string, text: string): LessonPath {
  const result = parsePath(name, text)
  if (!('path' in result)) throw new Error(result.problem)

  return result.path
}

test('a path is read from its front matter and its ## headings', () => {
  const path = read('python-errors.md', ERRORS)
  expect(path.id).toBe('python-errors')
  expect(path.title).toBe('Errors in Python')
  expect(path.language).toBe('python')
  expect(path.level).toBe('junior')
  expect(path.skills).toEqual(['error-handling', 'exceptions'])
  expect(path.intro).toBe('Most bugs are errors handled badly.')
  expect(path.steps.map(step => step.title)).toEqual(['Find every bare except', 'Raise errors that say what went wrong'])
  expect(path.steps[0]?.body).toBe('Search for `except:`.\n\nTry it: narrow each one.')
})

test('a file that is not a path says why', () => {
  expect(parsePath('a.md', 'no front matter')).toEqual({ problem: 'a.md: no front matter (title, language, level) between --- lines' })
  expect(parsePath('a.md', '---\ntitle: A\nlanguage: python\nlevel: expert\n---\n## One\n')).toEqual({ problem: 'a.md: level must be beginner, junior, mid or senior' })
  expect(parsePath('a.md', '---\ntitle: A\nlanguage: python\nlevel: mid\n---\nNo steps here.\n')).toEqual({ problem: 'a.md: no steps (each step starts with a "## " heading)' })
  expect(parsePath('a.md', '---\nlanguage: python\nlevel: mid\n---\n## One\n')).toEqual({ problem: 'a.md: no title' })
})

test('a step is started, helped with and done; the tutor seeing it outranks their word', () => {
  const path = read('python-errors.md', ERRORS)
  let record = emptyLessonRecord(path.id, path.language)
  expect(nextStep(path, record)).toBe(0)
  record = withHelp(withStarted(record, 0, 10), 0, 11)
  expect(lessonView(path, record).steps[0]).toEqual({ title: 'Find every bare except', state: 'started', helped: 1 })
  record = withDone(record, 0, 'self', 12)
  expect(lessonView(path, record).steps[0]?.state).toBe('done')
  record = withDone(record, 0, 'tutor', 13)
  expect(lessonView(path, record).steps[0]?.state).toBe('checked')
  // Their word does not take back what the tutor saw.
  expect(withDone(record, 0, 'self', 14)).toBe(record)
  expect(nextStep(path, record)).toBe(1)
  expect(lessonProgress(lessonView(path, record))).toBe('1 of 2 steps')
  record = withDone(record, 1, 'tutor', 15)
  expect(nextStep(path, record)).toBe(-1)
  expect(lessonProgress(lessonView(path, record))).toBe('done')

  // Read back from disk, with whatever does not fit dropped.
  expect(parseLessonRecord(JSON.parse(JSON.stringify(record)), path.id, path.language)).toEqual(record)
  expect(parseLessonRecord({ v: 1, id: path.id, steps: { x: {}, 0: { by: 'robot', startedAt: 5 } } }, path.id, path.language).steps).toEqual({
    0: { startedAt: 5, doneAt: 0, by: '', helped: 0 },
  })
  expect(parseLessonRecord({ v: 1, id: 'other', steps: {} }, path.id, path.language)).toEqual(emptyLessonRecord(path.id, path.language))
})

test('the paths of the languages in play come first, then the ones for any language', () => {
  const python = lessonView(read('python-errors.md', ERRORS), emptyLessonRecord('python-errors', 'python'))
  const general = lessonView(read('commits.md', COMMITS), emptyLessonRecord('commits', 'general'))
  const rust = { ...python, id: 'rust', title: 'Rust', language: 'rust' }
  expect(lessonOrder([rust, general, python], ['python']).map(view => view.id)).toEqual(['python-errors', 'commits', 'rust'])
})

test('starting a step sends the step itself, with the path around it on the first step only', () => {
  const path = read('python-errors.md', ERRORS)
  const first = stepRequest(path, 0)
  expect(first).toMatch('I am starting step 1 of 2 of the lesson "Errors in Python" (Python, junior, id python-errors): Find every bare except.')
  expect(first).toMatch('About the path:\nMost bugs are errors handled badly.')
  expect(first).toMatch('Try it: narrow each one.')
  expect(first).toMatch('I write it.')
  expect(stepRequest(path, 1).includes('About the path')).toBe(false)
  expect(stepRequest(path, 5)).toBe('')
})

const LESSON_FILES = { '/lessons/python-errors.md': ERRORS, '/lessons/commits.md': COMMITS, '/lessons/broken.md': 'nothing' }

sessionTest('the Lessons tab lists the paths found, and a step starts in the conversation and is recorded', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN }, pluginFiles: LESSON_FILES })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-lessons' })
  expect(await ui.find({ type: 'Text', text: LESSONS_HINT })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Not a lesson: broken.md: no front matter (title, language, level) between --- lines' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'lesson-python-errors' })).toBeDefined()

  await ui.press({ key: 'lesson-python-errors' })
  expect(await ui.find({ type: 'Text', text: 'Errors in Python' })).toBeDefined()
  await ui.press({ key: 'lesson-start' })
  await session.clock.settle()
  expect(session.submitted[session.submitted.length - 1]).toMatch('I am starting step 1 of 2 of the lesson "Errors in Python"')
  expect(parseLessonRecord(session.data('lessons/python/python-errors.json'), 'python-errors', 'python').steps[0]?.startedAt).toBeDefined()

  // The tutor records what it saw: the step is done, and the next is up.
  const done = await $.tool.call({ tool: 'mcp__backseat-driver__lesson', path: 'python-errors', outcome: 'done' })
  expect(done).toEqual({ result: 'Recorded step 1 (Find every bare except) as done. Next is step 2: Raise errors that say what went wrong. They start it from the Lessons tab, or ask you.' })
  expect(parseLessonRecord(session.data('lessons/python/python-errors.json'), 'python-errors', 'python').steps[0]?.by).toBe('tutor')
  expect(await ui.find({ type: 'Button', key: 'lesson-start' })).toBeDefined()

  // Their own word for the next one.
  await ui.press({ key: 'lesson-done' })
  await session.clock.settle()
  expect(parseLessonRecord(session.data('lessons/python/python-errors.json'), 'python-errors', 'python').steps[1]?.by).toBe('self')
  expect(await ui.find({ type: 'Text', text: 'Every step is done.' })).toBeDefined()

  // The tool lists and reads the paths.
  const listed = await $.tool.call({ tool: 'mcp__backseat-driver__lesson' })
  expect(String((listed as { result: string }).result)).toMatch('- python-errors: Errors in Python (Python, junior, done)')
  expect(String((listed as { result: string }).result)).toMatch('- commits: Commits that explain themselves (Any language, beginner, not started)')
  await ui.unmount()
})

sessionTest('with no lessons installed, the tab says where they come from', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-lessons' })
  expect(await ui.find({ type: 'Text', text: NO_LESSONS })).toBeDefined()
  await ui.unmount()
})

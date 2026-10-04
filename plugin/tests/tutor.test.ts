import { expect, test } from 'claude-code/testing'

import { CONTRACT_ID, INSTRUCTIONS_PREAMBLE, SESSION_NOTES, TUTOR_TASKS } from '../hooks/contract'
import { DENIAL } from '../hooks/guard'
import { COMPOSE, ENGINE_SECTIONS, HOME, SESSION, STOCK_CLAUDE_MD, stubSession, typed } from './kit'

const EDIT = { tool: 'Edit', file_path: '/work/src/a.py', old_string: 'a', new_string: 'b' } as const

test('while the tutor is off, the plugin changes nothing', async ($, on) => {
  const calls = stubSession(on)
  await $.session.start(SESSION)

  expect(await $.prompt.compose(COMPOSE)).toEqual({ sections: [...ENGINE_SECTIONS] })
  const context = await $.prompt.context({ blocks: [] })
  expect(context.blocks[0]).toEqual({ name: 'claudeMd', text: STOCK_CLAUDE_MD })
  expect(await $.tool.call(EDIT)).toEqual({ result: 'edited' })
  expect(calls.opened).toEqual([])
})

test('while the tutor is on, the system prompt carries the contract', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections.find(section => section.id === 'doing_tasks')?.text).toBe(TUTOR_TASKS)
  expect(sections[sections.length - 1]).toEqual({
    id: CONTRACT_ID,
    text: `# Contract\n\nThe user writes the code.\n\n${SESSION_NOTES}`,
    scope: 'session',
  })
})

test('the chosen persona follows the contract', { options: { persona: 'knuth' } }, async ($, on) => {
  const session = stubSession(on, { pluginFiles: { '/personas/knuth.md': '# Persona: knuth\n\nPatient and precise.\n' } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections[sections.length - 1]?.text).toBe(
    `# Contract\n\nThe user writes the code.\n\n${SESSION_NOTES}\n\n# Persona: knuth\n\nPatient and precise.`,
  )
})

test('while the tutor is on, instruction files yield to the contract', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const { blocks } = await $.prompt.context({ blocks: [] })
  expect(blocks[0]?.text.startsWith(INSTRUCTIONS_PREAMBLE)).toBe(true)
  expect(blocks[0]?.text).toMatch('Always edit the files yourself.')
  expect(blocks[1]).toEqual({ name: 'currentDate', text: "Today's date is 2026-10-04." })
})

test("while the tutor is on, Claude cannot edit the user's files", async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(await $.tool.call(EDIT)).toEqual({ deny: DENIAL })
  expect(await $.tool.call({ tool: 'Write', file_path: 'notes.txt', content: 'x' })).toEqual({ deny: DENIAL })
  expect(
    await $.tool.call({ tool: 'NotebookEdit', notebook_path: '/work/nb.ipynb', new_source: 'x' }),
  ).toEqual({ deny: DENIAL })

  // Its own memory is not the user's code.
  const memory = `${HOME}/.claude/projects/work/memory/note.md`
  expect(await $.tool.call({ tool: 'Write', file_path: memory, content: 'x' })).toEqual({ result: 'edited' })
})

test('a paused tutor still does not edit, and switching off restores everything', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await $.command.run(typed('bsd', 'pause'))
  expect(await $.tool.call(EDIT)).toEqual({ deny: DENIAL })

  await $.command.run(typed('bsd', 'off'))
  expect(await $.tool.call(EDIT)).toEqual({ result: 'edited' })
  expect(await $.prompt.compose(COMPOSE)).toEqual({ sections: [...ENGINE_SECTIONS] })
  const context = await $.prompt.context({ blocks: [] })
  expect(context.blocks[0]).toEqual({ name: 'claudeMd', text: STOCK_CLAUDE_MD })
})

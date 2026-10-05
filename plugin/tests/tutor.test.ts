import { expect } from 'claude-code/testing'

import { CONTRACT_ID, INSTRUCTIONS_PREAMBLE, SESSION_NOTES, TUTOR_TASKS } from '../hooks/contract'
import { DENIAL } from '../core/guard'
import { COMPOSE, ENGINE_SECTIONS, HOME, SESSION, sessionTest, STOCK_CLAUDE_MD, stubSession, typed } from './kit'

const EDIT = { tool: 'Edit', file_path: '/work/src/a.py', old_string: 'a', new_string: 'b' } as const

sessionTest('while the tutor is off, the plugin changes nothing', async ($, on) => {
  const calls = stubSession(on)
  await $.session.start(SESSION)

  expect(await $.prompt.compose(COMPOSE)).toEqual({ sections: [...ENGINE_SECTIONS] })
  const context = await $.prompt.context({ blocks: [] })
  expect(context.blocks[0]).toEqual({ name: 'claudeMd', text: STOCK_CLAUDE_MD })
  expect(await $.tool.call(EDIT)).toEqual({ result: 'edited' })
  expect(calls.opened).toEqual([])
})

sessionTest('while the tutor is on, the system prompt carries the contract', async ($, on) => {
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

const PERSONA_FILES = {
  '/personas/voice/eli5-tldr-kiss-terse.md': '# Voice: eli5-tldr-kiss-terse\n\nShort and plain.\n',
  '/personas/voice/knuth.md': '# Voice: knuth\n\nPatient and precise.\n',
  '/personas/engineering/knuth.md': '# Engineering: knuth\n\nThe edges, every time.\n',
}

sessionTest('the persona follows the contract: its engineering half, then its voice', { options: { voice: 'eli5-tldr-kiss-terse', engineering: 'knuth' } }, async ($, on) => {
  const session = stubSession(on, { pluginFiles: PERSONA_FILES })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections[sections.length - 1]?.text).toBe(
    `# Contract\n\nThe user writes the code.\n\n${SESSION_NOTES}\n\n# Engineering: knuth\n\nThe edges, every time.\n\n# Voice: eli5-tldr-kiss-terse\n\nShort and plain.`,
  )
  const status = await $.command.run(typed('bsd', 'status'))
  expect(status.text).toBe('Backseat Driver is on. Voice: eli5-tldr-kiss-terse. Engineering: knuth.')
})

sessionTest("a voice alone leaves the engineering judgment Claude's own", { options: { voice: 'knuth' } }, async ($, on) => {
  const session = stubSession(on, { pluginFiles: PERSONA_FILES })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections[sections.length - 1]?.text).toBe(
    `# Contract\n\nThe user writes the code.\n\n${SESSION_NOTES}\n\n# Voice: knuth\n\nPatient and precise.`,
  )
})

sessionTest('a persona half whose file is missing is left out, and the debug log says so', { options: { voice: 'torvalds', engineering: 'knuth' } }, async ($, on) => {
  const session = stubSession(on, { pluginFiles: PERSONA_FILES })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections[sections.length - 1]?.text).toBe(
    `# Contract\n\nThe user writes the code.\n\n${SESSION_NOTES}\n\n# Engineering: knuth\n\nThe edges, every time.`,
  )
  expect(session.logs).toContain('no voice persona called "torvalds"')
})

sessionTest('while the tutor is on, instruction files yield to the contract', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const { blocks } = await $.prompt.context({ blocks: [] })
  expect(blocks[0]?.text.startsWith(INSTRUCTIONS_PREAMBLE)).toBe(true)
  expect(blocks[0]?.text).toMatch('Always edit the files yourself.')
  expect(blocks[1]).toEqual({ name: 'currentDate', text: "Today's date is 2026-10-04." })
})

sessionTest("while the tutor is on, Claude cannot edit the user's files", async ($, on) => {
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

sessionTest('a paused tutor still does not edit, and switching off restores everything', async ($, on) => {
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

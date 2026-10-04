import { expect, test } from 'claude-code/testing'

import {
  CONTRACT_ID,
  INSTRUCTIONS_PREAMBLE,
  personaPrompt,
  reframeInstructions,
  stripFrontmatter,
  TUTOR_TASKS,
  tutorSections,
} from '../hooks/contract'
import { ENGINE_SECTIONS, STOCK_CLAUDE_MD } from './kit'

test('stripFrontmatter keeps only the body', async () => {
  expect(stripFrontmatter('---\nname: tutor\n---\n\n# Contract\n\nBody.\n')).toBe('# Contract\n\nBody.')
  expect(stripFrontmatter('# No frontmatter\n')).toBe('# No frontmatter')
  expect(stripFrontmatter('---\nnever closed')).toBe('---\nnever closed')
})

test('tutorSections replaces "Doing tasks" and puts the contract last', async () => {
  const sections = tutorSections(ENGINE_SECTIONS, { contract: 'CONTRACT', extras: ['PROFILE'], persona: 'PERSONA' })

  expect(sections.map(section => section.id)).toEqual(['intro', 'doing_tasks', 'tone', 'memory', CONTRACT_ID])
  expect(sections[1]).toEqual({ id: 'doing_tasks', text: TUTOR_TASKS, scope: 'shared' })
  // The persona comes after the contract and what is known about the person.
  expect(sections[4]).toEqual({ id: CONTRACT_ID, text: 'CONTRACT\n\nPROFILE\n\nPERSONA', scope: 'session' })
})

test('personaPrompt puts the engineering half before the voice, and leaves out a default', async () => {
  expect(personaPrompt({ engineering: 'ENGINEERING', voice: 'VOICE' })).toBe('ENGINEERING\n\nVOICE')
  expect(personaPrompt({ engineering: '', voice: 'VOICE' })).toBe('VOICE')
  expect(personaPrompt({ engineering: 'ENGINEERING', voice: '' })).toBe('ENGINEERING')
  expect(personaPrompt({ engineering: '', voice: '' })).toBe('')
})

test('tutorSections never adds the contract twice', async () => {
  const once = tutorSections(ENGINE_SECTIONS, { contract: 'CONTRACT', extras: [], persona: '' })
  const twice = tutorSections(once, { contract: 'CONTRACT', extras: [], persona: '' })

  expect(twice.filter(section => section.id === CONTRACT_ID).length).toBe(1)
  expect(twice[twice.length - 1]).toEqual({ id: CONTRACT_ID, text: 'CONTRACT', scope: 'session' })
})

test('tutorSections copes with a prompt that has no "Doing tasks" section', async () => {
  const lean = [{ id: 'lean_body', text: 'short prompt', scope: 'shared' }] as const
  const sections = tutorSections(lean, { contract: 'CONTRACT', extras: [], persona: '' })

  expect(sections.map(section => section.id)).toEqual(['lean_body', CONTRACT_ID])
})

test('reframeInstructions drops the "OVERRIDE any default behavior" line and keeps the files', async () => {
  const reframed = reframeInstructions(STOCK_CLAUDE_MD)

  expect(reframed.startsWith(INSTRUCTIONS_PREAMBLE)).toBe(true)
  expect(reframed).not.toMatch('OVERRIDE any default behavior')
  expect(reframed).toMatch('Contents of /work/CLAUDE.md')
  expect(reframed).toMatch('Always edit the files yourself.')
})

test('reframeInstructions still adds its note when the stock wording has changed', async () => {
  const reframed = reframeInstructions('Some new wording.\n\nContents of /work/CLAUDE.md:\n\nRules.')

  expect(reframed.startsWith(INSTRUCTIONS_PREAMBLE)).toBe(true)
  expect(reframed).toMatch('Some new wording.')
  expect(reframeInstructions('')).toBe('')
})

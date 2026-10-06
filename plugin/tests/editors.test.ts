import { expect, test } from 'claude-code/testing'

import { connectedHere, EDITOR_TTL_MS, editorName, editorsLine, isCaretHere, parseEditorFile, speaker } from '../core/editors'
import { parseFocusFile } from '../core/focus'
import { editorLight, NO_EDITOR } from '../hooks/pane'
import { PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'

function file(fields: Record<string, unknown>): string {
  return JSON.stringify({ v: 1, editor: 'neovim', pid: 7, at: 1000, file: '/work/stats.py', line: 2, ...fields })
}

test('an editor file is read with its name, its times, and the report Explain and the journal read', () => {
  const seen = parseEditorFile(file({ changed: 900, root: '/work/', column: 4, buffers: ['/work/stats.py', '/work/test.py'] }))
  expect(seen?.name).toBe('Neovim')
  expect(seen?.at).toBe(1000)
  expect(seen?.changed).toBe(900)
  expect(seen?.root).toBe('/work')
  expect(seen?.open).toEqual(['/work/stats.py', '/work/test.py'])
  // A heartbeat changes `at` and nothing the readers see.
  expect(seen?.text).toBe(parseEditorFile(file({ at: 21_000, changed: 900, root: '/work/', column: 4, buffers: ['/work/stats.py', '/work/test.py'] }))?.text)
  expect(parseFocusFile(seen?.text ?? '', '/work')).toEqual({ path: 'stats.py', line: 2 })

  expect(parseEditorFile(file({ changed: undefined }))?.changed).toBe(1000)
  expect(parseEditorFile('{"file": "/work/a.py", "line": 1}')).toBeNull()
  expect(parseEditorFile(file({ file: '' }))).toBeNull()
  expect(parseEditorFile('{"at": 1, "file"')).toBeNull()
  expect(editorName('vscode')).toBe('VS Code')
  expect(editorName('Helix')).toBe('Helix')
  expect(editorName(undefined)).toBe('An editor')
})

test('each project keeps the editors that are about it, and the last caret to move speaks for it', () => {
  const vim = parseEditorFile(file({ root: '/work', changed: 500 }))
  const emacs = parseEditorFile(file({ editor: 'emacs', root: '/work', changed: 800 }))
  const elsewhere = parseEditorFile(file({ editor: 'vscode', file: '/other/app.ts', root: '/other', buffers: ['/work/stats.py'] }))
  const editors = [vim, emacs, elsewhere].flatMap(seen => (seen === null ? [] : [seen]))

  expect(speaker(editors, '/work', 1000)?.name).toBe('Emacs')
  expect(speaker(editors, '/other', 1000)?.name).toBe('VS Code')
  expect(speaker(editors, '/third', 1000)).toBeNull()
  // VS Code has a file of this project open beside its caret elsewhere: it is connected here too, but does not speak.
  expect(connectedHere(editors, '/work', 1000)).toEqual(['Emacs', 'Neovim', 'VS Code'])
  expect(connectedHere(editors, '/other', 1000)).toEqual(['VS Code'])

  // Closed or crashed: no beat for a minute.
  expect(speaker(editors, '/work', 1000 + EDITOR_TTL_MS + 1)).toBeNull()
  expect(connectedHere(editors, '/work', 1000 + EDITOR_TTL_MS + 1)).toEqual([])
})

test('a caret in a repository inside another belongs to the inner one', () => {
  const inner = parseEditorFile(file({ file: '/work/vendor/lib/a.py', root: '/work/vendor/lib' }))
  const unsaid = parseEditorFile(file({ file: '/work/vendor/lib/a.py' }))
  if (inner === null || unsaid === null) throw new Error('did not parse')
  expect(isCaretHere(inner, '/work')).toBe(false)
  expect(isCaretHere(inner, '/work/vendor/lib')).toBe(true)
  // An editor that does not say where its repository is: every repository the file is inside.
  expect(isCaretHere(unsaid, '/work')).toBe(true)
})

test('editorsLine names who is connected', () => {
  expect(editorsLine([])).toBe('')
  expect(editorsLine(['Neovim'])).toBe('Neovim is connected.')
  expect(editorsLine(['Emacs', 'Neovim', 'VS Code'])).toBe('Emacs, Neovim and VS Code are connected.')
})

sessionTest('the editors light is red until an editor with something of this project open is connected, and green while one is', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const light = async (text: string) => (await ui.find({ type: 'Text', text })) !== undefined
  await session.clock.advance(1000)
  // The editors' files have been read, and there is none: the light is red, not out.
  expect(await light('No editor is connected.')).toBe(true)

  session.editor(`${ROOT}/stats.py`, 2, undefined, { editor: 'neovim', root: ROOT, at: session.clock.now() })
  session.editor('/elsewhere/main.rs', 1, undefined, { editor: 'emacs', root: '/elsewhere', at: session.clock.now() })
  await session.clock.advance(3000)
  expect(await light('Neovim is connected.')).toBe(true)
  expect(await light('No editor is connected.')).toBe(false)

  // Neovim was closed without a word: after a minute without a beat it is not connected.
  await session.clock.advance(70_000)
  expect(await light('Neovim is connected.')).toBe(false)
  expect(await light('No editor is connected.')).toBe(true)

  // Paused, nothing reads the editors' files, so the light says nothing.
  await $.command.run(typed('backseat', 'pause'))
  await session.clock.settle()
  expect(await light('No editor is connected.')).toBe(false)
  await ui.unmount()
})

test('the light is out while the session cannot say, red for none, green with the names', () => {
  const watch = { state: 'idle', lastLookAt: null, line: 'On.' } as const
  expect(editorLight({ mode: 'on', watch })).toBeNull()
  expect(editorLight({ mode: 'on', watch: { ...watch, editors: '' } })).toEqual({ isOn: false, text: NO_EDITOR })
  expect(editorLight({ mode: 'on', watch: { ...watch, editors: 'Emacs is connected.' } })).toEqual({ isOn: true, text: 'Emacs is connected.' })
  expect(editorLight({ mode: 'paused', watch: { ...watch, editors: 'Emacs is connected.' } })).toBeNull()
})

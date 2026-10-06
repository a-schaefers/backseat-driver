import { expect, test } from 'claude-code/testing'

import { editorArgv, hasPlaceholder, splitCommand } from '../core/opening'
import { PANE, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'

test('a command line is split as a shell would, quotes and all, and nothing else is expanded', async () => {
  expect(splitCommand('emacsclient -n +{line} {file}')).toEqual(['emacsclient', '-n', '+{line}', '{file}'])
  expect(splitCommand("code --goto '{file}:{line}'")).toEqual(['code', '--goto', '{file}:{line}'])
  expect(splitCommand('nvim --server "/tmp/my sock" --remote +{line} {file}')).toEqual(['nvim', '--server', '/tmp/my sock', '--remote', '+{line}', '{file}'])
  expect(splitCommand('say "a \\"quoted\\" word" and\\ one')).toEqual(['say', 'a "quoted" word', 'and one'])
  expect(splitCommand('   ')).toEqual([])
  expect(splitCommand('echo $HOME `date`')).toEqual(['echo', '$HOME', '`date`'])
})

test('editorArgv fills the placeholders inside their words, and gives a bare command +line and the file', async () => {
  const place = { file: '/home/me/repo/stats.py', line: 42, column: 7 }
  expect(editorArgv('emacsclient -n +{line} {file}', place)).toEqual(['emacsclient', '-n', '+42', '/home/me/repo/stats.py'])
  expect(editorArgv('code --goto {file}:{line}:{column}', place)).toEqual(['code', '--goto', '/home/me/repo/stats.py:42:7'])
  expect(editorArgv('emacsclient -n', place)).toEqual(['emacsclient', '-n', '+42', '/home/me/repo/stats.py'])
  expect(editorArgv('vim', { file: 'a.sh', line: 3 })).toEqual(['vim', '+3', 'a.sh'])
  expect(editorArgv('', place)).toBe(null)
  expect(hasPlaceholder('code --goto {file}')).toBe(true)
  expect(hasPlaceholder('vim')).toBe(false)
})

sessionTest('with an editor command set, a place a review names opens in the editor instead of the Explain tab', { options: { editor_command: 'emacsclient -n +{line} {file}' } }, async ($, on) => {
  const session = stubSession(on, { allowProcesses: ['emacsclient'] })
  await $.session.start(SESSION)
  await $.command.run(typed('backseat'))
  await session.clock.settle()
  session.write('stats.py', MEAN)
  session.commit('Add mean')
  await session.clock.advance(2000)
  await $.turn.complete(session.finish(1, 'The division at stats.py:2 has nothing for an empty list.'))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  await ui.press({ key: 'jump-stats.py:2' })
  await session.clock.settle()
  expect(session.ran).toContain('emacsclient -n +2 /work/stats.py')
  expect(session.toasts).toContain('Opening stats.py:2 in your editor.')
  // The review stays on screen: nothing moved to Explain.
  expect(await ui.find({ key: 'review' })).toBeDefined()
  await ui.unmount()
})

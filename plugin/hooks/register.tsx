/**
 * The hooks module: every effect the plugin has.
 *
 * Claude Code reads this file to list what the mod hooks and calls, and it
 * refuses a module that passes `$` into a function from another file. So
 * every call on `$` is written here, and the files beside this one hold only
 * pure logic: they take plain values and return plain values.
 */
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mode } from '../types'
import { parseRequest, transition } from './mode'
import { readSettings } from './settings'

const COMMANDS = ['backseat-driver', 'bsd'] as const

const modeAtom = atom({ plugin: 'backseat-driver', key: 'mode' } as const, 'off')

/**
 * The mode is kept twice, because each copy is lost by a different event.
 * `$.state` survives a reload of this module but is reset by /clear, /resume
 * and /branch. This variable survives those but not a reload.
 */
let mode: Mode = 'off'

async function setMode($: EngineInterface, next: Mode): Promise<void> {
  mode = next
  await update($, modeAtom, () => next)
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)

  on('session.start', async ($, e, next) => {
    // After a reload, `$.state` still holds the mode.
    mode = await read($, modeAtom)

    for (const name of COMMANDS) {
      try {
        await $.command.register({
          name,
          description: 'Turn the Backseat Driver tutor on, or off, pause, resume, status',
          argumentHint: '[off | pause | resume | status]',
          immediate: true,
        })
      } catch (error) {
        // A taken name throws. The other command still has to register.
        $.ui.log(`could not register /${name}: ${String(error)}`, { to: 'debug' })
      }
    }

    return next(e)
  })

  // /clear, /resume and /branch reset `$.state` and do not fire `session.start`.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await update($, modeAtom, () => mode)

    return next(e)
  })

  // Spelled out so that `claude plugin validate` can print which commands this answers.
  on('command.run', { command: ['backseat-driver', 'bsd'] }, async ($, e) => {
    const request = parseRequest(e.args)
    const { to, text } = transition(mode, request)
    if (to !== mode) await setMode($, to)
    if (request !== 'status') return { text }

    return { text: `${text} Persona: ${settings.persona}.` }
  })
}

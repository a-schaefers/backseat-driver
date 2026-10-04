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

import type { Mode, Tab } from '../types'
import { reframeInstructions, SESSION_NOTES, stripFrontmatter, tutorSections } from './contract'
import { DENIAL, isUsersFile } from './guard'
import { parseRequest, transition } from './mode'
import { renderPane } from './pane'
import { readSettings } from './settings'

const COMMANDS = ['backseat-driver', 'bsd'] as const

const modeAtom = atom({ plugin: 'backseat-driver', key: 'mode' } as const, 'off')
const tabAtom = atom({ plugin: 'backseat-driver', key: 'tab' } as const, 'play')

/**
 * The mode is kept twice, because each copy is lost by a different event.
 * `$.state` survives a reload of this module but is reset by /clear, /resume
 * and /branch. This variable survives those but not a reload.
 */
let mode: Mode = 'off'

/** The body of skills/tutor/SKILL.md and of the chosen persona, read when the tutor is first needed. */
let contract = ''
let persona = ''
/** The user's home directory, for telling their files from Claude Code's own. */
let home = ''

async function loadTutor($: EngineInterface, personaName: string): Promise<void> {
  const root = $.plugin.root
  contract = stripFrontmatter(await $.fs.read(`${root}/skills/tutor/SKILL.md`))
  persona = ''
  if (personaName !== 'none') {
    try {
      persona = stripFrontmatter(await $.fs.read(`${root}/personas/${personaName}.md`))
    } catch {
      $.ui.log(`no style sheet for persona "${personaName}"`, { to: 'debug' })
    }
  }
  home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')) ?? ''
}

async function openPane($: EngineInterface): Promise<void> {
  await $.ui.open({ id: 'backseat-driver', title: 'Backseat' })
}

/** Moves to `next`, with everything that has to change along with the mode. */
async function switchTo($: EngineInterface, next: Mode, personaName: string): Promise<void> {
  const wasEngaged = mode !== 'off'
  const isEngaged = next !== 'off'
  if (isEngaged && contract === '') await loadTutor($, personaName)

  mode = next
  await update($, modeAtom, () => next)

  if (wasEngaged !== isEngaged) {
    // The instruction files are framed differently while the tutor is on.
    $.ui.invalidate('prompt.context')
    if (isEngaged) await openPane($)
    else await $.ui.close({ id: 'backseat-driver' })
  }
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)

  on('session.start', async ($, e, next) => {
    // After a reload, `$.state` still holds the mode.
    mode = await read($, modeAtom)
    if (mode !== 'off') {
      await loadTutor($, settings.persona)
      await openPane($)
    }

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
    if (to !== mode) await switchTo($, to, settings.persona)
    // Asking for "on" again brings back a pane the user closed by hand.
    else if (request === 'on') await openPane($)
    if (request !== 'status') return { text }

    return { text: `${text} Persona: ${settings.persona}.` }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (mode === 'off' || contract === '') return composed

    return { sections: tutorSections(composed.sections, { contract, extras: [SESSION_NOTES], persona }) }
  })

  on('prompt.context', async ($, e, next) => {
    const context = await next(e)
    if (mode === 'off') return context

    return {
      blocks: context.blocks.map(block =>
        block.name === 'claudeMd' ? { ...block, text: reframeInstructions(block.text) } : block,
      ),
    }
  })

  // The one rule that does not rest on the model: Claude cannot edit the user's files.
  on('tool.call', { tool: ['Edit', 'Write', 'NotebookEdit'] }, ($, e, next) => {
    if (mode === 'off') return next(e)
    const path = e.tool === 'NotebookEdit' ? e.notebook_path : e.file_path

    return isUsersFile(path, home) ? { deny: DENIAL } : next(e)
  })

  on('ui.render', { component: 'Pane', requestId: 'backseat-driver' }, async ($, e) => {
    const view = {
      mode: await read($, modeAtom),
      tab: await read($, tabAtom),
      persona: settings.persona,
    }

    return renderPane($.ui.resolve(e), view, {
      onTab: (tab: Tab) => {
        void update($, tabAtom, () => tab)
      },
    })
  })
}

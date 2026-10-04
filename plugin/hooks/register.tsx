/**
 * The hooks module: every effect the plugin has.
 *
 * Claude Code reads this file to list what the mod hooks and calls, and it
 * refuses a module that passes `$` into a function from another file. So
 * every call on `$` is written here, and the files beside this one hold only
 * pure logic: they take plain values and return plain values. Where that
 * logic needs an effect, it is handed a closure written here.
 */
import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelCompleteResult, Register, Timer } from 'claude-code'

import type { Mode, Note, Tab, Watch } from '../types'
import { reframeInstructions, SESSION_NOTES, stripFrontmatter, tutorSections } from './contract'
import { backoffMs, shouldLook } from './gate'
import { DENIAL, isUsersFile } from './guard'
import { parseRequest, transition } from './mode'
import { applyReply, parseReply } from './notes'
import { renderPane } from './pane'
import { explainRequest, notesContext, playByPlayPrompt, reviewerSystem } from './prompts'
import { readSettings } from './settings'
import type { Settings } from './settings'
import { createWatcher } from './watcher'
import type { Watcher } from './watcher'

const COMMANDS = ['backseat-driver', 'bsd'] as const

/** How often the watcher asks git what changed. A slow answer stretches this by skipping ticks. */
const POLL_MS = 2000
/** Each quarter second a poll takes skips one tick, up to this many. */
const SLOW_POLL_MS = 250
const MAX_SKIPPED_TICKS = 15

const IDLE: Watch = { state: 'idle', lastLookAt: null, detail: '' }

const modeAtom = atom({ plugin: 'backseat-driver', key: 'mode' } as const, 'off')
const tabAtom = atom({ plugin: 'backseat-driver', key: 'tab' } as const, 'play')
const notesAtom = atom({ plugin: 'backseat-driver', key: 'notes' } as const, [])
const selectedAtom = atom({ plugin: 'backseat-driver', key: 'selected' } as const, null)
const watchAtom = atom({ plugin: 'backseat-driver', key: 'watch' } as const, IDLE)

/**
 * The mode is kept twice, because each copy is lost by a different event.
 * `$.state` survives a reload of this module but is reset by /clear, /resume
 * and /branch. This variable survives those but not a reload.
 */
let mode: Mode = 'off'

/** Text read from the plugin's own folder when the tutor is first needed. */
let contract = ''
let persona = ''
let lookInstructions = ''
/** The user's home directory, for telling their files from Claude Code's own. */
let home = ''

/** The play-by-play's working state. None of it outlives a reload: the watcher starts again from the tree as it is. */
let watcher: Watcher | null = null
let timer: Timer | null = null
let nextNoteId = 1
let lastChangeAt: number | null = null
let lastLookAt: number | null = null
let isLooking = false
let isPolling = false
let ticksToSkip = 0
let failures = 0

async function loadTutor($: EngineInterface, personaName: string): Promise<void> {
  const root = $.plugin.root
  contract = stripFrontmatter(await $.fs.read(`${root}/skills/tutor/SKILL.md`))
  lookInstructions = (await $.fs.read(`${root}/prompts/play-by-play.md`)).trim()
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

/** Changes what the pane's status line says about the watcher. */
async function setWatch($: EngineInterface, change: Partial<Watch>): Promise<void> {
  await update($, watchAtom, (watch): Watch => ({ ...watch, ...change }))
}

/** Git in `cwd`, never taking the index lock that the user's own git commands need. */
async function git(
  $: EngineInterface,
  cwd: string | undefined,
  args: readonly string[],
): Promise<{ exitCode: number; stdout: string }> {
  try {
    return await $.process.run(['git', '--no-optional-locks', ...args], { cwd, timeoutMs: 15_000 })
  } catch {
    // Git is missing, or took too long.
    return { exitCode: 1, stdout: '' }
  }
}

function describeFailure(result: Exclude<ModelCompleteResult, { isAnswered: true }>): string {
  if (result.reason === 'api-error') return String(result.error).replaceAll('_', ' ')

  return result.reason === 'aborted' ? 'timed out' : 'empty reply'
}

/** One look: the pending changes go to the play-by-play model, and its reply becomes notes. */
async function look($: EngineInterface, settings: Settings): Promise<void> {
  const active = watcher
  if (isLooking || active === null) return
  isLooking = true
  try {
    const changes = await active.collect()
    if (changes.length === 0) {
      active.settle([])

      return
    }

    await setWatch($, { state: 'looking' })
    const { prompt, shown } = playByPlayPrompt(changes, await read($, notesAtom))
    const result = await $.model.complete({
      model: settings.playByPlay.model,
      effort: settings.playByPlay.thinking,
      system: reviewerSystem(lookInstructions, [], persona),
      prompt,
      maxTokens: 2000,
      timeoutMs: 120_000,
    })
    const now = await $.clock.now()
    lastLookAt = now

    if (!result.isAnswered) {
      // Nothing is settled, so the same changes are tried again after the back-off.
      failures += 1
      await setWatch($, { state: 'failed', lastLookAt: now, detail: describeFailure(result) })

      return
    }

    failures = 0
    // What was shown has been looked at, whether or not the reply can be used.
    active.settle(shown)
    const reply = parseReply(result.text)
    if (reply !== null) {
      const firstId = nextNoteId
      nextNoteId += reply.notes.length
      const paths = shown.map(change => change.path)
      await update($, notesAtom, open => applyReply(open, reply, paths, firstId).notes)
    }
    await setWatch($, { state: 'idle', lastLookAt: now, detail: '' })
  } catch (error) {
    failures += 1
    $.ui.log(`look failed: ${String(error)}`, { to: 'debug' })
    await setWatch($, { state: 'failed', detail: 'an error' })
  } finally {
    isLooking = false
  }
}

/** One poll of the working tree. A poll never calls a model: it only decides whether a look is due. */
async function tick($: EngineInterface, settings: Settings): Promise<void> {
  const active = watcher
  if (isPolling || mode !== 'on' || active === null) return
  if (ticksToSkip > 0) {
    ticksToSkip -= 1

    return
  }

  isPolling = true
  try {
    const started = await $.clock.now()
    const hasChanged = await active.poll()
    const now = await $.clock.now()
    ticksToSkip = Math.min(MAX_SKIPPED_TICKS, Math.floor((now - started) / SLOW_POLL_MS))
    if (hasChanged) lastChangeAt = now

    const isDue = shouldLook({
      now,
      lastChangeAt,
      lastLookAt,
      hasPendingChange: active.hasPending(),
      isLookRunning: isLooking,
      quietMs: settings.playByPlay.quietMs,
      minGapMs: settings.playByPlay.minGapMs,
      backoffMs: backoffMs(failures),
    })
    if (settings.playByPlay.isAutomatic && isDue) void look($, settings)
  } catch (error) {
    $.ui.log(`poll failed: ${String(error)}`, { to: 'debug' })
  } finally {
    isPolling = false
  }
}

function stopWatching(): void {
  timer?.cancel()
  timer = null
  watcher = null
}

/** Starts the watcher from the working tree as it stands now. */
async function startWatching($: EngineInterface, settings: Settings): Promise<void> {
  stopWatching()
  lastChangeAt = null
  lastLookAt = null
  failures = 0
  ticksToSkip = 0

  const top = await git($, undefined, ['rev-parse', '--show-toplevel'])
  const root = top.stdout.trim()
  if (top.exitCode !== 0 || root === '') {
    await setWatch($, { state: 'no-git', lastLookAt: null, detail: '' })

    return
  }

  const started = createWatcher({
    git: args => git($, root, args),
    read: async path => {
      try {
        return await $.fs.read(`${root}/${path}`)
      } catch {
        return null
      }
    },
    stat: async path => {
      try {
        const stat = await $.fs.stat(`${root}/${path}`)

        return stat.kind === 'file' ? { size: stat.size, mtimeMs: stat.mtimeMs } : null
      } catch {
        return null
      }
    },
  })
  await started.start()
  watcher = started
  await setWatch($, IDLE)
  timer = $.clock.every(POLL_MS, () => {
    void tick($, settings)
  })
}

/** Moves to `next`, with everything that has to change along with the mode. */
async function switchTo($: EngineInterface, next: Mode, settings: Settings): Promise<void> {
  const wasEngaged = mode !== 'off'
  const isEngaged = next !== 'off'
  if (isEngaged && contract === '') await loadTutor($, settings.persona)

  mode = next
  await update($, modeAtom, () => next)

  if (wasEngaged === isEngaged) return
  // The instruction files are framed differently while the tutor is on.
  $.ui.invalidate('prompt.context')
  if (isEngaged) {
    await openPane($)
    await startWatching($, settings)
  } else {
    stopWatching()
    await update($, notesAtom, () => [])
    await update($, selectedAtom, () => null)
    await $.ui.close({ id: 'backseat-driver' })
  }
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)

  on('session.start', async ($, e, next) => {
    // After a reload, `$.state` still holds the mode and the notes.
    mode = await read($, modeAtom)
    if (mode !== 'off') {
      const open = await read($, notesAtom)
      nextNoteId = open.reduce((highest, note) => Math.max(highest, note.id), 0) + 1
      await loadTutor($, settings.persona)
      await openPane($)
      await startWatching($, settings)
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
    if (to !== mode) await switchTo($, to, settings)
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

  // The conversation is told what the pane shows, so "explain note 2" means something.
  on('prompt.submit', async ($, e, next) => {
    if (mode === 'off') return next(e)
    const open = await read($, notesAtom)
    if (open.length === 0) return next(e)

    return next({ ...e, context: [...(e.context ?? []), notesContext(open)] })
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
      notes: await read($, notesAtom),
      selected: await read($, selectedAtom),
      watch: await read($, watchAtom),
      isAutomatic: settings.playByPlay.isAutomatic,
    }

    return renderPane($.ui.resolve(e), view, {
      onTab: (tab: Tab) => {
        void update($, tabAtom, () => tab)
      },
      onSelect: (id: number) => {
        void update($, selectedAtom, () => id)
      },
      onExplain: (note: Note) => {
        // Not awaited: it resolves when the turn starts, which may be after the one now running.
        void $.prompt.submit({ text: explainRequest(note), asUser: true })
      },
      onDismiss: (note: Note) => {
        void update($, notesAtom, open => open.filter(other => other.id !== note.id))
      },
      onLook: () => {
        if (mode === 'on') void look($, settings)
      },
    })
  })
}

/**
 * The look: the changes the person has made go to the play-by-play model once,
 * and its reply becomes notes. This is the engine; the program it runs in
 * gives it `LookPorts`, and what it remembers between looks is `LookState`.
 *
 * Moved out of `hooks/register.tsx` with each call made in the order it was
 * made there. A look that is under way is never started a second time, and a
 * failed one settles nothing, so the same changes are tried again.
 */

import type { Note, Profile, Profiles } from '../types'
import { QUIET_LOOKS_BEFORE_REMARK } from './avatar'
import type { Host } from './host'
import { outcomeOf } from './health'
import { sourcePrint } from './knowledge'
import { languageOf } from './languages'
import { applyReply, isProblem, parseReply } from './notes'
import type { Bubble } from './prompts'
import { playByPlayPrompt } from './prompts'
import { GENERAL, isHushed, withFlagged } from './profiles'
import type { KeptInsight } from './project'
import type { Recorder } from './recorder'
import type { Settings } from './settings'
import type { Watcher } from './watcher'

/** What looks remember from one to the next. The pane's line and the next look's time are worked out from it. */
export type LookState = {
  /** A look is under way: another is not started. */
  isLooking: boolean
  /** Looks that failed since one succeeded. */
  failures: number
  /** Why the last one failed, in words, or ''. */
  lookFailure: string
  lastLookAt: number | null
  /** Looks in a row whose reply had nothing for the persona to say. */
  quietLooks: number
  /** The id the next note gets. */
  nextNoteId: number
}

export function freshLookState(): LookState {
  return { isLooking: false, failures: 0, lookFailure: '', lastLookAt: null, quietLooks: 0, nextNoteId: 1 }
}

/** What a look needs from its host. Each is read or done at the moment the look needs it, not before. */
export type LookPorts = Pick<Host, 'now' | 'ask' | 'trace' | 'toast' | 'fail'> & {
  settings: Settings
  /** The watcher of the working tree, or null before there is one. */
  watcher: () => Watcher | null
  /** When the working tree last changed, as far as the scan has seen. */
  lastChangeAt: () => number | null
  /** Puts what the pane says about the look right, and takes the look's deadline away while this one runs. */
  showPlay: () => Promise<unknown>
  holdDeadline: () => void
  /** Plans the next look, and the pane's line, from how this one went. */
  planNext: () => Promise<void>
  /** Brings the languages of the changed files into play. */
  bringIntoPlay: (languages: readonly string[]) => Promise<void>
  /** The deep review's insights that still read as they did for these files. */
  currentInsights: (files: readonly string[]) => Promise<Set<KeptInsight>>
  /** What the deep review knows about the project and these files, or ''. */
  brief: (files: readonly string[], isCurrent: (insight: KeptInsight) => boolean) => string
  /** What the journal says they have been doing, or ''. */
  glance: () => Promise<string>
  /** The reviewer's system prompt, for a look with or without the persona's line. */
  system: (bubble: Bubble | null) => string
  /** What is on record about the person, now. */
  profiles: () => Profiles
  notes: {
    open: () => Promise<Note[]>
    dismissed: () => Promise<Note[]>
    change: (apply: (open: Note[]) => Note[]) => Promise<unknown>
  }
  /** The text of each noted file as the look that raised its notes saw it. */
  notePrints: Map<string, string>
  saveNotes: () => Promise<void>
  /** Changes what is on record about a language, as one step. */
  saveSubject: (subject: string, change: (profile: Profile) => Profile) => Promise<void>
  recorder: () => Recorder | null
  showWorking: (now: number) => Promise<void>
  say: (text: string) => Promise<void>
}

/**
 * One look: the pending changes go to the play-by-play model, and its reply
 * becomes notes. `isAsked` is true when the person pressed "look now".
 */
export async function runLook(ports: LookPorts, state: LookState, isAsked: boolean): Promise<void> {
  const { settings } = ports
  const active = ports.watcher()
  if (state.isLooking || active === null) return
  state.isLooking = true
  ports.holdDeadline()
  try {
    // Said before anything is read, so that a press of "look now" is answered at once.
    await ports.showPlay()
    const changes = await active.collect()
    if (changes.length === 0) {
      active.settle([])
      ports.trace('look', 'nothing to look at', () => ({ isAsked }))
      if (isAsked) ports.toast('Nothing has changed since the last look.')

      return
    }

    ports.trace('look', 'start', () => ({
      isAsked,
      files: changes.map(change => change.path),
      failures: state.failures,
      lastChangeAt: ports.lastChangeAt(),
      lastLookAt: state.lastLookAt,
    }))
    await ports.bringIntoPlay(changes.map(change => languageOf(change.path)).filter(language => language !== null))
    const bubble: Bubble | null = !settings.isAnimated
      ? null
      : state.quietLooks >= QUIET_LOOKS_BEFORE_REMARK
        ? 'remark'
        : 'insight'
    const changedFiles = changes.map(change => change.path)
    const current = await ports.currentInsights(changedFiles)
    const brief = ports.brief(changedFiles, insight => current.has(insight))
    // What the journal says they have been doing, so that the changes are read in the light of it.
    const doing = await ports.glance()
    const { prompt, shown } = playByPlayPrompt(changes, await ports.notes.open(), await ports.notes.dismissed(), bubble, brief, doing)
    const result = await ports.ask('play-by-play', {
      model: settings.playByPlay.model,
      effort: settings.playByPlay.thinking,
      system: ports.system(bubble),
      prompt,
      maxTokens: 2000,
      timeoutMs: 120_000,
    })
    const now = await ports.now()
    state.lastLookAt = now

    const outcome = outcomeOf(result)
    if (!outcome.ok || !result.isAnswered) {
      // Nothing is settled, so the same changes are tried again after the back-off.
      state.failures += 1
      state.lookFailure = outcome.ok ? 'no answer' : outcome.detail

      return
    }

    state.failures = 0
    state.lookFailure = ''
    // What was shown has been looked at, whether or not the reply can be used.
    active.settle(shown)
    const parsed = parseReply(result.text)
    if (parsed === null) ports.trace('look', 'reply not understood', () => ({ text: result.text }))
    if (parsed !== null) {
      // The reviewer is told what was hushed. This makes sure of it.
      const profiles = ports.profiles()
      const reply = {
        ...parsed,
        notes: parsed.notes.filter(note => !isHushed(profiles, languageOf(note.file), note.topic)),
      }
      const firstId = state.nextNoteId
      state.nextNoteId += reply.notes.length
      const paths = shown.map(change => change.path)
      // Read again: a note dismissed while this look ran must not come back with it.
      const dismissed = await ports.notes.dismissed()
      const dealtWith = (await ports.notes.open()).filter(note => reply.resolved.includes(note.id))
      await ports.notes.change(open => applyReply(open, reply, paths, firstId, dismissed).notes)
      // The notes about these files are about the text this look saw.
      for (const change of shown) ports.notePrints.set(change.path, sourcePrint(change.after))
      void ports.saveNotes()

      // Lesson memory: which ideas reached the pane, by language. A repeat
      // of a note that is already open is not a second time it came up.
      const added = (await ports.notes.open()).filter(note => note.id >= firstId)
      const recorder = ports.recorder()
      for (const note of dealtWith) recorder?.add({ at: now, kind: 'fixed', path: note.file, line: note.line, text: note.topic })
      for (const note of added) recorder?.add({ at: now, kind: 'note', path: note.file, line: note.line, text: note.topic })
      recorder?.infer(reply.workingOn, paths, now)
      ports.trace('look', 'done', () => ({
        shown: paths,
        added,
        dealtWith,
        hushedOut: parsed.notes.length - reply.notes.length,
        say: reply.say,
        workingOn: reply.workingOn,
      }))
      await ports.showWorking(now)
      const raised = new Map<string, string[]>()
      // A decision point or an insight is not a mistake, so it is no lesson that keeps coming back.
      for (const note of added.filter(item => isProblem(item.kind))) {
        const subject = languageOf(note.file) ?? GENERAL
        raised.set(subject, [...(raised.get(subject) ?? []), note.topic])
      }
      for (const [subject, topics] of raised) {
        await ports.saveSubject(subject, profile => withFlagged(profile, topics))
      }

      // The persona's line is about this look, so a quiet look leaves it quiet.
      if (bubble !== null) {
        state.quietLooks = reply.say === '' ? state.quietLooks + 1 : 0
        await ports.say(reply.say)
      }
    }
  } catch (error) {
    state.failures += 1
    state.lookFailure = 'an error'
    ports.fail('look failed', error)
  } finally {
    state.isLooking = false
    // The pane's line and the next look both follow from how this one went.
    await ports.planNext()
  }
}

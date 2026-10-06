import { expect, test } from 'claude-code/testing'

import type { Note, Watch } from '../types'
import { NO_VIEW } from '../core/explainer'
import { currentNote, detailMarkdown, explainNotice, FOCUSED_HINT, KEYBOARD_HINT, personaLine, reviewBanner, reviewPlace, reviewSpots, stateMark, statusLine, tabBadge, tabRow, underlineSpans, waitingLine } from '../hooks/pane'
import type { PaneView } from '../hooks/pane'
import { paneContext } from '../core/prompts'
import { readableReview, reviewHistory, shownReview, spotsIn, SURVEY_SUBJECT, withReviewChange } from '../core/review'
import { clockTime, watchOf } from '../core/status'
import { PANE, SESSION, sessionTest, stubSession, typed } from './kit'

const VIEW: PaneView = {
  progress: { isOn: true, identity: [], records: [], busy: '', skipped: '' },
  update: '',
  mode: 'on',
  tab: 'play',
  persona: { voice: 'default', engineering: 'default' },
  notes: [],
  selected: null,
  watch: { state: 'idle', lastLookAt: null, line: 'On. Watching for your next save.' },
  isAutomatic: true,
  review: { state: 'none', subject: '', text: '', isUnseen: false, decisions: [], insights: [] },
  reviewSchedule: 'after each commit',
  profiles: { languages: [], subjects: {} },
  explain: NO_VIEW,
  working: { said: '', saidAgo: '', inferred: '', where: '', share: '' },
  isFocused: true,
  columns: 76,
  character: null,
  isCompact: false,
  layout: 'vertical',
  isUnfolded: false,
  rows: 48,
  settings: [],
}

const note = (id: number, overrides: Partial<Note> = {}): Note => ({
  id,
  file: 'a.py',
  line: 1,
  kind: 'risk',
  topic: `topic-${id}`,
  text: `note ${id}`,
  ...overrides,
})

test('statusLine says what the watcher is doing, in what voice and with whose judgment', async () => {
  expect(statusLine(VIEW)).toBe('On. Watching for your next save.')
  expect(statusLine({ ...VIEW, persona: { voice: 'eli5-tldr-kiss-terse', engineering: 'knuth' } })).toBe(
    'On. Watching for your next save. Voice: eli5-tldr-kiss-terse. Engineering: knuth.',
  )
  // The sentence is the play-by-play's own (status.test.ts). The pane prints it, and knows about being paused by itself.
  expect(statusLine({ ...VIEW, watch: { state: 'waiting', lastLookAt: 1, line: 'On. Claude is overloaded. Next try 12:07.' } })).toBe(
    'On. Claude is overloaded. Next try 12:07.',
  )
  expect(statusLine({ ...VIEW, mode: 'paused' })).toBe('Paused. /bsd resume to continue.')
})

test('personaLine leaves out a half that is the default, and names a persona chosen for both once', async () => {
  expect(personaLine({ voice: 'default', engineering: 'default' })).toBe('')
  expect(personaLine({ voice: 'torvalds', engineering: 'default' })).toBe('Voice: torvalds.')
  expect(personaLine({ voice: 'default', engineering: 'primeagen' })).toBe('Engineering: primeagen.')
  expect(personaLine({ voice: 'knuth', engineering: 'knuth' })).toBe('Voice and engineering: knuth.')
  expect(personaLine({ voice: 'torvalds', engineering: 'knuth' })).toBe('Voice: torvalds. Engineering: knuth.')
})

test('currentNote is the selected note while it is open, otherwise the most important one', async () => {
  const notes = [note(1, { kind: 'tip' }), note(2, { kind: 'bug' })]

  expect(currentNote({ notes, selected: null })?.id).toBe(2)
  expect(currentNote({ notes, selected: 1 })?.id).toBe(1)
  expect(currentNote({ notes, selected: 99 })?.id).toBe(2)
  expect(currentNote({ notes: [], selected: 1 })).toBeUndefined()
})

sessionTest('the pane opens on the play-by-play and switches tabs, on every surface that draws panes', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'On. Watching for your next save.' })).toBeDefined()

    await ui.press({ key: 'tab-review' })
    expect(await ui.find({ type: 'Text', text: 'No deep review yet.' })).toBeDefined()

    await ui.press({ key: 'tab-profile' })
    expect(await ui.find({ type: 'Text', text: 'Judged only on commits by me@example.com, and only on the lines they add.' })).toBeDefined()

    await ui.press({ key: 'tab-play' })
    await ui.unmount()
  }
})

sessionTest('the pane shows a pause', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  await $.command.run(typed('bsd', 'pause'))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Paused' })).toBeDefined()
  await ui.unmount()
})

sessionTest('the pane says how to give it the keyboard, until it has it', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const away = await $.ui.mount({ ...PANE, props: { ...PANE.props, isFocused: false }, surface: 'terminal' })
  expect(await away.find({ type: 'Text', text: 'Keys off' })).toBeDefined()
  expect(await away.find({ type: 'Text', text: KEYBOARD_HINT })).toBeDefined()
  await away.unmount()

  // With the keyboard, the last row says how the pane is driven instead.
  const focused = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await focused.findAll({ type: 'Text', text: KEYBOARD_HINT })).length).toBe(0)
  expect(await focused.find({ type: 'Text', text: 'Keys on' })).toBeDefined()
  expect(await focused.find({ type: 'Text', text: FOCUSED_HINT })).toBeDefined()
  await focused.unmount()
})

test('the tab bar is underlined under the open tab, measured as the buttons draw', () => {
  const labels = ['Play (2)', 'Review (new)', 'Explain', 'Growth', 'Lessons', 'Settings']
  // With its digit a button is its key, a colon, a space and its label: "1: Play (2)" is 11 wide.
  expect(underlineSpans(labels, 2, true, 0, 80)).toEqual({ before: 0, active: 11, after: 69 })
  expect(underlineSpans(labels, 2, true, 1, 80)).toEqual({ before: 13, active: 15, after: 52 })
  // Without digits (a band without the keyboard), the labels alone.
  expect(underlineSpans(labels, 1, false, 2, 60)).toEqual({ before: 22, active: 7, after: 31 })
  // A row wider than the pane leaves nothing after.
  expect(underlineSpans(labels, 3, true, 5, 40).after).toBe(0)
})

test('the status line carries a light for what the play-by-play is doing', () => {
  const at = (state: Watch['state']) => ({ mode: 'on' as const, watch: { ...VIEW.watch, state } })
  expect(stateMark(at('idle'))).toEqual({ mark: '●', color: 'green' })
  expect(stateMark(at('looking'))).toEqual({ mark: '◐', color: 'yellow' })
  expect(stateMark(at('settling')).color).toBe('yellow')
  expect(stateMark(at('waiting')).color).toBe('yellow')
  expect(stateMark(at('no-git')).color).toBe('red')
  expect(stateMark(at('starting')).color).toBeUndefined()
  // Paused is out, whatever the watcher last was.
  expect(stateMark({ mode: 'paused', watch: { ...VIEW.watch, state: 'looking' } })).toEqual({ mark: '○', color: undefined })
})

test('just switched on, the pane says it is getting ready', async () => {
  expect(statusLine({ ...VIEW, watch: watchOf({ at: 'starting' }, null) })).toBe('On. Getting ready.')
})

const DONE = { ...VIEW.review, state: 'done' as const, subject: 'commit aaaaaaa: Add mean', text: 'Good.', decisions: [], insights: ['stats.py: sorted copies.'] }

test('a tab says what is going on behind it', async () => {
  expect(tabBadge('play', VIEW)).toBe('')
  expect(tabBadge('play', { ...VIEW, notes: [note(1), note(2), note(3)] })).toBe(' (3)')
  expect(tabBadge('review', VIEW)).toBe('')
  expect(tabBadge('review', { review: { ...DONE, isUnseen: true } })).toBe(' (new)')
  expect(tabBadge('review', { review: DONE })).toBe('')
  expect(tabBadge('review', { review: { ...DONE, state: 'running' } })).toBe(' (…)')
  expect(tabBadge('review', { review: { ...DONE, state: 'failed' } })).toBe(' (!)')
  expect(tabBadge('explain', { explain: { ...NO_VIEW, status: 'updating' } })).toBe(' (…)')
  expect(tabBadge('explain', { explain: { ...NO_VIEW, status: 'fresh' } })).toBe('')
  expect(tabBadge('profile', { progress: { ...VIEW.progress, busy: 'Looking at commit aaaaaaa' } })).toBe(' (…)')
  expect(tabBadge('profile', VIEW)).toBe('')
})

test('the tab row keeps what the tabs say for as long as there is room, and never wraps', async () => {
  const busy = { ...VIEW, notes: [note(1), note(2)], review: { ...DONE, isUnseen: true }, explain: { ...NO_VIEW, status: 'updating' as const } }
  expect(tabRow({ ...busy, columns: 98 })).toEqual({ labels: ['Play-by-play (2)', 'Deep review (new)', 'Explain (…)', 'Growth', 'Lessons', 'Settings'], gap: 3 })
  // Too narrow for the full names: the short ones, still saying it.
  expect(tabRow({ ...busy, columns: 80 })).toEqual({ labels: ['Play (2)', 'Review (new)', 'Explain (…)', 'Growth', 'Lessons', 'Settings'], gap: 2 })
  expect(tabRow({ ...busy, columns: 75 })).toEqual({ labels: ['Play (2)', 'Review (new)', 'Explain (…)', 'Growth', 'Lessons', 'Settings'], gap: 1 })
  // Narrower still: the review's word is the one that asks for a look, so it is the one kept.
  expect(tabRow({ ...busy, columns: 72 })).toEqual({ labels: ['Play', 'Review (new)', 'Explain', 'Growth', 'Lessons', 'Settings'], gap: 2 })
  expect(tabRow({ ...busy, columns: 67 })).toEqual({ labels: ['Play', 'Review (new)', 'Explain', 'Growth', 'Lessons', 'Settings'], gap: 1 })
  // A docked pane: the longest names give way.
  expect(tabRow({ ...busy, columns: 64 })).toEqual({ labels: ['Play', 'Review (new)', 'Expl', 'Growth', 'Lessons', 'Set'], gap: 1 })
  // The owner's 57-column dock (2026-10-05): not even that fit, and "Set" wrapped onto the status line. The badge shrinks to a mark.
  expect(tabRow({ ...busy, columns: 57 })).toEqual({ labels: ['Play', 'Review*', 'Expl', 'Growth', 'Lessons', 'Set'], gap: 1 })
  expect(tabRow({ ...busy, review: DONE, columns: 57 })).toEqual({ labels: ['Play', 'Review', 'Expl', 'Growth', 'Lessons', 'Set'], gap: 1 })
  // Every row fits its pane.
  for (const columns of [98, 80, 75, 72, 67, 64, 57]) {
    const row = tabRow({ ...busy, columns })
    expect(row.labels.reduce((sum, label) => sum + label.length + 3, 0) + row.gap * 5 <= columns).toBe(true)
  }
})

test('a review that finished stays in the tab while the next one runs, waits or fails', async () => {
  const running = withReviewChange(DONE, { state: 'running', subject: 'commit bbbbbbb: Add total', text: '', decisions: [], insights: [], since: new Date(2026, 9, 4, 12, 1).getTime() })
  expect(running.last).toEqual({ subject: 'commit aaaaaaa: Add mean', text: 'Good.', decisions: [], insights: ['stats.py: sorted copies.'] })
  expect(readableReview(running)?.subject).toBe('commit aaaaaaa: Add mean')
  expect(reviewBanner(running)).toBe('Reviewing commit bbbbbbb: Add total since 12:01.')

  // It fails: the one before is still there to read, under why.
  const failed = withReviewChange(running, { state: 'failed', text: 'overloaded. It is tried again at 12:07, or press r.' })
  expect(failed.last?.text).toBe('Good.')
  expect(reviewBanner(failed)).toBe('The review of commit bbbbbbb: Add total did not finish: overloaded. It is tried again at 12:07, or press r.')
  // Tried again, and done: the new one is what there is to read, and nothing is kept behind it.
  const again = withReviewChange(failed, { state: 'running', text: '' })
  expect(again.last?.text).toBe('Good.')
  const done = withReviewChange(again, { state: 'done', text: 'Better.', decisions: [], insights: [] })
  expect(done.last).toBe(null)
  expect(readableReview(done)).toEqual({ subject: 'commit bbbbbbb: Add total', text: 'Better.', decisions: [], insights: [] })
  expect(reviewBanner(done)).toBe('')

  // A change that says nothing about the state leaves it all alone.
  expect(withReviewChange(running, { isUnseen: false }).last).toEqual(running.last)
  expect(readableReview(VIEW.review)).toBe(null)
  expect(reviewBanner({ ...VIEW.review, state: 'running', subject: SURVEY_SUBJECT })).toBe('Taking a first look around this project.')
  expect(reviewBanner({ ...VIEW.review, state: 'running', subject: 'your uncommitted work' })).toBe('Reviewing your uncommitted work.')
})

test('the tab says how many commits wait behind the one being reviewed', async () => {
  expect(waitingLine(VIEW.review)).toBe('')
  expect(waitingLine({ ...VIEW.review, waiting: 1 })).toBe('')
  expect(waitingLine({ ...VIEW.review, waiting: 2 })).toBe('One more commit is waiting for its review.')
  expect(waitingLine({ ...VIEW.review, waiting: 3 })).toBe('2 more commits are waiting for their reviews.')
})

test('the conversation is told about the review in front of the person, also while a newer one is on its way', async () => {
  expect(paneContext([], DONE)).toMatch('this deep review of commit aaaaaaa: Add mean')
  const running = withReviewChange(DONE, { state: 'running', subject: 'commit bbbbbbb: Add total', text: '' })
  expect(paneContext([], running)).toMatch('this deep review of commit aaaaaaa: Add mean')
  expect(paneContext([], running)).toMatch('Good.')
  expect(paneContext([], { ...VIEW.review, state: 'running', subject: 'commit bbbbbbb: Add total' })).toBe('')
})

const MEAN_PY = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const QUIET_PANE = { options: { explain: 'off', animated_persona: false, progress_report: false } } as const

sessionTest('the last review stays readable while the next commit is reviewed', { options: { ...QUIET_PANE.options, play_by_play: 'on request' } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN_PY } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN_PY}# one\n`)
  session.commit('One')
  await session.clock.advance(2000)
  await $.turn.complete(session.finish(1, 'The first review.'))
  await session.clock.settle()

  session.write('stats.py', `${MEAN_PY}# one\n# two\n`)
  session.commit('Two')
  session.write('stats.py', `${MEAN_PY}# one\n# two\n# three\n`)
  session.commit('Three')
  await session.clock.advance(2000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ type: 'Text', text: `Reviewing commit 0000000: Three since ${clockTime(session.clock.now())}.` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'The review before it:' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: 'The first review.' })).toBeDefined()

  await $.turn.complete(session.finish(2, 'The second review.'))
  await session.clock.settle()
  expect(await ui.find({ type: 'Markdown', text: 'The second review.' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: 'The first review.' })).toBe(undefined)
  expect(await ui.find({ type: 'Text', text: 'The review before it:' })).toBe(undefined)
  await ui.unmount()
})

sessionTest('a row under the status line says when Claude is not answering and nothing is waiting on it', { options: { ...QUIET_PANE.options, play_by_play: 'on request' } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN_PY } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Background work waits until' })).toBe(undefined)

  // The conversation's own turn died on an overload: every background job waits, and the pane says so.
  await $.classic.StopFailure({ error: 'overloaded' })
  await session.clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Claude is overloaded. Background work waits until' })).toBeDefined()
  // An answer ends it.
  await $.turn.complete(session.turnEnded())
  await session.clock.settle()
  expect(await ui.find({ type: 'Text', text: 'Background work waits until' })).toBe(undefined)
  await ui.unmount()
})

sessionTest('/clear empties the state the pane lives in, and the pane is put back as it was', QUIET_PANE, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN_PY } })
  session.reply({ resolved: [], notes: [{ file: 'stats.py', line: 1, kind: 'bug', topic: 'empty-input', note: 'An empty list divides by zero.' }] })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', `${MEAN_PY}\ndef total(xs):\n    return sum(xs)\n`)
  await session.clock.advance(14_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'An empty list divides by zero.' })).toBeDefined()

  // The conversation is cleared. What the pane showed is read out before the state goes.
  await $.session.end({ reason: 'clear', sessionId: session.sessionId, resume: { sessionId: session.sessionId } as never })
  // The kit cannot empty the state, so the note is taken out of it by hand, as the reset would.
  await ui.press({ key: 'dismiss' })
  expect(await ui.find({ type: 'Text', text: 'No notes. Keep going.' })).toBeDefined()

  await $.classic.SessionStart({ source: 'clear' })
  await session.clock.settle()
  expect(await ui.find({ type: 'Text', text: 'An empty list divides by zero.' })).toBeDefined()
  await ui.unmount()
})

test('the review history lists the readable review once, then the older ones, and the tab walks it', async () => {
  const older = [
    { subject: 'commit aaaaaaa: Add mean', text: 'Good.', decisions: [], insights: [], at: new Date(2026, 9, 5, 19, 57).getTime(), commit: 'aaaaaaa' },
    { subject: 'commit 9999999: First commit', text: 'Six lines.', decisions: [], insights: [], at: new Date(2026, 9, 5, 18, 35).getTime(), commit: '9999999' },
  ]
  const done = { ...DONE, older }
  // The readable review is reviews.json's first entry: listed once.
  expect(reviewHistory(done).map(r => r.subject)).toEqual(['commit aaaaaaa: Add mean', 'commit 9999999: First commit'])
  expect(shownReview(done)).toEqual({ shown: older[0], index: 0, count: 2 })
  expect(shownReview({ ...done, opened: 1 }).shown?.subject).toBe('commit 9999999: First commit')
  // Out of range stays in range; a review that lands comes back to the latest.
  expect(shownReview({ ...done, opened: 7 }).index).toBe(1)
  expect(withReviewChange({ ...done, opened: 1 }, { state: 'done', subject: 'commit ccccccc: More', text: 'Fine.' }).opened).toBe(0)
  // A review by hand that reviews.json does not hold yet is listed first.
  const byHand = { ...done, subject: 'the work since the last review', text: 'Looks fine.' }
  expect(reviewHistory(byHand).length).toBe(3)
  expect(reviewPlace(1, 3, older[1]?.at)).toBe(`Review 2 of 3 · ${clockTime(older[1]?.at ?? 0)}`)
  expect(reviewPlace(0, 2, undefined)).toBe('Review 1 of 2')
})

test('the places a review names are what the person can jump to', async () => {
  const text = 'See playground.sh:24 and src/stats.py:6, again playground.sh:24. Not a time like 19:57, not v1.2:3, and tests/a_b.test.ts:120 counts.'
  expect(spotsIn(text)).toEqual([
    { path: 'playground.sh', line: 24 },
    { path: 'src/stats.py', line: 6 },
    { path: 'tests/a_b.test.ts', line: 120 },
  ])
  expect(spotsIn('one a.py:1, two b.py:2, three c.py:3, four d.py:4, five e.py:5').length).toBe(4)
  // Decisions come first, then what the text and the insights name.
  const shown = { text: 'The *) branch at playground.sh:24 exits 0.', decisions: [{ file: 'playground.sh', line: 6, choice: 'shuf', tradeoff: '' }], insights: ['playground.sh:11: debug output.'] }
  expect(reviewSpots(shown)).toEqual([
    { path: 'playground.sh', line: 6 },
    { path: 'playground.sh', line: 24 },
    { path: 'playground.sh', line: 11 },
  ])
})

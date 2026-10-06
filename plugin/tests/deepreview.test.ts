import { clockTime } from '../core/status'
import { expect, test } from 'claude-code/testing'

import type { Review } from '../types'

import { reviewSchedule } from '../hooks/pane'
import { paneContext } from '../core/prompts'
import {
  commitTitle,
  fitReview,
  isCommit,
  isEmptyScope,
  parseReflog,
  reviewRequest,
  scopePrint,
  scopeSubject,
} from '../core/review'
import type { ReviewScope } from '../core/review'
import { commitHash, finished, PANE, SESSION, sessionTest, stubSession, typed } from './kit'

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const HASH = commitHash(2)

test('parseReflog and isCommit tell a commit from other moves of HEAD', async () => {
  const commit = parseReflog(`${HASH}\0commit: Add mean\n`)
  expect(commit).toEqual({ hash: HASH, subject: 'commit: Add mean' })
  if (commit === null) return

  expect(isCommit(commit)).toBe(true)
  expect(commitTitle(commit)).toBe('Add mean')
  expect(isCommit({ hash: HASH, subject: 'commit (amend): Add mean' })).toBe(true)
  expect(isCommit({ hash: HASH, subject: 'commit (initial): Start' })).toBe(true)
  for (const subject of ['checkout: moving from main to x', 'pull: Fast-forward', 'rebase (finish): returning', 'reset: moving to HEAD~1']) {
    expect(isCommit({ hash: HASH, subject })).toBe(false)
  }
  expect(parseReflog('')).toBe(null)
  expect(parseReflog('not a hash\0commit: x')).toBe(null)
})

test('a review request carries the scope, and a huge patch is cut', async () => {
  const commit: ReviewScope = { kind: 'commit', hash: HASH, title: 'Add mean', patch: 'PATCH' }
  expect(scopeSubject(commit)).toBe('commit 0000000: Add mean')
  expect(reviewRequest(commit)).toMatch('Review this commit.')
  expect(reviewRequest(commit)).toMatch('PATCH')

  const since: ReviewScope = { kind: 'since', from: HASH, log: '', diff: 'DIFF', untracked: ['new.py'] }
  expect(scopeSubject(since)).toBe('your uncommitted work')
  expect(scopeSubject({ ...since, log: 'abc1234 Add median' })).toBe('your work since 0000000')
  expect(reviewRequest(since)).toMatch('Commits since then:\n(none)')
  expect(reviewRequest(since)).toMatch('- new.py')

  const huge = reviewRequest({ ...commit, patch: 'x'.repeat(100_000) })
  expect(huge.length < 62_000).toBe(true)
  expect(huge).toMatch('Cut here: 40000 more characters')
})

test('an empty scope and an unchanged scope are told apart from new work', async () => {
  const since: ReviewScope = { kind: 'since', from: HASH, log: '', diff: '', untracked: [] }
  expect(isEmptyScope(since)).toBe(true)
  expect(isEmptyScope({ ...since, untracked: ['new.py'] })).toBe(false)
  expect(scopePrint({ ...since, diff: 'a' })).toBe(scopePrint({ ...since, diff: 'a' }))
  expect(scopePrint({ ...since, diff: 'a' })).not.toBe(scopePrint({ ...since, diff: 'b' }))
})

test('fitReview and reviewSchedule', async () => {
  expect(fitReview('  ok  ')).toBe('ok')
  expect(fitReview('x'.repeat(20_000)).length < 10_000).toBe(true)
  expect(reviewSchedule(true, 0)).toBe('after each commit')
  expect(reviewSchedule(true, 900_000)).toBe('after each commit and every 15 minutes')
  expect(reviewSchedule(false, 300_000)).toBe('every 5 minutes')
  expect(reviewSchedule(false, 0)).toBe('only when you ask')
})

test('paneContext tells the conversation about a finished review', async () => {
  const none: Review = { state: 'none', subject: '', text: '', isUnseen: false, decisions: [], insights: [] }
  expect(paneContext([], none)).toBe('')
  expect(paneContext([], { state: 'done', subject: 'commit abc: X', text: 'REVIEW', isUnseen: true, decisions: [], insights: [] })).toMatch('REVIEW')
  expect(paneContext([], { state: 'running', subject: 'commit abc: X', text: '', isUnseen: false, decisions: [], insights: [] })).toBe('')
})

sessionTest('a commit is reviewed by the registered reviewer, and the review lands in the pane', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  // Registered with the default deep review model and thinking level, and read-only tools.
  const reviewer = session.agents[session.agents.length - 1]
  expect(reviewer?.name).toBe('deep-reviewer')
  expect(reviewer?.model).toBe('opus')
  expect(reviewer?.effort).toBe('high')
  expect(reviewer?.tools).toEqual(['Read', 'Grep', 'Glob'])
  expect(reviewer?.prompt).toBe('DEEP REVIEW INSTRUCTIONS')

  session.write('stats.py', MEAN)
  const hash = session.commit('Add mean')
  await session.clock.advance(2000)

  expect(session.spawned.length).toBe(1)
  expect(session.spawned[0]?.type).toBe('backseat-driver:deep-reviewer')
  expect(session.spawned[0]?.prompt).toMatch('Review this commit.')
  expect(session.spawned[0]?.prompt).toMatch(`commit ${hash}`)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ type: 'Text', text: `Reviewing commit 0000000: Add mean since ${clockTime(session.clock.now())}.` })).toBeDefined()

  await $.turn.complete(session.finish(1, 'Good change. `mean` fails on an empty list.'))
  expect(await ui.find({ type: 'Markdown', text: '`mean` fails on an empty list.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Commit 0000000: Add mean' })).toBeDefined()
  await ui.unmount()

  // Nothing went into the conversation.
  expect(session.submitted).toEqual([])
})

sessionTest('a finished review is announced when the tab is not open', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', MEAN)
  session.commit('Add mean')
  await session.clock.advance(2000)
  await $.turn.complete(session.finish(1, 'Looks fine.'))

  expect(session.toasts).toEqual(['Deep review ready: commit 0000000: Add mean'])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // The test's pane is 60 columns wide, where the five tabs go by their short names.
  expect(await ui.find({ key: 'tab-review', text: 'Review (new)' })).toBeDefined()
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ key: 'tab-review', text: 'Review (new)' })).toBeUndefined()
  expect(await ui.find({ key: 'tab-review', text: 'Review' })).toBeDefined()
  await ui.unmount()
})

sessionTest('the chosen model and thinking level are what the reviewer is registered with', { options: { deep_review_model: 'fable', deep_review_thinking: 'max', voice: 'torvalds', engineering: 'knuth' } }, async ($, on) => {
  const session = stubSession(on, {
    pluginFiles: { '/personas/voice/torvalds.md': '# Voice: torvalds\n', '/personas/engineering/knuth.md': '# Engineering: knuth\n' },
  })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const reviewer = session.agents[session.agents.length - 1]
  expect(reviewer?.model).toBe('fable')
  expect(reviewer?.effort).toBe('max')
  expect(reviewer?.prompt).toBe('DEEP REVIEW INSTRUCTIONS\n\n# Engineering: knuth\n\n# Voice: torvalds')
})

sessionTest('a checkout is not a commit, and deep reviews start afresh after it', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.checkout()
  await session.clock.advance(10_000)
  expect(session.spawned).toEqual([])
})

sessionTest('with "after each commit" off, a commit is not reviewed', { options: { deep_review_after_commit: false } }, async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', MEAN)
  session.commit('Add mean')
  await session.clock.advance(60_000)
  expect(session.spawned).toEqual([])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ type: 'Text', text: 'One runs only when you ask.' })).toBeDefined()
  await ui.unmount()
})

// The animated persona is off here. One 5-minute period of the review timer has to run every poll tick in
// it within one hook's ten seconds, which a busy machine has overrun, and the character's blinks add to them.
sessionTest('the timer reviews everything since the previous review, and skips when nothing changed', { options: { deep_review_after_commit: false, deep_review_every: '5 minutes', play_by_play: 'on request', animated_persona: false } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  // Nothing has changed: the first tick of the timer does nothing.
  await session.clock.advance(300_000)
  expect(session.spawned).toEqual([])

  session.write('stats.py', `${MEAN}\ndef total(xs):\n    return sum(xs)\n`)
  session.write('fresh.py', 'x = 1\n')
  await session.clock.advance(300_000)
  // Under heavy load the review the timer started had once not finished spawning when `advance` resolved.
  await session.clock.settle()
  expect(session.spawned.length).toBe(1)
  expect(session.spawned[0]?.prompt).toMatch('Review the work done since your previous review.')
  expect(session.spawned[0]?.prompt).toMatch('def total(xs):')
  expect(session.spawned[0]?.prompt).toMatch('- fresh.py')

  await $.turn.complete(session.finish(1, 'Fine.'))
  // The same uncommitted work is not reviewed twice.
  await session.clock.advance(300_000)
  expect(session.spawned.length).toBe(1)
})

sessionTest('"review now" works without waiting for a commit or the timer', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': MEAN } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ type: 'Text', text: 'No deep review yet. One runs after each commit.' })).toBeDefined()

  // With nothing new, it reviews the last commit.
  await ui.press({ key: 'review-now' })
  expect(session.spawned.length).toBe(1)
  expect(session.spawned[0]?.prompt).toMatch('Review this commit.')

  // While one runs, asking again does not start a second.
  await ui.press({ key: 'review-now' })
  expect(session.spawned.length).toBe(1)
  expect(session.toasts).toEqual(['A deep review is already running.'])
  await ui.unmount()
})

sessionTest('a commit made while a review runs is reviewed next', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', MEAN)
  session.commit('Add mean')
  await session.clock.advance(2000)
  session.write('stats.py', `${MEAN}# more\n`)
  session.commit('Add a comment')
  await session.clock.advance(2000)
  expect(session.spawned.length).toBe(1)

  await $.turn.complete(session.finish(1, 'First review.'))
  expect(session.spawned.length).toBe(2)
  expect(session.spawned[1]?.prompt).toMatch('Add a comment')
})

sessionTest('the tab walks back to earlier reviews, and a place a review names is a jump to Explain', async ($, on) => {
  // The owner (2026-10-05): a review said "the $$ point from last review is still open", and there was no way to the last review.
  // The kit's commits share one short hash, and a commit's review replaces the review of that commit: the first review here
  // is one of uncommitted work, by hand, which is kept apart.
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', MEAN)
  await session.clock.advance(2000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  await ui.press({ key: 'review-now' })
  await $.turn.complete(session.finish(1, 'The division at stats.py:2 has nothing for an empty list.'))
  await session.clock.settle()
  session.commit('Add mean')
  await session.clock.advance(2000)
  const second = 'The empty-list point from the last review is still open at stats.py:2, and stats.py:4 is new.'
  await $.turn.complete(session.finish(2, second))
  await session.clock.settle()

  const reading = async () => (await ui.find({ key: 'review' }))?.props.text
  expect(await reading()).toBe(second)
  expect(await ui.find({ key: 'review-older' })).toBeDefined()
  expect(await ui.find({ key: 'review-newer' })).toBeUndefined()
  // Two places fold under one heading, which opens them downward (the owner, 2026-10-05: a row "does not scale well").
  expect(await ui.find({ key: 'jump-list' })).toBeDefined()
  expect(await ui.find({ key: 'jump-stats.py:4' })).toBeUndefined()
  await ui.press({ key: 'jump-list' })
  expect(await ui.find({ key: 'jump-stats.py:4' })).toBeDefined()
  expect(await ui.find({ key: 'jump-stats.py:2' })).toBeDefined()

  // p goes to the review before it, and n back.
  await ui.press({ key: 'review-older' })
  expect(await reading()).toBe('The division at stats.py:2 has nothing for an empty list.')
  expect(await ui.find({ key: 'review-older' })).toBeUndefined()
  // One place is a row by itself, and the row opens Explain there.
  expect(await ui.find({ key: 'jump-list' })).toBeUndefined()
  await ui.press({ key: 'jump-stats.py:2' })
  expect(await ui.find({ type: 'Text', text: 'stats.py' })).toBeDefined()
  await ui.press({ key: 'tab-review' })
  await ui.press({ key: 'review-newer' })
  expect(await reading()).toBe(second)
  // Folded again after the jump and the change of tab.
  expect(await ui.find({ key: 'jump-list' })).toBeDefined()
  expect(await ui.find({ key: 'jump-stats.py:4' })).toBeUndefined()
  await ui.unmount()
})

sessionTest('a review that fails says so in the pane', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  session.write('stats.py', MEAN)
  session.commit('Add mean')
  await session.clock.advance(2000)

  await $.turn.complete(session.finish(1, '', 'error'))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ type: 'Text', text: 'did not finish: error' })).toBeDefined()
  await ui.unmount()
})

sessionTest("another subagent's answer is left alone", async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(await $.turn.complete(finished('someone-else', 'unrelated'))).toEqual({ text: '' })
  expect(session.toasts).toEqual([])
})

sessionTest('the reviewer is offered to the model only while the tutor is on', async ($, on) => {
  const session = stubSession(on)
  await $.session.start(SESSION)
  const offer = {
    agent: 'backseat-driver:deep-reviewer',
    description: 'reviewer',
    source: 'plugin',
    provider: { plugin: 'backseat-driver', tier: 'user' },
  } as const

  expect(await $.agent.offer(offer)).toEqual({ isOffered: false })
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(await $.agent.offer(offer)).toEqual({ isOffered: true })
})

sessionTest('at the plan limit, a commit is not reviewed until the user asks', async ($, on) => {
  const session = stubSession(on)
  session.limits.push({ kind: 'five_hour', percentUsed: 96 })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', MEAN)
  session.commit('Add mean')
  await session.clock.advance(4000)
  expect(session.spawned).toEqual([])

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ type: 'Text', text: 'you are close to your plan limit. Press r to run it anyway.' })).toBeDefined()

  await ui.press({ key: 'review-now' })
  expect(session.spawned.length).toBe(1)
  expect(session.spawned[0]?.prompt).toMatch('Add mean')
  await ui.unmount()
})

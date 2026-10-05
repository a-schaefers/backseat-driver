import { expect, test } from 'claude-code/testing'

import { projectId } from '../core/datahome'
import { fingerprint } from '../core/hash'
import { sourcePrint } from '../core/knowledge'
import {
  emptyProject,
  insightLine,
  insightsFor,
  overviewLine,
  parseProject,
  parseReviews,
  projectBrief,
  reviewDigest,
  splitReview,
  withReview,
  withReviewNotes,
} from '../core/project'
import type { KeptInsight } from '../core/project'
import { playByPlayPrompt } from '../core/prompts'
import { reviewRequest, scopeSubject } from '../core/review'
import { PANE, ROOT, SESSION, sessionTest, stubSession, typed } from './kit'

const STATS = [
  'def mean(xs):',
  '    return sum(xs) / len(xs)',
  '',
  '',
  'def variance(xs):',
  '    m = mean(xs)',
  '    return sum((x - m) ** 2 for x in xs) / len(xs)',
  '',
].join('\n')

const NOTES = {
  overview: 'A small statistics library with no dependencies.',
  files: [{ file: 'stats.py', role: 'Every helper lives here.' }],
  insights: [{ file: 'stats.py', symbol: 'variance', text: 'Divides by n, so it is the population variance.' }],
  decisions: [],
}
const INSIGHT = 'Deep review: Divides by n, so it is the population variance. (deep review of 0000000)'
const REVIEW = `Nice and small.\n\n- \`stats.py:7\`: think about which variance this is.\n\n\`\`\`backseat-notes\n${JSON.stringify(NOTES)}\n\`\`\`\n`

test('splitReview takes the notes off the end of a review, whether or not they parse', async () => {
  const split = splitReview(REVIEW)
  expect(split.text).toBe('Nice and small.\n\n- `stats.py:7`: think about which variance this is.')
  expect(split.notes).toEqual(NOTES)

  // A block that is not JSON is still never shown.
  const broken = splitReview('Fine.\n\n```backseat-notes\n{"overview": "cut off\n```')
  expect(broken).toEqual({ text: 'Fine.', notes: null })
  expect(splitReview('Fine. No notes.')).toEqual({ text: 'Fine. No notes.', notes: null })

  // Paths that could not be files of the project are dropped, and so is anything without its text.
  const odd = splitReview('```backseat-notes\n{"overview": 7, "files": [{"file": "../x", "role": "r"}, {"file": "a.py"}], "insights": [{"file": "/etc/passwd", "text": "t"}, {"file": "./a.py", "symbol": 3, "text": "kept"}]}\n```')
  expect(odd.notes).toEqual({ overview: '', files: [], insights: [{ file: 'a.py', symbol: '', text: 'kept' }], decisions: [] })
})

test('withReviewNotes: newer notes replace older ones about the same thing, and an overview is kept until a new one comes', async () => {
  const first = withReviewNotes(emptyProject('/work'), NOTES, 'aaa1111', 100, () => ({ print: 'p1', of: 'symbol' }))
  expect(first.overview).toBe('A small statistics library with no dependencies.')
  expect(first.overviewCommit).toBe('aaa1111')
  expect(first.roles).toEqual({ 'stats.py': 'Every helper lives here.' })
  expect(first.insights).toEqual([{ ...NOTES.insights[0], commit: 'aaa1111', at: 100, print: 'p1', of: 'symbol' }])

  const next = withReviewNotes(
    first,
    { overview: '', files: [], insights: [{ file: 'stats.py', symbol: 'variance', text: 'Now divides by n - 1.' }, { file: 'stats.py', symbol: 'mean', text: 'Fails on an empty list.' }], decisions: [] },
    'bbb2222',
    200,
    insight => (insight.symbol === 'mean' ? null : { print: 'p2', of: 'symbol' }),
  )
  // No new overview, so the old one stands, with the commit it was written at.
  expect(overviewLine(next)).toBe('A small statistics library with no dependencies. (as of commit aaa1111)')
  // The insight on variance is replaced. The one on mean had no fingerprint to check it by later, so it is not kept.
  expect(next.insights.map(insight => `${insight.symbol}: ${insight.text} @${insight.commit}`)).toEqual(['variance: Now divides by n - 1. @bbb2222'])
  expect(parseProject(JSON.parse(JSON.stringify(next)), '/work')).toEqual(next)
  expect(parseProject({ v: 2 }, '/work')).toEqual(emptyProject('/work'))
})

test('insightsFor shows an insight only beside the exact code it was written about', async () => {
  const onSymbol: KeptInsight = { file: 'stats.py', symbol: 'variance', text: 'Population variance.', commit: 'aaa1111', at: 1, print: 'sym', of: 'symbol' }
  const onFile: KeptInsight = { file: 'stats.py', symbol: '', text: 'No tests cover this file.', commit: 'aaa1111', at: 1, print: 'file', of: 'file' }
  const project = { ...emptyProject('/work'), insights: [onSymbol, onFile] }

  expect(insightsFor(project, 'stats.py', 'variance', 'sym', 'file')).toEqual([onSymbol, onFile])
  // The function was edited: what was said about it no longer applies. The file changed with it.
  expect(insightsFor(project, 'stats.py', 'variance', 'changed', 'changed')).toEqual([])
  // Another function of an unchanged file gets what was said about the file.
  expect(insightsFor(project, 'stats.py', 'mean', 'other', 'file')).toEqual([onFile])
  expect(insightsFor(project, 'other.py', 'variance', 'sym', 'file')).toEqual([])
  expect(insightLine(onSymbol)).toBe('Population variance. (deep review of aaa1111)')
})

test('what the other two jobs are told: a brief for the play-by-play, a digest for the next review', async () => {
  const project = withReviewNotes(emptyProject('/work'), NOTES, 'aaa1111', 100, () => ({ print: 'p', of: 'symbol' }))
  expect(projectBrief(project, ['stats.py', 'other.py'], () => true)).toBe(
    [
      'About this project: A small statistics library with no dependencies. (as of commit aaa1111)',
      'What the deep review has said about these files, where that code has not changed since:',
      '- stats.py: Every helper lives here.',
      '- stats.py, variance: Divides by n, so it is the population variance. (deep review of aaa1111)',
    ].join('\n'),
  )
  // An insight about code that has changed since is left out, never passed on as if it still held.
  expect(projectBrief(project, ['stats.py'], () => false)).toBe(
    [
      'About this project: A small statistics library with no dependencies. (as of commit aaa1111)',
      'What the deep review has said about these files, where that code has not changed since:',
      '- stats.py: Every helper lives here.',
    ].join('\n'),
  )
  expect(projectBrief(emptyProject('/work'), ['stats.py'], () => true)).toBe('')

  const change = { path: 'stats.py', before: '', after: 'x = 1\n', hunks: [] }
  expect(playByPlayPrompt([change], [], [], null, 'About this project: small.').prompt.startsWith('Background:\nAbout this project: small.\n\nNotes still open')).toBe(true)
  expect(playByPlayPrompt([change], [], []).prompt.startsWith('Notes still open')).toBe(true)

  const reviews = withReview(withReview([], { commit: 'aaa1111', subject: 'commit aaa1111: Add mean', at: 1, text: 'First.' }), { commit: 'bbb2222', subject: 'commit bbb2222: Add variance', at: 2, text: 'x'.repeat(900) })
  expect(reviewDigest(reviews).startsWith('### commit bbb2222: Add variance\n')).toBe(true)
  expect(reviewDigest(reviews)).toMatch('…\n\n### commit aaa1111: Add mean\nFirst.')
  expect(reviewDigest([])).toBe('')
  // The same commit reviewed again replaces its earlier review.
  expect(withReview(reviews, { commit: 'bbb2222', subject: 's', at: 3, text: 'Again.' }).length).toBe(2)
  expect(parseReviews(JSON.parse(JSON.stringify(reviews)))).toEqual(reviews)

  const request = reviewRequest({ kind: 'commit', hash: 'c'.repeat(40), title: 'Add median', patch: '+patch' }, { overview: 'Small.', earlier: '### earlier\nFirst.' })
  expect(request).toMatch('What is on record about this project.')
  expect(request).toMatch('Your earlier reviews, newest first.')
  expect(reviewRequest({ kind: 'commit', hash: 'c'.repeat(40), title: 'Add median', patch: '+patch' }).includes('on record')).toBe(false)
  expect(reviewRequest({ kind: 'survey' })).toMatch('Survey this project.')
  expect(scopeSubject({ kind: 'survey' })).toBe('a first look around this project')
})

sessionTest('a deep review leaves notes in the project cache, and the pane never shows them', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS } })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  session.write('stats.py', `${STATS}\n# a comment\n`)
  session.commit('Add a comment')
  await session.clock.advance(2000)
  await $.turn.complete(session.finish(1, REVIEW))
  await session.clock.settle()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  const shown = String((await ui.find({ key: 'review' }))?.props.text ?? '')
  expect(shown).toMatch('Nice and small.')
  expect(shown.includes('backseat-notes')).toBe(false)
  expect(shown.includes('Every helper lives here')).toBe(false)
  await ui.unmount()

  const kept = parseProject(session.data(`projects/${projectId(ROOT)}/project.json`), ROOT)
  expect(kept.overview).toBe('A small statistics library with no dependencies.')
  expect(kept.overviewCommit).toBe('0000000')
  expect(kept.roles).toEqual({ 'stats.py': 'Every helper lives here.' })
  // The file has not been mapped, so the insight is tied to the file as a whole.
  expect(kept.insights[0]?.of).toBe('file')
  expect(kept.insights[0]?.print).toBe(sourcePrint(`${STATS}\n# a comment\n`))
  expect(fingerprint('x') === kept.insights[0]?.print).toBe(false)
  expect(parseReviews(session.data(`projects/${projectId(ROOT)}/reviews.json`))[0]?.text).toBe('Nice and small.\n\n- `stats.py:7`: think about which variance this is.')
})

sessionTest('the play-by-play, the next review and Explain all read what the deep review wrote', { options: { quiet_time: '5 seconds', minimum_gap: 'none' } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS } })
  session.explain(
    { summary: 'Helpers.', symbols: [{ name: 'mean', kind: 'function', start: 1, end: 2, head: 'def mean(xs):', summary: 'Average.' }, { name: 'variance', kind: 'function', start: 5, end: 7, head: 'def variance(xs):', summary: 'Spread.' }] },
    'Map this file.',
  )
  session.explain({ what: 'Spread of the values.', how: '', why: '', watch: '', uses: [] }, 'Explain variance')
  session.explain({ what: 'The average.', how: '', why: '', watch: '', uses: [] }, 'Explain mean')
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  // The file is mapped first, so that the insight can be tied to the function it is about.
  await $.command.run(typed('bsd', 'explain stats.py:6'))
  await session.clock.settle()

  session.write('notes.txt', 'release notes\n')
  session.commit('Add notes')
  await session.clock.advance(2000)
  await $.turn.complete(session.finish(1, REVIEW))
  await session.clock.settle()

  // Explain shows it beside the function, with the commit it comes from.
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: INSIGHT })).toBeDefined()

  // The play-by-play gets the overview, and what was said about the parts of the file that have not changed.
  session.write('stats.py', `${STATS}\ndef total(xs):\n    return sum(xs)\n`)
  await session.clock.advance(8000)
  const look = session.requests[session.requests.length - 1]?.prompt ?? ''
  expect(look).toMatch('Background:\nAbout this project: A small statistics library with no dependencies. (as of commit 0000000)')
  expect(look).toMatch('- stats.py, variance: Divides by n, so it is the population variance. (deep review of 0000000)')

  // The Explain tab followed the save to the new function.
  expect((session.data('view.json') as { spot: { line: number } }).spot.line).toBe(9)
  // Back on variance, which did not change: what the deep review said about it still shows.
  await $.command.run(typed('bsd', 'explain stats.py:6'))
  await session.clock.settle()
  expect(await ui.find({ type: 'Text', text: INSIGHT })).toBeDefined()

  // The next review is given the overview and what the last one said.
  session.commit('Add total')
  await session.clock.advance(2000)
  const next = session.spawned[1]?.prompt ?? ''
  expect(next).toMatch('What is on record about this project.')
  expect(next).toMatch('### commit 0000000: Add notes\nNice and small.')

  // Edit the function, and what the deep review said about the old one goes with it, from the pane and from the next look.
  session.write('stats.py', STATS.replace('** 2 for', '** 3 for'))
  await session.clock.advance(4000)
  expect((await ui.findAll({ type: 'Text', text: INSIGHT })).length).toBe(0)
  await session.clock.advance(6000)
  const later = session.requests[session.requests.length - 1]?.prompt ?? ''
  expect(later).toMatch('About this project: A small statistics library')
  expect(later.includes('population variance')).toBe(false)
  await ui.unmount()
})

sessionTest('a project the tutor has not seen is surveyed once', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS }, isNewProject: true })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()

  expect(session.spawned.length).toBe(1)
  expect(session.spawned[0]?.prompt).toMatch('Survey this project.')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-review' })
  expect(await ui.find({ type: 'Text', text: 'Taking a first look around this project.' })).toBeDefined()

  await $.turn.complete(session.finish(1, `It is a statistics library.\n\n\`\`\`backseat-notes\n${JSON.stringify({ ...NOTES, insights: [] })}\n\`\`\``))
  await session.clock.settle()
  expect((await ui.find({ key: 'review' }))?.props.text).toBe('It is a statistics library.')
  await ui.unmount()

  const kept = parseProject(session.data(`projects/${projectId(ROOT)}/project.json`), ROOT)
  expect(kept.isSurveyed).toBe(true)
  expect(kept.overview).toBe('A small statistics library with no dependencies.')
  // Labelled with the commit it looked at.
  expect(kept.overviewCommit).toBe('0000000')
  // A survey is not a review of anyone's work, so the next review is not told about it as one.
  expect(session.data(`projects/${projectId(ROOT)}/reviews.json`)).toBeUndefined()

  // Switched off and on again: no second survey.
  await $.command.run(typed('bsd', 'off'))
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.spawned.length).toBe(1)
})

sessionTest('no survey when deep reviews only run on request', { options: { deep_review_after_commit: false } }, async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS }, isNewProject: true })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.spawned).toEqual([])
})

sessionTest('no survey close to the plan limit', async ($, on) => {
  const session = stubSession(on, { head: { 'stats.py': STATS }, isNewProject: true })
  session.limits.push({ kind: 'five_hour', percentUsed: 82 })
  await $.session.start(SESSION)
  await $.command.run(typed('bsd'))
  await session.clock.settle()
  expect(session.spawned).toEqual([])
})

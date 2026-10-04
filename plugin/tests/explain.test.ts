import { expect, test } from 'claude-code/testing'

import { createExplainer, RETRY_MS, SETTLE_MS } from '../hooks/explainer'
import { detailRequest, isMappable, outlineRequest, parseDetailReply, parseOutline } from '../hooks/explain-prompts'
import {
  freshSymbols,
  isDetailFresh,
  parseKnowledge,
  placeSymbols,
  printOf,
  splitSource,
  symbolAt,
  withDetail,
  withOutline,
} from '../hooks/knowledge'
import type { Detail } from '../hooks/knowledge'
import { memoryDisk } from '../hooks/storage'

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

const OUTLINE = {
  summary: 'Small statistics helpers.',
  symbols: [
    { name: 'mean', kind: 'function', start: 1, end: 2, head: 'def mean(xs):', summary: 'The average of a list.' },
    { name: 'variance', kind: 'function', start: 5, end: 7, head: 'def variance(xs):', summary: 'How spread out a list is.' },
  ],
}

const DETAIL: Detail = { what: 'Averages.', how: 'Sum over length.', why: 'Used by variance.', watch: '', uses: [], at: 1, model: 'test' }

test('placeSymbols trusts a symbol only when its first line is where the model says, or close by', async () => {
  const lines = splitSource(STATS)
  const placed = placeSymbols(
    [
      { name: 'mean', kind: 'function', start: 1, end: 2, head: 'def mean(xs):', summary: 'avg' },
      // Three lines off: found by its first line, and its end moves with it.
      { name: 'variance', kind: 'function', start: 8, end: 10, head: 'def variance(xs):', summary: 'spread' },
      // Not in the file at all.
      { name: 'median', kind: 'function', start: 3, end: 4, head: 'def median(xs):', summary: 'middle' },
      // A line number far from where the text is.
      { name: 'mean again', kind: 'function', start: 40, end: 41, head: 'def mean(xs):', summary: 'far away' },
    ],
    lines,
  )

  expect(placed.map(symbol => `${symbol.name} ${symbol.startLine}-${symbol.endLine}`)).toEqual(['mean 1-2', 'variance 5-7'])
  expect(placed[1]?.print).toBe(printOf(lines, 5, 7))
})

test('freshSymbols finds unchanged code wherever it moved, and drops code that changed', async () => {
  const lines = splitSource(STATS)
  const knowledge = withOutline(null, 'stats.py', lines, 'Helpers.', placeSymbols(parseOutline(JSON.stringify(OUTLINE))?.entries ?? [], lines), 1)
  expect(freshSymbols(knowledge, lines).map(symbol => symbol.name)).toEqual(['mean', 'variance'])

  // Three lines added at the top: both are found again, three lines down.
  const moved = splitSource(`import math\n\n\n${STATS}`)
  expect(freshSymbols(knowledge, moved).map(symbol => `${symbol.name} ${symbol.startLine}`)).toEqual(['mean 4', 'variance 8'])

  // One character of variance changed: it is gone, and mean is untouched.
  const edited = splitSource(STATS.replace('/ len(xs)\n\n\ndef', '/ len(xs)\n\n\ndef').replace('** 2 for', '** 3 for'))
  expect(freshSymbols(knowledge, edited).map(symbol => symbol.name)).toEqual(['mean'])

  // A trailing space counts as a change. Nothing is guessed.
  expect(freshSymbols(knowledge, splitSource(STATS.replace('def mean(xs):', 'def mean(xs): '))).map(symbol => symbol.name)).toEqual(['variance'])
})

test('symbolAt picks the innermost symbol', async () => {
  const symbols = [
    { name: 'Stats', kind: 'class', startLine: 1, endLine: 20, head: 'class Stats:', print: 'a', summary: '' },
    { name: 'Stats.mean', kind: 'method', startLine: 3, endLine: 6, head: 'def mean(self):', print: 'b', summary: '' },
  ]
  expect(symbolAt(symbols, 4)?.name).toBe('Stats.mean')
  expect(symbolAt(symbols, 10)?.name).toBe('Stats')
  expect(symbolAt(symbols, 30)).toBeUndefined()
})

test('a new outline keeps the explanations of code that did not change', async () => {
  const lines = splitSource(STATS)
  const symbols = placeSymbols(parseOutline(JSON.stringify(OUTLINE))?.entries ?? [], lines)
  const first = withDetail(withOutline(null, 'stats.py', lines, 'Helpers.', symbols, 1), symbols[0]?.print ?? '', DETAIL)

  const edited = splitSource(STATS.replace('** 2 for', '** 3 for'))
  const again = withOutline(first, 'stats.py', edited, 'Helpers.', placeSymbols(parseOutline(JSON.stringify(OUTLINE))?.entries ?? [], edited), 2)
  expect(again.symbols.map(symbol => `${symbol.name}:${symbol.detail === undefined ? 'none' : 'kept'}`)).toEqual(['mean:kept', 'variance:none'])
})

test('parseKnowledge takes nothing on trust', async () => {
  const lines = splitSource(STATS)
  const good = withOutline(null, 'stats.py', lines, 'Helpers.', placeSymbols(parseOutline(JSON.stringify(OUTLINE))?.entries ?? [], lines), 1)
  expect(parseKnowledge(JSON.parse(JSON.stringify(good)), 'stats.py')).toEqual(good)

  expect(parseKnowledge(JSON.parse(JSON.stringify(good)), 'other.py')).toBe(null)
  expect(parseKnowledge({ ...good, v: 2 }, 'stats.py')).toBe(null)
  expect(parseKnowledge('nonsense', 'stats.py')).toBe(null)
  const damaged = { ...good, symbols: [{ name: 'x' }, { ...good.symbols[0], endLine: 0 }, good.symbols[1], 7] }
  expect(parseKnowledge(damaged, 'stats.py')?.symbols.map(symbol => symbol.name)).toEqual(['variance'])
})

test('isDetailFresh: an explanation is trusted only while everything it leans on is unchanged', async () => {
  const detail = { ...DETAIL, uses: [{ file: 'stats.py', name: 'mean', print: 'aaaa' }] }
  expect(isDetailFresh(detail, () => 'aaaa')).toBe(true)
  expect(isDetailFresh(detail, () => 'bbbb')).toBe(false)
  expect(isDetailFresh(detail, () => null)).toBe(false)
  expect(isDetailFresh(DETAIL, () => null)).toBe(true)
})

test('the requests name the project, the file and the lines, and replies are read defensively', async () => {
  const lines = splitSource(STATS)
  const project = { name: 'stats', overview: 'A statistics library.' }
  const outline = outlineRequest(project, 'stats.py', lines)
  expect(outline).toMatch('Project: stats\nWhat is known about it: A statistics library.\nFile: stats.py (Python)')
  expect(outline).toMatch('5 | def variance(xs):')
  expect(outlineRequest({ name: 'stats', overview: '' }, 'stats.py', lines).includes('What is known')).toBe(false)

  const symbols = placeSymbols(parseOutline(JSON.stringify(OUTLINE))?.entries ?? [], lines)
  const detail = detailRequest(project, { path: 'stats.py', fileSummary: 'Helpers.', outline: symbols, lines, start: 5, end: 7, name: 'variance', insights: ['Divides by n, not n - 1.'] })
  expect(detail).toMatch('Explain variance, lines 5 to 7.')
  expect(detail).toMatch('Also in this file:\n- mean (function): The average of a list.')
  expect(detail).toMatch('What the last deep review said about this code:\n- Divides by n, not n - 1.')
  expect(detail.includes('- variance (function)')).toBe(false)
  expect(detailRequest(project, { path: 'stats.py', fileSummary: '', outline: [], lines, start: 6, end: 7, name: '', insights: [] })).toMatch('Explain the selected lines, 6 to 7.')

  expect(parseOutline('Here you go:\n```json\n' + JSON.stringify(OUTLINE) + '\n```')?.entries.length).toBe(2)
  expect(parseOutline('no json here')).toBe(null)
  expect(parseOutline('{"summary": "x", "symbols": [{"name": "a"}, {"name": "b", "head": "def b():", "start": 0}]}')?.entries).toEqual([])
  expect(parseDetailReply('{"what": "Averages.", "how": "", "uses": ["mean", 3, ""]}')).toEqual({ what: 'Averages.', how: '', why: '', watch: '', uses: ['mean'] })
  expect(parseDetailReply('{"how": "no what"}')).toBe(null)
  expect(isMappable('x'.repeat(200_000), ['x'])).toBe(false)
})

/** A project in memory, a clock the test moves, and a model the test answers by hand. */
function world(initial: Record<string, string>) {
  const files: Record<string, string> = { ...initial }
  const saves = new Map<string, number>()
  const disk = memoryDisk()
  const asked: { prompt: string; answer: (reply: unknown) => void; signal: AbortSignal }[] = []
  const state = {
    now: 1000,
    mode: 'automatic' as 'automatic' | 'on request' | 'off',
    pressure: 'none' as 'none' | 'slowed' | 'held',
    changes: 0,
    insights: [] as string[],
  }
  const start = () =>
    createExplainer({
      read: async path => files[path] ?? null,
      stamp: async path => (path in files ? `${(files[path] ?? '').length}:${saves.get(path) ?? 0}` : ''),
      disk,
      entryPath: path => `/d/files/${path}.json`,
      complete: (prompt, maxTokens, signal) =>
        new Promise(resolve => {
          asked.push({ prompt, signal, answer: reply => resolve(reply === null ? null : typeof reply === 'string' ? reply : JSON.stringify(reply)) })
        }),
      now: async () => state.now,
      project: () => ({ name: 'stats', overview: '' }),
      insights: () => state.insights,
      mode: () => state.mode,
      pressure: () => state.pressure,
      model: 'test',
      onChange: () => {
        state.changes += 1
      },
      log: () => {},
    })

  return {
    files,
    disk,
    asked,
    state,
    start,
    explainer: start(),
    save(path: string, text: string) {
      files[path] = text
      saves.set(path, (saves.get(path) ?? 0) + 1)
    },
    /** Lets everything that can run without the model or the clock run. */
    async settle() {
      for (let turn = 0; turn < 300; turn += 1) await Promise.resolve()
    },
    /** The requests still waiting for an answer, by what they ask. */
    open(kind: 'Map this file.' | 'Explain') {
      return asked.filter(request => request.prompt.includes(kind) && !answered.has(request))
    },
    answer(request: (typeof asked)[number] | undefined, reply: unknown) {
      if (request === undefined) throw new Error('no such request')
      answered.add(request)
      request.answer(reply)
    },
  }
}
const answered = new WeakSet<object>()

const WHAT = { what: 'How spread out the values are.', how: 'Mean of squared distances from the mean.', why: 'The deviation is built on it.', watch: 'Divides by n.', uses: ['mean'] }

/** Maps stats.py and explains `variance`, as a first visit to line 6 does. */
async function visited() {
  const w = world({ 'stats.py': STATS })
  await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  await w.settle()
  w.answer(w.open('Map this file.')[0], OUTLINE)
  await w.settle()
  await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  await w.settle()
  w.answer(w.open('Explain').find(request => request.prompt.includes('Explain variance')), WHAT)
  await w.settle()

  return w
}

test('a first look maps the file, then explains the spot, and never waits on the model', async () => {
  const w = world({ 'stats.py': STATS })

  const first = await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  expect(first.status).toBe('updating')
  expect(first.outline).toEqual([])
  expect(first.detail).toBe(null)
  await w.settle()
  expect(w.asked.length).toBe(1)
  expect(w.asked[0]?.prompt).toMatch('Map this file.')

  w.answer(w.asked[0], OUTLINE)
  await w.settle()
  expect(w.state.changes > 0).toBe(true)

  const mapped = await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  expect(mapped.fileSummary).toBe('Small statistics helpers.')
  expect(mapped.outline.map(row => row.name)).toEqual(['mean', 'variance'])
  expect(mapped.target?.name).toBe('variance')
  expect(mapped.target?.summary).toBe('How spread out a list is.')
  expect(mapped.status).toBe('updating')
  await w.settle()

  w.answer(w.open('Explain').find(request => request.prompt.includes('Explain variance')), WHAT)
  await w.settle()
  const explained = await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  expect(explained.status).toBe('fresh')
  expect(explained.detail).toEqual({ ...WHAT, uses: ['mean'] })
})

test('what is cached is served with no request, in this session and the next', async () => {
  const w = await visited()
  // The other symbol was explained ahead of being asked, because the file was new.
  w.answer(w.open('Explain').find(request => request.prompt.includes('Explain mean')), { what: 'The average.', how: '', why: '', watch: '', uses: [] })
  await w.settle()
  const before = w.asked.length

  for (const line of [1, 2, 5, 6, 7, 3]) await w.explainer.view({ path: 'stats.py', line }, 'browsing')
  await w.settle()
  expect(w.asked.length).toBe(before)
  expect((await w.explainer.view({ path: 'stats.py', line: 2 }, 'browsing')).detail?.what).toBe('The average.')
  // Between symbols there is the file itself to show.
  const between = await w.explainer.view({ path: 'stats.py', line: 3 }, 'browsing')
  expect(between.target).toBe(null)
  expect(between.status).toBe('fresh')

  // A new session reads the same answers from disk.
  const next = w.start()
  const again = await next.view({ path: 'stats.py', line: 6 }, 'browsing')
  expect(again.status).toBe('fresh')
  expect(again.detail?.what).toBe('How spread out the values are.')
  await w.settle()
  expect(w.asked.length).toBe(before)
})

test('never stale: an edited function loses its explanation at once', async () => {
  const w = await visited()
  w.save('stats.py', STATS.replace('for x in xs) / len(xs)', 'for x in xs) / (len(xs) - 1)'))
  expect(w.files['stats.py']).toMatch('for x in xs) / (len(xs) - 1)')

  const view = await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  // Neither the old explanation nor the old one-line summary is shown for code that changed.
  expect(view.detail).toBe(null)
  expect(view.target).toBe(null)
  expect(view.outline.map(row => row.name)).toEqual(['mean'])
  expect(view.isOutlineCurrent).toBe(false)
  expect(view.fileSummary).toBe('')
  expect(view.status).toBe('updating')
})

test('an edit elsewhere in the file costs an unchanged function nothing', async () => {
  const w = await visited()
  const before = w.open('Explain').length
  w.save('stats.py', `import math\n\n\n${STATS}`)

  // Three lines further down, same text: shown at once, explanation and all.
  const view = await w.explainer.view({ path: 'stats.py', line: 9 }, 'browsing')
  expect(view.target).toEqual({ name: 'variance', kind: 'function', startLine: 8, endLine: 10, summary: 'How spread out a list is.' })
  expect(view.detail?.what).toBe('How spread out the values are.')
  await w.settle()
  // The file is mapped again once it has settled, because it changed. Nothing is asked about variance.
  expect(w.open('Map this file.').length).toBe(0)
  w.state.now += SETTLE_MS
  await w.explainer.tick()
  await w.settle()
  expect(w.open('Map this file.').length).toBe(1)
  expect(w.open('Explain').length).toBe(before)
})

test('an answer that arrives for code that has since changed is thrown away', async () => {
  const w = world({ 'stats.py': STATS })
  await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  await w.settle()
  w.answer(w.open('Map this file.')[0], OUTLINE)
  await w.settle()
  await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  await w.settle()
  const request = w.open('Explain').find(candidate => candidate.prompt.includes('Explain variance'))

  // The function is edited while the model is still writing about the old one.
  w.save('stats.py', STATS.replace('** 2 for', '** 3 for'))
  w.answer(request, WHAT)
  await w.settle()

  const view = await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  expect(view.detail).toBe(null)
  expect(JSON.stringify([...w.disk.files.values()]).includes('How spread out the values are.')).toBe(false)
})

test('a mapping that lands after another save is dropped, and the file is mapped again once it settles', async () => {
  const w = world({ 'stats.py': STATS })
  await w.explainer.view({ path: 'stats.py', line: 1 }, 'browsing')
  await w.settle()
  const stale = w.open('Map this file.')[0]

  w.save('stats.py', `${STATS}\n\ndef total(xs):\n    return sum(xs)\n`)
  w.answer(stale, OUTLINE)
  await w.settle()
  expect(w.disk.files.size).toBe(0)

  // Not at once: the file may still be being typed.
  await w.explainer.tick()
  await w.settle()
  expect(w.open('Map this file.').length).toBe(0)
  w.state.now += SETTLE_MS
  await w.explainer.tick()
  await w.settle()
  expect(w.open('Map this file.').length).toBe(1)
  expect(w.open('Map this file.')[0]?.prompt).toMatch('def total(xs):')
})

test('when something an explanation leans on changes, the explanation goes with it', async () => {
  const w = await visited()
  expect((await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')).detail?.uses).toEqual(['mean'])

  // variance is untouched, but mean, which its explanation relies on, now does something else.
  w.save('stats.py', STATS.replace('return sum(xs) / len(xs)\n\n\ndef', 'return sorted(xs)[len(xs) // 2]\n\n\ndef'))
  const view = await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  expect(view.target?.name).toBe('variance')
  expect(view.detail).toBe(null)
  expect(view.status).toBe('updating')
})

test('on request, nothing is fetched until the person asks', async () => {
  const w = world({ 'stats.py': STATS })
  w.state.mode = 'on request'

  const idle = await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  expect(idle.status).toBe('waiting')
  await w.explainer.touch('stats.py')
  w.state.now += SETTLE_MS
  await w.explainer.tick()
  await w.settle()
  expect(w.asked.length).toBe(0)

  expect((await w.explainer.view({ path: 'stats.py', line: 6 }, 'asked')).status).toBe('updating')
  await w.settle()
  expect(w.asked.length).toBe(1)

  w.state.mode = 'off'
  expect((await w.explainer.view({ path: 'stats.py', line: 6 }, 'asked')).status).toBe('off')
})

test('a lookup that fails says so, and is not tried again for a while', async () => {
  const w = world({ 'stats.py': STATS })
  await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  await w.settle()
  w.answer(w.asked[0], null)
  await w.settle()

  expect((await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')).status).toBe('failed')
  await w.settle()
  expect(w.asked.length).toBe(1)

  w.state.now += RETRY_MS
  expect((await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')).status).toBe('updating')
  await w.settle()
  expect(w.asked.length).toBe(2)

  // A reply that is not the JSON asked for counts as a failure too.
  w.answer(w.asked[1], 'I could not read that file.')
  await w.settle()
  expect((await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')).status).toBe('failed')
})

test('a saved file is mapped once it has settled, and explained ahead only when there is usage to spare', async () => {
  const w = world({ 'stats.py': STATS })
  w.state.pressure = 'slowed'
  await w.explainer.touch('stats.py')
  await w.explainer.tick()
  await w.settle()
  // Near the plan limit, nothing that was not asked for is fetched.
  w.state.now += SETTLE_MS
  await w.explainer.tick()
  await w.settle()
  expect(w.asked.length).toBe(0)

  w.state.pressure = 'none'
  await w.explainer.tick()
  await w.settle()
  expect(w.open('Map this file.').length).toBe(1)
  w.answer(w.open('Map this file.')[0], OUTLINE)
  await w.settle()
  expect(w.open('Explain').map(request => /Explain (\w+),/.exec(request.prompt)?.[1])).toEqual(['mean', 'variance'])
})

test('a selection is explained as what it is, and remembered by its text', async () => {
  const w = world({ 'stats.py': STATS })
  const first = await w.explainer.view({ path: 'stats.py', line: 6, endLine: 7 }, 'browsing')
  expect(first.target).toEqual({ name: 'lines 6 to 7', kind: 'selection', startLine: 6, endLine: 7, summary: '' })
  await w.settle()
  w.answer(w.open('Explain').find(request => request.prompt.includes('Explain the selected lines, 6 to 7.')), { what: 'The body of variance.', how: '', why: '', watch: '', uses: [] })
  await w.settle()

  expect((await w.explainer.view({ path: 'stats.py', line: 6, endLine: 7 }, 'browsing')).detail?.what).toBe('The body of variance.')
  // A different selection is a different question.
  expect((await w.explainer.view({ path: 'stats.py', line: 5, endLine: 7 }, 'browsing')).detail).toBe(null)
})

test('a file too large to map is explained around the cursor', async () => {
  const big = Array.from({ length: 3000 }, (_, index) => `x${index} = ${index}`).join('\n')
  const w = world({ 'big.py': big })

  const view = await w.explainer.view({ path: 'big.py', line: 100 }, 'browsing')
  expect(view.isMappable).toBe(false)
  expect(view.target?.name).toBe('lines 85 to 115')
  await w.settle()
  expect(w.open('Map this file.').length).toBe(0)
  expect(w.open('Explain')[0]?.prompt).toMatch('Explain the selected lines, 85 to 115.')
})

test('a file that is not there is said to be not there', async () => {
  const w = world({})
  expect((await w.explainer.view({ path: 'gone.py', line: 1 }, 'asked')).status).toBe('no-file')
  await w.settle()
  expect(w.asked.length).toBe(0)
})

test('how eagerly a spot is looked up depends on why it is being looked at', async () => {
  // Following a save: not before the file has settled.
  const saved = world({ 'stats.py': STATS })
  await saved.explainer.touch('stats.py')
  expect((await saved.explainer.view({ path: 'stats.py', line: 6 }, 'following')).status).toBe('updating')
  await saved.settle()
  expect(saved.asked.length).toBe(0)
  saved.state.now += SETTLE_MS
  await saved.explainer.tick()
  await saved.settle()
  expect(saved.asked.length).toBe(1)

  // Close to the plan limit, a save is not followed, but a cursor still is.
  const slowed = world({ 'stats.py': STATS })
  slowed.state.pressure = 'slowed'
  await slowed.explainer.touch('stats.py')
  expect((await slowed.explainer.view({ path: 'stats.py', line: 6 }, 'following')).status).toBe('held')
  slowed.state.now += SETTLE_MS
  await slowed.explainer.tick()
  await slowed.settle()
  expect(slowed.asked.length).toBe(0)
  expect((await slowed.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')).status).toBe('updating')
  await slowed.settle()
  expect(slowed.asked.length).toBe(1)

  // At the limit, only what is asked for by name.
  const held = world({ 'stats.py': STATS })
  held.state.pressure = 'held'
  expect((await held.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')).status).toBe('held')
  await held.settle()
  expect(held.asked.length).toBe(0)
  expect((await held.explainer.view({ path: 'stats.py', line: 6 }, 'asked')).status).toBe('updating')
  await held.settle()
  expect(held.asked.length).toBe(1)
})

test('asking for a file that is waiting to settle maps it at once', async () => {
  const w = world({ 'stats.py': STATS })
  await w.explainer.touch('stats.py')
  await w.explainer.tick()
  await w.settle()
  expect(w.asked.length).toBe(0)

  await w.explainer.view({ path: 'stats.py', line: 6 }, 'asked')
  await w.settle()
  expect(w.asked.length).toBe(1)
})

test('two things noticing the same gap cost one request', async () => {
  const w = world({ 'stats.py': STATS })
  await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  await w.settle()
  w.answer(w.open('Map this file.')[0], OUTLINE)
  await w.settle()

  // The file is new, so variance is being explained ahead of being asked about.
  const ahead = w.open('Explain').find(request => request.prompt.includes('Explain variance'))
  // A view was already being worked out when that answer lands, and it wants variance too.
  const looking = w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  w.answer(ahead, WHAT)
  await looking
  await w.settle()

  expect(w.asked.filter(request => request.prompt.includes('Explain variance')).length).toBe(1)
  expect((await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')).detail?.what).toBe('How spread out the values are.')
})

test('two explanations of the same file landing together are both kept', async () => {
  const w = world({ 'stats.py': STATS })
  await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
  await w.settle()
  w.answer(w.open('Map this file.')[0], OUTLINE)
  await w.settle()
  // Both functions are being explained at once, and both answers arrive in the same instant.
  w.answer(w.open('Explain').find(request => request.prompt.includes('Explain mean')), { what: 'The average.', how: '', why: '', watch: '', uses: [] })
  w.answer(w.open('Explain').find(request => request.prompt.includes('Explain variance')), WHAT)
  await w.settle()

  expect((await w.explainer.view({ path: 'stats.py', line: 2 }, 'browsing')).detail?.what).toBe('The average.')
  expect((await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')).detail?.what).toBe('How spread out the values are.')
  // And the file on disk has both, whichever write went first.
  const stored = JSON.stringify([...w.disk.files.values()])
  expect(stored.includes('The average.') && stored.includes('How spread out the values are.')).toBe(true)
  await w.settle()
  expect(w.asked.length).toBe(3)
})

test('a file edited under the cursor is not mapped again until it has settled', async () => {
  const w = await visited()
  const before = w.asked.length

  // Saved three times in quick succession, as an editor that saves while you type does.
  for (const power of [3, 4, 5]) {
    w.save('stats.py', STATS.replace('** 2 for', `** ${power} for`))
    const view = await w.explainer.view({ path: 'stats.py', line: 6 }, 'browsing')
    expect(view.detail).toBe(null)
    expect(view.status).toBe('updating')
    w.state.now += 1000
    await w.explainer.tick()
    await w.settle()
  }
  expect(w.asked.length).toBe(before)

  w.state.now += SETTLE_MS
  await w.explainer.tick()
  await w.settle()
  // One mapping, of the text as it ended up.
  expect(w.asked.length).toBe(before + 1)
  expect(w.asked[before]?.prompt).toMatch('** 5 for')
})

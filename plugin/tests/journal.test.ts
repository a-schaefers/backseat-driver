import { expect, test } from 'claude-code/testing'

import type { Working } from '../types'
import { createAttention, parseEditorReport } from '../hooks/attention'
import { definitionName, enclosingName } from '../hooks/enclosing'
import { ago, briefText, glanceText, pictureOf, placeWords, shareWords, took, workingOf } from '../hooks/glance'
import type { Seen } from '../hooks/glance'
import { compact, emptyJournal, knownEntries, mergeSpans, parseJournal, SAVE_RUN_MS, sync, withEntry } from '../hooks/journal'
import type { Entry, Journal, Span } from '../hooks/journal'
import { createRecorder, FLUSH_MS } from '../hooks/recorder'
import { memoryDisk } from '../hooks/storage'
import { chosen, LET_IT_INFER, NOTHING_YET, parseWorking, workingChoices } from '../hooks/working'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

test('definitionName reads the common shapes of a definition, and nothing else', async () => {
  const named: [string, string][] = [
    ['def mean(xs):', 'mean'],
    ['    async def fetch(self, url):', 'fetch'],
    ['class Cache(Base):', 'Cache'],
    ['pub(crate) async fn get_or_load(&self, key: &str) -> Result<V> {', 'get_or_load'],
    ['impl<T> Cache<T> {', 'Cache'],
    ['func (r *Repo) Save(ctx context.Context) error {', 'Save'],
    ['export async function loadUser(id: string) {', 'loadUser'],
    ['export const handler = async (req, res) => {', 'handler'],
    ['  handleClick = () => {', 'handleClick'],
    ['  async save(user: User): Promise<void> {', 'save'],
    ['static int parse_header(const char *line, size_t len) {', 'parse_header'],
    ['void Cache::evict(int n) const {', 'Cache::evict'],
    ['(defun bsd-report-focus ()', 'bsd-report-focus'],
    ['(define (square x)', 'square'],
    ['build() {', 'build'],
    ['module Billing::Invoices', 'Billing::Invoices'],
  ]
  for (const [line, name] of named) expect(definitionName(line)).toBe(name)

  const unnamed = [
    'if (ready) {',
    '} else if (x) {',
    'for (const x of xs) {',
    'return compute(x) {',
    'x = compute(',
    'struct point *p;',
    "describe('cache', () => {",
    'while (true) {',
    '// type of thing',
    'total += 1',
  ]
  for (const line of unnamed) expect(definitionName(line)).toBe('')
})

test('enclosingName finds the definition a line sits in by indentation, or says nothing', async () => {
  const python = [
    'import os',
    '',
    'class Cache:',
    '    def get(self, key):',
    '        if key in self.d:',
    '            return self.d[key]',
    '        return None',
    '',
    'def main():',
    '    cache = Cache()',
    '',
    'x = 1',
    'if x:',
    '    y = 2',
  ]
  expect(enclosingName(python, 6)).toBe('get')
  // On the line that defines it.
  expect(enclosingName(python, 4)).toBe('get')
  expect(enclosingName(python, 3)).toBe('Cache')
  expect(enclosingName(python, 10)).toBe('main')
  // Inside a block at the top level, which is in no definition: not the function above it.
  expect(enclosingName(python, 14)).toBe('')
  expect(enclosingName(python, 1)).toBe('')

  // A signature that wraps, and a brace on a line of its own.
  expect(enclosingName(['fn long_name(', '    a: i32,', ') -> i32 {', '    a + 1', '}'], 4)).toBe('long_name')
  expect(enclosingName(['int main(void)', '{', '    return 0;', '}'], 3)).toBe('main')
  // In prose, the nearest heading.
  expect(enclosingName(['# Title', 'text', '## Install', 'type this'], 4, 'README.md')).toBe('Install')
  expect(enclosingName([], 3)).toBe('')
})

const save = (at: number, path = 'a.py', extra: Partial<Extract<Entry, { kind: 'save' }>> = {}): Entry => ({
  at,
  kind: 'save',
  path,
  until: at,
  saves: 1,
  added: 2,
  removed: 1,
  lines: [[10, 12]],
  where: 'mean',
  ...extra,
})

test('saves of one file moments apart are one run, which a commit or a pause ends', async () => {
  let entries: Entry[] = withEntry([], save(1000))
  entries = withEntry(entries, save(31_000, 'a.py', { lines: [[40, 41]], where: 'total' }))
  expect(entries).toEqual([
    { at: 1000, kind: 'save', path: 'a.py', until: 31_000, saves: 2, added: 4, removed: 2, lines: [[10, 12], [40, 41]], where: 'total, mean' },
  ])

  // A save of another file in between does not end the run.
  entries = withEntry(entries, save(40_000, 'b.py'))
  entries = withEntry(entries, save(50_000))
  expect(entries.map(entry => (entry.kind === 'save' ? [entry.path, entry.saves] : []))).toEqual([['a.py', 3], ['b.py', 1]])

  entries = withEntry(entries, { at: 60_000, kind: 'commit', hash: 'abc1234', text: 'Add the mean' })
  entries = withEntry(entries, save(70_000))
  expect(entries.length).toBe(4)
  entries = withEntry(entries, save(70_000 + SAVE_RUN_MS + 1))
  expect(entries.length).toBe(5)
})

test('mergeSpans joins neighbours and never returns more than four runs', async () => {
  expect(mergeSpans([[5, 6], [1, 2], [3, 4]])).toEqual([[1, 6]])
  expect(mergeSpans([[1, 2], [40, 41]])).toEqual([[1, 2], [40, 41]])
  const scattered: Span[] = [[1, 1], [100, 100], [200, 200], [300, 300], [400, 400], [500, 500]]
  expect(mergeSpans(scattered)).toEqual([[1, 500]])
})

test('a sitting that is over is rolled up into a few lines, and a quiet one leaves nothing', async () => {
  const earlier: Entry[] = [
    { at: 0, kind: 'on', text: 'main' },
    save(MINUTE, 'a.py', { saves: 3, until: 2 * MINUTE }),
    { at: 3 * MINUTE, kind: 'commit', hash: 'abc1234', text: 'Add the mean' },
    { at: 4 * MINUTE, kind: 'said', text: 'the mean' },
  ]
  const now = 3 * HOUR
  const back: Entry = { at: now - 1000, kind: 'on', text: 'main' }
  const journal = compact({ ...emptyJournal(), entries: [...earlier, back] }, now)

  expect(journal.entries).toEqual([back])
  expect(journal.sittings).toEqual([
    { from: 0, to: 4 * MINUTE, files: [{ path: 'a.py', saves: 3, ms: 0 }], commitCount: 1, commits: ['Add the mean'], said: 'the mean' },
  ])
  // Rolled up once, however often it is asked.
  expect(compact({ ...journal, entries: [...earlier, back] }, now).sittings.length).toBe(1)
  // Switched on and nothing done: not worth a line.
  expect(compact({ ...emptyJournal(), entries: [{ at: 0, kind: 'on', text: 'main' }] }, now)).toEqual(emptyJournal())
})

test('sync keeps what another session wrote, and neither doubles nor brings back anything', async () => {
  const mine = save(1000)
  const known = knownEntries({ ...emptyJournal(), entries: [mine] })
  // This session's run has grown since it was written. Another session has added a commit to the file.
  const grown = withEntry([mine], save(5000))[0] ?? mine
  const theirs: Entry = { at: 3000, kind: 'commit', hash: 'abc1234', text: 'Theirs' }
  const merged = sync({ ...emptyJournal(), entries: [mine, theirs] }, { ...emptyJournal(), entries: [grown] }, known, 6000)
  expect(merged.entries).toEqual([grown, theirs])

  // What was said last stands, and taking it back counts as saying.
  const stored: Journal = { ...emptyJournal(), said: { text: 'the parser', at: 1 } }
  expect(sync(stored, { ...emptyJournal(), said: { text: '', at: 2 } }, new Set(), 10).said).toEqual({ text: '', at: 2 })
  expect(sync(stored, emptyJournal(), new Set(), 10).said).toEqual({ text: 'the parser', at: 1 })
  // In the same millisecond, this session acted last.
  expect(sync(stored, { ...emptyJournal(), said: { text: '', at: 1 } }, new Set(), 10).said).toEqual({ text: '', at: 1 })
  // Another session's later word is not overwritten by an older one held here.
  expect(sync({ ...emptyJournal(), said: { text: 'the lexer', at: 5 } }, { ...emptyJournal(), said: { text: 'the parser', at: 1 } }, new Set(), 10).said).toEqual({ text: 'the lexer', at: 5 })
})

test('parseJournal trusts nothing it reads', async () => {
  expect(parseJournal(null)).toEqual(emptyJournal())
  expect(parseJournal({ entries: 'no', said: 5, sittings: [{ from: 5, to: 1 }] })).toEqual(emptyJournal())

  const parsed = parseJournal({
    said: { text: 'the parser', at: 5 },
    entries: [
      { at: 2, kind: 'save', path: 'a.py', lines: [[3, 1], [2, 4], 'x'] },
      { at: 1, kind: 'bogus' },
      { kind: 'on' },
      { at: 1, kind: 'note', path: '', line: 1, text: 'no-file' },
    ],
  })
  expect(parsed.said).toEqual({ text: 'the parser', at: 5 })
  expect(parsed.entries).toEqual([
    { at: 2, kind: 'save', path: 'a.py', until: 2, saves: 1, added: 0, removed: 0, lines: [[2, 4]], where: '' },
  ])
})

test('parseEditorReport takes paths from the repository root and leaves out what is outside it', async () => {
  const report = parseEditorReport(
    JSON.stringify({
      file: '/work/src/a.py',
      line: 12,
      modified: true,
      buffers: ['/work/src/a.py', '/work/b.py', '/etc/passwd', '/work/../etc/passwd'],
      visible: ['/work/b.py'],
    }),
    '/work',
  )
  expect(report).toEqual({ path: 'src/a.py', line: 12, open: ['b.py'], visible: ['b.py'], isModified: true, isActive: true })

  // An editor that is in another project is alive, and not here.
  expect(parseEditorReport('{"file": "/elsewhere/a.py", "line": 3}', '/work')?.path).toBe(null)
  expect(parseEditorReport('{"file": "/work/a.py"}', '/work')?.line).toBe(1)
  expect(parseEditorReport('{"file": "/work/a.py", "active": false}', '/work')?.isActive).toBe(false)
  expect(parseEditorReport('{"line": 3}', '/work')).toBe(null)
  expect(parseEditorReport('not json', '/work')).toBe(null)
})

test('attention adds up where the caret stays, and stops when the editor goes quiet', async () => {
  const attention = createAttention()
  const caret = (line: number) => ({ path: 'a.py', line, open: [], visible: [], isModified: false, isActive: true })

  // Where the caret was left before the tutor was watching earns nothing, and is not worth naming.
  attention.observe(caret(10), 0, true)
  expect(attention.unnamed(0)).toBe(null)
  attention.tick(0)
  attention.tick(2000)
  expect(attention.rows()).toEqual([])
  expect(attention.caret(2000)).toBe(null)

  attention.observe(caret(10), 2000, false)
  expect(attention.unnamed(2000)).toEqual({ path: 'a.py', line: 10 })
  attention.name('mean')
  expect(attention.unnamed(2000)).toBe(null)
  for (let now = 4000; now <= 64_000; now += 2000) attention.tick(now)
  // A new line needs a new name. The same line written again does not.
  attention.observe(caret(200), 64_000, false)
  expect(attention.caret(64_000)?.where).toBe('')
  attention.name('total')
  attention.observe(caret(200), 64_000, false)
  expect(attention.unnamed(64_000)).toBe(null)
  for (let now = 66_000; now <= 84_000; now += 2000) attention.tick(now)
  expect(attention.caret(84_000)).toEqual({ path: 'a.py', line: 200, where: 'total', isModified: false, open: [], visible: [] })
  expect(attention.rows()).toEqual([
    { at: 2000, kind: 'focus', path: 'a.py', ms: 62_000, lines: [[10, 10]], where: 'mean' },
    { at: 2000, kind: 'focus', path: 'a.py', ms: 20_000, lines: [[200, 200]], where: 'total' },
  ])

  // The caret stops moving. Two minutes later the time stops counting.
  for (let now = 86_000; now <= 400_000; now += 2000) attention.tick(now)
  expect(attention.caret(400_000)).toBe(null)
  expect(attention.drain()[0]).toEqual({ at: 2000, kind: 'focus', path: 'a.py', ms: 120_000, lines: [[200, 200]], where: 'total' })
  expect(attention.rows()).toEqual([])

  // A poll that comes an hour late, as after the laptop slept, credits ten seconds and no more.
  attention.observe(caret(5), 4_000_000, false)
  attention.tick(4_000_000)
  expect(attention.rows()).toEqual([{ at: 3_990_000, kind: 'focus', path: 'a.py', ms: 10_000, lines: [[5, 5]], where: '' }])

  // An editor that says its window lost the keyboard earns nothing.
  attention.drain()
  attention.observe({ ...caret(5), isActive: false }, 4_002_000, false)
  attention.tick(4_002_000)
  attention.tick(4_004_000)
  expect(attention.rows()).toEqual([])
})

test('a stay in one function and a stay in the next are two places, however close their lines', async () => {
  // As in a live session: eleven seconds on line 2 in mean, then over a minute on line 7 in median.
  const attention = createAttention()
  const caret = (line: number) => ({ path: 'stats.py', line, open: [], visible: [], isModified: false, isActive: true })
  attention.observe(caret(2), 0, false)
  attention.name('mean')
  for (let now = 0; now <= 12_000; now += 2000) attention.tick(now)
  attention.observe(caret(7), 12_000, false)
  attention.name('median')
  for (let now = 14_000; now <= 80_000; now += 2000) attention.tick(now)

  expect(attention.rows()).toEqual([
    { at: 0, kind: 'focus', path: 'stats.py', ms: 68_000, lines: [[7, 7]], where: 'median' },
    { at: 0, kind: 'focus', path: 'stats.py', ms: 12_000, lines: [[2, 2]], where: 'mean' },
  ])
})

test('a file on screen beside the one in front gets time of its own', async () => {
  const attention = createAttention()
  attention.observe({ path: 'a.py', line: 3, open: ['b.py', 'c.py'], visible: ['b.py'], isModified: false, isActive: true }, 0, false)
  for (let now = 0; now <= 30_000; now += 2000) attention.tick(now)
  expect(attention.rows()).toEqual([
    { at: 0, kind: 'focus', path: 'a.py', ms: 30_000, lines: [[3, 3]], where: '' },
    { at: 0, kind: 'screen', path: 'b.py', ms: 30_000 },
  ])

  const picture = pictureOf(attention.rows(), 30_000)
  // Beside it counts, and counts for less than in front.
  expect(picture.places.map(place => [place.path, place.ms, place.screenMs])).toEqual([
    ['a.py', 30_000, 0],
    ['b.py', 0, 30_000],
  ])
})

const NOW = 300 * MINUTE
const ACTIVITY: Entry[] = [
  save(NOW - 15 * MINUTE, 'old.py', { until: NOW - 14 * MINUTE, saves: 9 }),
  { at: NOW - 6 * MINUTE, kind: 'focus', path: 'b.py', ms: 90_000, lines: [[40, 60]], where: 'render' },
  save(NOW - 5 * MINUTE, 'a.py', { until: NOW - 4 * MINUTE, saves: 2, added: 6, removed: 1, lines: [[10, 14]] }),
  { at: NOW - 4 * MINUTE, kind: 'focus', path: 'a.py', ms: 30_000, lines: [[10, 12]], where: 'mean' },
]

test('the picture covers the last ten minutes, and ranks what was changed above what was only looked at', async () => {
  const picture = pictureOf(ACTIVITY, NOW)
  expect(picture.places.map(place => place.path)).toEqual(['a.py', 'b.py'])
  expect(picture.ms).toBe(120_000)

  const [first, second] = picture.places
  expect(first === undefined ? '' : placeWords(first)).toBe('a.py, in mean')
  expect(first === undefined ? '' : shareWords(first, picture)).toBe('25% of the last 10 minutes in the editor')
  expect(second === undefined ? '' : placeWords(second)).toBe('b.py, in render')

  // With no editor reporting, it goes by the saves.
  const saves = pictureOf([save(NOW - MINUTE, 'c.py', { where: '', lines: [[7, 9]] })], NOW)
  const only = saves.places[0]
  expect(only === undefined ? '' : placeWords(only)).toBe('c.py, lines 7 to 9')
  expect(only === undefined ? '' : shareWords(only, saves)).toBe('saved once in the last 10 minutes')
})

test('workingOf: their own words, what a look made of it while it still fits, and where the activity is', async () => {
  const seen: Seen = { journal: { ...emptyJournal(), entries: ACTIVITY }, live: [], caret: null, now: NOW }
  expect(workingOf(seen)).toEqual({
    said: '',
    saidAgo: '',
    inferred: '',
    where: 'a.py, in mean',
    share: '25% of the last 10 minutes in the editor',
  })

  const inferred = { text: 'adding a mean', at: NOW - MINUTE, paths: ['a.py'] }
  const withInferred = (change: Partial<typeof inferred>): Seen => ({ ...seen, journal: { ...seen.journal, inferred: { ...inferred, ...change } } })
  expect(workingOf(withInferred({})).inferred).toBe('adding a mean')
  // The activity has moved to files that look never saw.
  expect(workingOf(withInferred({ paths: ['elsewhere.py'] })).inferred).toBe('')
  // It is over an hour old.
  expect(workingOf(withInferred({ at: NOW - 61 * MINUTE })).inferred).toBe('')
  // Nothing is going on, so nothing contradicts it.
  expect(workingOf({ ...withInferred({ paths: ['elsewhere.py'] }), journal: { ...emptyJournal(), inferred } }).inferred).toBe('adding a mean')

  const said = (at: number): Seen => ({ ...seen, journal: { ...seen.journal, said: { text: 'the mean', at } } })
  expect(workingOf(said(NOW - 30 * MINUTE))).toMatchObject({ said: 'the mean', saidAgo: '' })
  expect(workingOf(said(NOW - 3 * HOUR))).toMatchObject({ said: 'the mean', saidAgo: '3 h ago' })
  // Taken back.
  expect(workingOf({ ...seen, journal: { ...seen.journal, said: { text: '', at: NOW - 3 * HOUR } } })).toMatchObject({ said: '', saidAgo: '' })
})

test('the glance says what they are working on, where the time went, and the sitting in order', async () => {
  const seen: Seen = {
    journal: {
      said: { text: 'the mean', at: NOW - 30 * MINUTE },
      inferred: { text: 'adding a mean', at: NOW - MINUTE, paths: ['a.py'] },
      entries: [
        { at: NOW - 20 * MINUTE, kind: 'on', text: 'main' },
        ...ACTIVITY.slice(1),
        { at: NOW - 3 * MINUTE, kind: 'commit', hash: 'abc1234def', text: 'Add the mean' },
        { at: NOW - 2 * MINUTE, kind: 'note', path: 'a.py', line: 11, text: 'empty-input' },
      ],
      sittings: [
        { from: NOW - 150 * MINUTE, to: NOW - 2 * HOUR, files: [{ path: 'a.py', saves: 4, ms: 0 }, { path: 'b.py', saves: 1, ms: 0 }], commitCount: 2, commits: ['Fix it'], said: 'the parser' },
      ],
    },
    live: [],
    caret: { path: 'a.py', line: 11, where: 'mean', isModified: true, open: ['b.py', 'c.py'], visible: ['c.py'] },
    now: NOW,
  }
  const text = glanceText(seen)

  for (const line of [
    'Working on, in their own words (said 30 min ago): the mean',
    'Working on, as it looked at the last look (1 min ago): adding a mean',
    'Most of the activity is in: a.py, in mean (lines 10 to 14)',
    'The last 10 minutes (2 min with the caret moving in the editor):',
    '- a.py: 25% of the time in the editor, the caret mostly in mean (lines 10 to 12); saved twice, +6 -1 in mean (lines 10 to 14)',
    '- b.py: 75% of the time in the editor, the caret mostly in render (lines 40 to 60)',
    'Caret now: a.py line 11, in mean. That buffer has changes that are not saved.',
    'On screen beside it: c.py',
    'Also open in the editor: b.py',
    'This sitting, oldest first:',
    '- 20 min ago: the tutor was switched on, on branch main',
    '- 5 min ago: saved a.py twice over 1 min, +6 -1 in mean (lines 10 to 14)',
    '- 3 min ago: committed abc1234: Add the mean',
    '- 2 min ago: a play-by-play note was raised on a.py line 11 (empty-input)',
    'Last time they worked here (2 h ago, for 30 min): mostly a.py and b.py. 2 commits, the last "Fix it". They said they were working on: the parser.',
  ]) {
    expect(text).toMatch(line)
  }
  // Attention is in the picture, not in the timeline.
  expect(text).not.toMatch('ago: focus')

  // The conversation gets the few lines that place a question, and not the record.
  const brief = briefText(seen)
  expect(brief).toMatch('Backseat Driver: what the user is doing in their code right now')
  expect(brief).toMatch('Working on, in their own words (said 30 min ago): the mean')
  expect(brief).toMatch('Caret now: a.py line 11, in mean.')
  expect(brief).not.toMatch('This sitting')

  // With nothing to tell, nothing is said. Being switched on is not news.
  const nothing: Seen = { journal: emptyJournal(), live: [], caret: null, now: NOW }
  expect(glanceText(nothing)).toBe('')
  expect(briefText(nothing)).toBe('')
  expect(glanceText({ ...nothing, journal: { ...emptyJournal(), entries: [{ at: NOW, kind: 'on', text: 'main' }] } })).toBe('')
})

test('ago and took say a time in a few words', async () => {
  expect([10_000, MINUTE, 10 * MINUTE, 3 * HOUR, 72 * HOUR].map(ago)).toEqual(['just now', '1 min ago', '10 min ago', '3 h ago', '3 days ago'])
  expect([20_000, 6 * MINUTE, HOUR, 98 * MINUTE].map(took)).toEqual(['under a minute', '6 min', '1 h', '1 h 38 min'])
})

const NOTHING: Working = { said: '', saidAgo: '', inferred: '', where: '', share: '' }

test('the one question: what Enter gives never loses anything, and free text is theirs', async () => {
  expect(workingChoices(NOTHING)).toEqual([LET_IT_INFER, NOTHING_YET])
  expect(workingChoices({ ...NOTHING, inferred: 'adding a mean', where: 'a.py' })).toEqual([LET_IT_INFER, 'That is right: adding a mean'])
  expect(workingChoices({ ...NOTHING, where: 'a.py, in mean' })).toEqual([LET_IT_INFER, 'That is right: a.py, in mean'])
  expect(workingChoices({ ...NOTHING, said: 'the parser', inferred: 'adding a mean' })).toEqual(['Still: the parser', LET_IT_INFER])

  expect(chosen(LET_IT_INFER, NOTHING)).toBe(null)
  expect(chosen(NOTHING_YET, NOTHING)).toBe(null)
  expect(chosen(LET_IT_INFER, { ...NOTHING, said: 'the parser' })).toBe('')
  expect(chosen('Still: the parser', { ...NOTHING, said: 'the parser' })).toBe('the parser')
  expect(chosen('That is right: adding a mean', { ...NOTHING, inferred: 'adding a mean' })).toBe('adding a mean')
  expect(chosen('  the   lexer ', NOTHING)).toBe('the lexer')
})

test('/bsd working: what follows is what they are working on, and "clear" takes it back', async () => {
  expect(parseWorking('on the parser')).toBe('the parser')
  expect(parseWorking('the parser')).toBe('the parser')
  expect(parseWorking('online checkout')).toBe('online checkout')
  expect(parseWorking('clear')).toBe('')
  expect(parseWorking('')).toBe(null)
  expect(parseWorking('on')).toBe(null)
})

const MEAN = 'def mean(xs):\n    return sum(xs) / len(xs)\n'
const FILE = '/data/projects/p/journal.json'

/** A repository in memory with a recorder on it. */
function world(head: Record<string, string>, files: Record<string, string>, disk = memoryDisk()) {
  const recorder = createRecorder({
    disk,
    file: FILE,
    root: '/work',
    read: async path => files[path] ?? null,
    head: async path => head[path] ?? null,
  })

  return { recorder, files, head, disk, stored: () => parseJournal(JSON.parse(disk.files.get(FILE) ?? 'null') as unknown) }
}

test('a save is recorded with what it changed and where, and never with the code', async () => {
  const { recorder, files, disk } = world({ 'stats.py': MEAN }, { 'stats.py': MEAN })
  await recorder.start(0, 'main', [])
  files['stats.py'] = `${MEAN}\ndef total(xs):\n    return sum(xs)\n`
  await recorder.saved(['stats.py'], 1000)

  expect(recorder.journal().entries).toEqual([
    { at: 0, kind: 'on', text: 'main' },
    { at: 1000, kind: 'save', path: 'stats.py', until: 1000, saves: 1, added: 3, removed: 0, lines: [[3, 5]], where: 'total' },
  ])
  expect(recorder.working(2000)).toEqual({ said: '', saidAgo: '', inferred: '', where: 'stats.py, in total', share: 'saved once in the last 10 minutes' })

  // A save that changes nothing real is not an entry.
  files['stats.py'] = `${MEAN}\n\ndef total(xs):\n    return sum(xs)  \n`
  await recorder.saved(['stats.py'], 1500)
  expect(recorder.journal().entries.length).toBe(2)

  // It is written every so often, not on every save, and holds no line of the file.
  await recorder.flush(2000)
  expect(disk.files.size).toBe(0)
  await recorder.flush(FLUSH_MS)
  const written = disk.files.get(FILE) ?? ''
  expect(written).toMatch('"where": "total"')
  expect(written).not.toMatch('sum(xs)')

  // The tutor's activity tool, and only it, also gets what the save changed.
  const activity = recorder.activity(FLUSH_MS)
  expect(activity).toMatch('What their latest saves changed, newest first, as unified diffs:')
  expect(activity).toMatch('=== stats.py, saved just now ===')
  expect(activity).toMatch('+def total(xs):')
  expect(recorder.glance(FLUSH_MS)).not.toMatch('+def total(xs):')
})

test('work already uncommitted at switch-on is not counted as the first save', async () => {
  const { recorder, files, head } = world({ 'a.py': 'one\n' }, { 'a.py': 'one\ntwo\n' })
  // A reload of the module, not a switch-on: no entry for it.
  await recorder.start(0, null, ['a.py'])
  files['a.py'] = 'one\ntwo\nthree\n'
  await recorder.saved(['a.py'], 1000)
  expect(recorder.journal().entries).toEqual([
    { at: 1000, kind: 'save', path: 'a.py', until: 1000, saves: 1, added: 1, removed: 0, lines: [[3, 3]], where: '' },
  ])

  // Committed, so clean again: the next save is compared with what is committed now.
  head['a.py'] = 'one\ntwo\nthree\n'
  recorder.settle([])
  files['a.py'] = 'one\ntwo\nthree\nfour\n'
  await recorder.saved(['a.py'], 10 * MINUTE)
  const last = recorder.journal().entries[1]
  expect(last?.kind === 'save' ? [last.added, last.removed, last.lines] : null).toEqual([1, 0, [[4, 4]]])
})

test('two sessions can keep one journal without losing each other', async () => {
  const disk = memoryDisk()
  const one = world({}, {}, disk)
  const two = world({}, {}, disk)
  await one.recorder.start(0, 'main', [])
  await two.recorder.start(0, 'main', [])

  one.recorder.add({ at: 1000, kind: 'commit', hash: 'aaaa111', text: 'From one' })
  await one.recorder.flush(1000, true)
  two.recorder.add({ at: 2000, kind: 'commit', hash: 'bbbb222', text: 'From two' })
  await two.recorder.flush(2000, true)
  one.recorder.say('the parser', 3000)
  await one.recorder.flush(3000, true)

  const stored = one.stored()
  expect(stored.entries.map(entry => `${entry.kind}:${'text' in entry ? entry.text : ''}`)).toEqual([
    'on:main',
    'commit:From one',
    'commit:From two',
    'said:the parser',
  ])
  expect(stored.said).toEqual({ text: 'the parser', at: 3000 })
})

test('the editor file becomes where the caret is, and time in the file', async () => {
  const { recorder, files } = world({ 'stats.py': MEAN }, { 'stats.py': MEAN })
  let reads = 0
  const counted = createRecorder({
    disk: memoryDisk(),
    file: FILE,
    root: '/work',
    read: async path => {
      reads += 1

      return files[path] ?? null
    },
    head: async () => null,
  })
  for (const journal of [recorder, counted]) {
    await journal.start(0, 'main', [])
    journal.editor(JSON.stringify({ file: '/work/stats.py', line: 2, buffers: ['/work/notes.md'] }), 0, false)
    for (let now = 0; now <= 6000; now += 2000) await journal.tick(now)
  }
  // The definition is named once for a caret that stays put, however often the editor writes.
  counted.editor(JSON.stringify({ file: '/work/stats.py', line: 2 }), 6000, false)
  await counted.tick(8000)
  expect(reads).toBe(1)

  expect(recorder.working(6000)).toMatchObject({ where: 'stats.py, in mean', share: '100% of the last 10 minutes in the editor' })
  expect(recorder.brief(6000)).toMatch('Caret now: stats.py line 2, in mean.')
  expect(recorder.glance(6000)).toMatch('Also open in the editor: notes.md')

  // After two minutes a slice of attention becomes entries.
  for (let now = 8000; now <= 3 * MINUTE; now += 2000) await recorder.tick(now)
  expect(recorder.journal().entries.some(entry => entry.kind === 'focus' && entry.path === 'stats.py' && entry.where === 'mean')).toBe(true)
})

test('what a look made of their activity is dropped when HEAD moves, and their own words are not', async () => {
  const { recorder, stored } = world({}, {})
  await recorder.start(0, 'main', [])
  recorder.say('the parser', 1000)
  recorder.infer('  writing a\n parser ', ['a.py'], 2000)
  expect(recorder.working(3000)).toMatchObject({ said: 'the parser', inferred: 'writing a parser' })

  recorder.add({ at: 4000, kind: 'head', hash: 'cccc333', text: 'checkout: moving from main to other' })
  recorder.moved(4000)
  expect(recorder.working(5000)).toMatchObject({ said: 'the parser', inferred: '' })

  recorder.say('', 6000)
  await recorder.flush(6000, true)
  expect(stored().said).toEqual({ text: '', at: 6000 })
  expect(stored().inferred).toBe(null)
})

test('forgetting leaves nothing held that could be written back', async () => {
  const { recorder, disk } = world({}, {})
  await recorder.start(0, 'main', [])
  recorder.say('the parser', 1000)
  recorder.reset()
  await recorder.flush(2000, true)
  expect(disk.files.size).toBe(0)
  expect(recorder.working(2000)).toEqual(NOTHING)
})

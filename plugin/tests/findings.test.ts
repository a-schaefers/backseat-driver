import { expect, test } from 'claude-code/testing'

import {
  anchorIssue,
  coverageLine,
  countsWords,
  EMPTY_LEDGER,
  foundIssues,
  issuesBrief,
  issueWhere,
  LEDGER_MAX_CLOSED,
  ledgerLine,
  ledgerViews,
  parseFindingsFence,
  parseLedger,
  personIssue,
  placeIssues,
  placeLine,
  ruledIssues,
} from '../core/findings'
import type { Actor, Candidate, Ledger, PersonAction, Ruling, Severity } from '../core/findings'
import { splitReview } from '../core/project'

/** A random number in [0, 1), the same for the same seed, so that a failure names its history. */
function seeded(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FILES = ['index.php', 'includes/head.php', 'pdf-viewer.php', '.']
const TOPICS = ['sql-injection', 'output-escaping', 'type-juggling', 'secrets-in-repo']
const SEVERITY: readonly Severity[] = ['critical', 'high', 'medium', 'low']
const STATUSES = ['open', 'partly', 'resolved', 'dismissed', 'nonsense', '']
const ACTORS: readonly Actor[] = ['person', 'review', 'look']
const ACTIONS: readonly PersonAction[] = ['dismiss', 'restore', 'pin', 'unpin']

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T
}

function candidate(random: () => number): Candidate {
  const line = Math.floor(random() * 40)

  return {
    file: pick(random, FILES),
    line,
    lineText: random() < 0.8 ? `line ${line}` : '',
    severity: pick(random, SEVERITY),
    category: pick(random, ['security', 'bug', 'edge-case', 'logic', 'robustness', 'quality'] as const),
    topic: pick(random, TOPICS),
    title: 'An issue',
    text: random() < 0.95 ? 'What is wrong and why.' : '',
    condition: '',
  }
}

function openIds(ledger: Ledger): number[] {
  return ledger.findings.filter(finding => finding.status === 'open' || finding.status === 'partly').map(finding => finding.id)
}

/** A rule that must hold, naming where it broke. */
function must(isTrue: boolean, where: string): void {
  if (!isTrue) throw new Error(where)
}

test('the ledger keeps its rules over random histories', { timeoutMs: 120_000 }, () => {
  for (let seed = 1; seed <= 150; seed += 1) {
    const random = seeded(seed)
    let ledger: Ledger = EMPTY_LEDGER
    const everId = new Set<number>()
    for (let turn = 0; turn < 30; turn += 1) {
      const where = `seed ${seed}, turn ${turn}`
      const now = 1000 + turn * 1000
      const roll = random()
      const before = ledger
      if (roll < 0.4) {
        const candidates = Array.from({ length: 1 + Math.floor(random() * 4) }, () => candidate(random))
        const actor = random() < 0.85 ? 'review' : pick(random, ACTORS)
        const found = foundIssues(ledger, actor, now, random() < 0.5 ? 'audit' : 'review', 'abc1234', candidates)
        ledger = found.ledger
        // Only a review writes issues; a candidate the person dismissed is refused.
        if (actor !== 'review') expect(found.added.length + found.matched.length).toBe(0)
        for (const id of found.added) {
          expect(everId.has(id)).toBe(false)
          everId.add(id)
        }
        // The same candidates again add nothing.
        const again = foundIssues(ledger, actor, now, 'review', 'abc1234', candidates)
        expect(again.added).toEqual([])
        for (const finding of before.findings.filter(f => f.status === 'dismissed')) {
          const still = ledger.findings.find(f => f.id === finding.id)
          if (still !== undefined) expect(still.status).toBe('dismissed')
        }
      } else if (roll < 0.75) {
        const actor = pick(random, ACTORS)
        const ids = ledger.findings.map(finding => finding.id)
        const rulings: Ruling[] = Array.from({ length: 1 + Math.floor(random() * 3) }, () => ({
          id: random() < 0.85 && ids.length > 0 ? pick(random, ids) : 999,
          status: pick(random, STATUSES),
          note: 'what remains',
          severity: random() < 0.3 ? pick(random, SEVERITY) : '',
        }))
        ledger = ruledIssues(ledger, actor, now, rulings).ledger
        for (const finding of before.findings) {
          const after = ledger.findings.find(f => f.id === finding.id)
          if (after === undefined) continue
          // A model never dismisses, and never brings a dismissed issue back.
          if (actor !== 'person' && finding.status === 'dismissed') must(after.status === 'dismissed', `a model brought a dismissed issue back: ${where}`)
          if (actor !== 'person' && finding.status !== 'dismissed') must(after.status !== 'dismissed', `a model dismissed an issue: ${where}`)
          // The play-by-play only marks open issues resolved or partly, and never changes how bad one is.
          if (actor === 'look') {
            must(after.severity === finding.severity, `the play-by-play changed a severity: ${where}`)
            if (after.status !== finding.status) expect(['resolved', 'partly']).toContain(after.status)
            if (after.status !== finding.status) expect(['open', 'partly']).toContain(finding.status)
          }
        }
      } else {
        const ids = ledger.findings.map(finding => finding.id)
        if (ids.length > 0) ledger = personIssue(ledger, pick(random, ACTIONS), pick(random, ids), now)
      }

      // Ids are unique, and the counter is past every one.
      const ids = ledger.findings.map(finding => finding.id)
      must(new Set(ids).size === ids.length, `an id twice: ${where}`)
      for (const id of ids) must(id < ledger.nextId, `the counter is not past every id: ${where}`)
      // Every open issue is kept; at most so many closed ones.
      for (const id of openIds(before)) {
        const finding = ledger.findings.find(f => f.id === id)
        if (finding === undefined) throw new Error(`an open issue was dropped: ${where}`)
      }
      expect(ledger.findings.filter(f => f.status === 'resolved' || f.status === 'dismissed').length <= LEDGER_MAX_CLOSED).toBe(true)

      const saved = FILES.filter(() => random() < 0.5)
      const cap = Math.floor(random() * 4)
      const views = ledgerViews(ledger, { savedFiles: saved, cap })
      const opened = new Set(openIds(ledger))
      // The ranked and the folded are exactly the open issues, once each; the counts add up to them.
      const listed = [...views.ranked, ...views.folded]
      must(new Set(listed).size === listed.length, `an id twice in a view: ${where}`)
      expect(new Set(listed)).toEqual(opened)
      expect(views.counts.critical + views.counts.high + views.counts.medium + views.counts.low).toBe(opened.size)
      expect(views.serious).toBe(views.counts.critical + views.counts.high)
      // Ranked by severity, worst first.
      const rank = (id: number) => SEVERITY.indexOf(ledger.findings.find(f => f.id === id)?.severity ?? 'low')
      for (let at = 1; at < views.ranked.length; at += 1) must(rank(views.ranked[at - 1] ?? 0) <= rank(views.ranked[at] ?? 0), `the ranking is out of order: ${where}`)
      // The play-by-play's picks are open issues, at most so many; a pinned one is picked or counted.
      expect(views.play.length <= cap).toBe(true)
      for (const id of views.play) must(opened.has(id), `the play-by-play picked a closed issue: ${where}`)
      const pinned = ledger.findings.filter(f => f.isPinned && opened.has(f.id))
      for (const finding of pinned) must(views.play.includes(finding.id) || views.playMore > 0, `a pinned issue was neither picked nor counted: ${where}`)
      // A dismissed issue is in no view but the closed list.
      for (const finding of ledger.findings.filter(f => f.status === 'dismissed')) {
        must(!listed.includes(finding.id) && !views.play.includes(finding.id), `a dismissed issue is in a view: ${where}`)
      }
    }
  }
})

test('garbage on disk is never an issue, and never throws', () => {
  const random = seeded(7)
  const junk = [null, 1, 'x', [], { findings: 'no' }, { findings: [null, 1, { id: -3 }, { id: 2, file: '/etc/passwd', text: 't' }, { id: 2, file: 'a.py', text: '' }] }]
  for (const stored of junk) expect(parseLedger(stored).findings).toEqual([])
  for (let turn = 0; turn < 200; turn += 1) {
    const stored = { nextId: random() * 10, findings: [{ id: Math.floor(random() * 5), file: random() < 0.5 ? 'a.py' : '', text: 'x', severity: 'nope', status: 'what', line: -4 }] }
    const ledger = parseLedger(stored)
    for (const finding of ledger.findings) {
      expect(finding.severity).toBe('medium')
      expect(finding.status).toBe('open')
      expect(finding.line).toBe(0)
    }
  }
})

test('a review raising an issue on record again keeps it one issue, and brings a fixed one back', () => {
  const issue: Candidate = { file: 'index.php', line: 95, lineText: "$sql .= \"goal LIKE '%$goal%'\";", severity: 'high', category: 'security', topic: 'sql-injection', title: 'SQL built from the search words', text: 'The words go into the query text.', condition: '' }
  const first = foundIssues(EMPTY_LEDGER, 'review', 1000, 'audit', '570e787', [issue])
  expect(first.added).toEqual([1])
  // Moved two lines down by an edit: the same issue.
  const moved = foundIssues(first.ledger, 'review', 2000, 'review', 'abc1234', [{ ...issue, line: 97, lineText: '' }])
  expect(moved.matched).toEqual([1])
  expect(moved.ledger.findings).toHaveLength(1)
  // Resolved, then raised again: it is back, with the same id.
  const resolved = ruledIssues(moved.ledger, 'look', 3000, [{ id: 1, status: 'resolved', note: 'placeholders now', severity: '' }]).ledger
  expect(resolved.findings[0]?.status).toBe('resolved')
  const back = foundIssues(resolved, 'review', 4000, 'review', 'def5678', [issue])
  expect(back.matched).toEqual([1])
  expect(back.ledger.findings[0]?.status).toBe('open')
  // Dismissed by the person: refused when raised again, and no model brings it back.
  const dismissed = personIssue(back.ledger, 'dismiss', 1, 5000)
  expect(foundIssues(dismissed, 'review', 6000, 'review', 'x', [issue]).refused).toEqual([0])
  expect(ruledIssues(dismissed, 'review', 6000, [{ id: 1, status: 'open', note: '', severity: '' }]).refused).toEqual([1])
  expect(personIssue(dismissed, 'restore', 1, 7000).findings[0]?.status).toBe('open')
})

test('the reviewer writes issues, rulings and what it read in one fence, one object a line', () => {
  const answer = [
    'The search builds its SQL by hand.',
    '',
    '```backseat-findings',
    '{"file": "index.php", "line": 95, "quote": "$sql .= x;", "severity": "high", "category": "security", "topic": "SQL injection", "title": "SQL built from the search words", "text": "The words go into the query.", "condition": ""}',
    'not json at all',
    '{"id": 4, "status": "resolved", "note": "uses placeholders now"}',
    '{"file": "/etc/passwd", "line": 1, "text": "outside"}',
    '{"read": ["index.php", "includes/head.php", "../up"], "skipped": [{"path": "web/", "why": "PDF.js 2.16.105, vendored"}]}',
    '{"file": ".", "line": 0, "severity": "critical", "category": "security", "topic": "secrets-in-repo", "title": ".git in the web root", "text": "The repository is served.", "condition": "only if deployed as is"}',
    '```',
  ].join('\n')
  const fence = parseFindingsFence(answer)
  expect(fence.issues.map(issue => [issue.file, issue.topic, issue.severity])).toEqual([
    ['index.php', 'sql-injection', 'high'],
    ['.', 'secrets-in-repo', 'critical'],
  ])
  expect(fence.rulings).toEqual([{ id: 4, status: 'resolved', note: 'uses placeholders now', severity: '' }])
  expect(fence.coverage).toEqual({ read: ['index.php', 'includes/head.php'], skipped: [{ path: 'web/', why: 'PDF.js 2.16.105, vendored' }] })
  // The person never sees the fence.
  expect(splitReview(answer).text).toBe('The search builds its SQL by hand.')
})

test('an issue is placed at the line it quotes, now or as the commit left it, and dropped when it quotes nothing', () => {
  const now = ['<?php', '$a = 1;', '', '$sql .= "goal LIKE \'%$goal%\'";', 'run($sql);']
  const then = ['<?php', '$sql .= "goal LIKE \'%$goal%\'";']
  const issue = { file: 'index.php', line: 2, quote: '$sql .= "goal LIKE \'%$goal%\'";', severity: 'high' as const, category: 'security' as const, topic: 'sql-injection', title: 'SQL', text: 'Words in the query.', condition: '' }
  expect(anchorIssue(issue, now, then)).toMatchObject({ line: 4, lineText: '$sql .= "goal LIKE \'%$goal%\'";' })
  expect(anchorIssue(issue, ['nothing'], then)).toMatchObject({ line: 2 })
  // A quote in neither text, in a file that is there: kept for the file, never dropped without a word. No file: dropped.
  expect(anchorIssue(issue, ['nothing'], ['nor here'])).toMatchObject({ line: 0, lineText: '' })
  expect(anchorIssue(issue, null, null)).toBe(null)
  // A line's start up to a value left out, as a secret's line is quoted: eleven characters once trimmed (the live audit's).
  const start = anchorIssue({ ...issue, file: 'db.php', line: 10, quote: '$password = ' }, ['<?php', ...Array.from({ length: 8 }, () => ''), '$password = "not-for-the-ledger";'], null)
  expect(start).toMatchObject({ line: 10, lineText: '$password =' })
  expect(JSON.stringify(start)).not.toContain('not-for-the-ledger')
  expect(anchorIssue({ ...issue, file: '.', line: 0, quote: '' }, null, null)).toMatchObject({ file: '.', line: 0, lineText: '' })
  // A long quote a line contains is that line.
  expect(placeLine(['    $sql .= "goal LIKE" . $x; // build'], '$sql .= "goal LIKE" . $x;', 1)).toBe(1)
  // What is kept is the quote, never the rest of the line: a secret's line is quoted up to its value.
  const secret = anchorIssue({ ...issue, file: 'db.php', line: 3, quote: '$db_password = ' }, ['<?php', '$db_user = "app";', '$db_password = "not-for-the-ledger";'], null)
  expect(secret).toMatchObject({ line: 3, lineText: '$db_password =' })
  expect(JSON.stringify(secret)).not.toContain('not-for-the-ledger')
  expect(placeLine(['a', 'b'], '', 1)).toBe(null)
})

test('placement follows an issue\'s line and says when it is gone, without changing its status', () => {
  const found = foundIssues(EMPTY_LEDGER, 'review', 1, 'audit', 'x', [
    { file: 'a.php', line: 3, lineText: 'run($sql);', severity: 'high', category: 'security', topic: 'sql', title: 't', text: 'x', condition: '' },
    { file: 'a.php', line: 0, lineText: '', severity: 'low', category: 'quality', topic: 'naming', title: 't', text: 'x', condition: '' },
  ]).ledger
  expect(placeIssues(found, 'a.php', ['x', 'y', 'z', 'run($sql);'])).toEqual(new Map([[1, 4], [2, 0]]))
  expect(placeIssues(found, 'a.php', ['nothing'])).toEqual(new Map([[1, null], [2, 0]]))
  // Commented out since: dealt with or gone, never placed on the comment. Its text twice elsewhere: which, nobody can tell.
  expect(placeIssues(found, 'a.php', ['x', 'y', 'z', '// run($sql);'])).toEqual(new Map([[1, null], [2, 0]]))
  expect(placeIssues(found, 'a.php', ['run($sql);', 'x', 'y', 'z', 'run($sql);'])).toEqual(new Map([[1, null], [2, 0]]))
  expect(placeIssues(found, 'a.php', ['a', 'b', 'c', 'd', 'e', 'run($sql);'])).toEqual(new Map([[1, 6], [2, 0]]))
  // A quote that is itself a comment is found as one.
  expect(placeLine(['x', '# TODO: escape this'], '# TODO: escape this', 2)).toBe(2)
  expect(found.findings.every(finding => finding.status === 'open')).toBe(true)
  expect(issueWhere({ file: 'a.php', line: 3 }, null)).toBe('a.php:3')
  expect(issueWhere({ file: '.', line: 0 })).toBe('the project')
})

test('the conversation is told what was found and what was read, never that silence means healthy', () => {
  const clock = (ms: number) => (ms === 0 ? '' : '11:42')
  expect(issuesBrief(EMPTY_LEDGER, ledgerViews(EMPTY_LEDGER, { savedFiles: [], cap: 3 }), clock)).toMatch('has not been audited')
  const ledger = foundIssues(EMPTY_LEDGER, 'review', 1, 'audit', '570e787', [
    { file: 'index.php', line: 95, lineText: 'x', severity: 'high', category: 'security', topic: 'sql', title: 'SQL built from the search words', text: 't', condition: '' },
  ]).ledger
  const audited = { ...ledger, coverage: { at: 5, commit: '570e787abc', files: 22, read: ['index.php'], skipped: [{ path: 'web/', why: 'PDF.js' }] } }
  const brief = issuesBrief(audited, ledgerViews(audited, { savedFiles: [], cap: 3 }), clock)
  expect(brief).toMatch('Issues on record: 1 high open. Audited 11:42 at 570e787: read 1 of 22 source files; skipped web/ (PDF.js).')
  expect(brief).toMatch('- [high] index.php:95: SQL built from the search words')
  expect(coverageLine(EMPTY_LEDGER.coverage, clock)).toBe('')
  // An audit that read uncommitted changes says so; one that said nothing of its reading says that.
  expect(coverageLine({ at: 5, commit: '570e787+', files: 16, read: [], skipped: [] }, clock)).toBe('Audited 11:42 at 570e787 with uncommitted changes: it did not say which of the 16 source files it read.')
  expect(ledgerLine(ledgerViews(EMPTY_LEDGER, { savedFiles: [], cap: 3 }), true, { at: 5, commit: '', files: 1, read: [], skipped: [] })).toBe('The audit found nothing open.')
  expect(ledgerLine(ledgerViews(audited, { savedFiles: [], cap: 3 }), true, audited.coverage)).toBe('Open in the deep review: 1 high.')
  expect(countsWords({ critical: 1, high: 0, medium: 2, low: 3 }, false)).toBe('1 critical, 2 medium')
})

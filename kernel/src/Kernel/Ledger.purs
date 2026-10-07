-- | The project's ledger of issues: what the deep reviews and audits found in
-- | the person's code, ranked from critical to low, kept until it is fixed or
-- | dismissed.
-- |
-- | One record per issue, which every view draws: the Deep review tab ranks
-- | them, the play-by-play shows the few that matter where the person is
-- | working, the conversation is told the worst. Dismissed once, it is gone
-- | from all of them; resolved once, it is resolved everywhere (the owner,
-- | 2026-10-07: "if a user dismisses one on either side … it should dismiss
-- | from both").
-- |
-- | Rules that the types and the functions here hold:
-- |   * Ids come from the ledger's own counter and are never reused.
-- |   * Who may say what of an issue (`mayRule`): the person dismisses any and
-- |     brings a dismissed one back; a review rules on anything not dismissed
-- |     and may change its severity; the play-by-play may only mark an open
-- |     issue resolved or partly resolved, in the lines it was shown. A model
-- |     never dismisses, and never brings a dismissed issue back.
-- |   * A candidate that is an issue on record (same file and topic, and the
-- |     same quoted line or one within `ledgerNearLines`) is that issue, not a
-- |     second one; one the person dismissed is refused.
-- |   * Placement (where an issue's line is now) never changes a status: it is
-- |     worked out at the edge from the current text, and only a ruling moves
-- |     an issue on.
module Kernel.Ledger
  ( LedgerFindingWire
  , LedgerSkippedWire
  , LedgerCoverageWire
  , LedgerWire
  , LedgerCandidateWire
  , LedgerRulingWire
  , LedgerFoundWire
  , LedgerRuledWire
  , LedgerFactsWire
  , LedgerCountsWire
  , LedgerViewsWire
  , LedgerAskedWire
  , ledgerNormalWire
  , ledgerFoundWire
  , ledgerRuledWire
  , ledgerPersonWire
  , ledgerCoveredWire
  , ledgerViewsWire
  , ledgerAskedWire
  , ledgerMaxClosed
  , ledgerNearLines
  ) where

import Prelude

import Data.Array (elem, filter, find, foldl, length, mapWithIndex, notElem, nubByEq, null, snoc, sortBy, take)
import Data.Foldable (maximum)
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Ord (abs)

-- | How bad an issue is. The order is the ranking: critical first.
data Severity = Critical | High | Medium | Low

derive instance eqSeverity :: Eq Severity
derive instance ordSeverity :: Ord Severity

-- | What kind of issue it is. The order breaks ties in the ranking: security
-- | first, then what is wrong, then what will bite, then what reads badly.
data Category = Security | Bug | EdgeCase | Logic | Robustness | Quality

derive instance eqCategory :: Eq Category
derive instance ordCategory :: Ord Category

data Status = Open | Partly | Resolved | Dismissed

derive instance eqStatus :: Eq Status

-- | Who says something of an issue.
data Actor = Person | Review | Look

derive instance eqActor :: Eq Actor

type Finding =
  { id :: Int
  , file :: String
  -- | 0 for an issue about the whole file.
  , line :: Int
  -- | The line as it read when the issue was found: where to look for it after the file has changed.
  , lineText :: String
  , severity :: Severity
  , category :: Category
  , topic :: String
  -- | A few words to scan a list by: "SQL built from the search words".
  , title :: String
  , text :: String
  -- | '' or the condition it depends on: "only if the site is deployed with its .git folder".
  , condition :: String
  -- | audit | review
  , origin :: String
  , commit :: String
  , at :: Number
  , status :: Status
  , statusAt :: Number
  -- | person | review | look
  , statusBy :: String
  , statusNote :: String
  , isPinned :: Boolean
  }

-- | Flat, every field present: what crosses into TypeScript and what `findings.json` keeps.
type LedgerFindingWire =
  { id :: Int
  , file :: String
  , line :: Int
  , lineText :: String
  , severity :: String
  , category :: String
  , topic :: String
  , title :: String
  , text :: String
  , condition :: String
  , origin :: String
  , commit :: String
  , at :: Number
  , status :: String
  , statusAt :: Number
  , statusBy :: String
  , statusNote :: String
  , isPinned :: Boolean
  }

type LedgerSkippedWire = { path :: String, why :: String }

-- | What the last audit read: its time and commit, how many source files git listed, what it says it read and skipped.
type LedgerCoverageWire =
  { at :: Number
  , commit :: String
  , files :: Int
  , read :: Array String
  , skipped :: Array LedgerSkippedWire
  }

type LedgerWire = { nextId :: Int, findings :: Array LedgerFindingWire, coverage :: LedgerCoverageWire }

-- | An issue a review raised, already placed in the file by the edge.
type LedgerCandidateWire =
  { file :: String
  , line :: Int
  , lineText :: String
  , severity :: String
  , category :: String
  , topic :: String
  , title :: String
  , text :: String
  , condition :: String
  }

-- | What a model or the person says of an issue on record. `severity` '' leaves it as it is.
type LedgerRulingWire = { id :: Int, status :: String, note :: String, severity :: String }

type LedgerFoundWire = { ledger :: LedgerWire, added :: Array Int, matched :: Array Int, refused :: Array Int }

type LedgerRuledWire = { ledger :: LedgerWire, applied :: Array Int, refused :: Array Int }

-- | What the play-by-play's picks rest on: the files saved this sitting, and how many it shows at most.
type LedgerFactsWire = { savedFiles :: Array String, cap :: Int }

type LedgerCountsWire = { critical :: Int, high :: Int, medium :: Int, low :: Int }

-- | The views, as ids: `ranked` the open issues worse than low, in order; `folded` the low ones; `closed` the
-- | resolved and dismissed, latest first; `serious` how many critical and high are open; `play` what the
-- | play-by-play shows and `playMore` how many more it would.
type LedgerViewsWire =
  { ranked :: Array Int
  , folded :: Array Int
  , closed :: Array Int
  , counts :: LedgerCountsWire
  , serious :: Int
  , play :: Array Int
  , playMore :: Int
  }

-- | What a request lists for some files (all, when none are named): the open issues in order, and the dismissed.
type LedgerAskedWire = { open :: Array Int, dismissed :: Array Int }

newtype Ledger = Ledger { nextId :: Int, findings :: Array Finding, coverage :: LedgerCoverageWire }

-- | How many resolved and dismissed issues are kept, latest first. A dismissed one has to be kept to refuse it
-- | when a review raises it again.
ledgerMaxClosed :: Int
ledgerMaxClosed = 60

-- | A candidate this near an issue on record, about the same file and topic, is that issue.
ledgerNearLines :: Int
ledgerNearLines = 3

severityOf :: String -> Severity
severityOf = case _ of
  "critical" -> Critical
  "high" -> High
  "low" -> Low
  _ -> Medium

severityWord :: Severity -> String
severityWord = case _ of
  Critical -> "critical"
  High -> "high"
  Medium -> "medium"
  Low -> "low"

categoryOf :: String -> Category
categoryOf = case _ of
  "security" -> Security
  "bug" -> Bug
  "edge-case" -> EdgeCase
  "logic" -> Logic
  "robustness" -> Robustness
  _ -> Quality

categoryWord :: Category -> String
categoryWord = case _ of
  Security -> "security"
  Bug -> "bug"
  EdgeCase -> "edge-case"
  Logic -> "logic"
  Robustness -> "robustness"
  Quality -> "quality"

statusOf :: String -> Maybe Status
statusOf = case _ of
  "open" -> Just Open
  "partly" -> Just Partly
  "resolved" -> Just Resolved
  "dismissed" -> Just Dismissed
  _ -> Nothing

statusWord :: Status -> String
statusWord = case _ of
  Open -> "open"
  Partly -> "partly"
  Resolved -> "resolved"
  Dismissed -> "dismissed"

actorOf :: String -> Actor
actorOf = case _ of
  "person" -> Person
  "review" -> Review
  _ -> Look

actorWord :: Actor -> String
actorWord = case _ of
  Person -> "person"
  Review -> "review"
  Look -> "look"

isOpen :: Finding -> Boolean
isOpen finding = finding.status == Open || finding.status == Partly

findingFromWire :: LedgerFindingWire -> Finding
findingFromWire w =
  { id: w.id
  , file: w.file
  , line: max 0 w.line
  , lineText: w.lineText
  , severity: severityOf w.severity
  , category: categoryOf w.category
  , topic: w.topic
  , title: w.title
  , text: w.text
  , condition: w.condition
  , origin: w.origin
  , commit: w.commit
  , at: w.at
  , status: fromMaybe Open (statusOf w.status)
  , statusAt: w.statusAt
  , statusBy: w.statusBy
  , statusNote: w.statusNote
  , isPinned: w.isPinned && w.status /= "dismissed" && w.status /= "resolved"
  }

findingToWire :: Finding -> LedgerFindingWire
findingToWire f =
  { id: f.id
  , file: f.file
  , line: f.line
  , lineText: f.lineText
  , severity: severityWord f.severity
  , category: categoryWord f.category
  , topic: f.topic
  , title: f.title
  , text: f.text
  , condition: f.condition
  , origin: f.origin
  , commit: f.commit
  , at: f.at
  , status: statusWord f.status
  , statusAt: f.statusAt
  , statusBy: f.statusBy
  , statusNote: f.statusNote
  , isPinned: f.isPinned
  }

-- | What is kept: every open issue, and the latest `ledgerMaxClosed` closed ones.
pruned :: Ledger -> Ledger
pruned (Ledger l) =
  let
    closed = take ledgerMaxClosed (sortBy (\a b -> compare b.statusAt a.statusAt <> compare b.id a.id) (filter (not <<< isOpen) l.findings))
    kept = map _.id closed
  in
    Ledger (l { findings = filter (\f -> isOpen f || elem f.id kept) l.findings })

-- | The only way in from the wire: issues without a file, a text or a positive id are dropped, an id named twice
-- | is kept once, and the counter is set past every id.
fromWire :: LedgerWire -> Ledger
fromWire w =
  let
    kept = nubByEq (\a b -> a.id == b.id) (filter (\f -> f.id > 0 && f.file /= "" && f.text /= "") (map findingFromWire w.findings))
    top = fromMaybe 0 (maximum (map _.id kept))
  in
    pruned (Ledger { nextId: max w.nextId (top + 1), findings: kept, coverage: w.coverage })

toWire :: Ledger -> LedgerWire
toWire (Ledger l) = { nextId: l.nextId, findings: map findingToWire l.findings, coverage: l.coverage }

ledgerNormalWire :: LedgerWire -> LedgerWire
ledgerNormalWire = toWire <<< fromWire

isSame :: LedgerCandidateWire -> Finding -> Boolean
isSame candidate finding =
  finding.file == candidate.file
    && finding.topic == candidate.topic
    && ((candidate.lineText /= "" && finding.lineText == candidate.lineText) || abs (finding.line - candidate.line) <= ledgerNearLines)

type FoundStep = { ledger :: Ledger, added :: Array Int, matched :: Array Int, refused :: Array Int }

-- | A candidate raised again: the review's words and place are the latest; one resolved since is back.
raisedAgain :: Actor -> Number -> LedgerCandidateWire -> Finding -> Finding
raisedAgain actor at candidate finding =
  let
    isBack = finding.status == Resolved
  in
    finding
      { line = candidate.line
      , lineText = candidate.lineText
      , severity = severityOf candidate.severity
      , category = categoryOf candidate.category
      , title = candidate.title
      , text = candidate.text
      , condition = candidate.condition
      , status = if isBack then Open else finding.status
      , statusAt = if isBack then at else finding.statusAt
      , statusBy = if isBack then actorWord actor else finding.statusBy
      , statusNote = if isBack then "" else finding.statusNote
      }

freshFinding :: Actor -> Number -> String -> String -> LedgerCandidateWire -> Int -> Finding
freshFinding actor at origin commit candidate id =
  { id
  , file: candidate.file
  , line: max 0 candidate.line
  , lineText: candidate.lineText
  , severity: severityOf candidate.severity
  , category: categoryOf candidate.category
  , topic: candidate.topic
  , title: candidate.title
  , text: candidate.text
  , condition: candidate.condition
  , origin
  , commit
  , at
  , status: Open
  , statusAt: at
  , statusBy: actorWord actor
  , statusNote: ""
  , isPinned: false
  }

foundStep :: Actor -> Number -> String -> String -> FoundStep -> { index :: Int, candidate :: LedgerCandidateWire } -> FoundStep
foundStep actor at origin commit acc { index, candidate } =
  case acc.ledger of
    Ledger l ->
      -- The play-by-play rules on issues; it never writes one that lasts.
      if actor /= Review || candidate.file == "" || candidate.text == "" then acc { refused = snoc acc.refused index }
      else case find (isSame candidate) l.findings of
        Just finding
          | finding.status == Dismissed -> acc { refused = snoc acc.refused index }
          | otherwise ->
              acc
                { ledger = Ledger (l { findings = map (\f -> if f.id == finding.id then raisedAgain actor at candidate f else f) l.findings })
                , matched = snoc acc.matched finding.id
                }
        Nothing ->
          acc
            { ledger = Ledger (l { nextId = l.nextId + 1, findings = snoc l.findings (freshFinding actor at origin commit candidate l.nextId) })
            , added = snoc acc.added l.nextId
            }

-- | Issues a review raised: each a new issue, or one on record raised again. `refused` holds the candidates'
-- | indexes: the person dismissed it, it says nothing, or the actor may not write issues.
ledgerFoundWire :: String -> Number -> String -> String -> Array LedgerCandidateWire -> LedgerWire -> LedgerFoundWire
ledgerFoundWire actor at origin commit candidates ledger =
  let
    done = foldl (foundStep (actorOf actor) at origin commit) { ledger: fromWire ledger, added: [], matched: [], refused: [] } (mapWithIndex (\index candidate -> { index, candidate }) candidates)
  in
    { ledger: toWire (pruned done.ledger), added: done.added, matched: done.matched, refused: done.refused }

-- | Who may move an issue from one status to another.
mayRule :: Actor -> Status -> Status -> Boolean
mayRule actor from to = case actor of
  Person -> to == Dismissed || (from == Dismissed && to == Open)
  Review -> from /= Dismissed && to /= Dismissed
  Look -> isOpenStatus from && (to == Resolved || to == Partly)
  where
  isOpenStatus status = status == Open || status == Partly

type RuledStep = { ledger :: Ledger, applied :: Array Int, refused :: Array Int }

ruledStep :: Actor -> Number -> RuledStep -> LedgerRulingWire -> RuledStep
ruledStep actor at acc ruling =
  case acc.ledger of
    Ledger l -> case statusOf ruling.status, find (\f -> f.id == ruling.id) l.findings of
      Just to, Just finding
        | mayRule actor finding.status to ->
            let
              changed = finding
                { status = to
                , statusAt = at
                , statusBy = actorWord actor
                , statusNote = ruling.note
                , severity = if actor == Review && ruling.severity /= "" then severityOf ruling.severity else finding.severity
                , isPinned = finding.isPinned && to /= Dismissed && to /= Resolved
                }
            in
              acc { ledger = Ledger (l { findings = map (\f -> if f.id == ruling.id then changed else f) l.findings }), applied = snoc acc.applied ruling.id }
      _, _ -> acc { refused = snoc acc.refused ruling.id }

-- | What a review or the play-by-play says of issues on record, each applied when the actor may say it.
ledgerRuledWire :: String -> Number -> Array LedgerRulingWire -> LedgerWire -> LedgerRuledWire
ledgerRuledWire actor at rulings ledger =
  let
    done = foldl (ruledStep (actorOf actor) at) { ledger: fromWire ledger, applied: [], refused: [] } rulings
  in
    { ledger: toWire (pruned done.ledger), applied: done.applied, refused: done.refused }

-- | What the person does to one issue: `dismiss` (gone from every view), `restore` (a dismissed one back),
-- | `pin` (shown in the play-by-play while open), `unpin`. Anything else changes nothing.
ledgerPersonWire :: String -> Int -> Number -> LedgerWire -> LedgerWire
ledgerPersonWire action id at ledger =
  case fromWire ledger of
    Ledger l -> toWire (pruned (Ledger (l { findings = map change l.findings })))
  where
  change f
    | f.id /= id = f
    | otherwise = case action of
        "dismiss" | f.status /= Dismissed -> f { status = Dismissed, statusAt = at, statusBy = "person", statusNote = "", isPinned = false }
        "restore" | f.status == Dismissed -> f { status = Open, statusAt = at, statusBy = "person", statusNote = "" }
        "pin" | isOpen f -> f { isPinned = true }
        "unpin" -> f { isPinned = false }
        _ -> f

-- | What an audit read, kept with the ledger.
ledgerCoveredWire :: LedgerCoverageWire -> LedgerWire -> LedgerWire
ledgerCoveredWire coverage ledger =
  case fromWire ledger of
    Ledger l -> toWire (Ledger (l { coverage = coverage }))

rankOrder :: Finding -> Finding -> Ordering
rankOrder a b = compare a.severity b.severity <> compare a.category b.category <> compare a.file b.file <> compare a.line b.line <> compare a.id b.id

-- | The views every surface draws from the one ledger.
ledgerViewsWire :: LedgerFactsWire -> LedgerWire -> LedgerViewsWire
ledgerViewsWire facts ledger =
  case fromWire ledger of
    Ledger l ->
      let
        opened = sortBy rankOrder (filter isOpen l.findings)
        count severity = length (filter (\f -> f.severity == severity) opened)
        closed = sortBy (\a b -> compare b.statusAt a.statusAt <> compare b.id a.id) (filter (not <<< isOpen) l.findings)
        isSerious f = f.severity == Critical || f.severity == High
        isNearby f = elem f.file facts.savedFiles
        wanted = filter _.isPinned opened <> filter (\f -> not f.isPinned && isSerious f && isNearby f) opened
        play = map _.id (take (max 0 facts.cap) wanted)
      in
        { ranked: map _.id (filter (\f -> f.severity /= Low) opened)
        , folded: map _.id (filter (\f -> f.severity == Low) opened)
        , closed: map _.id closed
        , counts: { critical: count Critical, high: count High, medium: count Medium, low: count Low }
        , serious: count Critical + count High
        , play
        , playMore: length (filter (\f -> (f.isPinned || isNearby f) && notElem f.id play) opened)
        }

-- | The issues a request lists for some files, or for all of them when none are named.
ledgerAskedWire :: Array String -> LedgerWire -> LedgerAskedWire
ledgerAskedWire files ledger =
  case fromWire ledger of
    Ledger l ->
      let
        isAsked f = null files || elem f.file files
      in
        { open: map _.id (sortBy rankOrder (filter (\f -> isOpen f && isAsked f) l.findings))
        , dismissed: map _.id (filter (\f -> f.status == Dismissed && isAsked f) l.findings)
        }

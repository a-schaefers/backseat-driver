-- | The commits that are waiting for their deep review, or for the look at
-- | the person's progress that follows it.
-- |
-- | A commit goes in the moment it is seen and comes out when both are done.
-- | It is kept in the project's folder, so that a commit made while Claude
-- | was not answering, while the plan was at its limit, or just before the
-- | session was closed is still reviewed: when things are back, or the next
-- | time the tutor is switched on here. Only the latest few are kept, and not
-- | for long: a review of last week's commit helps nobody.
-- |
-- | Rules that the types and the functions here hold:
-- |   * A queue holds at most `maxWaiting` commits, oldest first, and never
-- |     the same commit twice. `Queue` is opaque: only these functions make
-- |     one, so no caller can build one that breaks this.
-- |   * A commit is at one stage at a time, its review or the look at
-- |     progress after it, and its tries count for that stage alone. Moving
-- |     on starts the count again.
module Kernel.Queue
  ( Stage(..)
  , Waiting
  , Queue
  , Wanted
  , fromCommits
  , toCommits
  , current
  , withCommit
  , withoutCommit
  , reviewed
  , withAttempt
  , isSpent
  , retryMs
  , nextToReview
  , nextToAssess
  , settledIn
  , heldText
  , failedText
  , planHeld
  , maxWaiting
  , maxWaitMs
  , maxAttempts
  , retryBaseMs
  , watchdogMs
  , watchdogLimitMs
  , verdictMs
  , WaitingWire
  , WantedWire
  , NextWire
  , currentQueueWire
  , withCommitWire
  , withoutCommitWire
  , reviewedWire
  , withAttemptWire
  , isSpentWire
  , nextToReviewWire
  , nextToAssessWire
  , settledInWire
  , heldTextWire
  , failedTextWire
  ) where

import Prelude

import Data.Array (any, filter, find, nubByEq, snoc, takeEnd)
import Data.Int (toNumber)
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Number (pow)
import Kernel.Health (Health(..), HealthWire, healthFromWire)
import Kernel.Pace (Pressure, PressureWire, pressureFromWire)

-- | What a waiting commit still needs: its deep review, or, with that done
-- | or given up on, the look at the person's progress.
data Stage = ToReview | ToAssess

derive instance eqStage :: Eq Stage

type Waiting =
  { hash :: String
  , title :: String
  -- | When the commit was seen, in clock milliseconds.
  , at :: Number
  , stage :: Stage
  -- | Tries that got no answer, at the stage it is at now.
  , attempts :: Int
  }

-- | Oldest first, at most `maxWaiting`, every hash once.
newtype Queue = Queue (Array Waiting)

-- | How many commits wait at most. A newer one pushes the oldest out.
maxWaiting :: Int
maxWaiting = 3

-- | A commit that has waited this long is let go.
maxWaitMs :: Number
maxWaitMs = 24.0 * 60.0 * 60.0 * 1000.0

-- | How often one stage of one commit is tried before it is given up on.
maxAttempts :: Int
maxAttempts = 3

-- | After a try that got no answer, the next one waits this long, doubling.
retryBaseMs :: Number
retryBaseMs = 60000.0

-- | A review that has not reported back after this long is looked for.
watchdogMs :: Number
watchdogMs = 15.0 * 60.0 * 1000.0

-- | One that is still running then gets until this long after it started, and no longer.
watchdogLimitMs :: Number
watchdogLimitMs = 45.0 * 60.0 * 1000.0

-- | A review that died on an API error ends saying only "error". Which error
-- | arrives separately, at about the same moment, before or after. It gets
-- | this long to arrive before the failure is taken to have no known reason.
verdictMs :: Number
verdictMs = 2000.0

-- | The only way in: the latest `maxWaiting`, each commit once (the first
-- | time it is named).
fromCommits :: Array Waiting -> Queue
fromCommits = Queue <<< takeEnd maxWaiting <<< nubByEq (\a b -> a.hash == b.hash)

toCommits :: Queue -> Array Waiting
toCommits (Queue commits) = commits

-- | The queue without what has waited too long.
current :: Number -> Queue -> Queue
current now (Queue commits) = Queue (filter (\commit -> now - commit.at < maxWaitMs) commits)

-- | A commit that was just seen joins the end. One already waiting stays as it is.
withCommit :: { hash :: String, title :: String } -> Number -> Queue -> Queue
withCommit commit at queue@(Queue commits)
  | any (\known -> known.hash == commit.hash) commits = queue
  | otherwise = Queue (takeEnd maxWaiting (snoc commits { hash: commit.hash, title: commit.title, at, stage: ToReview, attempts: 0 }))

withoutCommit :: String -> Queue -> Queue
withoutCommit hash (Queue commits) = Queue (filter (\commit -> commit.hash /= hash) commits)

changed :: String -> (Waiting -> Waiting) -> Queue -> Queue
changed hash change (Queue commits) = Queue (map (\commit -> if commit.hash == hash then change commit else commit) commits)

-- | The commit's review is done, or given up on: what is left is the look at
-- | the person's progress, with no tries spent on it yet.
reviewed :: String -> Queue -> Queue
reviewed hash = changed hash (_ { stage = ToAssess, attempts = 0 })

-- | One more try at the commit's present stage got no answer.
withAttempt :: String -> Queue -> Queue
withAttempt hash = changed hash (\commit -> commit { attempts = commit.attempts + 1 })

-- | Whether the commit's present stage has been tried as often as it will be.
-- | A commit that is not waiting has not been tried.
isSpent :: String -> Queue -> Boolean
isSpent hash (Queue commits) = fromMaybe 0 (_.attempts <$> find (\commit -> commit.hash == hash) commits) >= maxAttempts

-- | How long to wait after the nth try in a row that got no answer.
retryMs :: Int -> Number
retryMs attempts = retryBaseMs * pow 2.0 (toNumber (max 0 (attempts - 1)))

type Wanted =
  -- | Whether commits are reviewed as they are made.
  { wantsReview :: Boolean
  -- | Whether the person's progress is kept.
  , wantsAssessment :: Boolean
  }

-- | Whether the commit is past its review: done, given up on, or not wanted.
isPastReview :: Wanted -> Waiting -> Boolean
isPastReview wanted commit = commit.stage == ToAssess || not wanted.wantsReview

-- | The oldest commit that still needs its review.
nextToReview :: Wanted -> Queue -> Maybe Waiting
nextToReview wanted (Queue commits)
  | wanted.wantsReview = find (\commit -> commit.stage == ToReview) commits
  | otherwise = Nothing

-- | The oldest commit whose review is done with and which still needs the
-- | look at the person's progress.
nextToAssess :: Wanted -> Queue -> Maybe Waiting
nextToAssess wanted (Queue commits)
  | wanted.wantsAssessment = find (isPastReview wanted) commits
  | otherwise = Nothing

-- | The commits that need nothing more under these settings, to be taken out.
settledIn :: Wanted -> Queue -> Array String
settledIn wanted (Queue commits)
  | wanted.wantsAssessment = []
  | otherwise = map _.hash (filter (isPastReview wanted) commits)

-- | What the Deep review tab says about a commit whose review is held back by the plan's limit.
planHeld :: String
planHeld = "you are close to your plan limit. Press r to run it anyway."

-- | Why a waiting review is not running, as the tab says it. "" when nothing
-- | holds it back. `jobBlock` is why the job's own request is refused, when
-- | it is. `retryAt` is the review's own next try, when it has one planned:
-- | the time named is the later of the two. `clock` says a time of day.
heldText :: (Number -> String) -> Health -> Pressure -> Maybe String -> Maybe Number -> String
heldText clock health pressure jobBlock retryAt = case jobBlock, health of
  Just block, _ -> "the deep review cannot run (" <> block <> "). Its model is set in /config."
  _, Blocked b -> "Claude is refusing this account (" <> b.detail <> "). It is reviewed once that is sorted out."
  _, _ | pressure.isHeld -> planHeld
  _, Waiting w -> notAnswering w.detail ("at " <> clock (max w.until (fromMaybe 0.0 retryAt)))
  _, Probing p -> notAnswering p.detail (maybe' "shortly" (\at -> "at " <> clock at) retryAt)
  _, _ -> ""
  where
  notAnswering detail when = "Claude is not answering (" <> detail <> "). It is tried again " <> when <> ", or press r."
  maybe' none some = case _ of
    Just at -> some at
    Nothing -> none

-- | What the tab says after a try that got no answer: when the next one is,
-- | or that there will be none.
failedText :: (Number -> String) -> String -> Maybe Number -> String
failedText clock detail = case _ of
  Nothing -> detail <> ". Press r to run it again."
  Just at -> detail <> ". It is tried again at " <> clock at <> ", or press r."

-- The same, as the plain records the shell holds.

-- | `isReviewed` is the stage: true once the review is done with.
type WaitingWire = { hash :: String, title :: String, at :: Number, isReviewed :: Boolean, attempts :: Int }

type WantedWire = Wanted

-- | `has` is false when there is no such commit, and `commit` is then empty.
type NextWire = { has :: Boolean, commit :: WaitingWire }

waitingFromWire :: WaitingWire -> Waiting
waitingFromWire w = { hash: w.hash, title: w.title, at: w.at, stage: if w.isReviewed then ToAssess else ToReview, attempts: w.attempts }

waitingToWire :: Waiting -> WaitingWire
waitingToWire w = { hash: w.hash, title: w.title, at: w.at, isReviewed: w.stage == ToAssess, attempts: w.attempts }

fromWire :: Array WaitingWire -> Queue
fromWire = fromCommits <<< map waitingFromWire

toWire :: Queue -> Array WaitingWire
toWire = map waitingToWire <<< toCommits

through :: (Queue -> Queue) -> Array WaitingWire -> Array WaitingWire
through change = toWire <<< change <<< fromWire

nextToWire :: Maybe Waiting -> NextWire
nextToWire = case _ of
  Just commit -> { has: true, commit: waitingToWire commit }
  Nothing -> { has: false, commit: { hash: "", title: "", at: 0.0, isReviewed: false, attempts: 0 } }

currentQueueWire :: Array WaitingWire -> Number -> Array WaitingWire
currentQueueWire commits now = through (current now) commits

withCommitWire :: Array WaitingWire -> String -> String -> Number -> Array WaitingWire
withCommitWire commits hash title at = through (withCommit { hash, title } at) commits

withoutCommitWire :: Array WaitingWire -> String -> Array WaitingWire
withoutCommitWire commits hash = through (withoutCommit hash) commits

reviewedWire :: Array WaitingWire -> String -> Array WaitingWire
reviewedWire commits hash = through (reviewed hash) commits

withAttemptWire :: Array WaitingWire -> String -> Array WaitingWire
withAttemptWire commits hash = through (withAttempt hash) commits

isSpentWire :: Array WaitingWire -> String -> Boolean
isSpentWire commits hash = isSpent hash (fromWire commits)

nextToReviewWire :: Array WaitingWire -> WantedWire -> NextWire
nextToReviewWire commits wanted = nextToWire (nextToReview wanted (fromWire commits))

nextToAssessWire :: Array WaitingWire -> WantedWire -> NextWire
nextToAssessWire commits wanted = nextToWire (nextToAssess wanted (fromWire commits))

settledInWire :: Array WaitingWire -> WantedWire -> Array String
settledInWire commits wanted = settledIn wanted (fromWire commits)

-- | `jobBlock` is "" when the job's request is not refused, and `hasRetryAt`
-- | says whether `retryAt` means anything.
heldTextWire :: (Number -> String) -> HealthWire -> PressureWire -> String -> Boolean -> Number -> String
heldTextWire clock health pressure jobBlock hasRetryAt retryAt =
  heldText clock (healthFromWire health) (pressureFromWire pressure) (if jobBlock == "" then Nothing else Just jobBlock) (if hasRetryAt then Just retryAt else Nothing)

failedTextWire :: (Number -> String) -> String -> Boolean -> Number -> String
failedTextWire clock detail hasRetryAt retryAt = failedText clock detail (if hasRetryAt then Just retryAt else Nothing)


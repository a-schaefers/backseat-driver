-- | What the play-by-play is doing, and when it looks next.
-- |
-- | Both are worked out from the facts each time one of them changes: what is
-- | pending, when the last save and the last look were, how the last request
-- | went, and how close the plan's limit is. Nothing here is remembered, so
-- | it cannot disagree with the facts.
-- |
-- | Rules that `playOf` holds:
-- |   * No look is due while one runs, while the tutor is paused, while
-- |     another session drives the project, or outside a repository.
-- |   * A look that is wanted and held back always says why.
-- |   * A look never starts by itself while Claude is known not to be
-- |     answering, except as the one request that finds out whether it is back.
module Kernel.Play
  ( Why(..)
  , Play(..)
  , Pressure
  , Facts
  , playOf
  , wakeAt
  , isLookDue
  , PressureWire
  , FactsWire
  , PlayWire
  , playOfWire
  , wakeAtWire
  , isLookDueWire
  ) where

import Prelude

import Data.Maybe (Maybe(..))
import Kernel.Health (Health, HealthWire, Trouble, healthFromWire, mayAsk, troubleTag)
import Kernel.Health as Health
import Kernel.Pace (backoffMs, gapFactor, slowedGapMs)

-- | Why a look that is wanted is not happening yet.
data Why
  -- | The last look got no answer. It is tried again at `until`.
  = LookFailed String
  -- | Claude is not answering, which another job found out.
  | InTrouble Trouble String
  -- | A usage window of the plan is nearly spent: how far, and which.
  | PlanSpent Number String
  -- | The account is refused: a login, a bill.
  | AccountRefused String
  -- | The play-by-play's own setting is wrong, such as its model.
  | JobRefused String

data Play
  -- | Just switched on: the working tree has not been read yet.
  = Starting
  | NoGit
  -- | Another session drives this project's background jobs. This one is for the conversation.
  | Following
  | Paused
  -- | Nothing has changed since the last look.
  | Watching
  -- | It looks only when asked.
  | OnRequest
  -- | A save was seen. A look is due at `dueAt`: after the quiet time, or
  -- | later when the last look was not long ago (`isSpacing`).
  | Settling { dueAt :: Number, isSpacing :: Boolean }
  | Looking
  -- | A look is wanted and held back. `until` is when it is tried again, or
  -- | `Nothing` when something else has to happen first.
  | Waiting { until :: Maybe Number, why :: Why }

-- | How close the plan's usage limit is, from the tightest window still open.
type Pressure = { isHeld :: Boolean, percent :: Number, window :: String, resetsAt :: Maybe Number }

type Facts =
  { isPaused :: Boolean
  -- | False until the watcher has read the working tree.
  , isReady :: Boolean
  , hasRepo :: Boolean
  -- | True when another session holds this project's lease.
  , isFollowing :: Boolean
  , isAutomatic :: Boolean
  -- | Whether anything differs from what the last look saw.
  , hasPending :: Boolean
  , lastChangeAt :: Maybe Number
  , lastLookAt :: Maybe Number
  , isLooking :: Boolean
  -- | Looks in a row that got no answer, and why the last of them did not.
  , failures :: Int
  , failure :: String
  , quietMs :: Number
  , minGapMs :: Number
  , health :: Health
  , pressure :: Pressure
  -- | Why the play-by-play's own request is refused. "" when it is not.
  , jobBlock :: String
  }

-- | When the pacing alone allows the next look: the quiet time, the minimum
-- | gap, and the wait after a failed look.
paced :: Facts -> Maybe Number
paced facts = case facts.lastChangeAt of
  Just changed | facts.hasPending -> Just
    ( case facts.lastLookAt of
        Nothing -> changed + facts.quietMs
        Just looked -> max (changed + facts.quietMs)
          (looked + slowedGapMs facts.minGapMs (gapFactor facts.pressure.percent) + backoffMs facts.failures)
    )
  _ -> Nothing

playOf :: Facts -> Play
playOf facts
  | not facts.isReady = Starting
  | not facts.hasRepo = NoGit
  | facts.isPaused = Paused
  | facts.isFollowing = Following
  | facts.isLooking = Looking
  | not facts.isAutomatic = OnRequest
  | otherwise = case paced facts of
      Nothing -> Watching
      Just dueAt -> held dueAt
  where
  failed = if facts.failures > 0 then Just (LookFailed facts.failure) else Nothing
  held dueAt
    | facts.jobBlock /= "" = Waiting { until: Nothing, why: JobRefused facts.jobBlock }
    | otherwise = case facts.health of
        Health.Blocked b -> Waiting { until: Nothing, why: AccountRefused b.detail }
        _ | facts.pressure.isHeld -> Waiting { until: facts.pressure.resetsAt, why: PlanSpent facts.pressure.percent facts.pressure.window }
        Health.Waiting w -> Waiting { until: Just (max w.until dueAt), why: orTrouble w.trouble w.detail }
        -- While another job finds out whether Claude is back, there is no time to give.
        Health.Probing p -> Waiting { until: Nothing, why: orTrouble p.trouble p.detail }
        _ -> case failed of
          Just why -> Waiting { until: Just dueAt, why }
          Nothing -> Settling { dueAt, isSpacing: spaced dueAt }
  orTrouble trouble detail = case failed of
    Just why -> why
    Nothing -> InTrouble trouble detail
  spaced dueAt = case facts.lastChangeAt of
    Just changed -> dueAt > changed + facts.quietMs
    Nothing -> false

-- | When to come back and see whether a look can start. `Nothing` when
-- | there is nothing to wait for, or no time to give.
wakeAt :: Facts -> Maybe Number
wakeAt facts = case playOf facts of
  Settling s -> Just s.dueAt
  Waiting w -> w.until
  _ -> Nothing

-- | Whether a look may start by itself at `now`.
isLookDue :: Facts -> Number -> Boolean
isLookDue facts now = case playOf facts of
  Settling s -> s.dueAt <= now && mayAsk facts.health
  -- The wait after a failure is over: this look is the one that finds out whether Claude is back.
  Waiting { until: Just until, why } | retried why -> until <= now && (mayAsk facts.health || isWaiting facts.health)
  _ -> false
  where
  retried = case _ of
    LookFailed _ -> true
    InTrouble _ _ -> true
    _ -> false
  isWaiting = case _ of
    Health.Waiting _ -> true
    _ -> false

-- The same, as the plain records the shell holds.

type PressureWire = { level :: String, percent :: Number, window :: String, hasResetsAt :: Boolean, resetsAt :: Number }

type FactsWire =
  { isPaused :: Boolean
  , isReady :: Boolean
  , hasRepo :: Boolean
  , isFollowing :: Boolean
  , isAutomatic :: Boolean
  , hasPending :: Boolean
  , hasLastChangeAt :: Boolean
  , lastChangeAt :: Number
  , hasLastLookAt :: Boolean
  , lastLookAt :: Number
  , isLooking :: Boolean
  , failures :: Int
  , failure :: String
  , quietMs :: Number
  , minGapMs :: Number
  , health :: HealthWire
  , pressure :: PressureWire
  , jobBlock :: String
  }

-- | `at` is the state. `why` is "" unless `at` is `waiting`, and then one of
-- | `failed`, `trouble`, `plan`, `account`, `job`. The other fields are those
-- | of the state and the reason, and empty otherwise.
type PlayWire =
  { at :: String
  , dueAt :: Number
  , isSpacing :: Boolean
  , hasUntil :: Boolean
  , until :: Number
  , why :: String
  , detail :: String
  , trouble :: String
  , percent :: Number
  , window :: String
  }

factsFromWire :: FactsWire -> Facts
factsFromWire w =
  { isPaused: w.isPaused
  , isReady: w.isReady
  , hasRepo: w.hasRepo
  , isFollowing: w.isFollowing
  , isAutomatic: w.isAutomatic
  , hasPending: w.hasPending
  , lastChangeAt: if w.hasLastChangeAt then Just w.lastChangeAt else Nothing
  , lastLookAt: if w.hasLastLookAt then Just w.lastLookAt else Nothing
  , isLooking: w.isLooking
  , failures: w.failures
  , failure: w.failure
  , quietMs: w.quietMs
  , minGapMs: w.minGapMs
  , health: healthFromWire w.health
  , pressure:
      { isHeld: w.pressure.level == "held"
      , percent: w.pressure.percent
      , window: w.pressure.window
      , resetsAt: if w.pressure.hasResetsAt then Just w.pressure.resetsAt else Nothing
      }
  , jobBlock: w.jobBlock
  }

plain :: String -> PlayWire
plain at = { at, dueAt: 0.0, isSpacing: false, hasUntil: false, until: 0.0, why: "", detail: "", trouble: "", percent: 0.0, window: "" }

playToWire :: Play -> PlayWire
playToWire = case _ of
  Starting -> plain "starting"
  NoGit -> plain "no-git"
  Following -> plain "following"
  Paused -> plain "paused"
  Watching -> plain "watching"
  OnRequest -> plain "on-request"
  Looking -> plain "looking"
  Settling s -> (plain "settling") { dueAt = s.dueAt, isSpacing = s.isSpacing }
  Waiting w -> withUntil w.until (withWhy w.why (plain "waiting"))
  where
  withUntil until wire = case until of
    Just at -> wire { hasUntil = true, until = at }
    Nothing -> wire
  withWhy why wire = case why of
    LookFailed detail -> wire { why = "failed", detail = detail }
    InTrouble trouble detail -> wire { why = "trouble", trouble = troubleTag trouble, detail = detail }
    PlanSpent percent window -> wire { why = "plan", percent = percent, window = window }
    AccountRefused detail -> wire { why = "account", detail = detail }
    JobRefused detail -> wire { why = "job", detail = detail }

playOfWire :: FactsWire -> PlayWire
playOfWire = playToWire <<< playOf <<< factsFromWire

-- | `has` is false when there is nothing to wait for, or no time to give.
wakeAtWire :: FactsWire -> { has :: Boolean, at :: Number }
wakeAtWire facts = case wakeAt (factsFromWire facts) of
  Just at -> { has: true, at }
  Nothing -> { has: false, at: 0.0 }

isLookDueWire :: FactsWire -> Number -> Boolean
isLookDueWire = isLookDue <<< factsFromWire

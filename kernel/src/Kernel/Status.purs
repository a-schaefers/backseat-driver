-- | The pane's status line: what the play-by-play is doing, said so that it
-- | is true the moment it is read. A wait says what it is waiting for and
-- | until when, as a time of day, so that the line does not have to be
-- | redrawn every second to stay right.
-- |
-- | Under it, a dim row says what keeps going wrong in the background, and
-- | nothing else: it never repeats what the line above already says.
-- |
-- | Every sentence that names a time is given `clock`, which says a time of
-- | day in the person's time zone. The kernel cannot read the time zone.
module Kernel.Status
  ( playLine
  , healthLine
  , watchState
  , slowScanMs
  , HealthFacts
  , playLineWire
  , healthLineWire
  , watchStateWire
  ) where

import Prelude

import Data.Array (null)
import Data.Maybe (Maybe(..))
import Data.Number.Format (fixed, toStringWith)
import Data.String (joinWith)
import Kernel.Health (Health, HealthWire, Trouble(..), healthFromWire)
import Kernel.Health as Health
import Kernel.Pace (Pressure, PressureWire, pressureFromWire)
import Kernel.Play (Play(..), PlayWire, Why(..), playFromWire)

-- | What is wrong, as a sentence's start, for the troubles that clear by themselves.
troubleText :: Trouble -> String
troubleText = case _ of
  RateLimit -> "Claude is rate limited"
  Overloaded -> "Claude is overloaded"
  Server -> "Claude had a server error"
  Offline -> "There is no connection to Claude"
  Timeout -> "Claude did not answer in time"
  _ -> "Claude is not answering"

-- | What the status line says while the tutor is on or paused.
playLine :: (Number -> String) -> Play -> String
playLine clock = case _ of
  Paused -> "Paused. /bsd resume to continue."
  Starting -> "On. Getting ready."
  NoGit -> "On. This folder is not a git repository, so there is no play-by-play."
  Following -> "On. Another session is driving this project. This one is for the conversation."
  Watching -> "On. Watching for your next save."
  OnRequest -> "On. Looking only when you ask."
  Settling s
    | s.isSpacing -> "On. Saw your save. Next look after " <> clock s.dueAt <> "."
    | otherwise -> "On. Saw your save. Looking when you pause."
  Looking -> "On. Looking at your changes."
  Waiting { until, why } -> case why of
    LookFailed detail -> "On. The last look failed (" <> detail <> ")." <> (if next == "" then " It will try again." else next)
    InTrouble trouble _ -> "On. " <> troubleText trouble <> "." <> next
    PlanSpent _ _ -> case until of
      Nothing -> "On. Holding back, because you are close to your plan limit. It still looks when you ask."
      Just at -> "On. Holding back until " <> clock at <> ", because you are close to your plan limit. It still looks when you ask."
    AccountRefused detail -> "On. Claude is refusing this account (" <> detail <> "). Nothing runs in the background until that is sorted out."
    JobRefused detail -> "On. The play-by-play cannot run (" <> detail <> "). Its model is set in /config."
    where
    next = case until of
      Nothing -> ""
      Just at -> " Next try " <> clock at <> "."

type HealthFacts =
  { play :: Play
  , health :: Health
  , pressure :: Pressure
  -- | How long the last scan of the working tree took.
  , lastScanMs :: Number
  -- | What has failed more than once lately, in a few words each.
  , failing :: Array String
  }

-- | A scan of the working tree that took this long is worth a word.
slowScanMs :: Number
slowScanMs = 1500.0

-- | What keeps going wrong in the background, for the dim row under the
-- | status line. "" when nothing does. It leaves out what the status line
-- | itself says, which is why a held-back look silences the first part.
healthLine :: (Number -> String) -> HealthFacts -> String
healthLine clock facts = case facts.play of
  Paused -> ""
  Following -> ""
  Starting -> ""
  NoGit -> ""
  _ -> joinWith " " (service <> slowGit <> keepsFailing)
  where
  service = case facts.play of
    Waiting _ -> []
    _ -> case facts.health of
      Health.Blocked b -> [ "Claude is refusing this account (" <> b.detail <> "). Nothing runs in the background until that is sorted out." ]
      Health.Waiting w -> [ troubleText w.trouble <> ". Background work waits until " <> clock w.until <> "." ]
      _
        | facts.pressure.isHeld ->
            [ "You are close to your plan limit. Nothing runs in the background" <> until facts.pressure.resetsAt <> " unless you ask." ]
        | otherwise -> []
  until = case _ of
    Just at -> " until " <> clock at
    Nothing -> ""
  slowGit
    | facts.lastScanMs >= slowScanMs = [ "git is slow here: the last look at the working tree took " <> toStringWith (fixed 1) (facts.lastScanMs / 1000.0) <> " s." ]
    | otherwise = []
  keepsFailing
    | null facts.failing = []
    | otherwise = [ "Keeps failing: " <> joinWith ", " facts.failing <> ". /bsd debug dump saves the details." ]

-- | The state the animated character takes its pose from.
watchState :: Play -> String
watchState = case _ of
  Starting -> "starting"
  NoGit -> "no-git"
  Looking -> "looking"
  Settling _ -> "settling"
  Waiting _ -> "waiting"
  _ -> "idle"

-- The same, as the plain records the shell holds.

playLineWire :: (Number -> String) -> PlayWire -> String
playLineWire clock = playLine clock <<< playFromWire

healthLineWire
  :: (Number -> String)
  -> { play :: PlayWire, health :: HealthWire, pressure :: PressureWire, lastScanMs :: Number, failing :: Array String }
  -> String
healthLineWire clock w = healthLine clock
  { play: playFromWire w.play
  , health: healthFromWire w.health
  , pressure: pressureFromWire w.pressure
  , lastScanMs: w.lastScanMs
  , failing: w.failing
  }

watchStateWire :: PlayWire -> String
watchStateWire = watchState <<< playFromWire

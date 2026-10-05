-- | Deadlines: what the tutor has to do at a time it already knows.
-- |
-- | A look is due ten seconds after the last save. The next scan of the
-- | working tree is due in two. A failed request is tried again at a quarter
-- | past. Each is a named deadline, and one timer is kept armed for whichever
-- | comes first. Nothing ticks in between, and nothing is compared against
-- | the clock over and over to find out whether its time has come.
-- |
-- | The scheduler (plugin/hooks/scheduler.ts) holds the deadlines' work and
-- | the timer. When to arm the timer, for how long, and which deadlines are
-- | due and in what order are decided here.
-- |
-- | Rules:
-- |   * The timer is armed for the earliest deadline, and is left alone when
-- |     it already is: setting a later deadline costs no timer.
-- |   * With no deadline, no timer is armed.
-- |   * Deadlines that are due run in the order of their times, and those
-- |     due at the same time in the order the scheduler lists them.
module Kernel.Schedule
  ( Deadline
  , Arm(..)
  , earliest
  , arming
  , delayMs
  , dueNow
  , armingWire
  , delayMsWire
  , dueNowWire
  ) where

import Prelude

import Data.Array (filter, foldl, sortWith)
import Data.Maybe (Maybe(..))

-- | A deadline by its name and when it is due, in clock milliseconds.
type Deadline = { name :: String, at :: Number }

-- | What to do with the timer.
data Arm
  -- | It is armed for the right time already, or rightly not armed.
  = Keep
  -- | Cancel it, and arm none.
  | Disarm
  -- | Cancel it, and arm it for this time.
  | ArmFor Number

derive instance eqArm :: Eq Arm

-- | When the first deadline is due, or `Nothing` with none.
earliest :: Array Deadline -> Maybe Number
earliest = foldl first Nothing
  where
  first Nothing deadline = Just deadline.at
  first (Just at) deadline = Just (min at deadline.at)

-- | What to do with a timer that is armed for `armedFor` (or none), given
-- | the deadlines as they are now.
arming :: Maybe Number -> Array Deadline -> Arm
arming armedFor deadlines = case earliest deadlines of
  first | first == armedFor -> Keep
  Nothing -> Disarm
  Just at -> ArmFor at

-- | How long from `now` until `at`. A time already past is now.
delayMs :: Number -> Number -> Number
delayMs at now = max 0.0 (at - now)

-- | The names of the deadlines due at `now`: the earliest first, and in the
-- | order the scheduler lists them among those due at the same time.
dueNow :: Number -> Array Deadline -> Array String
dueNow now = map _.name <<< sortWith _.at <<< filter (\deadline -> deadline.at <= now)

-- The same, as the plain records the shell holds.

-- | `armedFor` means something only with `isArmed`. `next` is `keep`,
-- | `disarm` or `arm`, and `at` is the time to arm it for.
armingWire :: Boolean -> Number -> Array Deadline -> { next :: String, at :: Number }
armingWire isArmed armedFor deadlines = case arming (if isArmed then Just armedFor else Nothing) deadlines of
  Keep -> { next: "keep", at: 0.0 }
  Disarm -> { next: "disarm", at: 0.0 }
  ArmFor at -> { next: "arm", at }

delayMsWire :: Number -> Number -> Number
delayMsWire = delayMs

dueNowWire :: Array Deadline -> Number -> Array String
dueNowWire deadlines now = dueNow now deadlines

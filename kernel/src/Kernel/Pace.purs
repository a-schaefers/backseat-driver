-- | The pacing arithmetic: how failed looks hold the next one back, and how
-- | the background work holds back as a plan's usage limit gets close.
module Kernel.Pace
  ( backoffMs
  , slowedGapMs
  , gapFactor
  , isHeldAt
  , slowFromPercent
  , holdFromPercent
  , Pressure
  , PressureWire
  , pressureFromWire
  ) where

import Prelude

import Data.Int (toNumber)
import Data.Maybe (Maybe(..))
import Data.Number (pow)

-- | How close the plan's usage limit is, from the tightest window still open.
-- | `resetsAt` is when that window reopens, when Claude Code says.
type Pressure = { isHeld :: Boolean, percent :: Number, window :: String, resetsAt :: Maybe Number }

-- | The same, as the shell holds it. `level` is `none`, `slowed` or `held`.
type PressureWire = { level :: String, percent :: Number, window :: String, hasResetsAt :: Boolean, resetsAt :: Number }

pressureFromWire :: PressureWire -> Pressure
pressureFromWire w =
  { isHeld: w.level == "held"
  , percent: w.percent
  , window: w.window
  , resetsAt: if w.hasResetsAt then Just w.resetsAt else Nothing
  }

-- | From this much of a usage window, looks are spaced further apart.
slowFromPercent :: Number
slowFromPercent = 80.0

-- | From this much, nothing runs unless the person asks for it.
holdFromPercent :: Number
holdFromPercent = 95.0

-- | Whether a usage window this far spent holds everything back.
isHeldAt :: Number -> Boolean
isHeldAt percent = percent >= holdFromPercent

-- | What the minimum gap between looks is multiplied by with a usage window
-- | this far spent. Held back altogether, the gap is not the question, so it
-- | stays as it is.
gapFactor :: Number -> Number
gapFactor percent
  | isHeldAt percent = 1.0
  | percent >= slowFromPercent = 4.0
  | otherwise = 1.0

-- | The minimum gap while slowed down: the setting stretched, and never
-- | under four minutes.
slowedGapMs :: Number -> Number -> Number
slowedGapMs minGapMs factor
  | factor == 1.0 = minGapMs
  | otherwise = max minGapMs 60000.0 * factor

-- | How long failed looks hold the next one back: 30 seconds, doubling, up
-- | to 10 minutes.
backoffMs :: Int -> Number
backoffMs failures
  | failures <= 0 = 0.0
  | otherwise = min 600000.0 (30000.0 * pow 2.0 (toNumber (failures - 1)))

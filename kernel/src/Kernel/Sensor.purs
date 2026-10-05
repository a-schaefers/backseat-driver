-- | How often the working tree is looked at.
-- |
-- | Claude Code tells the mod about everything that happens inside it. It
-- | does not say when the person saves a file in their editor, commits in
-- | their own terminal or moves their caret, and nothing else on the machine
-- | does either without an extra install. So those are found by looking: one
-- | scan of the working tree at a time, the next one scheduled when the last
-- | has finished. This is the only place the mod polls.
-- |
-- | The scan is as frequent as it needs to be and no more: every second for
-- | a minute after something happened (a save, a prompt, a key in the pane),
-- | every two seconds otherwise, every five once nothing has happened for ten
-- | minutes. Anything Claude Code does tell the mod about makes it scan at
-- | once.
-- |
-- | One thing is looked at more often, and only while someone is watching
-- | it: the file the Explain view is about, and the file an editor writes its
-- | caret to. Two stats, ten times a second (`focusGapMs`), because an
-- | explanation of code that was just edited must not stay on screen.
module Kernel.Sensor
  ( ScanFacts
  , scanGapMs
  , focusGapMs
  , hotScanMs
  , scanMs
  , idleScanMs
  , hotForMs
  , idleAfterMs
  , longestScanGapMs
  , focusScanMs
  , longestFocusGapMs
  , ScanFactsWire
  , scanGapMsWire
  ) where

import Prelude

import Data.Maybe (Maybe(..))
import Data.Number (floor)

-- | Between scans while something has just happened.
hotScanMs :: Number
hotScanMs = 1000.0

-- | Between scans otherwise.
scanMs :: Number
scanMs = 2000.0

-- | Between scans once nothing has happened for a while.
idleScanMs :: Number
idleScanMs = 5000.0

-- | How long after something happened the scans stay close together.
hotForMs :: Number
hotForMs = 60000.0

-- | How long nothing has to happen before they grow far apart.
idleAfterMs :: Number
idleAfterMs = 600000.0

-- | Each quarter second a scan takes adds this much to the wait for the
-- | next, so that a slow `git status` is not run back to back.
slowScanStepMs :: Number
slowScanStepMs = 250.0

slowScanWaitMs :: Number
slowScanWaitMs = 2000.0

-- | However slow git is, the working tree is looked at this often.
longestScanGapMs :: Number
longestScanGapMs = 32000.0

type ScanFacts =
  { now :: Number
  -- | When something last happened: a save, a commit, a caret move, a prompt, a key. `Nothing` when nothing has yet.
  , activeAt :: Maybe Number
  -- | How long the scan that just finished took.
  , lastScanMs :: Number
  }

-- | How long to wait before the next scan.
scanGapMs :: ScanFacts -> Number
scanGapMs facts = min longestScanGapMs (base + slowness)
  where
  base = case facts.activeAt of
    Nothing -> idleScanMs
    Just at
      | facts.now - at < hotForMs -> hotScanMs
      | facts.now - at >= idleAfterMs -> idleScanMs
      | otherwise -> scanMs
  slowness = floor (facts.lastScanMs / slowScanStepMs) * slowScanWaitMs

-- | Between checks of the spot in focus while someone is watching it. A stat
-- | takes about a millisecond. This is the longest the pane can show an
-- | explanation of code that was just edited, and the longest an editor
-- | waits for its caret to be noticed.
focusScanMs :: Number
focusScanMs = 100.0

-- | However slow the disk is, the spot in focus is checked this often.
longestFocusGapMs :: Number
longestFocusGapMs = 2000.0

-- | How long to wait before the next check of the spot in focus. A check
-- | that was slow is not run back to back.
focusGapMs :: Number -> Number
focusGapMs tookMs = min longestFocusGapMs (max focusScanMs (tookMs * 4.0))

type ScanFactsWire = { now :: Number, hasActiveAt :: Boolean, activeAt :: Number, lastScanMs :: Number }

scanGapMsWire :: ScanFactsWire -> Number
scanGapMsWire w = scanGapMs { now: w.now, activeAt: if w.hasActiveAt then Just w.activeAt else Nothing, lastScanMs: w.lastScanMs }

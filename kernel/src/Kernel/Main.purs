-- | Everything of the kernel that the mod's TypeScript calls, under the names
-- | plugin/hooks/core.ts imports. This module is the bundle's entry: what is
-- | not exported here does not reach plugin/hooks/kernel.js.
-- |
-- | Only plain data crosses: records, numbers, strings and booleans in, the
-- | same out. The types that carry the rules stay inside.
module Kernel.Main
  ( module Kernel.Health
  , module Kernel.License
  , module Kernel.Pace
  , module Kernel.Play
  , module Kernel.Queue
  , module Kernel.Store
  , module Kernel.Status
  , module Kernel.Schedule
  , module Kernel.Sensor
  , leaseIsHeld
  , leaseClaimed
  , leaseReleased
  , leaseNextCheck
  , leaseBeatMs
  , leaseTtlMs
  , leaseSlackMs
  ) where

import Kernel.Health (mayAskWire, outcomeOfErrorWire, outcomeOfWire, retryDelayMsWire, stepWire, troubleOfWire)
import Kernel.Lease (Lease)
import Kernel.Lease as Lease
import Kernel.License (licenseNextCheckWire, licenseStandingWire)
import Kernel.Pace (backoffMs, gapFactor, isHeldAt, slowedGapMs)
import Kernel.Play (isLookDueWire, playOfWire, wakeAtWire)
import Kernel.Queue (currentQueueWire, failedTextWire, heldTextWire, isSpentWire, maxAttempts, maxWaitMs, maxWaiting, nextToAssessWire, nextToReviewWire, planHeld, retryBaseMs, retryMs, reviewedWire, settledInWire, verdictMs, watchdogLimitMs, watchdogMs, withAttemptWire, withCommitWire, withoutCommitWire)
import Kernel.Store (afterReadWire, afterWriteWire, keepsBackupWire, readRetryMs, readTries, stepOfWire, writeTries)
import Kernel.Status (healthLineWire, playLineWire, slowScanMs, watchStateWire)
import Kernel.Schedule (armingWire, delayMsWire, dueNowWire)
import Kernel.Sensor (focusGapMs, focusScanMs, hotForMs, hotScanMs, idleAfterMs, idleScanMs, longestFocusGapMs, longestScanGapMs, scanGapMsWire, scanMs)

leaseIsHeld :: Lease -> Number -> Boolean
leaseIsHeld = Lease.isHeld

leaseClaimed :: Lease -> String -> Number -> String -> Lease
leaseClaimed = Lease.claimed

leaseReleased :: Lease -> String -> Lease
leaseReleased = Lease.released

leaseNextCheck :: Lease -> String -> Number -> Number -> Number
leaseNextCheck = Lease.nextCheck

leaseBeatMs :: Number
leaseBeatMs = Lease.beatMs

leaseTtlMs :: Number
leaseTtlMs = Lease.ttlMs

leaseSlackMs :: Number
leaseSlackMs = Lease.slackMs

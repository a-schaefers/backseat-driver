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
  , sessionsCarriedFrom
  , sessionsSaid
  , sessionsLeft
  , sessionsWithdrawn
  , sessionsIsSayDue
  , sessionsBound
  , sessionsSayEveryMs
  , sessionsAliveMs
  , sessionsHandoffMs
  , sessionsKeepMs
  , sessionsRecheckMs
  , sessionsCheckEveryMs
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
import Kernel.Sessions (Asking, Carried, Drawing, Entry)
import Kernel.Sessions as Sessions
import Kernel.Sensor (focusGapMs, focusScanMs, hotForMs, hotScanMs, idleAfterMs, idleScanMs, longestFocusGapMs, longestScanGapMs, pushedFocusMs, pushedScanMs, scanGapMsWire, scanMs)

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

sessionsCarriedFrom :: Array Entry -> Asking -> Carried
sessionsCarriedFrom = Sessions.carriedFrom

sessionsSaid :: Array Entry -> Entry -> Array Entry
sessionsSaid = Sessions.said

sessionsLeft :: Array Entry -> String -> Number -> Array Entry
sessionsLeft = Sessions.left

sessionsWithdrawn :: Array Entry -> String -> Array Entry
sessionsWithdrawn = Sessions.withdrawn

sessionsIsSayDue :: Number -> Number -> Boolean
sessionsIsSayDue = Sessions.isSayDue

sessionsBound :: Drawing -> String
sessionsBound = Sessions.boundWire

sessionsSayEveryMs :: Number
sessionsSayEveryMs = Sessions.sayEveryMs

sessionsAliveMs :: Number
sessionsAliveMs = Sessions.aliveMs

sessionsHandoffMs :: Number
sessionsHandoffMs = Sessions.handoffMs

sessionsKeepMs :: Number
sessionsKeepMs = Sessions.keepMs

sessionsRecheckMs :: Number
sessionsRecheckMs = Sessions.recheckMs

sessionsCheckEveryMs :: Number
sessionsCheckEveryMs = Sessions.checkEveryMs

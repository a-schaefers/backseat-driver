-- | Everything of the kernel that the mod's TypeScript calls, under the names
-- | plugin/hooks/core.ts imports. This module is the bundle's entry: what is
-- | not exported here does not reach plugin/hooks/kernel.js.
-- |
-- | Only the `…Wire` functions cross: plain records, numbers, strings and
-- | booleans in, the same out. The types that carry the rules stay inside.
module Kernel.Main
  ( module Kernel.Health
  ) where

import Kernel.Health (mayAskWire, outcomeOfErrorWire, outcomeOfWire, retryDelayMsWire, stepWire, troubleOfWire)

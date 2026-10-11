-- | Where the person stands with the license, and when to ask the license
-- | server about their key again.
-- |
-- | Personal use is free and needs nothing. Commercial use needs a key: a
-- | signed token the person pastes in, checked offline against the public
-- | keys the plugin carries, and now and then with the server, which can say
-- | that a key was withdrawn. Nothing here ever stops the tutor working. A
-- | standing only picks the line the pane shows, and most standings show none.
-- |
-- | A server that cannot be reached is not held against anyone: the key keeps
-- | counting as good, and the pane says nothing about it. After `quietMs`
-- | without an answer the standing is `Unchecked`, which only
-- | `/backseat license` mentions. A withdrawn key is asked about again daily,
-- | so a withdrawal that is undone stops showing within a day.
-- |
-- | Seats are on the honor system. When the server says a license has
-- | outgrown its seats (its installs have clearly outnumbered them for two
-- | weeks), the standing is `Outgrown`, whose line asks for more seats. Only
-- | while that answer is fresh, and asked about again daily, so the note goes
-- | soon after seats are added and never rests on an old answer.
module Kernel.License
  ( Use(..)
  , KeyState(..)
  , Answer(..)
  , Standing(..)
  , Facts
  , standingOf
  , nextCheckAt
  , everyMs
  , retryMs
  , quietMs
  , LicenseFactsWire
  , licenseStandingWire
  , licenseNextCheckWire
  ) where

import Prelude

-- | What the person said they use it for. `Unchosen` until they say.
data Use = Unchosen | Personal | Commercial

-- | What the pasted key is, as far as the plugin can tell by itself.
-- | `Unverified` is well formed, with no public key to check it against.
data KeyState = NoKey | Malformed | Forged | Unverified | Valid

derive instance eqKeyState :: Eq KeyState

-- | What the server last said about the key. `Unknown` is a server that does
-- | not know it, which happens when its records are behind: it is not taken
-- | as a forgery.
data Answer = NoAnswer | Active | Revoked | Unknown

derive instance eqAnswer :: Eq Answer

data Standing
  = Unchosen'
  | Personal'
  -- | Commercial, with a key that is good as far as anyone can tell.
  | Licensed
  -- | Commercial, and no key yet.
  | NeedsKey
  -- | Commercial, and the key is not one: it does not parse, or its signature fails.
  | BadKey
  | Expired
  | Withdrawn
  -- | Licensed, and the server says the license's installs have clearly outnumbered its seats.
  | Outgrown
  -- | Commercial, with a key that is fine, and no answer from the server for `quietMs`.
  -- | Said only by `/backseat license`: the pane shows nothing for it.
  | Unchecked

type Facts =
  { use :: Use
  , key :: KeyState
  -- | When the key's term ends, or 0 for a key with no end.
  , expiresAt :: Number
  -- | When this key was pasted in.
  , keySince :: Number
  -- | Whether there is a server to ask and leave to ask it.
  , hasServer :: Boolean
  , answer :: Answer
  -- | Whether the server's last answer said the license has outgrown its seats.
  , isOutgrown :: Boolean
  -- | When the server last answered, or 0.
  , answeredAt :: Number
  -- | When it was last asked, answered or not, or 0.
  , triedAt :: Number
  , now :: Number
  }

-- | How long a server's answer is good for, unless it said withdrawn or
-- | outgrown; also how long an answer of outgrown is shown for.
everyMs :: Number
everyMs = 7.0 * dayMs

-- | How long after a try that got no answer, or an answer of withdrawn or outgrown, to try again.
retryMs :: Number
retryMs = dayMs

-- | How long without an answer before the standing is `Unchecked`.
quietMs :: Number
quietMs = 30.0 * dayMs

dayMs :: Number
dayMs = 86400000.0

standingOf :: Facts -> Standing
standingOf facts = case facts.use of
  Unchosen -> Unchosen'
  Personal -> Personal'
  Commercial
    | facts.key == NoKey -> NeedsKey
    | facts.key == Malformed || facts.key == Forged -> BadKey
    | facts.expiresAt > 0.0 && facts.now >= facts.expiresAt -> Expired
    | facts.answer == Revoked -> Withdrawn
    | facts.hasServer && facts.now - max facts.answeredAt facts.keySince >= quietMs -> Unchecked
    | isOutgrownNow facts -> Outgrown
    | otherwise -> Licensed

-- | The server's answer of outgrown, while it is fresh: an active license, and
-- | a server that is still asked.
isOutgrownNow :: Facts -> Boolean
isOutgrownNow facts =
  facts.isOutgrown && facts.answer == Active && facts.hasServer && facts.now - facts.answeredAt < everyMs

-- | When to ask the server about the key, or 0 for not at all: personal use,
-- | no key, a key that is not one, or no server. Withdrawn is asked about
-- | again daily rather than weekly: a mistake undone, a refund reversed. So is
-- | outgrown: seats added.
nextCheckAt :: Facts -> Number
nextCheckAt facts = case facts.use of
  Commercial
    | facts.hasServer && facts.key /= NoKey && facts.key /= Malformed && facts.key /= Forged ->
        if facts.triedAt == 0.0 then facts.now
        else if facts.answeredAt < facts.triedAt then facts.triedAt + retryMs
        else if facts.answer == Revoked || facts.isOutgrown then facts.answeredAt + retryMs
        else facts.answeredAt + everyMs
  _ -> 0.0

-- The wire: plain strings for the tags. A tag the kernel does not know is
-- read as the value that asks nothing of the person.

type LicenseFactsWire =
  { use :: String
  , key :: String
  , expiresAt :: Number
  , keySince :: Number
  , hasServer :: Boolean
  , answer :: String
  , isOutgrown :: Boolean
  , answeredAt :: Number
  , triedAt :: Number
  , now :: Number
  }

fromWire :: LicenseFactsWire -> Facts
fromWire w =
  { use: useOf w.use
  , key: keyOf w.key
  , expiresAt: w.expiresAt
  , keySince: w.keySince
  , hasServer: w.hasServer
  , answer: answerOf w.answer
  , isOutgrown: w.isOutgrown
  , answeredAt: w.answeredAt
  , triedAt: w.triedAt
  , now: w.now
  }
  where
  useOf = case _ of
    "personal" -> Personal
    "commercial" -> Commercial
    _ -> Unchosen
  keyOf = case _ of
    "malformed" -> Malformed
    "forged" -> Forged
    "unverified" -> Unverified
    "valid" -> Valid
    _ -> NoKey
  answerOf = case _ of
    "active" -> Active
    "revoked" -> Revoked
    "unknown" -> Unknown
    _ -> NoAnswer

standingText :: Standing -> String
standingText = case _ of
  Unchosen' -> "unchosen"
  Personal' -> "personal"
  Licensed -> "licensed"
  NeedsKey -> "needs-key"
  BadKey -> "bad-key"
  Expired -> "expired"
  Withdrawn -> "withdrawn"
  Outgrown -> "outgrown"
  Unchecked -> "unchecked"

licenseStandingWire :: LicenseFactsWire -> String
licenseStandingWire = standingText <<< standingOf <<< fromWire

licenseNextCheckWire :: LicenseFactsWire -> Number
licenseNextCheckWire = nextCheckAt <<< fromWire

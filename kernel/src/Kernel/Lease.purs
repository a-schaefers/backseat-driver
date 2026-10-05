-- | Which session drives a project.
-- |
-- | The tutor can be on in two sessions in one project: two terminals, or a
-- | terminal and the desktop app. If both looked at every save and reviewed
-- | every commit, each note would come twice and each review would be paid
-- | for twice. So one of them drives: it holds the project's lease, a small
-- | file in the project's folder that names the session and when it last said
-- | so, and it says so again every `beatMs`. A session that finds the lease
-- | held by another is for the conversation only. It takes over when the
-- | lease is given back, or has not been renewed for `ttlMs`, which is what a
-- | session that was killed leaves behind.
-- |
-- | The file is changed through the store, under its lock, so of two sessions
-- | that try for a free lease in the same instant exactly one gets it.
module Kernel.Lease
  ( Lease
  , noLease
  , isHeld
  , claimed
  , released
  , nextCheck
  , beatMs
  , ttlMs
  , slackMs
  ) where

import Prelude

import Data.Number (round)

-- | `session` is the session that drives, by Claude Code's id for it, and ""
-- | when nobody does. `at` is when that session last said so.
type Lease = { session :: String, at :: Number }

-- | How often the driving session renews the lease.
beatMs :: Number
beatMs = 20000.0

-- | A lease not renewed for this long is free: its session is gone.
ttlMs :: Number
ttlMs = 60000.0

-- | A waiting session looks again up to this long after the lease runs out,
-- | so that several waiting ones do not all ask in the same instant.
slackMs :: Number
slackMs = 2000.0

-- | A waiting session never looks again sooner than this.
soonestCheckMs :: Number
soonestCheckMs = 1000.0

noLease :: Lease
noLease = { session: "", at: 0.0 }

-- | Whether some session holds the lease at `now`.
isHeld :: Lease -> Number -> Boolean
isHeld lease now = lease.session /= "" && now - lease.at < ttlMs

-- | The lease after `me` has tried for it at `now`. It becomes mine, or stays
-- | mine and is renewed, when it is free, has run out, or is mine already.
-- | `also` is an id this same session held it under before, or "": `/clear`
-- | gives a session a new one. Held by another, it comes back as it was.
claimed :: Lease -> String -> Number -> String -> Lease
claimed lease me now also
  | lease.session == me || (also /= "" && lease.session == also) || not (isHeld lease now) = { session: me, at: now }
  | otherwise = lease

-- | The lease after `me` has given it back. Another session's is left alone.
released :: Lease -> String -> Lease
released lease me
  | lease.session == me = noLease
  | otherwise = lease

-- | When to look at the lease again. Holding it: in time to renew it.
-- | Waiting for it: a beat from now, which is how soon a lease that was
-- | given back is noticed, or the moment it runs out when that is sooner.
-- | `random` is a number from 0 up to 1.
nextCheck :: Lease -> String -> Number -> Number -> Number
nextCheck lease me now random
  | lease.session == me = now + beatMs
  | otherwise = max (now + soonestCheckMs) (min (now + beatMs) (lease.at + ttlMs + round (random * slackMs)))

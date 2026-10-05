-- | The sessions the tutor is on in, and which of them a new process carries
-- | on from.
-- |
-- | The tutor is switched on in a conversation. Claude Code can move that
-- | conversation into another process without anyone asking for a new one: a
-- | left arrow on an empty prompt sends it to the background, where it goes
-- | on as a fork, under another id, in a process where this mod has only
-- | just loaded and is off. To the person it is the session they were in. So
-- | each session that has the tutor on says so in one file, `sessions.json`,
-- | with the moment its conversation first began, which a conversation shares
-- | with every fork and resume of it. A process that starts by forking or
-- | resuming looks there, once, and carries the tutor on when the conversation
-- | it continues had it on a moment ago.
-- |
-- | "A moment ago" is what keeps every new session starting off. An entry
-- | counts while its session still says so now and then (`aliveMs`), or for
-- | `handoffMs` after it said goodbye, which is how long a conversation takes
-- | to come up again in the background. A conversation picked up again an
-- | hour after its session was closed starts off, as it always did.
module Kernel.Sessions
  ( Entry
  , Asking
  , Carried
  , Drawing
  , Bound(..)
  , carriedFrom
  , said
  , left
  , withdrawn
  , isSayDue
  , boundOf
  , boundWire
  , sayEveryMs
  , aliveMs
  , handoffMs
  , keepMs
  , recheckMs
  , checkEveryMs
  ) where

import Prelude

import Data.Array as Array
import Data.Maybe (Maybe(..))

-- | One session that has the tutor on. `session` is Claude Code's id for it.
-- | `born` is when its conversation first began: a fork and a resume keep it,
-- | `/clear` starts it over. `cwd` is the directory it runs in. `mode` is
-- | "on" or "paused". `at` is when the session last said so, and `leftAt`
-- | when it said goodbye, or 0 while it has not.
type Entry =
  { session :: String
  , born :: Number
  , cwd :: String
  , mode :: String
  , at :: Number
  , leftAt :: Number
  }

-- | A process that has just started by forking or resuming a conversation.
type Asking = { born :: Number, cwd :: String, now :: Number }

-- | What it carries on from: whose entry, and the mode to come up in.
-- | `isFound` false means it starts off, as any new session does.
type Carried = { isFound :: Boolean, session :: String, mode :: String }

-- | How often a session says again that it has the tutor on.
sayEveryMs :: Number
sayEveryMs = 300000.0

-- | An entry whose session has not said so for this long is not carried on
-- | from: the session is gone without a goodbye. Two says and a minute.
aliveMs :: Number
aliveMs = 660000.0

-- | How long after a goodbye an entry is still carried on from.
handoffMs :: Number
handoffMs = 60000.0

-- | An entry nobody has stood behind for this long is dropped from the file.
keepMs :: Number
keepMs = 86400000.0

-- | How long after a session found nowhere to draw it looks again.
recheckMs :: Number
recheckMs = 2000.0

-- | How often a session with the tutor on looks at itself: whether it still
-- | draws anywhere, and whether it is time to say again that it is on.
checkEveryMs :: Number
checkEveryMs = 10000.0

hasTutorOn :: Entry -> Boolean
hasTutorOn entry = entry.mode == "on" || entry.mode == "paused"

-- | Whether an entry is from a moment ago: its session still says so, or
-- | said goodbye within `handoffMs`.
isCurrent :: Entry -> Number -> Boolean
isCurrent entry now
  | entry.leftAt > 0.0 = now - entry.leftAt <= handoffMs
  | otherwise = now - entry.at <= aliveMs

-- | The entry a starting process carries on from: the same conversation in
-- | the same directory, with the tutor on a moment ago. Of several, the one
-- | that said so last.
carriedFrom :: Array Entry -> Asking -> Carried
carriedFrom entries asking =
  case Array.last (Array.sortWith _.at (Array.filter counts entries)) of
    Just entry -> { isFound: true, session: entry.session, mode: entry.mode }
    Nothing -> { isFound: false, session: "", mode: "off" }
  where
  counts entry =
    entry.born == asking.born
      && entry.cwd == asking.cwd
      && hasTutorOn entry
      && isCurrent entry asking.now

-- | The entries nobody has stood behind for `keepMs` are dropped.
kept :: Array Entry -> Number -> Array Entry
kept entries now = Array.filter (\entry -> now - max entry.at entry.leftAt <= keepMs) entries

-- | The entries after `entry`'s session has said it has the tutor on. What
-- | that session said before is replaced.
said :: Array Entry -> Entry -> Array Entry
said entries entry =
  Array.snoc (Array.filter (\other -> other.session /= entry.session) (kept entries entry.at)) entry

-- | The entries after `session` said goodbye at `now`: its process ends, or
-- | has nowhere left to draw. One that already left keeps its first goodbye.
-- | A goodbye is a session standing behind its entry, however long ago it
-- | last said so: a laptop that slept a day and is closed on waking still
-- | hands its conversation on.
left :: Array Entry -> String -> Number -> Array Entry
left entries session now = kept (map mark entries) now
  where
  mark entry
    | entry.session == session && entry.leftAt == 0.0 = entry { leftAt = now }
    | otherwise = entry

-- | The entries after the tutor was switched off in `session`.
withdrawn :: Array Entry -> String -> Array Entry
withdrawn entries session = Array.filter (\entry -> entry.session /= session) entries

-- | Whether a session that last said so at `saidAt` says so again at `now`.
isSayDue :: Number -> Number -> Boolean
isSayDue saidAt now = now - saidAt >= sayEveryMs

-- | Whether a session still has somewhere to draw.
-- |
-- | A terminal session whose conversation Claude Code moved to the
-- | background keeps this mod running, timers and all, in a process that
-- | draws nothing and never will again, and no event says so. Whatever it
-- | went on doing there, nobody could see: it would look at every save and
-- | hold the project's lease against the session the person is looking at.
-- |
-- | `Drawn`: carry on. `Unsure`: it drew nowhere just now, so look again in
-- | `recheckMs` before believing it. `Gone`: nowhere twice running.
data Bound = Drawn | Unsure | Gone

-- | `surfaces` is how many surfaces the session draws on now. `wasUnsure`
-- | is whether the look before this one found none. `isTerminal` is whether
-- | the session began in a terminal: one a host runs headless has no surface
-- | whenever no window is on it, and comes back.
type Drawing = { surfaces :: Int, wasUnsure :: Boolean, isTerminal :: Boolean }

boundOf :: Drawing -> Bound
boundOf drawing
  | not drawing.isTerminal = Drawn
  | drawing.surfaces > 0 = Drawn
  | drawing.wasUnsure = Gone
  | otherwise = Unsure

boundWire :: Drawing -> String
boundWire drawing = case boundOf drawing of
  Drawn -> "drawn"
  Unsure -> "unsure"
  Gone -> "gone"

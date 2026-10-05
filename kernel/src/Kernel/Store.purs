-- | When the store reads a file again, writes it again, or gives up.
-- |
-- | `$.fs.write` empties a file and then fills it, so another session can
-- | read it empty or half-written, and two sessions that read, change and
-- | write the same file can each undo the other's change. The store
-- | (plugin/hooks/store.ts) does the reading and writing. What it does next
-- | after each read and each write is decided here:
-- |
-- |   * A file that is empty or does not parse is read again a moment later,
-- |     `readTries` times in all. Then it is broken: kept aside, and its
-- |     backup used. It is never taken for "nothing there".
-- |   * A change that changes nothing is not written.
-- |   * Without the lock, a change first checks that nobody wrote since it
-- |     read, except on its last try, when it writes regardless.
-- |   * What was written is read back. Not there, another session wrote at
-- |     the same moment, and the change is made again on top of that, a
-- |     little later each time, `writeTries` times in all.
-- |   * The file as it was is kept as a backup only when it was sound and
-- |     there was one, and only for the files that ask for it.
module Kernel.Store
  ( Found(..)
  , AfterRead(..)
  , Step(..)
  , AfterWrite(..)
  , afterRead
  , stepOf
  , keepsBackup
  , afterWrite
  , readTries
  , readRetryMs
  , writeTries
  , afterReadWire
  , stepOfWire
  , keepsBackupWire
  , afterWriteWire
  ) where

import Prelude

import Data.Int (toNumber)

-- | How often a file that is empty or does not parse is read before it counts as broken.
readTries :: Int
readTries = 3

-- | How long to wait before reading it again: a write takes a few milliseconds.
readRetryMs :: Number
readRetryMs = 25.0

-- | How often a change is made again after another session's write got in its way.
writeTries :: Int
writeTries = 4

-- | What one read of a file found.
data Found
  = Missing
  -- | Text that parses.
  | Parsed
  -- | Empty, or text that does not parse.
  | Unreadable

-- | What to do after the nth read.
data AfterRead
  = Absent
  | Sound
  | ReadAgainIn Number
  | Broken

derive instance eqAfterRead :: Eq AfterRead

afterRead :: Int -> Found -> AfterRead
afterRead attempt = case _ of
  Missing -> Absent
  Parsed -> Sound
  Unreadable
    | attempt < readTries -> ReadAgainIn readRetryMs
    | otherwise -> Broken

-- | What the nth try at a change does once it has read the file and worked
-- | out the new text.
data Step
  -- | The file already says so: nothing is written.
  = Unchanged
  -- | Read the file once more and go on only when it is what was read.
  | CheckFirst
  | WriteNow

derive instance eqStep :: Eq Step

stepOf :: { attempt :: Int, hasLock :: Boolean, isSound :: Boolean, isSame :: Boolean } -> Step
stepOf facts
  | facts.isSound && facts.isSame = Unchanged
  | not facts.hasLock && facts.attempt < writeTries = CheckFirst
  | otherwise = WriteNow

-- | Whether to keep the file as it was before writing over it.
keepsBackup :: { wantsBackup :: Boolean, isSound :: Boolean, exists :: Boolean } -> Boolean
keepsBackup facts = facts.wantsBackup && facts.isSound && facts.exists

-- | What the nth try does after reading back what it wrote.
data AfterWrite
  = Done
  -- | Not there after the last try: it is left as it is, and said so.
  | Unconfirmed
  | TryAgainIn Number

derive instance eqAfterWrite :: Eq AfterWrite

afterWrite :: Int -> Boolean -> AfterWrite
afterWrite attempt isConfirmed
  | isConfirmed = Done
  | attempt >= writeTries = Unconfirmed
  | otherwise = TryAgainIn (readRetryMs * toNumber attempt)

-- The same, as the plain records the shell holds.

-- | `found` is `missing`, `parsed` or `unreadable`. `next` is `absent`,
-- | `sound`, `again` or `broken`; `waitMs` is how long to wait first.
afterReadWire :: Int -> String -> { next :: String, waitMs :: Number }
afterReadWire attempt found = case afterRead attempt (foundFromTag found) of
  Absent -> { next: "absent", waitMs: 0.0 }
  Sound -> { next: "sound", waitMs: 0.0 }
  ReadAgainIn ms -> { next: "again", waitMs: ms }
  Broken -> { next: "broken", waitMs: 0.0 }
  where
  foundFromTag = case _ of
    "missing" -> Missing
    "parsed" -> Parsed
    _ -> Unreadable

-- | `unchanged`, `check` or `write`.
stepOfWire :: { attempt :: Int, hasLock :: Boolean, isSound :: Boolean, isSame :: Boolean } -> String
stepOfWire facts = case stepOf facts of
  Unchanged -> "unchanged"
  CheckFirst -> "check"
  WriteNow -> "write"

keepsBackupWire :: { wantsBackup :: Boolean, isSound :: Boolean, exists :: Boolean } -> Boolean
keepsBackupWire = keepsBackup

-- | `next` is `done`, `unconfirmed` or `again`; `waitMs` is how long to wait first.
afterWriteWire :: Int -> Boolean -> { next :: String, waitMs :: Number }
afterWriteWire attempt isConfirmed = case afterWrite attempt isConfirmed of
  Done -> { next: "done", waitMs: 0.0 }
  Unconfirmed -> { next: "unconfirmed", waitMs: 0.0 }
  TryAgainIn ms -> { next: "again", waitMs: ms }

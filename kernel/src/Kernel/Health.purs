-- | Whether Claude is answering, and when to ask again if it is not.
-- |
-- | Every background job (a look, a lookup, a deep review, an assessment)
-- | says here how its request went. One that failed because the service is in
-- | trouble stops all of them from asking for a while, a little longer after
-- | each failure in a row, so that an outage costs a handful of requests and
-- | not hundreds. When the wait is over, one job goes first. If it is
-- | answered, everything carries on. Nothing that was waiting is dropped in
-- | the meantime.
-- |
-- | Rules that the types and `step` hold, so that the shell cannot break them:
-- |   * An answer, from anyone, always ends in `Ok`.
-- |   * Only `Waiting` has a time, and a failure never brings that time forward.
-- |   * `Probing` is left by every event that can follow it: answered, failed
-- |     for any reason, or abandoned. A probe cannot leave the others waiting
-- |     for good.
-- |   * A refused account (`Blocked`) is left only by an answer.
-- |
-- | Times are `Number`: milliseconds since the epoch do not fit an `Int`.
-- | The shell reaches this through plugin/hooks/core.ts, as plain records.
module Kernel.Health
  ( Trouble(..)
  , Health(..)
  , Event(..)
  , step
  , mayAsk
  , retryDelayMs
  , troubleOf
  , troubleTag
  , troubleFromTag
  , HealthWire
  , EventWire
  , ResultWire
  , OutcomeWire
  , healthToWire
  , healthFromWire
  , eventFromWire
  , stepWire
  , mayAskWire
  , retryDelayMsWire
  , troubleOfWire
  , outcomeOfWire
  , outcomeOfErrorWire
  ) where

import Prelude

import Data.Array (elem)
import Data.Int (toNumber)
import Data.Maybe (Maybe(..))
import Data.Number (pow, round)
import Data.String (Pattern(..), Replacement(..), replaceAll)

-- | Why a request got no usable answer. `RateLimit`, `Overloaded`, `Server`,
-- | `Offline` and `Timeout` clear by themselves, sooner or later. `Account`
-- | does not until the person does something (a login, a bill). `Job` is this
-- | one job's own setting, such as a model that does not exist. `Reply` is an
-- | answer with nothing in it.
data Trouble
  = RateLimit
  | Overloaded
  | Server
  | Offline
  | Timeout
  | Account
  | Job
  | Reply

derive instance eqTrouble :: Eq Trouble

data Health
  -- | Requests are being answered, as far as anyone knows.
  = Ok
  -- | The service is in trouble. No job asks by itself before `until`.
  | Waiting { trouble :: Trouble, detail :: String, until :: Number, failures :: Int }
  -- | The wait is over. The next job that wants to ask may, and is the one that finds out.
  | Recovering { trouble :: Trouble, detail :: String, failures :: Int }
  -- | That job is asking now. The others wait for what it finds.
  | Probing { trouble :: Trouble, detail :: String, failures :: Int }
  -- | The account is refused. No job asks by itself until something is answered again.
  | Blocked { detail :: String }

derive instance eqHealth :: Eq Health

data Event
  -- | A request failed. `random` is a number from 0 up to 1. `resetsAt` is
  -- | when the plan's window reopens, if that is why.
  = Failed { trouble :: Trouble, detail :: String, at :: Number, random :: Number, resetsAt :: Maybe Number }
  -- | A request was answered: a background job's, or the conversation's own.
  | Answered
  -- | The wait is over.
  | Due
  -- | A job starts asking while recovering.
  | ProbingStarted
  -- | The job that was asking ended without saying anything about Claude.
  | Abandoned

firstWaitMs :: Number
firstWaitMs = 30000.0

-- | With no connection, or no answer in time, the first retry comes sooner: a
-- | dropped connection is often back at once.
firstWaitOfflineMs :: Number
firstWaitOfflineMs = 15000.0

longestWaitMs :: Number
longestWaitMs = 600000.0

-- | After a plan window reopens, a retry waits up to this much longer, so
-- | that every session does not ask in the same second.
resetSlackMs :: Number
resetSlackMs = 30000.0

-- | How long to wait after the nth failure in a row: 30 seconds, doubling,
-- | ten minutes at most, and somewhere in the upper half of that, so that
-- | several sessions do not all come back at the same moment.
retryDelayMs :: Trouble -> Int -> Number -> Number
retryDelayMs trouble failures random =
  round (whole / 2.0 + (random * whole) / 2.0)
  where
  first = if trouble == Offline || trouble == Timeout then firstWaitOfflineMs else firstWaitMs
  whole = min longestWaitMs (first * pow 2.0 (toNumber (max 0 (failures - 1))))

step :: Health -> Event -> Health
step _ Answered = Ok
step (Waiting w) Due = Recovering { trouble: w.trouble, detail: w.detail, failures: w.failures }
step health Due = health
step (Recovering r) ProbingStarted = Probing r
step health ProbingStarted = health
-- Nothing was found out, so the next job that wants to ask does.
step (Probing p) Abandoned = Recovering p
step health Abandoned = health
step health (Failed e) = case e.trouble of
  Account -> Blocked { detail: e.detail }
  -- Not the service's doing: the job that asked deals with it.
  Job -> step health Abandoned
  Reply -> step health Abandoned
  _ -> case health of
    Blocked _ -> health
    _ -> Waiting { trouble: e.trouble, detail: e.detail, until: kept, failures }
  where
  failures = case health of
    Ok -> 1
    Waiting w -> w.failures + 1
    Recovering r -> r.failures + 1
    Probing p -> p.failures + 1
    Blocked _ -> 1
  reopens = case e.resetsAt of
    Just at | e.trouble == RateLimit && at > e.at -> Just at
    _ -> Nothing
  until = case reopens of
    Just at -> at + round (e.random * resetSlackMs)
    Nothing -> e.at + retryDelayMs e.trouble failures e.random
  -- A failure reported while already waiting never brings the retry forward.
  kept = case health of
    Waiting w -> max w.until until
    _ -> until

-- | Whether a job may ask by itself now. What the person asks for is always tried.
mayAsk :: Health -> Boolean
mayAsk Ok = true
mayAsk (Recovering _) = true
mayAsk _ = false

accountErrors :: Array String
accountErrors = [ "authentication_failed", "oauth_org_not_allowed", "account_on_hold", "verification_required", "billing_error", "cloud_credential_error" ]

jobErrors :: Array String
jobErrors = [ "model_not_found", "invalid_request", "max_output_tokens" ]

-- | The trouble behind one of Claude Code's words for an API error. One it
-- | does not know is taken for a server error: waited out, and tried again.
troubleOf :: String -> Trouble
troubleOf error
  | error == "rate_limit" = RateLimit
  | error == "overloaded" = Overloaded
  | elem error accountErrors = Account
  | elem error jobErrors = Job
  | otherwise = Server

troubleTag :: Trouble -> String
troubleTag = case _ of
  RateLimit -> "rate-limit"
  Overloaded -> "overloaded"
  Server -> "server"
  Offline -> "offline"
  Timeout -> "timeout"
  Account -> "account"
  Job -> "job"
  Reply -> "reply"

-- | A tag nobody knows is a server error: the trouble that passes by itself.
troubleFromTag :: String -> Trouble
troubleFromTag = case _ of
  "rate-limit" -> RateLimit
  "overloaded" -> Overloaded
  "offline" -> Offline
  "timeout" -> Timeout
  "account" -> Account
  "job" -> Job
  "reply" -> Reply
  _ -> Server

-- The same, as the plain records the shell holds. Every field is always
-- there, and the ones a state does not have are empty.

type HealthWire = { state :: String, trouble :: String, detail :: String, until :: Number, failures :: Int }

-- | `kind` is `failed`, `answered`, `due`, `probing` or `abandoned`.
-- | `hasResetsAt` says whether `resetsAt` means anything.
type EventWire =
  { kind :: String
  , trouble :: String
  , detail :: String
  , at :: Number
  , random :: Number
  , hasResetsAt :: Boolean
  , resetsAt :: Number
  }

healthToWire :: Health -> HealthWire
healthToWire = case _ of
  Ok -> { state: "ok", trouble: "", detail: "", until: 0.0, failures: 0 }
  Waiting w -> { state: "waiting", trouble: troubleTag w.trouble, detail: w.detail, until: w.until, failures: w.failures }
  Recovering r -> { state: "recovering", trouble: troubleTag r.trouble, detail: r.detail, until: 0.0, failures: r.failures }
  Probing p -> { state: "probing", trouble: troubleTag p.trouble, detail: p.detail, until: 0.0, failures: p.failures }
  Blocked b -> { state: "blocked", trouble: "", detail: b.detail, until: 0.0, failures: 0 }

-- | A state nobody knows is `Ok`: with nothing known to be wrong, jobs ask.
healthFromWire :: HealthWire -> Health
healthFromWire w = case w.state of
  "waiting" -> Waiting { trouble: troubleFromTag w.trouble, detail: w.detail, until: w.until, failures: w.failures }
  "recovering" -> Recovering { trouble: troubleFromTag w.trouble, detail: w.detail, failures: w.failures }
  "probing" -> Probing { trouble: troubleFromTag w.trouble, detail: w.detail, failures: w.failures }
  "blocked" -> Blocked { detail: w.detail }
  _ -> Ok

-- | An event nobody knows changes nothing, which is what `Due` does to every
-- | state but `Waiting`, and a wait is not ended by a word nobody knows:
-- | `Abandoned` leaves a wait alone too, and is the one that is safe everywhere
-- | except in `Probing`, where the request it stands for has indeed ended.
eventFromWire :: EventWire -> Maybe Event
eventFromWire e = case e.kind of
  "failed" -> Just
    ( Failed
        { trouble: troubleFromTag e.trouble
        , detail: e.detail
        , at: e.at
        , random: e.random
        , resetsAt: if e.hasResetsAt then Just e.resetsAt else Nothing
        }
    )
  "answered" -> Just Answered
  "due" -> Just Due
  "probing" -> Just ProbingStarted
  "abandoned" -> Just Abandoned
  _ -> Nothing

stepWire :: HealthWire -> EventWire -> HealthWire
stepWire health event = case eventFromWire event of
  Just known -> healthToWire (step (healthFromWire health) known)
  Nothing -> health

mayAskWire :: HealthWire -> Boolean
mayAskWire = mayAsk <<< healthFromWire

retryDelayMsWire :: String -> Int -> Number -> Number
retryDelayMsWire trouble = retryDelayMs (troubleFromTag trouble)

troubleOfWire :: String -> String
troubleOfWire = troubleTag <<< troubleOf

-- | What `$.model.complete` resolved to, as far as this module reads it.
-- | `hasStatus` is false when no HTTP status came back at all.
type ResultWire = { isAnswered :: Boolean, reason :: String, hasStatus :: Boolean, status :: Int, error :: String }

-- | How a request went: answered, or not, why, and the why in a few words for the person.
type OutcomeWire = { ok :: Boolean, trouble :: String, detail :: String }

failedWith :: Trouble -> String -> OutcomeWire
failedWith trouble detail = { ok: false, trouble: troubleTag trouble, detail }

spaced :: String -> String
spaced = replaceAll (Pattern "_") (Replacement " ")

-- | How a model call went.
outcomeOfWire :: ResultWire -> OutcomeWire
outcomeOfWire result
  | result.isAnswered = { ok: true, trouble: "", detail: "" }
  | result.reason == "aborted" = failedWith Timeout "timed out"
  | result.reason /= "api-error" = failedWith Reply "empty reply"
  -- No status at all: the request never reached the service, or its answer never came back.
  | not result.hasStatus = failedWith Offline "no connection"
  | result.error == "" || result.error == "unknown" = failedWith Server ("error " <> show result.status)
  | otherwise = failedWith (troubleOf result.error) (spaced result.error)

-- | How an API error that ended a turn, the conversation's or a subagent's, counts.
outcomeOfErrorWire :: String -> OutcomeWire
outcomeOfErrorWire error = failedWith (troubleOf error) (spaced error)

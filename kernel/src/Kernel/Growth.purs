-- | Growth: one score per language, from everything the tutor has seen of
-- | the person, and the level it places them at.
-- |
-- | What counts, and how much:
-- |   * Their own commits count most. What the progress look saw in them, a
-- |     skill shown or missed at a level, with the weight the progress record
-- |     gave it (work watched as it arrived counts in full, other commits half).
-- |   * Lessons. A step the tutor saw them do counts `checkedStep`, a step they
-- |     marked done themselves `selfStep`, at the lesson's level. Lessons can
-- |     never carry a level alone: at each level they count `lessonCap` at most,
-- |     less than `reach`, and a level also needs `ownAtLeast` of their own
-- |     commits' work. A lesson started and not finished counts nothing either
-- |     way: it says where they are not yet, and it is listed, never held
-- |     against them. A lesson never started costs nothing.
-- |   * Habits. A topic the play-by-play kept raising (`recurringTimes` or
-- |     more) that has not come up in their last `habitLooks` looks is a habit
-- |     improved, and moves the score up within the level. One that is still
-- |     coming back moves it down within the level, never below it.
-- |
-- | The level is the highest one their evidence holds: `reach` of weight shown
-- | at that level or above, less what they missed at that level or below, of
-- | which `ownAtLeast` from their own commits. The score is the level times a
-- | hundred plus how far they are toward the next: 162 is a junior 62 of the
-- | way to mid. Nothing is placed before `placeObservations` observations from
-- | `placeCommits` commits, as with the progress record.
-- |
-- | What to work on, where they needed help, what they improved and what
-- | would raise the score are picked here too, as plain items. The wording is
-- | the edge's (growth.ts).
module Kernel.Growth
  ( Rank(..)
  , Seen
  , LessonFact
  , TopicFact
  , Facts
  , Item
  , Growth
  , growthOf
  , evidenceAt
  , reach
  , ownAtLeast
  , lessonCap
  , checkedStep
  , selfStep
  , habitLooks
  , recurringTimes
  , placeObservations
  , placeCommits
  , GrowthFactsWire
  , GrowthWire
  , growthWire
  ) where

import Prelude

import Data.Array (any, elem, filter, find, foldl, length, mapMaybe, nub, reverse, snoc, sortBy, take)
import Data.Foldable (sum)
import Data.Int (floor, toNumber)
import Data.Maybe (Maybe(..), fromMaybe)

data Rank = Beginner | Junior | Mid | Senior

derive instance eqRank :: Eq Rank
derive instance ordRank :: Ord Rank

rankOf :: Int -> Rank
rankOf n
  | n <= 0 = Beginner
  | n == 1 = Junior
  | n == 2 = Mid
  | otherwise = Senior

rankNumber :: Rank -> Int
rankNumber Beginner = 0
rankNumber Junior = 1
rankNumber Mid = 2
rankNumber Senior = 3

above :: Rank -> Maybe Rank
above Beginner = Just Junior
above Junior = Just Mid
above Mid = Just Senior
above Senior = Nothing

-- | One thing the progress look saw in a commit of theirs. Oldest first.
type Seen =
  { commit :: String
  , skill :: String
  , rank :: Rank
  , isShown :: Boolean
  , weight :: Number
  }

-- | One learning path and how far they are in it.
type LessonFact =
  { id :: String
  , title :: String
  , rank :: Rank
  , steps :: Int
  -- | Steps done, of which `checked` the tutor saw them do.
  , done :: Int
  , checked :: Int
  -- | Steps where they needed the tutor to walk them through.
  , helped :: Int
  -- | False for a path of another language: it is listed, and it does not move this language's level.
  , isCounted :: Boolean
  , skills :: Array String
  }

-- | A topic the play-by-play raised in their work, or they asked to have explained.
type TopicFact =
  { topic :: String
  , flagged :: Int
  , explained :: Int
  -- | How many looks at their code in this language since it was last raised.
  , sinceLooks :: Int
  }

type Facts =
  { seen :: Array Seen
  , lessons :: Array LessonFact
  , topics :: Array TopicFact
  }

-- | One line of the Growth tab, before it is worded: what kind of thing, about
-- | what, and up to two counts that go with it.
type Item = { kind :: String, what :: String, count :: Int, total :: Int }

type Growth =
  { level :: Maybe Rank
  -- | Level times a hundred, plus how far toward the next. -1 before a level.
  , score :: Int
  , toNext :: Int
  , shown :: Number
  , missed :: Number
  , lessonSteps :: Int
  , habitsImproved :: Int
  , stillComing :: Int
  , workOn :: Array Item
  , neededHelp :: Array Item
  , improved :: Array Item
  , toRaise :: Array Item
  , encouragement :: Maybe Item
  }

-- | The weight of evidence that holds a level.
reach :: Number
reach = 4.0

-- | Of that, how much has to come from their own commits.
ownAtLeast :: Number
ownAtLeast = 2.0

-- | The most lessons count toward any one level.
lessonCap :: Number
lessonCap = 2.0

checkedStep :: Number
checkedStep = 0.5

selfStep :: Number
selfStep = 0.25

-- | Looks at their code without a topic coming back before it counts as a habit improved.
habitLooks :: Int
habitLooks = 12

-- | Raised this often, a topic is something that keeps coming back.
recurringTimes :: Int
recurringTimes = 3

placeObservations :: Int
placeObservations = 5

placeCommits :: Int
placeCommits = 2

-- | How much of the way to the next level the evidence at that level can carry. Habits carry the rest.
evidenceSpan :: Number
evidenceSpan = 80.0

habitPoints :: Number
habitPoints = 5.0

habitCap :: Number
habitCap = 20.0

clamp' :: Number -> Number -> Number -> Number
clamp' low high x = max low (min high x)

commitCount :: Array Seen -> Int
commitCount seen = length (nub (map _.commit seen))

lessonCredit :: LessonFact -> Number
lessonCredit lesson = toNumber lesson.checked * checkedStep + toNumber (max 0 (lesson.done - lesson.checked)) * selfStep

-- | What their own commits showed at `rank` or above.
ownAt :: Facts -> Rank -> Number
ownAt facts rank = sum (map _.weight (filter (\seen -> seen.isShown && seen.rank >= rank) facts.seen))

-- | The weight of evidence for `rank`: shown at it or above, lessons included
-- | up to their cap, less what was missed at it or below.
evidenceAt :: Facts -> Rank -> Number
evidenceAt facts rank = ownAt facts rank + lessons - missed
  where
  lessons = min lessonCap (sum (map lessonCredit (filter (\lesson -> lesson.isCounted && lesson.rank >= rank) facts.lessons)))
  missed = sum (map _.weight (filter (\seen -> not seen.isShown && seen.rank <= rank) facts.seen))

holds :: Facts -> Rank -> Boolean
holds facts rank = evidenceAt facts rank >= reach && ownAt facts rank >= ownAtLeast

isPlaced :: Facts -> Boolean
isPlaced facts = length facts.seen >= placeObservations && commitCount facts.seen >= placeCommits

levelOf :: Facts -> Maybe Rank
levelOf facts
  | not (isPlaced facts) = Nothing
  | otherwise = Just (fromMaybe Beginner (find (holds facts) [ Senior, Mid, Junior ]))

-- | A skill as the latest commit that touched it left it.
type SkillState = { skill :: String, commit :: String, rank :: Rank, shownNow :: Boolean, missedNow :: Boolean, shownBefore :: Boolean, missedBefore :: Boolean }

skillStates :: Array Seen -> Array SkillState
skillStates = foldl step []
  where
  step states seen = case find (\state -> state.skill == seen.skill) states of
    Nothing -> snoc states { skill: seen.skill, commit: seen.commit, rank: seen.rank, shownNow: seen.isShown, missedNow: not seen.isShown, shownBefore: false, missedBefore: false }
    Just known ->
      map
        ( \state ->
            if state.skill /= seen.skill then state
            else if state.commit == seen.commit then state { shownNow = state.shownNow || seen.isShown, missedNow = state.missedNow || not seen.isShown }
            else
              { skill: seen.skill
              , commit: seen.commit
              , rank: seen.rank
              , shownNow: seen.isShown
              , missedNow: not seen.isShown
              , shownBefore: known.shownBefore || known.shownNow
              , missedBefore: known.missedBefore || known.missedNow
              }
        )
        states

isSlipping :: SkillState -> Boolean
isSlipping state = not state.shownNow && state.shownBefore

isStillMissed :: SkillState -> Boolean
isStillMissed state = not state.shownNow && not state.shownBefore

isImproved :: SkillState -> Boolean
isImproved state = state.shownNow && not state.missedNow && state.missedBefore

isRecurring :: TopicFact -> Boolean
isRecurring topic = topic.flagged >= recurringTimes

isHabitImproved :: TopicFact -> Boolean
isHabitImproved topic = isRecurring topic && topic.sinceLooks >= habitLooks

isStillComing :: TopicFact -> Boolean
isStillComing topic = isRecurring topic && topic.sinceLooks < habitLooks

isFinished :: LessonFact -> Boolean
isFinished lesson = lesson.steps > 0 && lesson.done >= lesson.steps

isUnderWay :: LessonFact -> Boolean
isUnderWay lesson = lesson.done > 0 && not (isFinished lesson)

item :: String -> String -> Int -> Int -> Item
item kind what count total = { kind, what, count, total }

byCount :: Array Item -> Array Item
byCount = sortBy (\a b -> compare b.count a.count)

growthOf :: Facts -> Growth
growthOf facts =
  { level
  , score
  , toNext
  , shown: sum (map _.weight (filter _.isShown facts.seen))
  , missed: sum (map _.weight (filter (not <<< _.isShown) facts.seen))
  , lessonSteps: sum (map _.done facts.lessons)
  , habitsImproved: length habits
  , stillComing: length coming
  , workOn
  , neededHelp
  , improved
  , toRaise
  , encouragement
  }
  where
  level = levelOf facts
  states = skillStates facts.seen
  habits = filter isHabitImproved facts.topics
  coming = filter isStillComing facts.topics
  habitLift = min habitCap (toNumber (length habits) * habitPoints)
  comingDrag = min habitCap (toNumber (length coming) * habitPoints)

  toNext = case level of
    Nothing -> 0
    Just rank ->
      let
        carried = case above rank of
          Just next -> clamp' 0.0 1.0 (evidenceAt facts next / reach) * evidenceSpan
          -- At the top, the way on is more of the same: twice the reach.
          Nothing -> clamp' 0.0 1.0 (evidenceAt facts rank / (2.0 * reach)) * evidenceSpan
      in
        floor (clamp' 0.0 99.0 (carried + habitLift - comingDrag))

  score = case level of
    Nothing -> -1
    Just rank -> rankNumber rank * 100 + toNext

  -- What to work on: what slipped first, then what keeps coming back in their
  -- work, then what they have not shown yet, then lessons under way.
  workOn = take 6
    ( map (\state -> item "slipping" state.skill 0 0) (filter isSlipping states)
        <> map (\topic -> item "recurring" topic.topic topic.flagged 0) (sortBy (\a b -> compare b.flagged a.flagged) coming)
        <> map (\state -> item "missed" state.skill 0 0) (filter isStillMissed states)
        <> map (\lesson -> item "lesson" lesson.title lesson.done lesson.steps) (filter isUnderWay facts.lessons)
    )

  neededHelp = take 5 $ byCount
    ( map (\topic -> item "asked" topic.topic topic.explained 0) (filter (\topic -> topic.explained > 0) facts.topics)
        <> map (\topic -> item "flagged" topic.topic topic.flagged 0) coming
        <> map (\lesson -> item "lesson" lesson.title lesson.helped 0) (filter (\lesson -> lesson.helped > 0) facts.lessons)
    )

  improved = take 5
    ( map (\topic -> item "habit" topic.topic topic.flagged topic.sinceLooks) habits
        <> map (\state -> item "skill" state.skill 0 0) (reverse (filter isImproved states))
        <> map (\lesson -> item "lesson" lesson.title lesson.steps 0) (filter isFinished facts.lessons)
    )

  encouragement = case improved of
    [] -> Nothing
    _ -> find (\it -> it.kind == "habit") improved <|> find (\it -> it.kind == "skill") improved <|> find (\it -> it.kind == "lesson") improved

  -- The level the score is heading for, and what it lacks.
  target = case level of
    Nothing -> Nothing
    Just rank -> above rank

  -- Skills at the next level that they missed and have not shown since.
  nextSkills = case target of
    Nothing -> []
    Just next -> map (\state -> item "skill" state.skill (rankNumber next) 0) (filter (\state -> state.rank == next && not state.shownNow) states)

  focus = map _.skill (filter (\state -> isSlipping state || isStillMissed state) states) <> map _.topic coming
  open = filter (\lesson -> lesson.isCounted && not (isFinished lesson)) facts.lessons
  fits lesson = any (\skill -> elem skill focus) lesson.skills
  atLeast lesson = case level of
    Nothing -> true
    Just rank -> lesson.rank >= rank
  suggested = take 2 (nub' (filter fits open <> filter (\lesson -> Just lesson.rank == target) open <> filter atLeast open))
  lessonItems = map (\lesson -> item "lesson" lesson.title lesson.done lesson.steps) suggested

  ownItem = case target of
    Just next | ownAt facts next < ownAtLeast -> [ item "own" "" (rankNumber next) 0 ]
    _ -> []

  placeItem =
    if isPlaced facts then []
    else [ item "place" "" (max 0 (placeObservations - length facts.seen)) (max 0 (placeCommits - commitCount facts.seen)) ]

  toRaise = take 5 (placeItem <> nextSkills <> ownItem <> lessonItems)

  nub' lessons = foldl (\kept lesson -> if any (\other -> other.id == lesson.id) kept then kept else snoc kept lesson) [] lessons

infixl 3 alt as <|>

alt :: forall a. Maybe a -> Maybe a -> Maybe a
alt (Just a) _ = Just a
alt Nothing b = b

-- The wire: flat records with every field present. A rank is 0 to 3; -1 is none.

type GrowthFactsWire =
  { seen :: Array { commit :: String, skill :: String, rank :: Int, isShown :: Boolean, weight :: Number }
  , lessons :: Array { id :: String, title :: String, rank :: Int, steps :: Int, done :: Int, checked :: Int, helped :: Int, isCounted :: Boolean, skills :: Array String }
  , topics :: Array TopicFact
  }

type GrowthWire =
  { rank :: Int
  , score :: Int
  , toNext :: Int
  , shown :: Number
  , missed :: Number
  , lessonSteps :: Int
  , habitsImproved :: Int
  , stillComing :: Int
  , workOn :: Array Item
  , neededHelp :: Array Item
  , improved :: Array Item
  , toRaise :: Array Item
  , encouragement :: Array Item
  }

growthWire :: GrowthFactsWire -> GrowthWire
growthWire wire =
  let
    grown = growthOf
      { seen: map (\seen -> seen { rank = rankOf seen.rank, weight = clamp' 0.0 1.0 seen.weight }) wire.seen
      , lessons: map (\lesson -> lesson { rank = rankOf lesson.rank, done = min lesson.steps (max 0 lesson.done), checked = max 0 (min lesson.done lesson.checked) }) wire.lessons
      , topics: wire.topics
      }
  in
    { rank: maybe' (-1) rankNumber grown.level
    , score: grown.score
    , toNext: grown.toNext
    , shown: grown.shown
    , missed: grown.missed
    , lessonSteps: grown.lessonSteps
    , habitsImproved: grown.habitsImproved
    , stillComing: grown.stillComing
    , workOn: grown.workOn
    , neededHelp: grown.neededHelp
    , improved: grown.improved
    , toRaise: grown.toRaise
    , encouragement: mapMaybe identity [ grown.encouragement ]
    }
  where
  maybe' fallback f = case _ of
    Nothing -> fallback
    Just a -> f a

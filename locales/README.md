# Locales

Catalogs for Lingui (`en` source, `de`, `es`, `fr`). Edit strings in the source files, never in `messages.po` directly, then run `npm run extract && npm run compile` (Node 22+). Fill the `de`, `es` and `fr` entries in the same change: a reworded source string leaves its old translation behind as an obsolete `#~` entry, not a fallback.

## Voice

Write for someone between sets: friendly, plain, brief.

- **Sentence case** for buttons, titles and section headers: "Set as active plan", not "Set As Active Plan". Product names keep their capitals (MuscleQuest).
- **Verbs on buttons**, named for what happens: "Discard" and "Keep training", not "Yes" and "No". The cancel side of a destructive alert keeps the thing safe ("Keep", "Not now").
- **One or two sentences** for descriptions and hints. Cut what the screen already shows.
- **No slang or hype**: "Weekly goal reached", not "You've smashed your goal!". Use exclamation marks rarely.
- **No trailing colons** on labels ("Rest", not "Rest Time Left:").
- **Numbers with units**, formatted through `utils/units.ts` and `utils/numberFormat.ts`.
- **Errors** say what failed and what to do next ("Try again"), never a raw `error.message`.

## Terms

| Use           | For                                                                                                                                                                  | Avoid                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Workout       | A saved, reusable workout. Outside a plan they live under "Your workouts"; say "Workouts outside plans" only where they sit next to plans (privacy, friend profile). | standalone workout, single workout |
| Quick workout | An unplanned live session started from home.                                                                                                                         | Quick Workout (as a label)         |
| Session       | One time you train: a workout in progress or completed.                                                                                                              |                                    |
| Plan          | A training plan; "Active plan" is the one home follows.                                                                                                              | Start plan                         |
| Cues          | Standing reminders on an exercise, workout or plan.                                                                                                                  |                                    |
| Notes         | Belong to one session or one set.                                                                                                                                    |                                    |

The stored name `QUICK_WORKOUT_NAME` stays "Quick Workout" in English; show it through `displayWorkoutName()` (`utils/workoutName.ts`).

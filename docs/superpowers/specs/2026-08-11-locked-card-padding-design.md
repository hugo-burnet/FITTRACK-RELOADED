# Locked exercise card padding design

## Problem

Routine and live-workout exercise headers relied on the 44 px drag handle for their left inset.
When order is locked, the handle is removed and the title/subtitle touch the rounded card edge.

## Approved design

Add a 16 px left inset to the header content only while reordering is locked. Keep the current
layout unchanged while unlocked so the visible handle remains the leading control. Apply the
same rule to `RoutineExerciseCard` and `WorkoutExerciseCard`.

Rejected alternatives:

- preserving an invisible 44 px handle leaves unnecessary empty space;
- adding permanent padding changes the already-correct unlocked layout.

## Verification

Component regressions must assert the locked inset and its absence when unlocked on both cards.
Run the focused routine/workout tests, lint, typecheck, the complete test suite, and production
build before publishing the hotfix.

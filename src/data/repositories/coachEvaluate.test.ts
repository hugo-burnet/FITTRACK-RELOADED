import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type {
  Exercise,
  ProgramPhase,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { selectProgramAction } from '@/lib/coach';
import { resetDb } from '@/test/resetDb';
import {
  evaluateCoachForWorkout,
  finalizeCoachForWorkout,
  resolveTargetProgramContext,
} from './coachEvaluate';
import {
  listRecommendationsForExercise,
  recordCoachSignals,
} from './coachRecommendations';
import {
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  replaceProgramWeeks,
} from './programs';
import { addExercisesToRoutine, createRoutine } from './routines';
import { finishWorkout } from './workoutLifecycle';

const exercise: Exercise = {
  ...newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  }),
  id: 'bench',
};

function seedSession(id: string, startedAt: number, reps: number, weight: number): Promise<void> {
  const workout: Workout = {
    ...newEntity<Workout>({
      routineId: '',
      name: 'Test',
      status: 'completed',
      startedAt,
      endedAt: startedAt + 3_600_000,
      durationSeconds: 3_600,
    }),
    id,
  };
  const row: WorkoutExercise = {
    ...newEntity<WorkoutExercise>({
      workoutId: id,
      exerciseId: exercise.id,
      order: 0,
      supersetGroup: 0,
      restSeconds: 120,
      exerciseName: exercise.name,
      exerciseMeasurementType: exercise.measurementType,
      exerciseEquipment: exercise.equipment,
    }),
    id: `${id}-row`,
  };
  const sets: WorkoutSet[] = [0, 1, 2].map((order) => ({
    ...newEntity<WorkoutSet>({
      workoutExerciseId: row.id,
      exerciseId: exercise.id,
      workoutId: id,
      order,
      setType: 'normal',
      side: 'both',
      weight,
      reps,
      // Plancher à 5 : ces séances sont des séries de 5. Le laisser à 8 en
      // ferait deux échecs consécutifs à la même charge, donc un signal
      // `range_missed` légitime — mais ce n'est pas ce que ce test observe.
      targetReps: 5,
      targetRepsMax: 12,
      isCompleted: 1,
      performedAt: startedAt + order * 120_000,
    }),
    id: `${id}-set-${order}`,
  }));

  return db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    await db.workouts.add(workout);
    await db.workoutExercises.add(row);
    await db.workoutSets.bulkAdd(sets);
  });
}

describe('evaluateCoachForWorkout', () => {
  beforeEach(async () => {
    await resetDb();
    await db.exercises.add(exercise);
  });

  it('proposes the next load when the active session completes the range', async () => {
    const startedAt = Date.UTC(2026, 7, 10, 10);
    const workout: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Live',
        status: 'active',
        startedAt,
        endedAt: 0,
        durationSeconds: 0,
      }),
      id: 'live',
    };
    const row: WorkoutExercise = {
      ...newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
        exerciseEquipment: exercise.equipment,
      }),
      id: 'live-row',
    };
    await db.workouts.add(workout);
    await db.workoutExercises.add(row);
    await db.workoutSets.bulkAdd(
      [0, 1, 2].map((order) => ({
        ...newEntity<WorkoutSet>({
          workoutExerciseId: row.id,
          exerciseId: exercise.id,
          workoutId: workout.id,
          order,
          setType: 'normal',
          side: 'both',
          weight: 100,
          reps: 12,
          targetReps: 8,
          targetRepsMax: 12,
          isCompleted: 1,
          performedAt: startedAt + order * 90_000,
        }),
        id: `live-set-${order}`,
      })),
    );

    const signals = await evaluateCoachForWorkout(workout.id);
    expect(signals).toEqual([
      expect.objectContaining({
        code: 'range_ceiling_reached',
        exerciseId: 'bench',
        nextLoadKg: 102.5,
      }),
    ]);
  });

  it('emits a load proposal on a programmed ceiling when target phase ranks increase_load', async () => {
    // No resolvable next week → hors bloc = construction → increase_load.
    const startedAt = Date.UTC(2026, 7, 10, 10);
    const workout: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Programmed',
        status: 'active',
        startedAt,
        endedAt: 0,
        durationSeconds: 0,
        programId: 'program',
        programPhase: 'construction',
        programLoadIndex: 100,
      }),
      id: 'programmed',
    };
    const row: WorkoutExercise = {
      ...newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
        exerciseEquipment: exercise.equipment,
      }),
      id: 'programmed-row',
    };
    await db.workouts.add(workout);
    await db.workoutExercises.add(row);
    await db.workoutSets.bulkAdd(
      [0, 1, 2].map((order) => ({
        ...newEntity<WorkoutSet>({
          workoutExerciseId: row.id,
          exerciseId: exercise.id,
          workoutId: workout.id,
          order,
          setType: 'normal',
          side: 'both',
          weight: 100,
          reps: 12,
          targetReps: 8,
          targetRepsMax: 12,
          isCompleted: 1,
          performedAt: startedAt + order * 90_000,
        }),
        id: `programmed-set-${order}`,
      })),
    );

    expect(await evaluateCoachForWorkout(workout.id)).toEqual([
      expect.objectContaining({
        code: 'range_ceiling_reached',
        exerciseId: 'bench',
        nextLoadKg: 102.5,
      }),
    ]);
  });

  it('S4 overload close + S5 deload target: no add_set / no load escalate in reco', async () => {
    // Civil calendar: Mon 2026-08-10 = week 0. Week 3 (S4) starts Mon 2026-08-31.
    const programStart = new Date(2026, 7, 10, 12).getTime(); // Monday
    const s4Monday = new Date(2026, 7, 31, 12).getTime(); // weekIndex 3
    const program = await createProgramDraft({
      name: 'Force',
      startsAt: programStart,
      durationWeeks: 5,
    });
    const weeks: { weekIndex: number; loadIndex: number; phase: ProgramPhase }[] = [
      { weekIndex: 0, loadIndex: 100, phase: 'construction' },
      { weekIndex: 1, loadIndex: 105, phase: 'progression' },
      { weekIndex: 2, loadIndex: 105, phase: 'progression' },
      { weekIndex: 3, loadIndex: 110, phase: 'overload' },
      { weekIndex: 4, loadIndex: 60, phase: 'deload' },
    ];
    await replaceProgramWeeks(program.id, weeks);
    const routine = await createRoutine('Upper');
    await addExercisesToRoutine(routine.id, [exercise.id]);
    const revision = await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    const entry = (await db.programScheduleEntries.where('revisionId').equals(revision.id).toArray())[0]!;
    await activateProgram(program.id);

    const workout: Workout = {
      ...newEntity<Workout>({
        routineId: routine.id,
        name: 'S4 Surcharge',
        status: 'active',
        startedAt: s4Monday,
        endedAt: 0,
        durationSeconds: 0,
        programId: program.id,
        programWeekIndex: 3,
        programScheduleEntryId: entry.id,
        programPhase: 'overload',
        programLoadIndex: 110,
      }),
      id: 's4-overload',
    };
    const row: WorkoutExercise = {
      ...newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
        exerciseEquipment: exercise.equipment,
      }),
      id: 's4-row',
    };
    await db.workouts.add(workout);
    await db.workoutExercises.add(row);
    await db.workoutSets.bulkAdd(
      [0, 1, 2].map((order) => ({
        ...newEntity<WorkoutSet>({
          workoutExerciseId: row.id,
          exerciseId: exercise.id,
          workoutId: workout.id,
          order,
          setType: 'normal',
          side: 'both',
          weight: 100,
          reps: 12,
          targetReps: 8,
          targetRepsMax: 12,
          isCompleted: 1,
          performedAt: s4Monday + order * 90_000,
        }),
        id: `s4-set-${order}`,
      })),
    );

    const target = await resolveTargetProgramContext(workout, s4Monday);
    expect(target).toEqual({ phase: 'deload', loadIndex: 60 });

    // Engine would allow add_set on ceiling + overload *source*, but target is deload.
    expect(
      selectProgramAction(['maintain', 'increase_load', 'add_set'], target),
    ).toBe('maintain');

    const signals = await evaluateCoachForWorkout(workout.id);
    expect(signals).toEqual([
      expect.objectContaining({
        code: 'range_ceiling_reached',
        exerciseId: 'bench',
      }),
    ]);
    expect(signals[0]?.nextLoadKg).toBeUndefined();
    // No escalate reco stored as a load figure.
    expect(signals.every((signal) => signal.nextLoadKg === undefined)).toBe(true);
  });

  it('ne marque pas suivie une ancienne charge Coach reprise par un programme', async () => {
    const startedAt = Date.UTC(2026, 7, 10, 10);
    const workout: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Programmed',
        status: 'active',
        startedAt,
        endedAt: 0,
        durationSeconds: 0,
        programId: 'program',
      }),
      id: 'programmed-stale-load',
    };
    const row: WorkoutExercise = {
      ...newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
        exerciseEquipment: exercise.equipment,
      }),
      id: 'programmed-stale-load-row',
    };
    await db.workouts.add(workout);
    await db.workoutExercises.add(row);
    // Under the floor so the engine emits no range escalate — the pending load
    // proposal must not be marked followed just because the program reused 102.5.
    await db.workoutSets.add({
      ...newEntity<WorkoutSet>({
        workoutExerciseId: row.id,
        exerciseId: exercise.id,
        workoutId: workout.id,
        order: 0,
        setType: 'normal',
        side: 'both',
        weight: 102.5,
        reps: 6,
        targetReps: 8,
        targetRepsMax: 12,
        isCompleted: 1,
        performedAt: startedAt,
      }),
      id: 'programmed-stale-load-set',
    });
    await recordCoachSignals(
      [
        {
          exerciseId: exercise.id,
          code: 'range_completed',
          severity: 1,
          nextLoadKg: 102.5,
          evidence: [{ label: 'next_load_kg', value: 102.5 }],
        },
      ],
      { recommendedAt: startedAt - 1 },
    );

    await finishWorkout(workout.id);
    await finalizeCoachForWorkout(workout.id);

    expect((await listRecommendationsForExercise(exercise.id))[0]).toMatchObject({
      status: 'pending',
      nextLoadKg: 102.5,
    });
  });

  it('keeps a rep-drop observation on a programmed session (constats still surface)', async () => {
    // Previous hit the range so range_missed does not fire; only the drop does.
    const previousAt = Date.UTC(2026, 7, 4, 10);
    const currentAt = Date.UTC(2026, 7, 8, 10);
    const previous: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Previous',
        status: 'completed',
        startedAt: previousAt,
        endedAt: previousAt + 3_600_000,
        durationSeconds: 3_600,
      }),
      id: 'previous-ok',
    };
    const current: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Programmed',
        status: 'active',
        startedAt: currentAt,
        endedAt: 0,
        durationSeconds: 0,
        programId: 'program',
      }),
      id: 'programmed-drop',
    };
    const rows: WorkoutExercise[] = [previous, current].map((workout) => ({
      ...newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
        exerciseEquipment: exercise.equipment,
      }),
      id: `${workout.id}-row`,
    }));
    const previousSets: WorkoutSet[] = [0, 1].map((order) => ({
      ...newEntity<WorkoutSet>({
        workoutExerciseId: rows[0]!.id,
        exerciseId: exercise.id,
        workoutId: previous.id,
        order,
        setType: 'normal',
        side: 'both',
        weight: 100,
        reps: 10,
        targetReps: 8,
        targetRepsMax: 12,
        isCompleted: 1,
        performedAt: previousAt + order * 90_000,
      }),
      id: `previous-ok-set-${order}`,
    }));
    const currentSets: WorkoutSet[] = [12, 5].map((reps, order) => ({
      ...newEntity<WorkoutSet>({
        workoutExerciseId: rows[1]!.id,
        exerciseId: exercise.id,
        workoutId: current.id,
        order,
        setType: 'normal',
        side: 'both',
        weight: 100,
        reps,
        targetReps: 8,
        targetRepsMax: 12,
        isCompleted: 1,
        performedAt: currentAt + order * 240_000,
      }),
      id: `programmed-drop-set-${order}`,
    }));
    await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
      await db.workouts.bulkAdd([previous, current]);
      await db.workoutExercises.bulkAdd(rows);
      await db.workoutSets.bulkAdd([...previousSets, ...currentSets]);
    });

    expect(await evaluateCoachForWorkout(current.id)).toEqual([
      expect.objectContaining({ code: 'intra_session_drop', exerciseId: exercise.id }),
    ]);
  });

  it('persists recommendations on finalize and skips a deload plateau false positive', async () => {
    await seedSession('w1', Date.UTC(2026, 7, 1), 5, 100);
    await seedSession('w2', Date.UTC(2026, 7, 4), 5, 100);

    const startedAt = Date.UTC(2026, 7, 8, 10);
    const workout: Workout = {
      ...newEntity<Workout>({
        routineId: '',
        name: 'Deload week',
        status: 'active',
        startedAt,
        endedAt: 0,
        durationSeconds: 0,
        programIsDeload: 1,
      }),
      id: 'deload',
    };
    const row: WorkoutExercise = {
      ...newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
      }),
      id: 'deload-row',
    };
    await db.workouts.add(workout);
    await db.workoutExercises.add(row);
    await db.workoutSets.add({
      ...newEntity<WorkoutSet>({
        workoutExerciseId: row.id,
        exerciseId: exercise.id,
        workoutId: workout.id,
        order: 0,
        setType: 'normal',
        side: 'both',
        weight: 80,
        reps: 8,
        targetReps: 8,
        targetRepsMax: 12,
        isCompleted: 1,
        performedAt: startedAt,
      }),
      id: 'deload-set',
    });

    await finishWorkout(workout.id);
    const signals = await finalizeCoachForWorkout(workout.id);
    expect(signals.filter((signal) => signal.code === 'plateau')).toEqual([]);

    // No range completed either (deload + missed top of range).
    expect(await listRecommendationsForExercise('bench')).toEqual([]);
  });

  it('progression target without increase_*: stamps progression_deferred, strips load', async () => {
    // Three identical ceiling sessions → plateau strips escalations → maintain.
    const programStart = new Date(2026, 7, 10, 12).getTime();
    const closeAt = new Date(2026, 7, 17, 12).getTime(); // week 0 done; next week = progression
    const program = await createProgramDraft({
      name: 'Prog',
      startsAt: programStart,
      durationWeeks: 4,
    });
    await replaceProgramWeeks(program.id, [
      { weekIndex: 0, loadIndex: 100, phase: 'construction' },
      { weekIndex: 1, loadIndex: 105, phase: 'progression' },
      { weekIndex: 2, loadIndex: 105, phase: 'progression' },
      { weekIndex: 3, loadIndex: 100, phase: 'construction' },
    ]);
    const routine = await createRoutine('Upper');
    await addExercisesToRoutine(routine.id, [exercise.id]);
    const revision = await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    const entry = (await db.programScheduleEntries.where('revisionId').equals(revision.id).toArray())[0]!;
    await activateProgram(program.id);

    // Prior ceiling sessions (plateau history).
    for (const [i, dayOffset] of [0, 7].entries()) {
      const id = `hist-${i}`;
      const at = programStart + dayOffset * 86_400_000;
      await db.workouts.add({
        ...newEntity<Workout>({
          routineId: routine.id,
          name: `H${i}`,
          status: 'completed',
          startedAt: at,
          endedAt: at + 3_600_000,
          durationSeconds: 3_600,
        }),
        id,
      });
      await db.workoutExercises.add({
        ...newEntity<WorkoutExercise>({
          workoutId: id,
          exerciseId: exercise.id,
          order: 0,
          supersetGroup: 0,
          restSeconds: 90,
          exerciseName: exercise.name,
          exerciseMeasurementType: exercise.measurementType,
          exerciseEquipment: exercise.equipment,
        }),
        id: `${id}-row`,
      });
      await db.workoutSets.bulkAdd(
        [0, 1, 2].map((order) => ({
          ...newEntity<WorkoutSet>({
            workoutExerciseId: `${id}-row`,
            exerciseId: exercise.id,
            workoutId: id,
            order,
            setType: 'normal',
            side: 'both',
            weight: 100,
            reps: 12,
            targetReps: 8,
            targetRepsMax: 12,
            isCompleted: 1,
            performedAt: at + order * 90_000,
          }),
          id: `${id}-set-${order}`,
        })),
      );
    }

    const workout: Workout = {
      ...newEntity<Workout>({
        routineId: routine.id,
        name: 'S1',
        status: 'active',
        startedAt: closeAt,
        endedAt: 0,
        durationSeconds: 0,
        programId: program.id,
        programWeekIndex: 0,
        programScheduleEntryId: entry.id,
        programPhase: 'construction',
        programLoadIndex: 100,
      }),
      id: 'prog-close',
    };
    await db.workouts.add(workout);
    await db.workoutExercises.add({
      ...newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
        exerciseEquipment: exercise.equipment,
      }),
      id: 'prog-close-row',
    });
    await db.workoutSets.bulkAdd(
      [0, 1, 2].map((order) => ({
        ...newEntity<WorkoutSet>({
          workoutExerciseId: 'prog-close-row',
          exerciseId: exercise.id,
          workoutId: workout.id,
          order,
          setType: 'normal',
          side: 'both',
          weight: 100,
          reps: 12,
          targetReps: 8,
          targetRepsMax: 12,
          isCompleted: 1,
          performedAt: closeAt + order * 90_000,
        }),
        id: `prog-close-set-${order}`,
      })),
    );

    const target = await resolveTargetProgramContext(workout, closeAt);
    expect(target?.phase).toBe('progression');

    const signals = await evaluateCoachForWorkout(workout.id);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => s.nextLoadKg === undefined)).toBe(true);
    expect(
      signals.some((s) => s.evidence.some((e) => e.label === 'progression_deferred' && e.value === 1)),
    ).toBe(true);
    expect(
      signals.every((s) => !s.evidence.some((e) => e.label === 'controlled_attempt')),
    ).toBe(true);
  });

  it('test target + authorized increase_load: controlled_attempt flag, same nextLoadKg', async () => {
    const programStart = new Date(2026, 7, 10, 12).getTime();
    const closeAt = new Date(2026, 7, 17, 12).getTime();
    const program = await createProgramDraft({
      name: 'Test block',
      startsAt: programStart,
      durationWeeks: 4,
    });
    await replaceProgramWeeks(program.id, [
      { weekIndex: 0, loadIndex: 100, phase: 'construction' },
      { weekIndex: 1, loadIndex: 110, phase: 'test' },
      { weekIndex: 2, loadIndex: 100, phase: 'return' },
      { weekIndex: 3, loadIndex: 100, phase: 'construction' },
    ]);
    const routine = await createRoutine('Upper');
    await addExercisesToRoutine(routine.id, [exercise.id]);
    const revision = await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    const entry = (await db.programScheduleEntries.where('revisionId').equals(revision.id).toArray())[0]!;
    await activateProgram(program.id);

    const workout: Workout = {
      ...newEntity<Workout>({
        routineId: routine.id,
        name: 'Pre-test',
        status: 'active',
        startedAt: closeAt,
        endedAt: 0,
        durationSeconds: 0,
        programId: program.id,
        programWeekIndex: 0,
        programScheduleEntryId: entry.id,
        programPhase: 'construction',
        programLoadIndex: 100,
      }),
      id: 'test-close',
    };
    await db.workouts.add(workout);
    await db.workoutExercises.add({
      ...newEntity<WorkoutExercise>({
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
        exerciseEquipment: exercise.equipment,
      }),
      id: 'test-close-row',
    });
    await db.workoutSets.bulkAdd(
      [0, 1, 2].map((order) => ({
        ...newEntity<WorkoutSet>({
          workoutExerciseId: 'test-close-row',
          exerciseId: exercise.id,
          workoutId: workout.id,
          order,
          setType: 'normal',
          side: 'both',
          weight: 100,
          reps: 12,
          targetReps: 8,
          targetRepsMax: 12,
          isCompleted: 1,
          performedAt: closeAt + order * 90_000,
        }),
        id: `test-close-set-${order}`,
      })),
    );

    const target = await resolveTargetProgramContext(workout, closeAt);
    expect(target).toEqual({ phase: 'test', loadIndex: 110 });

    const signals = await evaluateCoachForWorkout(workout.id);
    expect(signals).toEqual([
      expect.objectContaining({
        code: 'range_ceiling_reached',
        exerciseId: 'bench',
        nextLoadKg: 102.5,
      }),
    ]);
    expect(signals[0]!.evidence).toEqual(
      expect.arrayContaining([
        { label: 'controlled_attempt', value: 1 },
        { label: 'next_load_kg', value: 102.5 },
      ]),
    );
    expect(signals[0]!.evidence.some((e) => e.label === 'progression_deferred')).toBe(false);
  });
});

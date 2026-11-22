import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import { FIRST_RPE_BREACH_MILESTONE_ID } from '@/lib/milestones/catalogue';
import { createCustomExercise } from './exercises';
import { evaluateCoachForWorkout } from './coachEvaluate';
import { listMilestones } from './milestones';
import {
  RpeDisciplineLockedError,
  correctRpeDisciplineTrigger,
  getRpeDisciplineSettings,
  getRpeDisciplineState,
  grantRpeBreachMilestoneIfEarned,
  overrideRpeDiscipline,
  setRpeDisciplineSettings,
} from './rpeDiscipline';
import { addWorkoutExercise } from './workoutExercises';
import { finishWorkout, startWorkout } from './workoutLifecycle';
import { getWorkoutDetail } from './workoutDetail';
import {
  completeFirstSide,
  completeSet,
  deleteSet,
  duplicateLastSet,
  uncompleteSet,
  updateSetType,
  updateSetValues,
} from './workoutSets';

/**
 * Le protocole disciplinaire RPE, de la série écrite au verrou relu.
 *
 * Tout passe par les vraies écritures de séries : c'est la garantie qu'aucun geste de l'écran — la
 * coche, la bande d'effort, la feuille de série — n'y échappe.
 */

async function sessionWithSets(count = 3, isUnilateral: 0 | 1 = 0) {
  const exercise = await createCustomExercise({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral,
    bodyweightLoadFactor: 0,
  });
  const workout = await startWorkout('', 'Poussée');
  const row = await addWorkoutExercise(workout.id, exercise.id);
  while ((await getWorkoutDetail(workout.id))!.exercises[0]!.sets.length < count) {
    await duplicateLastSet(row.id);
  }
  const sets = (await getWorkoutDetail(workout.id))!.exercises[0]!.sets;
  return { workout, rowId: row.id, setIds: sets.map((set) => set.id) };
}

const events = async (workoutId: string) => (await db.workouts.get(workoutId))?.rpeDiscipline ?? [];

describe('protocole disciplinaire RPE — réglage', () => {
  beforeEach(resetDb);

  it('est actif à RPE 8 par défaut, et se désactive', async () => {
    expect(await getRpeDisciplineSettings()).toEqual({ enabled: true, ceiling: 8 });
    await setRpeDisciplineSettings({ enabled: false, ceiling: 7.5 });
    expect(await getRpeDisciplineSettings()).toEqual({ enabled: false, ceiling: 7.5 });
  });
});

describe('protocole disciplinaire RPE — déclenchement', () => {
  beforeEach(resetDb);

  it('laisse la séance libre avec un RPE exactement égal au plafond', async () => {
    const { workout, setIds } = await sessionWithSets();
    expect(await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 8 })).toBe('none');
    expect((await getRpeDisciplineState(workout.id)).status).toBe('clear');
    expect(await completeSet(setIds[1]!, { weight: 80, reps: 8 })).toBe('none');
  });

  it('enregistre la série au-dessus du plafond, puis verrouille', async () => {
    const { workout, setIds } = await sessionWithSets();
    expect(await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 })).toBe('triggered');

    const set = await db.workoutSets.get(setIds[0]!);
    expect(set).toMatchObject({ isCompleted: 1, rpe: 9, weight: 80, reps: 8 });
    expect(await getRpeDisciplineState(workout.id)).toMatchObject({
      status: 'locked',
      trigger: { setId: setIds[0], rpe: 9, ceiling: 8 },
    });
  });

  it('déclenche aussi par la bande d’effort, après la validation', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8 });
    expect(await updateSetValues(setIds[0]!, { rpe: 9.5 })).toBe('triggered');
    expect((await getRpeDisciplineState(workout.id)).status).toBe('locked');
  });

  it('ne fait rien sans RPE', async () => {
    const { workout, setIds } = await sessionWithSets();
    expect(await completeSet(setIds[0]!, { weight: 80, reps: 8 })).toBe('none');
    expect(await events(workout.id)).toEqual([]);
  });

  it('attend la validation : un RPE saisi sur une série non faite ne déclenche rien', async () => {
    const { workout, setIds } = await sessionWithSets();
    expect(await updateSetValues(setIds[0]!, { rpe: 10 })).toBe('none');
    expect((await getRpeDisciplineState(workout.id)).status).toBe('clear');
    // …et la coche, elle, constate.
    expect(await completeSet(setIds[0]!, { weight: 80, reps: 8 })).toBe('triggered');
  });

  it('ne déclenche qu’une fois par dépassement — l’annonce suit ce retour', async () => {
    const { workout, setIds } = await sessionWithSets();
    expect(await completeSet(setIds[0]!, { weight: 80, reps: 8 })).toBe('none');
    const first = updateSetValues(setIds[0]!, { rpe: 9 });
    const second = updateSetValues(setIds[0]!, { rpe: 9 });
    expect([await first, await second].filter((outcome) => outcome === 'triggered')).toHaveLength(
      1,
    );
    // Une seconde série au-dessus du plafond ne peut plus être validée, donc rien ne réannonce.
    expect((await events(workout.id)).filter((event) => event.kind === 'triggered')).toHaveLength(
      1,
    );
  });

  it('ne déclenche rien protocole désactivé', async () => {
    await setRpeDisciplineSettings({ enabled: false, ceiling: 8 });
    const { workout, setIds } = await sessionWithSets();
    expect(await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 10 })).toBe('none');
    expect(await completeSet(setIds[1]!, { weight: 80, reps: 8 })).toBe('none');
    expect(await events(workout.id)).toEqual([]);
  });

  it('ignore les échauffements', async () => {
    const { workout, setIds } = await sessionWithSets();
    await updateSetType(setIds[0]!, 'warmup');
    expect(await completeSet(setIds[0]!, { weight: 40, reps: 10, rpe: 9 })).toBe('none');
    expect((await getRpeDisciplineState(workout.id)).status).toBe('clear');
  });
});

describe('protocole disciplinaire RPE — verrou', () => {
  beforeEach(resetDb);

  it('refuse toute série supplémentaire, unilatérale comprise', async () => {
    const { setIds } = await sessionWithSets(3, 1);
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });
    await expect(completeSet(setIds[1]!, { weight: 80, reps: 8 })).rejects.toBeInstanceOf(
      RpeDisciplineLockedError,
    );
    await expect(completeFirstSide(setIds[2]!)).rejects.toBeInstanceOf(RpeDisciplineLockedError);
    expect((await db.workoutSets.get(setIds[1]!))?.isCompleted).toBe(0);
  });

  it('n’efface ni ne décoche ni ne retype une série enregistrée', async () => {
    const { setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });
    await expect(uncompleteSet(setIds[0]!)).rejects.toBeInstanceOf(RpeDisciplineLockedError);
    await expect(deleteSet(setIds[0]!)).rejects.toBeInstanceOf(RpeDisciplineLockedError);
    await expect(updateSetType(setIds[0]!, 'warmup')).rejects.toBeInstanceOf(
      RpeDisciplineLockedError,
    );
    expect(await db.workoutSets.get(setIds[0]!)).toMatchObject({
      isCompleted: 1,
      deletedAt: 0,
      setType: 'normal',
      rpe: 9,
    });
  });

  it('laisse terminer la séance proprement, sans toucher au RPE', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });
    await finishWorkout(workout.id);

    const stored = await db.workouts.get(workout.id);
    expect(stored?.status).toBe('completed');
    expect(stored?.rpeDiscipline?.[0]).toMatchObject({ kind: 'triggered', rpe: 9 });
    expect((await db.workoutSets.get(setIds[0]!))?.rpe).toBe(9);
    // Une séance close n'est plus verrouillée : l'historique se corrige librement.
    expect((await getRpeDisciplineState(workout.id)).status).toBe('clear');
  });

  it('survit à un redémarrage : le verrou se relit dans la base', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });

    db.close();
    await db.open();

    expect((await getRpeDisciplineState(workout.id)).status).toBe('locked');
    await expect(completeSet(setIds[1]!, { weight: 80, reps: 8 })).rejects.toBeInstanceOf(
      RpeDisciplineLockedError,
    );
  });

  it('se lève si le protocole est désactivé, sans rien effacer du journal', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });
    await setRpeDisciplineSettings({ enabled: false, ceiling: 8 });
    expect((await getRpeDisciplineState(workout.id)).status).toBe('clear');
    expect(await events(workout.id)).toHaveLength(1);
  });
});

describe('protocole disciplinaire RPE — correction d’une erreur de saisie', () => {
  beforeEach(resetDb);

  it('rouvre la séance et garde les deux valeurs', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });

    expect(await correctRpeDisciplineTrigger(workout.id, 7)).toBe('corrected');

    expect((await db.workoutSets.get(setIds[0]!))?.rpe).toBe(7);
    expect((await getRpeDisciplineState(workout.id)).status).toBe('clear');
    expect(await events(workout.id)).toMatchObject([
      { kind: 'triggered', rpe: 9 },
      { kind: 'corrected', previousRpe: 9, rpe: 7, ceiling: 8 },
    ]);
    expect(await completeSet(setIds[1]!, { weight: 80, reps: 8 })).toBe('none');
  });

  it('reste verrouillé si la valeur corrigée dépasse encore', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 10 });
    await correctRpeDisciplineTrigger(workout.id, 9);
    expect(await getRpeDisciplineState(workout.id)).toMatchObject({
      status: 'locked',
      trigger: { rpe: 9 },
    });
  });

  it('trace aussi une correction faite depuis la feuille de série', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });
    expect(await updateSetValues(setIds[0]!, { rpe: undefined })).toBe('corrected');
    expect((await events(workout.id)).at(-1)).toMatchObject({ kind: 'corrected', previousRpe: 9 });
    expect((await getRpeDisciplineState(workout.id)).status).toBe('clear');
  });

  it('reverrouille si la série corrigée repasse au-dessus du plafond', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });
    await correctRpeDisciplineTrigger(workout.id, 7);
    expect(await updateSetValues(setIds[0]!, { rpe: 9 })).toBe('triggered');
    expect((await getRpeDisciplineState(workout.id)).status).toBe('locked');
  });
});

describe('protocole disciplinaire RPE — déverrouillage exceptionnel', () => {
  beforeEach(resetDb);

  it('rouvre la séance et laisse une trace datée', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });

    expect(await overrideRpeDiscipline(workout.id, 1_234)).toBe(true);

    expect(await getRpeDisciplineState(workout.id)).toEqual({ status: 'clear', overrides: 1 });
    expect((await events(workout.id)).at(-1)).toEqual({
      kind: 'override',
      at: 1_234,
      setId: setIds[0],
      ceiling: 8,
    });
    expect((await db.workoutSets.get(setIds[0]!))?.rpe).toBe(9);
    expect(await completeSet(setIds[1]!, { weight: 80, reps: 8, rpe: 8 })).toBe('none');
  });

  it('ne déverrouille rien quand rien n’est verrouillé', async () => {
    const { workout } = await sessionWithSets();
    expect(await overrideRpeDiscipline(workout.id)).toBe(false);
    expect(await events(workout.id)).toEqual([]);
  });

  it('réactive le protocole au dépassement suivant, et l’annonce une nouvelle fois', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });
    await overrideRpeDiscipline(workout.id);
    expect(await completeSet(setIds[1]!, { weight: 80, reps: 8, rpe: 9.5 })).toBe('triggered');
    expect(await getRpeDisciplineState(workout.id)).toMatchObject({
      status: 'locked',
      trigger: { setId: setIds[1] },
      overrides: 1,
    });
  });
});

describe('protocole disciplinaire RPE — palier « Vous pouvez disposer »', () => {
  beforeEach(resetDb);

  const breaches = async () =>
    (await listMilestones()).filter((row) => row.definitionId === FIRST_RPE_BREACH_MILESTONE_ID);

  it('est accordé au premier dépassement, à célébrer, et une seule fois', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });
    expect(await breaches()).toMatchObject([{ acknowledgedAt: 0 }]);

    await overrideRpeDiscipline(workout.id);
    await completeSet(setIds[1]!, { weight: 80, reps: 8, rpe: 10 });
    expect(await breaches()).toHaveLength(1);
  });

  it('n’est pas accordé sans dépassement', async () => {
    const { setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 8 });
    expect(await breaches()).toEqual([]);
  });

  it('se rattrape au démarrage, acquitté, quand le journal le porte', async () => {
    const { workout, setIds } = await sessionWithSets();
    await completeSet(setIds[0]!, { weight: 80, reps: 8, rpe: 9 });
    await db.milestones.clear();

    await grantRpeBreachMilestoneIfEarned();
    const rows = await breaches();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.acknowledgedAt).toBeGreaterThan(0);
    expect(workout.id).toBeDefined();
  });
});

describe('protocole disciplinaire RPE — compatibilité avec le coach', () => {
  beforeEach(resetDb);

  /**
   * Une séance qui atteint le haut de sa fourchette (8 – 12 à 12) : le coach a de quoi proposer
   * une hausse, et c'est son seuil de 8,5 — pas le plafond de séance — qui en décide.
   */
  async function coachSignalsFor(enabled: boolean, rpes: readonly number[]) {
    await resetDb();
    await setRpeDisciplineSettings({ enabled, ceiling: 8 });
    const { workout, setIds } = await sessionWithSets(rpes.length);
    for (const id of setIds) await db.workoutSets.update(id, { targetReps: 8, targetRepsMax: 12 });
    for (const [index, rpe] of rpes.entries()) {
      const outcome = await completeSet(setIds[index]!, { weight: 100, reps: 12, rpe });
      if (outcome === 'triggered') await overrideRpeDiscipline(workout.id);
    }
    await finishWorkout(workout.id);
    const signals = await evaluateCoachForWorkout(workout.id);
    return signals.map(({ code, nextLoadKg, evidence }) => ({ code, nextLoadKg, evidence }));
  }

  it('propose la hausse à RPE 8 : le plafond de séance ne touche pas au seuil de 8,5', async () => {
    const withProtocol = await coachSignalsFor(true, [8, 8, 8]);
    expect(withProtocol).toEqual([
      expect.objectContaining({ code: 'range_ceiling_reached', nextLoadKg: expect.any(Number) }),
    ]);
    expect(await coachSignalsFor(false, [8, 8, 8])).toEqual(withProtocol);
  });

  it('lit les mêmes RPE et propose la même chose après un dépassement, protocole actif ou non', async () => {
    const withProtocol = await coachSignalsFor(true, [8, 9, 9]);
    expect(withProtocol.length).toBeGreaterThan(0);
    expect(await coachSignalsFor(false, [8, 9, 9])).toEqual(withProtocol);
  });
});

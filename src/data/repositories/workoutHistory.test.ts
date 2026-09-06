import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/resetDb';
import { createCustomExercise, updateExercise } from './exercises';
import { addWorkoutExercise } from './workoutExercises';
import { finishWorkout, startWorkout } from './workoutLifecycle';
import { completeSet } from './workoutSets';
import { getWorkoutDetail } from './workoutDetail';
import { applyWorkoutDeload } from './workoutDeload';

/**
 * « La dernière fois » ne traverse pas un changement de mesure.
 *
 * La référence est appariée par rang, et rien ne disait jusqu'ici que les deux
 * séances mesuraient la même chose. Sur une traction assistée passée en
 * répétitions seules, les 30 kg d'**assistance** de la séance précédente
 * revenaient comme charge **ajoutée** proposée pour aujourd'hui — un nombre
 * validable d'un doigt, et l'inverse exact de ce qu'il voulait dire. La
 * décharge lisait la même source et proposait de l'alléger.
 *
 * `getLastPerformance` reçoit donc le type de mesure de la ligne courante et
 * refuse une référence qui ne le partage pas : mieux vaut pas de référence
 * qu'une référence retournée.
 */
describe('référence de la dernière séance', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('ne propose pas une assistance comme charge ajoutée après un changement de mesure', async () => {
    const exercise = await createCustomExercise({
      name: 'Tractions',
      primaryMuscle: 'lats',
      secondaryMuscles: [],
      equipment: 'machine',
      measurementType: 'assisted_weight_reps',
      isUnilateral: 0,
      bodyweightLoadFactor: 1,
    });

    const past = await startWorkout('', 'Assistée');
    await addWorkoutExercise(past.id, exercise.id);
    const pastDetail = (await getWorkoutDetail(past.id))!;
    await completeSet(pastDetail.exercises[0]!.sets[0]!.id, { weight: 30, reps: 10 });
    await finishWorkout(past.id);

    await updateExercise(exercise.id, { measurementType: 'reps_only' });

    const current = await startWorkout('', 'Ajoutée');
    await addWorkoutExercise(current.id, exercise.id);
    const line = (await getWorkoutDetail(current.id))!.exercises[0]!;

    expect(line.identity?.measurementType).toBe('reps_only');
    expect(line.previous).toEqual([]);
    expect(line.sets[0]?.targetWeight).toBeUndefined();
    // Sans charge à alléger, la décharge n'a pas d'objet — et surtout, elle ne
    // va pas la chercher dans une référence incompatible.
    expect(await applyWorkoutDeload(current.id, 'Deload')).toBeNull();
  });

  it('ne rouvre pas la référence quand la bibliothèque rechange en cours de séance', async () => {
    // L'instantané de la ligne gèle la mesure au moment où l'exercice est
    // ajouté : la séance en cours reste lisible telle qu'elle a été commencée.
    const exercise = await createCustomExercise({
      name: 'Tractions',
      primaryMuscle: 'lats',
      secondaryMuscles: [],
      equipment: 'machine',
      measurementType: 'assisted_weight_reps',
      isUnilateral: 0,
      bodyweightLoadFactor: 1,
    });

    const past = await startWorkout('', 'Assistée');
    await addWorkoutExercise(past.id, exercise.id);
    const pastDetail = (await getWorkoutDetail(past.id))!;
    await completeSet(pastDetail.exercises[0]!.sets[0]!.id, { weight: 30, reps: 10 });
    await finishWorkout(past.id);

    await updateExercise(exercise.id, { measurementType: 'reps_only' });
    const current = await startWorkout('', 'Ajoutée');
    await addWorkoutExercise(current.id, exercise.id);

    await updateExercise(exercise.id, { measurementType: 'assisted_weight_reps' });

    expect((await getWorkoutDetail(current.id))!.exercises[0]!.previous).toEqual([]);
  });
});

import { BACKUP_TABLES, type BackupRow, type BackupTable } from '@/lib/backup';

/**
 * Un compte minuscule mais **complet**, en lignes de sauvegarde.
 *
 * La validation d'un fichier de sauvegarde ne se teste qu'en abîmant un point à
 * la fois : sans un décor entièrement valide au départ, un refus ne prouve rien
 * — il peut venir d'un champ oublié dans la fixture plutôt que de ce qu'on
 * voulait casser. Les lignes sont écrites à la main, et non produites par les
 * dépôts, pour que le test dise lui-même ce qu'il tient pour valide.
 */
const STAMPS = { createdAt: 1, updatedAt: 1, deletedAt: 0 };

export function backupAccountTables(): Record<BackupTable, BackupRow[]> {
  const empty = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, [] as BackupRow[]]),
  ) as unknown as Record<BackupTable, BackupRow[]>;

  return {
    ...empty,
    exercises: [
      {
        id: 'ex-1',
        ...STAMPS,
        name: 'Développé couché',
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps'],
        equipment: 'barbell',
        measurementType: 'weight_reps',
        isCustom: 1,
        isUnilateral: 0,
      },
    ],
    routines: [{ id: 'r-1', ...STAMPS, name: 'Poussée', folderId: '', order: 0 }],
    routineExercises: [
      {
        id: 're-1',
        ...STAMPS,
        routineId: 'r-1',
        exerciseId: 'ex-1',
        order: 0,
        supersetGroup: 0,
        restSeconds: 120,
      },
    ],
    routineSets: [
      { id: 'rs-1', ...STAMPS, routineExerciseId: 're-1', order: 0, setType: 'normal' },
    ],
    workouts: [
      {
        id: 'w-1',
        ...STAMPS,
        routineId: 'r-1',
        name: 'Poussée',
        status: 'completed',
        startedAt: 1_700_000_000_000,
        endedAt: 1_700_000_600_000,
        durationSeconds: 600,
      },
    ],
    workoutExercises: [
      {
        id: 'we-1',
        ...STAMPS,
        workoutId: 'w-1',
        exerciseId: 'ex-1',
        order: 0,
        supersetGroup: 0,
        restSeconds: 120,
      },
    ],
    workoutSets: [
      {
        id: 'ws-1',
        ...STAMPS,
        workoutExerciseId: 'we-1',
        exerciseId: 'ex-1',
        workoutId: 'w-1',
        order: 0,
        setType: 'normal',
        side: 'both',
        isCompleted: 1,
        performedAt: 1_700_000_300_000,
        weight: 80,
        reps: 8,
      },
    ],
    personalRecords: [
      {
        id: 'pr-1',
        ...STAMPS,
        exerciseId: 'ex-1',
        type: 'max_weight',
        value: 80,
        achievedAt: 1_700_000_300_000,
        workoutId: 'w-1',
      },
    ],
    settings: [{ key: 'oneRepMaxFormula', value: 'brzycki', updatedAt: 1 }],
  };
}

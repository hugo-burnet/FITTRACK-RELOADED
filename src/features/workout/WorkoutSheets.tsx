import type { Dispatch, SetStateAction } from 'react';
import { setDefaultRepSeconds, setAvailablePlateWeightsKg } from '@/data/repositories/settings';
import { updateExercise } from '@/data/repositories/exercises';
import {
  applyWorkoutDeload,
  deleteSet,
  duplicateLastSet,
  insertWarmupSets,
  removeWorkoutExercise,
  updateSetType,
  updateSetValues,
  updateWorkout,
  updateWorkoutExercise,
} from '@/data/repositories/workouts';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { SET_TYPES } from '@/data/types';
import type { PlateLoading, Workout } from '@/data/types';
import { t } from '@/i18n/fr';
import { setTypeHint, setTypeLabel } from '@/i18n/labels';
import { formatNumber } from '@/ui/numberField';
import { DEFAULT_PLATES_KG } from '@/lib/plates';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRepPacer } from '@/stores/repPacer';
import { ActionSheet, ConfirmSheet, Input, OptionSheet, Sheet, Textarea } from '@/ui';
import { DeloadSheet } from './DeloadSheet';
import { ExerciseNotesSheet } from './ExerciseNotesSheet';
import { PaceSheet } from './PaceSheet';
import { PlateLoadSheet } from './PlateLoadSheet';
import { WarmupSheet } from './WarmupSheet';
import { warmupContextFor } from './warmupContext';
import { WorkoutRpeField } from './WorkoutRpeField';
import type { useWorkoutPace } from './useWorkoutPace';
import {
  workoutExerciseNameOf,
  workoutLineOf,
  workoutSetOf,
  workoutSetTypeOf,
} from './workoutLookups';

/**
 * Laquelle des douze feuilles est ouverte, et sur quoi.
 *
 * **L'identifiant voyage dans l'état, jamais l'objet.** Une feuille survit à la
 * ligne qui l'a ouverte, le temps de son animation de fermeture ; garder la
 * ligne elle-même ferait afficher pendant ces 200 ms un exercice que la base
 * n'a plus. Les recherches de `workoutLookups` rendent donc toutes un repli.
 */
export type SheetState =
  | { kind: 'workout' }
  | { kind: 'deload' }
  | { kind: 'rename' }
  | { kind: 'notes' }
  | { kind: 'exercise'; rowId: string; openedAt: number }
  | { kind: 'pace'; rowId: string }
  | { kind: 'exerciseNotes'; rowId: string }
  | { kind: 'removeExercise'; rowId: string }
  | { kind: 'warmup'; rowId: string }
  | { kind: 'set'; setId: string; number: number }
  | { kind: 'setType'; setId: string; number: number }
  | { kind: 'plates' };

const SET_TYPE_OPTIONS = SET_TYPES.map((value) => ({
  value,
  label: setTypeLabel(value),
  hint: setTypeHint(value),
}));

/** Plate data must survive the menu's closing animation. */
export type PlatesView = {
  rowId: string;
  exerciseId: string;
  loads: number[];
  barWeight: number;
  sides: number;
  loading: Exclude<PlateLoading, 'none'>;
};

export type WorkoutSheetsProps = {
  sheet: SheetState | null;
  setSheet: Dispatch<SetStateAction<SheetState | null>>;
  workout: Workout;
  exercises: readonly WorkoutExerciseDetail[];
  draft: { id: string; name: string; notes: string };
  setDraft: Dispatch<SetStateAction<{ id: string; name: string; notes: string } | null>>;
  pace: ReturnType<typeof useWorkoutPace>;
  platesView: PlatesView | null;
  setPlatesView: Dispatch<SetStateAction<PlatesView | null>>;
  availablePlateWeightsKg: number[] | undefined;
};

/**
 * Toute la surface secondaire de l'écran de séance — douze feuilles, aucune
 * visible par défaut.
 *
 * **Un seul composant pour les douze, et non un par famille.** Elles partagent
 * un unique état `sheet` qui n'en laisse ouvrir qu'une à la fois, et elles se
 * renvoient la main : le menu d'un exercice ouvre la cadence, l'échauffement,
 * les notes ou la suppression. Les répartir en trois composants aurait obligé à
 * faire remonter `setSheet` et redescendre le même état dans chacun, pour la
 * seule satisfaction de compter moins de lignes par fichier.
 *
 * Ce qu'on y gagne en revanche est réel : `WorkoutScreen` ne garde que la
 * séance elle-même — ses données, ses minuteurs, ses cartes — et cesse de mêler
 * l'écran qu'on regarde entre deux séries aux douze feuilles qu'on ouvre une
 * fois chacune.
 *
 * Le tutoriel est lu ici plutôt que reçu en propriété : c'est un contexte, et le
 * faire traverser l'écran n'aurait rien dit de plus.
 */
export function WorkoutSheets({
  sheet,
  setSheet,
  workout,
  exercises,
  draft,
  setDraft,
  pace,
  platesView,
  setPlatesView,
  availablePlateWeightsKg,
}: WorkoutSheetsProps) {
  const tutorial = useTutorialControls();

  const lineOf = (rowId: string) => workoutLineOf(exercises, rowId);
  const nameOf = (rowId: string) => workoutExerciseNameOf(exercises, rowId);
  const setOf = (setId: string) => workoutSetOf(exercises, setId);
  const typeOf = (setId: string) => workoutSetTypeOf(exercises, setId);

  const warmupContextOf = (rowId: string) => {
    const line = lineOf(rowId);
    return line === null ? null : warmupContextFor(line);
  };

  const warmupLine = sheet?.kind === 'warmup' ? lineOf(sheet.rowId) : null;
  const warmupContext = warmupLine === null ? null : warmupContextFor(warmupLine);

  const paceSheetLine = sheet?.kind === 'pace' ? lineOf(sheet.rowId) : null;

  return (
    <>
      <ActionSheet
        open={sheet?.kind === 'workout'}
        onClose={() => setSheet(null)}
        title={t('workout.workoutMenu')}
        actions={[
          { label: t('workout.rename'), onSelect: () => setSheet({ kind: 'rename' }) },
          { label: t('workout.workoutNotesLabel'), onSelect: () => setSheet({ kind: 'notes' }) },
        ]}
      />

      <DeloadSheet
        open={sheet?.kind === 'deload'}
        onClose={() => setSheet(null)}
        onApply={async () => {
          const updated = await applyWorkoutDeload(workout.id, t('workout.deloadNote'));
          if (updated !== null) {
            setDraft({ id: updated.id, name: updated.name, notes: updated.notes ?? '' });
          }
        }}
      />

      <Sheet
        open={sheet?.kind === 'rename'}
        onClose={() => setSheet(null)}
        title={t('workout.rename')}
      >
        <Input
          label={t('workout.nameLabel')}
          value={draft.name}
          enterKeyHint="done"
          onChange={(event) => {
            setDraft({ ...draft, name: event.target.value });
            void updateWorkout(workout.id, { name: event.target.value });
          }}
        />
      </Sheet>

      <Sheet
        open={sheet?.kind === 'notes'}
        onClose={() => setSheet(null)}
        title={t('workout.workoutNotesLabel')}
      >
        <Textarea
          label={t('workout.workoutNotesLabel')}
          value={draft.notes}
          onChange={(event) => {
            setDraft({ ...draft, notes: event.target.value });
            void updateWorkout(workout.id, { notes: event.target.value });
          }}
        />
      </Sheet>

      <ActionSheet
        open={sheet?.kind === 'exercise'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'exercise' ? nameOf(sheet.rowId) : ''}
        actions={[
          {
            label: t('workout.paceTitle'),
            // The tempo in force, so the entry says what it is about to open
            // rather than making you open it to find out.
            hint:
              sheet?.kind === 'exercise' && lineOf(sheet.rowId) !== null
                ? t('workout.paceMenuHint', {
                    tempo: formatNumber(pace.repSecondsOf(lineOf(sheet.rowId)!)),
                  })
                : undefined,
            onSelect: () => {
              if (sheet?.kind !== 'exercise') return;
              setSheet({ kind: 'pace', rowId: sheet.rowId });
              tutorial?.report({ type: 'pace-sheet-opened', rowId: sheet.rowId });
            },
          },
          {
            label: t('workout.addSetAction'),
            onSelect: () => {
              if (sheet?.kind === 'exercise') void duplicateLastSet(sheet.rowId);
            },
          },
          ...(sheet?.kind === 'exercise' && warmupContextOf(sheet.rowId) !== null
            ? [
                {
                  label: t('workout.warmupAction'),
                  tutorialId: 'workout-warmup',
                  onSelect: () => {
                    if (sheet?.kind !== 'exercise') return;
                    setSheet({ kind: 'warmup', rowId: sheet.rowId });
                    tutorial?.report({ type: 'warmup-sheet-opened', rowId: sheet.rowId });
                  },
                },
              ]
            : []),
          {
            label: t('workout.notesLabel'),
            onSelect: () => {
              if (sheet?.kind === 'exercise')
                setSheet({ kind: 'exerciseNotes', rowId: sheet.rowId });
            },
          },
          {
            label: t('workout.removeExercise'),
            danger: true,
            onSelect: () => {
              if (sheet?.kind === 'exercise')
                setSheet({ kind: 'removeExercise', rowId: sheet.rowId });
            },
          },
        ]}
      />

      <WarmupSheet
        open={sheet?.kind === 'warmup' && warmupContext !== null}
        onClose={() => setSheet(null)}
        initialTargetWeightKg={warmupContext?.targetWeightKg}
        minimumWeightKg={warmupContext?.minimumWeightKg ?? 0}
        onInsert={async (suggestions) => {
          if (sheet?.kind !== 'warmup') return;
          const rowId = sheet.rowId;
          await insertWarmupSets(rowId, suggestions);
          // Après l'écriture, et avec le compte : une feuille vidée de ses
          // étapes insère zéro série, ce qui n'est pas insérer.
          tutorial?.report({ type: 'warmup-inserted', rowId, count: suggestions.length });
        }}
      />

      <ExerciseNotesSheet
        open={sheet?.kind === 'exerciseNotes'}
        onClose={() => setSheet(null)}
        line={sheet?.kind === 'exerciseNotes' ? lineOf(sheet.rowId) : null}
      />

      <ConfirmSheet
        open={sheet?.kind === 'removeExercise'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'removeExercise' ? nameOf(sheet.rowId) : ''}
        body={t('workout.removeExerciseConfirm')}
        confirmLabel={t('workout.removeExercise')}
        danger
        onConfirm={() => {
          if (sheet?.kind === 'removeExercise') void removeWorkoutExercise(sheet.rowId);
        }}
      />

      <ActionSheet
        open={sheet?.kind === 'set'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'set' ? t('workout.setNumber', { number: sheet.number }) : ''}
        actions={[
          {
            label: t('workout.setTypeAction'),
            tutorialId: 'workout-set-type',
            // The current type, so the entry says what it is about to change
            // rather than making you open the sheet to find out.
            hint: sheet?.kind === 'set' ? setTypeLabel(typeOf(sheet.setId)) : undefined,
            onSelect: () => {
              if (sheet?.kind === 'set') {
                setSheet({ kind: 'setType', setId: sheet.setId, number: sheet.number });
              }
            },
          },
          {
            label: t('workout.deleteSet'),
            danger: true,
            onSelect: () => {
              if (sheet?.kind === 'set') void deleteSet(sheet.setId);
            },
          },
        ]}
      >
        {sheet?.kind === 'set' && (
          <WorkoutRpeField
            value={setOf(sheet.setId)?.rpe}
            targetValue={setOf(sheet.setId)?.targetRpe}
            onChange={(rpe) => void updateSetValues(sheet.setId, { rpe })}
          />
        )}
      </ActionSheet>

      <OptionSheet
        open={sheet?.kind === 'setType'}
        onClose={() => setSheet(null)}
        title={t('workout.setTypeAction')}
        options={SET_TYPE_OPTIONS}
        value={sheet?.kind === 'setType' ? typeOf(sheet.setId) : 'normal'}
        onSelect={(setType) => {
          if (sheet?.kind !== 'setType') return;
          const setId = sheet.setId;
          void updateSetType(setId, setType)
            .then(() => tutorial?.report({ type: 'workout-set-type-updated', setId, setType }))
            .catch(() => undefined);
        }}
      />

      <PaceSheet
        open={sheet?.kind === 'pace'}
        onClose={() => setSheet(null)}
        view={pace.viewFor(
          paceSheetLine,
          paceSheetLine === null ? '' : nameOf(paceSheetLine.row.id),
        )}
        onChange={(repSeconds) => {
          if (sheet?.kind === 'pace') void updateWorkoutExercise(sheet.rowId, { repSeconds });
        }}
        onSetDefault={(repSeconds) => void setDefaultRepSeconds(repSeconds)}
        onStart={() => {
          if (paceSheetLine === null) return;
          if (!pace.startFor(paceSheetLine)) return;
          // L'horloge qui vient de partir dit laquelle des deux c'était : le
          // maintien mesure la série, la cadence la rythme, et deux missions
          // différentes les apprennent.
          const startedHold = useHoldTimer.getState().setId;
          const startedPace = useRepPacer.getState().setId;
          if (startedHold !== null) tutorial?.report({ type: 'hold-started', setId: startedHold });
          else if (startedPace !== null) {
            tutorial?.report({ type: 'pace-started', setId: startedPace });
          }
        }}
        onStop={() => {
          const stopping = useRepPacer.getState().setId;
          pace.stop();
          tutorial?.report({ type: 'pace-stopped', setId: stopping });
        }}
      />

      <PlateLoadSheet
        open={sheet?.kind === 'plates'}
        onClose={() => setSheet(null)}
        loads={platesView?.loads ?? []}
        barWeight={platesView?.barWeight ?? 20}
        sides={platesView?.sides ?? 2}
        loading={platesView?.loading ?? 'barbell'}
        availablePlateWeightsKg={availablePlateWeightsKg ?? [...DEFAULT_PLATES_KG]}
        onAvailablePlateWeightsChange={async (weights) => {
          await setAvailablePlateWeightsKg(weights);
          tutorial?.report({ type: 'plate-availability-changed', count: weights.length });
        }}
        onBarWeightChange={(barWeight) => {
          if (platesView === null) return;
          // Shown immediately, written to the exercise straight after: the
          // diagram must not wait for a round trip through Dexie, and the
          // figure must not die with the sheet the way it used to.
          setPlatesView({ ...platesView, barWeight });
          void updateExercise(platesView.exerciseId, { plateBaseWeightKg: barWeight });
        }}
      />
    </>
  );
}

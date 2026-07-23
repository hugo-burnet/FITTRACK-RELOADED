import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { deleteExercise, getExercise, updateExercise } from '@/data/repositories/exercises';
import { listSessionsForExercise } from '@/data/repositories/workoutHistory';
import type { WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { exerciseSubtitle } from '@/i18n/labels';
import { bestSets, isWorkingSet } from '@/lib/records';
import { DEFAULT_REST_SECONDS } from '@/lib/rest';
import {
  ActionBand,
  Card,
  ConfirmAction,
  ListRow,
  RestPicker,
  SectionTitle,
  Textarea,
} from '@/ui';

/** "8 janvier 2026" — long month, because a history is read, not scanned for keys. */
const longDate = (epochMs: number): string =>
  new Date(epochMs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const decimal = (value: number): string => value.toLocaleString('fr-FR');

/**
 * The best set of a run, in one line. Falls back from load to repetitions, so a
 * pull-up reads "14 reps" instead of a blank — all six measurement types are
 * covered without naming any of them.
 */
function topSetLabel(sets: WorkoutSet[]): string | undefined {
  const { heaviest, mostReps } = bestSets(sets);

  if (heaviest?.weight !== undefined) {
    return heaviest.reps === undefined
      ? t('exercise.recordWeight', { weight: decimal(heaviest.weight) })
      : t('exercise.recordWeightReps', {
          weight: decimal(heaviest.weight),
          reps: heaviest.reps,
        });
  }

  if (mostReps?.reps !== undefined) return t('exercise.recordReps', { reps: mostReps.reps });
  return undefined;
}

/** Engraved label, tabular figure — the readout shape of the diagnostic screen. */
function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] p-4 last:border-b-0">
      <span className="label-xs font-semibold text-[var(--text-2)]">{label}</span>
      <span className="metric text-2xl leading-none font-semibold text-[var(--text-1)]">
        {value}
      </span>
    </div>
  );
}

export function ExerciseDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  // `null` is "gone", `undefined` is "not answered yet" — without the
  // distinction a freshly opened screen flashes "cet exercice n'existe plus".
  const exercise = useLiveQuery(async () => (await getExercise(id)) ?? null, [id]);
  const sessions = useLiveQuery(() => listSessionsForExercise(id), [id]);

  /**
   * Notes and rest are typed here and written straight through to the database,
   * so the draft only exists to keep `useLiveQuery` from echoing each write back
   * into the field and moving the caret. Keyed on the exercise id so walking
   * from one exercise to another re-reads.
   */
  const [draft, setDraft] = useState<{ id: string; notes: string; rest?: number } | null>(null);
  if (exercise != null && draft?.id !== exercise.id) {
    setDraft({
      id: exercise.id,
      notes: exercise.userNotes ?? '',
      rest: exercise.defaultRestSeconds,
    });
  }

  /**
   * Back to wherever you came from, so a search or a filter survives the trip.
   *
   * The test is React Router's own history index, not `location.key`: creating
   * an exercise lands here through a `replace`, which mints a fresh key while
   * leaving the index at 0 — so the key says "you can go back" and `navigate(-1)`
   * silently does nothing. Measured, on the very flow the user reported.
   */
  const goBack = () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate('/exercises');
  };

  if (exercise === null) {
    return (
      <Screen title={t('exercise.notFound')} onBack={goBack}>
        <span />
      </Screen>
    );
  }

  if (exercise === undefined || draft === null || sessions === undefined) {
    return (
      <Screen title="" onBack={goBack}>
        <span />
      </Screen>
    );
  }

  const allSets = sessions.flatMap((session) => session.sets);
  const { heaviest, mostReps, bestVolume } = bestSets(allSets);
  // Repetitions are only a record where there is no load to beat: on a bench
  // press the rep maximum is a light set, and reading it as a record is a lie.
  const showReps = heaviest === undefined && mostReps !== undefined;
  const showVolume = bestVolume !== undefined && bestVolume.id !== heaviest?.id;

  const writeNotes = (notes: string) => {
    setDraft({ ...draft, notes });
    void updateExercise(exercise.id, { userNotes: notes });
  };

  const writeRest = (rest: number | undefined) => {
    setDraft({ ...draft, rest });
    void updateExercise(exercise.id, { defaultRestSeconds: rest });
  };

  return (
    <Screen
      title={exercise.name}
      onBack={goBack}
      /* Le seul « Terminé » qui reste, et il a un travail : au Lot 3 cette fiche
         n'avait aucune sortie et c'est le défaut que l'utilisateur a remonté.
         Sur l'éditeur de routine il n'en avait pas, il doublait la flèche. */
      footer={<ActionBand label={t('exercise.done')} onClick={goBack} />}
    >
      <div className="flex flex-col gap-9">
        <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-[var(--text-2)]">
          {exerciseSubtitle(exercise)}
          {exercise.isUnilateral === 1 && (
            <span className="label-xs font-semibold text-[var(--text-2)]">
              {t('exercises.unilateral')}
            </span>
          )}
          {exercise.isCustom === 1 && (
            <span className="label-xs font-semibold text-[var(--accent-ink)]">
              {t('exercises.custom')}
            </span>
          )}
        </p>

        {/* No records section at all rather than a column of em-dashes: an
            exercise you have never done has nothing to report. */}
        {heaviest !== undefined || showReps ? (
          <section>
            <SectionTitle>{t('exercise.recordsSection')}</SectionTitle>
            <Card>
              {heaviest !== undefined && (
                <Reading label={t('exercise.recordHeaviest')} value={topSetLabel([heaviest])!} />
              )}
              {showReps && (
                <Reading
                  label={t('exercise.recordMostReps')}
                  value={t('exercise.recordReps', { reps: mostReps.reps! })}
                />
              )}
              {showVolume && (
                <Reading
                  label={t('exercise.recordBestVolume')}
                  value={topSetLabel([bestVolume])!}
                />
              )}
            </Card>
          </section>
        ) : null}

        <section>
          <SectionTitle>{t('exercise.historySection')}</SectionTitle>
          <Card>
            {sessions.length === 0 ? (
              <p className="p-4 text-sm leading-relaxed text-[var(--text-2)]">
                {t('exercise.historyEmpty')}
              </p>
            ) : (
              sessions.map((session) => {
                // Working sets only, so this number and the figure beside it
                // describe the same sets.
                const count = session.sets.filter(isWorkingSet).length;
                return (
                  <ListRow
                    key={session.workoutExerciseId}
                    title={longDate(session.performedAt)}
                    subtitle={
                      count === 1
                        ? t('exercise.historySetCountOne')
                        : t('exercise.historySetCount', { count })
                    }
                    trailing={
                      // Tabular and right-aligned, so progress reads straight
                      // down the column instead of set by set.
                      <span className="metric text-base font-semibold text-[var(--text-1)]">
                        {topSetLabel(session.sets)}
                      </span>
                    }
                  />
                );
              })
            )}
          </Card>
        </section>

        <section>
          <SectionTitle>{t('exercise.yoursSection')}</SectionTitle>
          <Card padded>
            <Textarea
              label={t('exercise.notesLabel')}
              hint={t('exercise.notesHint')}
              placeholder={t('exercise.notesPlaceholder')}
              value={draft.notes}
              onChange={(event) => writeNotes(event.target.value)}
            />

            <div className="mt-6">
              <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
                {t('exercise.restLabel')}
              </p>
              <RestPicker
                value={draft.rest}
                onChange={writeRest}
                baseWhenEmpty={DEFAULT_REST_SECONDS}
                emptyReading={t('rest.none')}
                clearLabel={t('rest.none')}
                aria-label={t('exercise.restLabel')}
              />
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
                {t('exercise.restHint')}
              </p>
            </div>
          </Card>
        </section>

        {exercise.isCustom === 1 ? (
          <Card>
            <ListRow
              title={t('exercise.edit')}
              onClick={() => void navigate(`/exercises/${exercise.id}/edit`)}
            />
            <ConfirmAction
              label={t('exercise.delete')}
              hint={t('exercise.deleteHint')}
              confirmLabel={t('exercise.deleteConfirm')}
              danger
              onConfirm={() => {
                void deleteExercise(exercise.id).then(() => navigate('/exercises'));
              }}
            />
          </Card>
        ) : (
          <p className="px-1 text-sm leading-relaxed text-[var(--text-2)]">
            {t('exercise.catalogueNote')}
          </p>
        )}

      </div>
    </Screen>
  );
}

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { listRecommendationsForExercise } from '@/data/repositories/coachRecommendations';
import { deleteExercise, getExercise, updateExercise } from '@/data/repositories/exercises';
import { listCurrentRecordsForExercise } from '@/data/repositories/personalRecords';
import { listSessionsForExercise } from '@/data/repositories/workoutHistory';
import type { CoachRecommendation, WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { exerciseSubtitle, recordContext, recordLabel, recordValue } from '@/i18n/labels';
import { defaultLoadIncrementKg } from '@/lib/loadIncrement';
import { isWorkingSet } from '@/lib/records';
import { DEFAULT_REST_SECONDS } from '@/lib/rest';
import {
  ActionBand,
  Card,
  ConfirmAction,
  ListRow,
  NumberInput,
  RestPicker,
  SectionTitle,
  Textarea,
} from '@/ui';
import { hasDrawableMuscles } from '@/ui/muscleMap';
import { ChevronRightIcon } from '@/ui/icons';
import { CoachCard } from '@/features/workout/CoachCard';
import { recommendationAsSignal } from '@/features/workout/coachCopy';
import { ExerciseDocumentationView } from './ExerciseDocumentationView';
import { ExerciseLoadCard } from './ExerciseLoadCard';
import { ExerciseMusclesCard } from './ExerciseMusclesCard';

/** "8 janvier 2026" — long month, because a history is read, not scanned for keys. */
const longDate = (epochMs: number): string =>
  new Date(epochMs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const decimal = (value: number): string => value.toLocaleString('fr-FR');

function coachStatusLabel(status: CoachRecommendation['status']): string {
  switch (status) {
    case 'pending':
      return t('coach.statusPending');
    case 'followed':
      return t('coach.statusFollowed');
    case 'dismissed':
      return t('coach.statusDismissed');
    case 'superseded':
      return t('coach.statusSuperseded');
  }
}

/**
 * The best set of a run, in one line. Falls back from load to repetitions, so a
 * pull-up reads "14 reps" instead of a blank — all six measurement types are
 * covered without naming any of them.
 */
function topSetLabel(sets: WorkoutSet[]): string | undefined {
  const workingSets = sets.filter(isWorkingSet);
  const heaviest = workingSets.reduce<WorkoutSet | undefined>((best, candidate) => {
    if (candidate.weight === undefined || candidate.weight <= 0) return best;
    return best === undefined || candidate.weight > best.weight! ? candidate : best;
  }, undefined);
  const mostReps = workingSets.reduce<WorkoutSet | undefined>((best, candidate) => {
    if (candidate.reps === undefined || candidate.reps <= 0) return best;
    return best === undefined || candidate.reps > best.reps! ? candidate : best;
  }, undefined);

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
function Reading({ label, value, context }: { label: string; value: string; context?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-4 last:border-b-0">
      <span className="label-xs font-semibold text-[var(--text-2)]">{label}</span>
      <span className="min-w-0 text-right">
        <span className="metric block text-2xl leading-none font-semibold text-[var(--text-1)]">
          {value}
        </span>
        {context && (
          <span className="mt-1.5 block text-sm leading-snug text-[var(--text-2)]">{context}</span>
        )}
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
  const records = useLiveQuery(() => listCurrentRecordsForExercise(id), [id]);
  const coachHistory = useLiveQuery(() => listRecommendationsForExercise(id), [id]);

  /**
   * Notes, rest and load increment are typed here and written straight through
   * to the database, so the draft only exists to keep `useLiveQuery` from
   * echoing each write back into the field and moving the caret. Keyed on the
   * exercise id so walking from one exercise to another re-reads.
   */
  /**
   * Suivi ou Documentation. La vue est éphémère : revenir sur une fiche part
   * toujours du Suivi, parce que c'est ce qu'on ouvre pendant une séance.
   */
  const [view, setView] = useState<'tracking' | 'documentation'>('tracking');

  const [draft, setDraft] = useState<{
    id: string;
    notes: string;
    rest?: number;
    loadIncrementKg?: number;
  } | null>(null);
  if (exercise != null && draft?.id !== exercise.id) {
    setDraft({
      id: exercise.id,
      notes: exercise.userNotes ?? '',
      rest: exercise.defaultRestSeconds,
      loadIncrementKg: exercise.loadIncrementKg,
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

  if (exercise === undefined || draft === null) {
    return (
      <Screen title="" onBack={goBack}>
        <span />
      </Screen>
    );
  }

  const writeNotes = (notes: string) => {
    setDraft({ ...draft, notes });
    void updateExercise(exercise.id, { userNotes: notes });
  };

  const writeRest = (rest: number | undefined) => {
    setDraft({ ...draft, rest });
    void updateExercise(exercise.id, { defaultRestSeconds: rest });
  };

  const writeLoadIncrement = (loadIncrementKg: number | undefined) => {
    setDraft({ ...draft, loadIncrementKg });
    void updateExercise(exercise.id, { loadIncrementKg });
  };

  const equipmentDefaultIncrement = defaultLoadIncrementKg(exercise.equipment);
  const loadIncrementHint =
    exercise.measurementType === 'assisted_weight_reps'
      ? t('exercise.loadIncrementAssistHint', {
          value: equipmentDefaultIncrement.toLocaleString('fr-FR'),
        })
      : t('exercise.loadIncrementHint', {
          value: equipmentDefaultIncrement.toLocaleString('fr-FR'),
        });

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

        {/* Deux vues nommées, pas un accordéon : « Suivi » est ce qu'on ouvre en
            salle, « Documentation » ce qu'on lit à froid. Les mélanger sur un
            seul écran ferait descendre les records sous quinze paragraphes. */}
        <div role="tablist" aria-label={t('exercise.viewsLabel')} className="flex gap-1
          rounded-xl bg-[var(--surface-2)] p-1">
          {(['tracking', 'documentation'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={`min-h-12 flex-1 rounded-lg text-base font-semibold
                transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                ${
                  view === value
                    ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                    : 'text-[var(--text-2)]'
                }`}
            >
              {value === 'tracking'
                ? t('exerciseDoc.tabTracking')
                : t('exerciseDoc.tabDocumentation')}
            </button>
          ))}
        </div>

        {view === 'documentation' ? (
          <ExerciseDocumentationView exercise={exercise} />
        ) : sessions === undefined || records === undefined || coachHistory === undefined ? (
          <span />
        ) : (
          <>
        {/* Nothing at all for a stretching routine: a mute grey body would be
            worse than no body, and it is the roadmap's own checkpoint here. */}
        {hasDrawableMuscles(exercise) && <ExerciseMusclesCard exercise={exercise} />}

        {/* No records section at all rather than a column of em-dashes: an
            exercise you have never done has nothing to report. */}
        {records.length > 0 ? (
          <section>
            <SectionTitle>{t('exercise.recordsSection')}</SectionTitle>
            <Card>
              {records.map(({ record }) => (
                <Reading
                  key={record.id}
                  label={recordLabel(record.type)}
                  value={recordValue(record)}
                  context={recordContext(record)}
                />
              ))}
              <ListRow
                title={t('exercise.recordsLink')}
                onClick={() =>
                  void navigate(`/analytics/records?exerciseId=${encodeURIComponent(exercise.id)}`)
                }
                trailing={<ChevronRightIcon />}
              />
            </Card>
          </section>
        ) : null}

        {/* Rien à tracer sans séance : la ligne n'existe pas plutôt que de
            mener à une carte vide. C'est le premier des trois états vides. */}
        {sessions.length > 0 && (
          <Card>
            <ListRow
              title={t('analytics.exerciseLink')}
              onClick={() => void navigate(`/analytics/exercises/${exercise.id}`)}
              trailing={<ChevronRightIcon />}
            />
          </Card>
        )}

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

        {/* No empty state: an exercise the coach has never spoken about should
            not carry a permanently blank card while the engine warms up. */}
        {coachHistory.length > 0 && (
          <section>
            <SectionTitle>{t('coach.historySection')}</SectionTitle>
            <Card>
              {coachHistory.map((row) => (
                <CoachCard
                  key={row.id}
                  signal={recommendationAsSignal(row)}
                  tone={
                    row.status === 'pending' && row.nextLoadKg !== undefined
                      ? 'objective'
                      : 'signal'
                  }
                  variant="row"
                  dateLabel={longDate(row.recommendedAt)}
                  statusLabel={coachStatusLabel(row.status)}
                />
              ))}
            </Card>
          </section>
        )}

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

            <div className="mt-6">
              <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
                {t('exercise.loadIncrementLabel')}
              </p>
              <NumberInput
                aria-label={t('exercise.loadIncrementLabel')}
                value={draft.loadIncrementKg}
                onChange={writeLoadIncrement}
                step={0.25}
                min={0.25}
                max={50}
                suffix={t('units.kg')}
                placeholder={equipmentDefaultIncrement.toLocaleString('fr-FR')}
              />
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
                {loadIncrementHint}
              </p>
            </div>
          </Card>
        </section>

        {/* Sa propre section, sous « Tes réglages » : le coefficient et le
            chargement ne sont pas des préférences de confort mais ce avec quoi
            l'app compte — le tonnage d'un côté, les disques à empiler de
            l'autre. Ils valent pour un exercice du catalogue comme pour un
            exercice fait maison, ce que le formulaire de création ne pouvait
            pas offrir : il ne s'ouvre que sur les seconds. */}
        <ExerciseLoadCard exercise={exercise} />

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
          </>
        )}
      </div>
    </Screen>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useAppNavigate } from '@/app/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import {
  evaluateCoachForWorkout,
  finalizeCoachForWorkout,
} from '@/data/repositories/coachEvaluate';
import { getDomsFollowUp, syncMilestones } from '@/data/repositories/milestones';
import {
  discardWorkout,
  finishWorkout,
  getActiveWorkout,
  getWorkoutDetail,
  updateWorkout,
  workoutExerciseIdentityOf,
} from '@/data/repositories/workouts';
import { announce } from '@/audio/announce';
import { nativeNotifications } from '@/platform/nativeNotifications';
import { useRestTimer } from '@/stores/restTimer';
import type { BenchmarkLocationState } from '@/features/benchmark/BenchmarkScreen';
import { t } from '@/i18n/fr';
import { exerciseDisplayName, groupedNumber, partReading, unitLabel } from '@/i18n/labels';
import { muscleInvolvement } from '@/lib/analytics/involvement';
import { measurementShape, performedParts } from '@/lib/measurement';
import { sessionTotals } from '@/lib/volume';
import type { VolumeEntry } from '@/lib/volume';
import { ActionBand, Button, Card, ConfirmSheet, SectionTitle, Textarea, Tile, TileGrid } from '@/ui';
import { MuscleMap, balanceHighlight } from '@/ui/muscleMap';
import { CoachCard } from './CoachCard';
import { useElapsedReading } from './useElapsedReading';
import { finishSetSummary } from './summary';
import { claimWorkoutRecap, speakWorkoutRecap } from './workoutRecapVoice';

/**
 * What the session produced, before it is written down for good.
 *
 * Three figures rather than one, and that is the whole argument of
 * `lib/volume`: tonnage only counts kilos that really are the load, so a session
 * of pull-ups has a tonnage of zero. Summarised by that number alone it would
 * read as a session that never happened.
 */
export function WorkoutFinishScreen() {
  const navigate = useAppNavigate();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const savingRef = useRef(false);

  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const detail = useLiveQuery(
    async () => (active == null ? null : await getWorkoutDetail(active.id)),
    [active?.id],
  );
  const coachSignals = useLiveQuery(
    async () => {
      if (active == null || detail == null) return undefined;
      try {
        return await evaluateCoachForWorkout(active.id);
      } catch {
        // Une requête vive qui rejette relance l'erreur au rendu : l'écran d'erreur global remplacerait
        // l'écran de fin, et la séance ne pourrait plus être enregistrée pour un conseil qui a échoué.
        return [];
      }
    },
    [active?.id, detail?.workout.updatedAt],
  );
  useEffect(() => {
    const workoutId = detail?.workout.id;
    if (workoutId === undefined || coachSignals === undefined) return;
    // Un benchmark n'a rien à faire lire : son bilan est un écran, pas un résumé de séance.
    if (detail?.workout.kind === 'benchmark') return;
    // Claimed outside the component: coming back to this screen is not a reason
    // to hear the session read out a second time.
    if (claimWorkoutRecap(workoutId)) void speakWorkoutRecap(coachSignals);
  }, [coachSignals, detail?.workout.id, detail?.workout.kind]);

  // Toujours en marche : la séance n'est close qu'au moment où on l'enregistre, et c'est cet
  // instant-là que `finishWorkout` retient.
  const elapsed = useElapsedReading(detail?.workout.startedAt);

  const [draft, setDraft] = useState<{ id: string; notes: string } | null>(null);
  if (detail != null && draft?.id !== detail.workout.id) {
    setDraft({ id: detail.workout.id, notes: detail.workout.notes ?? '' });
  }

  if (active === null) {
    return (
      <Screen title={t('workout.notFound')} onBack={() => void navigate('/')}>
        <span />
      </Screen>
    );
  }

  if (active === undefined || detail == null || draft === null) {
    return (
      <Screen title="">
        <span />
      </Screen>
    );
  }

  const { workout, exercises } = detail;

  const entries: VolumeEntry[] = exercises.flatMap((line) =>
    line.sets
      .filter((set) => set.isCompleted === 1)
      .map((set) => {
        const identity = workoutExerciseIdentityOf(line);
        return {
          set,
          weightRole:
            identity.measurementType === undefined
              ? undefined
              : measurementShape(identity.measurementType).weightRole,
          bodyweightLoadFactor: identity.bodyweightLoadFactor,
        };
      }),
  );

  const totals = sessionTotals(entries, detail.bodyWeightKg);

  /**
   * The muscles this session touched. Read through `workoutExerciseIdentityOf`
   * like every other reading of a session, so a renamed or deleted exercise
   * resolves here exactly as it does two cards below.
   */
  const sessionHighlight = balanceHighlight(
    muscleInvolvement(
      exercises.map((line) => {
        const identity = workoutExerciseIdentityOf(line);
        return {
          primaryMuscle: identity.primaryMuscle,
          ...(identity.secondaryMuscles === undefined
            ? {}
            : { secondaryMuscles: identity.secondaryMuscles }),
          sets: line.sets,
        };
      }),
    ),
  );

  const validated = exercises.reduce(
    (count, line) => count + line.sets.filter((set) => set.isCompleted === 1).length,
    0,
  );
  const save = () => {
    if (validated === 0 || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    void finishWorkout(workout.id)
      // The coach is never a gate. The session is already saved; a failed
      // evaluation must not strand you on this screen with nowhere to go.
      .then(() => {
        useRestTimer.getState().stop();
        announce('workout-finished');
        return finalizeCoachForWorkout(workout.id).catch(() => undefined);
      })
      // Les paliers après le coach, et jamais avant `finishWorkout` : le moteur
      // ne lit que les séances closes, donc celle-ci doit déjà l'être. Comme le
      // coach, ce n'est pas une barrière — un calcul qui échoue ne doit pas
      // laisser l'utilisateur bloqué sur un écran de fin déjà enregistré.
      .then(() => syncMilestones({ celebrate: true }).catch(() => undefined))
      .then(async () => {
        try {
          const followUp = await getDomsFollowUp();
          await nativeNotifications.reconcileDoms(followUp?.dueAt ?? null);
        } catch {
          /* la notif n'est jamais une barrière */
        }
      })
      // Un benchmark s'achève sur son bilan et non sur l'accueil : c'est là que les
      // charges se lisent et s'acceptent.
      .then(() =>
        workout.kind === 'benchmark'
          ? navigate(`/benchmark/${workout.id}`, {
              replace: true,
              state: { benchmarkFresh: true } satisfies BenchmarkLocationState,
            })
          : navigate('/', { replace: true }),
      )
      .catch(() => setSaveFailed(true))
      .finally(() => {
        savingRef.current = false;
        setSaving(false);
      });
  };

  const discard = () => {
    void discardWorkout(workout.id).then(() => {
      useRestTimer.getState().stop();
      return navigate('/', { replace: true });
    });
  };

  return (
    <Screen
      title={t('finish.title')}
      onBack={() => void navigate(-1)}
      footer={
        <ActionBand
          label={t(saving ? 'finish.saving' : 'finish.save')}
          disabled={saving || validated === 0}
          onClick={save}
        />
      }
    >
      <div className="space-y-7">
        {saveFailed && (
          <p role="alert" className="text-sm text-[var(--danger-ink)]">
            {t('finish.saveFailed')}
          </p>
        )}
        {workout.kind === 'benchmark' && (
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('benchmark.finishNote')}</p>
          </Card>
        )}
        {/* Les mêmes totaux, dans le même ordre et sous les mêmes mots que le détail de la séance :
            ce qu'on lit ici est ce qu'on retrouvera dans l'historique. */}
        <div className="space-y-3">
          <TileGrid title={t('history.detailTotals')}>
            <Tile size="S" label={t('finish.duration')} value={{ value: elapsed }} />
            {totals.tonnage > 0 && (
              <Tile
                size="S"
                label={t('finish.tonnage')}
                value={{ value: groupedNumber(totals.tonnage), unit: unitLabel('kg') }}
              />
            )}
            <Tile
              size="S"
              label={t(totals.workingSets === 1 ? 'finish.setsOne' : 'finish.sets')}
              value={{ value: String(totals.workingSets) }}
            />
            <Tile
              size="S"
              label={t(totals.totalReps === 1 ? 'finish.repsOne' : 'finish.reps')}
              value={{ value: String(totals.totalReps) }}
            />
          </TileGrid>
          {totals.tonnage > 0 && (
            <p className="px-1 text-sm leading-relaxed text-[var(--text-2)]">
              {t('finish.tonnageHint')}
            </p>
          )}
        </div>

        {coachSignals !== undefined && coachSignals.length > 0 && (
          <section>
            <SectionTitle>{t('finish.coachSection')}</SectionTitle>
            {/*
              One Card, stacked readings — same rhythm as records / history lists.
              Nested islands of rounded borders would fight the body map above.
            */}
            <Card>
              {coachSignals.map((signal) => {
                const line = exercises.find((item) => item.row.exerciseId === signal.exerciseId);
                const name =
                  line === undefined
                    ? undefined
                    : (workoutExerciseIdentityOf(line).name ?? t('workout.deletedExercise'));
                return (
                  <CoachCard
                    key={`${signal.exerciseId}-${signal.code}`}
                    signal={signal}
                    exerciseName={name}
                    variant="row"
                    hideRole
                  />
                );
              })}
            </Card>
          </section>
        )}

        {validated === 0 ? (
          <p className="px-1 text-base leading-relaxed text-[var(--text-2)]">
            {t('finish.nothingDone')}
          </p>
        ) : (
          <section>
            <SectionTitle>{t('routine.emptyUnit')}</SectionTitle>
            <Card>
              {exercises
                .map((line) => ({
                  line,
                  done: line.sets.filter((set) => set.isCompleted === 1),
                }))
                .filter(({ done }) => done.length > 0)
                .map(({ line, done }) => {
                  const best = done.at(-1);
                  const identity = workoutExerciseIdentityOf(line);
                  const type = identity.measurementType ?? 'weight_reps';
                  const reading =
                    best === undefined
                      ? ''
                      : performedParts(type, best).map(partReading).join(' · ');

                  return (
                    <div
                      key={line.row.id}
                      className="flex min-h-14 flex-col items-start gap-1 border-b border-[var(--border)]
                        px-4 py-2 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate text-base text-[var(--text-1)]">
                        {identity.name === undefined
                          ? t('workout.deletedExercise')
                          : exerciseDisplayName(identity.name, identity.isUnilateral)}
                      </span>
                      <span className="shrink-0 text-right text-sm text-[var(--text-2)]">
                        {finishSetSummary(done.length, reading)}
                      </span>
                    </div>
                  );
                })}
            </Card>
          </section>
        )}

        {/* Nothing to draw before the first set is recorded — and nothing to
            draw either for a session made entirely of exercises with no region.
            `balanceHighlight` returning an empty object is the test, so the two
            cases need no special handling here. */}
        {Object.keys(sessionHighlight).length > 0 && (
          <details className="rounded-2xl bg-[var(--surface-1)] p-4">
            <summary className="min-h-12 cursor-pointer py-3 font-medium">
              {t('finish.muscleDetails')}
            </summary>
            <MuscleMap highlight={sessionHighlight} />
          </details>
        )}

        <section>
          <SectionTitle>{t('workout.workoutNotesLabel')}</SectionTitle>
          <Textarea
            label={t('workout.workoutNotesLabel')}
            labelHidden
            placeholder={t('workout.notesPlaceholder')}
            value={draft.notes}
            onChange={(event) => {
              setDraft({ ...draft, notes: event.target.value });
              void updateWorkout(workout.id, { notes: event.target.value });
            }}
          />
        </section>

        <Button variant="danger" size="lg" fullWidth onClick={() => setConfirming(true)}>
          {t('finish.discard')}
        </Button>
      </div>

      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('finish.discardTitle')}
        // A number, not a generic warning: "tu vas perdre des données" is
        // something you learn to tap through.
        body={
          validated === 0
            ? t('finish.discardBodyNone')
            : validated === 1
              ? t('finish.discardBodyOne')
              : t('finish.discardBody', { count: validated })
        }
        confirmLabel={t('finish.discardConfirm')}
        danger
        onConfirm={discard}
      />
    </Screen>
  );
}

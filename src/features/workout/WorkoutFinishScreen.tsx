import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import {
  discardWorkout,
  finishWorkout,
  getActiveWorkout,
  getWorkoutDetail,
  updateWorkout,
} from '@/data/repositories/workouts';
import { t } from '@/i18n/fr';
import { unitLabel } from '@/i18n/labels';
import { measurementShape, performedParts } from '@/lib/measurement';
import { sessionTotals } from '@/lib/volume';
import type { VolumeEntry } from '@/lib/volume';
import { Button, Card, ConfirmSheet, SectionTitle, Textarea } from '@/ui';
import { formatNumber } from '@/ui/numberField';
import { ElapsedTime } from './ElapsedTime';

/** One figure and what it counts. The reading register of Lot 1. */
function Reading({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="metric truncate text-2xl font-semibold text-[var(--text-1)]">{value}</span>
      <span className="label-xs font-semibold text-[var(--text-2)]">{label}</span>
    </div>
  );
}

/**
 * What the session produced, before it is written down for good.
 *
 * Three figures rather than one, and that is the whole argument of
 * `lib/volume`: tonnage only counts kilos that really are the load, so a session
 * of pull-ups has a tonnage of zero. Summarised by that number alone it would
 * read as a session that never happened.
 */
export function WorkoutFinishScreen() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const detail = useLiveQuery(
    async () => (active == null ? null : await getWorkoutDetail(active.id)),
    [active?.id],
  );

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
      .map((set) => ({
        set,
        weightRole:
          line.exercise === undefined
            ? undefined
            : measurementShape(line.exercise.measurementType).weightRole,
      })),
  );

  const totals = sessionTotals(entries);
  const validated = exercises.reduce(
    (count, line) => count + line.sets.filter((set) => set.isCompleted === 1).length,
    0,
  );
  const save = () => {
    void finishWorkout(workout.id).then(() => navigate('/', { replace: true }));
  };

  const discard = () => {
    void discardWorkout(workout.id).then(() => navigate('/', { replace: true }));
  };

  return (
    <Screen title={t('finish.title')} onBack={() => void navigate(-1)}>
      <div className="flex flex-col gap-6">
        <Card padded>
          <div className="flex items-start gap-2">
            {/* Toujours en marche : la séance n'est close qu'au moment où on
                l'enregistre, et c'est cet instant-là que `finishWorkout` retient. */}
            <Reading
              value={<ElapsedTime startedAt={workout.startedAt} />}
              label={t('finish.duration')}
            />
            <Reading value={String(totals.workingSets)} label={t('finish.sets')} />
            {totals.tonnage > 0 ? (
              <Reading
                value={`${formatNumber(totals.tonnage)} ${unitLabel('kg')}`}
                label={t('finish.tonnage')}
              />
            ) : (
              <Reading value={String(totals.totalReps)} label={t('finish.reps')} />
            )}
          </div>
          {totals.tonnage > 0 && (
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">
              {t('finish.tonnageHint')}
            </p>
          )}
        </Card>

        {validated === 0 ? (
          <p className="px-1 text-base leading-relaxed text-[var(--text-2)]">
            {t('finish.nothingDone')}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
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
                  const type = line.exercise?.measurementType ?? 'weight_reps';
                  const reading =
                    best === undefined
                      ? ''
                      : performedParts(type, best)
                          .map((part) => `${part.prefix ?? ''}${part.value} ${unitLabel(part.unit)}`)
                          .join(' · ');

                  return (
                    <div
                      key={line.row.id}
                      className="flex min-h-14 items-center gap-3 border-b border-[var(--border)]
                        px-4 py-2 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate text-base text-[var(--text-1)]">
                        {line.exercise?.name ?? t('workout.deletedExercise')}
                      </span>
                      <span className="shrink-0 text-right text-sm text-[var(--text-2)]">
                        {done.length} × {reading}
                      </span>
                    </div>
                  );
                })}
            </Card>
          </div>
        )}

        <Textarea
          label={t('workout.workoutNotesLabel')}
          placeholder={t('workout.notesPlaceholder')}
          value={draft.notes}
          onChange={(event) => {
            setDraft({ ...draft, notes: event.target.value });
            void updateWorkout(workout.id, { notes: event.target.value });
          }}
        />

        <Button variant="danger" size="lg" fullWidth onClick={() => setConfirming(true)}>
          {t('finish.discard')}
        </Button>
      </div>

      <div
        className="safe-bottom sticky bottom-0 z-20 -mx-4 mt-9 border-t border-[var(--border)]
          bg-[var(--surface-0)] px-4 pt-3 pb-3"
      >
        <Button variant="primary" size="lg" fullWidth onClick={save}>
          {t('finish.save')}
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

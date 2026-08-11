import type { ReactNode } from 'react';
import {
  workoutExerciseIdentityOf,
  type WorkoutDetail,
} from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { formatDuration, setTypeLabel, unitLabel } from '@/i18n/labels';
import { muscleInvolvement } from '@/lib/analytics/involvement';
import { measurementShape, performedParts } from '@/lib/measurement';
import type { TargetPart } from '@/lib/measurement';
import { sessionTotals } from '@/lib/volume';
import type { VolumeEntry } from '@/lib/volume';
import { Card, SectionTitle } from '@/ui';
import { BodyMap, balanceHighlight } from '@/ui/bodyMap';
import { formatNumber } from '@/ui/numberField';

const longDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const startTime = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

function readingPart(part: TargetPart): string {
  return `${part.prefix ?? ''}${part.value} ${unitLabel(part.unit)}`;
}

function performedReadings(
  set: WorkoutSet,
  measurementType: Parameters<typeof performedParts>[0] | undefined,
): TargetPart[] {
  if (measurementType !== undefined) return performedParts(measurementType, set);

  // A deleted catalogue row no longer carries its measurement type. Combining
  // the two disjoint shapes preserves every stored figure without inventing a
  // replacement exercise or dropping distance/time data.
  return [
    ...performedParts('weight_reps', set),
    ...performedParts('distance_time', set),
  ];
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 last:border-b-0">
      <span className="label-xs font-semibold text-[var(--text-2)]">{label}</span>
      <span className="metric text-right text-base font-semibold text-[var(--text-1)]">
        {value}
      </span>
    </div>
  );
}

function TotalReading({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-24 flex-col justify-between border-r border-b border-[var(--border)] p-4 last:border-r-0">
      <span className="metric text-2xl font-semibold text-[var(--text-1)]">{value}</span>
      <span className="label-xs mt-3 font-semibold text-[var(--text-2)]">{label}</span>
    </div>
  );
}

export function HistoryWorkoutDetail({ detail }: { detail: WorkoutDetail }) {
  const { workout, exercises } = detail;
  // The row's own snapshot, then today's library — the rule the export reads a
  // past session through, and the only way this screen and a document shared
  // from it can agree after the exercise has been renamed or re-typed.
  const completed = exercises.map((line) => ({
    line,
    identity: workoutExerciseIdentityOf(line),
    // The live grid fallback is deliberately not historical evidence. When
    // both stored sources are gone, keep rendering every persisted figure.
    measurementType: line.row.exerciseMeasurementType ?? line.exercise?.measurementType,
    sets: line.sets.filter((set) => set.isCompleted === 1),
  }));
  const entries: VolumeEntry[] = completed.flatMap(({ identity, sets }) =>
    sets.map((set) => ({
      set,
      weightRole: measurementShape(identity.measurementType).weightRole,
      bodyweightLoadFactor: identity.bodyweightLoadFactor,
    })),
  );
  const totals = sessionTotals(entries, detail.bodyWeightKg);
  /** Built from `completed`, so the drawing counts exactly what the totals count. */
  const sessionHighlight = balanceHighlight(
    muscleInvolvement(
      completed.map(({ identity, sets }) => ({
        primaryMuscle: identity.primaryMuscle,
        ...(identity.secondaryMuscles === undefined
          ? {}
          : { secondaryMuscles: identity.secondaryMuscles }),
        sets,
      })),
    ),
  );
  const distancePart = performedParts('distance_time', {
    distanceMeters: totals.distanceMeters,
  }).at(0);
  const totalReadings = [
    {
      label: t('history.detailSets'),
      value: String(totals.workingSets),
      visible: true,
    },
    {
      label: t('history.detailReps'),
      value: String(totals.totalReps),
      visible: true,
    },
    {
      label: t('history.detailTonnage'),
      value: `${formatNumber(totals.tonnage)} ${unitLabel('kg')}`,
      visible: totals.tonnage > 0,
    },
    {
      label: t('history.detailTime'),
      value: formatDuration(totals.durationSeconds),
      visible: totals.durationSeconds > 0,
    },
    {
      label: t('history.detailDistance'),
      value: distancePart === undefined ? '' : readingPart(distancePart),
      visible: totals.distanceMeters > 0,
    },
  ].filter((reading) => reading.visible);

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <MetadataRow
          label={t('history.detailDate')}
          value={longDate.format(workout.startedAt)}
        />
        <MetadataRow
          label={t('history.detailStart')}
          value={startTime.format(workout.startedAt)}
        />
        <MetadataRow
          label={t('history.detailDuration')}
          value={formatDuration(workout.durationSeconds)}
        />
      </Card>

      {workout.notes?.trim() && (
        <section>
          <SectionTitle>{t('history.detailNotes')}</SectionTitle>
          <Card padded>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--text-1)]">
              {workout.notes}
            </p>
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>{t('history.detailTotals')}</SectionTitle>
        <Card>
          <div className="grid grid-cols-2 [&>*:nth-child(even)]:border-r-0">
            {totalReadings.map((reading) => (
              <TotalReading
                key={reading.label}
                label={reading.label}
                value={reading.value}
              />
            ))}
          </div>
        </Card>
      </section>

      {/* The same drawing as the end-of-session recap, from the same figures:
          reopening a session in the Journal must show what closing it showed.
          `balanceHighlight` returning nothing covers both empty cases — a
          session with no recorded set, and one made only of exercises that have
          no region. */}
      {Object.keys(sessionHighlight).length > 0 && (
        <section>
          <SectionTitle>{t('history.detailMuscles')}</SectionTitle>
          <Card padded>
            <BodyMap highlight={sessionHighlight} />
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>{t('history.detailExercises')}</SectionTitle>
        <div className="space-y-4">
          {completed
            .filter(({ sets }) => sets.length > 0)
            .map(({ line, identity, measurementType, sets }) => (
              <Card key={line.row.id}>
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <h3 className="text-base font-semibold text-[var(--text-1)]">
                    {identity.name ?? t('history.deletedExercise')}
                  </h3>
                  {line.row.notes?.trim() && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-2)]">
                      {line.row.notes}
                    </p>
                  )}
                </div>

                {sets.map((set) => {
                  const parts = performedReadings(set, measurementType);
                  const readings = [
                    ...parts.map(readingPart),
                    setTypeLabel(set.setType),
                    ...(set.rpe === undefined
                      ? []
                      : [t('history.detailRpe', { value: formatNumber(set.rpe) })]),
                  ];

                  return (
                    <div
                      key={set.id}
                      className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
                    >
                      <span className="shrink-0 text-sm font-semibold text-[var(--text-2)]">
                        {t('history.detailSet', { number: set.order + 1 })}
                      </span>
                      <span className="metric text-right text-sm text-[var(--text-1)]">
                        {readings.join(' · ')}
                      </span>
                    </div>
                  );
                })}
              </Card>
            ))}
        </div>
      </section>
    </div>
  );
}

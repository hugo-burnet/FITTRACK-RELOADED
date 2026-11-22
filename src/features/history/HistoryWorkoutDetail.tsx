import { useAppNavigate } from '@/app/navigation';
import {
  workoutExerciseIdentityOf,
  type WorkoutDetail,
} from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import {
  exerciseDisplayName,
  formatDuration,
  groupedNumber,
  partReading,
  setTypeLabel,
  unitLabel,
} from '@/i18n/labels';
import { muscleInvolvement } from '@/lib/analytics/involvement';
import { isTimedMeasurement, measurementShape, performedParts } from '@/lib/measurement';
import type { TargetPart } from '@/lib/measurement';
import { sessionTotals } from '@/lib/volume';
import type { VolumeEntry } from '@/lib/volume';
import { Card, SectionTitle, Tile, TileGrid } from '@/ui';
import { balanceHighlight } from '@/ui/muscleMap';
import { formatNumber } from '@/ui/numberField';
import { HistoryCoachConclusions } from './HistoryCoachConclusions';
import { HistoryMusclesCard } from './HistoryMusclesCard';
import { HistoryProgramLine } from './HistoryProgramLine';
import { HistoryRecords } from './HistoryRecords';
import { RpeDisciplineTrace } from '@/features/workout/RpeDisciplineTrace';

const longDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const startTime = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

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

export function HistoryWorkoutDetail({ detail }: { detail: WorkoutDetail }) {
  const { workout, exercises } = detail;
  const navigate = useAppNavigate();
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
      timed: isTimedMeasurement(identity.measurementType),
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
  /** Pour nommer les recommandations du coach : elles ne portent que l'id de leur exercice. */
  const exerciseNames = new Map(
    completed.flatMap(({ line, identity }) =>
      identity.name === undefined
        ? []
        : [[line.row.exerciseId, exerciseDisplayName(identity.name, identity.isUnilateral)] as const],
    ),
  );

  return (
    <div className="flex flex-col gap-8">
      <HistoryProgramLine workout={workout} />

      <Card>
        <MetadataRow
          label={t('history.detailDate')}
          value={longDate.format(workout.startedAt)}
        />
        <MetadataRow
          label={t('history.detailStart')}
          value={startTime.format(workout.startedAt)}
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

      <RpeDisciplineTrace events={workout.rpeDiscipline} />

      {/* Quatre tuiles `S` sans lien : la séance est passée, ces chiffres ne mènent nulle part.
          La durée est celle de l'horloge. L'ancien « Temps » (reps × cadence) en était une estimation
          qui se confondait avec elle : il a été retiré plutôt que présenté comme un second temps. */}
      <TileGrid title={t('history.detailTotals')}>
        <Tile
          size="S"
          label={t('history.detailDuration')}
          value={{ value: formatDuration(workout.durationSeconds) }}
        />
        {totals.tonnage > 0 && (
          <Tile
            size="S"
            label={t('history.detailTonnage')}
            value={{ value: groupedNumber(totals.tonnage), unit: unitLabel('kg') }}
          />
        )}
        <Tile
          size="S"
          label={t(totals.workingSets === 1 ? 'history.detailSetsOne' : 'history.detailSets')}
          value={{ value: String(totals.workingSets) }}
        />
        <Tile
          size="S"
          label={t(totals.totalReps === 1 ? 'history.detailRepsOne' : 'history.detailReps')}
          value={{ value: String(totals.totalReps) }}
        />
        {totals.distanceMeters > 0 && distancePart !== undefined && (
          <Tile
            size="S"
            label={t('history.detailDistance')}
            value={{ value: partReading(distancePart) }}
          />
        )}
      </TileGrid>

      <HistoryRecords workoutId={workout.id} />

      <HistoryCoachConclusions workoutId={workout.id} names={exerciseNames} />

      {/* The same drawing as the end-of-session recap, from the same figures:
          reopening a session in the Journal must show what closing it showed.
          `balanceHighlight` returning nothing covers both empty cases — a
          session with no recorded set, and one made only of exercises that have
          no region. */}
      {Object.keys(sessionHighlight).length > 0 && (
        <HistoryMusclesCard highlight={sessionHighlight} />
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
                    {identity.name === undefined ? (
                      t('history.deletedExercise')
                    ) : line.exercise === undefined ? (
                      // Supprimé de la bibliothèque : l'instantané garde son nom, mais la fiche
                      // n'existe plus (suppression douce) — un lien mènerait à « Cet exercice
                      // n'existe plus ». Le nom reste, sans lien.
                      exerciseDisplayName(identity.name, identity.isUnilateral)
                    ) : (
                      <button
                        type="button"
                        className="-my-3 min-h-12 w-full py-3 text-left"
                        onClick={() => void navigate(`/exercises/${line.row.exerciseId}`)}
                      >
                        {exerciseDisplayName(identity.name, identity.isUnilateral)}
                      </button>
                    )}
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
                    ...parts.map(partReading),
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

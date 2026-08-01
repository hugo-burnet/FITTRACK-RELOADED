import { t } from '@/i18n/fr';
import { formatNumber } from '@/ui/numberField';

export interface HevyExerciseEvidenceExample {
  workoutName: string;
  startedAt: number;
  sets: readonly {
    weight?: number;
    reps?: number;
    durationSeconds?: number;
    distanceMeters?: number;
  }[];
}

export interface HevyExerciseEvidenceObservation {
  sessionCount: number;
  setCount: number;
  examples: readonly HevyExerciseEvidenceExample[];
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function formatSet(set: HevyExerciseEvidenceExample['sets'][number]): string {
  if (set.weight !== undefined && set.reps !== undefined) {
    return t('history.importEvidenceSet', {
      weight: formatNumber(set.weight),
      reps: formatNumber(set.reps),
    });
  }

  const values = [
    set.weight === undefined ? undefined : `${formatNumber(set.weight)} ${t('units.kg')}`,
    set.reps === undefined ? undefined : formatNumber(set.reps),
    set.durationSeconds === undefined
      ? undefined
      : `${formatNumber(set.durationSeconds)} ${t('units.seconds')}`,
    set.distanceMeters === undefined
      ? undefined
      : `${formatNumber(set.distanceMeters)} ${t('units.meters')}`,
  ];

  return values
    .filter((value): value is string => value !== undefined)
    .join(t('history.importEvidenceValueSeparator'));
}

export function HevyExerciseEvidence({
  observation,
}: {
  observation: HevyExerciseEvidenceObservation;
}): React.ReactNode {
  const summaryKey =
    observation.sessionCount === 1
      ? observation.setCount === 1
        ? 'history.importEvidenceOneSetOne'
        : 'history.importEvidenceOne'
      : observation.setCount === 1
        ? 'history.importEvidenceSetOne'
        : 'history.importEvidence';

  return (
    <section className="space-y-3">
      <p className="text-sm text-[var(--text-2)]">
        {t(summaryKey, {
          sessionCount: observation.sessionCount,
          setCount: observation.setCount,
        })}
      </p>

      {observation.examples.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-1)]">
            {t('history.importEvidenceExamples')}
          </h3>
          {observation.examples.slice(0, 3).map((example, index) => (
            <article
              key={`${example.workoutName}-${example.startedAt}-${index}`}
              className="rounded-xl bg-[var(--surface-2)] px-3 py-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold text-[var(--text-1)]">
                  {example.workoutName}
                </p>
                <p className="shrink-0 text-xs capitalize text-[var(--text-2)]">
                  {dateFormatter.format(example.startedAt)}
                </p>
              </div>
              <ul className="mt-1 flex flex-wrap gap-x-2 text-sm text-[var(--text-2)]">
                {example.sets.map((set, setIndex) => {
                  const reading = formatSet(set);
                  return reading === '' ? null : <li key={setIndex}>{reading}</li>;
                })}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

import type { Exercise } from '@/data/types';
import { t } from '@/i18n/fr';
import { muscleLabel } from '@/i18n/labels';
import { Card, SectionTitle } from '@/ui';
import { BodyMap, exerciseHighlight } from '@/ui/bodyMap';

/**
 * What an exercise works — RF-06's missing half, on the sheet that was missing it.
 *
 * The intensities are `exerciseHighlight`'s business and are tested there. What
 * belongs here is the split between the two readings: **the drawing shows what
 * it can, the text names everything.** A stepper's `Cardio` has no region and
 * never lights, and it is still written under "Principal" — dropping it would be
 * the screen editing the catalogue on the user's behalf.
 *
 * The caller decides whether this is worth showing at all — cf.
 * `hasDrawableMuscles`. A stretching routine gets no silhouette rather than an
 * empty one.
 */
export function ExerciseMusclesCard({ exercise }: { exercise: Exercise }) {
  const secondaries = exercise.secondaryMuscles.filter(
    (muscle) => muscle !== exercise.primaryMuscle,
  );

  return (
    <section>
      <SectionTitle>{t('exercise.musclesSection')}</SectionTitle>
      <Card>
        <div className="px-4 pt-4 pb-2">
          <BodyMap highlight={exerciseHighlight(exercise)} />
        </div>
        <Line label={t('exercise.musclesPrimary')} value={muscleLabel(exercise.primaryMuscle)} />
        {secondaries.length > 0 && (
          <Line
            label={t('exercise.musclesSecondary')}
            value={secondaries.map(muscleLabel).join(' · ')}
            dim
          />
        )}
      </Card>
    </section>
  );
}

/**
 * The same two-column row the records section uses, at reading weight rather
 * than metric weight: a muscle is a word, not a figure.
 */
function Line({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-[var(--border)] p-4">
      <span className="label-xs font-semibold text-[var(--text-2)]">{label}</span>
      <span
        className={`text-base font-semibold ${dim ? 'text-[var(--text-2)]' : 'text-[var(--text-1)]'}`}
      >
        {value}
      </span>
    </div>
  );
}

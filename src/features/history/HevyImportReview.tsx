import type { HevyImportData } from '@/lib/hevyCsv';
import { t } from '@/i18n/fr';
import { Card } from '@/ui';
import type { HevyImportDraft } from './hevyImportDraft';

function countText(
  count: number,
  singular: Parameters<typeof t>[0],
  plural: Parameters<typeof t>[0],
): string {
  return t(count === 1 ? singular : plural, { count });
}

export function HevyImportReview({
  data,
  draft,
}: {
  data: HevyImportData;
  draft: HevyImportDraft;
}) {
  const customCount = draft.rows.filter(
    (row) => row.resolution?.kind === 'custom',
  ).length;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-[var(--text-1)]">
        {t('history.importReviewTitle')}
      </h2>
      <Card>
        {[
          t('history.importWorkoutCount', { count: data.workoutCount }),
          t('history.importExerciseCount', { count: data.exerciseCount }),
          t('history.importSetCount', { count: data.setCount }),
        ].map((reading) => (
          <p
            key={reading}
            className="border-b border-[var(--border)] px-4 py-3 text-base
              text-[var(--text-1)] last:border-b-0"
          >
            {reading}
          </p>
        ))}
      </Card>
      <Card padded>
        <div className="space-y-2 text-sm leading-relaxed text-[var(--text-2)]">
          <p>
            {countText(
              draft.importableWorkouts,
              'history.importWillImportOne',
              'history.importWillImport',
            )}
          </p>
          {draft.skippedWorkouts > 0 && (
            <p>
              {countText(
                draft.skippedWorkouts,
                'history.importWillSkipOne',
                'history.importWillSkip',
              )}
            </p>
          )}
          {customCount > 0 && (
            <p>
              {countText(
                customCount,
                'history.importCustomCountOne',
                'history.importCustomCount',
              )}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

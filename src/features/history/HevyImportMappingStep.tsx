import { t } from '@/i18n/fr';
import { Card } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';
import type {
  HevyImportDraft,
  HevyMappingDraftRow,
} from './hevyImportDraft';

function mappingReading(row: HevyMappingDraftRow): {
  label: string;
  value: string;
} {
  if (row.resolution?.kind === 'existing') {
    const exercise = row.suggestion?.id === row.resolution.exerciseId
      ? row.suggestion
      : undefined;
    return {
      label:
        row.resolutionSource === 'saved'
          ? t('history.importSaved')
          : t('history.importSelected'),
      value: exercise?.name ?? t('history.importSelected'),
    };
  }
  if (row.resolution?.kind === 'custom') {
    return {
      label: t('history.importSelected'),
      value: row.resolution.exercise.name,
    };
  }
  return {
    label: t('history.importSuggested'),
    value: row.suggestion?.name ?? t('history.importChooseExercise'),
  };
}

export function HevyImportMappingStep({
  draft,
  onOpen,
}: {
  draft: HevyImportDraft;
  onOpen: (row: HevyMappingDraftRow) => void;
}) {
  const unresolved = draft.rows.filter(
    (row) => row.resolution === undefined,
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-1)]">
          {t('history.importMappingTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
          {t('history.importMappingBody')}
        </p>
        <p className="mt-3 text-sm font-semibold text-[var(--accent-ink)]">
          {t(
            unresolved === 1
              ? 'history.importUnresolvedOne'
              : 'history.importUnresolved',
            { count: unresolved },
          )}
        </p>
      </div>

      <Card>
        {draft.rows.map((row) => {
          const reading = mappingReading(row);
          return (
            <button
              key={row.source.sourceTitle}
              type="button"
              onClick={() => onOpen(row)}
              className="flex min-h-16 w-full items-center gap-3 border-b border-[var(--border)]
                px-4 py-3 text-left last:border-b-0 active:bg-[var(--surface-2)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-[var(--text-1)]">
                  {row.source.sourceTitle}
                </span>
                <span className="mt-1 block text-sm text-[var(--text-2)]">
                  {reading.label} · {reading.value}
                </span>
              </span>
              <ChevronRightIcon className="shrink-0 text-[var(--text-2)]" />
            </button>
          );
        })}
      </Card>
    </div>
  );
}

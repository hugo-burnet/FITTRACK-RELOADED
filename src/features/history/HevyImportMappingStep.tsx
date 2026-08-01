import { t } from '@/i18n/fr';
import {
  equipmentLabel,
  measurementLabel,
  muscleLabel,
} from '@/i18n/labels';
import { Card } from '@/ui';
import { CheckIcon, ChevronRightIcon } from '@/ui/icons';
import type { Exercise } from '@/data/types';
import type {
  HevyImportDraft,
  HevyMappingDraftRow,
} from './hevyImportDraft';
import { unresolvedHevySources } from './hevyImportDraft';

type MappingTarget = Pick<
  Exercise,
  'name' | 'primaryMuscle' | 'equipment' | 'measurementType'
>;

function selectedExercise(
  row: HevyMappingDraftRow,
  exercises: readonly Exercise[],
): MappingTarget | undefined {
  if (row.resolution?.kind === 'custom') {
    return row.resolution.exercise;
  }
  if (row.resolution?.kind === 'existing') {
    const selectedId = row.resolution.exerciseId;
    const resolved = exercises.find(
      (candidate) => candidate.id === selectedId,
    );
    if (resolved !== undefined) return resolved;
  }
  if (row.review.status === 'confirmed') {
    return row.review.exercise;
  }
  return row.review.suggestions[0]?.exercise;
}

function conflictReason(
  row: HevyMappingDraftRow,
): string | undefined {
  if (row.review.status !== 'conflict') return undefined;
  const key = {
    target_missing: 'history.importConflictMissing',
    target_deleted: 'history.importConflictDeleted',
    measurement_changed: 'history.importConflictMeasurement',
    multiple_active_targets: 'history.importConflictMultipleTargets',
  } as const;
  return t(key[row.review.reason]);
}

function mappingReading(
  row: HevyMappingDraftRow,
  exercises: readonly Exercise[],
): {
  status: string;
  value?: string;
  detail?: string;
  target?: MappingTarget;
  confirmed: boolean;
} {
  const target = selectedExercise(row, exercises);
  const confirmed =
    row.resolution !== undefined &&
    (row.resolutionSource === 'user' ||
      (row.resolutionSource === 'binding' &&
        row.review.status === 'confirmed'));
  if (confirmed) {
    return {
      status: t('history.importConfirmed'),
      value:
        target?.name ??
        t('history.importChooseExercise'),
      target,
      confirmed: true,
    };
  }
  if (row.review.status === 'conflict') {
    return {
      status: t('history.importConflict'),
      value: target?.name,
      detail: conflictReason(row),
      target,
      confirmed: false,
    };
  }
  if (row.review.status === 'confirmed') {
    return {
      status: t('history.importNeedsConfirmation'),
      value: row.review.exercise.name,
      target,
      confirmed: false,
    };
  }
  return {
    status: t('history.importNeedsConfirmation'),
    value:
      row.review.suggestions[0]?.exercise.name ??
      t('history.importChooseExercise'),
    target,
    confirmed: false,
  };
}

function evidenceSummary(row: HevyMappingDraftRow): string {
  const { sessionCount, setCount } = row.review.observation;
  const key =
    sessionCount === 1
      ? setCount === 1
        ? 'history.importEvidenceOneSetOne'
        : 'history.importEvidenceOne'
      : setCount === 1
        ? 'history.importEvidenceSetOne'
        : 'history.importEvidence';
  return t(key, { sessionCount, setCount });
}

export function HevyImportMappingStep({
  draft,
  exercises,
  onOpen,
}: {
  draft: HevyImportDraft;
  exercises: readonly Exercise[];
  onOpen: (row: HevyMappingDraftRow) => void;
}) {
  const unresolved = unresolvedHevySources(draft).length;

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
          const reading = mappingReading(row, exercises);
          return (
            <button
              key={row.review.identityKey}
              type="button"
              onClick={() => onOpen(row)}
              className="flex min-h-16 w-full items-center gap-3 border-b border-[var(--border)]
                px-4 py-3 text-left last:border-b-0 active:bg-[var(--surface-2)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold leading-snug text-[var(--text-1)]">
                  {row.source.sourceTitle}
                </span>
                <span className="mt-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
                  {reading.status}
                </span>
                {reading.value !== undefined && (
                  <span className="mt-0.5 block text-sm font-semibold text-[var(--text-1)]">
                    {reading.value}
                  </span>
                )}
                {reading.target !== undefined && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-sm text-[var(--text-2)]">
                    <span>{muscleLabel(reading.target.primaryMuscle)}</span>
                    <span aria-hidden="true">
                      {t('history.importEvidenceValueSeparator')}
                    </span>
                    <span>{equipmentLabel(reading.target.equipment)}</span>
                    <span aria-hidden="true">
                      {t('history.importEvidenceValueSeparator')}
                    </span>
                    <span>
                      {measurementLabel(reading.target.measurementType)}
                    </span>
                  </span>
                )}
                <span className="mt-1.5 block text-sm text-[var(--text-2)]">
                  {evidenceSummary(row)}
                </span>
                {reading.detail !== undefined && (
                  <span className="block text-sm text-[var(--danger)]">
                    {reading.detail}
                  </span>
                )}
              </span>
              {reading.confirmed && (
                <span
                  role="img"
                  aria-label={t('history.importConfirmed')}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full
                    bg-[var(--accent-ink)] text-[var(--surface-0)]"
                >
                  <CheckIcon
                    width={14}
                    height={14}
                    strokeWidth={2.5}
                  />
                </span>
              )}
              <ChevronRightIcon className="shrink-0 text-[var(--text-2)]" />
            </button>
          );
        })}
      </Card>
    </div>
  );
}

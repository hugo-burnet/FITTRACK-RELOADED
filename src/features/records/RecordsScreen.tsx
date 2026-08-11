import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import {
  isRecordProjectionCurrent,
  listRecordTimeline,
  rebuildAllRecords,
} from '@/data/repositories/personalRecords';
import type { PersonalRecordType } from '@/data/types';
import { t } from '@/i18n/fr';
import { recordLabel } from '@/i18n/labels';
import { Button, EmptyState, FilterChip, OptionSheet, type Option } from '@/ui';
import { RecordRail } from './RecordRail';

const ALL = '';

export function RecordsScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const exerciseId = searchParams.get('exerciseId') ?? ALL;
  const [type, setType] = useState<PersonalRecordType | typeof ALL>(ALL);
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const projectionCurrent = useLiveQuery(isRecordProjectionCurrent, []);
  const allEntries = useLiveQuery(() => listRecordTimeline(), []);
  const entries = useLiveQuery(
    () =>
      listRecordTimeline({
        ...(exerciseId === ALL ? {} : { exerciseId }),
        ...(type === ALL ? {} : { type }),
      }),
    [exerciseId, type],
  );

  const exerciseOptions: Option<string>[] = [
    { value: ALL, label: t('records.allExercises') },
    ...[...new Map([...(allEntries ?? [])].reverse().map((entry) => [entry.record.exerciseId, entry.exerciseName]))]
      .sort((left, right) => left[1].localeCompare(right[1], 'fr'))
      .map(([value, label]) => ({ value, label })),
  ];
  const availableTypes = new Set((allEntries ?? []).map((entry) => entry.record.type));
  const typeOptions: Option<PersonalRecordType | typeof ALL>[] = [
    { value: ALL, label: t('records.allTypes') },
    ...([...availableTypes]
      .sort((left, right) => recordLabel(left).localeCompare(recordLabel(right), 'fr'))
      .map((value) => ({ value, label: recordLabel(value) })) as Option<PersonalRecordType>[]),
  ];
  const selectedExercise = exerciseOptions.find((option) => option.value === exerciseId);
  const hasFilters = exerciseId !== ALL || type !== ALL;
  const visibleKnownRecordIds = (allEntries ?? [])
    .filter(
      (entry) =>
        (exerciseId === ALL || entry.record.exerciseId === exerciseId) &&
        (type === ALL || entry.record.type === type),
    )
    .map((entry) => entry.record.id);

  const selectExercise = (next: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === ALL) nextParams.delete('exerciseId');
    else nextParams.set('exerciseId', next);
    setSearchParams(nextParams, { replace: true });
  };

  const repair = async () => {
    setRepairing(true);
    setRepairFailed(false);
    try {
      await rebuildAllRecords();
    } catch {
      setRepairFailed(true);
    } finally {
      setRepairing(false);
    }
  };

  const clearFilters = () => {
    setType(ALL);
    selectExercise(ALL);
  };

  return (
    <Screen title={t('records.title')} onBack={() => void navigate('/analytics')}>
      <div className="flex min-h-full flex-col">
        <div className="flex shrink-0 gap-2 pb-1">
          <div className="min-w-0 flex-1 [&>button]:min-w-0 [&>button]:w-full">
            <FilterChip
              label={
                selectedExercise?.label ??
                (exerciseId === ALL ? t('records.allExercises') : t('records.unknownExercise'))
              }
              active={exerciseId !== ALL}
              onClick={() => setExerciseOpen(true)}
            />
          </div>
          <div className="min-w-0 flex-1 [&>button]:min-w-0 [&>button]:w-full">
            <FilterChip
              label={type === ALL ? t('records.allTypes') : recordLabel(type)}
              active={type !== ALL}
              onClick={() => setTypeOpen(true)}
            />
          </div>
        </div>

        {projectionCurrent === undefined || allEntries === undefined || entries === undefined ? (
          <div aria-busy="true" aria-label={t('records.loading')} className="mt-7 space-y-4">
            <div className="h-40 animate-pulse rounded-xl bg-[var(--surface-1)]" />
            <div className="h-20 animate-pulse rounded-xl bg-[var(--surface-1)]" />
          </div>
        ) : projectionCurrent === false ? (
          <EmptyState
            title={t('records.staleTitle')}
            body={t(repairFailed ? 'records.repairFailed' : 'records.staleBody')}
            action={
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={repairing}
                onClick={() => void repair()}
              >
                {t(
                  repairing
                    ? 'records.repairing'
                    : repairFailed
                      ? 'records.retryRepair'
                      : 'records.repair',
                )}
              </Button>
            }
          />
        ) : (
          <>
            {entries.length === 0 &&
              (hasFilters ? (
                <EmptyState
                  title={t('records.noResultsTitle')}
                  body={t('records.noResultsBody')}
                  action={
                    <Button type="button" variant="secondary" fullWidth onClick={clearFilters}>
                      {t('records.clearFilters')}
                    </Button>
                  }
                />
              ) : (
                <EmptyState title={t('records.emptyTitle')} body={t('records.emptyBody')} />
              ))}
            <div className={entries.length === 0 ? 'hidden' : 'mt-7'}>
              <RecordRail
                entries={entries}
                knownRecordIds={allEntries.map((entry) => entry.record.id)}
                visibleKnownRecordIds={visibleKnownRecordIds}
                onOpen={(entry) =>
                  void navigate(
                    entry.workoutStatus === 'active'
                      ? '/workout'
                      : `/history/${entry.record.workoutId}`,
                  )
                }
              />
            </div>
          </>
        )}
      </div>

      <OptionSheet
        open={exerciseOpen}
        onClose={() => setExerciseOpen(false)}
        title={t('records.exerciseSheetTitle')}
        value={exerciseId}
        options={exerciseOptions}
        onSelect={selectExercise}
      />
      <OptionSheet
        open={typeOpen}
        onClose={() => setTypeOpen(false)}
        title={t('records.typeSheetTitle')}
        value={type}
        options={typeOptions}
        onSelect={setType}
      />
    </Screen>
  );
}

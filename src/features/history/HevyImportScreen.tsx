import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import {
  importHevyWorkouts,
  prepareHevyImport,
  type HevyImportPreparation,
  type HevyImportResult,
} from '@/data/repositories/hevyImport';
import type { HevyCsvIssue, HevyImportData } from '@/lib/hevyCsv';
import { parseHevyCsv } from '@/lib/hevyCsv';
import { t } from '@/i18n/fr';
import { ActionBand, Card } from '@/ui';
import { HevyExerciseMappingSheet } from './HevyExerciseMappingSheet';
import { HevyImportFileStep } from './HevyImportFileStep';
import { HevyImportMappingStep } from './HevyImportMappingStep';
import { HevyImportReview } from './HevyImportReview';
import {
  createHevyImportDraft,
  resolutionsFromHevyDraft,
  setHevyImportResolution,
  unresolvedHevySources,
  type HevyImportDraft,
  type HevyMappingDraftRow,
} from './hevyImportDraft';

type ReadyState = {
  data: HevyImportData;
  preparation: HevyImportPreparation;
  draft: HevyImportDraft;
};

type ImportState =
  | { step: 'file'; issues: HevyCsvIssue[]; message?: string }
  | { step: 'preparing' }
  | ({ step: 'mapping' } & ReadyState)
  | ({ step: 'review'; failed: boolean } & ReadyState)
  | ({ step: 'importing' } & ReadyState)
  | { step: 'done'; result: HevyImportResult };

function readyState(value: ReadyState): ReadyState {
  return {
    data: value.data,
    preparation: value.preparation,
    draft: value.draft,
  };
}

function DetectedCounts({ data }: { data: HevyImportData }) {
  return (
    <Card padded>
      <h2 className="label-xs font-semibold text-[var(--text-2)]">
        {t('history.importDetectedTitle')}
      </h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          t('history.importWorkoutCount', { count: data.workoutCount }),
          t('history.importExerciseCount', { count: data.exerciseCount }),
          t('history.importSetCount', { count: data.setCount }),
        ].map((reading) => (
          <p
            key={reading}
            className="text-center text-sm font-semibold text-[var(--text-1)]"
          >
            {reading}
          </p>
        ))}
      </div>
    </Card>
  );
}

export function HevyImportScreen() {
  const navigate = useNavigate();
  const [state, setState] = useState<ImportState>({
    step: 'file',
    issues: [],
  });
  const [openedRow, setOpenedRow] =
    useState<HevyMappingDraftRow | null>(null);

  const chooseFile = async (file: File) => {
    if (file.name.toLowerCase() !== 'workout_data.csv') {
      setState({
        step: 'file',
        issues: [],
        message: t('history.importWrongFile'),
      });
      return;
    }

    setState({ step: 'preparing' });
    try {
      const result = parseHevyCsv(await file.text());
      if (!result.ok) {
        setState({ step: 'file', issues: result.issues });
        return;
      }
      const preparation = await prepareHevyImport(result.data);
      const ready = {
        data: result.data,
        preparation,
        draft: createHevyImportDraft(result.data, preparation),
      };
      setState(
        ready.draft.rows.length === 0
          ? { step: 'review', failed: false, ...ready }
          : { step: 'mapping', ...ready },
      );
    } catch {
      setState({
        step: 'file',
        issues: [],
        message: t('history.importReadError'),
      });
    }
  };

  const goBack = () => {
    if (state.step === 'file') {
      void navigate(-1);
      return;
    }
    if (state.step === 'mapping') {
      setState({ step: 'file', issues: [] });
      return;
    }
    if (state.step === 'review') {
      setState(
        state.draft.rows.length === 0
          ? { step: 'file', issues: [] }
          : { step: 'mapping', ...readyState(state) },
      );
      return;
    }
    if (state.step === 'done') {
      void navigate('/history', { replace: true });
    }
  };

  const runImport = async (ready: ReadyState) => {
    setState({ step: 'importing', ...ready });
    try {
      const result = await importHevyWorkouts(
        ready.data,
        resolutionsFromHevyDraft(ready.draft),
      );
      setState({ step: 'done', result });
    } catch {
      setState({ step: 'review', failed: true, ...ready });
    }
  };

  const footer =
    state.step === 'mapping' ? (
      <ActionBand
        label={t('history.importContinue')}
        disabled={unresolvedHevySources(state.draft).length > 0}
        onClick={() =>
          setState({
            step: 'review',
            failed: false,
            ...readyState(state),
          })
        }
      />
    ) : state.step === 'review' ? (
      <ActionBand
        label={t('history.importSubmit')}
        onClick={() => void runImport(state)}
      />
    ) : state.step === 'importing' ? (
      <ActionBand
        label={t('history.importWorking')}
        disabled
        onClick={() => undefined}
      />
    ) : state.step === 'done' ? (
      <ActionBand
        label={t('history.importBackToHistory')}
        onClick={() =>
          void navigate('/history', {
            replace: true,
            state: { historyNotice: 'imported' },
          })
        }
      />
    ) : undefined;

  return (
    <Screen
      title={t('history.importTitle')}
      onBack={
        state.step === 'preparing' || state.step === 'importing'
          ? undefined
          : goBack
      }
      footer={footer}
    >
      {state.step === 'file' && (
        <HevyImportFileStep
          issues={state.issues}
          message={state.message}
          onSelect={(file) => void chooseFile(file)}
        />
      )}

      {state.step === 'preparing' && (
        <div aria-hidden="true" className="space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
          <div className="h-72 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
        </div>
      )}

      {(state.step === 'mapping' ||
        state.step === 'review' ||
        state.step === 'importing') && (
        <div className="space-y-6">
          <DetectedCounts data={state.data} />
          {state.step === 'mapping' ? (
            <HevyImportMappingStep
              draft={state.draft}
              exercises={state.preparation.exercises}
              onOpen={setOpenedRow}
            />
          ) : (
            <>
              {state.step === 'review' && state.failed && (
                <div role="alert">
                  <Card padded>
                    <p className="text-sm text-[var(--danger-ink)]">
                      {t('history.importFailed')}
                    </p>
                  </Card>
                </div>
              )}
              <HevyImportReview data={state.data} draft={state.draft} />
            </>
          )}
        </div>
      )}

      {state.step === 'done' && (
        <div className="flex min-h-80 items-center justify-center">
          <div className="max-w-sm text-center">
            <p className="metric text-4xl font-semibold text-[var(--accent-ink)]">
              {state.result.importedWorkouts}
            </p>
            <h2 className="mt-3 text-xl font-semibold text-[var(--text-1)]">
              {t('history.importSuccessTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
              {t('history.importSuccessBody', {
                imported: state.result.importedWorkouts,
                skipped: state.result.skippedWorkouts,
              })}
            </p>
          </div>
        </div>
      )}

      {(state.step === 'mapping' ||
        state.step === 'review' ||
        state.step === 'importing') && (
        <HevyExerciseMappingSheet
          row={openedRow}
          exercises={state.preparation.exercises}
          onClose={() => setOpenedRow(null)}
          onSelect={(resolution) => {
            if (openedRow === null || state.step !== 'mapping') return;
            setState({
              ...state,
              draft: setHevyImportResolution(
                state.draft,
                openedRow.source.sourceTitle,
                resolution,
              ),
            });
            setOpenedRow(null);
          }}
        />
      )}
    </Screen>
  );
}

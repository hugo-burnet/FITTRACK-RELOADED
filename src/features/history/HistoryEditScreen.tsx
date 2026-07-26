import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  useBlocker,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { Screen } from '@/app/Screen';
import {
  getArchivedWorkoutDetail,
  saveArchivedWorkout,
} from '@/data/repositories/history';
import { t } from '@/i18n/fr';
import { moveItem, normalizeSupersets } from '@/lib/routineOrder';
import {
  ActionBand,
  AddRow,
  Card,
  ConfirmSheet,
  ReorderableList,
  SectionTitle,
} from '@/ui';
import { HistoryExerciseEditor } from './HistoryExerciseEditor';
import { HistoryExercisePickerSheet } from './HistoryExercisePickerSheet';
import { HistoryWorkoutFields } from './HistoryWorkoutFields';
import {
  archivedDraftFromHistory,
  draftFromArchivedDetail,
  localDateValue,
  localTimeValue,
  removeHistoryExerciseDraft,
  timestampFromHistoryInputs,
  type HistoryWorkoutDraft,
} from './historyDraft';

type EditValues = {
  draft: HistoryWorkoutDraft;
  dateValue: string;
  timeValue: string;
};

type EditorState = {
  workoutId: string;
  current: EditValues;
  baseline: EditValues;
};

const copyValues = (values: EditValues): EditValues =>
  structuredClone(values);

export function HistoryEditScreen() {
  const { workoutId = '' } = useParams();
  const navigate = useNavigate();
  const detail = useLiveQuery(
    () => getArchivedWorkoutDetail(workoutId),
    [workoutId],
  );
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const proceedingRef = useRef(false);

  if (detail !== undefined && detail !== null && editor?.workoutId !== detail.workout.id) {
    const draft = draftFromArchivedDetail(detail);
    const values = {
      draft,
      dateValue: localDateValue(draft.startedAt),
      timeValue: localTimeValue(draft.startedAt),
    };
    setEditor({
      workoutId: detail.workout.id,
      current: values,
      baseline: copyValues(values),
    });
  }

  const dirty =
    editor !== null &&
    JSON.stringify(editor.current) !== JSON.stringify(editor.baseline);
  const blocker = useBlocker(
    dirty && detail !== null && savedWorkoutId === null,
  );

  useEffect(() => {
    if (detail !== null) return;
    void navigate('/history', {
      replace: true,
      state: { historyNotice: 'missing' },
    });
  }, [detail, navigate]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (savedWorkoutId === null) return;
    void navigate(`/history/${savedWorkoutId}`, { replace: true });
  }, [navigate, savedWorkoutId]);

  const updateValues = (update: (values: EditValues) => EditValues) => {
    setEditor((current) =>
      current === null
        ? current
        : { ...current, current: update(current.current) },
    );
  };

  const goBack = () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate(`/history/${workoutId}`);
  };

  const save = async () => {
    if (editor === null) return;
    setValidationError(null);
    setSaveFailed(false);

    const startedAt = timestampFromHistoryInputs(
      editor.current.draft.startedAt,
      editor.current.dateValue,
      editor.current.timeValue,
    );
    if (startedAt === null) {
      setValidationError(t('history.editInvalidDate'));
      return;
    }
    if (editor.current.draft.name.trim() === '') {
      setValidationError(t('history.editInvalidName'));
      return;
    }

    const nextDraft = {
      ...editor.current.draft,
      name: editor.current.draft.name.trim(),
      startedAt,
    };
    const nextValues = { ...editor.current, draft: nextDraft };

    setSaving(true);
    try {
      await saveArchivedWorkout(archivedDraftFromHistory(nextDraft));
      setEditor({
        ...editor,
        current: nextValues,
        baseline: copyValues(nextValues),
      });
      setSavedWorkoutId(editor.workoutId);
    } catch {
      setSaveFailed(true);
      setSaving(false);
    }
  };

  if (detail === undefined || detail === null || editor === null) {
    return (
      <Screen title="" onBack={goBack}>
        <div aria-hidden="true" className="space-y-4">
          <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
          <div className="h-80 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
        </div>
      </Screen>
    );
  }

  const { current } = editor;
  const setDraft = (draft: HistoryWorkoutDraft) =>
    updateValues((values) => ({ ...values, draft }));

  return (
    <Screen
      title={t('history.editTitle')}
      onBack={goBack}
      footer={
        <ActionBand
          label={t('history.editSave')}
          disabled={saving}
          onClick={() => void save()}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {(validationError !== null || saveFailed) && (
          <div role="alert">
            <Card padded>
              <p className="text-sm leading-relaxed text-[var(--danger-ink)]">
                {validationError ?? t('history.editSaveError')}
              </p>
            </Card>
          </div>
        )}

        <HistoryWorkoutFields
          draft={current.draft}
          dateValue={current.dateValue}
          timeValue={current.timeValue}
          onDraftChange={setDraft}
          onDateChange={(dateValue) =>
            updateValues((values) => ({ ...values, dateValue }))
          }
          onTimeChange={(timeValue) =>
            updateValues((values) => ({ ...values, timeValue }))
          }
        />

        <section>
          <SectionTitle>{t('history.editExercises')}</SectionTitle>
          <ReorderableList
            className="flex flex-col gap-3"
            items={current.draft.exercises}
            keyOf={(exercise) => exercise.draftId}
            onReorder={(from, to) =>
              setDraft({
                ...current.draft,
                exercises: normalizeSupersets(
                  moveItem(current.draft.exercises, from, to),
                ),
              })
            }
            renderItem={(exercise, _index, state) => (
              <HistoryExerciseEditor
                exercise={exercise}
                state={state}
                onChange={(nextExercise) =>
                  setDraft({
                    ...current.draft,
                    exercises: current.draft.exercises.map((candidate) =>
                      candidate.draftId === nextExercise.draftId
                        ? nextExercise
                        : candidate,
                    ),
                  })
                }
                onRemove={() =>
                  setDraft({
                    ...current.draft,
                    exercises: removeHistoryExerciseDraft(
                      current.draft.exercises,
                      exercise.draftId,
                    ),
                  })
                }
              />
            )}
          />
          <div className="mt-3">
            <Card>
              <AddRow
                label={t('history.editAddExercise')}
                onClick={() => setPickerOpen(true)}
              />
            </Card>
          </div>
        </section>
      </div>

      <HistoryExercisePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(exercise) =>
          setDraft({
            ...current.draft,
            exercises: [...current.draft.exercises, exercise],
          })
        }
      />

      <ConfirmSheet
        open={blocker.state === 'blocked'}
        onClose={() => {
          if (!proceedingRef.current && blocker.state === 'blocked') blocker.reset();
        }}
        title={t('history.editDiscardTitle')}
        body={t('history.editDiscardBody')}
        confirmLabel={t('history.editDiscardConfirm')}
        danger
        onConfirm={() => {
          if (blocker.state !== 'blocked') return;
          proceedingRef.current = true;
          blocker.proceed();
        }}
      />
    </Screen>
  );
}

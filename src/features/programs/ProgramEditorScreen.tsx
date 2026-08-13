import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import {
  ProgramRepositoryError,
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  getProgramDetail,
  replaceProgramWeeks,
} from '@/data/repositories/programs';
import { listRoutineSummaries } from '@/data/repositories/routines';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { ActionBand } from '@/ui';
import { ProgramBasicsStep } from './ProgramBasicsStep';
import type { ProgramBasicsDraft } from './ProgramBasicsStep';
import { ProgramSplitStep } from './ProgramSplitStep';
import type { ProgramSplitDraftEntry } from './ProgramSplitStep';
import { ProgramWeeksStep } from './ProgramWeeksStep';
import type { ProgramWeekDraft } from './ProgramWeeksStep';

type ProgramEditorStep = 'basics' | 'split' | 'weeks';

const STEP_NUMBER: Record<ProgramEditorStep, number> = { basics: 1, split: 2, weeks: 3 };
const STEP_NAME: Record<ProgramEditorStep, TranslationKey> = {
  basics: 'program.stepBasics',
  split: 'program.stepSplit',
  weeks: 'program.stepWeeks',
};

const emptySplit = (): ProgramSplitDraftEntry[] => [
  { routineId: '', dayOfWeek: 1, order: 0 },
];

const defaultWeeks = (durationWeeks: number): ProgramWeekDraft[] =>
  Array.from({ length: durationWeeks }, (_, weekIndex) => ({
    weekIndex,
    prescriptionKind: 'percent_1rm',
    prescriptionValue: 70,
    isDeload: 0,
  }));

function formatLocalDate(timestamp: number): string {
  if (timestamp <= 0) return '';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return 0;
  return date.getTime();
}

function orderedSplit(entries: ProgramSplitDraftEntry[]): ProgramSplitDraftEntry[] {
  const orders = new Map<number, number>();
  return entries.map((entry) => {
    const order = orders.get(entry.dayOfWeek) ?? 0;
    orders.set(entry.dayOfWeek, order + 1);
    return { ...entry, order };
  });
}

function repositoryErrorKey(error: unknown): TranslationKey {
  if (error instanceof ProgramRepositoryError) {
    if (error.code === 'another_program_active') return 'program.errorAnotherActive';
    if (error.code === 'routine_missing') return 'program.errorRoutineMissing';
  }
  return 'program.errorSave';
}

export function ProgramEditorScreen() {
  const { id: routeProgramId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<ProgramEditorStep>('basics');
  const [basics, setBasics] = useState<ProgramBasicsDraft>({
    name: '',
    startsAt: 0,
    durationWeeks: 8,
  });
  const [dateValue, setDateValue] = useState('');
  const [split, setSplit] = useState<ProgramSplitDraftEntry[]>(emptySplit);
  const [weeks, setWeeks] = useState<ProgramWeekDraft[]>(() => defaultWeeks(8));
  const [programId, setProgramId] = useState(routeProgramId ?? '');
  const [hydratedId, setHydratedId] = useState('');
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);

  const existing = useLiveQuery(
    () => (routeProgramId === undefined ? Promise.resolve(null) : getProgramDetail(routeProgramId)),
    [routeProgramId],
  );
  const routines = useLiveQuery(listRoutineSummaries);

  if (routeProgramId !== undefined && existing !== undefined && existing !== null && hydratedId !== routeProgramId) {
    const initialRevision = existing.revisions[0];
    setBasics({
      name: existing.program.name,
      startsAt: existing.program.startsAt,
      durationWeeks: existing.program.durationWeeks,
    });
    setDateValue(formatLocalDate(existing.program.startsAt));
    setSplit(
      initialRevision === undefined
        ? emptySplit()
        : initialRevision.entries.map(({ routineId, dayOfWeek, order }) => ({
            routineId,
            dayOfWeek,
            order,
          })),
    );
    setWeeks(
      existing.weeks.length === existing.program.durationWeeks
        ? existing.weeks.map(({ weekIndex, prescriptionKind, prescriptionValue, isDeload }) => ({
            weekIndex,
            prescriptionKind,
            prescriptionValue,
            isDeload,
          }))
        : defaultWeeks(existing.program.durationWeeks),
    );
    setProgramId(routeProgramId);
    setHydratedId(routeProgramId);
  }

  const goBack = () => {
    setErrorKey(null);
    if (step === 'weeks') setStep('split');
    else if (step === 'split') setStep('basics');
    else {
      const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (index > 0) void navigate(-1);
      else void navigate('/programs');
    }
  };

  const completeStep = async () => {
    if (saving) return;
    setErrorKey(null);

    if (step === 'basics') {
      const valid =
        basics.name.trim().length > 0 &&
        basics.startsAt > 0 &&
        new Date(basics.startsAt).getDay() === 1 &&
        Number.isInteger(basics.durationWeeks) &&
        basics.durationWeeks >= 4 &&
        basics.durationWeeks <= 12;
      if (!valid) {
        setErrorKey('program.errorBasics');
        return;
      }
    } else if (step === 'split') {
      if (
        split.length === 0 ||
        split.some(
          (entry) => entry.routineId === '' || entry.dayOfWeek < 1 || entry.dayOfWeek > 7,
        )
      ) {
        setErrorKey('program.errorSplit');
        return;
      }
    } else {
      const invalidWeek = weeks.some((week) =>
        week.prescriptionKind === 'percent_1rm'
          ? week.prescriptionValue <= 0 || week.prescriptionValue > 100
          : week.prescriptionValue < 6 || week.prescriptionValue > 10,
      );
      if (weeks.length !== basics.durationWeeks || invalidWeek) {
        setErrorKey('program.errorWeeks');
        return;
      }
    }

    setSaving(true);
    try {
      if (step === 'basics') {
        let nextProgramId = programId;
        if (nextProgramId === '') {
          const program = await createProgramDraft({ ...basics, name: basics.name.trim() });
          nextProgramId = program.id;
          setProgramId(program.id);
        }
        if (weeks.length !== basics.durationWeeks) setWeeks(defaultWeeks(basics.durationWeeks));
        setStep('split');
      } else if (step === 'split') {
        await createScheduleRevision(programId, 0, orderedSplit(split));
        setStep('weeks');
      } else {
        await replaceProgramWeeks(programId, weeks);
        await activateProgram(programId);
        void navigate(`/programs/${programId}`);
      }
    } catch (error) {
      setErrorKey(repositoryErrorKey(error));
    } finally {
      setSaving(false);
    }
  };

  if (routeProgramId !== undefined && existing === null) {
    return (
      <Screen title={t('program.notFound')} onBack={goBack}>
        <span />
      </Screen>
    );
  }

  if (routeProgramId !== undefined && (existing === undefined || hydratedId !== routeProgramId)) {
    return (
      <Screen title={t('program.editTitle')} onBack={goBack}>
        <p className="text-[var(--text-2)]">{t('program.loading')}</p>
      </Screen>
    );
  }

  return (
    <Screen
      title={routeProgramId === undefined ? t('program.newTitle') : t('program.editTitle')}
      onBack={goBack}
      footer={
        <ActionBand
          label={step === 'weeks' ? t('program.activate') : t('program.continue')}
          disabled={saving || (step === 'split' && routines?.length === 0)}
          onClick={() => void completeStep()}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <nav aria-label={t('program.stepProgress', { current: STEP_NUMBER[step], name: t(STEP_NAME[step]) })}>
          <ol className="grid grid-cols-3 border-b border-[var(--border)]">
            {(['basics', 'split', 'weeks'] as const).map((candidate) => (
              <li
                key={candidate}
                aria-current={candidate === step ? 'step' : undefined}
                className={`label-xs flex min-h-12 items-center justify-center border-b-2 px-1
                  font-semibold ${
                    candidate === step
                      ? 'border-[var(--accent-ink)] text-[var(--accent-ink)]'
                      : 'border-transparent text-[var(--text-2)]'
                  }`}
              >
                {t(STEP_NAME[candidate])}
              </li>
            ))}
          </ol>
        </nav>

        {errorKey && (
          <p role="alert" className="rounded-xl bg-[var(--surface-1)] p-4 text-sm leading-relaxed text-[var(--danger-ink)]">
            {t(errorKey)}
          </p>
        )}

        {step === 'basics' && (
          <ProgramBasicsStep
            value={basics}
            dateValue={dateValue}
            locked={routeProgramId !== undefined}
            onChange={setBasics}
            onDateChange={(value) => {
              setDateValue(value);
              setBasics((current) => ({ ...current, startsAt: parseLocalDate(value) }));
            }}
          />
        )}
        {step === 'split' && (
          <ProgramSplitStep entries={split} routines={routines} onChange={setSplit} />
        )}
        {step === 'weeks' && <ProgramWeeksStep weeks={weeks} onChange={setWeeks} />}
      </div>
    </Screen>
  );
}

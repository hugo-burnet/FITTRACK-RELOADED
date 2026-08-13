import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import {
  ProgramRepositoryError,
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  replaceActiveProgram,
  replaceProgramWeeks,
  replaceProgramWeeksFrom,
  updateProgramDraft,
} from '@/data/repositories/programs';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { ActionBand, ConfirmSheet, SectionTitle } from '@/ui';
import { ProgramBasicsStep } from './ProgramBasicsStep';
import type { ProgramBasicsDraft } from './ProgramBasicsStep';
import { ProgramEffectiveWeekSelect } from './ProgramEffectiveWeekSelect';
import { ProgramSplitStep } from './ProgramSplitStep';
import type { ProgramSplitDraftEntry } from './ProgramSplitStep';
import { ProgramStepNav } from './ProgramStepNav';
import type { ProgramEditorStep } from './ProgramStepNav';
import { ProgramWeeksStep } from './ProgramWeeksStep';
import type { ProgramWeekDraft } from './ProgramWeeksStep';
import {
  basicsIssue,
  defaultWeeks,
  effectiveWeekOptions,
  emptySplit,
  formatLocalDate,
  orderedSplit,
  parseLocalDate,
  repositoryErrorKey,
  resizeWeeks,
  splitForWeek,
  splitIssue,
  weeksForBlock,
  weeksIssue,
} from './programEditorModel';
import { useProgramEditorData } from './useProgramEditorData';

export function ProgramEditorScreen() {
  const { id: routeProgramId } = useParams();
  const navigate = useNavigate();
  const [editorOpenedAt] = useState(() => Date.now());
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
  const [effectiveFromWeekIndex, setEffectiveFromWeekIndex] = useState<number | null>(null);
  const [replacementOpen, setReplacementOpen] = useState(false);

  // Éditer un bloc existant, c'est un défilement : les trois sections sont là,
  // on répare celle qu'on veut. Le wizard ne sert qu'à la création, où l'ordre
  // des questions est la seule chose qui rende le formulaire tenable.
  const stacked = routeProgramId !== undefined;

  const { existing, routines, routinesReadFailed, splitBlocked } =
    useProgramEditorData(routeProgramId);

  if (routeProgramId !== undefined && existing?.status === 'found' && hydratedId !== routeProgramId) {
    const { detail, programWorkoutWeekIndexes } = existing;
    const options = effectiveWeekOptions(detail, programWorkoutWeekIndexes, editorOpenedAt);
    const initialEffectiveWeekIndex = options[0] ?? null;
    setBasics({
      name: detail.program.name,
      startsAt: detail.program.startsAt,
      durationWeeks: detail.program.durationWeeks,
    });
    setDateValue(formatLocalDate(detail.program.startsAt));
    setSplit(splitForWeek(detail, initialEffectiveWeekIndex ?? 0));
    setWeeks(weeksForBlock(detail));
    setProgramId(routeProgramId);
    if (detail.program.status === 'active') setEffectiveFromWeekIndex(initialEffectiveWeekIndex);
    setHydratedId(routeProgramId);
  }

  const existingDetail = existing?.status === 'found' ? existing.detail : null;
  const activeEdit = existingDetail?.program.status === 'active';
  const availableEffectiveWeeks =
    activeEdit && existing?.status === 'found'
      ? effectiveWeekOptions(existing.detail, existing.programWorkoutWeekIndexes, editorOpenedAt)
      : [];
  // Le passé scellé est la même semaine pour le split et pour les semaines.
  const sealedBefore = activeEdit ? (effectiveFromWeekIndex ?? 0) : 0;

  const leaveEditor = () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate(stacked ? `/programs/${programId}` : '/programs');
  };

  const goBack = () => {
    setErrorKey(null);
    if (stacked) leaveEditor();
    else if (step === 'weeks') setStep('split');
    else if (step === 'split') setStep('basics');
    else leaveEditor();
  };

  const changeBasics = (next: ProgramBasicsDraft) => {
    if (next.durationWeeks !== basics.durationWeeks) {
      setWeeks((current) => resizeWeeks(current, next.durationWeeks));
    }
    setBasics(next);
  };

  // Changer la semaine d'entrée en vigueur rejoue l'état persisté : ce qu'on
  // voit est exactement ce qui sera écrit à partir de cette semaine.
  const changeEffectiveWeek = (weekIndex: number) => {
    if (existingDetail === null) return;
    setEffectiveFromWeekIndex(weekIndex);
    setSplit(splitForWeek(existingDetail, weekIndex));
    setWeeks(weeksForBlock(existingDetail));
  };

  const runSave = async (write: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    try {
      await write();
    } catch (error) {
      if (error instanceof ProgramRepositoryError && error.code === 'another_program_active') {
        setReplacementOpen(true);
      } else {
        setErrorKey(repositoryErrorKey(error));
      }
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    setErrorKey(null);
    const issue =
      basicsIssue(basics) ?? splitIssue(split) ?? weeksIssue(weeks, basics.durationWeeks);
    if (issue !== null) {
      setErrorKey(issue);
      return;
    }
    await runSave(async () => {
      await updateProgramDraft(programId, { ...basics, name: basics.name.trim() });
      await createScheduleRevision(programId, 0, orderedSplit(split));
      await replaceProgramWeeks(programId, weeks);
      void navigate(`/programs/${programId}`);
    });
  };

  const saveRevision = async () => {
    setErrorKey(null);
    if (
      effectiveFromWeekIndex === null ||
      !availableEffectiveWeeks.includes(effectiveFromWeekIndex)
    ) {
      setErrorKey('program.errorNoFutureRevision');
      return;
    }
    const issue = splitIssue(split) ?? weeksIssue(weeks, basics.durationWeeks);
    if (issue !== null) {
      setErrorKey(issue);
      return;
    }
    await runSave(async () => {
      await createScheduleRevision(programId, effectiveFromWeekIndex, orderedSplit(split));
      await replaceProgramWeeksFrom(programId, effectiveFromWeekIndex, weeks);
      void navigate(`/programs/${programId}`);
    });
  };

  const completeStep = async () => {
    setErrorKey(null);
    const issue =
      step === 'basics'
        ? basicsIssue(basics)
        : step === 'split'
          ? splitIssue(split)
          : weeksIssue(weeks, basics.durationWeeks);
    if (issue !== null) {
      setErrorKey(issue);
      return;
    }

    await runSave(async () => {
      if (step === 'basics') {
        if (programId === '') {
          const program = await createProgramDraft({ ...basics, name: basics.name.trim() });
          setProgramId(program.id);
        } else {
          await updateProgramDraft(programId, { ...basics, name: basics.name.trim() });
        }
        setStep('split');
      } else if (step === 'split') {
        await createScheduleRevision(programId, 0, orderedSplit(split));
        setStep('weeks');
      } else {
        await replaceProgramWeeks(programId, weeks);
        await activateProgram(programId);
        void navigate(`/programs/${programId}`);
      }
    });
  };

  const confirmReplacement = async () => {
    if (programId === '') return;
    setErrorKey(null);
    await runSave(async () => {
      await replaceActiveProgram(programId);
      void navigate(`/programs/${programId}`);
    });
  };

  if (routeProgramId !== undefined && existing?.status === 'error') {
    return (
      <Screen title={t('program.editTitle')} onBack={goBack}>
        <p className="text-[var(--text-2)]">{t('program.errorRead')}</p>
      </Screen>
    );
  }

  if (routeProgramId !== undefined && existing?.status === 'not_found') {
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

  const splitSection = routinesReadFailed ? (
    <p role="alert" className="text-sm leading-relaxed text-[var(--danger-ink)]">
      {t('program.routinesReadError')}
    </p>
  ) : (
    <ProgramSplitStep entries={split} routines={routines} onChange={setSplit} />
  );

  return (
    <Screen
      title={stacked ? t('program.editTitle') : t('program.newTitle')}
      onBack={goBack}
      footer={
        <ActionBand
          label={
            activeEdit
              ? effectiveFromWeekIndex === null
                ? t('program.saveRevision')
                : t('program.saveRevisionWeek', { number: effectiveFromWeekIndex + 1 })
              : stacked
                ? t('program.saveDraft')
                : step === 'weeks'
                  ? t('program.activate')
                  : t('program.continue')
          }
          disabled={
            saving ||
            ((stacked || step === 'split') && splitBlocked) ||
            (activeEdit && effectiveFromWeekIndex === null)
          }
          onClick={() =>
            void (activeEdit ? saveRevision() : stacked ? saveDraft() : completeStep())
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        {!stacked && <ProgramStepNav step={step} />}

        {errorKey && (
          <p role="alert" className="rounded-xl bg-[var(--surface-1)] p-4 text-sm leading-relaxed text-[var(--danger-ink)]">
            {t(errorKey)}
          </p>
        )}

        {stacked ? (
          <>
            {/*
              Un bloc actif n'a plus de cadre à régler : son nom et sa durée sont
              posés, sa date se décale depuis la fiche. Ce qui reste à corriger,
              c'est la suite — d'où le sélecteur en tête.
            */}
            {activeEdit ? (
              <ProgramEffectiveWeekSelect
                weeks={availableEffectiveWeeks}
                value={effectiveFromWeekIndex}
                onChange={changeEffectiveWeek}
              />
            ) : (
              <section>
                <SectionTitle>{t('program.stepBasics')}</SectionTitle>
                <ProgramBasicsStep
                  value={basics}
                  dateValue={dateValue}
                  onChange={changeBasics}
                  onDateChange={(value) => {
                    setDateValue(value);
                    changeBasics({ ...basics, startsAt: parseLocalDate(value) });
                  }}
                />
              </section>
            )}
            <section>
              <SectionTitle>{t('program.stepSplit')}</SectionTitle>
              {splitSection}
            </section>
            <section>
              <SectionTitle>{t('program.stepWeeks')}</SectionTitle>
              <ProgramWeeksStep
                weeks={weeks}
                onChange={setWeeks}
                effectiveFromWeekIndex={sealedBefore}
              />
            </section>
          </>
        ) : (
          <>
            {step === 'basics' && (
              <ProgramBasicsStep
                value={basics}
                dateValue={dateValue}
                onChange={changeBasics}
                onDateChange={(value) => {
                  setDateValue(value);
                  changeBasics({ ...basics, startsAt: parseLocalDate(value) });
                }}
              />
            )}
            {step === 'split' && splitSection}
            {step === 'weeks' && <ProgramWeeksStep weeks={weeks} onChange={setWeeks} />}
          </>
        )}
      </div>
      <ConfirmSheet
        open={replacementOpen}
        onClose={() => setReplacementOpen(false)}
        title={t('program.replaceActiveTitle')}
        body={t('program.replaceActiveBody')}
        confirmLabel={t('program.replaceActiveConfirm')}
        onConfirm={() => void confirmReplacement()}
      />
    </Screen>
  );
}

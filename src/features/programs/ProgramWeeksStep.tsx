import { useState } from 'react';
import { PROGRAM_PHASES, type ProgramPhase } from '@/data/types';
import { MAX_LOAD_INDEX, MIN_LOAD_INDEX } from '@/lib/programs';
import { t } from '@/i18n/fr';
import { Button, ListRow, NumberInput, Sheet } from '@/ui';
import {
  LOAD_INDEX_PRESETS,
  PHASE_LABEL_KEYS,
  SUGGESTED_LOAD_INDEX,
  phaseIntention,
  phaseLabel,
  weekLine,
} from './weekReading';

export interface ProgramWeekDraft {
  weekIndex: number;
  loadIndex: number;
  phase: ProgramPhase;
}

interface Props {
  weeks: ProgramWeekDraft[];
  onChange: (weeks: ProgramWeekDraft[]) => void;
}

interface WeekEditor {
  index: number;
  week: ProgramWeekDraft;
}

export function ProgramWeeksStep({ weeks, onChange }: Props) {
  const [editor, setEditor] = useState<WeekEditor | null>(null);

  const updateEditor = (changes: Partial<ProgramWeekDraft>) => {
    setEditor((current) =>
      current === null ? null : { ...current, week: { ...current.week, ...changes } },
    );
  };

  const setPhase = (phase: ProgramPhase) => {
    updateEditor({ phase, loadIndex: SUGGESTED_LOAD_INDEX[phase] });
  };

  const saveEditor = () => {
    if (editor === null) return;
    onChange(weeks.map((week, index) => (index === editor.index ? editor.week : week)));
    setEditor(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base leading-relaxed text-[var(--text-2)]">{t('program.weeksIntro')}</p>
      {/*
        La phase est ce qu'on cherche du regard, donc c'est le titre. Le numéro
        passe en tête de ligne, discret, et le niveau finit à droite comme toute
        lecture chiffrée de l'app. Une Décharge se signale sur ce chiffre, pas
        en repeignant le mot.
      */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
        {weeks.map((week, index) => {
          const number = index + 1;
          const deload = week.phase === 'deload';
          return (
            <ListRow
              key={week.weekIndex}
              // À l'oreille, trois colonnes valent moins qu'une phrase : on garde
              // la lecture compacte `05 — 60 % · Décharge` comme nom prononcé.
              ariaLabel={t('program.editWeekReading', { number, line: weekLine(week) })}
              leading={
                <span className="record-figure text-sm font-semibold">
                  {String(number).padStart(2, '0')}
                </span>
              }
              title={phaseLabel(week.phase)}
              {...(phaseIntention(week.phase) === null
                ? {}
                : { subtitle: phaseIntention(week.phase)! })}
              trailing={
                <span
                  className={`record-figure text-sm ${
                    deload ? 'font-semibold text-[var(--accent-ink)]' : ''
                  }`}
                >
                  {t('program.loadIndexPreset', { value: week.loadIndex })}
                </span>
              }
              onClick={() => setEditor({ index, week: { ...week } })}
            />
          );
        })}
      </div>

      <Sheet
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={t('program.editWeekTitle', { number: (editor?.index ?? 0) + 1 })}
      >
        {editor && (
          <div className="flex flex-col gap-6 pb-5">
            <label className="flex flex-col gap-2">
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('program.phaseLabel')}
              </span>
              <select
                aria-label={t('program.phaseLabel')}
                value={editor.week.phase}
                onChange={(event) => setPhase(event.target.value as ProgramPhase)}
                className="min-h-12 rounded-lg bg-[var(--surface-2)] px-4 text-base
                  text-[var(--text-1)] outline-none focus:ring-2 focus:ring-[var(--accent-ink)]"
              >
                {PROGRAM_PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {t(PHASE_LABEL_KEYS[phase])}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-2">
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('program.loadIndexLabel')}
              </span>
              <div className="grid grid-cols-5 gap-2">
                {LOAD_INDEX_PRESETS.map((value) => {
                  const active = editor.week.loadIndex === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      aria-label={t('program.loadIndexPreset', { value })}
                      onClick={() => updateEditor({ loadIndex: value })}
                      className={`record-figure min-h-12 rounded-xl text-sm font-semibold
                        transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                        ${
                          active
                            ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                            : 'bg-[var(--surface-2)] text-[var(--text-1)]'
                        }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              <NumberInput
                aria-label={t('program.loadIndexLabel')}
                value={editor.week.loadIndex}
                onChange={(loadIndex) => updateEditor({ loadIndex: loadIndex ?? 100 })}
                step={1}
                min={MIN_LOAD_INDEX}
                max={MAX_LOAD_INDEX}
                integer
                suffix="%"
              />
            </div>

            {phaseIntention(editor.week.phase) !== null && (
              <p className="text-sm leading-relaxed text-[var(--text-2)]">
                {phaseIntention(editor.week.phase)}
              </p>
            )}

            <Button type="button" variant="primary" fullWidth onClick={saveEditor}>
              {t('program.saveWeek')}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

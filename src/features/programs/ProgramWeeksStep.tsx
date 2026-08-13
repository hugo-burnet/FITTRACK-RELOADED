import { useState } from 'react';
import type { ProgramPhase } from '@/data/types';
import { t } from '@/i18n/fr';
import { Button, Card, NumberInput, Sheet, Toggle } from '@/ui';

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

const intentionLabel = (week: ProgramWeekDraft) =>
  t('program.percentReading', { value: week.loadIndex });

export function ProgramWeeksStep({ weeks, onChange }: Props) {
  const [editor, setEditor] = useState<WeekEditor | null>(null);

  const updateEditor = (changes: Partial<ProgramWeekDraft>) => {
    setEditor((current) =>
      current === null ? null : { ...current, week: { ...current.week, ...changes } },
    );
  };

  const saveEditor = () => {
    if (editor === null) return;
    onChange(weeks.map((week, index) => (index === editor.index ? editor.week : week)));
    setEditor(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base leading-relaxed text-[var(--text-2)]">{t('program.weeksIntro')}</p>
      <Card>
        <div className="divide-y divide-[var(--border)]">
          {weeks.map((week, index) => {
            const number = index + 1;
            const prescription = intentionLabel(week);
            return (
              <button
                key={week.weekIndex}
                type="button"
                aria-label={t('program.editWeekReading', {
                  number,
                  prescription,
                  deload: week.phase === 'deload' ? `, ${t('program.deload')}` : '',
                })}
                onClick={() => setEditor({ index, week: { ...week } })}
                className="grid min-h-14 w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center
                  gap-3 px-4 text-left active:bg-[var(--surface-2)]"
              >
                <span className="record-figure text-sm font-semibold text-[var(--text-2)]">
                  {String(number).padStart(2, '0')}
                </span>
                <span className="record-figure truncate text-base text-[var(--text-1)]">
                  {prescription}
                </span>
                <span className="label-xs font-semibold text-[var(--accent-ink)]">
                  {week.phase === 'deload' ? t('program.deload') : ''}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Sheet
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={t('program.editWeekTitle', { number: (editor?.index ?? 0) + 1 })}
      >
        {editor && (
          <div className="flex flex-col gap-6 pb-5">
            <div className="flex flex-col gap-2">
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('program.prescriptionValue')}
              </span>
              <NumberInput
                aria-label={t('program.prescriptionValue')}
                value={editor.week.loadIndex}
                onChange={(loadIndex) => updateEditor({ loadIndex: loadIndex ?? 100 })}
                step={1}
                suffix="%"
              />
            </div>
            <div className="flex min-h-12 items-center justify-between gap-4">
              <span className="text-base text-[var(--text-1)]">{t('program.deloadToggle')}</span>
              <Toggle
                label={t('program.deloadToggle')}
                mark={t('program.deload')}
                checked={editor.week.phase === 'deload'}
                onChange={() =>
                  updateEditor({
                    phase: editor.week.phase === 'deload' ? 'construction' : 'deload',
                  })
                }
              />
            </div>
            <Button type="button" variant="primary" fullWidth onClick={saveEditor}>
              {t('program.saveWeek')}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

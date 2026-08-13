import { useState } from 'react';
import type { ProgramPrescriptionKind } from '@/data/types';
import { t } from '@/i18n/fr';
import { Button, Card, NumberInput, Sheet, Toggle } from '@/ui';

export interface ProgramWeekDraft {
  weekIndex: number;
  prescriptionKind: ProgramPrescriptionKind;
  prescriptionValue: number;
  isDeload: 0 | 1;
}

interface Props {
  weeks: ProgramWeekDraft[];
  onChange: (weeks: ProgramWeekDraft[]) => void;
}

interface WeekEditor {
  index: number;
  week: ProgramWeekDraft;
}

const prescriptionLabel = (week: ProgramWeekDraft) =>
  week.prescriptionKind === 'percent_1rm'
    ? t('program.percentReading', { value: week.prescriptionValue })
    : t('program.rpeReading', { value: week.prescriptionValue });

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
            return (
              <button
                key={week.weekIndex}
                type="button"
                aria-label={t('program.editWeek', { number })}
                onClick={() => setEditor({ index, week: { ...week } })}
                className="grid min-h-14 w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center
                  gap-3 px-4 text-left active:bg-[var(--surface-2)]"
              >
                <span className="record-figure text-sm font-semibold text-[var(--text-2)]">
                  {String(number).padStart(2, '0')}
                </span>
                <span className="record-figure truncate text-base text-[var(--text-1)]">
                  {prescriptionLabel(week)}
                </span>
                <span className="label-xs font-semibold text-[var(--accent-ink)]">
                  {week.isDeload === 1 ? t('program.deload') : ''}
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
            <label className="flex flex-col gap-2">
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('program.prescriptionKind')}
              </span>
              <select
                aria-label={t('program.prescriptionKind')}
                value={editor.week.prescriptionKind}
                onChange={(event) => {
                  const prescriptionKind = event.target.value as ProgramPrescriptionKind;
                  updateEditor({
                    prescriptionKind,
                    prescriptionValue: prescriptionKind === 'percent_1rm' ? 70 : 8,
                  });
                }}
                className="min-h-12 rounded-lg bg-[var(--surface-2)] px-4 text-base
                  text-[var(--text-1)] outline-none focus:ring-2 focus:ring-[var(--accent-ink)]"
              >
                <option value="percent_1rm">{t('program.percentOneRm')}</option>
                <option value="target_rpe">{t('program.targetRpe')}</option>
              </select>
            </label>
            <div className="flex flex-col gap-2">
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('program.prescriptionValue')}
              </span>
              <NumberInput
                aria-label={t('program.prescriptionValue')}
                value={editor.week.prescriptionValue}
                onChange={(prescriptionValue) =>
                  updateEditor({ prescriptionValue: prescriptionValue ?? 0 })
                }
                step={editor.week.prescriptionKind === 'percent_1rm' ? 1 : 0.5}
                min={editor.week.prescriptionKind === 'percent_1rm' ? 1 : 6}
                max={editor.week.prescriptionKind === 'percent_1rm' ? 100 : 10}
                suffix={editor.week.prescriptionKind === 'percent_1rm' ? '%' : undefined}
              />
            </div>
            <div className="flex min-h-12 items-center justify-between gap-4">
              <span className="text-base text-[var(--text-1)]">{t('program.deloadToggle')}</span>
              <Toggle
                label={t('program.deloadToggle')}
                mark={t('program.deload')}
                checked={editor.week.isDeload === 1}
                onChange={() => updateEditor({ isDeload: editor.week.isDeload === 1 ? 0 : 1 })}
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

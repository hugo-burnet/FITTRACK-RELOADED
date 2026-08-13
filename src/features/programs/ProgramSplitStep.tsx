import type { RoutineSummary } from '@/data/repositories/routines';
import { t } from '@/i18n/fr';
import { Button, Card } from '@/ui';

export interface ProgramSplitDraftEntry {
  routineId: string;
  dayOfWeek: number;
  order: number;
}

interface Props {
  entries: ProgramSplitDraftEntry[];
  routines: RoutineSummary[] | undefined;
  onChange: (entries: ProgramSplitDraftEntry[]) => void;
}

const selectClass = `min-h-12 w-full rounded-lg bg-[var(--surface-2)] px-3 text-base
  text-[var(--text-1)] outline-none focus:ring-2 focus:ring-[var(--accent-ink)]`;

const dayLabel = (day: number) =>
  t(`program.weekday${day}` as
    | 'program.weekday1'
    | 'program.weekday2'
    | 'program.weekday3'
    | 'program.weekday4'
    | 'program.weekday5'
    | 'program.weekday6'
    | 'program.weekday7');

export function ProgramSplitStep({ entries, routines, onChange }: Props) {
  const updateEntry = (index: number, changes: Partial<ProgramSplitDraftEntry>) => {
    onChange(entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...changes } : entry)));
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base leading-relaxed text-[var(--text-2)]">{t('program.splitIntro')}</p>
      {routines !== undefined && routines.length === 0 ? (
        <p className="rounded-2xl bg-[var(--surface-1)] p-4 leading-relaxed text-[var(--text-2)]">
          {t('program.noRoutines')}
        </p>
      ) : (
        <Card>
          <div className="divide-y divide-[var(--border)]">
            {entries.map((entry, index) => {
              const number = index + 1;
              return (
                <section key={index} className="flex flex-col gap-4 p-4">
                  <div className="flex min-h-12 items-center justify-between gap-3">
                    <h2 className="label-xs font-semibold text-[var(--text-2)]">
                      {t('program.session', { number })}
                    </h2>
                    {entries.length > 1 && (
                      <button
                        type="button"
                        aria-label={t('program.removeSession', { number })}
                        onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}
                        className="min-h-12 rounded-xl px-3 text-sm font-semibold text-[var(--danger-ink)]
                          active:bg-[var(--surface-2)]"
                      >
                        {t('program.removeSession', { number })}
                      </button>
                    )}
                  </div>
                  <label className="flex flex-col gap-2">
                    <span className="label-xs font-semibold text-[var(--text-2)]">
                      {t('program.sessionDayLabel', { number })}
                    </span>
                    <select
                      aria-label={t('program.sessionDayLabel', { number })}
                      value={entry.dayOfWeek}
                      onChange={(event) => updateEntry(index, { dayOfWeek: Number(event.target.value) })}
                      className={selectClass}
                    >
                      {Array.from({ length: 7 }, (_, dayIndex) => dayIndex + 1).map((day) => (
                        <option key={day} value={day}>{dayLabel(day)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="label-xs font-semibold text-[var(--text-2)]">
                      {t('program.sessionRoutineLabel', { number })}
                    </span>
                    <select
                      aria-label={t('program.sessionRoutineLabel', { number })}
                      value={entry.routineId}
                      disabled={routines === undefined}
                      onChange={(event) => updateEntry(index, { routineId: event.target.value })}
                      className={selectClass}
                    >
                      <option value="">
                        {routines === undefined ? t('program.routinesLoading') : t('program.chooseRoutine')}
                      </option>
                      {(routines ?? []).map(({ routine }) => (
                        <option key={routine.id} value={routine.id}>{routine.name}</option>
                      ))}
                    </select>
                  </label>
                </section>
              );
            })}
            <div className="p-2">
              <Button
                type="button"
                variant="ghost"
                fullWidth
                onClick={() =>
                  onChange([...entries, { routineId: '', dayOfWeek: 1, order: 0 }])
                }
              >
                {t('program.addSession')}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

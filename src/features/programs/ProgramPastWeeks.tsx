import { t } from '@/i18n/fr';
import { weeklyVolumeReading } from '@/i18n/labels';
import { Card, SectionTitle } from '@/ui';
import type { PastWeek } from './pastWeeks';
import { DayColumn, RowText, RowTrailing } from './programRows';
import { PRESSABLE_ROW_CLASS, WEEK_ROW_CLASS, dayDateReading } from './programRowStyle';
import { weekLine } from './weekReading';

/**
 * La frise des semaines écoulées : une `Card` par semaine, son en-tête (« 02 —
 * 105 % · Progression », séances faites sur prévues) puis ses séances. Chaque
 * séance faite mène à sa fiche d'historique — c'est le lien qui manquait entre
 * un programme et ce qui s'y est vraiment passé.
 */
export function ProgramPastWeeks({
  weeks,
  onOpenWorkout,
}: {
  weeks: PastWeek[];
  onOpenWorkout: (workoutId: string) => void;
}) {
  if (weeks.length === 0) return null;
  return (
    <section>
      <SectionTitle>{t('program.detailPastTitle')}</SectionTitle>
      <div className="flex flex-col gap-4">
        {weeks.map(({ week, done, planned, rows }) => (
          <Card key={week.weekIndex}>
            <div className={WEEK_ROW_CLASS}>
              <span
                className={`metric min-w-0 flex-1 truncate text-base font-semibold ${
                  week.phase === 'deload' ? 'text-[var(--accent-ink)]' : 'text-[var(--text-1)]'
                }`}
              >
                {weekLine(week)}
              </span>
              <RowTrailing>
                <span className="metric">{t('program.detailPastCount', { done, planned })}</span>
              </RowTrailing>
            </div>
            {rows.map((row) => {
              const name = row.name ?? t('program.missingRoutine');
              const date = dayDateReading(row.date);
              if (row.workoutId === undefined) {
                return (
                  <div key={row.key} className={WEEK_ROW_CLASS}>
                    <DayColumn dayOfWeek={row.dayOfWeek} />
                    <RowText title={name} subtitle={date} muted />
                    <RowTrailing>{t('program.sessionMissed')}</RowTrailing>
                  </div>
                );
              }
              const { workoutId } = row;
              return (
                <button
                  key={row.key}
                  type="button"
                  aria-label={t('program.detailOpenSession', { name, date })}
                  onClick={() => onOpenWorkout(workoutId)}
                  className={PRESSABLE_ROW_CLASS}
                >
                  <DayColumn dayOfWeek={row.dayOfWeek} />
                  <RowText
                    title={name}
                    subtitle={t('program.detailSessionDate', {
                      date,
                      tonnage: weeklyVolumeReading(row.tonnage ?? 0, 'tonnage'),
                    })}
                  />
                  <RowTrailing chevron />
                </button>
              );
            })}
          </Card>
        ))}
      </div>
    </section>
  );
}

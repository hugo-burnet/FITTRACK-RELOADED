import { t } from '@/i18n/fr';
import { Card, Input } from '@/ui';

export interface ProgramBasicsDraft {
  name: string;
  startsAt: number;
  durationWeeks: number;
}

interface Props {
  value: ProgramBasicsDraft;
  dateValue: string;
  locked?: boolean;
  onChange: (value: ProgramBasicsDraft) => void;
  onDateChange: (value: string) => void;
}

export function ProgramBasicsStep({ value, dateValue, locked = false, onChange, onDateChange }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-base leading-relaxed text-[var(--text-2)]">{t('program.basicsIntro')}</p>
      <Card padded>
        <div className="flex flex-col gap-5">
          <Input
            label={t('program.nameLabel')}
            placeholder={t('program.namePlaceholder')}
            value={value.name}
            disabled={locked}
            enterKeyHint="done"
            onChange={(event) => onChange({ ...value, name: event.target.value })}
          />
          <div className="flex flex-col gap-2">
            <Input
              label={t('program.startsAtLabel')}
              type="date"
              value={dateValue}
              disabled={locked}
              onChange={(event) => onDateChange(event.target.value)}
            />
            {/* La contrainte est écrite là où elle s'applique. Le champ accepte
                n'importe quel jour et c'est « Continuer » qui refusait : la
                règle n'apparaissait qu'après l'avoir enfreinte. */}
            {!locked && (
              <p className="text-sm leading-relaxed text-[var(--text-2)]">
                {t('program.startsAtHint')}
              </p>
            )}
          </div>
          <label className="flex flex-col gap-2">
            <span className="label-xs font-semibold text-[var(--text-2)]">
              {t('program.durationLabel')}
            </span>
            <select
              aria-label={t('program.durationLabel')}
              value={value.durationWeeks}
              disabled={locked}
              onChange={(event) =>
                onChange({ ...value, durationWeeks: Number(event.target.value) })
              }
              className="min-h-12 rounded-lg bg-[var(--surface-2)] px-4 text-base
                text-[var(--text-1)] outline-none focus:ring-2 focus:ring-[var(--accent-ink)]
                disabled:opacity-60"
            >
              {Array.from({ length: 9 }, (_, index) => index + 4).map((duration) => (
                <option key={duration} value={duration}>
                  {t('program.durationOption', { count: duration })}
                </option>
              ))}
            </select>
          </label>
          {locked && (
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              {t('program.existingBasicsHint')}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

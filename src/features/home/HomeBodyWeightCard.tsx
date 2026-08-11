import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getLatestBodyWeight, saveBodyWeight } from '@/data/repositories/bodyMeasurements';
import { t } from '@/i18n/fr';
import { Button, Card, NumberInput, SectionTitle } from '@/ui';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

type SaveState = 'idle' | 'saving' | 'saved' | 'updated' | 'error';

function isSameLocalDay(left: number, right: number): boolean {
  const a = new Date(left);
  const b = new Date(right);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function millisecondsUntilNextLocalDay(timestamp: number): number {
  const nextDay = new Date(timestamp);
  nextDay.setHours(24, 0, 0, 0);
  return Math.max(1, nextDay.getTime() - timestamp);
}

/** One-thumb, local-first entry point for the weight used by bodyweight tonnage. */
export function HomeBodyWeightCard() {
  const latest = useLiveQuery(async () => (await getLatestBodyWeight()) ?? null);
  const [draft, setDraft] = useState<number | undefined>();
  const [loadedMeasurement, setLoadedMeasurement] = useState<number | null | undefined>();
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dayReferenceAt, setDayReferenceAt] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDayReferenceAt(Date.now()),
      millisecondsUntilNextLocalDay(dayReferenceAt),
    );
    return () => window.clearTimeout(timer);
  }, [dayReferenceAt]);

  const measurementKey = latest === undefined ? undefined : latest?.measuredAt ?? null;
  if (measurementKey !== loadedMeasurement) {
    setLoadedMeasurement(measurementKey);
    setDraft(latest?.valueKg);
  }

  const valid = draft !== undefined && Number.isFinite(draft) && draft > 0;
  const unchangedToday =
    latest != null &&
    isSameLocalDay(latest.measuredAt, dayReferenceAt) &&
    draft === latest.valueKg;
  const disabled = !valid || unchangedToday || saveState === 'saving';

  const submit = async () => {
    if (!valid || disabled) return;

    const wasCorrection = latest != null && isSameLocalDay(latest.measuredAt, Date.now());
    setSaveState('saving');
    try {
      const saved = await saveBodyWeight(draft);
      setDraft(saved.valueKg);
      setSaveState(wasCorrection ? 'updated' : 'saved');
    } catch {
      setSaveState('error');
    }
  };

  const message =
    saveState === 'saved'
      ? t('home.bodyWeightSaved')
      : saveState === 'updated'
        ? t('home.bodyWeightUpdated')
        : saveState === 'error'
          ? t('home.bodyWeightError')
          : '\u00a0';

  return (
    <section>
      <SectionTitle>{t('home.bodyWeightSection')}</SectionTitle>
      <Card padded>
        {/* The field takes the whole row and the action sits below it, the same
            shape as the weekly goal sheet. Side by side on a 375 px screen only
            13 px of text were left between the two 48 px steppers and the "kg"
            suffix: "80,5" overflowed and its decimal was clipped. A weigh-in is
            typed, so the width belongs to the field, not to the button. */}
        <div className="space-y-3">
          <NumberInput
            aria-label={t('home.bodyWeightLabel')}
            value={draft}
            onChange={(value) => {
              setDraft(value);
              setSaveState('idle');
            }}
            step={0.1}
            min={0.1}
            max={Number.POSITIVE_INFINITY}
            suffix={t('units.kg')}
            placeholder={t('home.bodyWeightPlaceholder')}
          />
          <Button variant="primary" fullWidth disabled={disabled} onClick={() => void submit()}>
            {saveState === 'saving' ? t('home.bodyWeightSaving') : t('home.bodyWeightSave')}
          </Button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
          {latest == null
            ? t('home.bodyWeightHint')
            : t('home.bodyWeightLatest', { date: dateFormatter.format(latest.measuredAt) })}
        </p>
        <p
          role={saveState === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`mt-1 min-h-5 text-sm ${
            saveState === 'error' ? 'text-[var(--danger-ink)]' : 'text-[var(--accent-ink)]'
          }`}
        >
          {message}
        </p>
      </Card>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { getOneRepMaxFormula, setOneRepMaxFormula } from '@/data/repositories/settings';
import { t, type TranslationKey } from '@/i18n/fr';
import { estimateOneRepMax, type OneRepMaxFormula } from '@/lib/oneRepMax';
import { ListRow, OptionSheet, SectionTitle, type Option } from '@/ui';

const FORMULAS: readonly {
  value: OneRepMaxFormula;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
}[] = [
  {
    value: 'epley',
    labelKey: 'settings.oneRepMaxEpley',
    descriptionKey: 'settings.oneRepMaxEpleyHint',
  },
  {
    value: 'brzycki',
    labelKey: 'settings.oneRepMaxBrzycki',
    descriptionKey: 'settings.oneRepMaxBrzyckiHint',
  },
  {
    value: 'lombardi',
    labelKey: 'settings.oneRepMaxLombardi',
    descriptionKey: 'settings.oneRepMaxLombardiHint',
  },
];

function formulaExample(formula: OneRepMaxFormula): string {
  const estimate = estimateOneRepMax(100, 5, formula);
  const value = (Math.round((estimate ?? 0) * 10) / 10).toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return t('settings.oneRepMaxExample', { value });
}

const OPTIONS: Option<OneRepMaxFormula>[] = FORMULAS.map(({ value, labelKey, descriptionKey }) => ({
  value,
  label: t(labelKey),
  hint: `${t(descriptionKey)} ${formulaExample(value)}`,
}));

export function OneRepMaxSettings() {
  const [formula, setFormula] = useState<OneRepMaxFormula>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    void getOneRepMaxFormula().then((loaded) => {
      if (!cancelled) setFormula(loaded);
    });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);

  const chooseFormula = async (next: OneRepMaxFormula) => {
    if (saving || formula === undefined || next === formula) return;
    setSaving(true);
    setFailed(false);
    try {
      await setOneRepMaxFormula(next);
      if (mounted.current) setFormula(next);
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const selected = FORMULAS.find(({ value }) => value === formula);
  const subtitle =
    selected === undefined
      ? t('settings.oneRepMaxLoading')
      : `${t(selected.labelKey)} · ${formulaExample(selected.value)}`;

  return (
    <section>
      <SectionTitle>{t('settings.trainingSection')}</SectionTitle>
      <div className="overflow-hidden rounded-2xl bg-[var(--surface-1)]">
        <ListRow
          title={t('settings.oneRepMaxTitle')}
          subtitle={subtitle}
          disabled={formula === undefined || saving}
          onClick={() => setOpen(true)}
        />
      </div>
      {failed && (
        <p role="alert" className="mt-3 px-1 text-sm leading-relaxed text-[var(--danger-ink)]">
          {t('settings.oneRepMaxFailed')}
        </p>
      )}

      <OptionSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('settings.oneRepMaxSheetTitle')}
        options={OPTIONS}
        value={formula ?? 'epley'}
        onSelect={(next) => void chooseFormula(next)}
      />
    </section>
  );
}

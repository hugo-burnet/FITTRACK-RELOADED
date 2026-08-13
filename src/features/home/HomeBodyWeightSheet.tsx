import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getLatestBodyWeight, saveBodyWeight } from '@/data/repositories/bodyMeasurements';
import { t } from '@/i18n/fr';
import { Button, NumberInput, Sheet } from '@/ui';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

type SaveState = 'idle' | 'saving' | 'error';

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

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * La pesée, derrière la tuile de l'îlot.
 *
 * **Elle était une carte de l'accueil, elle est maintenant une feuille.** Un
 * poids se renseigne une fois par jour au mieux ; le champ, son bouton et sa
 * phrase d'explication occupaient en permanence deux cents pixels du seul écran
 * dont la mission est de lancer une séance. La tuile porte la valeur — c'est ce
 * qu'on vient lire — et la saisie arrive au tap.
 *
 * **Pas de ± ici.** Un poids du corps se lit sur une balance et se tape ; il ne
 * s'ajuste pas par pas de 100 g depuis la valeur d'hier. Le champ prend donc
 * toute la ligne (cf. `steppers` dans `NumberInput`).
 *
 * La feuille se ferme d'elle-même sur une écriture réussie : la tuile affiche
 * aussitôt la nouvelle valeur, ce qui dit « c'est enregistré » mieux qu'une
 * ligne de texte sous un bouton. L'échec, lui, garde la feuille ouverte, avec
 * la valeur tapée intacte et le bouton réarmé.
 */
export function HomeBodyWeightSheet({ open, onClose }: Props) {
  const latest = useLiveQuery(async () => (await getLatestBodyWeight()) ?? null);
  const [draft, setDraft] = useState<number | undefined>();
  const [loadedMeasurement, setLoadedMeasurement] = useState<number | null | undefined>();
  const [wasOpen, setWasOpen] = useState(open);
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

  // La feuille n'est jamais démontée entre deux ouvertures : sans ça, une saisie
  // abandonnée hier soir serait encore dans le champ ce matin.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(latest?.valueKg);
      setSaveState('idle');
    }
  }

  const valid = draft !== undefined && Number.isFinite(draft) && draft > 0;
  const unchangedToday =
    latest != null &&
    isSameLocalDay(latest.measuredAt, dayReferenceAt) &&
    draft === latest.valueKg;
  const disabled = !valid || unchangedToday || saveState === 'saving';

  const submit = async () => {
    if (!valid || disabled) return;

    setSaveState('saving');
    try {
      const saved = await saveBodyWeight(draft);
      setDraft(saved.valueKg);
      setSaveState('idle');
      onClose();
    } catch {
      setSaveState('error');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('home.bodyWeightSection')}>
      <div className="space-y-4 pb-2">
        <NumberInput
          aria-label={t('home.bodyWeightLabel')}
          value={draft}
          onChange={(value) => {
            setDraft(value);
            setSaveState('idle');
          }}
          steppers={false}
          step={0.1}
          min={0.1}
          max={Number.POSITIVE_INFINITY}
          suffix={t('units.kg')}
          placeholder={t('home.bodyWeightPlaceholder')}
        />

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={disabled}
          onClick={() => void submit()}
        >
          {saveState === 'saving' ? t('home.bodyWeightSaving') : t('home.bodyWeightSave')}
        </Button>

        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {latest == null
            ? t('home.bodyWeightHint')
            : t('home.bodyWeightLatest', { date: dateFormatter.format(latest.measuredAt) })}
        </p>

        {saveState === 'error' && (
          <p role="alert" className="text-sm text-[var(--danger-ink)]">
            {t('home.bodyWeightError')}
          </p>
        )}
      </div>
    </Sheet>
  );
}

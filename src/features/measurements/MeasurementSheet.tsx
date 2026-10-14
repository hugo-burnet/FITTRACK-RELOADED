import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listMeasurements, saveMeasurement } from '@/data/repositories/measurements';
import type { MeasurementReading } from '@/data/repositories/measurements';
import { t } from '@/i18n/fr';
import { measurementReading, measurementTypeLabel, measurementUnitLabel } from '@/i18n/labels';
import {
  BODY_WEIGHT_TYPE,
  CUSTOM_NAME_MAX,
  CUSTOM_UNITS,
  customType,
  dayInputValue,
  isPlausibleMeasurement,
  measuredAtForDay,
  presetUnit,
  type MeasurementUnit,
} from '@/lib/bodyMeasurements';
import { Button, ChoiceChip, Input, NumberInput, Sheet } from '@/ui';
import { formatNumber } from '@/ui/numberField';

/**
 * Ce que la feuille de saisie ouvre :
 *
 * - `type` : une mesure connue (le catalogue, ou un champ libre déjà suivi) ;
 * - `custom` : un champ libre neuf, dont la feuille demande le nom et l'unité ;
 * - `edit` : la correction d'une mesure — son type et sa date sont figés, seule la valeur change.
 */
export type MeasurementTarget =
  | { kind: 'type'; type: string }
  | { kind: 'custom' }
  | { kind: 'edit'; reading: MeasurementReading };

type SaveState = 'idle' | 'saving' | 'error';

interface Props {
  /** Absente : la feuille est fermée. */
  target: MeasurementTarget | undefined;
  onClose: () => void;
}

/**
 * La saisie d'une mesure : sa valeur, sa date — rétroactive au besoin.
 *
 * **Le type se choisit avant, pas dedans.** La liste ouvre d'abord « Quelle mesure ? », puis cette
 * feuille : deux feuilles empilées se disputent le focus et le défilement, et un formulaire qui
 * change de forme selon son premier champ est un formulaire qu'on relit à chaque frappe.
 *
 * Elle se ferme d'elle-même sur une écriture réussie — la valeur apparaît aussitôt dans la liste
 * derrière, ce qui dit « c'est enregistré » mieux qu'une ligne sous un bouton. L'échec garde la
 * feuille ouverte, la valeur tapée intacte et le bouton réarmé.
 */
export function MeasurementSheet({ target, onClose }: Props) {
  // La dernière cible reste en place pendant que la feuille redescend : le contenu ne doit pas
  // s'effondrer sous les yeux au moment où elle se ferme.
  const [last, setLast] = useState(target);
  if (target !== undefined && target !== last) setLast(target);
  const shown = target ?? last;

  return (
    <Sheet
      open={target !== undefined}
      onClose={onClose}
      title={shown?.kind === 'edit' ? t('measures.sheetTitleEdit') : t('measures.sheetTitle')}
    >
      {/* Monté avec la feuille, démonté avec elle : chaque ouverture repart d'un brouillon vide,
          et une saisie abandonnée hier soir n'est pas encore dans le champ ce matin. */}
      {shown !== undefined && <MeasurementForm target={shown} onClose={onClose} />}
    </Sheet>
  );
}

function MeasurementForm({
  target,
  onClose,
}: {
  target: MeasurementTarget;
  onClose: () => void;
}) {
  const editing = target.kind === 'edit' ? target.reading : undefined;
  /** Lu une fois : « aujourd'hui » ne glisse pas sous le doigt à minuit. */
  const [now] = useState(() => Date.now());
  const [nameDraft, setNameDraft] = useState('');
  const [customUnit, setCustomUnit] = useState<MeasurementUnit>('cm');
  const [value, setValue] = useState<number | undefined>(editing?.value);
  const [day, setDay] = useState(() => dayInputValue(editing?.measuredAt ?? now));
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const type =
    target.kind === 'custom'
      ? customType(nameDraft)
      : target.kind === 'edit'
        ? target.reading.type
        : target.type;

  const readings = useLiveQuery(
    async () => (type === undefined ? [] : await listMeasurements(type)),
    [type],
  );
  const latest = readings?.[readings.length - 1];

  // Une série garde une seule unité : un champ libre dont le nom est déjà suivi reprend la sienne
  // au lieu de la rouvrir au choix, sans quoi la courbe mélangerait des centimètres et des kilos.
  const unit =
    type === undefined
      ? undefined
      : target.kind === 'edit'
        ? target.reading.unit
        : (presetUnit(type) ?? latest?.unit ?? (target.kind === 'custom' ? customUnit : 'cm'));
  const unitIsKnown = type !== undefined && (presetUnit(type) !== undefined || latest !== undefined);

  const measuredAt = editing === undefined ? measuredAtForDay(day, now) : editing.measuredAt;
  const sameDay =
    editing === undefined ? readings?.find((reading) => dayInputValue(reading.measuredAt) === day) : undefined;

  const filled = value !== undefined && type !== undefined && unit !== undefined;
  const plausible = filled && isPlausibleMeasurement(type, unit, value);
  const canSave = plausible && measuredAt !== undefined && saveState !== 'saving';

  const submit = async () => {
    if (!canSave || type === undefined || unit === undefined || value === undefined) return;
    if (measuredAt === undefined) return;

    setSaveState('saving');
    try {
      await saveMeasurement({ type, value, unit, measuredAt });
      onClose();
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div className="space-y-4 pb-2">
      {target.kind === 'custom' ? (
        <>
          <Input
            label={t('measures.customNameLabel')}
            value={nameDraft}
            maxLength={CUSTOM_NAME_MAX}
            placeholder={t('measures.customNamePlaceholder')}
            enterKeyHint="done"
            onChange={(event) => setNameDraft(event.target.value)}
          />
          {!unitIsKnown && (
            <div>
              <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
                {t('measures.customUnitLabel')}
              </p>
              <div className="flex gap-2">
                {CUSTOM_UNITS.map((candidate) => (
                  <ChoiceChip
                    key={candidate}
                    label={measurementUnitLabel(candidate)}
                    active={customUnit === candidate}
                    onClick={() => setCustomUnit(candidate)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div>
          <p className="label-xs font-semibold text-[var(--text-2)]">{t('measures.typeLabel')}</p>
          <p className="mt-1 text-lg font-semibold text-[var(--text-1)]">
            {type === undefined ? '' : measurementTypeLabel(type)}
          </p>
        </div>
      )}

      <NumberInput
        aria-label={t('measures.valueLabel')}
        value={value}
        onChange={(next) => {
          setValue(next);
          setSaveState('idle');
        }}
        steppers={false}
        step={0.1}
        min={0.1}
        max={Number.POSITIVE_INFINITY}
        suffix={unit === undefined ? undefined : measurementUnitLabel(unit)}
        // La mesure d'avant, en gris : de quoi se repérer sans qu'elle soit déjà dans le champ,
        // où il faudrait l'effacer pour taper la nouvelle.
        placeholder={latest === undefined ? undefined : formatNumber(latest.value)}
      />

      {editing === undefined ? (
        <Input
          label={t('measures.dateLabel')}
          type="date"
          value={day}
          max={dayInputValue(now)}
          onChange={(event) => {
            setDay(event.target.value);
            setSaveState('idle');
          }}
        />
      ) : (
        <p className="text-base text-[var(--text-2)]">
          {new Date(editing.measuredAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!canSave}
        onClick={() => void submit()}
      >
        {saveState === 'saving' ? t('measures.saving') : t('measures.save')}
      </Button>

      <div className="space-y-2 text-sm leading-relaxed text-[var(--text-2)]">
        {sameDay !== undefined && unit !== undefined && (
          <p role="status">
            {t('measures.replacesHint', { value: measurementReading(sameDay.value, unit) })}
          </p>
        )}
        {value !== undefined && unit !== undefined && type !== undefined && !plausible && (
          <p role="status" className="text-[var(--danger-ink)]">
            {t('measures.implausible')}
          </p>
        )}
        {editing === undefined && day !== '' && measuredAt === undefined && (
          <p role="status" className="text-[var(--danger-ink)]">
            {t('measures.dateInvalid')}
          </p>
        )}
        {type === BODY_WEIGHT_TYPE && <p>{t('measures.weightHint')}</p>}
        {saveState === 'error' && (
          <p role="alert" className="text-[var(--danger-ink)]">
            {t('measures.saveError')}
          </p>
        )}
      </div>
    </div>
  );
}

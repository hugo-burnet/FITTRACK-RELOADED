import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDefaultLoadStepKg, setDefaultLoadStepKg } from '@/data/repositories/settings';
import { t } from '@/i18n/fr';
import { LOAD_STEP_MAX_KG, LOAD_STEP_MIN_KG } from '@/lib/loadIncrement';
import { Button, ChoiceChip, ListRow, NumberInput, Sheet } from '@/ui';
import { formatNumber } from '@/ui/numberField';

type SaveState = 'idle' | 'saving' | 'error';

/**
 * Le pas de charge de toute l'appli : une ligne qui dit ce qu'il vaut, une feuille pour le poser.
 *
 * « De façon générale le pas est de 1,125 » est une phrase sur la salle, pas sur un exercice : la poser une
 * fois ici vaut pour toutes les fiches dont « Incrément de charge » est vide. La fiche garde la main pour
 * l'exercice qui fait exception. Rien n'est posé tant que la personne ne le pose : sans pas, le coach lit la
 * table du matériel, comme avant.
 */
export function DefaultLoadStepRow() {
  // `undefined` : pas encore lu ; `null` : aucun pas posé — `useLiveQuery` réserve `undefined` à « pas répondu ».
  const step = useLiveQuery(async () => (await getDefaultLoadStepKg()) ?? null, []);
  const [open, setOpen] = useState(false);

  return (
    <>
      <ListRow
        title={t('settings.loadStepTitle')}
        subtitle={
          typeof step === 'number'
            ? t('settings.loadStepValue', { value: formatNumber(step) })
            : t('settings.loadStepNone')
        }
        disabled={step === undefined}
        onClick={() => setOpen(true)}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={t('settings.loadStepSheetTitle')}>
        {/* Monté avec la feuille, démonté avec elle : chaque ouverture repart du pas enregistré. */}
        {step !== undefined && (
          <LoadStepForm initial={step ?? undefined} onClose={() => setOpen(false)} />
        )}
      </Sheet>
    </>
  );
}

function LoadStepForm({ initial, onClose }: { initial: number | undefined; onClose: () => void }) {
  const [draft, setDraft] = useState<number | undefined>(initial);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Vide veut dire « selon le matériel » : c'est un choix qu'on touche, pas un champ qu'il faut vider.
  const valid = draft === undefined || (draft > 0 && draft <= LOAD_STEP_MAX_KG);

  const change = (next: number | undefined) => {
    setDraft(next);
    setSaveState('idle');
  };

  const save = async () => {
    if (!valid || saveState === 'saving') return;

    setSaveState('saving');
    try {
      await setDefaultLoadStepKg(draft);
      onClose();
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div className="space-y-6 pb-2">
      <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('settings.loadStepHint')}</p>

      <div className="space-y-3">
        <p className="label-xs font-semibold text-[var(--text-2)]">{t('settings.loadStepLabel')}</p>
        {/* Un pas se dit une fois, au clavier : les ± d'un champ qu'on ajuste n'ont rien à faire ici. */}
        <NumberInput
          aria-label={t('settings.loadStepLabel')}
          value={draft}
          onChange={change}
          steppers={false}
          min={LOAD_STEP_MIN_KG}
          max={LOAD_STEP_MAX_KG}
          suffix={t('units.kg')}
        />
        <ChoiceChip
          label={t('settings.loadStepClear')}
          active={draft === undefined}
          quietActive
          onClick={() => change(undefined)}
        />
      </div>

      {!valid && (
        <p role="status" className="text-sm leading-relaxed text-[var(--danger-ink)]">
          {t('settings.loadStepInvalid')}
        </p>
      )}
      {saveState === 'error' && (
        <p role="alert" className="text-sm leading-relaxed text-[var(--danger-ink)]">
          {t('settings.loadStepSaveError')}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!valid || saveState === 'saving'}
        onClick={() => void save()}
      >
        {saveState === 'saving' ? t('settings.loadStepSaving') : t('settings.loadStepSave')}
      </Button>
    </div>
  );
}

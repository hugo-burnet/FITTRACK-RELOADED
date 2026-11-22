import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getRpeDisciplineSettings,
  setRpeDisciplineSettings,
} from '@/data/repositories/rpeDiscipline';
import { t } from '@/i18n/fr';
import { RPE_CEILING_OPTIONS, type RpeDisciplineSettings as Settings } from '@/lib/rpeDiscipline';
import { Card, LearnMore, ListRow, OptionSheet, SectionTitle, Toggle, type Option } from '@/ui';
import { formatNumber } from '@/ui/numberField';

const OPTIONS: Option<string>[] = RPE_CEILING_OPTIONS.map((value) => ({
  value: String(value),
  label: t('settings.rpeDisciplineCeilingValue', { value: formatNumber(value) }),
}));

/**
 * Réglages › Séance › Protocole disciplinaire RPE : l'interrupteur et le plafond.
 *
 * En base (Dexie) et non en `localStorage` comme la bande d'effort : le réglage est lu **dans la
 * transaction** qui écrit la série, et il doit partir avec la sauvegarde JSON. Lu en direct
 * (`useLiveQuery`) : une séance ouverte dans un autre onglet voit le changement sans recharger.
 */
export function RpeDisciplineSettings() {
  const settings = useLiveQuery(getRpeDisciplineSettings);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = (next: Settings) => {
    setFailed(false);
    void setRpeDisciplineSettings(next).catch(() => setFailed(true));
  };

  return (
    <section>
      <SectionTitle>{t('settings.rpeDisciplineSection')}</SectionTitle>
      <Card>
        <ListRow
          title={t('settings.rpeDisciplineRowTitle')}
          subtitle={
            settings === undefined || !settings.enabled
              ? t('settings.rpeDisciplineRowSubtitleOff')
              : t('settings.rpeDisciplineRowSubtitle', { ceiling: formatNumber(settings.ceiling) })
          }
          trailing={
            <Toggle
              label={t('settings.rpeDisciplineToggle')}
              mark={t(settings?.enabled ? 'settings.rpeDisciplineOn' : 'settings.rpeDisciplineOff')}
              checked={settings?.enabled ?? false}
              disabled={settings === undefined}
              onChange={() => {
                if (settings !== undefined) save({ ...settings, enabled: !settings.enabled });
              }}
            />
          }
        />
        <ListRow
          title={t('settings.rpeDisciplineCeilingTitle')}
          subtitle={
            settings === undefined
              ? undefined
              : t('settings.rpeDisciplineCeilingValue', { value: formatNumber(settings.ceiling) })
          }
          disabled={settings === undefined || !settings.enabled}
          onClick={() => setOpen(true)}
          chevron={false}
        />
      </Card>
      {failed && (
        <p role="alert" className="mt-3 px-1 text-sm leading-relaxed text-[var(--danger-ink)]">
          {t('settings.rpeDisciplineSaveFailed')}
        </p>
      )}
      <LearnMore>
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {t('settings.rpeDisciplineHint')}
        </p>
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {t('settings.rpeDisciplineCoachHint')}
        </p>
      </LearnMore>

      <OptionSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('settings.rpeDisciplineCeilingSheetTitle')}
        options={OPTIONS}
        value={String(settings?.ceiling ?? 8)}
        onSelect={(value) => {
          if (settings !== undefined) save({ ...settings, ceiling: Number(value) });
        }}
      />
    </section>
  );
}

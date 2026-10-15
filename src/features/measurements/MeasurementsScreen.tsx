import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { listMeasurementTypes } from '@/data/repositories/measurements';
import { t } from '@/i18n/fr';
import {
  measurementChangeReading,
  measurementReading,
  measurementTypeLabel,
} from '@/i18n/labels';
import { PRESET_MEASUREMENTS, isCustomType, roundMeasurement } from '@/lib/bodyMeasurements';
import { Button, Card, ListRow, OptionSheet, SectionTitle } from '@/ui';
import { MeasurementSheet, type MeasurementTarget } from './MeasurementSheet';

/**
 * RF-37 — les mesures qu'on suit, et le moyen d'en ajouter une. Cf.
 * `docs/design/specs/2026-10-14-mensurations-design.md`.
 *
 * **Ajouter commence par « Quelle mesure ? »**, une feuille à part, puis la saisie : cf.
 * `MeasurementSheet`. Le champ libre y est la dernière ligne — il demande un nom et une unité, ce
 * que le catalogue n'a pas à faire.
 */

/** Ne peut pas être un `type` : ni une clé du catalogue, ni un nom préfixé `custom:`. */
const CUSTOM_OPTION = '__custom__';

const shortDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function MeasurementsScreen() {
  const navigate = useAppNavigate();
  const entries = useLiveQuery(listMeasurementTypes, []);

  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<MeasurementTarget>();

  // Les mesures libres déjà suivies se proposent à côté du catalogue : y revenir ne doit pas
  // obliger à retaper leur nom.
  const followedCustoms = (entries ?? []).filter((entry) => isCustomType(entry.type));
  const options = [
    ...PRESET_MEASUREMENTS.map(({ type }) => ({ value: type, label: measurementTypeLabel(type) })),
    ...followedCustoms.map(({ type }) => ({ value: type, label: measurementTypeLabel(type) })),
    { value: CUSTOM_OPTION, label: t('measures.customOption') },
  ];

  return (
    <Screen title={t('measures.title')} onBack={() => void navigate(-1)}>
      <div className="space-y-7">
        <Button variant="primary" size="lg" fullWidth onClick={() => setPicking(true)}>
          {t('measures.add')}
        </Button>

        {entries !== undefined && entries.length === 0 && (
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('measures.empty')}</p>
          </Card>
        )}

        {entries !== undefined && entries.length > 0 && (
          <section>
            <SectionTitle>{t('measures.followedSection')}</SectionTitle>
            <Card>
              {entries.map((entry) => {
                const date = shortDate(entry.latest.measuredAt);
                return (
                  <ListRow
                    key={entry.type}
                    title={measurementTypeLabel(entry.type)}
                    subtitle={
                      entry.previous === undefined
                        ? date
                        : t('measures.rowDateChange', {
                            date,
                            change: measurementChangeReading(
                              roundMeasurement(entry.latest.value - entry.previous.value),
                              entry.unit,
                            ),
                          })
                    }
                    trailing={
                      <span className="metric text-base font-semibold text-[var(--text-1)]">
                        {measurementReading(entry.latest.value, entry.unit)}
                      </span>
                    }
                    onClick={() =>
                      void navigate(`/analytics/measurements/${encodeURIComponent(entry.type)}`)
                    }
                  />
                );
              })}
            </Card>
          </section>
        )}

        <p className="px-1 text-sm leading-relaxed text-[var(--text-2)]">{t('measures.periodHint')}</p>
      </div>

      <OptionSheet
        open={picking}
        onClose={() => setPicking(false)}
        title={t('measures.typeSheetTitle')}
        // Rien n'est choisi : on vient ajouter, pas régler.
        value=""
        options={options}
        onSelect={(value) =>
          setTarget(value === CUSTOM_OPTION ? { kind: 'custom' } : { kind: 'type', type: value })
        }
      />

      <MeasurementSheet target={target} onClose={() => setTarget(undefined)} />
    </Screen>
  );
}

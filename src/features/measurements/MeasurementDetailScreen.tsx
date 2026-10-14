import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { ChartExportAction } from '@/features/analytics/ChartExportAction';
import { deleteMeasurement, listMeasurements } from '@/data/repositories/measurements';
import type { MeasurementReading } from '@/data/repositories/measurements';
import { t } from '@/i18n/fr';
import {
  measurementChangeReading,
  measurementReading,
  measurementTypeLabel,
  periodLabel,
} from '@/i18n/labels';
import { PERIOD_KEYS, periodBounds, type PeriodKey } from '@/lib/analytics/periods';
import { BODY_WEIGHT_TYPE, presetUnit, roundMeasurement } from '@/lib/bodyMeasurements';
import {
  ActionSheet,
  Button,
  Card,
  ConfirmSheet,
  FilterChip,
  ListRow,
  OptionSheet,
  SectionTitle,
} from '@/ui';
import { MeasurementCard } from './MeasurementCard';
import { MeasurementSheet, type MeasurementTarget } from './MeasurementSheet';

/**
 * RF-38 — la courbe d'une mesure, et son historique. Cf.
 * `docs/design/specs/2026-10-14-mensurations-design.md`.
 *
 * L'historique n'est pas le jumeau caché de la courbe : c'est la liste de toutes les valeurs, et
 * c'est par elle qu'on corrige ou qu'on supprime — un point de 8 px n'est pas une cible.
 */

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function MeasurementDetailScreen() {
  // `useParams` rend la valeur déjà décodée : un nom libre contient des espaces, voire un « / ».
  const { type = '' } = useParams();
  const navigate = useAppNavigate();
  const chartRef = useRef<HTMLDivElement>(null);
  /** Lu une fois : les bornes de la période ne glissent pas sous le doigt à minuit. */
  const [openedAt] = useState(() => Date.now());

  /**
   * La mesure touchée se retient par son **identifiant**, pas par son rang : React Router ne remonte
   * pas l'écran quand le paramètre change, et un rang pointerait un point de la courbe d'un autre
   * type. Un identifiant qui n'est pas dans la courbe lue retombe sur la dernière mesure. La
   * période, elle, survit au changement de mesure — c'est la fenêtre dans laquelle on lit.
   */
  const [view, setView] = useState<{ period: PeriodKey; selectedId?: string }>({ period: 'all' });

  const [periodOpen, setPeriodOpen] = useState(false);
  const [target, setTarget] = useState<MeasurementTarget>();
  const [acting, setActing] = useState<MeasurementReading>();
  const [actionOpen, setActionOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MeasurementReading>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const readings = useLiveQuery(() => listMeasurements(type), [type]);

  const label = measurementTypeLabel(type);
  const all = readings ?? [];
  const { from, to } = periodBounds(view.period, openedAt);
  const points = all.filter(
    (reading) => (from === undefined || reading.measuredAt >= from) && reading.measuredAt < to,
  );
  const unit = all[all.length - 1]?.unit ?? presetUnit(type) ?? 'cm';
  const found = points.findIndex((point) => point.id === view.selectedId);
  const selectedIndex = found >= 0 ? found : points.length - 1;

  const previousOf = new Map(all.map((reading, index) => [reading.id, all[index - 1]]));

  const remove = async (reading: MeasurementReading) => {
    setDeleteFailed(false);
    try {
      await deleteMeasurement(reading.id);
    } catch {
      setDeleteFailed(true);
    }
  };

  return (
    <Screen title={label} onBack={() => void navigate(-1)}>
      <div className="space-y-7" aria-busy={readings === undefined}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => setTarget({ kind: 'type', type })}
        >
          {t('measures.add')}
        </Button>

        {readings === undefined ? null : all.length === 0 ? (
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('measures.notFound')}</p>
          </Card>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterChip
                label={periodLabel(view.period)}
                active={false}
                onClick={() => setPeriodOpen(true)}
              />
            </div>

            {points.length === 0 ? (
              <Card padded>
                <p className="text-sm leading-relaxed text-[var(--text-2)]">
                  {t('measures.emptyPeriod')}
                </p>
                <button
                  type="button"
                  onClick={() => setView((current) => ({ ...current, period: 'all' }))}
                  className="mt-3 min-h-12 text-base font-semibold text-[var(--accent-ink)]"
                >
                  {t('analytics.emptyPeriodAction')}
                </button>
              </Card>
            ) : (
              <div>
                <div ref={chartRef}>
                  <MeasurementCard
                    type={type}
                    unit={unit}
                    points={points}
                    selectedIndex={selectedIndex}
                    onSelect={(index) =>
                      setView((current) => ({ ...current, selectedId: points[index]?.id }))
                    }
                  />
                </div>
                <ChartExportAction
                  chartRef={chartRef}
                  slug="mensuration"
                  title={label}
                  subtitle={periodLabel(view.period)}
                />
              </div>
            )}

            {deleteFailed && (
              <p role="alert" className="px-1 text-sm text-[var(--danger-ink)]">
                {t('measures.deleteError')}
              </p>
            )}

            {points.length > 0 && (
              <section>
                <SectionTitle>{t('measures.historySection')}</SectionTitle>
                <Card>
                  {[...points].reverse().map((point) => {
                    const previous = previousOf.get(point.id);
                    return (
                      <ListRow
                        key={point.id}
                        title={longDate(point.measuredAt)}
                        subtitle={
                          previous === undefined
                            ? undefined
                            : measurementChangeReading(
                                roundMeasurement(point.value - previous.value),
                                unit,
                              )
                        }
                        onClick={() => {
                          setActing(point);
                          setActionOpen(true);
                        }}
                        trailing={
                          <span className="metric text-base font-semibold text-[var(--text-1)]">
                            {measurementReading(point.value, unit)}
                          </span>
                        }
                      />
                    );
                  })}
                </Card>
              </section>
            )}
          </>
        )}
      </div>

      <OptionSheet
        open={periodOpen}
        onClose={() => setPeriodOpen(false)}
        title={t('analytics.periodSheetTitle')}
        value={view.period}
        options={PERIOD_KEYS.map((key) => ({ value: key, label: periodLabel(key) }))}
        onSelect={(period) => setView((current) => ({ ...current, period, selectedId: undefined }))}
      />

      <ActionSheet
        open={actionOpen && acting !== undefined}
        onClose={() => setActionOpen(false)}
        title={
          acting === undefined
            ? ''
            : `${longDate(acting.measuredAt)} · ${measurementReading(acting.value, unit)}`
        }
        actions={[
          {
            label: t('measures.correct'),
            hint: t('measures.correctHint'),
            onSelect: () => {
              if (acting !== undefined) setTarget({ kind: 'edit', reading: acting });
            },
          },
          {
            label: t('measures.delete'),
            danger: true,
            onSelect: () => {
              setPendingDelete(acting);
              setConfirmOpen(true);
            },
          },
        ]}
      />

      <ConfirmSheet
        open={confirmOpen && pendingDelete !== undefined}
        onClose={() => setConfirmOpen(false)}
        title={t('measures.deleteTitle')}
        body={
          pendingDelete === undefined
            ? ''
            : [
                t('measures.deleteBody', {
                  type: label,
                  date: longDate(pendingDelete.measuredAt),
                  value: measurementReading(pendingDelete.value, unit),
                }),
                ...(type === BODY_WEIGHT_TYPE ? [t('measures.deleteBodyWeightNote')] : []),
              ].join('\n')
        }
        confirmLabel={t('measures.deleteConfirm')}
        danger
        onConfirm={() => {
          if (pendingDelete !== undefined) void remove(pendingDelete);
        }}
      />

      <MeasurementSheet target={target} onClose={() => setTarget(undefined)} />
    </Screen>
  );
}

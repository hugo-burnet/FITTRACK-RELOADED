import { CardHeadline } from '@/features/analytics/CardHeadline';
import type { MeasurementReading } from '@/data/repositories/measurements';
import { t } from '@/i18n/fr';
import {
  measurementChangeReading,
  measurementReading,
  measurementTypeLabel,
} from '@/i18n/labels';
import { plotBounds } from '@/lib/analytics/plot';
import { readingChange } from '@/lib/bodyMeasurements';
import { Card } from '@/ui';
import { MeasurementChart } from './MeasurementChart';

/**
 * Le chiffre, la courbe et l'échelle — une carte, dans l'ordre où on les lit. Celle de
 * `ProgressCard`, sans ce qui ne vaut pas ici : pas de « record », pas de légende de point plein,
 * pas de phrase sur ce que le chiffre compte (une mesure est ce qu'elle est).
 */

const shortDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

interface Props {
  type: string;
  unit: string;
  /** Les mesures de la période lue, la plus ancienne d'abord. */
  points: readonly MeasurementReading[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function MeasurementCard({ type, unit, points, selectedIndex, onSelect }: Props) {
  const first = points[0];
  const last = points[points.length - 1];
  // Jamais rendue vide — l'écran a son propre état pour ça — mais la garde permet de lire un
  // point sans le redemander plus bas.
  if (first === undefined || last === undefined) return null;

  const label = measurementTypeLabel(type);
  const reading = (value: number) => measurementReading(value, unit);
  const values = points.map((point) => point.value);
  const { min, max } = plotBounds(values);
  const selected = points[selectedIndex] ?? last;
  const change = readingChange(points);
  const single = points.length === 1;

  const summary = single
    ? t('measures.chartSummaryOne', {
        metric: label,
        first: longDate(first.measuredAt),
        current: reading(first.value),
      })
    : t('measures.chartSummary', {
        metric: label,
        count: points.length,
        first: longDate(first.measuredAt),
        last: longDate(last.measuredAt),
        min: reading(Math.min(...values)),
        max: reading(Math.max(...values)),
        current: reading(last.value),
      });

  return (
    <Card padded>
      <CardHeadline label={label} value={reading(selected.value)} />
      <p className="mt-1 text-right text-sm text-[var(--text-2)]">{longDate(selected.measuredAt)}</p>

      {/* Une grille et non deux colonnes : l'échelle doit s'arrêter au bas de la courbe, pas au bas
          de la ligne des dates. Ses bornes sont gravées au niveau des points extrêmes ; en les
          étirant sur la hauteur des deux, la borne basse tombait à côté de « 11 août ». */}
      <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
        {/* L'échelle gravée, pas dessinée : c'est ce qui donne le droit à une base qui n'est pas
            zéro. Pas pour une mesure seule : la plage ouverte autour d'elle n'est pas une donnée. */}
        {!single && (
          <div
            aria-hidden="true"
            className="label-xs flex flex-col justify-between py-1 text-right font-semibold text-[var(--text-2)]"
          >
            <span>{reading(max)}</span>
            <span>{reading(min)}</span>
          </div>
        )}

        <div className={single ? 'col-span-2' : undefined}>
          <MeasurementChart
            points={points}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
            summary={summary}
          />
        </div>

        {!single && (
          <div className="col-start-2 mt-1 flex justify-between text-xs text-[var(--text-2)]">
            <span>{shortDate(first.measuredAt)}</span>
            <span>{shortDate(last.measuredAt)}</span>
          </div>
        )}
      </div>

      <p className="mt-4 border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--text-2)]">
        {change === undefined
          ? t('measures.singleReading')
          : t('measures.changeSince', {
              change: measurementChangeReading(change.change, unit),
              date: shortDate(change.since),
            })}
      </p>
    </Card>
  );
}

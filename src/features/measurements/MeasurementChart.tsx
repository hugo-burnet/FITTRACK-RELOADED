import { ChartSurface } from '@/features/analytics/ChartSurface';
import { plotTimedPoints } from '@/lib/analytics/plot';
import type { MeasurementReading } from '@/data/repositories/measurements';

/**
 * La courbe d'une mensuration. Le même cadre que celle d'un exercice (`ChartSurface` : le SVG, le
 * contrat d'accessibilité, le geste « le plus proche »), deux différences qui tiennent à ce qu'elle
 * dessine :
 *
 * - **L'abscisse est la date** (`plotTimedPoints`). Une séance est un événement qu'on compte ; une
 *   mesure est un relevé dans le temps, et trois semaines sans mesure doivent se voir.
 * - **Aucun point n'est « le record ».** Un tour de taille plus petit n'est pas meilleur qu'un
 *   tour de bras plus grand ; colorer un extrême ferait dire à l'écran un jugement qu'il n'a pas à
 *   porter. Tous les points ont la teinte des données, le point touché porte l'anneau.
 *
 * Sans quadrillage ni axes, comme les autres : le minimum et le maximum sont gravés par la carte
 * autour de ce composant.
 */

const BOX = { width: 300, height: 120 };
/** De quoi loger l'anneau de sélection (r = 9, trait de 1,5) au bord de la boîte. */
const PAD = 12;
/**
 * Au-delà, les points se chevauchent en une barre épaisse : un an de pesées quotidiennes. Le trait
 * dit alors la tendance, et seul le point touché reste dessiné.
 */
const MAX_DOTS = 30;

interface Props {
  points: readonly MeasurementReading[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Lu par un lecteur d'écran à la place du dessin. */
  summary: string;
}

export function MeasurementChart({ points, selectedIndex, onSelect, summary }: Props) {
  const plotted = plotTimedPoints(
    points.map((point) => ({ at: point.measuredAt, value: point.value })),
    BOX,
  ).map((position, index) => ({ position, point: points[index]! }));

  const path = plotted
    .map(({ position }, index) => `${index === 0 ? 'M' : 'L'} ${position.x} ${position.y}`)
    .join(' ');
  const showEveryDot = plotted.length <= MAX_DOTS;

  return (
    <ChartSurface
      box={BOX}
      pad={PAD}
      label={summary}
      xs={plotted.map(({ position }) => position.x)}
      onSelect={onSelect}
    >
      {/* Tracé à partir de deux points : un trait vers nulle part n'est pas une tendance. */}
      {plotted.length > 1 && (
        <path
          d={path}
          fill="none"
          stroke="var(--accent-data)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {plotted.map(({ position, point }, index) => {
        const isSelected = index === selectedIndex;
        if (!showEveryDot && !isSelected) return null;

        return (
          <g key={point.id}>
            <circle
              cx={position.x}
              cy={position.y}
              r={isSelected ? 6 : 4.5}
              fill="var(--accent-data)"
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
            {/* La sélection est un anneau, pas une couleur : l'accent est réservé aux actions,
                aux séries validées et aux records. */}
            {isSelected && (
              <circle
                cx={position.x}
                cy={position.y}
                r={9}
                fill="none"
                stroke="var(--text-1)"
                strokeWidth={1.5}
              />
            )}
          </g>
        );
      })}
    </ChartSurface>
  );
}

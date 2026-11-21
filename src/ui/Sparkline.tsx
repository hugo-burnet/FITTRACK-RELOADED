import { sparklinePoints } from './sparkline';

const WIDTH = 100;
const HEIGHT = 64;

type Props = {
  /** Du plus ancien au plus récent. */
  values: readonly number[];
  /** Le dernier point est une période en cours (la semaine pas finie) : son segment est en pointillé. */
  partialLast?: boolean;
};

/**
 * La mini-courbe d'une tuile `G` : une polyligne à la main, sans axe ni libellé, `aria-hidden` — le chiffre
 * et le `detail` de la tuile disent ce qu'elle montre. Hauteur en pixels : rien à y faire grandir avec la
 * police. Série en `--accent-ink`, base en `--axis`.
 */
export function Sparkline({ values, partialLast = false }: Props) {
  const points = sparklinePoints(values, WIDTH, HEIGHT);
  if (points.length < 2) return null;

  const toText = (list: typeof points) => list.map(({ x, y }) => `${x},${y}`).join(' ');
  const solid = partialLast ? points.slice(0, -1) : points;
  const tail = partialLast ? points.slice(-2) : [];

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="block h-[64px] w-full"
    >
      <line
        x1="0"
        y1={HEIGHT - 1}
        x2={WIDTH}
        y2={HEIGHT - 1}
        stroke="var(--axis)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {solid.length >= 2 && (
        <polyline
          points={toText(solid)}
          fill="none"
          stroke="var(--accent-ink)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {tail.length === 2 && (
        <polyline
          points={toText(tail)}
          fill="none"
          stroke="var(--accent-ink)"
          strokeWidth="2"
          strokeDasharray="4 4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

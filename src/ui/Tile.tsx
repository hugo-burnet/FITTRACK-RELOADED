import { useId, type ReactNode } from 'react';
import { t } from '@/i18n/fr';

/**
 * Une tuile : un chiffre à lire d'un coup d'œil (DESIGN.md › « Grille modulaire »). Elle se range dans un
 * `TileGrid`, qui lit sa `size` et décide de sa largeur ; elle-même ne connaît pas ses voisines.
 */
export type TileValue = {
  /** Déjà formaté (`formatNumber`…), jamais un nombre. */
  value: string;
  /** Après une espace, plus petite et en `--text-2`. */
  unit?: string;
  /** Empilement seulement : « plancher », sous son chiffre. */
  caption?: string;
  /** Ce que lit un lecteur d'écran quand le chiffre se lit mal (« 3 sur 4 » pour `3 / 4`). */
  spoken?: string;
};

type Common = {
  /** Le sujet. Premier dans le DOM, affiché en bas : le nom accessible commence par lui. */
  label: string;
  onClick?: () => void;
  /** Ce que fait la tuile quand on la touche : lu en description, jamais à la place du chiffre. */
  hint?: string;
};

/**
 * `undefined` = lecture en cours (la convention de `useLiveQuery`) ; `null` = mesure jamais prise ;
 * un compte qui vaut zéro s'écrit `'0'`, c'est une jauge à zéro et non une absence.
 */
export type TileProps =
  | (Common & { size: 'S'; value: TileValue | readonly [TileValue, TileValue] | null | undefined })
  | (Common & { size: 'L'; value: TileValue | null | undefined; detail?: string })
  | (Common & {
      size: 'G';
      value: TileValue | null | undefined;
      detail?: string;
      /** Phrasing seulement (`span`, `svg`) : une tuile cliquable est un `<button>`. */
      children: ReactNode;
    });

const FIGURE = 'metric text-2xl leading-none font-semibold text-[var(--text-1)]';

/**
 * Le chiffre ne se coupe jamais (`whitespace-nowrap`) ; seule l'unité peut passer dessous, par l'espace
 * qui la précède — un filet de sécurité, pas une mise en page.
 */
function Figure({ item }: { item: TileValue }) {
  return (
    <span className="block">
      <span className={FIGURE}>
        {/* `spoken` remplace ce qui se voit pour l'oreille seulement : le chiffre reste ce qu'on lit. */}
        <span
          className="whitespace-nowrap"
          aria-hidden={item.spoken === undefined ? undefined : true}
        >
          {item.value}
        </span>
        {item.unit !== undefined && (
          <>
            {' '}
            <span
              className="text-sm font-semibold text-[var(--text-2)]"
              aria-hidden={item.spoken === undefined ? undefined : true}
            >
              {item.unit}
            </span>
          </>
        )}
        {item.spoken !== undefined && <span className="sr-only">{item.spoken}</span>}
      </span>
      {item.caption !== undefined && (
        <>
          {' '}
          <span className="text-sm text-[var(--text-2)]">{item.caption}</span>
        </>
      )}
    </span>
  );
}

function Reading({ value }: { value: TileProps['value'] }) {
  if (value === undefined) {
    // Une ligne de chiffre vide, à sa hauteur : rien ne saute quand la valeur arrive.
    return (
      <span className={`${FIGURE} block`} aria-hidden="true">
        {' '}
      </span>
    );
  }
  if (value === null) {
    return (
      <span className={`${FIGURE} block`}>
        <span aria-hidden="true" className="text-[var(--text-2)]">
          —
        </span>
        <span className="sr-only">{t('common.noMeasure')}</span>
      </span>
    );
  }
  if (Array.isArray(value)) {
    const [first, second] = value as readonly [TileValue, TileValue];
    return (
      <span className="flex flex-col gap-2">
        <Figure item={first} />{' '}
        <span data-part="tile-split" className="block border-t border-[var(--border)] pt-2">
          <Figure item={second} />
        </span>
      </span>
    );
  }
  return <Figure item={value as TileValue} />;
}

export function Tile(props: TileProps) {
  const { label, hint, onClick, size, value } = props;
  const hintId = useId();
  const Element = onClick ? 'button' : 'div';
  const large = size === 'G';

  const element = (
    <Element
      type={onClick ? 'button' : undefined}
      data-part="tile"
      data-size={size}
      aria-describedby={hint === undefined ? undefined : hintId}
      onClick={onClick}
      className={`flex h-full w-full min-w-0 flex-col gap-2 rounded-2xl bg-[var(--surface-1)] p-4 text-left
        ${large ? 'min-h-40' : 'min-h-20'}
        ${onClick ? 'transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]' : ''}`}
    >
      <span
        data-part={large ? 'legend' : undefined}
        className={`label-xs font-semibold text-[var(--text-2)] [overflow-wrap:anywhere]
          ${large ? '' : 'order-last mt-auto'}`}
      >
        {label}
      </span>
      {/* Une espace entre deux spans : le nom accessible les lit « poids du jour 82,4 kg », pas collés. */}{' '}
      <Reading value={value} />
      {'detail' in props && props.detail !== undefined && (
        <span className="block text-sm text-[var(--text-2)]">{props.detail}</span>
      )}
      {'children' in props && props.children}
    </Element>
  );

  if (hint === undefined) return element;
  // Hors du bouton : dedans, le texte de l'aide entrerait dans son nom accessible.
  return (
    <>
      {element}
      <span id={hintId} className="sr-only">
        {hint}
      </span>
    </>
  );
}

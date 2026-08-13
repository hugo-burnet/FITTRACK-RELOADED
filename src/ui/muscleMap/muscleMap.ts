/**
 * Carte musculaire FitTrack.
 *
 * Sans dependance et sans framework : la classe prend un element hote, y injecte
 * le SVG et manipule les paths directement. Utilisable tel quel depuis React,
 * Vue ou du DOM nu.
 *
 *   import svgSource from './muscle-map.svg?raw';
 *   const map = new MuscleMap(host, { svgSource });
 *   map.setIntensities({ quadriceps: 0.8, latissimus_dorsi: 0.3 });
 *
 * Le SVG est importe en ?raw et inline : local-first, aucune requete, et les
 * paths restent accessibles au DOM, ce qu'un <img src="..."> interdirait.
 */

import {
  MUSCLE_IDS,
  MUSCLE_VIEWS,
  type MuscleId,
  type MuscleView,
} from './muscleGroups';

export type Intensities = Partial<Record<MuscleId, number>>;

export interface MuscleMapOptions {
  /** Contenu du SVG, importe en `?raw`. */
  svgSource: string;
  /** Vue affichee au depart. Defaut 'front'. */
  view?: MuscleView;
  /** Couleur d'un muscle a intensite nulle. */
  restColor?: string;
  /** Couleur d'un muscle a intensite 1. */
  peakColor?: string;
  /** Couleur de la silhouette de fond. */
  silhouetteColor?: string;
  /**
   * Contour separant les muscles. Sans lui, les groupes non travailles forment
   * une masse grise unique ou l'on ne distingue pas le pectoral du deltoide.
   */
  outlineColor?: string;
  /** Epaisseur du contour, en pixels ecran (non-scaling-stroke). */
  outlineWidth?: number;
  /**
   * Rampe personnalisee. Recoit une intensite deja bornee a [0, 1] et rend une
   * couleur CSS. Remplace restColor/peakColor si fournie.
   */
  colorScale?: (intensity: number) => string;
  /** Appele au clic ou au tap sur un muscle. */
  onSelect?: (id: MuscleId) => void;
}

const DEFAULTS = {
  view: 'front' as MuscleView,
  restColor: '#3c414c',
  peakColor: '#ff5a3c',
  silhouetteColor: '#2a2d34',
  outlineColor: '#1c1e24',
  outlineWidth: 1.25,
};

/**
 * Interpolation en sRGB entre deux couleurs hexa. Suffisant pour une rampe
 * unique et monotone ; passer par colorScale si une rampe perceptuelle
 * (OKLCH) est souhaitee.
 */
function mixHex(a: string, b: string, t: number): string {
  // Destructure plutot que .map((v, i) => ... pb[i]) : sous
  // `noUncheckedIndexedAccess`, indexer un tuple rend `number | undefined`.
  // Les composantes nommees restent des `number`, sans assertion ni garde.
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const mix = (from: number, to: number) => Math.round(from + (to - from) * t);
  return `rgb(${mix(ar, br)} ${mix(ag, bg)} ${mix(ab, bb)})`;
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class MuscleMap {
  private host: HTMLElement;
  private opts: Required<Omit<MuscleMapOptions, 'colorScale' | 'onSelect'>> &
    Pick<MuscleMapOptions, 'colorScale' | 'onSelect'>;
  private svg!: SVGSVGElement;
  private view: MuscleView;
  private intensities: Intensities = {};
  /** Un muscle a deux paths au plus, un par vue. */
  private paths = new Map<MuscleId, SVGPathElement[]>();
  private groups = new Map<MuscleView, SVGGElement>();
  private onClick = (e: Event) => this.handleClick(e);

  constructor(host: HTMLElement, options: MuscleMapOptions) {
    this.host = host;
    this.opts = { ...DEFAULTS, ...options };
    this.view = this.opts.view;
    this.mount();
  }

  private mount() {
    this.host.innerHTML = this.opts.svgSource;
    const svg = this.host.querySelector('svg');
    if (!svg) throw new Error('MuscleMap : aucun <svg> dans svgSource');
    this.svg = svg;
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');

    // Interrogation par data-view et non par id : un SVG inline partage
    // l'espace de nommage des id du document hote, et un selecteur #front
    // ramenerait le premier element du document portant cet id, pas forcement
    // le notre.
    for (const view of ['front', 'back'] as MuscleView[]) {
      const g = this.svg.querySelector<SVGGElement>(`g[data-view="${view}"]`);
      if (g) this.groups.set(view, g);
    }
    if (!this.groups.size) {
      throw new Error('MuscleMap : aucun <g data-view="front|back"> trouve');
    }

    for (const id of MUSCLE_IDS) {
      const found = Array.from(
        this.svg.querySelectorAll<SVGPathElement>(`path[data-muscle="${id}"]`),
      );
      if (found.length) this.paths.set(id, found);
    }

    // Array.from plutot qu'un for..of direct : iterer une NodeList exige
    // lib: DOM.Iterable dans le tsconfig du projet hote, ce qu'on ne peut pas
    // supposer.
    const sil = Array.from(
      this.svg.querySelectorAll<SVGPathElement>('.silhouette'),
    );
    for (const p of sil) p.style.fill = this.opts.silhouetteColor;

    this.svg.addEventListener('click', this.onClick);
    this.applyView();
    this.applyColors();
  }

  private handleClick(e: Event) {
    if (!this.opts.onSelect) return;
    const target = (e.target as Element)?.closest('path[data-muscle]');
    const id = target?.getAttribute('data-muscle') as MuscleId | undefined;
    if (id) this.opts.onSelect(id);
  }

  private colorFor(intensity: number): string {
    const t = clamp01(intensity);
    if (this.opts.colorScale) return this.opts.colorScale(t);
    return mixHex(this.opts.restColor, this.opts.peakColor, t);
  }

  private applyView() {
    for (const [view, g] of this.groups) {
      g.style.display = view === this.view ? '' : 'none';
    }
  }

  private applyColors() {
    for (const [id, paths] of this.paths) {
      const fill = this.colorFor(this.intensities[id] ?? 0);
      for (const p of paths) {
        p.style.fill = fill;
        p.style.stroke = this.opts.outlineColor;
        p.style.strokeWidth = String(this.opts.outlineWidth);
      }
    }
    this.raiseActive();
  }

  /**
   * Remonte en tete de leur groupe les paths d'intensite non nulle.
   *
   * Necessaire, pas cosmetique : les masques sont empiles du plus profond au
   * plus superficiel, si bien que erector_spinae, rotator_cuff et rhomboids
   * sont integralement recouverts par le trapeze et le grand dorsal. Sans ce
   * reordonnancement ils ne peuvent jamais s'allumer. SVG n'ayant pas de
   * z-index, le seul levier est l'ordre du DOM.
   */
  private raiseActive() {
    for (const [id, paths] of this.paths) {
      if (!(this.intensities[id] ?? 0)) continue;
      for (const p of paths) p.parentElement?.appendChild(p);
    }
  }

  /** Remplace toutes les intensites. Les groupes absents retombent a 0. */
  setIntensities(map: Intensities) {
    this.intensities = { ...map };
    this.applyColors();
  }

  setView(view: MuscleView) {
    this.view = view;
    this.applyView();
  }

  getView(): MuscleView {
    return this.view;
  }

  /** Vues ou ce muscle est visible. Utile pour basculer la vue au clic. */
  viewsFor(id: MuscleId): MuscleView[] {
    return MUSCLE_VIEWS[id];
  }

  destroy() {
    this.svg?.removeEventListener('click', this.onClick);
    this.host.innerHTML = '';
    this.paths.clear();
    this.groups.clear();
  }
}

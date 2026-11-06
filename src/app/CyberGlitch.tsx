import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { playScreenGlitch, warmUpCyberSounds } from '@/audio/screenGlitch';
import { mayGlitch, nextAmbientDelay, type GlitchKind } from './cyberGlitchRules';

/** Le thème posé sur <html>, suivi en direct : Réglages le change sans recharger l'app. */
function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
const readTheme = () => document.documentElement.getAttribute('data-theme');

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const BAND_COLORS = [
  'rgb(94 246 255 / 0.28)',
  'rgb(255 0 60 / 0.32)',
  'rgb(252 238 10 / 0.22)',
  'rgb(255 255 255 / 0.16)',
];
const FRAMES = 5;
const FRAME_MS = 50;
const between = (low: number, high: number) => low + Math.random() * (high - low);

let tearing = false;

/** La déchirure : cinq images de filtre, de bandes et de bloc, puis l'écran rendu intact. */
function tearScreen(): void {
  const target = document.getElementById('root');
  if (target === null || tearing || reducedMotion()) return;
  const node = (id: string) => document.getElementById(id);
  tearing = true;
  const extras: HTMLElement[] = [];
  const clear = () => {
    extras.forEach((element) => element.remove());
    extras.length = 0;
  };
  for (let frame = 0; frame < FRAMES; frame++) {
    setTimeout(() => {
      clear();
      node('cyber-tear-noise')?.setAttribute('seed', String(Math.floor(Math.random() * 1000)));
      node('cyber-tear-noise')?.setAttribute(
        'baseFrequency',
        `0.00001 ${between(0.02, 0.07).toFixed(3)}`,
      );
      node('cyber-tear-map')?.setAttribute(
        'scale',
        String(frame === FRAMES - 1 ? 12 : Math.round(between(24, 64))),
      );
      node('cyber-tear-red')?.setAttribute('dx', String(-Math.round(between(2, 7))));
      node('cyber-tear-cyan')?.setAttribute('dx', String(Math.round(between(2, 6))));
      target.style.filter = 'url(#cyber-tear)';
      const height = window.innerHeight;
      const bands = 2 + Math.floor(Math.random() * 2);
      for (let index = 0; index < bands; index++) {
        const band = document.createElement('span');
        band.className = 'cyber-gband';
        band.style.top = `${between(0, height - 20)}px`;
        band.style.height = `${between(2, 18)}px`;
        band.style.background = BAND_COLORS[Math.floor(Math.random() * BAND_COLORS.length)] ?? '';
        band.style.transform = `translateX(${between(-24, 24).toFixed(0)}px)`;
        document.body.appendChild(band);
        extras.push(band);
      }
      if (Math.random() < 0.7) {
        const block = document.createElement('span');
        block.className = 'cyber-gblock';
        block.style.top = `${between(0, height - 30)}px`;
        block.style.left = `${between(0, window.innerWidth - 90)}px`;
        block.style.width = `${between(30, 110)}px`;
        block.style.height = `${between(6, 26)}px`;
        document.body.appendChild(block);
        extras.push(block);
      }
    }, frame * FRAME_MS);
  }
  setTimeout(() => {
    clear();
    target.style.filter = '';
    tearing = false;
  }, FRAMES * FRAME_MS);
}

/** Le micro-glitch : un seul libellé, titre ou pictogramme visible tressaute. */
function glitchOne(): void {
  const pool = [
    ...document.querySelectorAll<HTMLElement>('main h1, main .label-xs, .bottom-nav svg'),
  ].filter((element) => element.getClientRects().length > 0);
  const element = pool[Math.floor(Math.random() * pool.length)];
  if (element === undefined) return;
  element.setAttribute('data-glitch', '');
  setTimeout(() => element.removeAttribute('data-glitch'), 200);
}

/**
 * Les glitchs du thème Cyber : la déchirure à l'arrivée sur un écran (avec son son), et des glitchs
 * d'ambiance rares (`cyberGlitchRules.ts`). Hors de Cyber, ne rend rien et n'arme rien.
 *
 * La DÉCHIRURE est un filtre SVG — une turbulence en bandes horizontales qui déplace l'écran, puis les
 * canaux rouge et cyan séparés — posé sur #root le temps de cinq images, avec deux ou trois bandes de
 * couleur et un bloc inversé par-dessus. Le contenu reste là et touchable pendant ce quart de seconde.
 * Le MICRO-GLITCH pose `data-glitch` sur un seul élément : un attribut, pas une classe, que React ne
 * réécrit pas en redessinant.
 */
export function CyberGlitch() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => null);
  const cyber = theme === 'cyber';
  const { pathname } = useLocation();

  const lastTouch = useRef(0);

  // Le doigt : il suspend l'ambiance, et c'est le geste qui permet de charger les sons d'avance.
  useEffect(() => {
    if (!cyber) return;
    const touched = () => {
      lastTouch.current = Date.now();
      warmUpCyberSounds();
    };
    document.addEventListener('pointerdown', touched, true);
    return () => document.removeEventListener('pointerdown', touched, true);
  }, [cyber]);

  // L'arrivée sur un écran : la déchirure et son son. Pas au premier rendu — l'ouverture a la sienne.
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (!cyber || document.hidden) return;
    tearScreen();
    playScreenGlitch();
  }, [pathname, cyber]);

  // L'ambiance : deux rythmes indépendants, rares, chacun réarmé après son tour.
  useEffect(() => {
    if (!cyber) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const arm = (kind: GlitchKind) => {
      timers.push(
        setTimeout(() => {
          const typing = document.activeElement?.matches('input, textarea, select') ?? false;
          const calm = mayGlitch({
            now: Date.now(),
            lastTouchAt: lastTouch.current,
            typing,
            reducedMotion: reducedMotion(),
            hidden: document.hidden,
          });
          if (calm) (kind === 'tear' ? tearScreen : glitchOne)();
          arm(kind);
        }, nextAmbientDelay(kind, Math.random())),
      );
    };
    arm('tear');
    arm('micro');
    return () => timers.forEach(clearTimeout);
  }, [cyber]);

  if (!cyber) return null;
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <filter
        id="cyber-tear"
        x="0"
        y="0"
        width="1"
        height="1"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          id="cyber-tear-noise"
          type="fractalNoise"
          baseFrequency="0.00001 0.045"
          numOctaves={1}
          seed={3}
          result="noise"
        />
        <feComponentTransfer in="noise" result="bands">
          <feFuncR type="discrete" tableValues="0.5 0.5 0.5 0.12 0.5 0.5 0.5 0.88 0.5 0.5 0.3 0.5" />
          <feFuncG type="discrete" tableValues="0.5" />
        </feComponentTransfer>
        <feDisplacementMap
          id="cyber-tear-map"
          in="SourceGraphic"
          in2="bands"
          scale={40}
          xChannelSelector="R"
          yChannelSelector="G"
          result="torn"
        />
        <feColorMatrix
          in="torn"
          type="matrix"
          values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
          result="r"
        />
        <feOffset id="cyber-tear-red" in="r" dx={-5} result="r2" />
        <feColorMatrix
          in="torn"
          type="matrix"
          values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
          result="gb"
        />
        <feOffset id="cyber-tear-cyan" in="gb" dx={4} result="gb2" />
        <feBlend in="r2" in2="gb2" mode="screen" />
      </filter>
    </svg>
  );
}

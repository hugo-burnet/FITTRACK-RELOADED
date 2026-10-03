import type { Theme } from '@/stores/theme';

export type BootVariant = 'normal' | 'console' | 'tty1';

export const BOOT_EASTER_EGG_KEY = 'fittrack.bootEasterEggAfter';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DELAY_DAYS = 14;
const DELAY_DAY_COUNT = 15;

/**
 * Le plus long délai que la surprise puisse prendre. `skinUnlock.ts` s'en sert pour son seuil
 * d'ancienneté : une app utilisée depuis plus longtemps que ça a forcément vu la console, sauf
 * ouvertures toutes sautées par une séance en cours — que le seuil rattrape.
 */
export const BOOT_EASTER_EGG_MAX_DELAY_DAYS = MIN_DELAY_DAYS + DELAY_DAY_COUNT - 1;

type BootStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Combien de temps le rideau d'ouverture reste en place, en millisecondes.
 *
 * C'est une durée choisie, pas une mesure : la base est prête bien avant sur un
 * démarrage à chaud. Le rideau ne rapporte donc aucune progression — il présente
 * l'app. `main.tsx` fait courir cette attente **en parallèle** de la préparation
 * de la base : une base lente absorbe l'ouverture au lieu de s'y ajouter.
 *
 * Elles vivent ici et non dans `Boot.tsx` : c'est `holdBootOpening` qui les attend, et un fichier
 * de composants ne peut exporter une fonction sans casser le rechargement à chaud.
 */
export const BOOT_HOLD_MS: Record<BootVariant, number> = {
  normal: 2180,
  console: 3360,
  // La même durée que l'ouverture normale : TTY1 est jouée à chaque lancement, et un thème dont
  // chaque démarrage coûterait trois secondes de plus se quitterait au bout d'une semaine.
  tty1: 2180,
};

/**
 * Ce que la révélation du déblocage de TTY1 ajoute à la console rare : deux lignes sous la
 * commande tapée, et le temps de les lire. Elle ne sert qu'une fois, le jour du déblocage.
 */
export const UNLOCK_REVEAL_EXTRA_MS = 1400;

/**
 * La tenue d'une ouverture, selon ce qu'elle a à dire et à qui.
 *
 * `reducedMotion` : la console TTY1 s'affiche d'emblée dans ce cas, et un écran fixe de plusieurs
 * secondes n'apporte rien à qui a demandé moins d'animation — l'attente retombe à celle de
 * l'ouverture normale. La console rare garde sa tenue : ses lignes y deviennent des fondus, pas
 * une page déjà écrite.
 */
export function bootHoldMs(
  variant: BootVariant,
  options: { unlocking?: boolean; reducedMotion?: boolean } = {},
): number {
  if (variant === 'tty1' && options.reducedMotion) return BOOT_HOLD_MS.normal;
  if (variant === 'console' && options.unlocking) {
    return BOOT_HOLD_MS.console + UNLOCK_REVEAL_EXTRA_MS;
  }

  return BOOT_HOLD_MS[variant];
}

export function getBootStorage(
  readStorage: () => BootStorage = () => window.localStorage,
): BootStorage | null {
  try {
    return readStorage();
  } catch {
    return null;
  }
}

export function scheduleNextBootEasterEgg(
  storage: BootStorage | null,
  now = Date.now(),
  random = Math.random(),
) {
  if (!storage) return;

  try {
    const delayDays = MIN_DELAY_DAYS + Math.floor(random * DELAY_DAY_COUNT);
    storage.setItem(BOOT_EASTER_EGG_KEY, String(now + delayDays * DAY_MS));
  } catch {
    // Storage is an enhancement: boot must still reach the app when it is blocked.
  }
}

export function selectBootVariant(
  storage: BootStorage | null,
  now = Date.now(),
  random = Math.random(),
  theme: Theme = 'dark',
): BootVariant {
  // TTY1 opens on its console every time, and leaves the surprise's date alone: the rare console
  // picks up where it was the day the theme is left. It does not even need storage — the theme
  // is the choice.
  if (theme === 'tty1') return 'tty1';
  if (!storage) return 'normal';

  try {
    const nextAt = Number(storage.getItem(BOOT_EASTER_EGG_KEY));

    if (!Number.isFinite(nextAt) || nextAt <= 0) {
      scheduleNextBootEasterEgg(storage, now, random);
      return 'normal';
    }

    if (now < nextAt) return 'normal';

    return 'console';
  } catch {
    return 'normal';
  }
}

export function holdBootOpening(
  durationMs: number,
  shouldSkip: () => Promise<boolean>,
  onFullOpening: () => void,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      onFullOpening();
      resolve();
    }, durationMs);

    void shouldSkip().then(
      (skip) => {
        if (!skip) return;
        clearTimeout(timer);
        resolve();
      },
      () => {},
    );
  });
}

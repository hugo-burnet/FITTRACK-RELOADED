/**
 * L'illustration d'un palier — un mème embarqué, jamais un trophée.
 *
 * **Pourquoi une image, alors que le disque chiffré suffisait.** Le chiffre
 * reste dans le titre : on le lit, on le raconte. Le jeton, lui, est ce qu'on
 * reconnaît d'un coup d'œil dans la liste. Un disque neutre ne se racontait
 * pas ; un mème si. Les fichiers sont dans `public/milestones/`, servis via
 * `BASE_URL` comme la voix : hors-ligne, pas de clé, pas de réseau.
 *
 * **La table est écrite à la main**, comme le catalogue. Un visuel = un palier,
 * sauf **gigachad** et **rare Pepe**, qui restent les sommets (force / plafonds).
 * Une bulle ou une case vide est interdite : le jeton se lit à 64 px.
 */

export const MILESTONE_ART_KEYS = [
  'pepe-classic',
  'pepe-smug',
  'pepe-sad',
  'pepe-rare',
  'trollface',
  'wojak',
  'doge',
  'this-is-fine',
  'stonks',
  'loss',
  'woman-cat',
  'disaster-girl',
  'distracted',
  'expanding-brain',
  'two-buttons',
  'gigachad',
  'git-gud',
  'skill-issue',
  'we-go-jim',
  'leg-day',
  'chicken-rice',
  'press-f',
  'do-you-even-lift',
  'pump',
  'swole-doge',
  'light-weight',
  'ego-lift',
  'copium',
  'trade-offer',
  'forever-alone',
  'me-gusta',
  'they-dont-know',
  'chill-guy',
  'loading',
  'one-more',
  'uno-reverse',
  'panik-kalm',
  'ez',
  'cheems',
  'computer-dog',
  'monkey-puppet',
  'its-over',
  'locked-in',
  'bonk',
  'always-has-been',
  'iceberg',
  'rock-solid',
  'doms-door',
] as const;

export type MilestoneArtKey = (typeof MILESTONE_ART_KEYS)[number];

const ART_BY_MILESTONE: Readonly<Record<string, MilestoneArtKey>> = {
  'bench-60': 'do-you-even-lift',
  'bench-80': 'doge',
  'bench-100': 'stonks',
  'bench-120': 'pump',
  'bench-140': 'pepe-rare',
  'squat-60': 'leg-day',
  'squat-100': 'swole-doge',
  'squat-140': 'disaster-girl',
  'squat-180': 'pepe-rare',
  'deadlift-100': 'light-weight',
  'deadlift-140': 'ego-lift',
  'deadlift-180': 'gigachad',
  'deadlift-220': 'pepe-rare',
  'overhead-40': 'wojak',
  'overhead-60': 'copium',
  'overhead-80': 'gigachad',
  'hipthrust-100': 'woman-cat',
  'hipthrust-150': 'trade-offer',
  'hipthrust-200': 'gigachad',
  'row-60': 'forever-alone',
  'row-80': 'me-gusta',
  'row-100': 'they-dont-know',
  'dumbbell-20': 'chill-guy',
  'dumbbell-30': 'loading',
  'dumbbell-40': 'distracted',
  'dumbbell-50': 'gigachad',
  'pullup-1': 'git-gud',
  'pullup-5': 'panik-kalm',
  'pullup-10': 'ez',
  'pullup-20': 'gigachad',
  'chinup-1': 'one-more',
  'dip-1': 'uno-reverse',
  'dip-10': 'cheems',
  'pistol-1': 'skill-issue',
  'plank-120': 'computer-dog',
  'plank-300': 'pepe-sad',
  'deadhang-60': 'monkey-puppet',
  'deadhang-120': 'its-over',
  'sessions-10': 'we-go-jim',
  'sessions-50': 'locked-in',
  'sessions-100': 'chicken-rice',
  'sessions-250': 'trollface',
  'sessions-500': 'press-f',
  'sessions-1000': 'pepe-rare',
  'weeks-10': 'this-is-fine',
  'weeks-52': 'bonk',
  'weeks-104': 'two-buttons',
  'weeks-260': 'loss',
  'years-1': 'pepe-classic',
  'years-2': 'expanding-brain',
  'years-5': 'pepe-smug',
  'years-10': 'pepe-rare',
  'tonnage-100': 'always-has-been',
  'tonnage-500': 'iceberg',
  'tonnage-1000': 'gigachad',
  'tonnage-5000': 'pepe-rare',
  'sessions-1': 'rock-solid',
  'doms-48': 'doms-door',
};

/** `undefined` pour un palier retiré du catalogue : sa ligne en base survit. */
export function artForMilestone(id: string): MilestoneArtKey | undefined {
  return ART_BY_MILESTONE[id];
}

/**
 * `BASE_URL` porte le préfixe GitHub Pages sur le web et `./` sous Capacitor —
 * le même contrat que `clipUrl` pour la voix. Un chemin `/milestones/…` 404
 * dans l'APK.
 */
export function milestoneArtUrl(key: MilestoneArtKey): string {
  return `${import.meta.env.BASE_URL}milestones/${key}.jpg`;
}

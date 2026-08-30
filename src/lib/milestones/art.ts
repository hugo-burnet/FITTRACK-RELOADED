/**
 * L'illustration d'un palier — un mème embarqué, jamais un trophée.
 *
 * **Pourquoi une image, alors que le disque chiffré suffisait.** Le chiffre
 * reste dans le titre : on le lit, on le raconte. Le jeton, lui, est ce qu'on
 * reconnaît d'un coup d'œil dans la liste. Un disque neutre ne se racontait
 * pas ; un mème si. Les fichiers sont dans `public/milestones/`, servis via
 * `BASE_URL` comme la voix : hors-ligne, pas de clé, pas de réseau.
 *
 * **La table est écrite à la main**, comme le catalogue. Une clé générée par
 * groupe aurait collé le même visuel à toute une famille et tué l'escalade
 * (wojak → stonks → rare Pepe) qui est la décision de forme.
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
] as const;

export type MilestoneArtKey = (typeof MILESTONE_ART_KEYS)[number];

const ART_BY_MILESTONE: Readonly<Record<string, MilestoneArtKey>> = {
  'bench-60': 'we-go-jim',
  'bench-80': 'doge',
  'bench-100': 'stonks',
  'bench-120': 'pepe-smug',
  'bench-140': 'pepe-rare',
  'squat-60': 'leg-day',
  'squat-100': 'stonks',
  'squat-140': 'disaster-girl',
  'squat-180': 'pepe-rare',
  'deadlift-100': 'we-go-jim',
  'deadlift-140': 'pepe-smug',
  'deadlift-180': 'gigachad',
  'deadlift-220': 'pepe-rare',
  'overhead-40': 'wojak',
  'overhead-60': 'skill-issue',
  'overhead-80': 'gigachad',
  'hipthrust-100': 'woman-cat',
  'hipthrust-150': 'stonks',
  'hipthrust-200': 'gigachad',
  'row-60': 'wojak',
  'row-80': 'doge',
  'row-100': 'pepe-smug',
  'dumbbell-20': 'wojak',
  'dumbbell-30': 'doge',
  'dumbbell-40': 'distracted',
  'dumbbell-50': 'gigachad',
  'pullup-1': 'git-gud',
  'pullup-5': 'this-is-fine',
  'pullup-10': 'pepe-smug',
  'pullup-20': 'gigachad',
  'chinup-1': 'pepe-classic',
  'dip-1': 'pepe-classic',
  'dip-10': 'pepe-smug',
  'pistol-1': 'skill-issue',
  'plank-120': 'this-is-fine',
  'plank-300': 'pepe-sad',
  'deadhang-60': 'this-is-fine',
  'deadhang-120': 'pepe-sad',
  'sessions-10': 'we-go-jim',
  'sessions-50': 'pepe-classic',
  'sessions-100': 'chicken-rice',
  'sessions-250': 'trollface',
  'sessions-500': 'press-f',
  'sessions-1000': 'pepe-rare',
  'weeks-10': 'this-is-fine',
  'weeks-52': 'chicken-rice',
  'weeks-104': 'two-buttons',
  'weeks-260': 'loss',
  'years-1': 'pepe-classic',
  'years-2': 'expanding-brain',
  'years-5': 'pepe-smug',
  'years-10': 'pepe-rare',
  'tonnage-100': 'stonks',
  'tonnage-500': 'doge',
  'tonnage-1000': 'gigachad',
  'tonnage-5000': 'pepe-rare',
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

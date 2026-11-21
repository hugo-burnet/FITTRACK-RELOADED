import type { ProgramPhase } from '@/data/types';
import type { TranslationKey } from '@/i18n/fr';

/**
 * Ce que la phase de la semaine change au coach, en phrases simples.
 *
 * Le miroir lisible de `RANK` (`lib/coach/selectAction.ts`) : la phase ne donne
 * pas de permission au coach, elle **classe** ce que la performance autorise.
 * Si ce classement change, ces phrases changent avec lui — c'est le seul endroit
 * où l'écran le raconte. Le niveau (`loadIndex`) n'y entre pas : il règle les
 * charges prescrites, pas les propositions.
 *
 * « Une décharge n'est pas lue comme un plateau » : `isDeloadLine` écarte les
 * séances de décharge des règles de plateau et de fourchette.
 *
 * `nextPhase` : la semaine suivante, quand une décharge s'annonce — la seule
 * transition qui change ce que le coach dira à la prochaine séance.
 */
export function coachReadingKeys(
  phase: ProgramPhase,
  nextPhase: ProgramPhase | undefined,
): TranslationKey[] {
  const keys: TranslationKey[] = [];
  switch (phase) {
    case 'overload':
      keys.push('program.detailCoachOverload');
      break;
    case 'deload':
      keys.push('program.detailCoachDeload');
      break;
    case 'return':
      keys.push('program.detailCoachReturn');
      break;
    case 'construction':
    case 'progression':
    case 'test':
      keys.push('program.detailCoachBuild');
      break;
  }
  if (nextPhase === 'deload' && phase !== 'deload') keys.push('program.detailCoachNextDeload');
  return keys;
}

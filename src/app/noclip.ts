import { grantSecretMilestone } from '@/data/repositories/milestones';
import { NOCLIP_MILESTONE_ID } from '@/lib/milestones/catalogue';
import { isTty1Unlocked } from '@/stores/skinUnlock';

/**
 * noclip est la mémoire datée du déblocage de TTY1 : **acquis si et seulement si TTY1 est débloqué.**
 *
 * Une seule vérité, le drapeau — la ligne n'est que ce qu'on en garde dans l'historique. Les trois
 * chemins de déblocage (la console rare, l'ancienneté, le thème déjà choisi) donnent donc le palier
 * sans qu'aucun ait à le savoir, et qui avait déjà TTY1 avant que ce palier existe le reçoit au
 * premier démarrage qui suit, sans cérémonie.
 *
 * `celebrate` : vrai quand la console rare **vient** de débloquer TTY1 (l'accueil montre alors la
 * carte), faux pour tout rattrapage. Idempotent, donc sans danger à chaque démarrage.
 *
 * Il ne lève jamais : un palier qui ne s'écrit pas ne doit pas empêcher l'app de s'ouvrir, et il
 * s'écrira au démarrage suivant. C'est le statut qu'ont déjà les paliers d'entraînement.
 */
export async function grantNoclipIfUnlocked(
  storage: Parameters<typeof isTty1Unlocked>[0],
  { celebrate }: { celebrate: boolean },
): Promise<void> {
  if (!isTty1Unlocked(storage)) return;

  try {
    await grantSecretMilestone(NOCLIP_MILESTONE_ID, { celebrate });
  } catch (error) {
    console.error('Le palier noclip n’a pas pu être écrit', error);
  }
}

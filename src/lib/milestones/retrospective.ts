import { anniversaryOf } from './calendar';
import type { EarnedMilestone } from './types';

/**
 * « Il y a un an, tu franchissais ce palier. »
 *
 * **Cette fonction rend `undefined` presque tous les jours, et c'est sa raison
 * d'être.** Une app qui a quelque chose à célébrer chaque matin ne célèbre plus
 * rien : le rappel n'a de valeur que parce qu'il est rare, et la seule façon de
 * le garder rare est de refuser d'en fabriquer.
 *
 * Trois verrous, tous nécessaires :
 *
 * 1. **Cinq âges seulement.** Un, deux, trois, cinq et dix ans. Quatre ans n'est
 *    pas un âge dont on parle, et le fêter dévaluerait les cinq ans.
 * 2. **Une semaine de fenêtre, puis plus rien.** On ne s'entraîne pas tous les
 *    jours ; on ne rattrape pas non plus un anniversaire trois mois après, ce
 *    qui n'est plus un souvenir mais une relance.
 * 3. **Une seule carte à la fois, acquittée pour toujours.** Trois paliers
 *    franchis le même jour de 2023 rendraient trois cartes le même matin de
 *    2024 — exactement le spam contre lequel toute la fonctionnalité est écrite.
 */

/** Du plus rare au plus courant : l'ordre décide qui l'emporte le même jour. */
const CELEBRATED_YEARS = [10, 5, 3, 2, 1] as const;

/** Sept jours. Au-delà, le souvenir n'a plus de date, et il se tait. */
const WINDOW_MS = 7 * 86_400_000;

export interface Retrospective {
  definitionId: string;
  /** L'instant d'origine, pour l'afficher. */
  achievedAt: number;
  years: number;
  /**
   * Ce qui est écrit en base une fois la carte vue.
   *
   * Le palier **et** l'âge, pas le palier seul : le même palier doit pouvoir
   * revenir l'année suivante sous un autre âge, et un acquittement par palier
   * l'aurait fermé pour toujours au premier anniversaire.
   */
  key: string;
}

export function retrospectiveKey(definitionId: string, years: number): string {
  return `${definitionId}:${String(years)}`;
}

interface RetrospectiveOptions {
  now: number;
  /** Les clés déjà vues, que l'accueil relit à chaque ouverture. */
  acknowledged: ReadonlySet<string>;
}

export function pickRetrospective(
  earned: readonly Pick<EarnedMilestone, 'definitionId' | 'achievedAt'>[],
  { now, acknowledged }: RetrospectiveOptions,
): Retrospective | undefined {
  const candidates: Retrospective[] = [];

  for (const item of earned) {
    // Une horloge d'appareil reculée d'un an ferait autrement fêter des
    // anniversaires de paliers pas encore franchis.
    if (item.achievedAt > now) continue;

    for (const years of CELEBRATED_YEARS) {
      const due = anniversaryOf(item.achievedAt, years);
      if (due > now || now >= due + WINDOW_MS) continue;

      const key = retrospectiveKey(item.definitionId, years);
      if (acknowledged.has(key)) continue;

      candidates.push({ definitionId: item.definitionId, achievedAt: item.achievedAt, years, key });
      // Un palier n'a qu'un âge à la fois : deux fenêtres ne peuvent pas se
      // recouvrir, et chercher plus loin ne trouverait rien.
      break;
    }
  }

  return candidates.sort(
    (left, right) =>
      right.years - left.years ||
      left.achievedAt - right.achievedAt ||
      left.definitionId.localeCompare(right.definitionId),
  )[0];
}

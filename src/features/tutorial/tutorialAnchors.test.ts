import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { P1_MISSIONS } from './tutorialMissions';

/**
 * Les ancres que le code compose à l'exécution, et qu'aucune recherche de
 * chaîne ne peut donc trouver.
 */
const BUILT_AT_RUNTIME = new Set([
  // `WorkoutSetRow` compose `workout-${tutorialRank}-set` : une consigne qui
  // vise « la série » sans dire laquelle encadre la mauvaise dès qu'il y en a
  // deux.
  'workout-first-set',
  'workout-second-set',
  'workout-first-set-complete',
  'workout-second-set-complete',
  // `ExerciseList` compose `exercise-${slug}` — un identifiant par ligne du
  // catalogue, qu'aucun composant n'écrit en toutes lettres.
  'exercise-dumbbell-curl',
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Tout ce que le code écrit littéralement comme ancre.
 *
 * Quatre formes, toutes réellement présentes dans le dépôt : l'attribut JSX
 * `tutorialId="x"`, son équivalent brut `data-tutorial-id="x"`, la propriété
 * d'objet `tutorialId: 'x'` des listes d'actions, et la forme conditionnelle
 * `tutorialId={index === 0 ? 'x' : undefined}`. N'en reconnaître qu'une aurait
 * déclaré orphelines des ancres bien posées, et rendu ce test assez bruyant
 * pour finir désactivé.
 */
function declaredAnchors(): ReadonlySet<string> {
  const source = sourceFiles('src')
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  const anchors = new Set<string>();

  const declarations =
    /(?:data-tutorial-id|tutorialId)\s*[=:]\s*(?:\{[^}]{0,240}\}|[^,\n]{0,120})/gs;
  for (const block of source.matchAll(declarations)) {
    for (const quoted of block[0].matchAll(/["']([a-z0-9-]{3,})["']/g)) {
      anchors.add(quoted[1] ?? '');
    }
  }
  return anchors;
}

describe('les ancres du tutoriel', () => {
  /*
   * Le défaut que ce test existe pour empêcher a été trouvé dans un navigateur,
   * pas ici : deux missions désignaient une commande que personne n'avait
   * ancrée — le bouton « Chercher dans les preuves » et le filtre par exercice
   * de l'historique. Rien ne l'avait vu, parce que les tests de missions
   * parlent de la machine et jamais du DOM.
   *
   * Une étape sans ancre ne se voit qu'à l'usage, et sous la forme la plus
   * décourageante : le panneau cherche sa cible six secondes, puis propose de
   * rouvrir l'écran où elle n'est déjà pas.
   */
  it('sont toutes réellement posées dans un composant', () => {
    const declared = declaredAnchors();
    const orphans = P1_MISSIONS.flatMap((mission) =>
      mission.steps
        .filter(
          (step) =>
            step.targetId !== null &&
            !declared.has(step.targetId) &&
            !BUILT_AT_RUNTIME.has(step.targetId),
        )
        .map((step) => `${mission.id}/${step.id} → ${step.targetId ?? ''}`),
    );

    expect(orphans, `cibles sans ancre :\n${orphans.join('\n')}`).toEqual([]);
  });
});

# Protocole disciplinaire RPE — spécification

> Demande du 2026-11-22. Implémenté sur la branche `claude/sleepy-hopper-ngays7`, non publié.

## Objectif

M'empêcher de dépasser volontairement le plafond d'effort que je me suis fixé pour la séance, au service de la
discipline et de la récupération, sans rien dégrader de l'existant.

## Règles

| Cas | Effet |
|---|---|
| RPE ≤ plafond | Rien. |
| RPE manquant | Rien : une case vide ne déclenche pas. |
| RPE > plafond, série de travail validée, séance en cours, protocole actif | La série est **enregistrée telle quelle**, puis la séance est suspendue. |
| Séance suspendue | Plus aucune série validée (ni premier côté), plus d'ajout de série ou d'exercice ; une série enregistrée ne se décoche, ne se retype ni ne se supprime. Consulter, noter, exporter, sauvegarder, **terminer** restent possibles. |
| Correction d'une erreur de saisie | Depuis le panneau : nouvelle valeur (ou aucune). Sous le plafond figé au déclenchement → la séance reprend ; au-dessus → elle reste suspendue avec la nouvelle valeur. L'ancienne valeur reste au journal. |
| Déverrouillage exceptionnel | Confirmation explicite dans une feuille ; la dérogation est journalisée (heure, série, plafond). Elle couvre la série en cause, pas les suivantes. |
| Protocole désactivé | Plus aucun constat ; un verrou en cours se lève ; le journal reste. |

- Plafond réglable de 6 à 9,5 par demi-points, **8 par défaut**, protocole **actif par défaut** (Réglages → Séance).
- Échauffements exclus, comme pour le coach.
- **Indépendant du coach** : le seuil de 8,5 (`INCREASE_MAX_RPE`) qui autorise une hausse de charge n'est ni lu ni
  modifié par le protocole, et inversement.

## Modèle

- Réglage : `settings['rpeDiscipline'] = { enabled, ceiling }` (Dexie, part avec la sauvegarde JSON).
- Journal : `Workout.rpeDiscipline?: RpeDisciplineEvent[]` — `triggered { at, setId, rpe, ceiling }`,
  `corrected { at, setId, previousRpe?, rpe?, ceiling }`, `override { at, setId, ceiling }`. Non indexé : aucune version
  Dexie. Validé en liste par la restauration ; une ligne illisible est ignorée à la lecture.
- Verrou **déduit** du journal (`disciplineState`, `effectiveDisciplineState`), jamais stocké à part.

## Où vit quoi

| Fichier | Rôle |
|---|---|
| `src/lib/rpeDiscipline.ts` | Règles pures : réglage, dépassement, décision après écriture, état. |
| `src/data/repositories/rpeDiscipline.ts` | Réglage, gardes, constat dans la transaction, correction, dérogation, palier. |
| `src/data/repositories/workoutSets.ts` | `completeSet` / `updateSetValues` rendent le constat ; gardes sur les autres écritures. |
| `src/features/workout/useRpeDiscipline.ts` | Le verrou en direct pour l'écran. |
| `src/features/workout/RpeDisciplinePanel.tsx` | Message explicite, correction, dérogation. |
| `src/features/workout/RpeDisciplineTrace.tsx` | Le journal, en séance et dans l'historique. |
| `src/features/settings/RpeDisciplineSettings.tsx` | Interrupteur et plafond. |
| `src/audio/cues.ts`, `voiceScript.json`, `public/voice/rpe-discipline-*.mp3` | Les deux annonces. |

## Annonces

Carillon d'annonce puis voix, par la chaîne existante (`announce` → `planCue` → bus « voice » → `publicAddress`),
respectant le mode (Silence, Sons, Voix). Cue `rpe-discipline-breach`, priorité 4, sans refroidissement : l'unicité
vient du dépôt, qui ne rend `triggered` qu'une fois par déclenchement. Réplique de référence, à la lettre :

> Un dépassement du seuil d'effort a été constaté. Votre autorisation d'entraînement est suspendue. Veuillez ranger
> votre matériel et quitter les installations. Toute contestation sera ignorée. Vous pouvez disposer.

Deux variantes, tirées au hasard comme les autres répliques, qui finissent toutes par « Vous pouvez disposer. ». Une
dérogation est annoncée par « Dérogation enregistrée. Elle figurera à votre dossier. » (`rpe-discipline-override`).

## Palier

Secret `dismissed` — « Vous pouvez disposer » — accordé au premier dépassement de toute la vie de l'app, célébré à
l'accueil ; rattrapé acquitté au démarrage si le journal le porte sans le palier.

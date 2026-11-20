# Fiabilisation du coach — design

> 2026-11-20. Suite de l'audit demandé par l'utilisateur (« Audite mon coach, et les fonctionnalités
> autour. J'aimerais le fiabiliser »), puis : « je te laisse tout gérer, tu peux écrire et valider ».
> Les choix ci-dessous sont donc ceux de l'agent, à relire ; aucun n'a été tranché par l'utilisateur
> sauf mention contraire.

## Pourquoi

À la salle, le coach « n'était pas fiable » : des charges qui sautent, des augmentations qui ne sont pas
les bonnes, un RPE qui semble ignoré. L'audit (moteur, données, écran) a trouvé une trentaine de défauts
dans quatre zones. Aucun ne vient d'un calcul d'arrondi ou d'une migration : ce sont des chemins de la
vraie vie que personne n'avait joués — une série ajoutée, un « Ignorer », une séance allégée, un
échauffement sous une carte « Appliquer ».

## Buts

1. Une exception du coach ne peut jamais empêcher de terminer une séance (règle n° 4).
2. « Appliquer » écrit exactement ce que la carte promet, et rien d'autre.
3. Une carte parle de la dernière séance de son exercice, ou ne dit rien : pas de carte périmée, pas de
   carte perdue, pas de coach muet pour toujours.
4. Le moteur ne lit pas une séance réussie comme un échec.
5. Chaque défaut corrigé a d'abord un test qui échoue.

## Hors périmètre

- **La politique du RPE et des sauts de charge** (lot F). Ce sont des règles qui font ce qui est écrit
  (remise dans la fourchette jusqu'à ± 30 %, RPE lu en moyenne, seuil unique à 9,5). Les changer sans
  l'historique réel de l'utilisateur, ce serait deviner. On attend une sauvegarde à rejouer
  (`npm run coach:replay`) ou des exemples.
- **Le plateau contre « fourchette respectée »** (qui gagne sur la carte) et **le plateau au-dessus de
  12 répétitions** : même raison, c'est une décision de produit testée telle quelle.
- **`src/lib/backup/validate.ts` et `src/data/repositories/backup.ts`** : la branche de synchronisation
  non publiée (`ccr-homelab-sync-20261108`) les réécrit. On n'y touche pas ; la validation plus stricte
  des recommandations restaurées attend sa fusion.
- **Un marqueur de rattrapage au démarrage** pour une app tuée entre l'enregistrement de la séance et
  le passage du coach : il demande un champ de plus sur la séance, donc le schéma, la sauvegarde et la
  synchro. La fenêtre est de quelques millisecondes ; consigné en dette.
- Aucune fusion dans `master`, aucune release : sur demande explicite seulement.

## Anti-buts

- Corriger un test en changeant son assertion sans dire pourquoi la règle change.
- Rendre le coach plus bavard. Dans le doute, il se tait.

## Approches

1. **Corriger défaut par défaut, test d'abord, par lots indépendants** — retenue. Chaque lot se relit
   et se livre seul ; les lots A à D ne touchent pas aux règles du moteur.
2. Réécrire le cycle de vie des recommandations en machine à états explicite. Plus propre, mais c'est
   un chantier de schéma au moment où la synchro attend sa fusion : écarté.
3. Ne corriger que le moteur (ce que l'utilisateur a senti). Écarté : l'audit montre que « Appliquer »
   et les cartes périmées produisent les mêmes symptômes vus de la salle.

L'exécution : un plan tâche par tâche, des sous-agents à bas coût par tâche, relecture de chaque diff
par l'agent principal, puis `typecheck`, tests, build.

## Lot A — La fin de séance ne casse jamais

- **A1.** Les trois requêtes vives qui appellent le coach (`WorkoutFinishScreen`, `useActiveWorkout`,
  `HomeVolumeCard`) rattrapent une exception et rendent « rien à dire ». Une requête vive qui rejette
  relance l'erreur au rendu : l'écran d'erreur global remplaçait l'écran de fin.
- **A2.** `finalizeCoachForWorkout` fait son suivi, son retrait et son enregistrement dans **une**
  transaction Dexie : tout ou rien. L'évaluation (lecture) reste dehors.
- **A3.** Elle est idempotente : si une recommandation porte déjà ce `sourceWorkoutId`, elle ne refait
  rien.

## Lot B — « Appliquer »

- **B1.** N'écrit que sur les séries de travail non validées : ni échauffement, ni dégressive.
- **B2.** Écrit sur **toutes** les lignes du même exercice dans la séance.
- **B3.** L'écriture et le passage en « suivie » sont une seule transaction. Si aucune série n'a été
  écrite, la carte reste en attente.
- **B4.** Séance allégée à la main (`deloadPercent`) : la carte reste lisible mais sans « Appliquer » ;
  l'objectif attend la séance d'après.
- **B5.** « Ignorer » et « Appliquer » ne laissent plus une promesse rejetée sans suite.

## Lot C — Le cycle de vie d'une carte

- **C1. Un refus dure 14 jours** (`DISMISSAL_DAYS`), plus pour toujours. Passé ce délai, la même
  proposition peut revenir. Choix de l'agent : une durée, parce qu'elle se lit et se teste ; « jusqu'à
  ce que la performance change » demandait de définir « changer ».
- **C2. Une séance allégée ne touche pas aux cartes** : ni suivi, ni retrait, ni nouvelle carte.
- **C3. Séance abandonnée** : les objectifs qu'elle avait marqués « suivis » redeviennent en attente.
- **C4. Séance supprimée ou corrigée depuis l'historique** : ses cartes en attente sont retirées
  (`superseded`). Pas de réévaluation : la prochaine séance de l'exercice s'en charge.
- **C5. L'aperçu de l'écran de fin applique le même filtre des refus** que l'enregistrement : on ne
  montre pas une carte qui ne sera pas posée.
- **C6. Une carte chiffrée de plus de 28 jours n'est plus proposée** en séance (`PENDING_MAX_AGE_DAYS`),
  à la lecture, sans rien effacer.
- **C7. « Suivie » se lit sur n'importe quelle série de travail** tenue à la charge de l'objectif, pas
  sur la seule dernière : une série finale allégée ne fait plus d'un objectif tenu un objectif manqué.

## Lot D — La voix et le texte disent ce que la carte dit

- **D1.** La voix n'annonce une hausse ou un ajustement que si la carte porte une charge.
- **D2.** « Maintien — progression différée » précède le constat au lieu de le remplacer.
- **D3.** Le pas de charge par défaut refuse une valeur sous le minimum de l'appli.

## Lot E — Le moteur : des défauts, pas de politique

- **E1. Une série ajoutée hérite de la prescription** (`targetReps` et `targetRepsMax`) de la série
  copiée quand elle en a une. Elle prenait pour cible les répétitions *faites* et perdait le haut de la
  fourchette : en 8 – 12, `10 · 10 · 10` plus une série ajoutée faite à 9 devenait « bas de fourchette
  manqué ». Sans prescription (séance libre), rien ne change.
- **E2. Une série sans cible à côté de séries ciblées est une série en plus** : elle ne rend pas la
  fourchette illisible et ne change pas le contrat de répétitions.
- **E3. Plus de répétitions au total à la même charge, c'est un progrès** : pas de plateau sur
  `10 · 9 · 8` → `10 · 10 · 8` → `10 · 10 · 9`.
- **E4. La reprise se compte en jours civils locaux, et strictement au-delà de 14** (amendement R5).
  Quatorze jours pile — un exercice qui revient toutes les deux semaines — n'est pas une pause, et
  l'heure de début de séance ne change plus la carte.
- **E5. Pas de « reprise » sur un exercice sans série de travail validée.**
- **E6. Une fourchette inversée** (maximum sous le minimum) se lit comme une cible unique.
- **E7. Une charge non finie** (`NaN`) ne produit jamais de proposition chiffrée.
- **E8. Le volume par muscle** compte ses semaines en jours civils : une séance à 8 h après des séances
  à 19 h ne compte plus double.

## Lot F — RPE et sauts de charge (en attente)

Trois lectures du code à confronter à l'historique réel avant de toucher quoi que ce soit :

- la remise dans la fourchette part de la **meilleure** série d'une **seule** séance, et un RPE bas
  grossit le saut ;
- le RPE est une **moyenne** (`8 · 9 · 10` → 9, « pas arraché », la hausse passe) et ne compte que si
  la moitié des séries en portent un ;
- un seul seuil (9,5) bloque une hausse ; un RPE bas dans la fourchette ne propose rien.

## Tests

- Unitaires d'abord pour chaque point des lots A à E (Vitest, `fake-indexeddb` pour les dépôts).
- E2E : « Appliquer » avec un échauffement, et « Ignorer » — deux parcours que rien ne jouait.
- Fin : `npm run typecheck && npm run lint && npm run test:run && npm run build`, puis `npm run test:e2e`.

## Laissé à l'exécutant

Le nom des helpers, l'endroit exact d'un `try/catch`, la formulation des libellés (dans
`src/i18n/fr.ts`, en français). Pas les seuils (14 jours, 28 jours) ni le périmètre.

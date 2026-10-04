# Coach v2 — lire l'effort, pas seulement les répétitions

**Date :** 2026-10-04
**Statut :** conception validée le 2026-10-04 (décisions au § 9)
**Prolonge :** Lot 18 (`docs/plans/lot-18-coach-deterministe.md`) et
`2026-08-13-program-intention-coach-design.md` (le bloc fixe l'intention, le Coach valide l'action).
**Ne remplace pas :** le moteur déterministe et pur (`src/lib/coach/`, ni Dexie ni `Date.now()`),
le journal des recommandations, la double progression comme règle de base.

## 1. Objectif

Le coach du Lot 18 connaît un seul geste : haut de fourchette → on monte ; même 1RM trois fois →
plateau. C'est juste sur un historique propre, et trop simple sur un vrai. La v2 lui fait lire
ce que l'app enregistre déjà et qu'il ignore : **l'effort** (RPE), **l'intention** (série à
l'échec), **l'échelle** (un pas de 2,5 kg n'a pas le même sens à 5 kg et à 100 kg), **le
contexte** (variante de routine, retour de pause) et **le muscle** (volume de la semaine).

Phrase produit :

> Le coach ne propose rien que l'historique ne justifie, et il dit ce qu'il a lu.

## 2. Ce que l'historique réel a montré

Mesuré le 2026-10-04 sur une sauvegarde réelle : 28 séances en ~8 semaines, 565 séries de
travail, 164 recommandations journalisées, et un rejeu du moteur séance par séance. Les trois
défauts francs ont déjà été corrigés (§ 2.1) ; le reste est la matière de cette spec.

| Constat | Chiffre | Règle |
|---|---|---|
| Séries de travail portant un RPE | **477 / 565 (84 %)** — la tranche 0 du Lot 18 fixait 50 % | R1 |
| RPE lu par le coach | **0** — aucune occurrence de `rpe` dans `lib/coach` | R1 |
| Séries marquées « échec » | 74, RPE moyen 9,54 | R2 |
| Fausses alertes dues à une série à l'échec | pec fly « baisse de reps » ×3 ; élévations latérales 5 → 2,5 kg (−50 %) | R2 |
| Sauts de charge proposés ≥ 15 % / ≥ 25 % | 35 / 73 et 16 / 73 (max +60 %, avant correctif) | R3 |
| Exercices pratiqués sous plusieurs fourchettes | **16 / 30** (rowing 10–12 et 8–10 ; rotation externe : quatre) | R4 |
| Retours après ≥ 14 jours sans l'exercice | 15 (presse : 21 j, puis « passe à 120 kg ») | R5 |
| Séries directes par semaine, extrêmes | épaules 10,3 · dos 9,0 · pecs 8,8 … quadriceps 5,1 · ischios 3,8 | R6 |

### 2.1 Déjà corrigé (2026-10-04, hors de cette spec)

- **Pas de charge > un incrément** (`lib/loadIncrement.ts`) : depuis un demi-pas, l'arrondi
  tranchait vers le haut — 12,5 → 20 kg sur une machine au pas de 5.
- **Consolider n'est pas stagner** (`plateauSignal`) : une séance plafonnée ne fait pas monter
  le 1RM estimé ; trois plafonds à la même charge passaient pour un plateau, et le plateau
  interdisait la hausse.
- **Record de répétitions au-delà de 12** (`plateauSignal`) : `estimateOneRepMax` ne lit rien
  au-dessus de 12 répétitions ; un 12,5 × 13 était jugé sur sa série à 11.

Après ces trois correctifs, le rejeu ne trouve plus que deux plateaux sur tout l'historique : un
vrai (pec fly, `10 × 12 @9 · F10 × 12 @10` trois fois) et un faux, sur une séance de reprise
volontairement plus légère — exactement le cas de R4.

## 3. Invariants

1. **Pur et déterministe.** Toute règle vit dans `src/lib/coach/`, prend des structures, rend des
   signaux. Testée en TDD avant d'être écrite (`CLAUDE.md`).
2. **La donnée absente n'est pas une donnée.** Un RPE non noté n'est ni 10 ni 7 : la règle qui en
   a besoin se tait et le comportement actuel s'applique. Même principe que la revue des cibles
   (« le RPE absent n'est pas un RPE supérieur à 8 »).
3. **Jamais plus d'un incrément.** Aucune règle ne compose deux pas en une recommandation.
4. **Un seuil est une politique, pas une vérité.** Chaque seuil chiffré (RPE 9,5, 10 %, 14 jours,
   bornes de volume) est une constante nommée, exportée, testée, et l'UI dit « règle de l'app »,
   jamais « la science dit ». La KB couvre mal la programmation (25 affirmations sur 410,
   `fittrack-kb-contract/benchmark/e5-retrieval/RESULTATS.md`) : aucun de ces seuils n'est sourcé
   à ce jour, et la spec ne prétend pas le contraire.
5. **Un signal porte ses preuves.** Chaque nouvelle règle remplit `evidence` avec ce qu'elle a lu,
   pour que la carte puisse dire *pourquoi*.

## 4. Hors périmètre

- **Un LLM**, local ou distant. Le Lot 18 l'a tranché et rien ici ne le rouvre ; un modèle de
  langage ne pourra que reformuler ces signaux, jamais les produire.
- **L'état du jour** (sommeil, douleur, fatigue déclarée) : spec séparée, qui s'appuiera sur
  l'espace RUNTIME de la KB (`symptomDuring`, `irritability`…). R1 en est le prérequis : on ne
  module pas sur un ressenti avant de savoir lire l'effort mesuré.
- Génération de programme, variabilité cardiaque, Health Connect.

## 5. Règles

### R1 — L'effort qualifie la progression

**Constat.** `70 × 12 × 3 @8 / 9 / 9,5` et `70 × 12 × 3 @8,5 / 8,5 / 9` sont la même séance pour le
moteur. Pour le pratiquant, la seconde est un progrès : même travail, moins d'effort.

**Donnée lue.** `WorkoutSet.rpe` (6 à 10 par 0,5, RF-30). Il faut l'ajouter à `CoachSetInput` et à
`coachLineFromSource`, qui ne le transmettent pas aujourd'hui.

**Règle.** On appelle *effort de séance* la moyenne des RPE notés sur les séries de progression
(`progressionSets`), séries à l'échec exclues (R2). Défini seulement si au moins la moitié de ces
séries porte un RPE.

1. **Plafond à l'arraché.** Plafond atteint avec un effort ≥ `CEILING_GRINDING_RPE` (9,5) :
   le signal `range_ceiling_reached` est émis mais `increase_load` n'est pas autorisé ; nouveau
   drapeau d'évidence `ceiling_grinding` (« Plafond atteint à l'échec : refais-le plus facilement
   avant de monter »). *Décision Q1 : consolider.*
2. **Consolidation lisible.** Même charge, mêmes répétitions qu'à la séance comparable
   précédente, effort en baisse d'au moins 0,5 → nouveau code `consolidating` (« Même travail,
   moins d'effort »). Rang d'affichage : sous un plafond (qui reste la nouvelle à donner),
   au-dessus de `range_satisfied`.
3. **Plateau qualifié.** Le plateau existant n'est confirmé que si l'effort de la dernière séance
   n'est pas inférieur d'au moins 0,5 à celui de la plus ancienne de la fenêtre. Un effort en
   baisse lève le plateau ; un effort maximal (≥ 9,5) sur toute la fenêtre l'accompagne d'un
   drapeau `at_failure` qui oriente vers une décharge (`lib/deload.ts`) plutôt que vers « tiens bon ».

**Sans RPE** : comportement actuel, à l'identique.

### R2 — La série à l'échec est une intention, pas une défaillance

**Constat.** `setType: 'failure'` est la dernière série poussée au-delà de la prescription. Le
moteur la lit comme une série normale : `12 @8,5` puis `F 8 @9,5` devient « Baisse de reps » ; une
série à l'échec à 10 sous un plancher de 12 déclenche `range_missed` et propose −50 %.

**Règle.**
- `intra_session_drop` ignore les séries à l'échec (comme référence et comme série jugée).
- `floorMiss` (donc `range_missed`) juge le plancher sur les séries hors échec. Une séance dont
  toutes les séries de progression sont à l'échec ne témoigne de rien pour le plancher.
- La partition plafond / fourchette se lit sur les séries hors échec. Une série à l'échec qui
  dépasse le plafond ajoute une évidence `failure_reps_over_ceiling` (marge disponible), sans
  changer la partition. *Décision Q5 : information seulement.*
- Le 1RM estimé et le plateau **continuent** de lire les séries à l'échec : ce sont les mieux
  mesurées de la séance.

### R3 — Le pas se mesure aussi en pourcentage

**Constat.** 5 → 7,5 kg aux élévations latérales, c'est +50 %. La double progression à pas fixe en
kilos est conçue pour des charges où le pas est petit devant la charge.

**Règle.**
1. **Pas réel déduit de l'historique.** `inferLoadIncrementKg(lines)` : le plus petit écart non nul
   entre deux charges distinctes réellement soulevées sur l'exercice, s'il est plus fin que le
   pas par défaut et qu'il apparaît au moins deux fois. Priorité : réglage explicite de
   l'exercice → pas déduit → table par équipement. Sur l'historique mesuré, cela donne 2,5 kg aux
   machines où l'on charge 12,5 ou 47,5 — la cause du bug corrigé au § 2.1.
2. **Pas relatif plafonné.** Si le pas proposé dépasse `MAX_RELATIVE_STEP` (10 %) de la charge,
   le plafond n'autorise pas `increase_load` tout de suite : il autorise `increase_reps` au-delà
   de la fourchette, jusqu'à `targetRepsMax + EXTRA_REPS_BEFORE_BIG_STEP` (3), puis la hausse.
   Évidence `relative_step_pct` pour que la carte affiche le pourcentage. *Décision Q2 : 10 % et
   3 répétitions.*

### R4 — Ne comparer que ce qui est comparable

**Constat.** La moitié des exercices est pratiquée sous plusieurs fourchettes (variantes A/B,
séances « reprise »). Le moteur lit tout comme une seule suite : une reprise volontairement plus
légère au pec fly devient un plateau.

**Règle.** L'historique d'une règle de séance à séance (`range_missed`, `plateau`, R1-2) est
restreint aux séances qui ont le **même contrat de répétitions** que la dernière
(`targetReps`, `targetRepsMax`). Les séances sans contrat forment leur propre flux, lu par le
plateau seulement (comme les imports Hevy). Le 1RM et les records ne changent pas : ils restent
lus sur tout l'historique.

*Alternative écartée* : la clé « même routine ». Elle casse au premier renommage, et deux routines
peuvent prescrire le même contrat — ce qui est comparable, c'est la prescription.

### R5 — Le temps qui passe

**Constat.** 15 retours après ≥ 14 jours en 8 semaines. Après 21 jours sans presse, le coach
propose +5 kg comme si les séances s'enchaînaient.

**Règle.** Si l'écart avec la séance comparable précédente atteint `RETURN_GAP_DAYS` (14, décision
Q4) :
- pas d'`increase_load` ni d'`add_set` sur la séance de retour ; signal `returning`
  (« Reprise après N jours : on consolide avant de monter ») ;
- la fenêtre du plateau et de `range_missed` repart de la séance de retour.

Aucune baisse automatique : c'est un constat, pas une décharge imposée.

### R6 — Le muscle et la semaine

**Constat.** Le coach raisonne exercice par exercice et peut proposer `add_set` sur un muscle déjà
très travaillé. Sur l'historique : épaules 10,3 séries directes par semaine (17,6 en comptant le
travail indirect), ischios 3,8, quadriceps 5,1.

**Règle.**
- Volume hebdomadaire **en séries directes comptées** (muscle principal = 1), sur les 7 derniers
  jours glissants, avec la même logique que `muscleBalance`, qui compte et ne pondère pas
  (cf. le commentaire de `lib/analytics/involvement.ts`). Le travail indirect à 0,4 est affiché en
  contexte, jamais utilisé pour décider.

**Bornes adaptées à l'utilisateur (décision Q3).** Aucun chiffre universel. Les bornes viennent de
l'historique de la personne, et c'est elle qui les corrige :

- **Référence personnelle** par muscle : les 6 dernières semaines complètes. Il en faut au moins 3
  où le muscle a été travaillé, sinon la règle se tait (invariant 2).
- **Plafond par défaut** = le plus haut volume hebdomadaire observé sur ces semaines, soit ce que
  la personne a déjà encaissé. `add_set` n'est autorisé que si la semaine glissante est en dessous.
  La règle n'empêche pas de progresser en volume : elle empêche le coach de proposer d'aller
  au-delà de ce qui a déjà été tenu.
- **Plancher par défaut** = aucun. L'app ne décide pas que 3,8 séries d'ischios, c'est trop peu :
  c'est peut-être un choix. Le signal `volume_low` n'existe que pour un muscle dont la personne a
  posé un plancher, et se déclenche sous ce plancher deux semaines de suite.
- **Réglage** : un écran « Volume par muscle » montre, pour chaque muscle, la médiane et le
  maximum de ses 6 semaines, et permet de fixer un plancher et un plafond. Stockage dans la table
  `settings` (clé `coachVolumeBounds`) : aucune version de schéma.

Ce signal est **par semaine**, pas par exercice : il demande une carte à part (accueil ou fin de
séance), et un `exerciseId` facultatif dans le journal.

### R7 — Fatigue générale (reportée)

Plusieurs exercices qui régressent la même semaine, c'est de la fatigue, pas N plateaux. Règle
envisagée : ≥ 3 exercices avec `range_missed` ou plateau `at_failure` sur 7 jours → une seule
suggestion de décharge. **Non observé dans l'historique mesuré** : reportée jusqu'à ce qu'un cas
réel existe pour l'écrire en test.

## 6. Données et schéma

- **Aucune version de schéma pour R1 à R5** : `rpe`, `setType`, `performedAt` et les cibles copiées
  sur la série existent déjà.
- `CoachSetInput` gagne `rpe?` ; `CoachExerciseLine` gagne `primaryMuscle` (instantané
  `exercisePrimaryMuscle`, déjà sur `workoutExercises`).
- `CoachSignalCode` gagne `consolidating`, `returning`, `volume_low`. Lecture rétrocompatible :
  les anciennes lignes du journal ne changent pas.
- R6 : bornes dans `settings` (clé `coachVolumeBounds`, sauvegardée avec le reste de la table). Le
  signal de semaine pourrait demander un `exerciseId` facultatif sur `coachRecommendations` ; à
  trancher au plan de la tranche 5, avec la version de schéma qui l'accompagne si besoin.
- Toutes les chaînes nouvelles dans `src/i18n/fr.ts` (`coachCopy`).

## 7. Banc de rejeu

Chaque règle se valide sur l'historique réel avant d'être livrée :

- un script `scripts/coach-replay.ts` (dev uniquement, hors bundle) qui lit une sauvegarde
  passée en argument et imprime, séance par séance, les signaux avant et après ;
- **la sauvegarde n'entre jamais dans le dépôt.** Les cas utiles en sont extraits à la main,
  réduits à quelques séries, comme fixtures de test.

C'est ce banc qui a trouvé les trois correctifs du § 2.1, dont un qui n'était visible qu'en
combinaison avec un autre.

## 8. Ordre de livraison

| Tranche | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| 0 | Banc de rejeu | Mesurer avant de changer |
| 1 | R2 (échec) + R3.1 (pas déduit) | Petits, sans UI nouvelle, suppriment les pires alertes |
| 2 | R1 (RPE) | Le plus gros gain ; la donnée est là à 84 % |
| 3 | R4 (comparabilité) + R5 (pause) | Ferment les faux plateaux restants |
| 4 | R3.2 (pas relatif) | Change la forme des recommandations, à valider en salle |
| 5 | R6 (volume) | Nouvelle carte, éventuellement schéma |
| — | R7 | Quand un cas réel existera |

Chaque tranche : tests contrat d'abord, rejeu avant / après, `typecheck`, `test:run`, `build`.

## 9. Décisions (2026-10-04)

| | Question | Décision |
|---|---|---|
| Q1 | Plafond atteint à RPE ≥ 9,5 | **Consolider** : refaire la charge avant de monter |
| Q2 | Pas relatif | **10 %** maximum ; au-delà, **3 répétitions** de plus que la fourchette avant le saut |
| Q3 | Bornes de volume | **Adaptées à l'utilisateur** : plafond tiré de son historique, plancher seulement s'il le pose (R6) |
| Q4 | Retour de pause | **14 jours** |
| Q5 | Série à l'échec au-delà du plafond | **Information** ; elle ne change pas la partition |

## 10. Tests minimaux (contrat)

- R1 : plafond `12/12/12 @8/8,5/9` → `increase_load` ; même plafond `@9,5/10/10` → pas
  d'`increase_load`, drapeau `ceiling_grinding`.
- R1 : `70 × 11 × 3 @9` puis `70 × 11 × 3 @8,5` sur 10–12 → `consolidating` affiché devant `range_satisfied`.
- R1 : plateau dont l'effort baisse de 0,5 → pas de plateau ; plateau à effort ≥ 9,5 partout →
  plateau + `at_failure`.
- R1 : RPE noté sur moins de la moitié des séries → sortie identique au moteur actuel.
- R2 : `12 @8,5 · F 8 @9,5` → aucun `intra_session_drop`.
- R2 : `5 × 12 · F 5 × 10` deux fois sur 12–15 → aucun `range_missed`.
- R3 : charges historiques 10 / 12,5 / 15 sur machine → pas déduit 2,5.
- R3 : élévations à 5 kg, pas 2,5 (+50 %) au plafond 15 → `increase_reps` jusqu'à 18, pas
  d'`increase_load`.
- R4 : séance « reprise » 7,5 × 10 sur 10–12 après des 10 × 12 sur 12–15 → pas de plateau.
- R5 : écart de 21 jours → pas d'`increase_load`, signal `returning`, fenêtre remise à zéro.
- R6 : semaine glissante au plus haut des 6 dernières semaines → `add_set` retiré, `increase_load`
  intact ; moins de 3 semaines d'historique → aucun effet.
- R6 : sans plancher posé, aucun `volume_low`, même à 2 séries par semaine ; plancher posé à 8 et
  deux semaines à 6 → `volume_low`.
- Non-régression : les 52 tests actuels de `evaluate.test.ts` restent verts sans modification
  d'assertion.

## 11. Checkpoint — en salle

- [ ] Une séance plafonnée facilement (RPE ≤ 9) : la hausse proposée est juste et atteignable.
- [ ] Une séance plafonnée à l'échec : le coach propose de refaire, et dit pourquoi.
- [ ] Une série à l'échec en fin d'exercice ne déclenche plus d'alerte.
- [ ] Aux élévations latérales, le coach ne propose plus un saut de 50 %.
- [ ] Après deux semaines sans un exercice, il propose de reprendre, pas de monter.

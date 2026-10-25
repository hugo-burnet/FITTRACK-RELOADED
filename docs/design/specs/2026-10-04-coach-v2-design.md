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
4. **Un seuil est une politique, pas une vérité.** Chaque seuil chiffré (RPE 9,5, 0,5 point, 14 jours,
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
   le signal `range_ceiling_reached` est émis, sans charge proposée, et ni `increase_load` ni
   `add_set` ne sont autorisés (consolider, c'est refaire la même séance) ; nouveau
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
- **Le plafond se lit sur toutes les séries, échec compris** ; la fourchette tenue
  (`range_satisfied`) se lit hors échec. Une série à l'échec qui s'arrête sous le haut dit que la
  charge n'est pas maîtrisée : pec fly `5 × 15 · F 5 × 14` sur 12–15 n'est pas un plafond.
  *Corrigé le 2026-10-04 sur remarque de l'utilisateur* : la première version écartait la série
  à l'échec de toute la partition, et le rejeu inventait ce plafond.
- Une série à l'échec qui dépasse le plafond ajoute une évidence `failure_reps_over_ceiling`
  (marge disponible), sans changer la partition. *Décision Q5 : information seulement.*
- Le 1RM estimé et le plateau **continuent** de lire les séries à l'échec : ce sont les mieux
  mesurées de la séance.

### R3 — Le cran est imposé ; ce sont les répétitions qui s'adaptent

**Constat.** 5 → 7,5 kg aux élévations latérales, c'est +50 %. La double progression à pas fixe en
kilos est conçue pour des charges où le pas est petit devant la charge.

**Règle.**
1. **Le cran est celui de la fiche de l'exercice.** Champ « Incrément de charge » déjà présent
   (« Vide = défaut selon le matériel ») : renseigné, il s'ajoute **tel quel**, sans arrondi à sa
   grille — 5 kg + une plaque de 1,125 kg sur une poulie font 6,125, quand l'arrondi aux multiples
   de 1,125 donnait 5,625, une charge qui n'existe pas. Vide, la table par matériel, dont les
   résultats restent sur sa grille. Vaut pour le coach, la revue des cibles, la prescription et
   la décharge des programmes (`resolveLoadStep`). *Révisée le 2026-10-04 : la première version
   déduisait le cran des charges soulevées ; elle ne savait pas lire un micro-chargement de
   1,125 kg, et contournait en silence un réglage que la fiche promet de respecter. Retirée sur
   décision de l'utilisateur.*
2. **Assez de répétitions pour absorber le cran.** Le cran est celui du matériel — +2 kg sur des
   haltères, on n'a pas le choix. Ce qui s'adapte, c'est le nombre de répétitions exigé avant de
   monter : assez pour que, une fois le cran posé, on retombe encore au moins sur le bas de la
   fourchette, à une demi-répétition près (la précision d'Epley, pas mieux). Avec l'inverse
   d'Epley arrondi au plus proche, `repsToAbsorbStep(charge, charge suivante, plancher)`, et au
   minimum le plafond de la fourchette :
   - rowing 70 kg, +2,5, 10–12 → 12 : sur une charge lourde, la règle se confond avec le plafond ;
   - curl 10 kg, +2, 10–12 → **18** répétitions à 10 kg avant 12 kg ;
   - élévations 5 kg, +2,5, 12–15 → 33 : le cran est trop gros pour l'exercice, et la carte le dit.
   - vérifié sur l'historique : au développé incliné, 18 × 12 × 3 puis 20 × 8 × 3, pile le
     plancher — la règle demande 12 répétitions à 18 kg, le coach v1 proposait 20 kg dès 10–11.
     Sur 69 propositions de hausse de l'historique, 25 restent ; l'arrondi supérieur n'en
     laissait que 18, en réclamant par exemple 13 répétitions au leg curl pour 0,2 répétition.

   Tant que toutes les séries n'y sont pas, le plafond reste affiché sans charge proposée,
   avec le nombre visé ; seule `increase_reps` est autorisée. Ne s'applique qu'aux charges
   (`weightRole: 'load'`) : un lest s'ajoute au poids du corps, une assistance se retire, et le
   rapport entre deux crans n'y dit rien. *Décision Q2, révisée le 2026-10-04 : la première
   version (10 % de saut maximal, 3 répétitions au-delà de la fourchette) a été écartée par
   l'utilisateur avant d'être codée — le cran ne se choisit pas.*

   **Amendement du 2026-10-14 — la règle ne vaut que pour une fourchette.** « Retomber au bas
   de la fourchette » suppose un bas distinct du haut. Une cible unique (5×5, 3×10, ou une paire
   5–5) n'en a pas : le plancher est le plafond, et l'exigence d'Epley dépasse alors toujours la
   cible — 6 répétitions pour un 5×5 de 40 à 160 kg, 14 pour un 3×10 à 20 kg aux haltères — que
   le programme ne prescrit pas. Reproduit sur le moteur : aucun 5×5 sous 180 kg ne se voyait
   proposer le cran, même réussi trois séances de suite, alors que l'application livre les
   modèles « 5×5 — A/B ». Sans fourchette, R3.2 se tait : le plafond atteint propose le cran du
   matériel, comme avant la tranche 4 (R1 garde la main : une cible arrachée à RPE 9,5 ou plus
   ne propose toujours rien). C'était le premier des écarts laissés par l'audit du
   2026-10-13. *Non rejoué sur l'historique réel (la sauvegarde n'est pas dans le dépôt) : à
   passer par `npm run coach:replay` avec la sauvegarde avant de se fier aux chiffres
   ci-dessus.*

   **Amendement du 2026-10-16 — très au-dessus du plafond, un cran ne remet pas dans la fourchette.** Quelqu'un qui fait 30 répétitions à
   40 kg sur un 15 – 20 (un max d'au moins 80 kg) se voyait proposer 42,5 kg : un cran, après lequel il en fait encore 26 — trois séances pour
   revenir dans la fourchette. Quand, un cran plus haut, la capacité prévue (`30 × (max / charge − 1)` : le max d'Epley de la série la plus
   longue, plus la réserve du RPE moyen) dépasse encore le plafond, le coach propose **la charge qu'un benchmark aurait proposée**
   (`loadForRange`, spec benchmark §3 ter) au lieu du cran — jamais moins qu'un cran, jamais plus de 30 % de plus que la charge d'aujourd'hui.
   Sinon la règle est celle d'avant : 100 × 12 sur un 5 – 12 passe à 102,5, pas à 107,5. Une fourchette ouverte, une seule charge,
   `weightRole: 'load'` ; R1 (effort maximal) et R5 (reprise) gardent la main. Preuves ajoutées : `ceiling_rebalanced`, `top_reps`,
   `target_reps`. À la demande de l'utilisateur : « il faut que le coach te rebalance dans une range 15-20 ». *Non rejoué sur l'historique réel.*

   **Amendement du 2026-10-16 (suite) — le cas inverse : très sous le bas de la fourchette.** « Veux-tu que le coach te remette aussi dans la
   fourchette quand tu es en dessous ? » — « Oui. » La règle « bas manqué deux fois » (R3, `range_missed`) enlevait **un** cran : 8, 7, 6 à 40 kg
   sur un 15 – 20 ne se corrige pas d'un cran de 2,5 kg, il en fallait quatre séances de deux. Quand un cran de moins laisse la pire série sous
   le bas de la fourchette, le coach en **enlève autant qu'il en faut** (`stepsBackIntoRange`), un par un, jusqu'à ce que la pire série y retombe :

   - ce qu'elle a tenu, plus ce que chaque cran lui rend — `(30 + capacité) × (charge / charge allégée − 1)`, la même lecture d'Epley que le
     benchmark, la capacité étant la meilleure série plus la réserve du RPE moyen —, **à une demi-répétition près** (des répétitions, c'est un
     compte entier : 7,97 prévues, c'est 8) ;
   - **le moins de crans possible**, pas la charge d'un benchmark. Celle-là garde deux répétitions de réserve à la dernière série, ce qu'une
     correction n'a pas à exiger : 100 kg à 8 · 8 · 7 sur un 8 – 12 passeraient à 90 kg pour une répétition de manque. Premier jet écarté pour
     cette raison (il rendait le cran de la règle d'avant trop souvent inutile) ;
   - **au plus 30 % de moins** que la charge du jour (`BENCHMARK_MAX_JUMP`, comme dans l'autre sens), et un cran déjà plus loin que ça (5 kg,
     un pas de 2,5) reste ce qu'il était ;
   - même lecture que le plafond (`capacityReading`) : une fourchette ouverte, une seule charge sur toutes les séries, une charge qu'on soulève.
     Une pyramide, une cible unique, une assistance ou un lest gardent un cran de moins, comme avant ;
   - preuves ajoutées, seulement quand il y a plus d'un cran : `floor_steps` (le compte) et `target_reps_max` ; la carte dit « 3 crans de moins
     plutôt qu'un seul : à 32,5 kg, tu retombes dans la fourchette (15 – 20 reps). ».

   Valeurs de référence calculées à part (script Python hors du dépôt) : 40 kg, 8 · 7 · 6 sur un 15 – 20 → 32,5 (3 crans) ; 14 · 13 · 13 → 37,5 (un cran) ;
   7 puis 6 à 80 kg sur un 8 – 12 → 75 (deux crans, là où un seul laissait la pire série à 7,2) ; 2 · 2 · 1 → 30 (le plancher de 30 %).
   *Conséquence sur un test existant : « 7 puis 6 à 80 kg → 77,5 » est devenu « 7 puis 7 → 77,5 », 7 puis 6 en demandant deux.*
   *Non rejoué sur l'historique réel.*

   **Amendement du 2026-10-25 — au-delà de 30 répétitions, le cran passe.** « Fais 60 répétitions pour augmenter de 2,5 » : 2,5 → 5 kg sur un
   15 – 20 en demandait 60, 5 → 7,5 sur un 12 – 15 en demandait 33. Personne ne les fait, et tant qu'elles manquaient la règle n'autorisait que des
   répétitions : la charge ne montait plus jamais. Au-delà de 30 (`BENCHMARK_MAX_REPS`, la limite où Epley cesse d'estimer), le coach propose le
   cran quand même et le dit (`step_oversized`, « Ce cran pèse +100 % sur l'exercice : attends-toi à retomber sous 15 reps quelques séances. Un
   incrément plus petit sur la fiche… »). Jusqu'à 30 compris, la règle est celle d'avant. R1 et R5 gardent la main. Choix de l'utilisateur parmi
   deux (l'autre : ne rien proposer et renvoyer vers la fiche). *Non rejoué sur l'historique réel.*

### R4 — Ne comparer que ce qui est comparable

**Constat.** La moitié des exercices est pratiquée sous plusieurs fourchettes (variantes A/B,
séances « reprise »). Le moteur lit tout comme une seule suite : une reprise volontairement plus
légère au pec fly devient un plateau.

**Règle.** L'historique d'une règle de séance à séance (`range_missed`, `plateau`, R1-2) est
restreint aux séances qui ont le **même contrat de répétitions** que la dernière : l'ensemble des
paires `targetReps–targetRepsMax` de ses séries de travail. Les séances sans cible forment leur
propre flux (comme les imports Hevy) ; les règles de fourchette n'y trouvent rien à lire, le plateau
et la consolidation si. Le pas déduit (R3.1), le 1RM et les records restent lus sur tout
l'historique.

*Alternative écartée* : la clé « même routine ». Elle casse au premier renommage, et deux routines
peuvent prescrire le même contrat — ce qui est comparable, c'est la prescription.

### R5 — Le temps qui passe

**Constat.** 15 retours après ≥ 14 jours en 8 semaines. Après 21 jours sans presse, le coach
propose +5 kg comme si les séances s'enchaînaient.

**Règle.** Si l'écart avec la séance précédente de l'exercice — **quelle qu'en soit la
fourchette** : une semaine en 12–15 entre deux semaines en 8–12 n'est pas une pause — atteint
`RETURN_GAP_DAYS` (14, décision Q4) :
- pas d'`increase_load` ni d'`add_set` sur la séance de retour, et pas de charge proposée par le
  plafond ; signal `returning` (« Reprise après N jours : on consolide avant de monter »), rangé
  au-dessus du plafond pour expliquer son silence ; récap vocal sans phrase de hausse ;
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

**Amendement du 2026-10-14 — ce que la tranche 5 a tranché.** Chaque point est une politique, pas
une vérité (invariant 4) ; le plan de la tranche (`docs/design/plans/2026-10-04-coach-v2.md`) les
reprend avec leurs raisons.

- **Rien n'est journalisé.** `volume_low` est un constat de semaine, sans suite à suivre ni à refuser :
  il ne passe pas par `coachRecommendations`, donc **aucun `exerciseId` facultatif et aucune version de
  schéma** (le § 6 les réservait). `CoachSignalCode` ne gagne pas `volume_low` : ce n'est pas un signal
  d'exercice. Le plafond ne crée pas de signal non plus : il retire `add_set` des actions permises.
- **`add_set` n'est *choisi* qu'en phase de surcharge** (`selectProgramAction`). La note « Pas de série en
  plus » n'est donc posée que si le plafond a retiré une action que la phase aurait choisie : sinon, sur
  chaque plafond d'un pratiquant régulier — dont le volume est par définition à son maximum — la carte
  parlerait d'une action que personne ne lui aurait proposée.
- **Un pratiquant régulier est à son plafond par construction.** À 10 séries de pecs par semaine, le
  plus haut des six semaines est 10 : la semaine glissante l'égale, `add_set` est retiré. C'est la
  décision Q3 (« le coach ne propose pas d'aller au-delà de ce qui a déjà été tenu »), rendue visible :
  pour progresser en volume, on relève son plafond dans « Volume par muscle ».
- **Semaines complètes pour la référence et le plancher, sept jours glissants pour la décision.** Lundi à
  lundi, en jour local ; six semaines avant la semaine en cours, qui est incomplète et ne juge personne.
- **La médiane est celle des semaines travaillées**, pas des six : deux semaines de repos feraient une
  médiane de zéro, donc un plancher absurde.
- **Une semaine sans séance n'est pas un volume bas.** `volume_low` exige une séance, tous muscles
  confondus, dans chacune des deux semaines : deux semaines de vacances ne font pas autant d'alertes que
  de planchers posés. Un muscle jamais travaillé compte pour zéro série tant que la personne s'entraîne.
- **Seize muscles** : les régions de `MUSCLE_SCOPE`. `cardio`, `full_body` et `other` n'ont ni plancher ni
  plafond (un zéro n'y dit rien). Une borne est un nombre entier de séries, de 1 à 99.
- **La semaine se lit à l'instant où la séance se termine** (ou maintenant, tant qu'elle est ouverte) :
  elle compte la séance évaluée, que l'historique ne contient pas encore — ou plus, une fois terminée :
  elle en est écartée pour ne pas être comptée deux fois.

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
| 1 | R2 (échec) + R3.1 (cran de la fiche) | Petits, sans UI nouvelle, suppriment les pires alertes |
| 2 | R1 (RPE) | Le plus gros gain ; la donnée est là à 84 % |
| 3 | R4 (comparabilité) + R5 (pause) | Ferment les faux plateaux restants |
| 4 | R3.2 (répétitions pour absorber le cran) | Change la forme des recommandations, à valider en salle |
| 5 | R6 (volume) | Nouvelle carte, éventuellement schéma |
| — | R7 | Quand un cas réel existera |

Chaque tranche : tests contrat d'abord, rejeu avant / après, `typecheck`, `test:run`, `build`.

## 9. Décisions (2026-10-04)

| | Question | Décision |
|---|---|---|
| Q1 | Plafond atteint à RPE ≥ 9,5 | **Consolider** : refaire la charge avant de monter |
| Q2 | Gros cran relatif | Le cran est imposé : on monte quand les répétitions suffisent à retomber au bas de la fourchette après le cran (R3.2). *Révisée : la règle des 10 % est écartée* |
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
- R2 : `5 × 15 · F 5 × 14` sur 12–15 → `range_satisfied`, pas de plafond.
- R3 : poulie à 5 kg, cran renseigné 1,125 → 6,125 (jamais 5,625). Fiche vide, charges
  historiques 10 / 12,5 / 15 sur machine → cran de la table (5), rien n'est déduit.
- R3 : curl haltères 10 kg × 12 sur 10–12 → plafond sans charge, 18 répétitions visées ; à 18 →
  12 kg. Barre à 100 kg × 12 sur 8–12 → 102,5 kg, comme avant. Lest et assistance : inchangés.
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

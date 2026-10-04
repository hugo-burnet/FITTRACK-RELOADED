# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.
> L'historique détaillé vit dans `docs/progress/` et `docs/journal/`.

**Dernière mise à jour :** 2026-10-04 (**coach v2, tranche 2 : le coach lit le RPE** — sur la branche de session, non publiée ; la dernière version publiée reste la v2.10.0).

## Coach v2, tranche 2 : le coach lit le RPE (2026-10-04, suite)

Branche de session `ccr-5ffd8e9e-uazeho`, **non fusionnée, non publiée**. Aucune table, aucun index, aucune
version de schéma : `rpe` existe depuis RF-30, il n'était simplement pas transmis au moteur.

- **Effort de séance** : moyenne des RPE des séries jugées (séries à l'échec exclues, elles sont à 10 par
  construction), définie seulement si la moitié au moins en porte un. Sinon, le moteur se comporte exactement
  comme avant — un test le verrouille.
- **Plafond arraché** (≥ 9,5, décision Q1) : le constat reste, sans charge proposée ; ni `increase_load` ni
  `add_set`. Carte : « … mais à l'échec (RPE moyen 9,8) : on refait cette charge plus facilement avant de monter ».
- **Consolidation**, nouveau code `consolidating` : même charge, au moins autant de répétitions, RPE moyen en
  baisse d'un demi-point. Sévérité 38, entre le plafond et la fourchette tenue. Récap vocal : le son
  « progrès » existant, aucune phrase à générer. Ajouté à la liste des codes que la validation des
  sauvegardes accepte — sans quoi une sauvegarde contenant ce code serait refusée à la restauration.
- **Plateau** : levé si l'effort baisse d'un demi-point sur la fenêtre ; drapeau `at_failure` quand chaque
  séance est à 9,5 ou plus, et la carte suggère une décharge.
- **Rejeu** : 11 lignes changent. Un plafond arraché (oiseau 10 × 15 @9,5 : plus de 12,5 kg proposé), dix
  consolidations (développé incliné 20 kg de RPE 9,3 à 8,8, élévations latérales, rotation externe…), dont
  quatre deviennent le message affiché. Aucun plateau ne change.
- **Vérification.** `typecheck`, `lint`, `test:run`, `build` verts.

## Coach v2 : décisions, banc de rejeu et tranche 1 (2026-10-04, suite)

Branche de session `ccr-5ffd8e9e-uazeho`, **non fusionnée, non publiée**. Aucune table, aucun index, aucune
version de schéma.

**Décisions de l'utilisateur** (spec § 9) : consolider un plafond atteint à l'échec ; pas relatif de 10 % et
3 répétitions ; retour de pause à 14 jours ; série à l'échec au-delà du plafond en simple information ; bornes
de volume **adaptées à l'utilisateur** — plafond tiré de son historique, plancher seulement s'il le pose.
Plan : `docs/design/plans/2026-10-04-coach-v2.md`.

- **Tranche 0 — banc de rejeu.** `coachLinesFromBackup`, `replayCoach`, `formatReplay` (purs, testés) et
  `COACH_REPLAY_BACKUP=… npm run coach:replay`. Le lanceur est un test sauté sans sauvegarde, comme les
  `bench:*`. `.gitignore` écarte `fittrack-sauvegarde-*.json` et `coach-replay*.txt`.
- **Tranche 1 — R2.** La série à l'échec ne juge plus le bas de fourchette ni la baisse de reps ; elle
  **compte pour le plafond**. La première version l'écartait aussi du plafond : le rejeu inventait un plafond
  au pec fly (`5 × 15 · F 5 × 14` sur 12–15) et l'utilisateur l'a corrigé (« je plafonne pas sur le pec
  fly »). Le test de la séance réelle du 23/08 (élévations latérales) attendait « 5 → 2,5 kg » sur la foi de
  la série à l'échec : il attend maintenant `range_satisfied`, et son sujet d'origine — alléger depuis la
  charge du haut, pas depuis la dégressive — est gardé par une variante en série normale. Évidence
  `failure_reps_over_ceiling` (Q5).
- **Tranche 1 — R3.1.** `inferLoadIncrementKg` : le plus petit écart entre charges distinctes, s'il revient
  deux fois et vaut au moins 0,5 kg. Ordre : réglage de l'exercice → pas déduit s'il est plus fin → table.
  Évidence `inferred_increment_kg`, et la carte le dit (`coach.inferredIncrement`).
- **Rejeu avant / après** sur la sauvegarde : 23 lignes changent, toutes relues. Fausses alertes supprimées
  (élévations 5 → 2,5 kg deux fois, pec fly, curl marteau, tractions…) ; pas déduit (rowing 70 → 72,5,
  leg curl 45 → 47,5, oiseau 10 → 12,5). Aucun plafond nouveau.
- **Vérification.** `typecheck`, `lint`, `test:run`, `build` verts.

## Le coach rejoué sur un historique réel : trois correctifs et la spec v2 (2026-10-04, suite)

Branche de session `ccr-5ffd8e9e-uazeho`, **non fusionnée, non publiée** : la v2.10.0 reste la dernière version.
Aucune table, aucun index, aucune version de schéma.

L'utilisateur trouvait le coach « trop simpliste » et a fourni une sauvegarde (28 séances, ~8 semaines, 164
recommandations journalisées). Le moteur a été rejoué séance par séance (`evaluatePerformance` sur les lignes de
la sauvegarde) et comparé à ce qu'il avait réellement affiché. **La sauvegarde n'est pas dans le dépôt** et ne
doit pas y entrer.

**Trois correctifs, chacun avec un test tiré du cas réel, vu rouge avant le correctif**

- **`fix(coach): un pas de charge ne dépasse jamais un incrément`** (`118354d`). Depuis un demi-pas (12,5 kg sur
  une machine au pas de 5), `shiftLoad` tombait pile entre deux crans et `Math.round` tranchait vers le haut :
  12,5 → 20 kg (+60 %) sur l'oiseau, 47,5 → 55 kg sur le leg curl. L'égalité se tranche vers la charge de départ.
  Touche aussi `routineTargets` et `programs`, qui passent par `nextLoad` / `previousLoad`.
- **`fix(coach): consolider une charge n'est plus un plateau`** (`0777aea`). Une séance plafonnée ne peut pas
  faire monter le 1RM estimé ; trois plafonds à la même charge passaient pour un plateau, et le plateau retirait
  `increase_load`. Rowing à 70 × 12 × 3, RPE en baisse : « Plateau » trois fois. Le test
  `plateau strips add_set as well as increase_*` **verrouillait ce défaut** : il affirme maintenant l'inverse, le
  retrait par le plateau étant testé sur une fourchette tenue sans plafond. Même chose pour le test de dépôt
  `progression target + plateau` (10 sur 8–12 au lieu de 12). Spec du coach d'intention amendée (§ 4.2, § 10).
- **`fix(coach): un record de répétitions à la même charge n'est pas un plateau`** (`33ee159`). Révélé par le
  précédent : `estimateOneRepMax` ne lit rien au-delà de 12 répétitions, donc un 12,5 × 13 était jugé sur sa
  série à 11. La séance plafonnée à 15 que le correctif précédent écarte rendait la règle muette par accident.

**Après les trois**, le rejeu de tout l'historique ne montre plus que deux plateaux : un vrai (pec fly à RPE 9–10
trois fois) et un faux sur une séance de reprise plus légère — cas couvert par R4 de la spec.

**Spec : `docs/design/specs/2026-10-04-coach-v2-design.md`**, validée depuis (section au-dessus). Constat central : le RPE est noté sur **84 %** des séries de travail et le coach n'en lit aucun.
Règles R1 (effort), R2 (série à l'échec), R3 (pas déduit de l'historique, pas relatif), R4 (même contrat de
répétitions), R5 (retour de pause), R6 (volume par muscle), R7 reportée faute de cas réel. Pas de plan
d'exécution tant que les questions ne sont pas tranchées.

**Vérification.** `typecheck`, `lint`, `test:run` (**271 fichiers, 3 009 tests**) et `build` verts.

**Piège rencontré.** En comparant deux versions du moteur par `git stash` / `git checkout -- fichier`, un
correctif non encore commité a été écrasé, puis réécrit. Commiter avant de comparer.

## « Appliquer à toutes les séries » ne touche plus à l'échauffement (2026-10-04, suite)

Publication : un tag, **v2.10.0** — mineur et non correctif : un split de bloc peut s'étendre sur un cycle de
une à quatre semaines, « À lancer » suit plusieurs dossiers et un dossier se pose d'un coup dans le split (trois
capacités qui n'existaient pas), et le reste retouche la séance et l'éditeur de routine (l'ajout de série qui
recopiait l'échauffement, « Appliquer à toutes les séries » qui l'écrasait, le cadenas d'ordre rangé dans un
menu). Aucune table, aucun index, aucune version de schéma, aucun export. Fusionné dans `master` et publié sur
demande explicite de l'utilisateur, une fois la branche terminée : l'accord donné pour la v2.9.0 ne valait que
pour elle. Les cinq sections d'en dessous en font partie. Le numéro est celui de `package.json`, que l'APK lit
aussi pour son `versionName`.

La voie est celle de la v2.9.0 : fusion `--no-ff` (`ca2bc6c`), `chore: prepare release v2.10.0` (`033a146`,
`package.json`, le lock et ce fichier), `master` poussé sans force, le déploiement et le build Android du commit
verts du premier coup (runs 180 et 167), puis la release par le `workflow_dispatch` d'`android.yml` avec
`release_tag` (run 168) — le push d'un tag est refusé à une session d'agent (consigné pour la v2.9.0, pas retenté
cette fois), et le tag désigne ainsi le commit construit. La page : `releases/tag/v2.10.0`, l'asset
`FitTrack-v2.10.0.apk` (11 079 496 octets, SHA-256 `e3ae8083…bd7`, la somme que GitHub annonce).

C'est le défaut voisin que la section d'en dessous avait consigné sans le corriger, et que l'utilisateur a
demandé de corriger.

**La cause.** La feuille d'une série envoie **tout son brouillon**, type compris (`onApplyToAll(draft)`), et
`applyToAllSets` l'écrivait sur chaque série de l'exercice. Depuis une série de travail montée à 105 kg, un
échauffement planifié devenait une série de travail à 105 kg : `[échauffement 40 × 5, travail 100 × 8]` donnait
deux séries normales à 105 × 8. Le plan du Lot 4 disait que le geste « n'écrase que les champs fournis » : la
feuille en fournissait six, dont celui qu'il ne fallait pas.

**Le correctif**

- `applyToAllSets` lit le `setType` du brouillon comme le **genre de la série dont viennent les chiffres**
  (travail ou échauffement) : les chiffres vont aux séries de ce genre, et **le type lui-même n'est plus jamais
  écrit**. Depuis un échauffement, seuls les autres échauffements changent. Des chiffres sans type sont des
  chiffres de travail — la lecture sûre, puisque la seule chose à ne jamais faire sans qu'on le demande est de
  déplacer un échauffement. Une routine sans échauffement se comporte comme avant.
- Sur un échauffement, le bouton dit **« Appliquer aux échauffements »** au lieu de promettre toutes les séries, et
  le libellé suit le type quand on le change dans la feuille. Il compte 27 caractères : la première version,
  « …à tous les échauffements » (34), passait sur deux lignes dans la police du terminal de TTY1, alors que
  « …à toutes les séries » (29) tient.
- Inchangé : le rapport au tutoriel (`routine-target-updated`) garde l'identité de la première série, personne
  ne lit cet identifiant ; le plan du Lot 4 reçoit une phrase datée.

**Vérifié**

- `typecheck`, `lint` (**zéro avertissement**), `test:run` (**271 fichiers, 3 001 tests**, 9 de plus que la section
  d'en dessous) et `build` verts. Précache de 243 entrées, 8 309,96 Kio.
- Quatre des cinq tests de `applyToAllSets.test.ts` vus **rouges** avant le code (le cinquième fixe ce qui ne change
  pas : une fourchette que la feuille ne montre plus est effacée partout), trois des quatre de `RoutineSetSheet.test.tsx`
  (le libellé d'une série de travail, lui, ne change pas). **Mutation** : réécrire le type fait tomber « ne réécrit
  jamais le type d'une série », et lui seul.
- **Chromium à 390 px, thèmes Sombre et TTY1**, une routine `[échauffement 40 × 5, travail 100 × 8, travail 100 × 8]` :
  la série 2 montée à 105 kg avec le pas de la feuille, « Appliquer à toutes les séries » donne
  `[échauffement 40 × 5, travail 105 × 8, travail 105 × 8]` ; la feuille de l'échauffement dit « Appliquer aux
  échauffements » sur une ligne ; l'appuyer ne change rien d'autre ; aucune erreur de console.
- **La v2.10.0 sur `master`, avant de pousser** : `typecheck`, `lint`, les 3 001 tests, `build`, puis
  `android:sync` (le build web du mode Android et la synchro Capacitor) verts avec le numéro changé.
- **L'APK de la v2.10.0, ouvert et lu** : `2.10.0` dans le manifeste (`versionName`) et dans le paquet web ;
  « Durée du cycle », « Choisir les dossiers », « Ajouter un dossier » et « Appliquer aux échauffements » y sont,
  donc le cycle, l'accueil multi-dossiers, le bouton de dossier et le correctif y sont ; les huit `woff2` ; et il
  est signé par le **même certificat** que la v2.9.0 (SHA-256 `1bc42667…b931`, schéma v2) : il s'installe par-dessus.
- **Le déploiement Pages** : l'API GitHub le donne en `success` pour `033a146`.

**Pièges rencontrés**

- `git merge` n'accepte pas `-F -` (le message sur l'entrée standard, que `git commit` accepte) : « could not read
  file '-' », et rien n'est fusionné. Le message va dans un fichier.
- Le proxy de la session refuse `hugo-burnet.github.io` (403) : le site déployé ne se lit pas d'ici, seul le
  déploiement se vérifie, par l'API.
- Un libellé qui tient en Sombre peut passer sur deux lignes dans TTY1 : la police du terminal est à chasse fixe, et
  les crochets du bouton prennent de la place. Mesurer dans TTY1 — c'est la troisième fois de la journée.
- `pkill -f <motif>` a de nouveau tué le shell de la session, alors que la section de la v2.9.0 l'avait consigné : le
  motif figure dans la ligne de commande du shell. `pgrep -f "[m]otif"`, ou tuer par PID.

**Non vérifié** : le rendu sur un téléphone, l'APK installé et lancé (il a été ouvert et lu, pas exécuté), et le site Pages lui-même.

**Checkpoint téléphone**, en salle ou à défaut à bout de bras :

0. Installer la v2.10.0 par-dessus (`releases/tag/v2.10.0`) : l'en-tête dit « v2.10.0 », les séances et routines sont intactes.
1. Éditeur d'une routine qui porte un échauffement planifié (série 1, « Échauffement », 40 kg) et deux séries de
   travail : ouvrir une série de travail, monter la charge, « Appliquer à toutes les séries ».
2. L'échauffement n'a pas bougé (« ÉCH. », 40 kg) ; les séries de travail ont la nouvelle charge.
3. Ouvrir l'échauffement : le bouton dit « Appliquer aux échauffements ».

## Le cadenas d'ordre revient dans la séance en cours (2026-10-04, suite)

Publié dans la **v2.10.0** (voir la publication en haut de ce fichier). Demande de l'utilisateur : « fais
réapparaître le cadenas quand la routine est en cours ». Aucune table, aucun index, aucune version de schéma.

**Ce qui s'était passé.** Le 2026-09-06, la passe « alléger la séance » (`660fc61`) a sorti le cadenas d'ordre
**et** la commande de deload du bandeau pour les ranger dans le menu « Options de la séance ». Le bandeau n'a
gardé que l'avancement, le repli et l'état « 80 % » une fois la décharge appliquée. Un utilisateur qui connaît le
cadenas à l'œil ne le cherche pas dans un menu : il a cru qu'il avait disparu.

**Ce qui change**

- `OrderLockButton` revient dans le bandeau de `WorkoutScreen`, **à sa place d'avant** : entre l'état « 80 % »
  (quand il est affiché) et le bouton de repli, cible de 48 px. Fermé au lancement ; un appui fait apparaître les
  poignées, le suivant les retire. Il commande le verrou de la **séance** (`useExerciseOrderLock`), jamais celui de
  l'éditeur de routine.
- **L'entrée du menu reste**, avec son libellé et son explication : un seul verrou, deux commandes. Je ne l'ai pas
  retirée sans qu'on me le demande ; si la redondance gêne, c'est une ligne dans `WorkoutSheets` (et la clé
  `workout.reorderMenuHint`).
- La commande de **deload reste dans le menu** : personne n'a demandé de l'en sortir.
- `persiste le réordonnancement autorisé pendant la session` retrouve sa forme d'avant le déplacement : il passe par
  le cadenas et non plus par le menu. Les commentaires qui disaient que le cadenas avait quitté le bandeau sont
  corrigés, ainsi que la spec d'origine (`2026-08-10-exercise-order-lock-design`), qui reçoit une note datée.

**Vérifié**

- `typecheck`, `lint` (**zéro avertissement**), `test:run` (**269 fichiers, 2 992 tests**, 5 de plus que la section
  d'en dessous) et `build` verts. Précache de 243 entrées, 8 309,79 Kio.
- Quatre des cinq tests de `WorkoutScreen.orderLock.test.tsx` ont été écrits et **vus rouges** avant le code
  (« Unable to find role="button" and name "Déverrouiller l'ordre des exercices" ») : cadenas fermé dès l'ouverture
  sans passer par le menu, poignées après un appui et retirées au suivant, verrou de la routine intact, cohabitation
  avec « 80 % ». Le cinquième fixe ce qui existait déjà — l'entrée du menu commande le même verrou ; sa requête passe
  par la boîte de dialogue, puisque les deux boutons portent le même nom. **Mutation** : un cadenas branché sur le
  verrou de la routine fait tomber trois tests.
- **Chromium à 390 px, thèmes Sombre et TTY1**, une séance de deux exercices : le bandeau lit « 0 série sur 2 », cadenas
  de 48 × 48, repli de 48 × 48, rien ne déborde ; un appui, les deux poignées apparaissent ; la poignée du premier
  exercice descendue au clavier **réordonne pour de bon** (lu en base) ; un second appui retire les poignées ; avec la
  décharge appliquée, « 80 % » (92 px en Sombre, 82 en TTY1), le cadenas et le repli tiennent sans que l'avancement soit
  tronqué ; aucune erreur de console.

**Pièges rencontrés**

- Garder l'entrée du menu a un coût de test : les deux boutons s'appellent pareil, et l'ancien test, qui cliquait le
  libellé dans le menu, trouvait deux éléments. Il passe par le cadenas, comme avant le déplacement ; le test du menu
  cible sa boîte de dialogue.

**Non vérifié** : le rendu sur un téléphone, l'APK.

**Checkpoint téléphone**, en salle ou à défaut à bout de bras :

1. Lancer une séance de deux exercices au moins : le **cadenas fermé** est dans la barre d'avancement, à gauche du
   bouton « Tout replier ».
2. Le toucher : le cadenas s'ouvre et les poignées apparaissent sur les cartes. Déplacer un exercice, puis retoucher le
   cadenas : les poignées partent.
3. Appliquer la décharge (menu ⋮ › deload) : « 80 % » apparaît dans la barre, le cadenas reste à côté.

## « Ajouter une série » ne recopie plus l'échauffement (2026-10-04, suite)

Publié dans la **v2.10.0**. C'est la demande de la section d'en dessous (l'échauffement qui ressort en
suggestion), reprise après
la précision de l'utilisateur : « je mets systématiquement le marqueur échauffement ». Le diagnostic d'alors
(un échauffement non marqué) ne tenait donc pas. Aucune table, aucun index, aucune version de schéma.

**La cause**

- « Ajouter une série » recopiait **la dernière série, quelle qu'elle soit** : son type et ses chiffres.
  Après un échauffement validé à 40 × 5, la série ajoutée était « Série 2 — Échauffement » avec 40 / 5 en
  gris. La repasser en normale ne touche pas aux chiffres : les 40 / 5 restaient, offerts comme suggestion
  d'une série de travail. Et une cible passe **devant** la suggestion de la séance précédente
  (`ghost = cible ?? précédent`) : le bon chiffre, 100 × 8, n'apparaissait jamais.
- L'éditeur de routine faisait pareil (`addRoutineSet`) — en pire, parce que cette copie-là s'écrit en base et
  se rejoue à chaque séance.
- La colonne « Précédent » n'y était pour rien : `matchPreviousSets` apparie bien échauffements et travail
  séparément.
- **Lecture du message** : « à la séance d'après » a été lu « à la **série** d'après » (message dicté), la seule
  lecture que le code confirme. **Confirmé ensuite par l'utilisateur** : c'est bien la série d'après.

**Le correctif**

- `lastWorkingSet` (`lib/records.ts`, à côté d'`isWorkingSet`) rend la dernière série qui compte ;
  `duplicateLastSet` et `addRoutineSet` recopient celle-là. Après un échauffement seul : une série **normale,
  vierge**, et la séance précédente suggère le reste. Un échauffement posé après le travail est sauté ; une
  série de travail d'un autre type (dégressive…) se recopie comme avant, type compris.
- **Perdu en route** : ajouter un second échauffement identique en un appui. Rare — une montée change de
  charge — et la montée calculée de l'exercice existe.
- Les tests de `programWorkout` et `routineExport` qui contournaient la copie sont laissés, sauf une phrase qui
  n'était plus vraie : `routineExport` retrouve l'ordre naturel (marquer, puis ajouter), et devient une garde —
  l'ancien code y faisait écrire « 0 + 2 échauffements ».

**Vérifié**

- `typecheck`, `lint` (**zéro avertissement**), `test:run` (**268 fichiers, 2 987 tests**, 13 de plus que la
  section d'en dessous) et `build` verts. Précache de 243 entrées, 8 309,73 Kio.
- Tests écrits et **vus rouges** avant le code : l'aide pure (3), six des neuf tests de dépôt (les trois autres
  fixent ce qui ne change pas : la série de travail et la dégressive se recopient), et l'écran
  (`WorkoutScreen.addSet.test.tsx` : `placeholder="40"` là où 100 est attendu — exactement le symptôme).
  **Mutation** : une aide qui rend la première série de travail au lieu de la dernière fait tomber deux tests.
- **Chromium à 390 px, gestes réels**, deux séances de suite : séance 1, échauffement marqué puis validé, « Ajouter
  une série » donne « Série 2 » normale, vierge (avant : « Série 2 — Échauffement » 40 / 5) ; séance 2, même
  geste : la série ajoutée affiche « Précédent 100 × 8 » et 100 / 8 en gris. La routine à échauffement planifié
  et la séance complète rejouées : rien de changé.

**Pièges rencontrés**

- Le diagnostic d'abord retenu tenait à ce que j'avais rejoué des **séances** (montée marquée ou non) sans
  rejouer le geste de la personne : marquer, valider, puis « Ajouter une série ». C'est ce geste qui montrait la
  fuite. Rejouer d'abord la suite exacte de gestes décrite, avant de chercher une cause dans les données.
- La carte d'un exercice **se replie** quand toutes ses séries sont validées : « Ajouter une série » disparaît
  tant qu'on ne l'a pas rouverte. Le test d'écran et le rejeu la rouvrent, comme sur le téléphone.

**Resté ouvert, depuis réglé**

- **« Appliquer à toutes les séries » aplatissait l'échauffement planifié d'une routine** : corrigé à la demande de
  l'utilisateur, section d'au-dessus.

**Non vérifié** : le rendu sur un téléphone, l'APK.

**Checkpoint téléphone**, en salle ou à défaut à bout de bras :

1. Une séance, un exercice : toucher le numéro de la série 1 › « Type de série » › Échauffement ; saisir
   40 × 5 et valider.
2. Rouvrir la carte (elle s'est repliée), « Ajouter une série » : la série 2 n'a **pas** de flamme, elle est vide,
   et ses chiffres en gris sont ceux de la séance d'avant (rien si c'est la première).
3. Dans l'éditeur d'une routine qui porte un échauffement : « Ajouter une série » ajoute une série normale
   vierge, pas un second échauffement.

## Ajouter un dossier au split (2026-10-04, suite)

Publié dans la **v2.10.0**. « Oui je veux bien le bouton » : celui que la section d'en dessous proposait en
sortie. (Le même message
signalait l'échauffement qui ressort en suggestion : traité dans la section d'au-dessus.) Spec et plan :
`2026-10-04-split-ajouter-un-dossier`. Aucune table, aucun index, aucune version de schéma.

**Le bouton « Ajouter un dossier »**

- Chaque semaine du cycle (et la semaine unique d'un split hebdomadaire) a, sous « Ajouter à la semaine N »,
  un bouton qui ouvre la liste des dossiers (« UL — 4 routines »). En toucher un pose **une séance par
  routine**, dans l'ordre du dossier, sur des jours qui se suivent : lundi, mardi… ; les jours se corrigent
  ensuite. Avec le cycle de deux semaines, deux appuis posent les dix séances.
- Les séances **sans routine de la semaine visée sont remplacées** — c'est l'emplacement du départ : sans
  cela, le premier usage laisserait une « Séance 1 » vide que « Continuer » refuse. Ce qui est déjà rempli
  reste, le dossier s'ajoute derrière ; après le dimanche on repart du lundi.
- « Sans dossier » ne se propose qu'une fois des dossiers existants (sans eux c'est la bibliothèque entière).
  Aucun dossier utile, aucun bouton. Le nom accessible dit la semaine (« … à la semaine 2 ») ; le texte visible
  reste « Ajouter un dossier », parce qu'un libellé plus long passait à la ligne.
- `useProgramEditorData` lit les dossiers avec les routines. **Le modèle du split a quitté
  `programEditorModel.ts`** (309 lignes, deux métiers) pour `programSplitModel.ts` (182) ; ses tests ont suivi.

**L'échauffement qui ressort en suggestion — mal diagnostiqué ici, corrigé dans la section d'au-dessus**

- Cette section avait conclu à un échauffement **non marqué**, sans code changé. L'utilisateur a répondu qu'il
  le marque toujours : la cause était ailleurs (« Ajouter une série » recopiait l'échauffement). Ce qui reste
  vrai — un échauffement non marqué fuit dans « Précédent », l'app ne peut pas le savoir, deviner par la
  charge est écarté — est dans `docs/progress/decisions-et-pieges.md`, avec la vraie cause.

**Vérifié**

- `typecheck`, `lint` (**zéro avertissement**), `test:run` (**266 fichiers, 2 974 tests**, 14 de plus que la
  section d'en dessous) et `build` verts. Précache de 243 entrées, 8 309,56 Kio.
- Les tests de `programSplitModel` ont été écrits et vus rouges avant le code ; les deux parcours d'intégration
  (UL puis PPL de la feuille à l'activation, l'absence du bouton sans dossier) ont passé du premier coup.
- **Chromium à 390 px, thèmes Sombre et TTY1**, base amorcée à l'image de la sienne (4 + 6 routines dans deux
  dossiers, une libre) : la feuille liste « UL — 4 routines », « PPL 45' — 6 routines », « Sans dossier —
  1 routine » ; deux appuis posent dix séances, UL du lundi au jeudi et PPL du lundi au samedi, dans l'ordre
  des dossiers ; aucune erreur de console.

**Pièges rencontrés**

- Le titre de la feuille, « Ajouter les routines d'un dossier », était **tronqué** avec la police du terminal
  (vingt caractères tiennent) : le même défaut que le titre de la feuille de l'accueil, deux fois dans la
  journée. Un titre de feuille se mesure dans TTY1, pas seulement en Sombre.

**Non vérifié** : le rendu sur un téléphone, l'APK.

**Checkpoint téléphone**, en salle ou à défaut à bout de bras :

1. Planifier › Programmes › « + », puis au Split **2 semaines**.
2. Sous la semaine 1 : « Ajouter un dossier » › **UL** — les quatre séances arrivent, du lundi au jeudi. Sous
   la semaine 2 : « Ajouter un dossier » › **PPL 45'** — les six, du lundi au samedi.
3. Corriger un jour si le plan n'est pas celui-là, puis continuer.

## Cycle des programmes et « À lancer » sur plusieurs dossiers (2026-10-04)

Publication : la **v2.10.0**, fusionnée dans `master` et publiée sur demande explicite de l'utilisateur, comme
les précédentes. Le travail s'est fait sur la branche de session `ccr-4e58be64-spej04`.

Deux demandes, une session : « j'ai pas une routine sur 1 semaine mais sur 2 semaines, ce qui fait que
Programmes ne peut pas fonctionner » et « j'ai 10 séances réparties dans 2 dossiers, du coup le
lancement rapide ne peut pas non plus fonctionner ». Le cas : quatre séances « haut / bas » dans un
dossier, six « push / pull / jambes » dans l'autre, une semaine sur deux. Les deux causes étaient dans le
code : un split de bloc est **une** semaine qui se répète (`dayOfWeek` de 1 à 7), et le contexte de
l'accueil est **un** dossier. Aucune table, aucun index, aucune version de schéma, aucun réglage migré.
Les specs et les plans (`docs/design/`, `programme-cycle-multi-semaines` et
`accueil-contexte-multi-dossiers`) disent le détail.

**Le cycle des programmes**

- Un split est un **cycle de une à quatre semaines**, rejoué en boucle. `ProgramScheduleRevision.cycleWeeks`
  et `ProgramScheduleEntry.cycleWeek` sont **facultatifs et non indexés** : absents, ils valent 1 et 0, donc
  tout bloc existant se lit comme avant sans migration. `lib/backup/validate` les déclare.
- La semaine du cycle jouée par une semaine du bloc est `(semaine − semaine d'entrée de la révision) mod
  longueur` : le cycle se compte **depuis la révision**, pas depuis le début du bloc. Trois lectures pures
  dans `lib/programs/schedule.ts` : `resolveSchedule` (ce qui se joue cette semaine — l'accueil, la fiche, le
  démarrage et le Coach n'ont pas changé d'un caractère), `resolveRevision` (tout le cycle — ce que le bloc
  **possède**), `resolveSplitFrom` (le cycle **tourné** pour commencer à une semaine).
- **Propriété sur tout le cycle** : l'activation valide les routines des deux semaines et périme les
  recommandations de charge de leurs exercices ; réécrire un cycle à l'identique n'« introduit » rien.
- **La réparation d'une routine supprimée tourne le cycle** : elle écrit une révision à la semaine affichée,
  et sans rotation elle aurait décalé le cycle d'une semaine pour tout le reste du bloc. L'éditeur lit lui
  aussi le split à partir de la semaine d'effet, et le dit : « Le cycle repart à la semaine N du bloc ».
- **L'éditeur** : « Durée du cycle » (quatre pastilles, « Chaque semaine » par défaut — l'écran d'avant, sans
  titre de semaine), puis une liste de séances par semaine du cycle. Raccourcir le cycle replie les séances
  des semaines qui disparaissent dans la dernière : un appui ne doit pas effacer ce qui en a demandé une
  douzaine. Une semaine peut rester vide (repos complet). La séance du split est devenue son propre
  composant (`ProgramSplitSession`). La fiche dit « Semaine 2 du cycle de 2 semaines ».
- Reste **par semaine du bloc**, et ne connaît pas le cycle : la prescription (phase, niveau).

**« À lancer » sur plusieurs dossiers**

- Le contexte est un **ensemble** : un ou plusieurs dossiers, avec ou sans « Sans dossier ». La règle ne
  change pas — la routine réalisée le moins récemment — mais son périmètre est l'union. Pour un cycle suivi
  dans l'ordre, c'est exactement la séance suivante, et une séance manquée remonte d'elle-même.
- Le classement part de l'ordre **des dossiers**, puis de `Routine.order` : seul, ce dernier — la place dans
  la liste entière — mêlerait les dossiers dans l'ordre de création de leurs routines. Un test crée les
  routines à l'envers pour le garder.
- Réglage `homeRoutineFolderContext` : une troisième forme `{ kind: 'folders', folderIds, root }`. Les deux
  anciennes restent **lues et écrites pour un choix unique** (`lib/routineContext.ts`, pur : forme, lecture
  défensive, conversions). Un dossier supprimé sort de la sélection sans l'invalider ; tous supprimés, l'accueil
  redemande ; un dossier créé après n'y entre pas.
- La feuille passe en **cases à cocher sur un brouillon**, écrit **une fois** au « Terminé » : fermer sans
  « Terminé » ne choisit rien, et « Terminé » est grisé tant que rien n'est coché. La carte liste les dossiers
  suivis (« UL + PPL 45' ») et écrit « tous ces dossiers confondus » sous le bouton.
- `HomeDashboardData.routineContext.selected` passe de `string | null` à un **tableau** (vide = aucun choix).

**Vérifié**

- `typecheck`, `lint` (**zéro avertissement**), `test:run` (**266 fichiers, 2 960 tests**, contre 263 et
  2 854 à la v2.9.0) et `build` verts. Précache de 243 entrées, 8 307,92 Kio.
- **Un contrôle de mutation** : remettre `resolveSchedule` dans le calcul des exercices introduits fait
  échouer le test « pas introduits » ; rétabli, il passe. Les tests écrits avant le code — le résolveur, le
  dépôt, le modèle de l'éditeur, le module du contexte — ont tous été vus rouges d'abord.
- **Chromium à 390 px, thèmes Sombre et TTY1**, sur le serveur de développement, une base amorcée à l'image
  de la sienne (deux dossiers de 4 et 6 routines, deux routines libres, des séances sur cinq semaines) :
  l'accueil sans choix ouvre la feuille d'elle-même ; deux dossiers cochés puis « Terminé », la carte annonce
  `UL + PPL 45'` et propose `PUSH A - 45'`, la plus ancienne des deux dossiers ; l'éditeur à deux semaines ;
  la fiche « Semaine 2 du cycle de 2 semaines ». Aucune erreur de console.

**Pièges rencontrés**

- Compter le cycle depuis le début du bloc paraissait plus simple, et décalait le cycle à la première
  réparation ou à la première révision. La semaine d'effet est l'origine, et il faut tourner le split pour
  qu'une révision réécrite rejoue exactement l'ancienne.
- `resolveSchedule(…, 0)` servait à valider l'activation et à calculer les exercices que le bloc possède :
  avec un cycle, il ne voit que la première semaine. Ce qui est **possédé** se lit sur la révision entière,
  ce qui se **joue** sur la semaine.
- La carte de l'accueil est recomposée (clé sur la sélection) à chaque changement de contexte : écrire à
  chaque case aurait refermé la feuille avant la deuxième. D'où le brouillon et l'écriture unique.
- Un test qui active un bloc puis écrit une révision doit **figer l'horloge** : sur l'horloge réelle, le bloc
  est déjà terminé et l'écriture est refusée (`retroactive_revision`).
- Deux défauts que seul le navigateur a montrés : le titre de la feuille, trop long, était tronqué à 390 px,
  et « Ajouter une séance à la semaine 1 » passait à la ligne en laissant le « 1 » seul.

- Un test du tutoriel, `TutorialProvider` « attend que la commande décrite existe avant de parler », a
  échoué **une fois**, dans un worktree jetable qui rejouait 1 800 tests d'un coup pour vérifier un commit
  intermédiaire : ses `findByText` n'ont que le délai par défaut. Il passe cinq fois sur cinq seul, au commit
  comme à `HEAD`, et la suite complète de l'arbre final est verte. Sensible à la charge, pas à ce travail ; à
  surveiller s'il revient.

**Question posée en cours de session, sans suite dans le code** : une relecture externe du schéma
(`workoutSets.workoutId`, `[workoutId+order]`, clé sans `id`). Un point juste, deux à ne pas suivre ; aucun
changement de schéma. L'analyse est dans `docs/progress/decisions-et-pieges.md` (2026-10-04).

**Non vérifié** : le rendu sur un téléphone, l'APK, et le tutoriel guidé du chapitre Programmes (son texte
n'a pas changé et ses tests passent, mais il n'a pas été rejoué en navigateur).

**Checkpoint téléphone**, en salle ou à défaut à bout de bras :

1. Planifier › Programmes › « + » : nom, lundi, huit semaines. Au Split, **2 semaines** : les quatre
   séances de la première, les six de la seconde, jours et routines posés. Activer.
2. La fiche dit « Semaine N du cycle de 2 semaines » et ne liste que cette semaine-là ; la semaine d'après,
   c'est l'autre. L'accueil propose la séance du jour du bloc.
3. ⋯ › Modifier à partir de… : le split s'ouvre lu à partir de la semaine d'effet, avec sa phrase ;
   enregistrer sans rien toucher ne change aucune semaine.
4. Accueil, sans bloc actif : l'icône de dossier, cocher les deux dossiers, « Terminé ». La carte annonce
   `UL + PPL …` et propose la routine la plus ancienne des deux.
5. Faire cette séance, revenir : la suivante ; en fin de semaine, la carte passe d'un dossier à l'autre.
6. Fermer et rouvrir l'app : le choix des dossiers est resté. Rouvrir la feuille, décocher, la fermer
   **sans** « Terminé » : rien n'a changé.

## TTY1 à débloquer, ouverture complète (2026-10-03)

Publication : un tag, **v2.9.0** — mineur et non correctif : TTY1 se gagne au lieu d'être offert, son
ouverture devient un démarrage complet et un palier secret s'ajoute, sans rien changer à ce qui existait ni
au schéma. Fusionné dans `master` et publié sur demande explicite de l'utilisateur, une fois la branche
terminée : l'accord donné pour la v2.8.0 ne valait que pour elle. Le numéro est celui de `package.json`, que
l'APK lit aussi pour son `versionName`.

La voie est celle de la v2.8.0 : fusion `--no-ff` (`1ef1215`), `chore: prepare release v2.9.0` (`674dde2`,
`package.json`, le lock et ce fichier), `master` poussé sans force, le déploiement et le build Android du
commit verts du premier coup (runs 178 et 164), puis la release par le `workflow_dispatch` d'`android.yml`
avec `release_tag` (run 165) — le push d'un tag est refusé à une session d'agent, et le tag désigne ainsi le
commit construit. La page : `releases/tag/v2.9.0`, l'asset `FitTrack-v2.9.0.apk` (11 076 524 octets, SHA-256
`8b8b5298…cc4`).

Deux demandes, une session : « ce skin se débloque lors de la première fois où l'on voit l'easter egg de
l'écran de chargement » (et, après plus d'un mois d'usage, on l'a forcément vu), et « une fois ce skin
activé, le grub se lance à chaque fois, plus complet, plus long, avec des infos au hasard sur l'app : une
fonction de l'app qui s'affiche sans qu'on sache pourquoi et qui, validée, lance l'app, des check-up, des
`dir /s`… ». La spec et le plan (`docs/design/specs/` et `docs/design/plans/`,
`2026-10-03-tty1-debloque-et-boot-complet`) disent le détail. Aucune table, aucun index, aucun schéma.

**Le déblocage**

- Un drapeau `localStorage` (`fittrack.tty1Unlocked`), pas Dexie : il se lit avant le premier rendu.
  `src/stores/skinUnlock.ts`, sans React ni Dexie, avale toute exception du stockage.
- **Trois chemins** : la console rare jouée **jusqu'au bout** (écrit avec le report de la surprise, à la
  fin d'une ouverture complète : une console coupée par une séance en cours n'a pas été vue) ; plus de
  **30 jours** d'usage (la plus petite `createdAt` d'un exercice, `getFirstUseAt` : le catalogue est semé
  au premier lancement, les exercices supprimés comptent, une base restaurée garde ses dates) ; le thème
  mémorisé **est déjà** `tty1` (la v2.8.0 l'a livré ouvert : le retirer serait une régression). Un test
  garde le seuil au-dessus du plus long délai de la surprise (28 jours).
- Réglages : l'option reste visible, grisée, avec un cadenas et « TTY1 est verrouillé. Garde un œil sur
  l'écran de chargement. » — sans dire comment. `aria-disabled` et non `disabled`, pour que le bouton garde
  le focus et que sa phrase soit lue.
- La console rare dit le déblocage, une fois : sous la commande tapée, `[ OK ] tty1.skin unlocked` puis
  `# Réglages > Apparence`, 1,4 s de tenue en plus. La décision est prise **avant** le premier rendu
  (TTY1 verrouillé et variante `console`) et n'est pas rediscutée quand l'ancienneté débloque ensuite.

**L'ouverture complète**

- Un démarrage de machine **tiré à chaque lancement** : chargeur (le noyau change de nom), noyau (l'heure
  de la machine puis quatre faits parmi douze), services (les quatre lignes de la console rare toujours
  là et dans leur ordre, quatre autres s'intercalent : deux `OK`, un `WARN`, un `FAIL`), vérifications
  (`fsck`, `smartctl`, `memtest`…), interlude DOS (`dir /s` une fois sur deux, sinon `ver` ou `mem`), puis
  **la porte** : une fonction réelle de l'app attendue comme un service (`estimateOneRepMax`,
  `computePlateLoad`, `calculateWarmupSets`, `calculateDeloadWeight`, `formatRest`, `setVolume`), animée,
  puis validée avec **le résultat qu'elle a vraiment rendu**. Fin : la cible, l'invite, la commande tapée,
  la devise.
- **Les faits sont vrais** : le catalogue, le repos par défaut, le deload, la barre, les plaques, les
  cœurs et l'écran de l'appareil, le réseau. Rien n'est écrit en dur : « 175 exercices » mentirait à la
  prochaine mise à jour du catalogue. `bootFacts.ts` les lit et appelle les fonctions, chacune dans son
  `try` : une qui lève sort du tirage, elle n'empêche jamais l'app de s'ouvrir. Un test relit chaque nom
  contre l'export réel : le paquet de production renomme les fonctions.
- **Durée fixe, 4 650 ms**, quel que soit le tirage : il change le contenu et la cadence, jamais le
  temps d'attente. 2 180 ms en mouvement réduit (tout est affiché d'emblée).
- Le script est **pur** (`bootTty1Script.ts`, tiré par `main.tsx` une seule fois : `BootScreen` est
  remonté en `BootCurtain`, un tirage dans le composant donnerait deux machines à la suite), rejouable par
  graine (`seededRandom`, et `?bootSeed=` en développement seulement). Les textes sont des nœuds de
  `fr.ts` que `tAll` énumère : ce dictionnaire n'a pas de tableaux. Aucune ligne au-delà de 41 caractères
  (360 px en 16 px), sauf l'invite finale, dont la commande passe à la ligne d'un bloc.
- `BootTty1Console.tsx` pose les lignes **au fil d'une horloge** (`useBootClock`) et non par des délais
  CSS : une console défile, et avec toutes les lignes déjà dans la page rien ne défilerait. Fenêtre à
  hauteur entière de lignes (`round()`), colonne inversée : elle se remplit du haut, puis défile par le bas.
- **Toucher l'écran saute l'ouverture TTY1**, et elle seule — *non demandé, à retirer si on n'en veut pas* :
  cinq secondes à chaque lancement sont ce que la règle n° 5 interdit. Le saut part du `click` et non du
  `pointerdown` : le geste finit sur l'écran d'ouverture, au lieu de tomber sur le premier bouton de
  l'accueil. Une ligne en bas le dit.

**Le succès « noclip »** (demandé après coup : « quand tu vois le grub au moins une fois, le succès est
noclip, avec un logo Matrix ; moi je l'aurai déjà, donc ça se met dans mon historique de succès »)

- C'est un **palier** : l'app n'a pas d'autre système de succès (Analyses > Paliers, leurs jetons en
  image, la carte d'accueil, la sauvegarde). Un nouveau genre, `secret`, que le moteur ignore et que la
  synchronisation **laisse en place** : pour elle un secret est toujours orphelin, et la première séance
  terminée l'aurait effacé (un test le garde). Un rayon « Secrets » à l'écran, qui n'existe qu'une fois un
  secret acquis ; 59 paliers sur le plafond de 60. Spec et plan : `2026-10-03-succes-noclip`.
- **Acquis si et seulement si TTY1 est débloqué** (`app/noclip.ts`, `grantNoclipIfUnlocked`) : le drapeau
  reste la seule vérité, la ligne en est la mémoire datée, quel que soit le chemin du déblocage.
  **Célébré** (carte « Palier franchi » sur l'accueil) quand la console rare vient de débloquer TTY1,
  **silencieux** pour tout rattrapage : qui avait déjà TTY1 — l'utilisateur — le reçoit au premier
  démarrage, acquitté, daté de ce jour (la vraie date n'est pas retrouvable). `workoutId` vaut `''`, le
  « pas de parent » du modèle, que la validation de sauvegarde accepte sans orphelin.
- Le jeton : une pluie de glyphes verts, `public/milestones/noclip.jpg`, 384 px, 29 Ko, **précaché**,
  générée par `scripts/milestone-art/noclip.py` (glyphes tracés sur une grille de 5 × 7 points, sans
  police ; le même fichier à chaque exécution). Légende : « Il n'y a pas de mur. Il n'y a pas de
  cuillère. »

**Vérifié**

- Chromium à 390 × 844 et 360 × 740, horloge simulée et en temps réel : les lignes se posent à leur heure,
  la fenêtre fait 25 lignes entières (650 px), la porte tourne puis se réécrit, les commandes se tapent
  (`steps(6)`, `steps(27)` lus dans `getComputedStyle`), le curseur n'est que sur la dernière commande, le
  mouvement réduit affiche tout d'emblée. La console rare avec et sans révélation (3 360 puis 4 760 ms), le
  drapeau écrit à sa fin.
- Le build de production, servi : l'ouverture TTY1 dure ce qu'elle doit sans une erreur de console ;
  le thème mémorisé sans drapeau débloque ; une installation **vieillie de 40 jours** (les 175 exercices
  antidatés) écrit le drapeau au démarrage suivant et Réglages montre TTY1 ouvert ; un doigt posé 500 ms
  n'arrête rien, son relâchement saute l'ouverture sans atteindre le bouton dessous. `?bootSeed=` n'est
  plus dans le paquet.
- **L'APK de la v2.9.0, ouvert et lu** : le jeton `noclip.jpg` y est, octet pour octet celui du dépôt ; les
  huit `woff2` ; `2.9.0` dans le chunk de `Screen` et `versionName` du manifeste ; et il est signé par le
  **même certificat** que celui de la v2.8.0 (SHA-256 `1bc42667…b931`, schéma v2) : il s'installe par-dessus.
- **noclip, dans Chromium** : TTY1 déjà débloqué → la ligne est écrite au démarrage, acquittée, sans
  carte sur l'accueil, et l'écran des paliers la montre sous « Secrets » (liste, puis jeton en grand avec sa
  légende) ; le thème TTY1 sans drapeau (la v2.8.0 telle qu'elle est) l'écrit aussi et lève le drapeau ;
  installation verrouillée → aucune ligne, aucun rayon ; console rare qui débloque → carte « Palier
  franchi » sur l'accueil, qui part à « Fermer » et ne revient pas au rechargement.
- `typecheck`, `lint` (**zéro avertissement** : celui de `Boot.tsx`, préexistant, a disparu avec le
  déplacement de `BOOT_HOLD_MS`), `test:run` (**263 fichiers, 2 854 tests**, contre 254 et 2 703 à la
  v2.8.0) et `build` verts. Précache de 243 entrées, 8 301 Kio.

**Pièges rencontrés**

- Une console ancrée en bas fait apparaître ses premières lignes **en bas** de l'écran, comme un fil de
  discussion ; une console qui démarre se remplit du haut. La colonne inversée avec une pile en
  `margin-bottom: auto` fait les deux.
- Les délais CSS ne défilent pas : toutes les lignes occupent leur hauteur finale dès la première image.
  D'où l'horloge JavaScript, et la console rare qui, elle, reste en CSS — et ne se vérifie qu'en temps réel.
- L'horloge simulée de Playwright **coule d'elle-même** tant qu'on ne l'a pas mise en pause (`pauseAt`) :
  les premières captures montraient déjà l'app. Et les animations CSS ne la suivent pas.
- Un test a trouvé ce que l'œil n'aurait pas vu : l'invite finale fait 44 caractères, pas 41. Le test
  tient désormais l'invite et la commande chacune à 41, parce qu'elles passent à la ligne comme deux blocs.
- Une ligne de la porte dépassait la largeur (`calculateWarmupSets() = 40/60/80 kg`, 42) : son résultat
  vient du code, pas de `fr.ts`. La porte écarte d'elle-même la fonction qui ne tient pas.
- `act()` regroupe les mises à jour : avancer l'horloge de 2 000 ms d'un coup ne rend que l'état final.
  Les tests avancent par paliers.
- `aria-disabled` est lu comme « désactivé » par Playwright, qui refuse de cliquer : `force: true` pour
  prouver qu'un toucher ne fait rien.
- La projection des paliers retire toute ligne qu'aucune séance ne justifie. Un secret n'a pas de séance :
  sans l'exception, la première séance terminée, un import ou une réparation d'historique effaçait
  noclip. C'est le genre de défaut qu'un test d'intégration voit et qu'un essai à la main manque : la
  ligne est là jusqu'à la première séance.
- `page.goto` vers une URL dont la requête change recharge la page — et rejoue l'ouverture TTY1, 4,6 s —
  au lieu de changer de route. Les captures naviguent par le hash. Et la feuille « Avant le premier son »
  d'une installation neuve intercepte les clics : il faut la passer avant de cliquer derrière.
- `pkill -f <motif>` a tué le shell de la session : le motif figurait dans sa propre ligne de commande.
  Tuer par PID.

**Non vérifié** : le rendu sur un téléphone (police de 16 px à bout de bras, et la cadence de l'œil), l'APK
installé et lancé (il a été ouvert et lu, pas exécuté), et le comportement de `round()` sur une vieille WebView Android (il retombe sur une ligne coupée, laide et
sans conséquence).

**Checkpoint téléphone**, en salle ou à défaut à bout de bras :

1. Installation neuve, thème Sombre : la troisième option de Réglages > Apparence est grisée, avec un
   cadenas. Sur l'installation existante : TTY1 reste disponible.
2. Choisir TTY1, fermer et rouvrir l'app **plusieurs fois** : les sept parties, un contenu différent à
   chaque fois, 4,6 secondes, une fonction de l'app qui attend puis se valide.
3. Toucher l'écran pendant l'ouverture : elle se coupe, sans que l'accueil reçoive le toucher.
4. Lancer une séance et rouvrir l'app : aucune ouverture.
5. « Réduire les animations » : la console est là d'emblée, deux secondes.
6. Pour voir la révélation : effacer `fittrack.tty1Unlocked` et rouvrir avec `?boot=console` (développement
   seulement), ou attendre la surprise de 14 à 28 jours sur une installation neuve.
7. Après la mise à jour, Analyses > Paliers : **noclip** sous « Secrets », daté du jour de la mise à jour,
   son jeton qui s'ouvre en grand avec sa légende. Pas de carte sur l'accueil : c'est un rattrapage.

## Skin TTY1 et version de l'app dans l'en-tête (2026-10-03)

Publication : un tag, **v2.8.0** — mineur et non correctif : un thème s'ajoute et l'en-tête de chaque écran
dit le numéro de l'app, sans rien changer à ce qui existait ni au schéma. Ce numéro est celui de
`package.json`, que l'APK lit aussi pour son `versionName` : la PWA et l'APK le disent l'un comme l'autre.

Deux demandes, une session. Le thème **TTY1** : l'app habillée comme la première console virtuelle d'un
Linux, qui se choisit dans Réglages > Apparence. Et, sur tous les écrans et dans tous les thèmes, le
**numéro de version** en haut à droite de l'en-tête. Aucune table, aucun index, aucune version de
schéma, aucun export : l'app change de peau et dit son numéro, ses données ne bougent pas.

La maquette (`docs/design/mockups/2026-10-03-skin-tty1.html`), les deux specs et les deux plans
(`docs/design/specs/` et `docs/design/plans/`, `skin-tty1` et `version-en-tete`) disent le détail. Voici
ce qui compte pour la suite.

**La version dans l'en-tête**

- Source unique : `package.json`. `vite.config.ts` en fait la constante de build `__APP_VERSION__`,
  `src/app/version.ts` (`APP_VERSION`) en est le seul lecteur, et le workflow Android lit le même champ
  pour le `versionName` : la PWA et l'APK ne peuvent pas annoncer deux numéros, et une release n'a qu'un
  numéro à changer.
- `Screen` l'écrit (`v2.8.0`, 12 px, `--text-2`) dans la marge haute de l'en-tête, les 20 px de `pt-5` :
  pas un pixel de hauteur de plus pour la séance en direct, et jamais à côté d'un titre que l'utilisateur
  a choisi. C'est ce qui dit, sur le téléphone, si la PWA et l'APK sont sur la même construction.

**Le thème TTY1**

- `Theme` passe à `'dark' | 'light' | 'tty1'` (`THEMES` donne l'ordre de Réglages). Le script bloquant
  d'`index.html` et la couleur de la barre système suivent, et un test exécute ce script tel quel pour le
  comparer à `applyTheme`, thème par thème.
- Un seul fichier, `src/styles/tty1.css`, importé par **une ligne** d'`index.css` (`Boot.test.tsx` y lit
  des blocs par ancres). Il redéfinit chaque jeton du thème clair (un test le garde, avec les seuils de
  contraste de la maquette), surcharge les variables de thème de Tailwind (`--font-sans`, `--text-*`) et
  lit les classes existantes comme des rôles : **aucune classe n'a changé de nom**. Les points
  d'accroche ajoutés sont des attributs `data-part`, sans effet hors du thème (la liste est dans la spec).
- **Police** : Terminus 4.49.1 (SIL OFL 1.1) redessinée en contours aux quatre tailles natives, 12, 16,
  24 et 32 px (`TTY12` à `TTY32`). Huit `woff2` de 5 à 8 Ko dans `src/assets/fonts/tty1/`, **dans le
  précache** (234 → 242 entrées : `woff2` manquait au glob), créditée dans « À propos et crédits », licence
  dans `licenses/terminus/`. Le générateur, `scripts/tty1-font/` (Python, hors de `package.json`), redonne
  les mêmes octets à chaque exécution. Un test garde la couverture : un caractère qui entre dans l'app
  sans être dans la police fait échouer la suite au lieu de retomber en silence sur la police du système.
- **Ouverture** : avec TTY1 la console joue à chaque lancement, 2 180 ms, sautée par une séance en cours
  comme les autres, sans toucher à la date de la surprise rare. Elle affiche le numéro de version.
- Ce que le thème montre : vert ANSI `#55ff55` comme seul accent, noir et gris VGA, angles droits, crochets
  sur les boutons, `[x]` pour une série validée, ▼ et ► pour les replis, `[ON ]` et `[OFF]`, vidéo
  inverse au toucher, pistes en cellules, curseur bloc qui clignote (accueil, repos). Pas de trame CRT.
  « Réduire les animations » arrête tout clignotement.

**Vérifié**

- 33 routes balayées dans Chromium à 390 px, en TTY1 et en Sombre : tout texte est dans une famille TTY,
  chaque famille est sur sa taille, aucune cible tactile sous 48 px qui ne le soit déjà en Sombre (les
  boutons de cadence et de plaques font 44 px de large dans les deux), aucun débordement horizontal. Les sept écrans de la maquette comparés à l'œil, côte à côte.
- Le hors-ligne, le vrai : build servi, service worker actif, réseau coupé, page neuve. Le thème, les
  quatre familles de police et la version sont là, aucune requête n'échoue.
- L'APK publié (`FitTrack-v2.8.0.apk`) ouvert et lu : les huit `woff2`, la version `2.8.0` dans le chunk de
  `Screen` et dans le manifeste (`versionName`). Le site déployé n'a pas pu être ouvert depuis la session
  (le domaine `github.io` est bloqué) : seul le succès du workflow de déploiement le garantit.
- `typecheck`, `lint` (un avertissement Fast Refresh préexistant dans `Boot.tsx`), `test:run` (**254
  fichiers, 2 703 tests**, contre 248 et 2 657 au départ) et `build` verts ; le build Android web aussi.
  Précache de 242 entrées, 8 258,80 Kio.

**Pièges rencontrés**

- Élargir `Theme` n'a signalé aucune des conditions écrites « sombre ou clair » : `syncSystemBars` aurait
  donné à TTY1 des icônes sombres sur une barre noire. Un test l'a vu, pas le compilateur.
- Un attribut de présentation SVG (`strokeLinecap="round"` sur un tracé) l'emporte sur une valeur héritée
  du `svg` : le logo de l'ouverture gardait ses bouts ronds. La règle vise désormais le `svg` et ses
  enfants.
- Un élément qui reçoit `text-2xl` sans recevoir sa famille hérite de celle de son parent et étire un
  bitmap : chaque classe de taille, y compris les cinq écrites en dur, porte donc la sienne.
- La règle « mouvement réduit » de `index.css` est dans `@layer base` avec `!important`, et les
  déclarations importantes d'une couche antérieure l'emportent sur celles d'une feuille sans couche : un
  override du skin n'y fait rien là où une règle de la couche cible déjà la même propriété.
- `fontTools` date chaque police de l'instant présent : deux exécutions sur les mêmes sources donnaient
  huit binaires différents. `SOURCE_DATE_EPOCH` fixe rend le générateur reproductible.
- La légende de la carte « À lancer » repose sur `:has()`. Son positionnement absolu vit dans le sélecteur
  de sa carte : sans `:has()`, le navigateur jette la règle entière et la légende reste dans la carte.
- **Un test d'intégration préexistant a rougi le build Android du commit de la v2.8.0** :
  `RoutineFlow.integration.test.tsx` lisait la position du routeur juste après avoir vu `report` appelé,
  alors que `navigate` passe par une transition React et que la position est validée un tick plus tard.
  Quatre passes complètes en local, le commit de la fusion et le déploiement du même commit passaient ; le
  build Android déclenché par le push du commit de la release lisait `/routines`. Impossible à reproduire
  en local, même sous charge (douze essais) : la cause est lue dans le code, pas observée. L'assertion
  attend désormais la position (`c67ff85`) ; rien d'autre n'a changé, et la release, construite sur le même
  commit par `workflow_dispatch`, est verte.
- **Le push d'un tag est refusé à une session d'agent** (HTTP 403 du mandataire). La release est donc
  publiée par `workflow_dispatch` d'`android.yml` avec `release_tag`, comme la v2.7.1 : c'est la voie que le
  commentaire du workflow documente, et le tag désigne le commit construit.

**Écarts avec la maquette, assumés** : `kg` reste en minuscules dans les en-têtes de colonne (un symbole du
SI ne se met pas en capitales), l'icône de fermeture d'une feuille reste grise, et l'étoile d'un record suit
le nom d'un exercice à la ligne. `src/styles/tty1.css` fait environ 730 lignes : consigné dans « Dette
technique assumée » (`docs/progress/decisions-et-pieges.md`).

**Non vérifié** : le rendu sur un téléphone (la seule chose qu'un écran d'ordinateur ne dit pas : une
police de 16 px, en salle, à bout de bras), et l'APK.

**Checkpoint téléphone**, en salle ou à défaut à bout de bras :

1. Réglages > Apparence > TTY1, puis fermer et rouvrir l'app : l'ouverture console, deux secondes, avec le
   numéro de version sous le nom.
2. Lancer une séance, valider une série : `[x]`, le repos qui clignote, la jauge d'effort.
3. Ouvrir la feuille des plaques ; parcourir l'historique et le volume.
4. Couper le réseau, tuer l'app, la rouvrir : la police est là, rien ne retombe sur celle du système.
5. Repasser en Sombre : rien n'a changé, sinon le numéro de version en haut à droite de chaque écran.

## Lisibilité du générateur d'historique volumineux (2026-09-29)

Publication : un tag, **v2.7.1** — correctif et non mineur : rien n'est ajouté, et rien ne
change pour l'utilisateur. Le bundle livré est celui de v2.7.0 au numéro près ; la version
marque que `master` a bougé depuis le dernier tag.

Une relecture humaine de `src/test/largeHistory.test.ts` a buté sur deux noms ; les deux
remarques étaient justes, les autres (ids en chaîne, absence de `try/catch` dans un test,
`.toArray()`) tenaient au modèle et à Dexie et n'appelaient pas de changement.

- **`row` → `workoutExercise`** dans le générateur et son test : « row » ne disait pas qu'il
  s'agit d'une ligne de `workoutExercises` (tel exercice, à telle position, dans telle
  séance). Les ids semés passent de `large-row-…` à `large-workout-exercise-…` ; aucun
  benchmark ne les lisait. Le code applicatif garde son vocabulaire `row`, qui n'est pas
  touché ici.
- **`workoutSpacingMs` commenté** : c'est l'écart entre le début de deux séances, pas entre
  deux séries ou répétitions (`performedAt`). Le nom seul l'a laissé lire comme un temps entre répétitions.
- Aucune ligne applicative, aucun schéma, aucune version : `typecheck`, `lint` (avertissement
  Fast Refresh préexistant dans `Boot.tsx`), `test:run` (**248 fichiers, 2 657 tests**) et
  `build` verts. Pas de checkpoint téléphone : l'app ne change pas.

## Revue des cibles d'une routine (2026-09-20)

Publication : un tag, **v2.7.0** — mineur et non correctif : la revue ajoute une capacité
(un moteur, un écran, une route) sans rien changer à ce qui existait, et sans toucher au
schéma. Un correctif poussé après un tag laisse la PWA devant l'APK ; le tag referme ce
décalage.

Les cibles d'une routine sont figées à sa création ; l'historique, lui, progresse. Un rowing
prescrit à 57,5 kg et tiré à 70 depuis trois séances fait de la routine une **donnée morte**,
que toute fonctionnalité la lisant comme source de vérité propage ensuite. La revue met les
deux côte à côte et attend un doigt.

- **Aucune table, aucun index, donc aucune version de schéma.** Tout ce que la revue lit
  existe déjà : `routineSets.target*` d'un côté, `workoutSets.weight / reps / rpe` de l'autre,
  et `workouts.routineId` pour savoir d'où une séance est partie. Un fichier de sauvegarde
  n'a pas bougé.
- **`src/lib/routineTargets/` — le moteur, pur.** `computeRoutineUpdates(input)` prend des
  enregistrements structurels et rend `{ proposals, missingExercises, unchanged }`. Ni Dexie,
  ni `Date.now()` : même frontière que `lib/coach` depuis le Lot 18, et c'est elle qui rend
  les quatre règles vérifiables sans base. `data/repositories/routineTargetReview.ts` apporte
  les lignes — un `routineId` seul ne peut pas être pur.
- **Quatre règles, et une seule direction.** Jamais de baisse : un réalisé sous la cible ne
  produit rien, pas même un avertissement à accepter d'un doigt. La référence est la
  **meilleure des 3 dernières séances contenant l'exercice** et non la dernière seule —
  fenêtre d'abord, meilleure ensuite. Hausse d'un pas si toutes les séries du palier le plus
  dur atteignent `targetRepsMax` ; alignement si le réalisé dépasse déjà la cible. Les deux
  ne se cumulent pas : **rien n'est jamais proposé au-dessus de ce qui a été soulevé**, la
  hausse vient à la revue suivante, une fois l'alignement accepté.
- **Le RPE absent n'est pas un RPE supérieur à 8.** L'entrée est repliée dans la feuille de
  série et le plus souvent vide (RF-30) ; la traiter comme un refus rendait la règle
  inapplicable sur un historique réel. Un RPE noté au-dessus de 8 bloque, l'absence laisse
  passer, et la carte écrit « effort non noté » au lieu de faire semblant.
- **Le sens des kilos vient de la mesure, pas du nombre.** `weightRole` distingue charge,
  lest et **assistance**, où moins de poids est un effort plus dur ; `nextLoad` porte déjà
  l'inversion. Sans elle, une traction assistée se voyait proposer d'alourdir son
  assistance — exactement le défaut que la revue Codex avait relevé sur `getLastPerformance`.
- **Le palier, pas la séance entière.** Un back-off et une série dégressive sont légers
  *exprès* ; on ne compare que les séries au palier le plus dur, de chaque côté. Une routine
  en pyramide (60/70/80) se compare donc par son sommet et se **décale entière** du même
  écart au lieu d'être aplatie sur un chiffre.
- **`unchanged` porte une raison par ligne écartée.** Ce n'est pas du décor : un écran qui ne
  propose rien sans dire pourquoi se lit comme une panne, et une règle testée contre un
  tableau vide est verte pour n'importe quel motif.
- **Règle 6 — l'exercice fait hors routine**, borné aux séances **parties de cette routine** :
  sans cette borne, tout exercice jamais pratiqué se présenterait comme « manquant » de
  celle-ci. Signalé à part, avec un bouton qui l'ajoute, et rien d'appliqué d'office.
- **Piège relevé en écrivant la collecte.** Les deux fenêtres de lecture se recouvrent —
  l'historique de l'exercice et les séances de la routine. Un bloc compté deux fois double
  son nombre de séries de travail et fait donc passer pour « tenue en entier » une
  prescription qui ne l'était pas. Dédupliqué par `workoutExerciseId`, avec un test qui
  verrouille le cas.
- **L'écran** (`routines/:id/review`, ouvert depuis la routine et **pas** d'une feuille de fin
  de séance) : une carte par exercice — cible actuelle, réalisé de référence avec sa date,
  proposition, Refuser / Accepter — et une bande « Tout accepter (n) ». Instantané et non
  `useLiveQuery`, seule exception assumée à la règle de réactivité : accepter écrit la cible,
  ce qui ferait disparaître sous le doigt la carte qu'on vient de toucher.
- **Vérification.** `typecheck`, **2 657 tests dans 248 fichiers**, `lint` (seul l'avertissement
  Fast Refresh préexistant de `Boot.tsx`) et `build` verts. 34 tests nouveaux, dont les quatre
  demandés : aucune hausse si RPE > 8, aucune baisse jamais, exercice hors routine listé à
  part, exercice sans historique ignoré. Aucun essai navigateur ni APK.

## Quatre évolutions : note de routine, BOM, unilatéral, export markdown (2026-09-13)

Quatre chantiers indépendants, livrés un par un. Validation finale : 2 623 tests
réussis dans 246 fichiers, typecheck, lint et build verts.

- Publication : un tag, **v2.6.0** — mineur et non correctif, parce que trois des quatre
  chantiers ajoutent une capacité (la note de routine et son schéma 13, le suffixe
  unilatéral, l'export markdown des routines) et que le quatrième change le contenu d'un
  fichier que des outils extérieurs lisent. Un correctif poussé après un tag laisse la PWA
  devant l'APK ; le tag referme ce décalage.

- **Schéma 13 — la note de réglage d'une ligne de routine.** Le champ `notes` sur
  `routineExercises` existait déjà en type, dans la feuille de l'éditeur, sur la carte,
  et son report vers `workoutExercises` au démarrage d'une séance était écrit.
  Ce qui manquait était tout le reste : la version 13 écrit `''` sur les lignes d'avant,
  `lib/backup/backfill` fait le même rattrapage sur un fichier restauré (aucun `upgrade()`
  Dexie ne se déclenche sur une restauration), et `notes` est enfin **déclaré** dans
  `lib/backup/validate` des deux côtés du report — un champ non déclaré traversait la
  validation sans être vu. Un fichier en version 12 continue de s'importer. La migration
  n'ouvre que `routineExercises` : aucune donnée d'entraînement touchée.
- **Pourquoi on ne voyait pas le champ.** La note s'affichait en **pied de carte**, sous
  « Ajouter une série », après la seule zone qu'on fait défiler. Elle est remontée sous le
  nom de l'exercice, au même endroit qu'en séance. Et le `<textarea rows={4}>` de la feuille,
  ouvert en permanence, poussait « Grouper » et « Retirer » sous le pli : il se replie
  maintenant tant que la note est vide (`AddRow`, le seul geste d'ajout de l'app).
- **BOM.** `saveTextFile` préfixait un BOM à **tout** fichier texte. Délibéré pour le CSV
  (Excel lit sinon « Développé couché » en mojibake), désastreux pour le JSON :
  `json.load()` répond « Unexpected UTF-8 BOM ». Invisible de l'intérieur parce que
  `Blob.text()` retire le BOM au décodage — seul un lecteur extérieur tombait dessus. La
  décision passe à l'appelant, **en opt-in** : un export ajouté plus tard part en UTF-8 nu,
  et le CSV demande son BOM là où il est produit. `parseBackup` retire un BOM de tête avant
  `JSON.parse` : les sauvegardes déjà écrites avec en existent sur de vrais téléphones.
- **Unilatéral visible.** `exerciseDisplayName(name, isUnilateral)` dans `i18n/labels`
  suffixe « (unilatéral) » au catalogue, aux sélecteurs, à la fiche, à l'éditeur de routine,
  à la séance et son récapitulatif, à l'historique, aux records et aux deux écrans d'analyse.
  Purement présentationnel : `name` en base, l'instantané de séance et les deux exports
  portent le nom nu, et un test verrouille cette frontière — le suffixe entrerait sinon dans
  une identité que la sauvegarde emporte. Le drapeau vient toujours de la source qui répond
  déjà du nom à cet endroit : l'instantané pour l'historique et les records, la bibliothèque
  pour le catalogue et les routines.
- **Export markdown des routines.** `lib/export/projectRoutineExport` +
  `serializeRoutineMarkdown`, sur la même plomberie que l'historique ; les mécaniques
  communes aux deux documents sortent dans `lib/export/markdown`. Une ligne par exercice
  (séries, fourchette de reps, charge, durée, note), les lectures répétées jointes une fois,
  une montée en charge écrite en entier, les colonnes de chiffres seulement si un exercice
  les remplit, les échauffements signalés dans le compte, les supersets nommés sous le
  tableau. Deux modes — une routine, ou un dossier — dans les feuilles d'actions existantes.
- **Deux épingles de version retirées.** `coachRecommendations.test.ts` et
  `milestones.test.ts` assertaient `db.verno` en double de `schemaVersion.test.ts`, dont
  l'une sous un titre annonçant la version 10 en assertant 12 : la dérive avait déjà eu
  lieu. Ces tests ne répondent plus que de la présence de leur table.

## Sauvegardes validées, échauffements reproposés, commandes regroupées (2026-09-06)

- Publication : quatre tags dans la journée — v2.5.1 pour la livraison principale, v2.5.2 pour le durcissement de la validation, v2.5.3 pour les trois correctifs venus d’une revue Codex, v2.5.4 pour le routage du sommaire de la Documentation. Un correctif poussé après un tag laisse la PWA devant l’APK ; chaque tag referme ce décalage. Validation avant le dernier changement de numéro : 2 566 tests réussis dans 242 fichiers, typecheck, build et lint verts.
- **Import de sauvegarde.** Nouveau `src/lib/backup/validate.ts` : format, version de
  fichier, version de schéma, structure complète et références sont vérifiés **avant**
  toute écriture. Une table malformée, une ligne qui n'est pas un enregistrement, un champ
  obligatoire absent ou d'un mauvais type, deux lignes sur le même identifiant : le fichier
  est refusé et la base n'est pas touchée. Une table absente reste légitime quand le schéma
  du fichier ne la connaissait pas (blocs à la version 6, paliers à la 12) ; sous ce seuil
  c'est un trou et c'est refusé. Une sauvegarde écrite contre un schéma plus récent que
  cette version est refusée (`unsupported-schema`). Les références cassées ne refusent pas
  le fichier — elles sont comptées et annoncées dans le récapitulatif, qui porte désormais
  la date du fichier et le nombre de lignes. Le message d'erreur nomme la table, la ligne et
  le champ (`features/settings/backupMessages.ts`). `writePreferences` remet les préférences
  d'avant si une écriture `localStorage` échoue à mi-chemin.
- **Échauffements récurrents.** `src/lib/warmupMemory.ts` relit la montée de la dernière
  séance de l'exercice — aucune table, aucune migration : l'historique *est* la mémoire, et
  elle est donc par exercice quelle que soit la routine. Les paliers sont mémorisés en
  pourcentage de la charge de travail du jour et **réappliqués à celle d'aujourd'hui** ; le
  bandeau le dit quand la charge a changé. Proposé sur la seule carte de l'exercice en cours,
  jamais imposé : Ajouter écrit la montée, Modifier rouvre la feuille sur ces paliers,
  ignorer c'est commencer à soulever. Rien n'est proposé si la séance porte déjà un
  échauffement, ni après la première série validée — ce qui règle aussi la reprise après un
  kill. Distinction échauffement/travail inchangée (`isWorkingSet`, `matchPreviousSets`).
- **Tutoriel des réglages.** Le choix du mode accepte désormais le Silence et termine la
  mission : l'étape le refusait et bloquait net celui qui venait couper le son. L'écho est
  devenu sa propre mission (`TUT-SET-03`), gardée par `requires-audible-guidance` — en
  Silence la ligne n'est pas rendue, la mission n'est donc pas proposée. Le mode d'annonce
  est suivi dans l'état du provider au lieu d'être relu à l'aveugle, ce qui corrige au
  passage la fraîcheur de `hasRepPacing`. Une mission dont la garde tombe est **mise en
  pause** (`suspendMission`) et non comptée refusée : elle revient intacte.
- **Commandes de séance.** Le cadenas d'ordre et la commande de deload quittent le bandeau
  pour le menu de séance, sous leur libellé et avec la raison de leur grisage. Le bandeau ne
  garde que l'avancement, le repliage, et l'état « 80 % » **quand la décharge est
  appliquée**. La mission `TUT-WRK-12` ouvre le menu avant de désigner la décharge.
- **Durcissement après coup.** Une seconde session avait commencé la même validation dans un
  worktree voisin, sous la forme d'une table `src/lib/backup/schema.ts` jamais commitée. Les
  deux dérivations s'accordaient sur les seuils `since` (paliers 12, blocs 6, coach 5,
  correspondances 3), ce qui les confirme mutuellement. Deux apports en ont été repris dans
  `validate.ts` : les instants, durées et comptes ne peuvent plus être négatifs, les rangs
  et index doivent être des entiers positifs — et `startedTimezoneOffsetMinutes` est
  explicitement exempté du plancher, parce qu'il est négatif à l'ouest de Greenwich. La
  distinction entre lien de propriété et pointeur de contexte est consignée sur `links` :
  les deux sont comptés, aucun ne refuse le fichier. `schema.ts` a été retiré.
- **Trois correctifs d’une revue externe (Codex).** *Décharge des petites charges* : l’arrondi
  au pas de 2,5 kg retournait l’intention en bas de l’échelle — 2 kg devenaient 2,5, un
  allègement qui alourdit, et 5 kg restaient 5. Sous le pas, la réduction exacte est gardée et
  le libellé le dit. *Référence incompatible* : une traction assistée passée en répétitions
  seules ramenait les kilos d’**assistance** de la séance précédente comme charge **ajoutée**
  proposée, validable d’un doigt ; `getLastPerformance` reçoit le type de mesure de la ligne
  et refuse une référence qui ne le partage pas. *Restauration à moitié faite* : les
  préférences passent dans la transaction Dexie, et les deux sens sont couverts —
  `localStorage` refuse et la base ne bouge pas, la base avorte et les préférences
  reviennent. Les quatre tests livrés en un seul fichier fourre-tout ont été répartis dans
  leurs modules.
- **Le sommaire de la Documentation ne menait qu’au wiki.** Défaut remonté à l’usage :
  l’encadré « Ce que le wiki documente ici » listait les titres des articles rattachés à
  l’exercice **en texte mort**, au-dessus d’un unique lien vers l’accueil du wiki. Sur une
  adduction — qui projette pourtant trois articles — le geste évident ouvrait donc un
  sommaire de soixante-quatre. Seuls les exercices de triceps semblaient marcher : ils sont
  les seuls du catalogue à porter un article de portée, affiché en entier dans l’onglet, ce
  qui masquait le défaut partout ailleurs. Chaque titre est maintenant son propre lien, sur
  une cible de 48 px ; « Ouvrir le sommaire du wiki » reste, en second, parce que c’est une
  sortie et non la réponse à « que dit le wiki sur cet exercice ». Quand le corpus ne
  rattache **rien** — nuque, étirements, mobilité, rouleau : quatre exercices sur 175 — le
  résolveur expose le cadre général (`listGeneralArticles`, les articles de choix
  d’exercice qui ne déclarent aucune identité) plutôt que de laisser l’accueil pour seule
  issue : ne rien déclarer est ici une propriété, donc ces pages ne prétendent pas parler de
  cet exercice-là. La lacune reste écrite, et l’écran continue de ne connaître aucun
  identifiant d’article — le repli vient du résolveur, comme le reste de la projection.
- **Vérification.** `typecheck`, 2 566 tests dans 242 fichiers, `build` et `lint` (le seul
  avertissement restant est le Fast Refresh préexistant de `Boot.tsx`). Aucun essai
  navigateur ni APK.
- **Checkpoint téléphone (v2.5.4).** Adduction à la machine → onglet Documentation → taper
  « Adducteurs de hanche » dans l’encadré du haut : la fiche du muscle doit s’ouvrir, pas le
  wiki. Un exercice de triceps ne doit rien avoir perdu. Étirements → Documentation : le
  cadre général doit être proposé, l’accueil ne doit plus être la seule sortie.
- **Checkpoint téléphone.** Restaurer une vraie sauvegarde, puis une tronquée à la main
  (vérifier que le message nomme la table et que rien ne bouge) ; séance A avec échauffement
  puis séance B avec charge modifiée ; routine qui porte déjà son échauffement ; tutoriel
  des réglages en Silence ; menu de séance au pouce, clavier ouvert ; premier côté →
  changement → second côté → repos, sans son.

## Fluidité de séance et guidage (2026-09-05)

- Publication : version 2.5.0 préparée sur master ; push et tag v2.5.0 pour publication PWA et génération de l’APK signé par GitHub Actions. Validation fonctionnelle : 2 511 tests réussis avant le changement de numéro de version.
- Échauffement : références précédentes appariées indépendamment des séries de travail ; décharge cohérente avec cette règle. Aucun échauffement historique proposé comme charge de travail.
- Séance : exercice à faire déplié, suivants compacts et librement ouvrables ; fin de séance secondaire avant la dernière validation. Indications visibles côté 1, changement de côté et côté 2, même sans cadence. Repos restauré à son échéance après rechargement, effacé à la sauvegarde/à l'abandon.
- Fiabilité : repos et annonce de validation après écriture réussie, erreur affichée en cas de refus IndexedDB ; sauvegarde finale protégée du double appui et interdite sans série validée.
- Bilan : résumé explicitement basé sur la dernière série, nom/type issus du snapshot ; carte musculaire dépliable après le détail.
- Première ouverture : avertissement vocal avant tout son du tutoriel ; choix visite vocale, silencieuse ou Passer. Passer ouvre directement l'app en silence. Campagne à la demande dans l'aide ; narration interdite aussi en Sons uniquement. Tutoriel des deux côtés indépendant du démarrage d'un chrono, progression existante migrée vers le script 3.
- Exercices : état vide avec filtres corrigé ; création depuis le sélecteur sans perdre les choix ; liste ordonnée de sélection avec retrait.
- UI : libellés plus lisibles, séparation cible/valeur dans les champs, même famille orange en clair, titre Progression cohérent, célébrations après la proposition de séance. Fermeture des feuilles robuste sans événement de transition et retrait immédiat de l'arbre d'accessibilité.
- Vérification finale : 2 511 tests passent dans 238 fichiers ; typecheck et build réussis, lint sans erreur (avertissement Fast Refresh préexistant dans Boot.tsx). Groupes ciblés séance/tutoriel et import/reprise/bilan/migration également vérifiés.
- Reste du backlog d'audit : validation structurelle des sauvegardes avant restauration, automatisation volontaire des échauffements récurrents, simplification plus poussée des commandes expertes et du tutoriel des réglages. **Traités le 2026-09-06** (section du haut).
- Checkpoint téléphone : première ouverture sans surprise sonore ; séance unilatérale sans son, changement de côté lisible ; kill pendant repos ; séance suivante après échauffement ; créer une variante depuis la sélection puis revenir ; vérifier bilan et thème clair. Pas de nouvel essai navigateur/APK, conformément à la préférence utilisateur.

## Revue code et UX (2026-09-05)

- Audit sans modification du code applicatif : `docs/audits/2026-09-05-code-ux-review.md`.
- Complément demandé : appariement par position mélangeant échauffements précédents et séries de travail, choix vocal trop tardif, visibilité des deux côtés sans cadence et adéquation des tutoriels. Constats source, sans nouvelle visualisation ni correctif.
- Approfondissement qualité UI : priorité visuelle de Terminer, densité de séance, commandes expertes, bilan mobile, taille des libellés, continuité des thèmes et vocabulaire. Recommandations ajoutées au même audit, sans refonte appliquée.
- Priorités : erreurs d'écriture silencieuses et validation insuffisante des sauvegardes ; bilan de séries hétérogènes trompeur ; faux état vide avec filtres ; friction tutoriel et ajout d'exercices.
- Typecheck/build réussis ; lint sans erreur (un avertissement). Suite complète interrompue sans bilan après blocage apparent, deux échecs de séance signalés. Vérification ciblée indépendante : 118/119, échec cadence reproduit seul. Aucun commit effectué, suite non verte.
- Checkpoint téléphone : reprendre une séance après kill pendant repos, vérifier le bilan de deux séries différentes, tester recherche + filtre contradictoire et sortie réelle du tutoriel. APK et mode avion restent à vérifier.

## Lacunes connues

- **Couverture du corpus éditorial.** Aucun article ne couvre les muscles `neck`, `full_body`,
  `cardio` et `other`, ni la famille de mouvement `autre`. Conséquence mesurée sur le
  catalogue : 4 exercices ne projettent aucun article (flexion de nuque, étirements,
  mobilité, rouleau de massage) et 7 n'en projettent qu'un (crunchs, extensions de nuque,
  corde à sauter). Un seul groupe musculaire porte un article **propre à ses exercices** —
  le triceps, via `exercise-triceps-extensions` déclaré sur 8 slugs. Combler cela demande de
  rédiger des articles sourcés dans `fittrack-kb-contract/editorial/articles/`, pas de
  toucher à l'app : le validateur exige des `claimId` réels, et l'écran a pour règle de
  montrer la lacune plutôt que de la deviner.

## Archives de progression

| Fichier | Contenu |
| --- | --- |
| [journal-2026.md](docs/progress/journal-2026.md) | Sessions 2026 (tutoriel, wiki, investigation) |
| [lots.md](docs/progress/lots.md) | Journaux des lots 0 à 7 |
| [decisions-et-pieges.md](docs/progress/decisions-et-pieges.md) | Décisions, pièges, dette technique |
| [2026-08-29-versions-v0-v1.md](docs/journal/2026-08-29-versions-v0-v1.md) | Versions v0–v1 |

## Checkpoints téléphone encore dus

- **Coach** (2026-10-04, branche de session, une fois fusionnée) — au plafond sur une machine où tu charges
   par 2,5 kg, la carte propose +2,5 kg et dit « Pas de 2,5 kg, lu dans les charges que tu as déjà chargées ».
   Rowing tenu en haut de fourchette : la carte propose la hausse au lieu de « Plateau ». Une série à l'échec
   finie sous le bas de fourchette ne déclenche plus ni « Baisse de reps » ni allègement ; finie sous le haut,
   elle empêche le plafond.
   Tranche 2 : un plafond atteint à RPE 9,5 ou plus ne propose pas de charge et dit pourquoi ; une séance à
   même charge avec un RPE plus bas affiche « la charge se consolide ».
0. **Revue des cibles** (2026-09-20) — ouvrir une routine dont une charge a été dépassée en
   séance, taper « Mettre à jour les cibles » sous le dossier. Vérifier que la carte du rowing
   affiche bien 57,5 → 70, que « Refuser » ne change rien à la routine et qu'« Accepter »
   l'écrit. Vérifier surtout qu'un exercice **descendu** en charge n'apparaît pas du tout, et
   qu'il se lit dans « Laissées telles quelles » avec sa raison. Un exercice fait en plus dans
   ces séances doit figurer en bas, avec son bouton d'ajout.
1. **Note de routine et export markdown** (2026-09-13) — ouvrir une routine, taper le menu
   d'un exercice : « Ajouter une note » remplace le grand champ vide ; écrire une consigne,
   la voir apparaître **sous le nom** sur la carte. Démarrer la séance : la même consigne
   sous le nom de l'exercice ; la corriger là, revenir à la routine — la routine n'a pas
   bougé. Puis Bibliothèque › menu d'une routine › « Partager en markdown », et le même
   geste sur un dossier. Enfin : exporter la sauvegarde JSON et l'ouvrir ailleurs — plus de
   BOM en tête. Le CSV, lui, doit toujours s'ouvrir avec ses accents dans un tableur.
2. **Programme** — ouvrir un bloc actif puis toucher « Ce qu’en dit le corpus » : l’article du
   Guide correspondant à la phase doit s’ouvrir, sans page d’erreur React Router.
3. **Unilatéral sans cadence** — cocher le premier côté : la coche reste grisée dix secondes,
   affiche le décompte, puis se réactive seule pour valider le second côté sans changer de menu.
4. **Paliers** — Progression › Paliers : jetons-images (Pepe, git gud, stonks…) à la place du
   disque chiffré. L'état vide reste vide. Après une séance qui franchit un palier, la carte
   d'accueil porte le même visuel avec un anneau accent. Thème clair aussi.
5. **Ouverture** — fermer l'app, la relancer à froid : plaques, deux phrases, accueil. Puis forcer
   le terminal (clé `fittrack.bootEasterEggAfter` due) : écran noir, glyphes blancs, comme GRUB.
6. **Tutoriel** — sélecteur de guidage à quatre modes, série unilatérale menée jusqu'au bout.
7. **Première séance / DOMS** — install neuve (ou reset IndexedDB) : enregistrer une
   première séance, voir le Malphite-Chad « Rock solid. » sur l'accueil. APK : 48 h plus
   tard, notif « Tes premières DOMS » puis la porte au tap. Compte actuel : les deux
   paliers sont déjà dans Progression › Paliers, sans carte ni notif.
8. **Documentation d'un exercice** — adduction à la machine › Documentation : taper un titre
   de l'encadré du haut ouvre l'article nommé. Étirements : le cadre général est proposé,
   l'accueil du wiki n'est plus la seule sortie.

## Première séance et premières DOMS (2026-08-31)

- Deux paliers de pratique : `sessions-1` (Ta première séance) et `doms-48` (Tes
  premières DOMS), avant les 10 séances. Jetons `rock-solid` et `doms-door`.
- Compte neuf : carte d'accueil à l'enregistrement, puis badge à la relance 48 h plus
  tard. APK seulement : notification locale pile à 48 h si la première séance a été
  fêtée en direct. PWA : pas de pop-up.
- Compte déjà en route : projection v2, rattrapage silencieux, pas de fête.
- Spec : `docs/design/specs/2026-08-31-first-session-doms-paliers-design.md`.
- Vérification : typecheck et build verts. Vitest 2502/2503 ; l'échec restant est
  `ProgramFlow` « Semaine N sur 4 » (date du 3 août 2026, hors de ce lot).

## Documentation des programmes et transition unilatérale (2026-08-30)

- Le lien de preuve d’une phase ne reconstruit plus l’ancienne route supprimée
  `/knowledge/p/:sectionId`. Il résout l’article actuel du Guide et ouvre sa route
  `/knowledge/programmation/:articleId` ; les phases décharge, progression, surcharge et reprise
  sont couvertes.
- La ligne de série unilatérale dérive désormais son état depuis sa propre horloge. Après la
  première coche, le verrou de dix secondes expire donc sans dépendre d’un nouveau rendu du parent
  ni d’un passage par un menu — notamment quand aucune cadence ne fait bouger l’écran.
- Vérification : typecheck et build de production verts. La passe Vitest unique demandée a validé
  2 473 tests sur 2 474, dont les nouvelles régressions ; l’unique échec était une attente exacte
  de 38 s ayant mesuré 39 s. Cette attente a été rendue déterministe après la passe, sans relancer
  la suite conformément à la consigne utilisateur.

## Ouverture simplifiée et terminal GRUB (2026-08-30)

### Ce qui change

- La barre conserve uniquement son chargement de plaques. La chute, la compression, la secousse,
  le sol et la poussière sont supprimés — y compris la « deuxième passe » d'impact encore sur
  `origin/master` au moment de la fusion.
- « Progressive Overload » apparaît, puis « Production was the gym » 180 ms plus tard ; le rideau
  fond ensuite vers l'accueil en opacité seule.
- Durées : 2 180 ms (normal), 3 360 ms (console). Une séance active saute le rideau et **ne
  consomme pas** la date du terminal.
- Une date `fittrack.bootEasterEggAfter` (hors sauvegarde `fittrack:`) programme une variante
  rare tous les 14 à 28 jours. Quatre logs fixes, curseur, `progressive_overload = true`.
  Fond `#000`, glyphes `#fff`, indépendant du thème.
- `prefers-reduced-motion: reduce` : fondus / états statiques, pas de glitch ni de frappe.

### Vérifications

- 17 tests ciblés boot / easter egg verts avant fusion `origin/master`.
- Typecheck, suite et build : à rejouer sur l'arbre fusionné.

## Les paliers (2026-08-29)

Catalogue de 56 seuils acquis à vie, table Dexie `milestones` (schéma 12), rétrospective
d'anniversaire. Aucune notification. Une carte au maximum sur l'accueil.

**Jetons (2026-08-30).** Le disque chiffré cède la place à 22 illustrations originales de mèmes
(`public/milestones/*.jpg`, ~192 px). Mapping dans `src/lib/milestones/art.ts`. Le chiffre reste
dans le titre. Workbox précache les `jpg`. DEV : `?demoPaliers=1` affiche le mur sans écrire en
base. Nintendo dehors. Pepe dedans (feels good, smug, feels bad, rare).

Correctifs origin : un seuil retiré ne fait plus taire les anniversaires ; rattrapage après
import Hevy.

## Découpage de l'écran de séance (2026-08-29)

`WorkoutScreen.tsx` sort les feuilles, les gestes, le chargement et les recherches dans des
modules dédiés. Aucun comportement changé, livré dans v2.4.0.

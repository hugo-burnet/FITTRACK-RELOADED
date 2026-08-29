# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.

**Dernière mise à jour :** 2026-08-29 (**les paliers** — un catalogue de 56 seuils écrits à la
main, acquis à vie, plus une rétrospective d'anniversaire. Nouvelle table Dexie `milestones`
(schéma 12). **Checkpoint téléphone à faire : l'écran Progression › Paliers, et la carte d'accueil
après une séance qui en franchit un.** Voir la section dédiée ci-dessous). Le même jour (**impact
de la barre au démarrage** — le petit saut vertical est remplacé par une chute, une compression au
sol, une secousse amortie et six particules SVG de poussière. Le mode mouvement réduit garde des
fondus sans déplacement. **Checkpoint téléphone à faire : relancer l'app à froid et juger le poids
de l'impact et la discrétion de la poussière.** Voir la section dédiée ci-dessous).
Le même jour (**tutoriel campagne : tâches 6 à 11 terminées** — les cinq zones restantes de la
couverture contextuelle, le mode « Voix uniquement », les côtés unilatéraux persistés, le contrôle
manuel des côtés, l'enquête sur la double annonce et l'audit navigateur. Douze commits, 36 missions
sur 39, suite complète et build verts. **Checkpoint téléphone à faire : le sélecteur de guidage à
quatre modes, et une série unilatérale menée jusqu'au bout.** Voir la section dédiée ci-dessous).
Précédemment, le 2026-08-28
(**passe mouvement** : écran d'ouverture qui charge le logo,
transitions d'écran directionnelles — l'app avait des entrées mais aucune sortie —, mode mouvement
réduit qui réduit au lieu de couper, cible RPE portée à 48 px, cinq écrans sortis du chunk
d'entrée, et la carte de charge alignée sur les règles du sélecteur de repos. Voir la section
dédiée ci-dessous — **checkpoint téléphone à faire : le rideau de démarrage, le sens des
transitions, et le sélecteur de charge**). Le même jour (**inventaire écran par écran pour
terminer le tutoriel** : les 36 routes, leurs feuilles et états secondaires sont répertoriés avec
leurs effets réels et la couverture du tutoriel ; le document maître est aligné sur v2.2.0, les 10
chapitres, 12 missions, 15 clips de mission et 96 MP3 — ce travail-là n'a touché aucun code
applicatif). Précédemment, le 2026-08-27 (**lecture du
wiki, deuxième passe** : filtre de la
documentation supprimé, sources affichées en clair au lieu d'identifiants, et rythme rendu aux
articles de prose. Voir la section v2.2.0 ci-dessous — **checkpoint téléphone à faire**). Plus tôt
le même jour (**reprise de lecture après retours téléphone** : libellé de routine décollé du bord
de sa carte, commande d'une observation coach rendue lisible, hiérarchie des fiches de preuve). Plus tôt (**reprise UI Routines, Wiki et coach en séance** : les
commandes de la bibliothèque suivent désormais les motifs existants, les articles ont été allégés
et le coach exige une action explicite avant d'appliquer une charge. Voir la section dédiée
ci-dessous — **checkpoint téléphone à faire**). Plus tôt le même jour (**wiki structuré relu,
corrigé et complété** : la relecture
des 64 articles a trouvé 27 renvois orphelins, 6 passages tronqués par l'extraction et 4 erreurs de
rédaction ; le Guide gagne un parcours « Apprendre à programmer » et la douleur devient accessible
depuis chaque exercice. **Huit checkpoints téléphone restent à faire.**) Plus tôt (**le wiki
structuré est livré** : 64 articles, 408/408
affirmations et 102/102 fiches citées, la documentation reliée aux exercices, et Planifier réunit
Routines, Programmes et Guide. Voir « Wiki structuré, documentation et Planifier » ci-dessous —
**huit checkpoints téléphone restent à faire**). Plus tôt le même jour (**la piste du reclassement
est close, négativement** :
le petit cross-encoder coûte 4 343 ms/question et fait tomber le rappel de 27/31 à 22/31 et la
précision@1 de 17/31 à 5/31. Aucun reranker n'entre dans l'application, CAL et TEST restent fermés,
et **la recherche ne sert plus à décider quel contenu rattacher à un objet FitTrack** — c'est le
rôle du wiki structuré. Voir « Verdict produit » dans
`fittrack-kb-contract/benchmark/e5-retrieval/RESULTATS.md`). Le même jour (**annotation exhaustive DEV : couverture du corpus à
52,5 %, correction d'instrument consommée, CAL et TEST toujours fermés** — voir la section
« Annotation exhaustive DEV » ci-dessous). Précédemment, le 2026-08-24 (**`feat/knowledge-base-v1` intégré dans `master` en
fast-forward.** `src/` n'a pas bougé. Vitest ignore désormais `fittrack-kb-contract/`, dont les
tests tournent avec `node --test`. Le contrôle visuel du tutoriel sur téléphone reste dû).
La **phase 2 de la Knowledge Base** est livrée à côté, dans `fittrack-kb-contract/` : contrat
exécutable, aucun code de l'application touché.

## Les paliers (2026-08-29)

Branche `claude/secret-vivre-vieux-01bl4s`. Point de départ : « le secret pour vivre vieux c'est
vivre heureux », et l'envie de **valoriser la progression sans la transformer en jeu**.

### La décision de fond

`HomeScreen.tsx` avait déjà supprimé la série de semaines consécutives — « un compteur qu'on lit
une fois et qu'on perd en se blessant ». Les paliers sont l'inverse exact de ce compteur : des
seuils **acquis à vie**, qu'aucune pause, aucune blessure et aucun mois d'arrêt ne reprennent.

Le mot est **palier**, pas « jalon » : `records.subtitle` emploie déjà « jalon » pour les marques
du rail des records. Deux mots pour deux choses — un record est relatif à soi et tombe toutes les
trois semaines, un palier est un seuil écrit à l'avance qu'on ne franchit qu'une fois.

### Ce qui est livré

**Le catalogue** — `src/lib/milestones/catalogue.ts`, 56 seuils écrits à la main. Six mouvements de
force (développé, squat, soulevé de terre, militaire, hip thrust, rowing), les portes qui s'ouvrent
(première traction, premiers dips, pistol squat, gainage, suspension), la paire d'haltères, et
surtout les paliers de **pratique** : séances, semaines actives cumulées, années, tonnage. Un test
plafonne la liste à 60 : le jour où quelqu'un veut en ajouter un, il devra en retirer un autre.

**Le moteur** — pur, sans état, relit tout l'historique à chaque appel. C'est ce qui fait qu'un
import de dix ans rend ses paliers **à leurs vraies dates**, et qu'une séance corrigée ne laisse
pas un palier faux derrière elle.

**La rétrospective** — `pickRetrospective` rend `undefined` presque tous les jours, et c'est sa
raison d'être. Cinq âges seulement (1, 2, 3, 5, 10 ans), une fenêtre d'une semaine, une carte à la
fois, acquittée pour toujours.

**La table `milestones`** (schéma Dexie 12, aucun `upgrade()`). Le rattrapage se fait au démarrage
dans `initializePersistentData`, où il peut échouer sans empêcher l'app de s'ouvrir.

### Les trois décisions anti-spam

1. **Le rattrapage initial entre acquitté.** Dix ans d'historique franchissent quarante paliers
   d'un coup ; quarante célébrations simultanées n'en valent aucune. Ils sont consultables et
   silencieux, et les anniversaires les retrouveront un par un.
2. **Aucune notification.** Le canal de la barre d'état est pris par les records et les rappels.
   Un palier se lit très bien en rentrant sur l'accueil — ce qui arrive une seconde après avoir
   enregistré la séance qui l'a franchi.
3. **Une carte au maximum sur l'accueil.** Un palier neuf et un anniversaire peuvent coïncider ;
   le neuf passe devant.

### Sur les badges : aucune image, aucune génération

Le jeton est un disque SVG dessiné en code, et **son contenu est le chiffre** — `100`, `1`, `52`.
Une image générée demanderait un réseau et une clé (règles n° 2 et n° 3) ; un jeu d'images acheté
coûterait ce que l'enquête du 2026-07-22 a chiffré. Et un trophée doré aurait fait de la pratique
un jeu, ce que le projet a déjà refusé une fois.

L'accent vert est réservé au palier **qui vient de tomber** : la charte le garde pour les séries
validées et les records, et un mur de jetons verts ne distinguerait plus rien.

### Deux dettes soldées au passage

`HistoricalExercise` gagne `slug` et retrouve `isUnilateral`. Le drapeau en était sorti faute de
lecteur ; il en a un maintenant — le palier de la paire d'haltères, qui n'existe que si les deux
mains travaillent en même temps. La règle est inchangée : un champ reste dans la projection tant
qu'un écran s'en sert.

### Ce qui n'est pas fait

L'écran des paliers ne montre **que l'acquis**, jamais ce qui manque : une liste grisée de tout ce
qu'on n'a pas encore fait transformerait la pratique en liste de courses. Les paliers de charge ne
comptent que les exercices du catalogue — un exercice personnel n'a pas de slug, et « 100 kg au
développé couché » ne veut rien dire si n'importe quelle ligne peut s'appeler ainsi. La paire
d'haltères, elle, n'a pas cette restriction : un rack ne se falsifie pas en tapant un nom.

### Checkpoint téléphone

1. **Progression › Paliers** — base vierge : l'état vide doit dire « Rien encore, et c'est normal »
   sans lister d'objectifs. Après un historique importé : les jetons groupés en quatre rayons,
   dates lisibles, aucun débordement horizontal.
2. **Une séance qui franchit un palier** — enregistrer, atterrir sur l'accueil, vérifier que la
   carte est en tête, en vert, avec la phrase « Acquis pour de bon ». Fermer, rouvrir l'app : elle
   ne doit **jamais** revenir.
3. **Thème clair** — le jeton accent (vert acide sur encre) et le jeton neutre doivent rester
   lisibles tous les deux.

## Impact de la barre au démarrage (2026-08-29)

### Ce qui change

- La barre chargée ne monte plus avant de retomber : elle attend au-dessus du sol, accélère vers
  lui, s'écrase brièvement sur l'axe vertical puis retrouve sa géométrie sans rebond.
- Le contact déclenche une secousse horizontale amortie, une ligne de sol et deux nappes de trois
  particules SVG. La poussière disparaît avant le rideau ; aucune image ni dépendance n'est ajoutée.
- Le principe « Progressive overload » apparaît sur l'impact. La durée totale reste exactement
  `BOOT_HOLD_MS = 2500` ms et une séance active continue de court-circuiter le rideau.
- Avec `prefers-reduced-motion: reduce`, la chute, la compression et la secousse sont supprimées.
  La poussière apparaît puis disparaît uniquement par opacité.

### Vérifications

- Test TDD : structure de la scène, six particules et contrat CSS de poussière sans mouvement.
- `npm run typecheck` : vert.
- `npm run test:run` : **225 fichiers, 2 355 tests, tous verts**.
- `npm run build` : vert, artefact du wiki à jour et PWA générée.
- Navigateur intégré, viewport 390 × 844 : impact contrôlé pendant et après l'animation, aucune
  erreur ni aucun avertissement console ; la barre et la secousse reviennent exactement au repos,
  la poussière finit à `opacity: 0`.
- Relecture indépendante : le premier passage a trouvé un flash de poussière pendant le fondu de
  sortie. Le correctif TDD donne au sol et à la poussière un état de repos stable ; le second passage
  ne relève plus aucun problème critique ou important.

### Checkpoint téléphone

Fermer complètement FitTrack puis la relancer. Vérifier que la barre paraît tomber et frapper le
sol — sans donner l'impression de sauter —, que le tremblement reste court et que la poussière ne
masque pas le logo. Activer ensuite la réduction des animations du téléphone et confirmer qu'il ne
reste que les fondus.

## Tutoriel campagne — tâches 6 à 11 (2026-08-29)

Branche `claude/tutorial-hybrid-campaign-76f6d8`. Dix commits, un par zone ou par tâche.

### Ce qui est livré

**Tâche 6, terminée.** Les cinq zones — Exercices, Progression, Connaissances, Accueil, Réglages —
puis les huit missions avancées de l'écran de séance, `TUT-WRK-05` à `TUT-WRK-12`. Le catalogue
passe de 16 à **36 missions implémentées sur 39 déclarées** ; les trois manquantes, `TUT-PRG-02`
à `04`, sont absorbées par le chapitre Programmes en un seul parcours de 18 étapes.

L'écran de séance a demandé **deux gardes nouvelles**, parce que deux cibles y dépendent d'un
réglage et non d'une donnée : la bande d'effort peut être éteinte, et la cadence n'existe pas en
« Voix uniquement ». `TutorialMissionFacts` gagne `hasEffortPrompt` et `hasRepPacing`, tous deux
exigés par l'interface — aucune mission future ne pourra les ignorer par oubli.

**Tâche 7 — mode « Voix uniquement ».** `guidancePolicy(mode)` est la seule autorité : voix,
tonalités, métronome, trois questions séparées. Ce qui part est la cadence des répétitions, ce qui
tombe *pendant* l'effort ; ce qui reste est tout ce qui tombe entre les séries.

**Tâche 8 — les côtés en base.** `WorkoutSet.unilateralSecondSideStartsAt`, une échéance absolue.
Champ optionnel non indexé : aucune version Dexie.

**Tâche 9 — contrôle manuel des côtés.** Le cycle deux côtés quitte la mémoire du composant.
`sideCycle.ts` est supprimé.

**Tâche 10 — la double annonce.** Reproduction instrumentée écrite avant tout correctif. Le code
émet exactement une `side-change` ; aucun correctif de machine n'était nécessaire.

**Tâche 11 — audit navigateur.** 390 × 844 émulé, thèmes sombre et clair, base vide.

### Ce que l'audit a trouvé, et que les tests ne pouvaient pas voir

Deux missions désignaient une commande **que personne n'avait ancrée** : le bouton « Chercher dans
les preuves » (`knowledge-search`) et le filtre par exercice de l'Historique
(`history-exercise-filter`, absent depuis le lot d'historique). Les tests de missions parlent de la
machine et jamais du DOM, donc tout était vert. À l'usage, le panneau aurait cherché sa cible six
secondes puis proposé de rouvrir l'écran où elle n'est déjà pas.

`src/features/tutorial/tutorialAnchors.test.ts` ferme la classe entière : chaque `targetId` de
mission doit se retrouver écrit littéralement dans un composant, sauf les ancres composées à
l'exécution, nommées une par une.

Mesures de l'audit, toutes conformes : sélecteur de guidage à quatre modes en deux colonnes,
150 × 48 px, aucun libellé tronqué dans les deux thèmes ; aucun débordement horizontal sur les six
routes visitées ; aucune cible tactile sous 48 px sur Réglages et Historique. Le bouton « Créer
l'exercice » est bien désactivé à l'ouverture du formulaire — ce qui confirme sur pièce pourquoi
`TUT-EXE-02` a dû gagner une étape de nom que le plan n'avait pas.

### Écarts au plan, tous dictés par un écran

1. **L'objectif hebdomadaire n'existe pas sur l'Accueil.** La tuile est un lien vers Progression ;
   `setWeeklyTrainingGoal` est piloté depuis l'Historique. La mission ne le promet pas.
2. **Le parcours d'apprentissage n'a ni étape courante ni bouton « Reprendre ».** `TUT-KNW-02`
   ouvre la première étape, ce que l'écran sait faire.
3. **Les notifications n'ont pas de bouton « enregistrer ».** Chaque bascule écrit immédiatement.
4. **`repCadence` est un `Record<CueId, boolean>`** et non un champ par `CueDefinition` : même
   exhaustivité imposée par le compilateur, pour un dixième du diff.
5. **`completeFirstSide` vit dans `workoutSets.ts`**, avec les deux mutations qui doivent effacer
   le champ.

### Deux décisions produit à valider

- **`/knowledge` a récupéré le bouton « Aide sur cette page ».** `KnowledgeScreenFrame` le retirait
  à toutes les routes du corpus. C'était juste quand l'aide était un chapitre de diaporama ; depuis
  la v3 elle est la **seule** porte d'entrée des missions contextuelles, et les deux missions
  Connaissances n'étaient joignables de nulle part. Le hub est une surface de recherche ; les
  articles restent sans aide, et le test qui le vérifiait a été déplacé sur
  `LearnProgrammingScreen`.
- **La feuille d'aide n'a plus de plafond à trois missions.** Avec quatre missions sur
  `/settings`, « Comprendre une restauration » sortait de la liste : elle existait sans qu'aucun
  écran ne sache la proposer. La feuille défile déjà.

### Ce qui reste

**La phase voix**, et elle seule. Aucune étape écrite dans ce chantier ne porte de `clipId` :
la consigne se lit
en entier dans le panneau. Les textes se relisent à l'écran avant d'être enregistrés.

### Portes

`npm run typecheck`, `npm run lint` (zéro erreur ; l'avertissement `RoutineCollection.tsx` est
préexistant), `npm run test:run` (**224 fichiers, 2350 tests**) et `npm run build` passent au
dernier commit.

### Checkpoint téléphone

1. **Réglages → guidage.** Quatre modes en deux colonnes. Choisir « Voix uniquement », puis faire
   une série de répétitions : aucun battement, aucun décompte des dernières répétitions, et le
   3-2-1 du repos toujours là.
2. **Une série unilatérale, en entier.** La coche annonce « Premier côté terminé », rien ne
   s'enregistre, le décompte de changement de côté tourne dix secondes, la coche est éteinte
   pendant ce temps, puis « Second côté ». **Verrouiller l'écran pendant la transition et revenir**
   — c'est le défaut que la tâche 8 ferme.
3. **Le changement de côté à l'oreille.** Une seule « reprise dans dix secondes ». Si elle est dite
   deux fois, le fichier `side-change-1.mp3` est en cause, pas le code.

## Inventaire écran par écran pour le tutoriel (v2.2.0)

Le document `docs/product/FEATURE-INVENTORY.md` est redevenu la source de vérité du tutoriel :

- ses **36 routes** sont toutes présentes dans le répertoire écran par écran ;
- les feuilles, confirmations, états vides, reprises après interruption et actions destructrices
  sont rattachés à leur écran d'origine ;
- chaque ligne dit ce que le geste produit et si le tutoriel le fait pratiquer, le survole ou
  l'ignore ;
- les écrans récents de la base de preuves, la documentation d'exercice, le maintien chronométré
  et le cycle unilatéral ont été ajoutés à l'inventaire fonctionnel ;
- l'état réel du tutoriel est corrigé : 10 chapitres d'orientation, 12 missions, 15 instructions
  vocales de mission et 96 identifiants/MP3 sans fichier manquant ;
- l'inventaire signale une incohérence de copie : Réglages promet encore une cadence qui s'allonge
  automatiquement avec la fatigue, alors que `src/lib/tempo.ts` donne désormais le contrôle
  manuel à l'utilisateur.

Vérification documentaire : aucune route du routeur ne manque, les tables Markdown gardent un
nombre de colonnes cohérent et le manifeste vocal correspond aux 96 fichiers. Aucun écran, aucune
donnée et aucun comportement de l'application n'ont été modifiés ; il n'y a donc pas de checkpoint
téléphone pour cette session.

Après la fusion de la passe mouvement, l'inventaire a été revalidé contre le nouveau `HEAD` : le
routeur conserve ses 36 routes et le tutoriel ses 10 chapitres, 12 missions et 15 clips de mission.
La coquille commune répertorie désormais le rideau d'ouverture, son saut pendant une séance active,
le repli sûr en cas d'échec du catalogue, les transitions avant/arrière et le comportement de
mouvement réduit. Cette actualisation reste documentaire ; son contrôle téléphone est celui déjà
demandé par la passe mouvement.

## Reprise UI Routines, Wiki et coach en séance

> Conception : `docs/design/specs/2026-08-26-routines-wiki-live-coach-ui-design.md`
> Plan : `docs/design/plans/2026-08-26-routines-wiki-live-coach-ui.md`

### Ce qui change

- **Routines** réutilise les commandes de verrouillage et de repli de la séance, masque la racine
  « Sans dossier » lorsqu'elle est vide et annonce le repli d'un dossier par un chevron. Le compteur
  a quitté le titre pour rejoindre cette barre de commandes.
- **Wiki** n'affiche plus le bouton de tutoriel sur ses pages. L'en-tête et le résumé sont alignés,
  la note « Non relu » est compacte, les affirmations sont regroupées dans une surface continue et
  les sources sont repliables. Les identifiants de traçabilité restent présents dans le DOM.
- **Coach en séance** ne transforme plus toute la carte en commande invisible : une recommandation
  de charge présente « Appliquer » et « Ignorer », tandis qu'une observation sans charge présente
  seulement « Masquer ». L'état d'application bloque les doubles actions et un échec d'écriture
  laisse la recommandation visible.
- **Réglages en séance** aligne désormais les choix isolés sur toute leur rangée : « Aucun » pour le
  repos et « Par défaut partout » pour la cadence utilisent un accent doux et ne concurrencent plus
  les actions principales.
- **Nettoyage sans perte fonctionnelle** : `wikiDocuments` et l'export mort `wikiSections` ont été
  supprimés. La recherche globale et l'écran de section sont conservés.

### Vérifié au navigateur, sur le serveur de développement

Contrôle visuel à 320 et 375 px : aucune largeur parasite sur Routines, Wiki, la carte Coach,
`RestPicker` ou `PaceSheet` ; les actions du coach se superposent proprement à 320 px ; la barre de
reprise d'une séance reste séparée des commandes de la bibliothèque. « Aucun » et « Par défaut
partout » mesurent 48 px de haut, occupent toute leur rangée et gardent 24 px entre le réglage global
et l'action de lancement. Ce contrôle sur poste ne remplace pas le checkpoint téléphone.

### CHECKPOINT MANUEL — à faire sur le téléphone

1. Avec une séance active, ouvrir Planifier → Routines et vérifier que la barre de reprise, le
   verrouillage et le repli restent faciles à toucher à une main.
2. Avec zéro routine à la racine, vérifier que « Sans dossier » n'apparaît pas ; replier ensuite un
   dossier et confirmer que son contenu et son chevron suivent le même état.
3. Ouvrir l'article « Volume » : aucun bouton `?`, sources fermées par défaut, lecture fluide hors
   ligne.
4. Dans une séance, appliquer une recommandation de charge puis masquer une observation ; vérifier
   que chaque action a un libellé explicite et que la séance reste intacte après un retour arrière.
5. Ouvrir Cadence puis Tes réglages : vérifier que « Par défaut partout » et « Aucun » ne flottent
   plus seuls à gauche et restent visuellement secondaires face à « Lancer la cadence » et
   « Terminé ».

## Reprise de lecture, après retours téléphone (v2.1.0)

Trois défauts trouvés par Hugo sur l'APK v2.0.1, tous d'affichage, aucun de comportement.

- **Carte de routine** : le libellé était collé au bord. Le retrait n'avait jamais été déclaré —
  il venait de la poignée de glissement, qui n'est plus rendue depuis que la bibliothèque est
  verrouillée par défaut. `pl-4` ne s'applique donc que sans poignée.
- **Observation coach** : « Masquer », seule, flottait à droite en texte gris dans 48 px
  transparents. Elle prend sa rangée et le trait de `--border` — un fond `secondary` disparaîtrait
  sur le bandeau `--surface-2`. Même principe que « Aucun » et « Par défaut partout ».
- **Article wiki** : neuf champs au même poids typographique rendaient un article exact illisible.
  L'affirmation mène désormais (18/32), « Interprétation pratique » passe sur `--accent-soft`, les
  quatre champs de provenance rejoignent le repli « Sources » et les énumérations en points-virgules
  deviennent des listes. Rien n'est retiré du document : la traçabilité une par une est intacte, et
  une fiche de publication — qui *est* sa provenance — est épargnée par la réorganisation.

### Vérifié au navigateur, sur le serveur de développement

Mesuré à 375 puis 320 px, sur une routine réellement créée par l'interface : retrait de 16 px
verrouillé, 44 px déverrouillé par la poignée, jamais les deux ; article « Volume » sans débordement
horizontal, replis à 48 px, 66 puces là où il y avait des murs de points-virgules.

**La carte Coach n'a pas pu être atteinte au navigateur** : elle demande une séance active dont
l'historique produit un signal. Sa géométrie est celle, déjà mesurée deux fois, de `fullWidth` —
mais c'est le checkpoint 2 ci-dessous qui la tranche.

### CHECKPOINT MANUEL — à faire sur le téléphone

1. Planifier → Routines, bibliothèque verrouillée : le nom d'une routine n'est plus collé au bord.
   Déverrouiller et vérifier que le texte ne se décale pas deux fois.
2. En séance, sur une observation sans charge : « Masquer » se lit comme un bouton, occupe sa rangée
   et ne laisse plus de vide à sa gauche.
3. Ouvrir l'article « Volume » : l'affirmation saute aux yeux, l'interprétation pratique se
   distingue, les limites se lisent en liste, et « Sources » contient bien Confiance, Population,
   Type de preuve et Sources principales.
4. Ouvrir une page « Publications majeures » : ses champs sont restés dépliés et complets.

## Lecture du wiki, deuxième passe (v2.2.0)

Retours téléphone sur la v2.1.0, tous sur la lecture.

- **Filtre de la documentation d'un exercice : supprimé.** Il filtrait au maximum six cartes
  (1 à 5 muscles par exercice ; 164 des 175 exercices en projettent quatre ou moins), alors que
  l'encadré du dessus listait déjà tous les titres. `filterArticles` et `normalise` partent avec.
- **Les sources ne sont plus des hashes.** « claim.6f33aaaeadcc53d9 · … » devient
  « 1.1 Pectoraux — 3 affirmations ». La table est projetée au build dans `claim-sources.json`
  (21 Ko, 510 identifiants, 83 libellés) plutôt que d'embarquer les 1,1 Mo de
  `evidence-index.json` + `f1-programming.json` sur la route d'un article. `kb:check-articles`
  la vérifie comme le bundle.
- **Les articles de prose ont un rythme.** Titres de section en `--accent-ink` avec filet, et la
  prose sort de la dalle grise : une fiche est une carte, de la prose est un document.

### CHECKPOINT MANUEL — à faire sur le téléphone

1. Fiche d'un exercice → Documentation : plus de champ « Filtrer ces articles », les cartes sont
   toutes là.
2. Article « Pectoraux » : titres de section colorés, paragraphes sur le fond de page, et sous
   « Sources » une vraie référence de section au lieu des identifiants.
3. Article « Volume » : la fiche de preuve garde bien sa carte grise.
4. Une page « Publications majeures » : ses champs restent dépliés et complets.

## Relecture du corpus, et ce qui a été ajouté après

> Commit testé **6f0aef0**. Portails : `kb:check-articles` à jour, `kb:test:editorial` 20/20,
> lint 0, typecheck 0, **2 236 tests**, build OK, `git diff --check` muet.

### Ce que la relecture a trouvé

Lecture des 64 articles bloc par bloc, doublée de contrôles mécaniques sur les 1 110 blocs. Quatre
familles de défauts, **aucune visible par un test existant** :

| Défaut | Nombre | Statut |
|---|---:|---|
| Renvoi vers un numéro de section du document source | 27 | corrigé, refusé par le validateur |
| Passage tronqué par l'extraction, parenthèse ouverte | 6 | tronqué proprement, contrôle d'équilibrage ajouté |
| Passage amputé de son sujet par la fusion | 1 | sujet restauré |
| Bloc que j'avais rédigé disant autre chose que sa source | 4 | corrigé |

Le plus net des quatre : la portion inférieure du trapèze était donnée comme accompagnant la
**descente** du bras, alors que la source lie sa rotation haute à l'**élévation**. Un autre bloc
citait une étude sur le multifidus du **rat** pour affirmer que les érecteurs étendent le rachis.

Les six troncatures sont **dans le corpus**, pas dans la projection : `rawContext` se terminait déjà
sur « ([Kojic et al. ». Un défaut de l'extraction E5, resté invisible tant que personne ne lisait.

Le Guide a par ailleurs retrouvé sa **carte de fiche**. Projetée en blocs indépendants, une ligne F1
perdait sa structure : « Publications majeures » devenait une suite de « Type : … » / « URL : PMC »
dont on ne pouvait plus dire à quelle publication elles appartenaient.

### Ce qui a été ajouté ensuite

**Parcours « Apprendre à programmer »** (`/knowledge/apprendre`) — 14 étapes, une phrase chacune,
qui réordonnent le Guide dans un ordre d'apprentissage : la progression d'abord, la douleur avant
les contradictions. Il n'apporte aucun contenu propre ; une étape dont l'article manque disparaît.

**La douleur, accessible.** Les pages cliniques déclaraient déjà leur portée musculaire et le
résolveur les jetait. Une fiche d'exercice montre désormais les pages cliniques des articulations
qu'elle engage — Genou et Rachis lombaire sur un squat — et le sommaire du wiki porte une entrée
dédiée. Aucun diagnostic, aucun déclenchement automatique.

### Ce que le corpus ne contient pas, et qui est maintenant écrit

Trois demandes produit n'ont **pas** de matière dans le corpus. Elles sont documentées comme telles
plutôt qu'inventées, à l'endroit exact où on irait les chercher :

- **aucune plage de répétitions par muscle.** Le corpus donne une plage globale (~30–100 % 1RM si
  l'effort suffit) et dit que la fréquence par muscle a peu d'effet indépendant ;
- **aucune liste d'exercices conseillés.** Une seule comparaison directe existe (extension du coude
  overhead) ; partout ailleurs le corpus conclut à l'absence de différence démontrée ;
- **aucun tableau pathologie → exercice.** Le corpus écrit l'inverse : la littérature ne permet pas
  de fixer une combinaison optimale universelle pour les douleurs musculosquelettiques.

### Revue humaine : rien n'a été promu

Les 64 articles restent `pending_human_review`. La relecture établit la **fidélité éditoriale** —
provenance, routage, absence d'invention — pas la validité scientifique du corpus, et pour la
plupart des articles la matière source vient de la passe d'extraction par modèle (`frag.e5*`) et non
de la passe relue par un humain (`frag.f2`/`f3`). La part relue varie de 0 % (toutes les pages
cliniques sauf deux) à 100 % (`exercise-families`, `exercise-substitutions`,
`exercise-triceps-extensions`).

## Wiki structuré, documentation des exercices et Planifier

> Conception : `docs/design/specs/2026-08-26-structured-wiki-planning-exercise-documentation-design.md`
> Plan : `docs/design/plans/2026-08-26-structured-wiki-exercise-documentation-planifier.md`
> Branche `claude/implemente-d65485`, commit testé **a744aa7**, 13 commits au-dessus de `master`.

### Le changement qui compte

La recherche ne décide plus quel contenu rattacher à un objet FitTrack. Elle en était incapable, et
c'est mesuré : le petit cross-encoder coûte 4 343 ms/question et fait tomber le rappel de 27/31 à
22/31, la précision@1 de 17/31 à 5/31. **T8 est conclue négativement, T9 annulée, CAL et TEST
restent fermés.**

Le rattachement est désormais **déclaré** dans le corpus éditorial et **vérifié au build**. Un slug
inventé, un `claimId` inconnu, un rôle musculaire affirmé hors d'un article de mouvement ou une fiche
de programmation promue relue font échouer `npm run build`.

### Ce qui est livré

| Portail | Résultat |
|---|---|
| `npm run kb:check-articles` | artefact à jour |
| `npm run kb:test:editorial` | 18 tests, 0 échec |
| `npm run lint` | code 0 |
| `npm run typecheck` | code 0 |
| `npm run test:run` | 208 fichiers, **2 223 tests**, 0 échec |
| `npm run build` | terminé, précache 7 291 Kio |
| `git diff --check` | aucune sortie |

**Couverture du corpus**, reproduite depuis la donnée et non depuis le plan : 266 contextes → 57
fusions imbriquées → **209 passages lisibles**, **408/408 affirmations citées**, **102/102 fiches de
programmation citées** dont 26 bibliographiques.

64 articles : 15 fiches musculaires, 13 familles de mouvement, 6 pages de choix d'exercice, 9 pages
cliniques, 19 pages de Guide, 2 pages de méthode.

### Ce qui reste `pending_human_review`

**Les 64 articles.** Aucun n'a été relu par un humain. Les 19 pages du Guide ne peuvent pas l'être
tant que leurs 102 lignes sources ne le sont pas une par une ; les 45 autres attendent une relecture
qui ne dépend que de toi. Le bandeau est affiché sur chaque page et aucune transformation de format
ne le retire.

### Décisions consignées

- **175 exercices du catalogue** portent une famille de mouvement décidée slug par slug. `null` — 12
  exercices : cardio, étirements, mobilité — veut dire « la notion ne s'applique pas », pas « je n'ai
  pas su ». `autre` — 33 exercices — couvre les mouvements réels que les treize noms ne recouvrent
  pas : haussements d'épaules, flexions du tronc, nuque, port de charge, mouvements olympiques.
- **Aucun script ne déduit une famille d'un nom.** Un renommage ne change aucune documentation, et un
  test l'exige.
- Le repli des dossiers et le cadenas de la bibliothèque sont **éphémères** : un redémarrage revient
  à « tout déplié, cadenas fermé ».

### Trois défauts trouvés pendant l'implémentation

1. **La fixture du plan ne pouvait pas échouer.** Sans ligne vide entre blocs, retirer une annotation
   recollait le paragraphe orphelin au précédent, qui est sourcé. La ligne vide est devenue une règle
   du format, et `UNKNOWN_ANNOTATION` refuse en plus une annotation mal orthographiée — qui se serait
   sinon affichée telle quelle dans l'application.
2. **Une portée que j'allais livrer.** `muscle-abs` déclarait `movementPatterns: ['autre']` : la fiche
   des abdominaux serait apparue sur chaque flexion de nuque et chaque haussement d'épaules.
3. **L'ordre de lecture du wiki était celui des identifiants anglais.** Trouvé en ouvrant l'app dans
   un navigateur, pas dans un test : le Guide ouvrait sur « Contradictions majeures » et plaçait
   « Méthode et langage de certitude » en huitième position. Chaque article porte désormais son rang,
   et le validateur exige qu'il soit déclaré, unique et contigu.

Deux tests d'édition étaient par ailleurs **instables** : ils attendaient le champ et non sa valeur,
donc taper s'ajoutait au nom qui arrivait juste après. Échec trois fois sur quatre, trouvé en
relançant la série. L'attente a été corrigée, pas l'assertion.

### Vérifié au navigateur, sur le serveur de dev

Fait sur poste, viewport 375 × 812. Ce n'est **pas** un checkpoint téléphone.

- Sommaire du wiki : six familles, ordre de lecture correct.
- Guide : 19 articles dans l'ordre des sections sources, bandeau « non relu », « Mettre en pratique ».
- Article de mouvement : blocs sourcés avec leurs `claimId`.
- Fiche d'un exercice du catalogue : onglets Suivi / Documentation, projection correcte.
- Bibliothèque : en-têtes de 48 px avec `aria-expanded` et compteur, aucune poignée verrouillé,
  déverrouiller déplie tout et désactive le repli, reverrouiller restaure l'état replié, un
  rechargement revient à « déplié, verrouillé » sans perdre de routine.

### CHECKPOINT MANUEL — huit parcours à faire sur le téléphone

1. Ouvrir un exercice du catalogue : Suivi et Documentation se distinguent ; la documentation charge
   hors ligne et explique le mouvement sans bloc hors sujet.
2. Créer un exercice personnel **sans** famille : les muscles sont documentés, la relation spécifique
   est annoncée absente. Ajouter ensuite une famille et vérifier que l'article relationnel apparaît.
3. Ouvrir Planifier : passer de Routines à Programmes puis Guide sans ambiguïté de vocabulaire.
4. Depuis le Guide, « Mettre en pratique » ouvre l'éditeur Program existant.
5. Replier plusieurs dossiers, vérifier que le contenu disparaît sans perdre l'ordre.
6. Déverrouiller : tous les dossiers se déplient, déplacer une routine entre dossiers, reverrouiller
   et vérifier le retour de l'état replié.
7. Force-close puis relancer : cadenas fermé, dossiers dépliés, données de routines intactes.
8. Couper le réseau et répéter les parcours Documentation et Guide.

Le contrôle visuel du tutoriel sur téléphone reste dû par ailleurs.

## Knowledge Base — phase 2 : le contrat exécutable

> Chantier **séparé de l'application**. Rien dans `src/` n'a changé, aucune dépendance n'a été
> ajoutée au `package.json` de FitTrack : le paquet a le sien, isolé.

Le corpus de recherche — quatre fichiers, 224 Ko — doit devenir une base de connaissances. La phase
précédente avait produit trois rapports d'architecture (Claude, GPT, Grok) et leur comparaison. La
phase 2 transforme cette convergence en **contrat testable**, avant d'écrire l'extracteur.

`npm --prefix fittrack-kb-contract run validate` :

| Contrôle | Résultat |
|---|---|
| Schemas JSON Schema 2020-12 | 48, tous les `$ref` résolus localement |
| Vocabulaires contrôlés | 29, 212 termes, générés depuis une source unique |
| Instances validées | 208 |
| Cas devant échouer | 20, tous rejetés **pour la raison attendue** |
| Invariants exécutables | 15 sur 15, 0 échec |

### Ce qui a demandé le plus de soin

**La provenance est calculée, pas saisie.** Les 77 fragments portent des offsets en octets — pas en
caractères, le corpus est en français — recalculés depuis les fichiers réels puis **vérifiés par
relecture du fichier aux offsets**. Écrire ces offsets à la main les aurait rendus faux à la
première coquille corrigée, sans que rien ne le signale.

**La migration du schéma clinique est prouvée, pas affirmée.** Un invariant énumère les chemins de
champs **depuis le fichier d'origine** et exige une couverture exacte : **98 chemins, 98 couverts,
0 manquant, 0 surnuméraire**. Si un champ disparaît un jour, la validation échoue.

**Les garanties critiques sont portées par les schemas.** Une pratique experte ne peut pas prendre
un statut de fait établi, une évaluation EMG ne peut pas afficher une confiance haute sur l'ampleur
d'un effet, un « risque démontré » exige une donnée épidémiologique, une politique produit a
`presentedAsMedicalTruth` constant à `false`. Ce ne sont pas des consignes de rédaction : les
fixtures invalides le vérifient, et le validateur exige que chaque rejet vienne de la contrainte
visée et non d'une coquille.

**La frontière KB / policy / runtime est structurelle.** Le schéma clinique d'origine mélangeait la
définition générale d'un axe de tolérance et l'observation datée d'une personne dans le même objet.
Séparés : `testedLoad`, `symptomDuring`, `symptomAfter24h` et `irritability` partent au runtime, et
un invariant échoue s'ils réapparaissent dans la KB.

### Ce qui reste ouvert, volontairement

- **Un conflit d'attribution bibliographique** — deux noms d'auteur pour la même méta-analyse
  apparente, sans identifiant fort partagé — reste **non fusionné et escaladé**. Le corpus ne
  permet pas de trancher, et la ressemblance de sujet ne suffit jamais.
- **Deux contradictions scientifiques** sont marquées `open_by_design` : le corpus les présente
  comme irréductibles en l'état des connaissances, les trancher serait une falsification.
- **Six contraintes ne sont pas testées** à ce stade, dont l'idempotence du pipeline complet, qui
  n'existe pas encore. Elles sont listées nommément dans `VALIDATION_REPORT.md` plutôt que
  présentées comme validées.

Le golden set est **destiné à la revue humaine, pas à la consommation par un coach**. Plusieurs
entités portent des rattachements provisoires signalés en `pending_human_review` : le corpus cite
bien plus de références que ces dix sources n'en modélisent, et dire ce qui manque vaut mieux qu'un
jeu complet en apparence.

Le corpus, les prompts, la synthèse et les rapports de phase 1 sont sur les branches orphelines
`archive/fittrack-kb-corpus` et `archive/rapport-multi-ia`. Le contrat les lit par `git show` :
la régénération marche depuis un clone qui a fetch ces branches. Le paquet lui-même ne contient
que l'empreinte et le texte des 77 fragments réellement cités.

**E1 à E4 sont amorcés** sur `master` : tableaux, axes, citations,
puis parcours déterministe de F4. Pas d'écriture dans `curated/`.

### KB phase 4 (2026-08-26) — bifurcation vers un wiki

Le coach est abandonné. Pas par renoncement : la mesure du jour dit que le corpus est une
**encyclopédie** — anatomie, biomécanique, sélection d'exercices, clinique — et qu'on
essayait d'en faire un coach, c'est-à-dire de lui faire dire ce qu'il ne contient pas.

Un wiki supprime le défaut bloquant au lieu de le résoudre : il n'a **aucune décision
d'answerability à prendre**, c'est le lecteur qui juge si la page répond. Les 28 questions
sans réponse cessent d'être une béance et redeviennent des pages qui n'existent pas.

Plan et suivi : `docs/plans/kb-phase-4-wiki.md`, dont les cases se cochent au fil des
sessions. `kb-phase-3-restitution.md` est marqué dépassé sur ses étapes 4 à 6. **C'est la
paire à relire pour reprendre** — aucun autre mécanisme de suivi n'a été inventé, ceux-là
existaient.

Matière disponible pour la v1, mesurée : **266 passages de prose distincts** (les 408
affirmations n'en font que 266 — la même duplication que celle corrigée le matin sur le
banc), ~95 500 caractères soit ~64 pages A4, **64 sections**, 2 documents, et 31 questions
déjà appariées à leurs sources. Coût API restant : **zéro**.

### Annotation exhaustive DEV (2026-08-26) — le diagnostic de `DEV-RUN.md` était faux

Les 59 questions DEV sont annotées, feuilles A et B remplies avec deux procédures distinctes
(descendante par éléments indispensables, ascendante par assemblage de preuves). Accord brut
83,1 %, kappa de Cohen 0,670, dix désaccords adjugés par une règle écrite. Détail complet dans
`fittrack-kb-contract/benchmark/e5-retrieval/selective-v1/DEV-ANNOTATION.md`.

**La couverture du corpus est de 31/59 = 52,5 %**, pour un seuil de continuation fixé à 20 %.
`DEV-RUN.md` concluait que le pipeline butait sur un corpus trop pauvre ; c'est l'inverse. Les six
échecs qu'il citait — deload, ordre biceps/dos, volume hebdomadaire, tempo excentrique, reprise
après pause, priorité des muscles — sont bien des lacunes réelles, mais elles tombent toutes dans
**un seul domaine absent : la programmation**. Le corpus couvre l'anatomie, la biomécanique, la
sélection d'exercices et le clinique, et rien d'autre. Sur les 31 questions dont la réponse était
dans le corpus, le moteur en ratait 9.

**La correction d'instrument autorisée est consommée.** `run-selective-hybrid-benchmark.mjs`
tronquait la fusion RRF à `TOP_K` sans dédupliquer par `displayContext`, alors que la recherche
livrée (`searchEvidence.ts`) le fait depuis toujours — **le banc mesurait un pipeline différent de
celui qui est livré**. 44 questions sur 59 remontaient moins de quatre contextes distincts, et 60
des 236 emplacements de candidats étaient consommés par un passage déjà affiché. Après correction,
à modèle et digest identiques : contextes distincts 2,98 → 4,00, emplacements gaspillés 60 → 0,
rappel@4 sur les répondables 22 → 26, erreurs de récupération 9 → 5, **aucune régression**. La
précision au rang 1 ne bouge pas, ce qui est le bon signe : une déduplication n'évince jamais le
premier résultat, donc une correction qui aurait déplacé le top-1 aurait été un réglage déguisé.

**Le défaut restant n'est pas la récupération, c'est le refus.** Le moteur renvoie quatre
candidats pour **28 questions sur 28** auxquelles le corpus ne peut pas répondre — 100 % de faux
positifs sur l'answerability, avant comme après. C'est la confirmation expérimentale de ce que le
protocole affirmait sans l'avoir mesuré, et c'est le travail de CAL.

Deux réserves à porter dans la session suivante. D'abord, **les deux feuilles ont été remplies par
le même annotateur** : le protocole exige deux personnes, la relecture humaine reste due, et le
52,5 % mesure pour l'instant la stabilité d'une procédure, pas une reproductibilité
inter-annotateurs. La limite est inscrite dans les fichiers eux-mêmes (`annotator.independence`).
Ensuite, cinq erreurs de récupération subsistent (Q6, Q8, Q28, Q32, Q39) et partagent un trait :
la réponse existe mais s'assemble à partir d'affirmations dispersées qui n'emploient jamais le
vocabulaire de la question. Les traiter demanderait une seconde correction, non autorisée.

**CAL et TEST n'ont été ni lus, ni exécutés, ni inspectés.**

### E5 v0.4 — checkpoint après DEV-20 (2026-08-25)

Le benchmark GPT-5 v0.3 sur DEV-100 a refusé le passage aux 207 fragments. La reprise v0.4 est
implémentée et revue jusqu'au prompt, sans lancement payant :

- HOLDOUT-30 et DEV-20 sont figés avant les changements de protocole ;
- segmentation UTF-8 et ledger de couverture déterministes ;
- DTO provider v3, avec replay v2 conservé ;
- validation claim par claim, post-traitements conservateurs et réparation ciblée ;
- prompt `e5-llm-v0.4.0` orienté couverture, protections critiques v0.3 conservées ;
- dry-run DEV-100 : 100 fragments, zéro appel API, aucune fuite GOLD, estimation `1.3648 USD` ;
- évaluation status-aware et gates gelées par étage ;
- replay v0.3 hors ligne, runner piloté par manifeste, outillage du holdout aveugle ;
- suite E5 : 169/169 ; suite complète du contrat : 281/281.

Vérification de fin de session : typecheck, `npm run test:run` (194 fichiers, 2 116 tests),
build FitTrack, `npm run check` (48 schémas, 208 instances, 15 invariants), `npm run validate:e5-gold`
(100 fragments, 186 claims, inchangée) : tout passe. Vitest exclut `fittrack-kb-contract/` — sans ça,
il avale les suites `.mjs` écrites pour `node --test` et le deploy GitHub Pages échoue. La suite
officielle du sous-paquet reste `npm run test:e5-llm` depuis `fittrack-kb-contract/`.

La tâche 8 fait entrer trois choses dans les métriques. Le dénominateur « tenté » vient désormais
de `claimAudit.attempted` : filtrer une claim dangereuse la faisait auparavant disparaître du taux
d'hallucination, donc plus le filtre marchait, meilleur paraissait le score. Une validation
partielle ne compte plus comme un rejet global. Et `benchmarkPass` prend un étage : DEV-20 aux
seuils du pilote (0,90 / 0,80, sécurité critique, zéro rejet), DEV-100 aux gates gelées plus
`knowledgeType`, `epistemicStatus`, UNRESOLVED et `cannotConclude`, HOLDOUT-30 où une métrique
N/A ne passe que si la même gate a été mesurée et franchie sur DEV-100. Un replay ne reçoit jamais
de verdict de mise en production.

La tâche 9 mesure ce que le sauvetage vaut, hors ligne et sans un dollar : les 100 réponses v0.3
déjà payées sont rejouées à travers le validateur v0.4. Même modèle, même prompt, mêmes réponses,
seule la validation change. Les **26 rejets globaux tombent à 0**, les claims GOLD appariées passent
de 111 à 129 — 18 récupérées — le rappel de 0,5968 à 0,6935 et la précision de 0,8102 à 0,8217.
Vérifié fragment par fragment : aucun n'a perdu une sœur valide. Le plan prévoyait 17 récupérations
et un rappel ~0,6882 ; l'écart est en faveur du sauvetage.

Pour que ce replay mesure v0.4 au lieu de la reproduire, `validate.mjs` a gagné un chemin
`legacyClaimSalvage` : le DTO v2 ne portait pas de ledger de couverture, donc le sauvetage claim par
claim ne lui était pas accessible. Exiger la couverture d'une réponse v0.3 inventerait un échec que
le modèle n'avait aucun moyen d'éviter.

La tâche 10 fait décider le manifeste, plus le mode. Les approbations sont vérifiées **avant** la
construction de l'adaptateur provider, pour qu'un étage non approuvé ne puisse pas échouer après
avoir déjà dépensé un appel. Aucun étage v0.4 ne peut sélectionner plus de 100 fragments : les 207
sont la sortie de production et relèvent du second plan. La tâche 11 prépare le holdout aveugle —
outillage seulement, rien n'est créé sous `golden/`, et le validateur rejette toute clé qui ne peut
venir que d'une exécution de modèle.

Deux pièges d'environnement, tous deux liés à Windows :

1. `fittrack-kb-contract/` a son propre `node_modules`. Dans un worktree neuf il faut y lancer
   `npm ci`, sinon les suites `node --test` échouent sur un `ajv` introuvable — ce qui ressemble à
   une régression du contrat alors que rien n'est cassé.
2. Les manifestes ont été gelés depuis un checkout LF. Les hashes source sont donc vérifiés après
   normalisation des fins de ligne, et `npm run check` réécrit une soixantaine de fichiers sur un
   checkout CRLF, dont `golden/e5/manifest.json` via un `designReviewHash` calculé sur les octets
   bruts. **Ces réécritures ne sont pas à indexer** : `git checkout -- fittrack-kb-contract/` après
   le check. Sans cette note, la réparation évidente serait de regénérer les manifestes, ce qui
   détruirait le gel qu'ils garantissent.

### DEV-20 exécuté (2026-08-25) — verdict **NO**

Lancé après approbation explicite du coût. 20 fragments, 21 appels (une seule réparation), zéro
retry complet, **0,2306 USD** réels. Run `run.e5-llm-v0.b0faba2cdb589c3b`, sorties locales et
non versionnées.

| Gate | Mesuré | Seuil | |
|---|---:|---:|---|
| Rejets globaux | 0 | 0 | PASS |
| Citation / source / diagnostic inventés | 0 | 0 | PASS |
| Débordement clinique, EMG→hypertrophie, biomécanique→risque | 0 | 0 | PASS |
| Précision | 0,8542 | 0,90 | **FAIL** |
| Rappel | 0,6949 | 0,80 | **FAIL** |

Ce que ça dit vraiment, mesuré sur les **mêmes** 20 fragments :

| | rejets | GOLD appariées | précision | rappel |
|---|---:|---:|---:|---:|
| v0.3 réel | 4 | 34 | 0,8718 | 0,5763 |
| replay v0.4 (mêmes réponses) | 0 | 38 | 0,8837 | 0,6441 |
| v0.4 complet (nouveau prompt) | 0 | 41 | 0,8542 | 0,6949 |

Le changement de **validation** seul est un gain net : +4 appariements, rappel +0,068, précision
+0,012, rejets 4 → 0. Le **prompt** v0.4 orienté couverture ajoute +3 appariements et +0,051 de
rappel, mais coûte 0,030 de précision. Il échange de la précision contre du rappel, et les deux
restent sous les seuils du pilote.

Il faut se rappeler que DEV-20 est délibérément le lot le plus dur : sa sélection priorise le
bucket `partial_rejection` puis les fragments par nombre d'erreurs décroissant. Ce n'est pas un
échantillon représentatif, c'est un test de résistance. Un échec ici ne dit pas que v0.4 échouerait
sur DEV-100 — il dit que le pilote refuse de payer DEV-100 sans revoir le protocole.

Coût projeté pour 207 fragments à partir du coût réel : `2,387 USD`, sous le plafond de `2,50`.

Défaut trouvé et corrigé au passage : `evaluateBenchmark` notait les 20 fragments contre les 100
annotations GOLD, transformant les 80 absents en rejets. Le premier rapport annonçait 80 rejets et
un rappel de 0,2204. Corrigé et verrouillé par un test.

### Plafond inter-annotateur mesuré (2026-08-25)

Question posée après l'échec de DEV-20 : les seuils du Design Review sont-ils seulement
atteignables ? Mesuré à coût nul, en comparant les annotateurs A et B **avec le comparateur qui
note le modèle**, sur les 30 fragments doublement annotés. Détail dans
`fittrack-kb-contract/benchmark/e5/v0/AGREEMENT-CEILING.md`, commande `npm run measure:e5-agreement`.

Il faut séparer deux familles d'axes, ce qu'on ne faisait pas :

**Axes bien définis, où les humains convergent** — `knowledgeType` 0,95, `epistemicStatus` 0,91,
rappel 0,91, fusion 0,028. Le modèle y est loin derrière : 0,69, 0,50, 0,71, 0,25. Ces écarts sont
réels et réductibles. Ce n'est pas de la subjectivité, c'est un défaut du protocole d'extraction.

**Axes où les humains ne convergent pas** — `unresolvedPreservation` à 0,57 contre un seuil de
0,90. Deux annotateurs entraînés ne s'accordent qu'une fois sur deux sur le moment où un axe doit
rester `UNRESOLVED`. Gater cet axe revient à noter du bruit, et le problème est dans la consigne
d'annotation, pas dans le modèle. Idem pour les seuils de citation (0,97 / 0,90 contre 0,845
d'accord humain) et la précision de claim (0,95 contre 0,914).

Sur les citations, le modèle **bat** les humains : 1,0000 de précision contre 0,9020 d'accord
inter-annotateur sur les 11 fragments communs. Les citations sont fermées et vérifiables — il n'a
pas à juger, il a à recopier.

L'outil porte son propre contrôle : comparée à elle-même, la GOLD arbitrée donne 1,0000 partout et
0,0000 de fusion. Les écarts du modèle ne sont donc pas des artefacts de mesure.

### DEV-100 exécuté (2026-08-25) — la mesure de référence

100 fragments, 102 appels, prompt `e5-llm-v0.4.4`, réflexion `medium`, **4,6051 USD** (sous
l'estimation de 5,97). Run `run.e5-llm-v0.fd82c1d8b1eb10fc`. Total de la session : **9,33 USD**.
186 claims de référence contre 59 sur DEV-20 — c'est enfin un chiffre sur lequel on peut
raisonner.

**6 barrières sur 22 franchies.** Ce qui passe : rappel 0,8817, conservation de la négation 1,0000,
zéro hallucination, zéro citation/source/diagnostic inventé, zéro rejet global.

**Mon hypothèse était fausse.** Je pensais DEV-20 volontairement hostile et donc pessimiste. Sur le
lot représentatif, plusieurs axes sont **pires** :

| Axe | DEV-20 | DEV-100 | Seuil |
|---|---:|---:|---:|
| précision | 0,8182 | **0,7225** | 0,95 |
| précision citation | 0,9000 | **0,7662** | 0,97 |
| rappel citation | — | **0,6705** | 0,90 |
| `knowledgeType` | 0,8302 | **0,6894** | 0,90 |
| sur-découpage | 0,1186 | **0,1720** | 0,05 |
| rappel | 0,9153 | 0,8817 | 0,85 ✅ |

DEV-20 flattait le système sur la précision et les citations. **Je dois corriger ce que j'ai
affirmé plus haut : les citations ne sont pas fiables.** Précision 0,766 et rappel 0,670 sur le lot
représentatif, contre 0,90 mesuré sur les 20 fragments.

Deux axes jamais examinés s'effondrent : `cannotConcludeFidelity` à 0,1039 pour un seuil de 0,90,
et `populationConservation` à 0,8125 pour 0,98.

**La question qui justifiait ce run a sa réponse.** `refuted` : **5 affirmations, 5 justes,
précision 1,00** — identique à DEV-20, donc ce n'était pas la chance de n = 5. Mais son rappel est
de **0,33** : la GOLD compte 15 réfutations, le modèle en trouve 5. Champ digne de confiance quand
il est renseigné, incomplet aux deux tiers.

Aucun autre statut n'atteint 0,80 de précision. `established_direction` est à 0/16.

**Sûreté** : 2 débordements cliniques tentés — « douleur définie par l'acceptabilité du patient
plutôt que par un chiffre universel » et « présenter l'excentrique comme obligatoire ». **Les deux
ont été filtrés**, aucun n'atteint la sortie. Sur 100 fragments et 227 claims tentées, la couche de
sûreté a bloqué exactement ce qu'elle devait bloquer.

### Quel champ est réellement livrable (2026-08-25)

Question posée après l'arrêt du réglage : ce corpus est-il utilisable ? Mesuré à coût nul sur les
runs déjà payés.

**Regrouper l'échelle ne sauve rien.** Réduite à trois niveaux, `epistemicStatus` plafonne à un
kappa de 0,659, sous le plancher de fiabilité de 0,70. Fondre les gradations de preuve positive
*dégrade* même le résultat (0,559) : la confusion traverse les catégories, elle n'est pas contenue
dedans.

**Mais la bonne question n'était pas celle-là.** Pour livrer, ce qui compte n'est pas « quand la
GOLD dit X, le modèle dit-il X » (le rappel par étiquette) mais **« quand le modèle dit X, a-t-il
raison »** (la précision par étiquette). Jamais calculé jusqu'ici.

| Le modèle affirme | Il a raison |
|---|---:|
| `refuted` | **5 / 5** |
| `mechanistic_only` | **2 / 2** |
| `practice_only` | 10 / 14 |
| `uncertain` | 5 / 8 |
| `absence_of_evidence` | 2 / 4 |
| `established_direction` | 1 / 4 |
| `established` | 0 / 4 |
| abstention (`null`) | 0 / 10 |

Le champ est inutilisable **en bloc**, mais `refuted` — le statut qui empêche de répéter un mythe
démonté, et donc le plus utile à l'application — est **exact chaque fois qu'il est affirmé**. Il
était à 0/7 avant le correctif v0.4.4.

Réserve : n = 5. C'est précisément ce que DEV-100 doit trancher.

**Forme du livrable qui se dessine** : texte des claims et citations fiables, `refuted` renseigné
et digne de confiance, le reste de `epistemicStatus` marqué non résolu plutôt que rempli d'une
valeur fausse une fois sur deux. C'est le principe inscrit dans le prompt — s'abstenir plutôt
qu'inventer de la certitude — appliqué au niveau du champ.

### DEV-20 v0.4.4 (2026-08-25) — `refuted` réparé, et **fin du réglage sur DEV-20**

Cible : `epistemicStatus`, le plus gros écart restant (0,43 contre 0,85) et le seul axe qu'aucune
itération n'avait visé — sa trajectoire était 0,54 → 0,49 → 0,50 → 0,40 → 0,43, immobile.

Diagnostic par matrice de confusion, deux confusions systématiques :

- **`refuted` : 0/7**, dont 5 devenaient `null`. Cause identifiée : la consigne « dans le doute,
  abstiens-toi » que j'avais ajoutée en v0.4.2 faisait s'abstenir le modèle **sur des réfutations
  explicites**. Contresens — une réfutation énoncée n'est pas une incertitude, et `refuted` est
  probablement le statut le plus utile du corpus : c'est lui qui empêche de répéter un mythe.
- **`established_direction` → `established` : 4/5**, inflation systématique d'un cran.

v0.4.4 exclut les réfutations énoncées de la consigne d'abstention et impose le cran inférieur en
cas de doute entre deux niveaux de solidité.

| Axe | v0.4.3 | v0.4.4 | Seuil |
|---|---:|---:|---:|
| **`refuted` correct** | **0/7** | **5/8** | — |
| `epistemicStatus` global | 0,4314 | **0,4902** | 0,85 |
| `knowledgeType` | 0,7547 | **0,8302** | 0,90 |
| rappel | 0,9153 | 0,9153 | 0,80 ✅ |
| précision | 0,8571 | 0,8182 | 0,90 |
| sur-fusion | 0,0159 | 0,0606 | 0,03 |

Le correctif touche sa cible avec précision, et les erreurs restantes sur `probable` ne montent
plus vers `established` mais vers le cran inférieur — la bonne direction pour la sûreté. Mais la
granularité régresse et la sur-fusion perd le seuil qu'elle venait de franchir.

**Cinquième itération, cinquième arbitrage du même type** : l'axe visé progresse, un voisin recule.
Le budget d'attention du prompt est saturé pour de bon, cette fois avec la réflexion activée.

**Décision tenue : on arrête de régler sur DEV-20.** Cinq réglages successifs sur les mêmes 59
claims de référence, c'est du sur-apprentissage d'échantillon — j'ai failli le formaliser plus tôt
avec un filtre déterministe qui touchait pile 0,9000, dessiné en regardant les échecs de ce run
précis. La suite se mesure sur les 186 claims de DEV-100, ou ne se mesure pas.

Coût : `1,1861 USD`. Total de la session : **4,72 USD**.

### DEV-20 v0.4.3 avec réflexion (2026-08-25) — 7 barrières sur 9, le plateau était faux

Le plafond annoncé après v0.4.2 — « l'itération de prompt est terminée » — était vrai **pour un
modèle sans réflexion**. GPT-5 était bridé à `reasoningEffort: minimal` depuis le début, pour une
comparaison avec Qwen3-1.7B qui n'a jamais eu lieu. Or GPT-5 n'est pas le produit : il fabrique le
corpus dont Qwen3-1.7B sera l'élève, sur téléphone. Brider le professeur au niveau de l'élève ne
rend pas l'élève meilleur.

Débridé, puis le prompt réajusté pour le nouveau régime (`e5-llm-v0.4.3`) :

| Axe | v0.4.2 sans réfl. | v0.4.2 + réfl. | **v0.4.3 + réfl.** | Seuil |
|---|---:|---:|---:|---:|
| rappel | 0,6949 | 0,8644 | **0,9153** | 0,80 ✅ |
| sur-fusion | 0,1176 | 0,1216 | **0,0159** | 0,03 ✅ |
| précision | 0,8039 | 0,6892 | **0,8571** | 0,90 |
| sur-découpage | 0,0847 | 0,2542 | **0,1017** | 0,05 |
| précision citation | 0,8824 | 0,7308 | **0,9000** | 0,97 |
| `epistemicStatus` | 0,5000 | 0,3958 | 0,4314 | 0,85 |
| `knowledgeType` | 0,7805 | 0,8400 | 0,7547 | 0,90 |
| UNRESOLVED | 0,6786 | 0,8411 | 0,7838 | 0,90 |

Deux enseignements. La réflexion **débloque le rappel** — premier seuil franchi de toute la
session, jamais approché par trois passes de prompt. Et elle a d'abord fait exploser le
sur-découpage à 0,2542, parce que la consigne « coupe aux articulations » ajoutée en v0.4.1 était
une béquille pour un modèle qui ne réfléchissait pas ; une fois qu'il réfléchit, elle le fait
tomber de l'autre côté.

v0.4.3 remplace cette règle par les cas d'échec réellement observés : ne jamais détacher d'une
affirmation les valeurs statistiques qui l'étayent (« SMD −0,210 », « p = 0,064 »), son fondement
épistémique, ni un complément contrastif qui n'a de sens que relativement. Résultat : les claims
produites passent de 74 à 63 pour 59 attendues, et **la sur-fusion tombe à 0,0159 — elle franchit
même le seuil strict de DEV-100**, contre 0,2292 au départ. Quatorze fois mieux.

**Il reste deux barrières.** La précision à 0,8571 contre 0,90 — le seul écart métrique, et il est
faible. Et un débordement clinique : sur `frag.e5f3.00025760`, le modèle tente « douleur définie
par l'acceptabilité du patient plutôt que par un chiffre universel ». **La claim est filtrée et
n'atteint pas la sortie** — le garde-fou fonctionne — mais c'est un comportement qui n'apparaît
qu'avec la réflexion, dans les deux runs qui l'activent. À ne pas expliquer par la métrique : le
modèle tente réellement quelque chose de dangereux qu'il ne tentait pas avant.

Question de fond soulevée, non tranchée : la gate compte les tentatives, pas les fuites. C'est le
choix de la tâche 8 — filtrer ne doit pas flatter le score. Mais un système qui bloque une claim
dangereuse ne devrait peut-être pas être noté comme s'il l'avait publiée. **Je ne redéfinis pas
cette gate après qu'un run l'a ratée** ; c'est un arbitrage à faire à froid.

Reste stable : 0 rejet, 0 hallucination, 0 invention, **négation 23/23**.

Coût : `1,1716 USD`. Total de la session : **3,53 USD**.

### DEV-20 v0.4.2 (2026-08-25) — verdict NO, et **le plateau est atteint pour un modèle bridé**

Troisième run payant, `run.e5-llm-v0.01e5a48c0eb7ca20`, 21 appels, **0,2347 USD**. Total dépensé
sur la session : **0,703 USD**.

| Axe | v0.4.0 | v0.4.1 | v0.4.2 | Seuil |
|---|---:|---:|---:|---:|
| UNRESOLVED preservation | 0,5060 | 0,5222 | **0,6786** | 0,90 |
| sur-résolutions réelles | 41 | 43 | **27** | sur 84 axes |
| sur-fusion | 0,2292 | 0,1400 | **0,1176** | 0,03 |
| précision | 0,8542 | 0,8600 | **0,8039** | 0,90 |
| rappel | 0,6949 | 0,7288 | **0,6949** | 0,80 |
| sur-découpage | 0,0508 | 0,0678 | **0,0847** | 0,05 |
| précision citation | 0,9412 | 1,0000 | **0,8824** | 0,97 |

La consigne « dans le doute, abstiens-toi » a fait exactement ce qu'on lui demandait : les
sur-résolutions tombent de 43 à 27, soit **−37 %**. Et elle a dégradé la précision, le rappel, le
découpage et les citations.

**C'est le troisième run de suite où le même schéma se répète** : une instruction ciblée améliore
sa cible et casse une voisine. v0.4.1 réparait la fusion et aggravait le découpage ; v0.4.2 répare
l'abstention et aggrave la précision. Le budget d'attention du prompt est saturé — ajouter une
règle en déplace une autre.

**Nommons le plafond : l'itération de prompt est terminée.** Continuer coûte 0,25 USD par passe
pour déplacer les chiffres latéralement. Ce qui reste à gagner ne viendra pas d'une consigne de
plus.

Ce qui tient, pour la troisième fois consécutive : zéro rejet global, zéro hallucination, zéro
citation, source ou diagnostic inventé, zéro débordement clinique, et **négation conservée à 100 %
sur les trois runs** (19/19, 16/16, 14/14) — après correction d'une fausse alerte de la métrique,
qui exigeait la réutilisation littérale de la particule de négation au lieu de mesurer la polarité.

### Bug de spécification : le prompt et la GOLD ne parlaient pas la même langue (2026-08-25)

Le schéma déclare quatre états de résolution — `RESOLVED`, `UNRESOLVED`, `NOT_STATED`,
`NOT_APPLICABLE` — **sans en définir aucun**. Le prompt système n'enseignait que `UNRESOLVED` ;
`NOT_STATED` n'y apparaissait *pas une seule fois*, alors que la GOLD l'emploie **256 fois**.
Le modèle suivait sa consigne et se faisait compter faux 43 fois sur un mot qu'on ne lui avait
jamais donné.

La métrique confondait deux décisions : le choix entre deux synonymes, et trancher ou s'abstenir.
Seule la seconde engage quelque chose — trancher à tort invente de la certitude, choisir l'autre
synonyme n'invente rien. Corrigé, et le prompt passe en `e5-llm-v0.4.2` avec les trois états non
résolus déclarés équivalents. Un test vérifie désormais que le prompt nomme tout état non résolu
que la GOLD emploie, pour que la spécification ne puisse plus diverger en silence.

**Ce que ça invalide.** Deux conclusions précédentes, consignées plus bas, étaient fausses :

- « la gate `unresolved` à 0,90 est incohérente, les humains ne font que 0,57 » — **faux**.
  Compté correctement, l'accord humain est de **0,9314**. La gate est légitime.
- « il faut réduire l'échelle à neuf niveaux » — **faux** aussi. Le kappa d'`epistemicStatus`
  est de 0,889 et celui de `knowledgeType` de 0,940 : deux annotateurs choisissent la même
  valeur parmi neuf. Il n'y avait rien à simplifier.

Le profil `human-ceiling` avait été construit pour retirer `unresolvedFidelity` du verdict. Il
aurait excusé un vrai défaut. Retiré, et un test interdit désormais de démoter une gate en silence.

Le modèle, mesuré correctement, est à **0,5222** sur cet axe contre un seuil de 0,90 et un plafond
humain de 0,9314 : 43 vraies sur-résolutions sur 90 axes. L'écart est réel et important — il
n'était simplement pas de 0,18.

### Ce que « se tromper » veut dire ici (2026-08-25)

Exigence rappelée par l'utilisateur : il faut un système fiable, qui **ne se trompe pas** *et*
**n'invente pas**. Pas l'un des deux. Le score de précision à 0,86 laissait penser que 14 % des
affirmations sont fausses. Vérifié affirmation par affirmation sur le run v0.4.1 — ce n'est pas le
cas.

**N'invente pas — mesuré :** 0 hallucination, 0 citation inventée, 0 source inventée, 0 diagnostic
inventé, 0 saut EMG→hypertrophie, 0 saut biomécanique→risque, 0 débordement clinique. **Négation
conservée 16/16** : jamais d'inversion de sens. Et les **7 affirmations « sans correspondance »
sont toutes verbatim dans le texte source** — l'annotateur ne les avait pas retenues, elles ne sont
pas fausses.

**Se trompe — mais sur quoi :** pas sur la véracité, sur la *comptabilité*. Où couper une phrase,
et quelle étiquette de certitude poser. Ce sont exactement les deux axes où deux annotateurs
humains divergeaient le plus (granularité 74 %, `unresolved` 63 %).

Nuance importante sur les 6 cas `refuted` mal classés : **le texte est identique dans 5 cas sur 6**,
négation comprise. Le modèle range une réfutation sous `established_direction` au lieu de
`refuted` — désaccord de convention sur l'étiquetage d'une affirmation négative, pas inversion.

**Conséquence pour l'application.** Le *texte* des claims et leurs citations sont fiables :
ancrés, verbatim, négation préservée, sans invention. Les *métadonnées* de certitude ne le sont pas
encore : `epistemicStatus` est faux une fois sur deux. Concrètement, une app peut afficher ces
claims et leurs sources, mais ne doit **pas** se servir de `epistemicStatus` pour moduler la force
de ce qu'elle affirme tant que cet axe n'est pas fiabilisé.

Une seule perte de nuance réelle : 1 qualificatif temporel sur 6 (`temporality` 0,8333).

### DEV-20 v0.4.1 (2026-08-25) — verdict **NO**, mais les correctifs sont validés

Second run payant, approuvé explicitement. `run.e5-llm-v0.b28b106e39491fc7`, prompt `e5-llm-v0.4.1`,
22 appels, **0,2377 USD**. Total dépensé sur la session : 0,47 USD.

| Axe | v0.4.0 | v0.4.1 | Seuil |
|---|---:|---:|---:|
| sur-fusion | 0,2292 | **0,1400** | 0,03 |
| `knowledgeType` | 0,6750 | **0,7857** | 0,90 |
| rappel | 0,6949 | **0,7288** | 0,80 |
| précision citation | 0,9412 | **1,0000** | 0,97 |
| précision | 0,8542 | 0,8600 | 0,90 |
| `unresolved` | 0,1304 | 0,1818 | 0,90 |
| sur-découpage | 0,0508 | **0,0678** | 0,05 |
| `epistemicStatus` | 0,5385 | **0,4878** | 0,85 |

Le correctif ciblé a fait ce qu'il devait : la sur-fusion baisse de 39 % en relatif, et le rappel
suit. Le sur-découpage monte de 0,017 — **exactement l'effet de bord annoncé avant le run** :
pousser à scinder fait scinder à tort. `epistemicStatus` recule de 0,05, non expliqué.

Zéro rejet global et toutes les gates de sûreté passent, pour la deuxième fois consécutive.

**Le plafond, nommé.** Il faut +5 appariements en n'ajoutant que 3 prédictions. Il reste 7 claims
fusionnées ; les scinder toutes parfaitement donnerait rappel 0,8475 (franchi) mais précision
0,8772 — **toujours sous 0,90**. Donc réparer la fusion à fond ne suffit pas : la précision demande
son propre levier, sur les 7 prédictions qui n'apparient rien.

### Correctifs de protocole appliqués (2026-08-25) — validés par le run ci-dessus

Trois causes concrètes identifiées puis corrigées, toutes à coût nul. **Aucune n'est validée
contre le modèle** : ça demanderait un nouveau DEV-20 payant, donc une nouvelle approbation.

**1. Le ledger de couverture causait la sur-fusion.** Les unités de couverture sont des phrases ;
la GOLD découpe *à l'intérieur* des phrases. Le prompt demandait de couvrir chaque unité, le
modèle produisait une claim par unité. Mesuré : la GOLD met 1,56 claim par unité porteuse, et 38 %
des unités porteuses en portent au moins deux. Sur les 11 cas de fusion du run, la longueur du
span du modèle vaut ≈ la somme des spans GOLD dans 8 cas — **le modèle lit le bon texte, il
l'emballe mal**. 7 cas sur 11 fusionnent à une articulation explicite : « tandis que », « mais »,
« et », « avec ».

**2. Le segmenteur coupait dans les URL.** `emitSentences` traitait tout point comme une fin de
phrase, donc `https://onlinelibrary.wiley.com/doi/10.1080/...` devenait six unités : « wiley. »,
« com/doi/10. », « 2022. ». Sur les 100 fragments GOLD : 361 unités dont 135 de moins de
25 caractères, toutes des débris d'URL. Après correctif : **192 unités dont 3**. La moitié de ce
que le ledger demandait de couvrir n'existait pas. Même classe de bug pour les décimales.

**3. Le prompt passe en `e5-llm-v0.4.1`** avec une consigne de granularité chiffrée plutôt
qu'abstraite, et un exemple tiré d'un échec réel.

Sur les seuils : `benchmarkPass` accepte un `thresholdProfile`. Le gel `design-review` reste le
défaut — baisser une cible après l'avoir ratée, c'est déplacer les poteaux. Le profil
`human-ceiling` est disponible à côté. **Appliqué au run DEV-20 réel, il fait passer les échecs de
13 à 11 et le verdict reste NO.** Assouplir ne sauve rien ; c'est la réponse à la question.

**Point de reprise : décision de périmètre.** Le plan impose l'arrêt avant DEV-100
et une nouvelle estimation plus une nouvelle approbation pour tout pilote payant supplémentaire.
La mesure du plafond inter-annotateur, faite juste après et consignée plus bas, a tranché une
partie de la question : quatre seuils sont au-dessus de l'accord humain et doivent être revus,
mais les axes où le modèle échoue le plus — `knowledgeType`, `epistemicStatus`, rappel, fusion —
sont ceux où les humains convergent. Le travail restant est donc du protocole d'extraction, pas
de l'assouplissement de seuils.

Rien d'autre n'a été lancé : ni DEV-100 v0.4, ni HOLDOUT-30, ni run 207. Estimations restantes,
à zéro appel : DEV-100 `1,3648 USD`, HOLDOUT-30 `0,4129 USD`. À savoir avant d'approuver DEV-100 :
son plafond **théorique** est `4,8648 USD`, presque le double du `maxRunCostUsd` de `2,50 USD`. Le
dry-run passe parce qu'il compare le coût attendu au plafond ; un run qui déraperait sur les tokens
de sortie serait arrêté en cours par le budget, pas avant.

## Journal des versions antérieures

Les versions **v0.1.0 à v1.3.1** ont leur journal détaché :
[`docs/journal/2026-08-29-versions-v0-v1.md`](docs/journal/2026-08-29-versions-v0-v1.md).
Rien n'y a été réécrit, et les quatre sections transverses ci-dessous — Avancement, Décisions,
Pièges, Dette — continuent de couvrir toute la durée du projet.

## Avancement

| Lot  | Titre                    | État        | Session(s)         | Checkpoint validé                              |
| ---- | ------------------------ | ----------- | ------------------ | ---------------------------------------------- |
| 0    | Bootstrap & déploiement  | ✅ terminé  | 1                  | ✅                                             |
| 1    | Design system & coquille | ✅ terminé  | 2                  | ✅                                             |
| 2    | Couche de données        | ✅ terminé  | 3                  | ✅                                             |
| 3    | Bibliothèque d'exercices | ✅ terminé  | 4                  | ✅                                             |
| 4    | Routines                 | ✅ terminé  | 5                  | ✅                                             |
| 5    | Séance en direct (cœur)  | ✅ terminé  | 6                  | ✅ **en salle**                                |
| 5bis | Schéma musculaire        | ✅ terminé  | 2026-08-11         | ✅ 2026-08-12                                  |
| 6    | Outils de séance         | ✅ terminé  | 6–7                | ✅ **en salle**                                |
| 7    | Historique & calendrier  | ✅ terminé  | 07A–07C            | ✅ 2026-08-12                                  |
| 8    | Réglages & export/import | ✅ terminé  | —                  | ✅ 2026-08-12                                  |
| 9    | PWA & installation       | ✅ terminé  | 2026-08-02         | ✅ 2026-08-12                                  |
| 10   | Android (Capacitor)      | ✅ terminé  | 2026-08-09         | ✅ 2026-08-12                                  |
| 11   | Mesures & photos         | 🟨 en cours | —                  | ⬜                                             |
| 12   | Statistiques             | ✅ terminé  | 2026-08-11, 08-22  | ✅ 2026-08-22                                  |
| 13   | Records & notifications  | ✅ terminé  | 2026-08-11, 08-22  | ✅ 2026-08-22                                  |
| 14   | Sync cloud (optionnel)   | ⬜ à faire  | —                  | ⬜                                             |
| 15   | Health Connect           | ⬜ à faire  | —                  | ⬜                                             |
| 16   | Widgets                  | ⬜ à faire  | —                  | ⬜                                             |
| 17   | Périodisation            | ✅ terminé  | 2026-08-13         | 🟨 à valider sur le téléphone                  |
| 18   | Auto-progression         | 🟨 en cours | 2026-08-11 → 08-12 | 🟨 **partiel** (carte en séance à revoir)      |
| 19   | Assistant IA             | ⬜ à faire  | —                  | ⬜                                             |
| 20   | Voix & accessibilité     | ⬜ à faire  | —                  | ⬜                                             |

Légende : ⬜ à faire · 🟨 en cours · ✅ terminé · ⏭️ sauté

> **Reprise du 2026-08-11.** Le tableau était en retard de trois lots entiers : 7, 8 et 12
> étaient marqués « à faire » alors que le code les contient. La colonne **État** est désormais
> établie à la lecture du code ; la colonne **Checkpoint** ne l'est pas et ne peut pas l'être —
> **seul l'utilisateur valide un checkpoint**, donc les lots dont le code est là mais dont la
> validation n'a jamais été consignée portent « à confirmer » plutôt qu'un ✅ deviné. C'est le
> raisonnement posé au Lot 9, appliqué cette fois sans laisser l'État en souffrance avec.

### Le lot partiel qui reste, et ce qui lui manque exactement

> **Mise à jour du 2026-08-22.** Les Lots 12 et 13 sont fermés : le rapport mensuel (RF-44) et
> l'export PNG d'un graphique pour le premier, les rappels programmables et la notification de
> record (RF-53) pour le second. Le paragraphe qui suit décrivait les trois lots partiels ; seul
> le Lot 11 est encore ouvert, et il appartient à la V2.

- **Lot 11 — Mesures & photos.** Livré : le poids de corps (`bodyMeasurements`,
  `HomeBodyWeightCard`, `resolveBodyWeightsAt` pour la tonnage au poids de corps). Manquant :
  **toute autre mesure** (tour de taille, masse grasse…) alors que `BodyMeasurement.type` est
  une chaîne libre qui les accepte déjà, et **les photos de progression** — `progressPhotos` et
  `photoBlobs` sont dans le schéma depuis le Lot 2 et **aucun code ne les écrit**.
- ~~**Lot 12 — Statistiques.**~~ **Fermé le 2026-08-22.** Livré : progression par exercice (RF-41),
  volume hebdomadaire et répartition des séries par groupe musculaire (RF-42), séances par semaine, le **1RM estimé
  (RF-46)** — formule configurable en réglages, traçable comme métrique et filtrable dans le rail
  des records — et la **carte de chaleur musculaire (RF-43)**, rendue par le schéma du Lot 5bis
  sur l'écran d'équilibre. Manquant, vérifié dans le code : le **rapport mensuel (RF-44)** —
  `PERIOD_KEYS` ne connaît que des fenêtres en semaines — et l'**export PNG d'un graphique**.
  **Les deux sont écrits** : `lib/analytics/months.ts` + `monthlyReport.ts` pour le rapport,
  `platform/chartImage.ts` pour l'image. Cf. la section v1.0.0 du [journal des versions](docs/journal/2026-08-29-versions-v0-v1.md).
- ~~**Lot 13 — Records & notifications.**~~ **Fermé le 2026-08-22.** Livré le 2026-08-11 : les records
  sont **persistés** dans `personalRecords`, écrits dans la même transaction que la série, réconciliés à chaque
  mutation, avec une page « mes records » filtrable par exercice et par type, un rail de
  progression, et une réparation manuelle idempotente. Manquant : les **rappels d'entraînement
  programmables (RF-53)** — `nativeNotifications` ne planifie que la fin du repos — et la
  **notification système quand un record tombe**, la détection restant à l'écran. **Les deux sont
  écrits** : `lib/reminders.ts` pose douze rappels d'avance sur les jours et l'heure choisis, et un
  record persisté part sur un canal muet. Cf. la section v1.0.0 du [journal des versions](docs/journal/2026-08-29-versions-v0-v1.md).

## Décisions prises en cours de route

_(Toute décision qui contredit ou complète `docs/plans/01-ARCHITECTURE.md` est consignée ici,
avec la date et la raison.)_

### 2026-08-28 — Le mouvement de l'app a désormais des sorties, et un mode réduit qui réduit

**Ce qui change.** Toute navigation passe par `startViewTransition` (`app/navigation.ts`,
`useAppNavigate`), et le sens du déplacement vit sur `<html data-nav>`. `Screen` perd ses
`animate-rise` / `animate-fade` de montage : la transition porte l'arrivée **et** le départ.

**Pourquoi.** L'app n'avait que des entrées. Aller et revenir produisaient exactement la même
animation, donc l'app ne disait jamais dans quel sens on se déplaçait — et c'était ça, la
cause de « les transitions manquent de fluidité », pas la qualité des gestes eux-mêmes.

**Le pas fait 18 px, et ça se défend.** Une largeur d’écran coûterait 400 ms pour la même
information. On navigue ici entre deux séries (règle n° 5) : il suffit de dire d'où ça vient.
L'écran qui part recule moins loin (11 px) que celui qui arrive n'avance, donc il passe dessous
au lieu d'être poussé dehors — c'est le décalage qui fait la profondeur, pas la distance.

**Le mouvement réduit ne coupe plus, il réduit.** La règle globale reste comme filet, mais
chaque geste porteur de sens a sa version : déplacement, échelle et flou partent, opacité et
couleur restent. `flash` récupère au contraire sa durée entière — une couleur qui s'efface n'a
rien de spatial. WCAG 2.3.3 demande de désactiver le mouvement *non essentiel* ; un retour
d'état n'en est pas un.

**Ce qui reste ouvert.** Les micro-interactions des moments de la séance (série validée, record,
minuteur à zéro) ne sont pas faites : elles demandent de l’état dans `WorkoutScreen`, et elles
doivent se juger à l'œil sur le téléphone, pas au relevé de géométrie. `animate-flash` reste
donc déclaré et utilisé zéro fois — son emploi naturel serait la ligne de la série suivante
quand le repos tombe à zéro.

### 2026-08-11 — Les muscles secondaires entrent dans l'instantané (`version(4)`)

**Ce qui change.** `WorkoutExercise` gagne `exerciseSecondaryMuscles?: MuscleGroup[]`, écrit par
`snapshotOf` et rattrapé par une migration `version(4)` sans `.stores()` — le champ n'est pas
indexé, donc le schéma est inchangé, exactement comme `version(2)`.

**Pourquoi ça ne rouvre pas 08B, contrairement à ce que j'avais annoncé.** 08B interdit de lire
la bibliothèque **au moment de l'affichage** pour interpréter une séance passée : c'est ainsi
que la même séance s'est retrouvée avec deux noms sur un même écran, l'export lisant
l'instantané et l'historique la bibliothèque. Écrire la bibliothèque d'aujourd'hui **une fois**
dans l'instantané fait l'inverse : à partir de là, la ligne répond d'elle-même et ne dépend plus
du catalogue. C'est le marché que `version(2)` a déjà fait et documenté.

**Le seul cas ambigu, et comment il est tranché.** Une ligne instantanée qui ne porte aucun
secondaire est soit antérieure au champ, soit celle d'un exercice qui n'en a réellement aucun.
Impossible de distinguer les deux. `resolveExerciseIdentity` ne retombe donc sur la bibliothèque
que si la ligne **n'a aucun instantané du tout** — emprunter les secondaires d'aujourd'hui à une
ligne déjà instantanée serait la réécriture que 08B interdit. Un test garde ce comportement.

**Ce qui ne change pas : les chiffres.** `muscleBalance` continue de ne compter que le muscle
principal. Son argument tient et n'est pas rouvert : « 48 » doit rester un nombre de séries
qu'on peut recompter dans l'historique, et une attribution pondérée en ferait un score qu'on ne
peut que croire. Seul le **dessin** est pondéré — il ne se lit pas, il se regarde, et un
développé couché qui laisse les triceps éteints est faux à ce qu'on a senti. D'où deux
vocabulaires distincts : `MuscleCount.sets` pour ce qui se compte, `MuscleInvolvement.value`
pour ce qui se dessine.

### 2026-08-11 — Les photos de progression sont reportées, pas abandonnées

**Décision de l'utilisateur.** Le Lot 11 est scindé : les **mesures corporelles** restent au
programme, les **photos** sortent du périmètre courant. Le verrouillage biométrique de la section
sort avec elles — il n'existe que pour les protéger.

**Pourquoi elles étaient le mauvais candidat au regroupement.** Les trois autres chantiers courts
(records persistés, 1RM estimé, mesures corporelles) sont dans du code déjà construit : les règles,
le schéma et les repositories existent, il manque du câblage. Les photos, non — elles ouvrent trois
fronts neufs à elles seules :

1. **une dépendance native** — `@capacitor/camera` n'est pas installé ; permissions Android,
   manifeste, rebuild de l'APK, et un checkpoint qui ne peut être validé **que** sur le téléphone ;
2. **du binaire en base** — blobs, vignettes, visionneuse, pression mémoire : aucun code partagé
   avec le reste du lot ;
3. **la réouverture du format d'export du Lot 8** — l'export JSON ne contient aujourd'hui aucun
   binaire. Avec des photos, soit il gonfle de plusieurs mégaoctets, soit on les exclut et l'export
   cesse d'être complet. Le roadmap avait déjà tranché (« pas dans l'export par défaut, case à
   cocher séparée »), mais c'est du travail de conception, pas une ligne de code.

**À rouvrir** quand le besoin se fait sentir, ou avec le Lot 15 (Health Connect) qui rouvre de
toute façon les permissions Android. Rien n'est à défaire d'ici là : `progressPhotos` et
`photoBlobs` restent dans le schéma, inutilisées, comme depuis le Lot 2.

### 2026-07-22 — RF-06 n'était pas complet, et le roadmap prétendait le contraire

Question posée par l'utilisateur : « des schémas d'exo comme dans Hevy, avec un mouvement + le
muscle ciblé, c'est prévu ? » Réponse après vérification : **non, et c'était un trou non consigné**.

RF-06 demande « nom, groupe musculaire principal, groupes secondaires, équipement, type de mesure,
**image ou démonstration animée** ». Le Lot 2 a écarté `free-exercise-db` pour deux bonnes raisons
(noms anglais, images en URL distante), mais **la conséquence n'a jamais été écrite** : le champ
`imageUrl` a été déclaré dans `types.ts` puis oublié — rien ne le remplit, rien ne l'affiche — et le
tableau de couverture du roadmap annonçait « M2 Exercices : complète ».

**La demande contient deux choses de coûts incomparables**, et les séparer est toute la décision :

- **Le muscle ciblé** : la donnée existe déjà sur chaque exercice depuis le Lot 2. Il ne manque
  qu'un dessin. Aucune dépendance, aucun octet réseau, et **le même composant est la carte de
  chaleur du Lot 12** (RF-43) à une prop près. → **Lot 5bis créé**, après le Lot 5.
- **L'illustration du mouvement** : 336 images à sourcer et à apparier à la main, un poids de
  bundle qui menace la règle du hors-ligne. Problème d'approvisionnement, pas de développement.
  → **Explicitement hors périmètre**, consigné comme tel dans le roadmap.

**Numéroté 5bis et non inséré par renumérotation** : décaler les Lots 6 à 20 invaliderait chaque
référence croisée déjà écrite dans ce fichier, dans les plans et dans les messages de commit. Un
numéro laid coûte moins cher qu'une renumérotation.

**Placé après le Lot 5, pas avant** : l'app ne sait toujours pas enregistrer une série. De la
finition avant la fonction, c'est le meilleur moyen d'avoir une belle app qu'on n'utilise pas.

**Révision du même jour, après enquête sur les sources.** L'utilisateur a contesté le « dessiné à
la main » — à raison, deux fois :

- **La carte musculaire ne sera pas dessinée.** `vulovix/body-muscles` (Apache-2.0, SVG,
  70+ régions, zéro dépendance) fournit une anatomie crédible. On reprend la géométrie, on la
  ré-indexe sur nos `MuscleGroup`, on la restyle avec nos jetons, et **on porte l'attribution**.
  Reprendre la géométrie et non le composant reste compatible avec le §8.
- **Les animations de mouvement ne sont pas introuvables : elles sont vendues.** Le jeu qu'on
  reconnaît dans Hevy vient de Gym Visual, ~150 $ pour nos 168 exercices. Le dataset GitHub à
  16 400 ★ qui les héberge est MIT **sur les données seulement** ; les images restent © Gym Visual.
  **Décision de l'utilisateur : pas d'achat.** Tableau complet dans `00-ROADMAP.md`.

**Et « c'est juste pour moi » ne change rien tant que le dépôt est public** — vérifié :
`"visibility": "public"`, site à HTTP 200 pour n'importe qui. Tout ce qui est commité est
redistribué, quelle que soit l'intention. C'est la règle non négociable n°3 (« le code est déployé
sur un site statique public ») appliquée aux images au lieu des clés d'API. À rouvrir seulement si
le dépôt passe en privé.

### 2026-07-21 — Lot 0

- **Le dépôt s'appelle `FITTRACK-RELOADED`, pas `fittrack`.** Le remote existait déjà
  (`hugo-burnet/FITTRACK-RELOADED`, public, vide). Conséquence :
  `base: '/FITTRACK-RELOADED/'` dans `vite.config.ts`. C'est le **seul** endroit où le nom
  apparaît. Si le dépôt est un jour renommé, c'est la seule ligne à changer — et une erreur ici
  produit une page blanche avec des 404 sur `assets/`.
- **Alias `@` : `fileURLToPath`, pas `.pathname`.** Le snippet du plan
  (`new URL('./src', import.meta.url).pathname`) est cassé sous Windows : il produit
  `/C:/Users/.../FITTRACK%20RELOADED/src` — préfixe `/C:` invalide **et** espace encodé en `%20`
  à cause de l'espace dans le nom du dossier. `fileURLToPath()` règle les deux. Nécessite
  `@types/node` (ajouté en devDep et dans `types` du tsconfig).
- **`baseUrl` supprimé du tsconfig.** TypeScript 6 le refuse (`TS5101: deprecated`). Depuis TS 5,
  `paths` se résout relativement à l'emplacement du `tsconfig.json` — `baseUrl` est inutile.
- **`src/vite-env.d.ts` ajouté** (absent du plan). Sans lui, TS 6 rejette l'import à effet de bord
  `import './index.css'` dans `main.tsx` (`TS2882`).
- **`tsconfig.node.json` non créé.** Listé dans les fichiers de la Tâche 1 mais jamais spécifié, et
  inutile ici : `vite.config.ts` est directement dans le `include` du tsconfig principal.
- **ESLint + Prettier ajoutés.** Livrable annoncé du Lot 0 dans `00-ROADMAP.md` et commande
  documentée dans `CLAUDE.md`, mais absents du plan détaillé. Config plate
  (`eslint.config.js`) avec `typescript-eslint`, `react-hooks`, `react-refresh`, et
  `@typescript-eslint/no-explicit-any: error` pour tenir la règle « pas de `any` ».
  **`npm run lint` n'est volontairement pas dans le workflow CI** : le plan ne fait bloquer le
  déploiement que sur le typecheck et les tests. Un warning de style ne doit pas empêcher une mise
  en ligne.
- **`*.tsbuildinfo` ajouté au `.gitignore`** : `tsc -b` le génère à la racine.

**Versions réellement installées** (le plan ne les fixe pas ; à connaître si un comportement
diverge de la doc) : Vite **8.1.5**, Vitest **4.1.10**, Tailwind **4.3.3** (bien la v4, plugin Vite,
sans `tailwind.config.js`), React **19.2.8**, TypeScript **6.0.3**, Node 24.18. Les versions
d'actions GitHub du plan (`checkout@v4`, `setup-node@v4`, `configure-pages@v5`,
`upload-pages-artifact@v3`, `deploy-pages@v4`) ont été gardées telles quelles — non encore
vérifiées à l'exécution.

## Pièges rencontrés / à ne pas refaire

_(Ce que la prochaine session doit savoir pour ne pas perdre du temps.)_

- **Pour les déclarations `!important`, l'ordre des couches CSS est INVERSÉ.** Une règle dans
  `@layer base` bat une règle hors couche, quelle que soit sa spécificité. Un override de
  `prefers-reduced-motion` écrit plus bas dans `index.css`, avec `!important` et un sélecteur de
  classe, était donc **silencieusement inerte** face à la règle globale sur `*` — aucune erreur,
  aucun avertissement, juste un correctif qui ne corrige rien. Le repère : à couche égale la
  spécificité tranche normalement, c'est le franchissement de couche qui s'inverse. D'où le
  regroupement de tout le mouvement réduit **dans** `@layer base`. Vérifiable en trois lignes
  dans la console : deux règles `!important` sur la même classe, une dans `@layer`, une dehors.
- **Un `var()` dans un `@keyframes` ne se résout pas pour `animation-timing-function`.** Le levé
  de l'écran d'ouverture déclarait `animation-timing-function: var(--ease-mech)` sur un palier :
  la valeur est ignorée et le segment repart en `linear`. Rien ne le signale — il faut échantillonner
  la position dans le temps pour le voir. Écrire la `cubic-bezier` en clair, et dire en commentaire
  de quel jeton elle est la copie. Plus généralement : **une animation se vérifie en la figeant.**
  `document.getAnimations().forEach(a => { a.pause(); a.currentTime = T })` puis un
  `getBoundingClientRect()` par élément donne toute la chorégraphie sans compositer une frame —
  utile quand le panneau navigateur est replié et que `screenshot` échoue.
- **`github-pages` était verrouillé sur la branche `main` alors qu'on travaille sur `master`.**
  Symptôme : le job `build` est **entièrement vert**, le job `deploy` échoue en **1 seconde avec
  0 étape exécutée**. Ce n'est ni le `base`, ni les permissions, ni les versions d'actions — c'est
  une _deployment branch policy_ sur l'environnement. Cause : Pages a été activé alors que le dépôt
  était encore vide, donc GitHub a créé l'environnement épinglé sur son nom de branche par défaut
  (`main`), qui n'existe pas ici. Correctif : Settings → Environments → `github-pages` →
  _Deployment branches and tags_ → remplacer `main` par `master`.
  **Pour les prochains projets : pousser `master` d'abord, activer Pages ensuite.**
- **Le push SSH ne marche pas sur cette machine** : `Host key verification failed`. Contourné en
  passant le remote en HTTPS (`git remote set-url origin https://github.com/hugo-burnet/FITTRACK-RELOADED.git`).
  Git Credential Manager exige une fenêtre interactive : le push ne part que si la commande est
  lancée avec `GIT_TERMINAL_PROMPT=1` et `credential.interactive=true`. Les identifiants sont
  maintenant mémorisés par GCM.
- **Le serveur de dev n'est pas sur `/`** mais sur `http://localhost:5173/FITTRACK-RELOADED/`,
  à cause du `base`. Ouvrir la racine donne une 404 — ce n'est pas un bug.
- **Après un déploiement, le navigateur sert un `index.html` périmé** pendant quelques minutes
  (cache HTTP de GitHub Pages). Constaté pendant le test de la boucle : le fetch direct renvoyait
  déjà le nouveau bundle alors que l'onglet affichait encore l'ancien. Un `Ctrl+Shift+R` ou un
  `?cachebust=1` suffit. Ce n'est pas un bug **mais c'est exactement le problème que le Lot 9
  devra traiter** : les assets sont hashés donc sûrs, c'est `index.html` qui est le point faible.
  Raison de plus pour `registerType: 'prompt'` et l'écran « nouvelle version disponible ».
- **Le chemin du projet contient un espace** (`FITTRACK RELOADED`). Tout code qui manipule des
  chemins doit passer par `fileURLToPath` / `path.join`, jamais par de la concaténation de chaînes
  ou `URL.pathname`.
- **TypeScript 6 est nettement plus strict que ce que supposent les plans** (`baseUrl` déprécié,
  imports à effet de bord typés). Si un snippet de plan écrit avant cette session ne compile pas,
  regarder d'abord de ce côté avant de le réécrire.
- **`eslint-plugin-react-hooks` v7 rejette deux motifs très présents dans les plans** :
  `setState` synchrone dans un `useEffect` (`react-hooks/set-state-in-effect`) et lecture d'un
  `ref.current` pendant le rendu (`react-hooks/refs`). Ce ne sont pas des avertissements de
  style, ce sont des `error` qui font échouer `npm run lint`. Le remplacement est toujours le
  même : ajuster l'état **pendant le rendu** derrière un `if (prop !== lastProp)`, ou passer le
  ref en `useState` s'il pilote l'affichage.
- **Un commentaire JSX `{/* … */}` ne peut pas être placé entre `{cond && (` et l'élément.**
  Dans cette position `{}` est un littéral objet, pas un commentaire, et le fichier ne compile
  plus. Le commentaire va **au-dessus** de la ligne `{cond && (`. (`// …` juste après `return (`
  est en revanche parfaitement valide.)
- **Le cache de dépendances de Vite survit mal à l'ajout d'un gros paquet.** Après le premier
  import de `react-router-dom`, la page a servi trois pré-bundles de hash `?v=` différents →
  deux copies de React → « Invalid hook call » sur `RouterProvider`. `npm ls react` confirmait
  pourtant une seule version dédupliquée. `rm -rf node_modules/.vite` puis redémarrage du
  serveur suffit. **Ne pas chercher le bug dans le code.**
- **Dans DevTools, la base s'appelle `fittrack` en version `10`, pas `1`.** Dexie multiplie le
  numéro de `version(n)` par 10 en interne pour pouvoir intercaler des versions plus tard. Ce n'est
  pas un schéma parti en vrille — ne pas « corriger » ça.
- **Réinitialiser la base ne fait pas disparaître le catalogue durablement**, et c'est voulu : le
  seed tourne à chaque démarrage, donc un simple rechargement réinstalle les 168 exercices. Seules
  les données de l'utilisateur (séances, routines, exercices personnalisés) sont réellement perdues.
  Le message de l'écran a dû être réécrit : il laissait croire que le bouton « Relancer le seed »
  était le seul chemin de retour.
- **`git commit -m` avec un here-string PowerShell casse si le message contient des guillemets
  doubles.** Le here-string est pourtant littéral côté PowerShell, mais l'exécutable `git` reparse
  ses arguments à la mode Windows et coupe le message au premier `"` : le symptôme est une pluie de
  `error: pathspec '...' did not match any file(s)`. **Écrire le message dans un fichier et faire
  `git commit -F fichier`.** C'est la seule forme fiable ici, d'autant que les messages sont en
  français avec des apostrophes typographiques.
- **PowerShell et Bash partagent le répertoire courant dans cette session.** Un `cd` fait depuis
  l'outil Bash déplace aussi l'outil PowerShell — un `npm run typecheck` a fini par échouer en
  `Missing script` parce qu'il tournait dans `node_modules/dexie/dist`. Préfixer les commandes
  longues d'un `Set-Location` sur la racine du projet.
- **`useLiveQuery` ne distingue pas « pas encore répondu » de « rien trouvé » : les deux valent
  `undefined`.** Sur un écran de détail, le résultat est un « cet exercice n'existe plus » qui
  clignote à chaque ouverture. Le contournement tient en une ligne :
  `useLiveQuery(async () => (await getExercise(id)) ?? null)` — `null` veut dire absent,
  `undefined` veut dire en cours. Même piège pour une liste : afficher l'état vide sur `undefined`
  fait clignoter « rien ne correspond » à chaque frappe.
- **Vite ignore la variable `PORT`.** Quand le port 5173 est déjà pris (une autre session Claude
  Code dans le même dossier), Vite prend 5174 tout seul, alors que l'outil de prévisualisation
  croit le serveur sur le port qu'il a attribué. Symptôme : « navigation denied or failed » sur un
  port où personne n'écoute. Lire le port réel dans les logs du serveur et naviguer dessus à la
  main. L'onglet peut être ramené de force sur le mauvais port entre deux appels — refaire la
  navigation avant chaque script.
- **Vérifier un champ, c'est vérifier le focus, pas seulement la valeur.** Le bug le plus grave du
  Lot 4 — le clavier qui se fermait à la première frappe, rendant `102,5` impossible à saisir — est
  passé sous mes vérifications parce que je posais les valeurs par `dispatchEvent` sans jamais lire
  `document.activeElement`. **Une écriture programmatique ne perd pas le focus comme un doigt.**
  Tout contrôle de saisie doit désormais assurer trois choses : la valeur, `document.activeElement`,
  et `selectionStart`.
- **Un effet React qui dépend d'un `onClose` passé en flèche inline se rejoue à chaque rendu du
  parent.** Inoffensif d'ordinaire ; destructeur quand l'effet appelle `focus()`, `scrollTo()` ou
  ouvre quelque chose. Deux bugs du Lot 4 viennent de là (`Sheet` volait le focus ; `ActionSheet`
  effaçait la feuille qu'une action venait d'ouvrir). **Un effet qui prend le focus ne doit dépendre
  que de `open`.**
- **Différer une fonctionnalité « faute de budget » sans le dire à l'utilisateur, c'est décider à sa
  place.** J'avais écarté le glisser-déposer des routines dans les dossiers ; c'est le deuxième
  retour qu'il a fait. Annoncer les renoncements **dans le résumé de fin de lot**, pas seulement
  dans le plan qu'il ne relira pas.
- **Un contournement écrit en silence est un bug qu'on s'interdit de voir.** En écrivant les modèles
  de routine, j'ai constaté que `RoutineSet` n'avait pas de champ de durée — et j'ai **évité les
  exercices chronométrés dans les modèles** au lieu de le signaler. Le trou est resté entier
  jusqu'à ce que l'utilisateur le trouve. Quand une donnée manque pour écrire un jeu de test,
  **c'est le schéma qu'il faut interroger, pas le jeu de test qu'il faut rétrécir.**
- **Un champ déclaré et lu par personne ne se voit qu'à l'usage.** `measurementType` existait depuis
  le Lot 2 sur 168 exercices et n'était consommé par **aucun** écran hors du formulaire de création.
  Rien ne le signale : ni le typecheck, ni les tests, ni le lint. Contrôle à faire en fin de lot —
  **lister les champs du §4 de l'architecture qu'aucun écran ne lit encore**, et dire lesquels sont
  en attente d'un lot et lesquels sont oubliés.
- **Le panneau navigateur ne compose jamais : `requestAnimationFrame` ne se déclenche pas et les
  transitions CSS ne démarrent pas.** Mesuré au Lot 4 : `0 frame en 1 s`,
  `document.visibilityState === 'hidden'`. Conséquences vues en vrai — une boucle `rAF` (défilement
  automatique du drag) ne tourne pas du tout, et un `getComputedStyle` sur une propriété en
  transition renvoie la valeur **de départ**, indéfiniment. Les deux ressemblent trait pour trait à
  des bugs du code. **Avant de « corriger » quoi que ce soit qui dépende d'une frame, vérifier
  `visibilityState` et compter les frames.** Pour trancher sur une transition :
  `element.style.transition = 'none'` puis relire — si la valeur saute, le CSS était juste.
  Corollaire de méthode : ce qui ne peut pas être exercé dans ce panneau doit être extrait en
  fonction pure et testé unitairement, sinon c'est la seule partie du code sans aucune vérification.
- **Les feuilles empilées ne se démontent pas ici** (le `transitionend` de `Sheet` n'arrive jamais).
  `document.querySelector('[role=dialog]')` renvoie donc la feuille **précédente**, encore dans le
  DOM. Viser `document.querySelectorAll('[role=dialog]')` **et prendre la dernière**.
- **`textContent` ignore `text-transform`.** Les libellés en `.label-xs` s'affichent en capitales
  mais `textContent` rend « reps », pas « REPS » (`innerText`, lui, rend les capitales). Un sélecteur
  de test qui cherche « REPS » ne trouve rien.
- **Les captures d'écran du panneau navigateur ont encore expiré** (30 s, systématiquement), alors
  que `javascript_tool` répondait normalement. Contournement confirmé et suffisant : tout vérifier
  par JS — `element.click()` pour les interactions, `getBoundingClientRect()` pour la mise en page,
  et un calcul de ratio de contraste maison sur les styles calculés. Ouvrir un onglet neuf **n'a pas
  suffi** cette fois.
- **Mesurer la boîte d'un bouton, ce n'est pas mesurer son libellé.** « Démarrer la séance »
  passait à la ligne **dans** son bouton ; j'avais relevé `168x56` et conclu que tout allait. La
  hauteur valait 56 parce que `min-h-14` vaut 56, et le texte cassait à l'intérieur. Le contrôle
  qui manquait tient en trois lignes — un `Range` sur le nœud de texte, `getClientRects().length`
  > 1 — et il doit accompagner tout relevé de cible tactile. C'est la même famille d'erreur que
  > « vérifier la valeur d'un champ sans vérifier son focus ».
- **Ne jamais inventer un composant visuel : la charte est figée depuis le Lot 1.** Le Lot 5 a
  posé une boîte en pointillés pour « Ajouter un exercice ». `border-dashed` n'existait **nulle
  part ailleurs** dans le dépôt — toutes les surfaces d'ici sont pleines et sans bordure, donc un
  contour vide se lit comme un emplacement à remplir. Deux « + » cohabitaient sur le même écran
  en deux langues. Réflexe à prendre : **avant de dessiner une commande, chercher le geste qui
  fait déjà ce travail ailleurs** (`grep` sur la classe ou l'icône) et le nommer dans `ui/` s'il
  est dupliqué. Deux motifs l'étaient déjà — `AddRow` et `HeaderAction` — et c'est justement
  parce qu'ils n'avaient pas de nom que j'en ai inventé un troisième.
- **Avant d'ajouter une commande, chercher celle qui fait déjà ce travail.** Trois défauts du
  retour sur les boutons sont le même : un contrôle en double. « Terminé » doublait la flèche de
  l'en-tête ; « Reprendre » doublait la barre de reprise ; « Partir d'une routine » doublait
  l'onglet Routines. Aucun n'a été ajouté par étourderie — chacun avait une bonne raison **au
  moment où il a été écrit**, et la raison a disparu ensuite sans que le bouton parte avec elle.
  Contrôle à faire en fin de lot : **lister les commandes qui appellent la même chose**, et
  vérifier que chaque écran n'a qu'une action primaire.
- **Une règle de charte survit à la raison qui l'a fait naître.** « La vraie sortie vit dans la
  zone du pouce » (Lot 3) a été écrite quand une fiche n'avait pour seule sortie qu'un mot en haut
  à droite. La flèche du Lot 4 a supprimé le problème ; la règle est restée et a continué de
  produire des boutons « Terminé » pendant deux lots. **Quand un lot corrige la cause, relire les
  règles que cette cause avait justifiées.**
- **Un relevé n'est pas une commande, et l'inverse non plus.** Le chronomètre de la séance
  occupait le coin haut-droit — la place que tous les autres écrans réservent à une icône
  d'action — et cachait le seul accès à « Renommer » et « Notes ». En prime il était en
  `--accent-ink`, qui dans cette charte veut dire _engagé_ : une horloge en vert accent se lit
  comme un témoin d'état. Les relevés descendent **au-dessus de la liste qu'ils comptent**
  (règle posée au Lot 4) ; le coin haut-droit est aux actions.
- **Du code que rien n'exerce n'est pas du code qui marche.** Les quatre défauts du Lot 5 étaient
  dans du code écrit et _testé_ au Lot 2 — `getLastPerformance` avait sept tests verts. Ils
  décrivaient tous un historique **déjà clos** ; aucun ne mettait une séance en cours et un passé
  dans la même base, parce qu'aucun écran ne savait encore créer une séance en cours. **Quand un
  lot livre les premières écritures d'une table, relire les lectures qui existaient déjà** — leurs
  tests prouvent ce qu'on savait faire, pas ce qui va arriver.
- **Un jeton de charte réservé à un usage futur est un jeton dont personne n'a vérifié l'usage.**
  Le Lot 1 gardait `--text-3` pour « la valeur précédente du Lot 5 », en la supposant décorative.
  Arrivé au Lot 5, cette valeur s'est révélée être **ce que la coche enregistre** — le nombre le
  plus lourd de conséquence de l'écran — et `--text-3` y mesurait 2,02:1. Un usage écrit à l'avance
  décrit une intention, pas un besoin ; le besoin ne se connaît qu'à l'écran.
- **Un emplacement d'affichage qui porte deux contrats finit par mentir sur l'un des deux.** Le
  fantôme du champ de saisie veut dire partout « la coche enregistre ça ». Sur une série prescrite
  en fourchette il voulait dire « regarde, mais la coche ne prend rien » — même position, même
  gris, deux sens. Le défaut **signalé** était la largeur : « 8 – 12 » ne rentre pas dans une case
  taillée pour deux chiffres, et « 12 – 20 » se faisait couper **des deux côtés**, donc se lisait
  « 2 – 2 ». Le défaut **trouvé en creusant** était une perte de données : la coche validait une
  série sans aucune répétition. Élargir la case aurait réparé le symptôme signalé et laissé
  l'autre en place. Réflexe à prendre : **quand un texte ne rentre pas dans une case, se demander
  d'abord s'il a le droit d'y être** — un débordement est souvent la première manifestation
  visible d'un emplacement qui sert à deux choses. Et : la largeur d'un texte dépend de la police
  système du téléphone, jamais de celle mesurée ici — 54 px sur 56 « passait » sur cet écran et
  nulle part ailleurs.
- **Écrire en base par IndexedDB brut ne réveille pas `useLiveQuery`.** Dexie n'émet ses événements
  que sur ses propres écritures : une table modifiée par `indexedDB.open()` direct laisse l'écran
  afficher l'ancien état indéfiniment, ce qui ressemble exactement à un bug de requête. Recharger
  la page après un montage de données fabriqué à la main — ou passer par les repositories.
- **Le panneau navigateur intégré perd parfois l'injection d'événements** (clics et captures
  d'écran expirent) alors que l'exécution JavaScript continue de répondre. Le contournement :
  vérifier par `javascript_tool` (styles calculés, rectangles, clics `element.click()`), et
  ouvrir un onglet neuf pour retrouver les captures. Les messages de console peuvent aussi être
  ceux de la session précédente — toujours confirmer l'état réel du DOM avant de diagnostiquer.
- **Le balayage de contraste parcourt les nœuds de texte, et un filet n'en est pas un.** « 934
  nœuds de texte, zéro échec » au Lot 4 : le chiffre est exact et il ne prouve rien sur le filet de
  superset, qui mesurait 1,29:1 à ce moment-là. Le balayage n'a pas échoué, **il n'a pas regardé**
  — et un rapport qui annonce un dénombrement rassure d'autant plus qu'il est précis. WCAG 1.4.11
  couvre les éléments **non textuels** porteurs d'information (filets, jauges, pastilles d'état,
  bordures qui distinguent), tous invisibles à un parcours de `Node.TEXT_NODE`. Deux réflexes :
  **dire ce que le balayage n'a pas couvert** quand on en annonce le résultat, et étendre le
  parcours aux éléments dont la couleur _est_ l'information — sinon le prochain filet repassera au
  travers. Le repère qui trie : si l'élément porte du texte par-dessus, c'est un aplat et seul son
  `--*-fg` compte ; s'il ne porte rien, c'est de l'encre et il se mesure contre la surface.
- **Dans une colonne flex, `overflow-hidden` change la taille minimale automatique.** La recherche
  d'exercices coupait le regroupement alphabétique et rendait alors directement une `Card`
  (`overflow-hidden`) comme enfant du corps flex de `Screen`. Cette carte pouvait rétrécir à 0 px :
  ses 139 lignes existaient dans le DOM, mais le conteneur ne voyait que 160 px de contenu et
  n'avait donc rien à faire défiler. Un wrapper `shrink-0` sur la liste filtrée restaure sa hauteur
  intrinsèque ; vérifié en navigateur mobile avec 9 846 px de course et un `scrollTop` passé de 0
  à 600. Le `h-full` de la coquille transmettait seulement la contrainte, il n'était pas la cause.

## Dette technique assumée

_(Raccourcis pris volontairement, à rembourser plus tard.)_

- **Assumée le 2026-08-10 — l'accueil lit tout l'historique pour afficher trois lignes.**
  `getHomeDashboard` charge toutes les séances terminées et relit les trois tables de routines
  en entier, à chaque écriture dans l'une des six tables observées. Mesurée à ~71 ms sur
  2 000 séances (`npm run bench:home`), dont 57 % pour la seule lecture non bornée. **Sous le
  seuil d'action** : le remboursement demande l'index `[status+startedAt]`, un parcours arrière
  avec arrêt anticipé et une migration `version(4)`. À rouvrir si le banc dépasse la centaine de
  millisecondes **sur un vrai téléphone**, pas sur `fake-indexeddb`.

- **Remboursée le 2026-07-27 — les deux repositories dépassaient la règle des ~300 lignes.**
  `workouts.ts` avait atteint 682 lignes et `routines.ts` 504 avant la reprise de l’édition
  rétroactive. Ils sont désormais des façades de 32 et 39 lignes. Cycle de vie, exercices, séries
  et lectures composées vivent dans huit modules spécialisés ; le plus long, `workoutSets.ts`,
  fait 266 lignes. Les imports publics, les tests et les transactions Dexie sont restés inchangés.

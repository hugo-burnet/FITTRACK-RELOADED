# Journal de session — 2026

> Archive extraite de PROGRESS.md le 2026-08-30. Le journal vivant est PROGRESS.md.

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

> Conception : `docs/superpowers/specs/2026-08-26-routines-wiki-live-coach-ui-design.md`
> Plan : `docs/superpowers/plans/2026-08-26-routines-wiki-live-coach-ui.md`

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

> Conception : `docs/superpowers/specs/2026-08-26-structured-wiki-planning-exercise-documentation-design.md`
> Plan : `docs/superpowers/plans/2026-08-26-structured-wiki-exercise-documentation-planifier.md`
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
sessions. `kb-phase-3-restitution.md` est marqué dépassé sur ses étapes 4 à 6, et
`kb-prompt-de-reprise.md` porte en tête la mise à jour du diagnostic. **C'est le trio à
relire pour reprendre** — aucun autre mécanisme de suivi n'a été inventé, ceux-là
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

## v1.3.1 — livrée et publiée

| Version | Contenu | APK |
|---|---|---|
| **v1.3.1** (`b43f5d6`) | Le coach lit la charge de travail, jamais la dégressive ni zéro | `FitTrack-v1.3.1.apk`, 9,5 Mo |

Corrective : rien de nouveau à l'écran, rien de retiré. Signée avec la vraie clé — le nom du fichier
le dit, un APK d'essai s'appellerait `FitTrack-test-…` — donc elle met à jour une installation
existante. `versionCode` 97, au-dessus du 94 de la v1.3.0. Publiée depuis l'onglet Actions
(`workflow_dispatch` avec `release_tag`, run #97) : le tag est posé par `gh release create --target`
sur le commit qui venait de passer lint, typecheck et les **2 116 tests**, jamais sur une tête de
branche qui aurait bougé entre-temps.

⚠️ **Migration Dexie `version(11)`** — les lignes du journal du coach déjà écrites à
`nextLoadKg: 0` perdent leur chiffre et gardent leur constat. Rien d'autre n'est touché :
`range_missed` uniquement, et zéro uniquement. `backfillBackupTables` fait le même geste sur un
fichier de sauvegarde antérieur. Installer par-dessus la v1.3.0, sans désinstaller.

**Checkpoint téléphone.** Terminer une séance avec une **dégressive** en dernière série sur un
exercice dont le bas de fourchette a été manqué : la carte Coach doit annoncer la charge du **haut**
(celle des séries de travail), un incrément en dessous — jamais celle de la dégressive, jamais
« 0 kg ». Vérifier aussi qu'aucun objectif en attente ne propose 0 kg au démarrage de la séance
suivante : c'est ce que la migration efface.

## Le coach lisait la dégressive comme charge de travail

Relevé sur la séance **PUSH A du 23/08/2026**, écran de fin. Élévations latérales (poulie) faites
à 5 kg × 15, 5 kg × 11 (échec), puis dégressive 3,5 kg × 15 — et la carte annonçait :

> Élévations latérales (poulie) — **0 kg**
> 3,5 → 0 kg car le bas de fourchette (12) a été manqué 2 séances de suite (descendu à 11).

Deux défauts empilés sur un seul écran, et le second n'était visible que parce que le premier
avait eu lieu :

1. **`floorMiss` lisait `completedWorkingSets`**, c'est-à-dire toutes les séries hors échauffement.
   La dégressive terminait la ligne, donc c'est *sa* charge qui devenait la charge de référence de
   la séance : 3,5 kg pour un exercice travaillé à 5. `rangePartitionSignal` et
   `intraSessionDropSignal` passaient déjà par `progressionSets` — dont le commentaire dit
   exactement pourquoi (« a drop set […] is lighter *on purpose* ») ; la règle d'allègement était
   la seule des trois à ne pas l'appeler. Elle l'appelle maintenant.
2. **Un pas de 2,5 kg (défaut poulie) sous 3,5 kg retombe sur la grille à zéro.** `previousLoad`
   plafonne à 0 — ce qui est juste pour un deload de bloc, où zéro est une charge —, mais un
   *objectif* à 0 kg n'en est pas un : la carte affichait « 0 » en gros chiffre, et un doigt dessus
   l'écrivait sur les séries restantes. `rangeMissedSignal` garde désormais le constat et
   n'attache plus de proposition quand elle ne charge rien (`coach.range_missed_constat`).

Avec le correctif, la même séance donne **5 → 2,5 kg** : la charge du haut, un incrément en
dessous. La coupe reste franche parce que le pas par défaut d'une poulie est de 2,5 kg ; c'est
réglable par exercice (`loadIncrementKg`), et ce n'est pas au moteur d'en décider.

**Migration `version(11)`** — le journal avait déjà enregistré des lignes `range_missed` à
`nextLoadKg: 0`, en attente et applicables. Elles perdent leur chiffre et gardent leur constat.
Restreinte à `range_missed` : sur machine assistée, alléger veut dire *ajouter* du poids (jamais
zéro), et un `range_ceiling_reached` à 0 kg y est une vraie étape — l'assistance qui disparaît.
Même geste côté `backfillBackupTables`, pour un fichier de sauvegarde antérieur.

**Ce qui n'a pas été touché, et pourquoi.** Sur la même séance, Pec fly (5 kg : 12, 10, 13 reps)
affiche « Baisse de reps observée : 12 puis 10 (−2) ». Le chiffre est exact et la règle fait ce
qu'elle décrit ; ce qu'elle ignore, c'est que la troisième série est remontée à 13, au-dessus de la
première. Un creux rattrapé dans la séance n'est pas une chute — mais changer ça change la
sémantique de `intra_session_drop`, pas un défaut de lecture. Laissé en question ouverte.

## v1.3.0 — livrée et publiée

| Version | Contenu | APK |
|---|---|---|
| **v1.3.0** (`2bdade3`) | Revue du tutoriel : écran par étape, surbrillance ciblée, chapitre des blocs | `FitTrack-v1.3.0.apk`, 9,5 Mo |

Signée avec la vraie clé — le nom du fichier le dit — donc elle met à jour une installation
existante. Le workflow `android.yml` l'a construite depuis le tag `v1.3.0`, en rejouant lint,
typecheck et les **2 107 tests** avant Gradle. Les trois runs sont verts : APK depuis le tag, APK
depuis `master`, déploiement Pages. **152 entrées précachées** — le nouveau clip part avec le reste,
donc le chapitre des blocs parle hors ligne comme les neuf autres.

Aucun changement de schéma. Installer par-dessus la v1.2.0, sans désinstaller, pour conserver les
données locales. `fittrack:tutorial:v2` gagne un champ (`missionRoutineId`) : une progression
écrite avant lui est complétée au chargement, jamais jetée — une mission en cours ne recommence pas
pour cause de mise à jour.

**Ce que cette version n'a pas encore prouvé :** l'aspect du cadre à l'écran. Le panneau du
navigateur n'était pas affiché pendant la session, donc `requestAnimationFrame` était gelé et rien
ne se mesurait vraiment ; la géométrie ci-dessous a été relevée en remplaçant l'horloge
d'animation. Le contrôle sur téléphone reste dû, et avec lui la première écoute du clip des blocs.

## Revue du tutoriel — ce qu'il couvrait mal, et pourquoi

Quatre défauts remontés du téléphone, tous reproduits avant correction.

### 1. Cinq étapes sur douze parlaient d'un écran qu'elles n'ouvraient jamais

Une mission ne connaissait qu'un `routePrefix`. Les étapes de composition — ajouter un exercice,
ajouter une série, régler la cible, régler le repos, démarrer — visent des ancres qui n'existent
que dans `/routines/:id`. Depuis la **liste** `/routines`, le préfixe correspondait déjà : rien ne
naviguait, aucune cible n'était trouvée, et le coach affichait « Ajoute au moins un exercice à
cette routine » devant une liste qui ne désigne aucune routine. La mission ne pouvait alors plus
avancer du tout — aucun geste disponible sur cet écran n'émettait l'événement attendu.

`tutorialScreens.ts` remplace le préfixe par un **écran par étape** : où emmener l'utilisateur
(`pathForScreen`) et comment savoir qu'il y est (`screenHolds`). La routine concernée — la dernière
ouverte — est retenue dans `missionRoutineId`, lue dans l'URL et non dans les événements : une
mission lancée depuis l'aide de la page n'en a émis aucun, et c'était précisément le cas qui
partait dans le vide.

`screenHolds` est **tolérant vers le bas** : `/routines/:id/add` compte comme l'éditeur, parce que
c'est l'étape elle-même qui vient d'ouvrir le sélecteur d'exercices. Le renvoyer à l'éditeur
casserait le geste demandé.

### 2. Le coach parlait devant des écrans qui ne montraient pas ça

Il se montait dès qu'une mission était active, où que l'on soit. Il ne se rend plus que sur l'écran
de son étape (`onStepScreen`), donc il ne parle plus non plus ailleurs.

Deux étapes n'ont pas le droit d'être atteintes à la place de l'utilisateur (`reach: 'wait'`) : le
bilan de séance, qui s'ouvre parce qu'il a fini, et l'export de sauvegarde — qui s'enchaîne après
`workout-saved` et **téléportait dans les Réglages quelqu'un qui venait d'enregistrer sa première
séance**. La mission reste armée, muette, et s'allume quand il arrive dans les Réglages de
lui-même.

L'aide de la page ne propose plus non plus une mission injouable depuis ici : `isMissionReachable`
écarte celle dont on ne sait pas rejoindre la première étape.

### 3. Le cadre de la visite couvrait 83 % de l'écran

La visite ne savait viser que `data-tutorial-header` ou `data-tutorial-content`. Mesuré à
375 × 812 : le contenu fait **375 × 671**, et le panneau du tutoriel se pose par-dessus. Un cadre
qui entoure tout n'entoure rien.

Chaque chapitre déclare désormais ce qu'il encadre : un onglet de la barre du bas
(`data-tutorial-nav`, une ancre qui existait déjà et que personne n'interrogeait), une commande
nommée (`data-tutorial-id`, le vocabulaire des missions), ou **rien** — on assombrit alors sans
encadrer. Mesuré après : 87 × 62 sur l'onglet, 60 × 60 sur le « + » des Blocs. Les deux ancres
mortes de `Screen` sont retirées.

Les chapitres Séance et Coach gardent `route: '/'` — leur écran n'existe pas tant qu'aucune séance
ne tourne, et la visite se fait avant la première. Ils le **disent** maintenant, au lieu de laisser
croire que l'accueil derrière est le sujet.

### 4. La mesure ne se reprenait jamais

Les deux couches mesuraient leur cible dans **une seule** `requestAnimationFrame`. Une ancre montée
ensuite — route paresseuse, lecture Dexie, carte dépliée — n'était plus jamais encadrée.
`useTutorialAnchor` remplace les deux : `MutationObserver` pour l'apparition et la disparition,
`ResizeObserver` pour le changement de taille, défilement et redimensionnement pour le reste — une
seule mesure par image, et l'état n'est écrit que si la boîte a bougé.

### Les blocs, enfin montrés

`tutorialTopicForPath('/programs')` renvoyait `routines` : l'aide de l'écran Blocs jouait le
chapitre des routines. Or ce chapitre **annonce les blocs dans sa seconde phrase**, devant la liste
des routines — la voix décrivait un écran que personne n'avait vu. Les blocs ont leur topic, leur
chapitre `tutorial-programs-1` (12,3 s, une prise) et leur place dans la visite, juste après les
routines dont ils prolongent la phrase.

**96 clips pour 96 identifiants.** `@breezystack/lamejs` manquait de `node_modules` — le générateur
ne démarre pas sans lui ; `npm i` avant la prochaine génération.

**Ce que les tests ne couvrent pas :** l'aspect du cadre à l'écran. Le panneau du navigateur n'était
pas affiché pendant la session, donc `requestAnimationFrame` était gelé et rien ne se mesurait
réellement. La géométrie ci-dessus a été relevée en remplaçant l'horloge d'animation ; la
**vérification visuelle sur téléphone reste à faire**, et avec elle l'écoute du nouveau clip.

### Le piège que la correction a ouvert : le retour en arrière

Donner un écran à chaque étape crée un chemin de retour. `TUT-ACT-01` vise le bouton de création,
**sur la liste**, mais s'achève sur `routine-opened` — dans l'éditeur, une fois la routine lue en
base, plusieurs images après l'arrivée. Entre les deux, l'étape courante désigne encore la liste :
l'effet y renvoyait quelqu'un qui venait d'ouvrir exactement ce qu'on lui demandait d'ouvrir.

`movesForward` : un écran plus profond que la destination compte comme l'ayant dépassée, et le
tutoriel ne va qu'en avant. Un déplacement **demandé** — une mission choisie dans l'aide de la
page — est traité dans `start`, pas dans l'effet : celui-là a le droit de revenir en arrière,
puisque l'utilisateur vient de le demander.

### Checkpoint téléphone demandé

> Depuis la liste des routines, lancer « Ajouter un exercice » depuis l'aide : l'app ouvre la bonne
> routine, le cadre se pose sur le bouton et pas ailleurs. Terminer une séance : on n'est pas
> éjecté dans les Réglages. Refaire la visite complète : le chapitre Blocs ouvre l'écran des blocs,
> et Séance/Coach annoncent qu'ils ne peuvent pas être montrés.

## v1.1.0 et v1.2.0 — livrées et publiées avant elle

Deux versions taguées dans la même session, chacune après ses quatre portes.

| Version | Contenu | APK |
|---|---|---|
| **v1.1.0** (`b182fe4`) | Chrono de série chronométrée · exercices unilatéraux à deux côtés | `FitTrack-v1.1.0.apk`, 7,5 Mo |
| **v1.2.0** (`e172294`) | 95 clips pour 95 identifiants — repères du chrono, changement de côté, consignes des missions | `FitTrack-v1.2.0.apk`, 9,3 Mo |

Les deux APK s'appellent `FitTrack-…` et non `FitTrack-test-…` : **signés avec la vraie clé**, donc
ils mettent à jour une installation existante. Le workflow `android.yml` les a construits depuis le
tag, en rejouant lint, typecheck et la suite complète avant Gradle.

Les 1,8 Mo gagnés entre les deux versions sont les 52 nouveaux MP3. Ils partent dans le service
worker — **151 entrées précachées** — donc la voix fonctionne hors ligne, comme le reste.

### Les trois checkpoints téléphone qui restent

Aucun des trois n'est couvert par les tests, et c'est assumé : ils demandent un vrai corps, une
vraie salle et un vrai téléphone.

1. **Un vrai gainage.** Le chrono part après dix secondes, annonce un repère toutes les cinq, et la
   coche écrit la durée sans qu'on tape quoi que ce soit.
2. **Une série unilatérale complète**, dont une fois **en Silence** — c'est le seul mode où le
   relevé à l'écran est tout ce qui dit que la série n'est pas finie.
3. **Une séance active de plus de 12 h**, jamais déclenchée manuellement depuis son écriture :
   la provoquer aurait demandé d'injecter une séance artificiellement vieillie, donc de fabriquer
   une restauration destructive pour la tester.

**Un réglage à surveiller au premier essai :** `HOLD_RELEASE_SECONDS` vaut 2, sur estimation et non
sur mesure. Si les durées de gainage enregistrées paraissent systématiquement trop courtes ou trop
longues, c'est cette constante — une ligne, dans `features/workout/holdDuration.ts`.

## La voix — le manifeste est complet

**95 identifiants, 95 MP3.** Trois familles enregistrées dans la foulée : les 36 repères du chrono,
la phrase du changement de côté, et les 15 consignes des missions guidées.

### Ce que les enregistrements ont appris

**« Cinq » se coupait en deux.** Son /k/ final est une fermeture d'environ 120 ms suivie d'une
explosion de 80 ms, et le détecteur de blocs, calé à 50 ms, y voyait deux mots — quatre prises de
suite refusées pour « 5 blocs, 4 attendus ». Rien n'était cassé pour autant : les deux groupes
historiques disent « Trois… Deux… Un », dont aucun mot ne finit par une occlusive, et les 38 lignes
seules ne passent jamais par ce découpage. `gapMs` est désormais réglable par groupe, absent par
défaut, donc les groupes d'origine se découpent à l'identique.

**Le plafond d'inversions venait des décomptes.** Calibré sur des mots d'une syllabe, il refusait
« deux minutes quarante-cinq » à 17 inversions — de la prosodie, pas un défaut. Les trois seuils
suivent maintenant la plus longue phrase du groupe : `minMs` 60×syllabes, `maxMs` 300×syllabes+400,
`maxReversals` 6×syllabes. Le barème extrapole les valeurs déjà validées à l'oreille (2 syllabes →
120/1000/12) au lieu d'inventer un second jeu de nombres.

**Le cache de prises a payé ces deux découvertes.** Les deux correctifs ont été validés en
redécoupant des prises déjà en mémoire, sans un appel d'API supplémentaire. Sur l'ensemble du lot,
neuf prises refusées seulement — très loin du « une sur six » que le script redoutait.

**Piège de méthode :** commencer par les deux extrêmes — le groupe le plus court, puis le plus
long — a trouvé les deux réglages faux en huit clips. Générer dans l'ordre aurait payé la même
découverte beaucoup plus cher.

### Les missions guidées parlent

`clipId` existait sur les étapes depuis leur écriture et **n'était lu par personne** — la même
dette que `isUnilateral`. Les quinze étapes portent un clip, et le coach le joue en arrivant
dessus.

Les textes sont **écrits pour la voix, pas copiés de l'écran**. Celui-ci tutoie (« Ouvre le menu de
création ») ; l'annonceuse vouvoie et constate. Lui faire lire la copie d'interface aurait cassé le
personnage que `voiceScript.json` décrit.

**Elle se tait quand une horloge de séance tourne.** `playTutorialNarration` ne passe pas par
`planCue` : il ignore les priorités et joue. Or quatre missions se déroulent pendant la séance. Une
consigne par-dessus un « trois, deux, un », c'est le décompte qu'on perd — et c'est lui qui compte
sous la barre. Le texte reste à l'écran, exactement comme en mode Silence.

`isWorkoutAudioBusy` existait déjà et répond mieux qu'un module écrit à côté : il lit l'échéance à
l'horloge murale, pas un `setId` qui survit au démontage de l'écran. Il gagne seulement le chrono de
maintien — le seul des trois sans échéance, puisqu'il s'arrête quand on relâche.

### Le garde-fou du manifeste

Le compte « N identifiants / N MP3 » était recopié à la main de session en session. C'est un test
désormais. Il a d'ailleurs commencé par se tromper : `allClips()` ne rend que les lignes dont le
`cue` existe dans `CUES`, or la narration porte `cue: 'tutorial'` — dix clips sur quatre-vingts
passaient à travers. Il lit maintenant le script entier.

### Portes

- `npm run typecheck` : sortie 0 ;
- `npm run lint` : sortie 0, aucun avertissement ;
- `npm run test:run` : **193 fichiers, 2 091 tests**, sortie 0 ;
- `npm run build` : sortie 0, **151 entrées précachées** — les MP3 partent dans le service worker,
  donc la voix marche hors ligne.

**Checkpoint téléphone demandé :**

> J'entends les repères pendant un gainage, le changement de côté sur une série unilatérale, et la
> consigne de chaque mission — sauf quand un repos ou une cadence tourne, où l'écran suffit.

## Exercices unilatéraux — une ligne, deux côtés

`isUnilateral` existait sur `Exercise` depuis le Lot 2 et **n'était lu par personne** : c'est le
contrôle « champ déclaré et lu par personne » ouvert au Lot 4 et consigné depuis comme *en
attente*. Ce lot le ferme.

Pour un exercice porteur du drapeau, **une ligne représente les deux côtés** : une saisie, une
validation, un enregistrement, un seul `setId`. La première cadence bat le premier côté ; à sa fin
l'app annonce « Changement de côté. Reprise dans dix secondes. », attend réellement dix secondes,
puis repart pour le second côté. Le premier côté ne déclenche **ni validation durable, ni repos,
ni RPE, ni record, ni volume supplémentaire**. La série n'est terminée qu'après le second.

**Les répétitions saisies valent par côté, et la série s'enregistre une fois.** Tu saisis 10 : dix
battements à gauche, dix à droite, et la série vaut 10 × la charge. Doubler le tonnage créerait
une rupture dans les courbes avec toutes les séances unilatérales déjà enregistrées, pour un gain
de fidélité qu'aucun écran ne demande.

**Sur une ligne unilatérale chronométrée, la coche finit le côté, pas la série.** Une cadence de
répétitions sait compter jusqu'à la fin ; un maintien ne sait pas quand il s'arrête, donc la coche
est le seul signal disponible. La première change de côté, la seconde valide — et la durée écrite
est celle du côté qu'on vient de finir.

### La machine, et pourquoi elle est faite ainsi

`features/workout/sideCycle.ts` porte la règle, pure et testée. **Trois stades visibles, deux
stockés** : `transition` n'est pas un état de plus, c'est `second` avant son instant de reprise.
Le stade se **dérive d'un instant absolu** au lieu d'être avancé par un minuteur — même règle que
la barre de repos, le métronome et le chrono. Et les dix secondes ne sont pas comptées deux fois :
elles **sont** la fenêtre de préparation de l'horloge du second côté, `resumesAt` et `startedAt`
étant le même instant.

Le cycle vit dans une **référence** autant que dans un état. Ouvrir le cycle et en tourner un côté
peuvent tomber dans le même tour de boucle ; une décision qui lit l'état de la fermeture de rendu
y verrait encore le cycle d'avant et repartirait du premier côté, indéfiniment. Le test l'a
attrapé avant la salle.

`repBeats` accepte désormais le cue qui **ferme** une cadence : les clips de `set-done` disent
« Validé. » et « Série terminée. », faux au milieu d'une série. Le premier côté se ferme par
`side-change`.

### Données

`WorkoutExercise.exerciseIsUnilateral` rejoint l'instantané, avec **`version(10)`** de Dexie et le
rattrapage de sauvegarde correspondant (`CURRENT_SCHEMA_VERSION = 10`). Mêmes gardes que la
version 4 : uniquement les lignes déjà instantanées, et jamais par-dessus un drapeau que la ligne
porte déjà.

**`WorkoutSet.side` n'est pas touché** : il reste `'both'`. Une ligne représente les deux côtés ;
écrire `'left'` puis `'right'` demanderait deux lignes, ce que le contrat interdit.

La **projection historique ne transporte pas** le drapeau : elle est lue par les exports et les
analyses, dont aucun ne s'en sert. Un champ transporté que personne ne lit est exactement la dette
que ce lot solde ailleurs.

### Pièges rencontrés

- **Ne jamais lancer `prettier --write` sur un fichier que le lot ne formate pas déjà.**
  `historicalWorkouts.ts` a été reformaté en entier — 159 lignes de diff pour un ajout de douze.
  Remis en état, le commit tient en 14 lignes. Le dépôt n'est pas uniformément formaté, et
  `prettier --check` s'y plaint aussi des fins de ligne CRLF : le vrai portail est `npm run lint`.
- Ajouter un champ à `snapshotOf` fait échouer trois assertions exhaustives (`toEqual`) qui
  épinglent volontairement la forme de l'instantané. Les étendre est la bonne réponse ; les
  affaiblir ne l'aurait pas été.

### Portes

- `npm run typecheck` : sortie 0 ;
- `npm run lint` : sortie 0, aucun avertissement ;
- `npm run test:run` : **190 fichiers, 2 058 tests**, sortie 0 ;
- `npm run build` : sortie 0, service worker PWA généré, 99 entrées précachées.

### La voix, toujours pas enregistrée

« Changement de côté. Reprise dans dix secondes. » est **figé** ici et rejoint la validation des
transcriptions avant génération, avec les trente-six repères du chrono et les douze textes P1. Le
cue `side-change` sonne (`chime`) et ne parle pas encore ; un test épingle qu'il n'a aucun clip.

**Checkpoint téléphone demandé :**

> Une série unilatérale se fait en une ligne : je saisis une fois, la cadence part, elle m'annonce
> le changement de côté, j'ai dix secondes pour changer, elle repart, et je ne valide qu'une fois.
> En Silence, le relevé me dit où j'en suis.

## Chrono de série chronométrée

Un gainage, une planche, un dead hang, un rameur : `measurementType` distinguait les exercices
chronométrés depuis le Lot 2, la colonne « secondes » se saisissait à la main, et **rien dans
l'app ne comptait ce temps**. Il fallait sortir de FitTrack pour ouvrir le chronomètre du
téléphone — exactement le geste que « mobile-first, une main, en sueur » interdit. Signalé depuis
l'usage réel.

Le chronomètre du bandeau ouvre désormais un **Chrono** au lieu d'une **Cadence** sur ces
exercices. « Démarrer le chrono » donne dix secondes pour se mettre en position (annonce, puis
3-2-1), puis compte. La fin du repos de la série précédente enchaîne toute seule, sans redonner
ces dix secondes : le 3-2-1 du repos était déjà la préparation.

**La coche fait tout en un geste** : elle arrête le chrono, écrit la durée tenue dans la série et
la valide — puis repos, RPE et records suivent leur chemin habituel. Elle reste active pendant un
maintien même si aucune durée n'est saisie : l'exiger remplie enfermerait le chrono sans sortie,
puisque c'est lui qui écrit cette durée.

**`HOLD_RELEASE_SECONDS = 2`.** On tape *après* avoir relâché. Sans cette correction, chaque
maintien serait sur-noté des deux mêmes secondes, à chaque série, pour toujours — une dérive
silencieuse qui finirait dans les records de durée et dans les courbes sans que rien à l'écran ne
permette de la soupçonner. Constante nommée, pas un réglage : c'est un nombre qu'on règle une
fois, et une ligne à changer si la salle dit autre chose.

**Une cible n'arrête rien.** `holdBeats` n'a aucun battement de fin — c'est toute sa différence
avec `repBeats`. Une série qui prescrit 45 s voit son repère annoncé à l'échéance et le chrono
continue : une cible est un objectif, pas une limite.

### Ce qui a bougé dans le code

La cible de cadence est devenue une **union discriminée** : `{ kind: 'reps' }` ou
`{ kind: 'hold' }`, et `cadenceFor(measurementType, repSeconds)` est le seul endroit du dépôt qui
tranche. `repPacer` n'a pas été fusionné dans une horloge générique — c'est un chemin audio
lourdement testé, et le fusionner aurait fait porter le risque de cette fonctionnalité sur les
répétitions, qui marchent. Le chrono est un jumeau (`stores/holdTimer`, `holdBeats`, `HoldRail`)
et `useWorkoutPace` est l'arbitre : **une seule des deux horloges tourne**, épinglé par un test.

Différence structurante : **une série chronométrée sans valeur saisie est `ready`, pas
`missing-reps`.** Il n'y a rien à taper avant de tenir — la durée est le résultat, pas l'entrée.

### Pièges rencontrés

- **Les faux minuteurs figent `fake-indexeddb`.** Un test d'intégration qui pose
  `vi.useFakeTimers()` puis attend l'écran ne voit jamais la séance arriver : il expire à 5 s sans
  rien dire d'utile. Le maintien de 47 s est simulé en **reculant `startedAt`** dans le store, pas
  en faussant l'horloge.
- **La feuille de confirmation de retrait porte le même libellé que l'entrée du menu**
  (`workout.removeExercise`). Chercher le bouton par son nom en trouve deux ; c'est la dernière
  occurrence qui confirme.
- Une prop d'objet manquante n'est pas `null` mais `undefined`, et `hold !== null` laisse alors
  passer `undefined` jusqu'au rendu. La carte ne rendait plus rien du tout, ce qui ressemblait à un
  bug de la séance et n'était qu'un branchement inachevé.

### Ce que la revue a trouvé (`bf2cd38`)

Trois constatations, dont deux avec le même correctif.

**L'horloge d'un maintien démarrait à zéro quand elle prenait la suite d'un repos.** Le premier
jet copiait la règle de la cadence de répétitions : après un repos qui vient de compter 3-2-1, on
est déjà sous la barre, donc pas de préparation. Mais l'horloge d'un maintien **est la valeur
écrite dans la série** : partie au T0 du repos, elle comptait comme du gainage les secondes qu'il
faut pour se mettre au sol. Sur une routine « 3 × gainage », chaque transition sur-notait la durée
du temps de mise en place, en base et pour toujours. Le 3-2-1 du repos dit « le repos se
termine », pas « tu es en position ». Un maintien reçoit désormais ses dix secondes **dans tous
les cas** ; une cadence de répétitions garde son départ immédiat, et un test épingle les deux.

**Le T0 était muet**, et pour la même raison : l'alerte de fin de repos est sautée dès que le
relais réussit, `HoldRail` n'arme pas de 3-2-1 quand la préparation est nulle, et le premier
repère du chrono ne tombe qu'à cinq secondes. On entendait « trois, deux, un » puis rien, sans
savoir que l'horloge qui note la série tournait. Les dix secondes rétablies referment ça.

**La coche pendant un maintien levait la garde sur toute la ligne.** Elle doit rester active alors
que la cellule des secondes est vide — c'est elle qui arrête le chrono, et l'exiger remplie
l'enfermerait sans sortie. Mais le chrono n'écrit **que** la durée : un rameur (`distance_time`)
pouvait être validé sans sa distance. Seule la colonne « durée » est désormais considérée comme
déjà tenue.

### Les voix : déclarées, pas enregistrées

Trente-six repères — `hold-5` à `hold-180`, de cinq en cinq — générés depuis `HOLD_MARK_SECONDS`,
la seule source. Ils portent une **tonalité douce** pour que le mode « sons » ne soit pas muet sur
un gainage ; **Silence reste silencieux**. Au-delà de trois minutes, le chrono continue à l'écran
et se tait : aucun repère n'est annoncé sans clip derrière lui.

**Aucun clip n'est déclaré dans `voiceScript.json` ni généré.** Même règle que les douze textes
P1 : un identifiant déclaré sans MP3 est un silence qui se fait passer pour une phrase. Un test
épingle que `clipsFor` est vide pour les trente-six. Transcriptions à valider avant génération :
« cinq », « dix » … « cinquante-cinq », « une minute », « une minute cinq » … « trois minutes ».

### Portes

- `npm run typecheck` : sortie 0 ;
- `npm run lint` : sortie 0, aucun avertissement ;
- `npm run test:run` : **189 fichiers, 2 033 tests**, sortie 0 (contre 184 / 1 993 avant le lot) ;
- `npm run build` : sortie 0, service worker PWA généré, 99 entrées précachées.

**Checkpoint téléphone demandé :**

> Je peux tenir un gainage sans sortir de l'app : le chrono part après dix secondes, il me dit où
> j'en suis, et la coche écrit le temps tenu sans que j'aie rien tapé. En Silence, le relevé à
> l'écran suffit.

**Ensuite :** l'unilatéral (une ligne, deux côtés), qui se pose sur ce socle et sait désormais
qu'une série peut être battue **ou** tenue.

## Contexte de dossier pour la suggestion de l'accueil

La suggestion globale fonctionnait tant que toutes les routines formaient une seule pile : choisir
la moins récemment réalisée parmi toute la bibliothèque devient faux dès que les routines sont
rangées dans plusieurs dossiers. Le classement sait alors répondre à « laquelle est la plus
ancienne ? », mais plus à « dans quel ensemble veux-tu t'entraîner ? ».

L'accueil mémorise maintenant un contexte choisi explicitement : un dossier, ou la racine
**« Sans dossier »**. Ce choix est persisté dans les réglages locaux et la suggestion de la carte
classe la routine la moins récemment réalisée **uniquement dans ce contexte**. Quand aucun dossier
n'existe, rien ne change : le comportement global historique est conservé sans imposer de sélecteur.

Les bords importants sont écrits dans le comportement, pas laissés au hasard : supprimer le dernier
dossier ramène à la sélection globale ; supprimer le dossier sélectionné alors que d'autres dossiers
existent demande de choisir à nouveau ; un dossier sélectionné mais vide reste vide et ne pioche
jamais silencieusement ailleurs. Un programme actif reste prioritaire, exactement comme avant.

**Preuves.** Réglages : **32/32** tests ciblés ; repository de l'accueil : **14/14** ; interface
d'accueil : **9/9**. Le checkpoint téléphone couvre le premier sélecteur, l'icône pour changer de
dossier depuis la carte, la persistance après fermeture/réouverture, **« Sans dossier »** et le
dossier vide. Aucun APK ni succès de la suite complète n'est revendiqué à ce stade.

## Tutoriel v2 — première séance P1

Les douze missions `TUT-ACT-01`, `TUT-REC-01`, `TUT-ROU-01` à `04`, `TUT-WRK-01` à `04`,
`TUT-DAT-01` et `02` sont implémentées. Elles guident les vraies commandes, avancent sur des
événements émis après le résultat durable attendu et ne créent, ne valident, ne suppriment ni ne
restaurent de donnée à la place de l'utilisateur. La progression `fittrack:tutorial:v2` reprend à
l'étape exacte après rechargement et traverse la sauvegarde JSON complète.

La récupération s'ouvre quand l'âge d'une séance active atteint **12 heures incluses**. Reprendre
et Terminer restent immédiats ; Abandonner est inaccessible tant que le nombre de séries validées
n'est pas connu, puis exige une confirmation comptée. Fermer la feuille ou attendre ne supprime
rien.

### Traçabilité des tâches

- Task 1 — progression versionnée : `57c5002`, durcissement `e5f185b` ;
- Task 2 — catalogue P1 et machine d'état : `37ff6e8` ;
- Task 3 — coach non modal : `646618e`, mouvement réduit `3674456` ;
- Task 4 — activation et aide contextuelle : `39abe39`, persistance atomique `bf5a77c`, garde de
  mission active `241ce27` ;
- Task 5 — routines : `85575c0`, démarrage depuis la collection `991885b` ;
- Task 6 — séance et récupération sûre : `f0438f6`, courses de récupération `a32adc9` ;
- Task 7 — sécurité des sauvegardes : `5b996db` ;
- Task 8 — parcours intégré et persistance : `054702b` ;
- correction du checkpoint mobile — coach sous les feuilles et repli haut sans cible : `308dfcd`.

### Preuves locales

- scan `voiceScript|generate-voice|ELEVEN|VITE_.*KEY` dans les zones P1 : **zéro match** ;
- toutes les ancres P1 sont présentes ; les tests épinglent l'unicité des cibles propres au premier
  exercice et à la première série ;
- `npm run typecheck` : sortie 0 ;
- `npm run lint` : sortie 0 ;
- `npm run test:run` : **183 fichiers, 1 985 tests**, sortie 0 ;
- `npm run build` : **373 modules transformés**, sortie 0, service worker PWA généré.

### Checkpoint navigateur réel — 390 × 844

Sur une origine isolée, le parcours routine → ajout d'exercice → deuxième série → cible → repos
60 s → séance → série/RPE → fin du repos → bilan/enregistrement → export JSON → ouverture puis
fermeture de la confirmation de restauration est passé. Le mode Silence conserve des instructions
textuelles complètes. Un rechargement pendant l'étape 2 de `TUT-ROU-03` revient exactement sur
cette étape. La largeur racine reste à `390/390`.

Le contrôle a trouvé deux recouvrements : la feuille partagée était sous le coach, puis le repli du
coach sans cible couvrait l'action fixe du sélecteur d'exercices. Le correctif `308dfcd` place le
coach sous les feuilles et en haut quand sa cible est absente ; le même parcours navigateur est
repassé après correction.

**Aucune mission de la chaîne de création `TUT-ROU-01` → `TUT-DAT-02` n'a été sautée pour cause de
garde incompatible.** `TUT-ACT-01` appartient au chemin alternatif « Choisir un modèle » ; son
activation est couverte par les tests, pas par ce checkpoint parti de « Créer ma routine ».
`TUT-REC-01` n'a pas non plus été déclenchée manuellement : aucune séance artificiellement âgée de
plus de 12 h n'a été injectée, afin d'éviter une restauration synthétique destructive. Ses
frontières `< 12 h`, `= 12 h`, `> 12 h`, ses trois choix, la confirmation, les rejets et l'absence
d'abandon automatique sont couverts par les tests et la revue. Le checkpoint sur téléphone reste
donc explicitement en attente.

### Prochaine reprise exacte

Avant toute génération de voix :

1. empêcher l'annonce « reprise dans 10 » tant que le RPE est ouvert, sans arrêter l'horloge du
   repos et sans rejouer ensuite un repère déjà dépassé ;
2. pour un exercice marqué unilatéral, faire représenter les deux côtés par **une seule ligne** :
   annoncer le changement de côté, reprendre après 10 s, puis ne déclencher repos, RPE et record
   qu'après le second côté ;
3. figer les douze textes français P1, puis auditer et générer les clips manquants avec la clé API
   restaurée, sans jamais la lire dans les sorties, l'exposer ni la consigner dans le dépôt.

Le manifeste courant reste complet à **43 identifiants / 43 MP3**. Les douze missions P1 sont
volontairement text-only : leurs futurs clips ne sont pas encore déclarés ni générés. Les missions
P2 et P3 restent inchangées et non commencées.

**Checkpoint téléphone demandé avant les voix :**

> Je peux aller d'une première routine à une séance sauvegardée, reprendre après fermeture,
> résoudre une vieille séance sans perte et comprendre la sauvegarde, même en Silence.

## Revue de code complète — post-v1.0.0

Passe de relecture sur l'ensemble du dépôt, la V1 étant fermée. Les quatre vérifications passaient
déjà toutes avant la revue (typecheck, lint, 1886 tests, build) et passent toujours après
(1908 tests). Ce qui suit est ce que la relecture a trouvé et ce qui en a été fait.

### Le défaut sérieux : restaurer une vieille sauvegarde contournait toutes les migrations

Les blocs `upgrade()` de Dexie se déclenchent sur un changement de **numéro de version** de la
base — ce qu'une restauration ne provoque pas. `restoreBackup` vidait chaque table et y remettait
les lignes du fichier telles quelles : une sauvegarde écrite sous un schéma plus ancien atterrissait
dans une base à jour sans qu'aucune migration ne l'ait jamais vue, ni alors ni plus tard.

Conséquence concrète : un fichier antérieur au schéma 9 porte des exercices perso sans
`bodyweightLoadFactor`, et `effectiveLoadKg` lit un coefficient absent comme « aucun corps
impliqué » — zéro. Le restaurer remettait en place, en silence, **le défaut exact que la version 9
existe pour corriger** — celui reporté deux fois depuis le téléphone. `seedDatabase` ne rattrape
pas : la v9 vise `isCustom: 1`, précisément ce que le seed refuse de toucher.

Le fichier disait pourtant d'où il venait depuis toujours (`app.schemaVersion`, écrit par
`buildBackup`, relu par `parseBackup`) — mais personne ne le consultait.

**`lib/backup/backfill.ts`** rattrape les versions 2, 4, 7, 8 et 9 sur les lignes du fichier avant
l'écriture. `db.ts` n'est pas touché : une version livrée ne se réécrit pas. Chaque étape remplit ce
qui est **absent** et n'écrase jamais ce qui est là — plus strict que ce dont les migrations
d'origine avaient besoin, parce qu'ici l'étape peut croiser une ligne qui porte déjà la bonne
réponse, et écraser un instantané gelé avec le catalogue d'aujourd'hui est la réécriture de
l'histoire que les instantanés existent pour empêcher. Ces gardes les rendent idempotentes, ce qui
permet de faire traverser toutes les étapes à un fichier qui ne dit pas d'où il vient.

**Piège à retenir :** `CURRENT_SCHEMA_VERSION` redit la version de Dexie parce que `lib/` ne peut
pas importer `data/db` (le cycle serait réel). `data/schemaVersion.test.ts` vérifie que les deux
s'accordent — **ajouter un `version(n)` à `db.ts` fait échouer ce test** tant que la table des
rattrapages n'a pas été mise au courant. C'est voulu.

### Le bundle : seules les analyses étaient découpées

`router.tsx` importait statiquement une vingtaine d'écrans, donc tout atterrissait dans le morceau
à télécharger avant le premier rendu — l'import Hevy et sa machinerie CSV, l'écran de debug, les
crédits, les trois écrans de blocs, l'éditeur de séance archivée. Aucun n'est sur le chemin
Accueil → Séance.

    index      736,93 kB → 470,09 kB   (gzip 214,61 → 130,70)
    dexie      314,55 kB → 118,92 kB   (gzip 100,23 →  38,26)
    ─────────────────────────────────────────────────────────
    au démarrage           −46 % de JavaScript compressé

L'avertissement « chunks are larger than 500 kB » de Vite disparaît. Le couple `lazy` + `Suspense`
que les sept routes d'analyse épelaient chacune vit maintenant dans **`app/lazyRoute`**. Restent
chargés d'emblée : les cinq onglets, les trois écrans de séance, les réglages.

### L'écran de séance : 1009 → 738 lignes

Le métronome part dans **`useWorkoutPace`** (un état, une ref, un long effet, quatre closures —
un seul sujet), les annonces dans **`useWorkoutAnnouncements`**, `ExerciseNotesSheet` prend son
fichier. Aucune règle ne change, les commentaires ont suivi le code qu'ils expliquent, et les
153 tests de `features/workout` passent sans retouche.

L'écran reste au-dessus des ~300 lignes : ce qui subsiste est la pile de feuilles en JSX, et la
sortir demanderait une interface d'une vingtaine de props qui ne serait qu'un passe-plat.

### Points mineurs corrigés

- **`db` importé par deux composants**, contre la règle. `countCompletedWorkouts` (dépôt
  d'historique) et `hasExistingHistory` (dépôt d'import) les remplacent — et comptent au lieu de
  charger les tables entières. `DebugScreen` garde son accès, avec le commentaire qui dit pourquoi :
  il parle de *tables*, pas de routines.
- **`workout.deloadPercent === 80`** dupliquait `DELOAD_PERCENT`, exporté par un module déjà importé
  dans le même fichier.
- **`RestRail`** portait un `role="progressbar"` et un `aria-valuetext` soigné à l'intérieur d'un
  conteneur `aria-hidden` : jamais annoncés par rien. Retirés — `RestStatus` imprime déjà le
  décompte en toutes lettres.

### Ce qui a été regardé et laissé tel quel

- **`appendNote`** trime pour décider et concatène brut. J'ai voulu « corriger », un test l'a
  arrêté — il épingle le comportement avec une note volontairement entourée d'espaces. Ajouter une
  ligne aux notes de quelqu'un n'autorise pas à reformater ce qu'il a écrit au-dessus. L'asymétrie
  est maintenant documentée au lieu d'être subie.
- **La règle « commentaires en anglais »** de `CLAUDE.md` était contredite par 750 lignes dans
  76 fichiers, sur toutes les couches. La règle a été assouplie plutôt que le dépôt traduit : ces
  commentaires disent quel défaut réel les a fait écrire, et traduire cette prose-là en aplatirait
  la moitié pour un gain de conformité et rien d'autre. L'exigence se déplace sur le **pourquoi**.
- **`writePreferences` hors transaction** dans `restoreBackup` : un échec y laisse la base restaurée
  et le `localStorage` à moitié vidé. Pas corrigé — `localStorage` n'entre pas dans une transaction
  Dexie, et la vraie parade demanderait un journal. Connu, peu probable, noté ici.
- **`listCompletedWorkouts`** charge toutes les séances terminées à chaque appel, la pagination
  n'arrivant qu'après. Les bancs d'essai existent (`history.bench.ts`), le seuil est donc surveillé.
- **`lib/programs/phaseSuggestions.ts`** et **`data/repositories/programSchedules.ts`** (377 lignes)
  n'ont pas de fichier de test à leur nom. Probablement couverts par
  `ProgramFlow.integration.test.tsx` — à confirmer, la couverture instrumentée n'est pas configurée
  (`@vitest/coverage-v8` absent).

### Checkpoint téléphone

Rien de visible n'a changé, ce qui est précisément ce qu'il faut vérifier :

1. **Restaurer une sauvegarde** faite avec une version précédente — l'écran de réglages doit
   annoncer les mêmes comptes qu'avant, et un exercice perso au poids du corps doit compter son
   tonnage après restauration.
2. **Ouvrir l'import Hevy, les blocs, le debug et les crédits** — ils arrivent maintenant en
   différé ; l'attente doit être invisible.
3. **Une séance complète** : cadence, repos, records, décharge, feuilles. C'est l'écran remanié.

## v1.0.0 — le mois se lit, le graphique s'emporte, l'app sait quand parler

Les deux derniers lots partiels de la V1 sont fermés. Ce qui restait n'était pas de la finition :
c'étaient quatre exigences du cahier des charges qui n'avaient jamais été écrites.

### Lot 12 — le rapport mensuel (RF-44)

`PERIOD_KEYS` ne connaît que des fenêtres en semaines, et c'est la bonne unité pour un split — mais
un rapport se lit contre un calendrier. « Juillet », pas « les semaines 27 à 31 », et aucun nombre
entier de semaines ne fait un mois.

- **`lib/analytics/months.ts`** construit les mois locaux sur des composantes civiles (jamais
  30 × 24 h) et range une séance dans **son propre fuseau** — la règle de `weeks.ts` transposée.
  Une séance du 31 juillet à 23:30 reste en juillet, où qu'on la relise.
- **`lib/analytics/monthlyReport.ts`** répond aux six mêmes questions pour chaque mois — séances,
  jours d'entraînement, séries, répétitions, tonnage, temps — du mois courant au plus ancien.
  **Les mois blancs sont gardés** : un mois sans séance est une lecture, pas un trou à sauter.
- L'écran affiche l'**écart avec le mois précédent** sur quatre des six lignes. C'est ce qui
  transforme « 1 200 kg » en information. Le plus ancien mois n'a pas d'écart : il n'a pas
  « tout gagné », il n'a simplement rien avant lui.
- **Pas de compte de records dans le rapport.** `personalRecords` ne garde que les records
  **encore debout** : un record de mars battu en avril disparaît de mars. Un chiffre qui décroît
  en relisant le passé est pire que pas de chiffre.

**Dette remboursée au passage :** trois copies de la projection « séance stockée → tonnage »
vivaient dans l'export coach, le graphique de volume et les métriques d'exercice. Elles sont
maintenant une seule (`lib/volumeSource.ts`). Trois copies d'une même règle, c'est trois écrans
qui peuvent finir par ne plus dire le même chiffre — le défaut exact que la v0.9.0 a corrigé une
couche plus bas.

### Lot 12 — l'export PNG d'un graphique

Trois obstacles séparent un graphique à l'écran d'une image partageable, et
`platform/chartImage.ts` les traite dans cet ordre :

1. **Les couleurs sont des variables.** Chaque marque est peinte en `var(--accent-data)`, résolu
   par la feuille de style de la page. Un `<svg>` chargé dans une `<img>` est un document sans
   feuille de style : tout sortirait en noir sur noir. Les peintures **calculées** sont donc
   relevées sur les nœuds vivants et réécrites en attributs sur la copie.
2. **Un graphique seul ne dit rien.** Douze barres sans titre, sans unité et sans date, c'est une
   image illisible dans trois mois. L'image est composée : titre, lecture en cours, graphique,
   date d'export.
3. **La transparence.** Le fond de carte est peint en premier : un PNG transparent collé sur du
   blanc est illisible une fois sur deux.

`saveFile.ts` porte désormais **une seule échelle** (partage web, partage natif, téléchargement)
pour le texte comme pour les octets ; le chemin Android écrit l'image en base64, seule forme qui
traverse le pont de la WebView intacte. Le bouton est sur les trois écrans à graphique : séances
par semaine, volume, progression d'un exercice.

**Vérifié dans un vrai Chromium**, la partie que jsdom ne peut pas atteindre : le SVG composé se
rastérise en PNG de 31 ko, et le comptage des pixels retrouve le fond (18,17,15), la couleur des
barres (168,90,32), l'encre du titre et le gris de la légende.

### Lot 13 — les trois notifications, chacune avec son interrupteur (RF-53)

La fin de repos, le record battu et le rappel d'entraînement sont **trois intrusions
différentes** : qui veut la première ne veut pas forcément la troisième. Un interrupteur chacun,
jamais un maître qui fait payer au premier le coût du troisième.

- **Les rappels programmables.** `lib/reminders.ts` calcule les prochaines occurrences **à
  l'horloge murale**, jamais en heures écoulées : la semaine qui enjambe un changement d'heure
  dure 169 heures, l'heure affichée ne bouge pas. Douze rappels sont posés d'avance et réarmés à
  chaque retour dans l'app — une liste d'alarmes datées est la seule version dont le résultat se
  lit dans un test, sans téléphone.
- **Le record battu s'écrit dans les notifications**, sur un canal d'importance 2 : **visible,
  jamais audible**. Un record tombe au moment où une série est validée, téléphone en main — la
  carte l'a déjà dit et la voix aussi, en Web Audio. Une cloche système serait la seule de l'app
  à baisser la musique de l'utilisateur (règle du Lot 21).
- **Le rappel, lui, interrompt** (importance 4) : il sonne un jour où l'app n'a pas été ouverte,
  c'est tout son intérêt. Par défaut il est **éteint** — c'est la notification que personne n'a
  installé l'app pour recevoir ; les deux autres sont allumées, elles répondent à un geste.
- Les trois réglages vivent sous une seule clé de `settings`, donc **dans la sauvegarde** : un
  téléphone restauré retrouve ses rappels sans qu'on les lui redonne.

### La v0.9.1 est passée entre-temps

Cette version part de `426d683` : les muscles cliquables du Journal, `CardHeadline` et le réglage
de chargement en disques y sont déjà. Rien de ce qui suit ne les touche — les deux lots ajoutent
des écrans et une section de réglages, ils n'en réécrivent aucun.

### Ce qui reste hors V1

Le **Lot 11** (mesures autres que le poids, photos de progression) et les lots 14 à 16, 19 et 20
restent ouverts. Ce sont des lots de V2 et de V3 : « tout ce qui suit le Lot 10 est du confort »,
dit la feuille de route, et la V1 utilisable en salle est complète depuis longtemps. Les Lots 12
et 13 en faisaient partie parce qu'ils portaient des RF du cahier des charges restés vides.

**Checkpoint téléphone — validé sur le téléphone le 2026-08-22 :**

- [x] Progression → **Rapport mensuel** : le mois en cours s'ouvre, les six chiffres correspondent
      à ce que l'historique montre, et « Comparé à juillet » dit quelque chose de vrai.
- [x] Choisir un mois sans séance dans la feuille : « Aucune séance ce mois-ci », sans zéro
      trompeur ailleurs.
- [x] Sur **Volume d'entraînement**, toucher « Exporter en image » : la feuille de partage Android
      s'ouvre, le PNG arrive dans Fichiers ou dans une conversation, **avec son titre, sa période
      et sa date**, et les barres sont de la bonne couleur (pas noires).
- [x] Réglages → **Notifications** : couper « Fin de repos », lancer une série, verrouiller
      l'écran — le téléphone ne sonne plus. Rallumer : il sonne à nouveau.
- [x] Allumer « Rappels d'entraînement », cocher **le jour même** et régler l'heure à trois minutes
      d'ici. Fermer l'app, poser le téléphone : le rappel arrive à l'heure dite.
- [x] Décocher tous les jours : la ligne dit que rien ne sonnera. Aucun rappel ne doit arriver.
- [x] Battre un record en séance : la bande apparaît sous la série **et** une ligne « Record
      battu · <exercice> » attend dans le volet des notifications, **sans avoir fait de bruit**.
- [x] Exporter la sauvegarde, réinstaller par-dessus, réimporter : les trois interrupteurs et la
      semaine de rappel reviennent tels quels.

⚠️ **Aucune migration Dexie.** Les préférences de notification sont une clé de plus dans
`settings`, lue avec un défaut quand elle est absente. Installer par-dessus la v0.9.1, sans
désinstaller.

## v0.9.1 — le corps se touche aussi dans le Journal

Trois demandes remontées du téléphone dans la même session.

### 1. Les muscles d'une séance passée se touchent, comme sur l'accueil

Le dessin du Journal (`HistoryWorkoutDetail`) était muet : le même corps répondait au doigt sur
l'accueil et pas ici. Un geste qui marche sur un écran et pas sur l'autre apprend surtout à ne
plus essayer.

- La feuille du catalogue quitte `features/home/` pour `features/exercises/` et s'appelle
  **`MuscleExercisesSheet`** : elle ne sait rien de l'écran qui l'ouvre, on lui donne un muscle,
  elle répond avec les exercices du catalogue qui le ciblent. L'accueil et le Journal lisent donc
  exactement la même réponse.
- Ses textes quittent `home.*` pour une section **`muscleSheet`** partagée, la ligne
  « Touche un muscle… » comprise — deux copies du même texte finissent toujours par diverger.
- **`HistoryMusclesCard`** (nouveau) porte la carte du Journal : le dessin, la ligne d'aide, la
  feuille et l'état du muscle touché. `HistoryWorkoutDetail` n'en garde qu'une ligne.
- Le dessin n'est plus décoratif ici : il porte son libellé (`history.detailMusclesLabel`) puisqu'il
  se touche.

### 2. « kg » passait à la ligne sous le chiffre

Sur l'écran Volume, « 19 313,5 kg » en `text-3xl` ne laissait plus la place à « Semaine du 17 août
2026 » : le nombre se cassait entre sa valeur et son unité. Les quatre cartes d'analyse partageaient
le même en-tête copié-collé ; il devient **`CardHeadline`**, avec deux règles — la valeur ne se coupe
jamais (`whitespace-nowrap`), et la ligne se dédouble avant de se serrer (`flex-wrap` + `ml-auto`).
Les lectures courtes tiennent toujours sur une ligne, comme avant. Vérifié en Chromium à 375 px.

### 3. Le réglage « Chargement en disques » était illisible

Deux textes longs de part et d'autre d'une `ListRow` : le titre se coupait en « Chargement en d… »
pendant que « Deux côtés, sans barre » écrasait la phrase d'aide sur trois lignes. Le réglage prend
maintenant la forme des deux autres blocs de la carte « Charge » : intitulé au-dessus, valeur dans
un champ pleine largeur (même fond et même hauteur qu'un `NumberInput`), explication dessous. Rien
n'est tronqué.

**Portes de release :** lint, typecheck, **1 796 tests dans 165 fichiers** et build PWA au vert ;
déploiement Pages et workflow Android APK de `63dee95` au vert sur GitHub.

Rustine d'interface : aucun changement de schéma ni de données. Installer par-dessus la v0.9.0,
**sans désinstaller**.

**Checkpoint téléphone :**

- [ ] Journal → ouvrir une séance passée → toucher un muscle : la liste de ses exercices s'ouvre.
- [ ] Volume → vérifier sur un écran étroit que la valeur et « kg » restent sur la même ligne.
- [ ] Fiche d'exercice → Charge : « Chargement en disques » et son aide sont lisibles en entier.

## v0.9.0 — ce que l'app devinait, la fiche d'exercice le dit

Quatre demandes de terrain, remontées ensemble parce qu'elles se répondent : trois portent sur la
même chose, **une fiche d'exercice qui ne portait pas assez d'informations pour que l'app arrête de
deviner**.

### 1. Une traction sans lest pesait zéro, et rien ne le disait

`effectiveLoadKg` lit un exercice mesuré au corps à travers son `bodyweightLoadFactor`. Le champ
était optionnel, le formulaire de création le laissait **vide**, et un coefficient absent vaut
« aucun corps » : quatorze tractions maison comptaient quatorze répétitions et **pas un kilo** de
tonnage. Le zéro n'était affiché nulle part — c'est ce qui a rendu le défaut si long à voir.

Trois corrections, dans cet ordre :

- **`lib/bodyweightLoad.ts`** (nouveau, testé avant écrit) décide du coefficient de départ :
  100 % partout où le corps est ce qu'on déplace, rien là où la résistance vient d'ailleurs
  (élastique, poulie, machine). Un assisté vaut toujours 100 % par construction.
- **Le formulaire ne part plus d'un champ vide.** Il pose le défaut et le montre. Un chiffre tapé
  à la main survit à tout changement ultérieur de matériel ; un défaut auquel personne n'a touché
  suit le mouvement (« répétitions seules » qui passe de la barre fixe à l'élastique se vide).
- **La `version(9)` de Dexie rattrape les exercices déjà créés** : `isCustom: 1`, mesuré au corps,
  sans coefficient → celui que le formulaire écrirait aujourd'hui. Rien n'est écrasé, le catalogue
  n'est pas touché. Même arbitrage que les versions 2 et 4, et dit de la même façon : la meilleure
  information disponible, et la seule.

Le coefficient devient aussi **modifiable sur la fiche de n'importe quel exercice** — quatre
préréglages plus un champ — catalogue compris, ce que le formulaire ne pouvait pas offrir (il ne
s'ouvre que sur les exercices faits maison). Conséquence à traiter : `seedDatabase` réaligne
`bodyweightLoadFactor` à **chaque lancement**, et aurait donc effacé silencieusement le chiffre
tapé au démarrage suivant. Un exercice porte désormais `bodyweightLoadFactorIsCustom` ; le
catalogue s'en écarte définitivement, sans cesser de réaligner l'anatomie.

Et quand aucun poids du corps n'est enregistré, la fiche le dit sur place plutôt que de laisser
les totaux à zéro.

### 2. Le calculateur de plaques se réglait au matériel — donc mal

`equipment` dit sur quoi un mouvement se fait ; il n'a jamais dit **comment la fonte est
suspendue**. Résultat : une extension lombaire avec un disque contre la poitrine, une ceinture de
lest, un haltère chargeable et un chariot à un seul pivot recevaient tous la même mauvaise réponse
— le plus souvent aucune.

`Exercise.plateLoading` porte maintenant l'un de quatre mots : **aucun · sur une barre · deux
côtés sans barre · un seul côté**. `lib/plateLoading.ts` (déplacé depuis `features/workout/`, la
fiche en a besoin autant que la séance) résout la fiche d'abord, le matériel ensuite — l'ancienne
table barre/Smith/machine à disques reste le défaut, donc rien ne change pour qui n'y touche pas.
Un « aucun » explicite est une réponse, pas une absence.

Deux conséquences directes :

- **La feuille « Plaques à charger » s'ouvre enfin sur une traction lestée.** Le calculateur
  refusait les charges *ajoutées* : 25 kg à la ceinture, c'est 25 kg de fonte à aller chercher, et
  la barre ne s'y intéressait pas.
- **Le poids de barre ne meurt plus avec la feuille.** Il vivait dans un `useState` de l'écran de
  séance : une barre EZ réglée à 10 kg était oubliée à la fermeture. Il vit sur l'exercice
  (`plateBaseWeightKg`), se règle des deux côtés — fiche et feuille — et le champ, qui
  disparaissait dès qu'il n'y avait « pas de barre », reste là sous le nom de **charge à vide**
  (un chariot de machine pèse quelque chose, et c'était incorrigible).

La feuille parle enfin la langue du réglage : « à charger » quand il n'y a qu'un point de
chargement, « de chaque côté » quand il y en a deux.

### 3. Les muscles secondaires ne se choisissaient pas

« Pour les tractions en prise neutre je n'ai pu renseigner que dos ou biceps, pas les 2. » Et pour
cause : `createCustomExercise` recevait `secondaryMuscles: []` en dur. Nouveau `MultiOptionSheet`
— le jumeau d'`OptionSheet` avec une seule différence, **choisir ne referme pas** : « dos » est une
réponse qui attend encore « biceps ». Cases à cocher (le rôle doit annoncer qu'on peut en prendre
plusieurs *avant* le premier appui), « Terminé » collé en bas du panneau, et le muscle principal
retiré de la liste.

### 4. Des animations, pour que ça glisse

Quatre gestes, pas un de plus, tous ≤ 220 ms et tous partant d'une position **proche** de
l'arrivée : une app de salle se manipule d'une main, en sueur, et une animation qu'on attend est
une animation qui gêne. `rise` (l'en-tête et le contenu d'un écran, un état vide, la barre de
séance en cours), `fade` (le contenu d'une feuille), `pop` (la coche d'une série validée, clé sur
son état pour qu'elle rejoue à chaque validation — sur la coche seule, remonter la ligne ferait
partir le clavier), `flash` (réservé). `prefers-reduced-motion` les désarme tous d'un bloc, la
règle existait déjà.

**Portes locales :** typecheck, lint, **1 794 tests dans 165 fichiers**, build PWA.

Mineure et non corrective : le formulaire d'exercice change de forme, la fiche gagne une section,
et le tonnage d'anciennes séances de tractions cesse d'être nul. ⚠️ **Migration Dexie
`version(9)`** — les exercices faits maison mesurés au corps reçoivent le coefficient que le
formulaire écrirait aujourd'hui ; rien n'est écrasé, rien n'est supprimé, le catalogue n'est pas
touché. Installer par-dessus la v0.8.9, **sans désinstaller**.

**Checkpoint téléphone :**

- [ ] Ouvrir la fiche d'une traction : « Part du poids du corps » à 100 %, et le tonnage d'une
      ancienne séance de tractions n'est plus à zéro.
- [ ] Relancer l'app : le coefficient tapé à la main est **toujours là** (c'était le piège).
- [ ] Fiche « Extension lombaire » → chargement « un seul côté ». En séance, saisir 20 kg :
      « Plaques à charger » apparaît et dit « à charger », pas « de chaque côté ».
- [ ] Régler une barre EZ à 10 kg depuis la feuille, quitter la séance, revenir : toujours 10 kg.
- [ ] Créer un exercice avec deux muscles secondaires ; vérifier le schéma musculaire de sa fiche.
- [ ] Vérifier qu'aucune animation ne gêne la saisie d'une série au milieu d'une séance.

## v0.8.9 — le « Temps » du bilan de séance compte les répétitions

Remonté du téléphone : une LOWER A d'1 h 41, 31 séries de travail, 346 répétitions, **« 4:30 min »**
en face de TEMPS. Le chiffre n'était ni faux ni juste — il additionnait `set.durationSeconds`,
c'est-à-dire le chronomètre des seuls exercices *chronométrés*, et **zéro** pour tout ce qui se
compte en répétitions. Pire : la somme prenait aussi les secondes qu'une série en répétitions
traîne encore (exercice re-typé, import Hevy qui recopie `duration_seconds`), alors que la ligne de
série, elle, ne les affiche pas — la carte affichait donc des minutes introuvables ailleurs à
l'écran.

Une répétition est du temps. `workingSecondsOf` (`src/lib/volume.ts`) lit désormais chaque série à
travers son type de mesure, comme toutes les autres lectures d'une séance passée : **exercice
chronométré → son chrono ; exercice compté → ses répétitions à la cadence de l'exercice**
(`lib/tempo`, 3 s par répétition tant qu'on n'en règle pas une autre, préférence globale comprise).
La cadence réglée depuis la feuille « Cadence » de la v0.8.8 sert donc deux fois : le métronome
pendant la série, le temps de travail après. `SessionTotals.durationSeconds` devient
`workingSeconds` — le nom disait « durée mesurée », la chose est un temps de travail, et l'export
coach portait déjà un `durationSeconds` (le temps d'horloge de la séance) juste à côté.

La carte TOTAUX dit maintenant ce qu'elle compte (`history.detailTimeHint`) : une estimation se
présente comme telle, et dit où elle se règle.

1 738 tests / 163 fichiers, typecheck, lint et build de production. Aucun changement de schéma.

**Checkpoint manuel à faire sur le téléphone :** ouvrir une séance de l'historique et vérifier que
TEMPS est du même ordre que la durée de séance moins les repos ; régler la cadence d'un exercice à
2,5 s (chrono de la carte, en séance) puis rouvrir une séance qui le contient — le temps suit.

## v0.8.8 — cinq ajustements, dont deux qui rendent la main

Pas un lot : cinq demandes de terrain, traitées ensemble parce qu'elles se répondent.

**Le tempo de la cadence n'est plus calculé.** Il l'était : 3 s, plus un quart par série déjà
faite, plus une demie sur la dernière, plus une demie après trois quarts d'heure. Chaque terme se
défendait ; la somme non. L'app décidait du tempo d'*un* exercice à partir d'un modèle de fatigue
qu'elle ne mesure pas, et une cadence qu'on n'a pas choisie est une cadence avec laquelle on
discute. Le nombre appartient maintenant à qui est sous la barre : un **chrono dans le bandeau de
la carte** ouvre la feuille « Cadence » (± au quart de seconde, cinq préréglages, ce que ça donne
sur la série, le départ, et « Par défaut partout »). Quand la cadence tourne, ce même bouton
l'arrête — c'est exactement la place qu'occupait le carré. La valeur vit sur
`WorkoutExercise.repSeconds` (champ non indexé : **aucun changement de schéma**), la préférence
dans la table des réglages. `src/lib/tempo.ts` ne garde que la grille et la résolution
« exercice → préférence → 3 s ».

**Le bilan de fin de séance ne se relit plus à chaque retour.** La mémoire de ce qui avait déjà été
dit vivait dans un `useRef` : un aller-retour vers un autre écran la vidait, et l'écran de fin
reparlait. Elle passe au niveau module, comme `claimWorkoutGreeting` — et la même chose est faite
pour les records, dont la clé devient `exercice:type:valeur` plutôt que l'identifiant de la ligne
projetée, stable à travers une reprojection.

**« Partager » ouvre enfin la feuille du système sur l'APK.** La WebView Capacitor n'implémente pas
`navigator.share` : le bouton tombait directement sur le presse-papiers, quand celui-ci répondait.
`shareText` emprunte désormais la même échelle que `saveFile` — plugin natif, puis Web Share, puis
presse-papiers.

**Une sauvegarde complète, à côté du CSV et pas à sa place.** Le CSV décrit des *séances* dans un
format que d'autres outils lisent ; il ne dit rien des routines jamais réalisées, des programmes,
des records, du journal du coach, des réglages ni des préférences. Le JSON de `lib/backup` emporte
toutes les tables telles quelles (suppressions douces comprises — une sauvegarde est une copie, pas
une projection) et les préférences `localStorage` prises **par espace de noms** (`fittrack:`), pour
qu'une préférence ajoutée plus tard soit sauvegardée sans que personne y pense. La restauration
remplace, dans une seule transaction, après avoir montré ce que contient le fichier. Ce qu'elle ne
porte pas, et le dit : les binaires de photos (`photoBlobs`), que JSON n'exprime pas et qu'aucun
écran n'écrit aujourd'hui.

**Le coach ne lit plus une charge qui monte comme une régression.** Deux règles jugeaient des
répétitions sans regarder ce qu'il y avait sur la barre. `intra_session_drop` comparait toute série
à la première de la séance : `100 × 10` puis `110 × 6` ressortait en « Baisse de reps observée ».
Une série ne se compare désormais qu'à la première du **même palier**. Et `plateau`, qui lit trois
séances de 1RM estimé, se tait quand la charge maximale a monté sur la fenêtre : sur `100 × 10`,
`105 × 8`, `110 × 6` l'estimation recule d'un kilo pendant que dix kilos montent sur la barre — le
modèle dit « rien ne bouge », le fait dit le contraire, et c'est le fait qui compte.

1 730 tests / 163 fichiers, typecheck, lint et build de production. Aucun changement de schéma :
installer par-dessus la v0.8.7, sans désinstaller.

**Checkpoint manuel à faire sur le téléphone :**

1. En séance, toucher le chrono d'une carte : régler 5 s, lancer, vérifier que le tok tombe toutes
   les cinq secondes de la première à la dernière série (plus d'allongement automatique).
2. Toucher le chrono pendant que la cadence tourne : elle s'arrête d'un doigt.
3. « Par défaut partout », puis ouvrir la cadence d'un autre exercice : il part sur ce tempo.
4. Terminer une séance, revenir en arrière, revenir sur l'écran de fin : le bilan n'est **pas**
   relu.
5. Historique → une séance → ⋯ → Partager : la feuille de partage Android s'ouvre.
6. Réglages → Sauvegarde complète → Exporter, puis Restaurer le fichier obtenu : les nombres
   annoncés correspondent, et l'app revient à l'identique après le rechargement.

---

## v0.8.7 — toucher un muscle, trouver quoi lui donner

Le dessin de l'accueil se lisait ; il se touche maintenant. Un doigt sur un muscle ouvre une
feuille qui nomme le groupe et liste les exercices du catalogue qui le ciblent, avec un passage
vers le catalogue filtré sur le même groupe.

**La moitié du chemin était déjà construite.** `MuscleMap` expose une option `onSelect` depuis que
le dessin existe — le hit-testing sur `path[data-muscle]` était écrit, testé par personne et branché
nulle part. `MUSCLE_IDS_BY_GROUP` faisait déjà la jointure entre les 26 muscles dessinés et les 16
groupes du catalogue, mais dans le seul sens dont l'éclairage a besoin. Ce qui manquait : le sens
inverse (`groupOfMuscleId`, dérivé de la même table — un miroir tenu à la main est un miroir qui
dérive), le passage de la prop à travers `MuscleMapView`, et la feuille.

**Une feuille, pas une navigation, et c'est le doigt qui tranche.** Le dessin porte 26 muscles dans
300 px : le deltoïde latéral fait 19 px de large, très loin des 48 px de la charte. Des taps
tomberont à côté — ce n'est pas un défaut à corriger mais un fait à absorber. Une feuille annonce ce
qu'elle a compris (« Épaules ») et coûte un swipe ; une navigation aurait coûté l'écran d'accueil à
chaque erreur de pouce.

**Le dessin grandit : 15 rem → 19 rem.** Les 240 px d'origine arbitraient contre « Lancer », du temps
où le corps ouvrait l'écran ; la carte du jour est passée devant depuis, et l'arbitrage ne porte plus
que sur les trois liens d'analyse. Les 64 px de plus font passer le deltoïde latéral de 15 à 19 px et
les rhomboïdes de 12 à 15 — ça ne règle pas la cible tactile, ça rend le muscle visable. Les deux
réserves de place (`h-72`) suivent à `h-[26rem]`, sinon les boutons sautent sous le pouce quand le
dessin arrive.

**Les trois muscles orphelins ont droit à une phrase.** Psoas, dentelé antérieur et jambier
antérieur sont dessinés sans qu'aucun groupe du catalogue ne les nomme (`UNMAPPED_MUSCLE_IDS`, un
refus délibéré d'approximer). Le doigt tombera dessus : la feuille l'explique au lieu de ne rien
faire en silence.

**Limites assumées :** la liste suit le *muscle principal*, exactement comme le filtre du catalogue
derrière « Voir dans le catalogue » — compter l'implication secondaire ici et pas là ferait répondre
deux nombres différents au même muscle. Et la carte disparaît toujours quand rien n'a été travaillé
sur douze semaines : le raccourci s'en va avec elle. Le catalogue reste à un onglet de distance,
avec son propre filtre par muscle.

15 tests neufs (la jointure inverse, le tap sur le dessin, la feuille, et le parcours complet depuis
l'accueil) : 1 698 tests / 159 fichiers, typecheck, lint et build de production. Aucun changement de
schéma. Installer par-dessus la v0.8.6, sans désinstaller.

**Une release se publie aussi depuis l'onglet Actions.** Le chemin normal reste
`git tag -a vX.Y.Z && git push origin vX.Y.Z`, mais il suppose un poste autorisé à écrire dans
`refs/tags/*`. Quand il ne l'est pas — une session d'agent se voit refuser les tags alors qu'elle
pousse des branches — le code part sur `master`, l'APK dort en artefact trente jours et la page
Releases reste en arrière : le piège de la v0.2.0, cette fois sans `git push` pour le corriger.
`workflow_dispatch` prend désormais un `release_tag` optionnel ; renseigné, `gh release create` crée
le tag lui-même avec `--target` sur le SHA construit — le tag ne peut donc désigner que le commit
qui vient de passer les portes. Laissé vide, le lancement manuel reste un build d'essai. La garde de
signature suit : sur le dépôt principal, publier sans les secrets échoue, tag ou saisie.

Les v0.8.6 et v0.8.7 n'ont jamais reçu de tag poussé à la main ; la release v0.8.7 a été publiée par
ce chemin et porte les deux (cadence rangée + carte interactive).

---

## v0.8.6 — une seule machine pour la cadence

Les sept correctifs de la v0.8.5 étaient sept symptômes d'une même cause : la préparation d'une
cadence vivait dans deux états React indépendants. `pendingPace` — « il ne manque que les
répétitions » — et `typedPace` — « les répétitions viennent d'être saisies, le départ est armé ».
Rien n'interdisait aux deux d'être posés en même temps, ni à l'un de survivre à la série qu'il
désignait. Un état resté en place ne dort pas : il bloque tous les armements suivants pour le
reste de la séance, et c'est exactement le bug qu'on a corrigé cinq fois.

Les deux états n'en font plus qu'un, `PacePlan`, une union à trois branches — `idle`,
`awaiting-reps`, `arming` — dans `src/features/workout/paceMachine.ts`. Être dans l'une, c'est
être hors de l'autre : l'état illégal n'est plus rattrapé au cas par cas, il n'est plus
représentable. La règle qui décide de la suite (`paceDecision`) est une fonction pure qui lit un
plan et une préparation et rend une intention — attendre, oublier, demander les répétitions,
lancer le métronome. L'écran garde l'horloge et le son ; le module garde la règle. Dix-huit tests
couvrent la validation d'une série pendant ses dix secondes, la suppression de sa ligne, l'échéance
dépassée et la reprise du temps restant.

Côté écran de séance, deux `useEffect` de trente lignes chacun deviennent un seul, et la rustine
posée en v0.8.4 — annuler à la main le lancement différé avant tout départ explicite — disparaît :
remplacer le plan unique fait le travail. Le fichier perd une centaine de lignes.

**Aucun changement de comportement volontaire** : mêmes annonces, mêmes 600 ms de stabilisation
de la saisie, mêmes dix secondes de préparation, même reprise du temps restant quand la valeur se
fixe tard. 1 681 tests / 156 fichiers, typecheck, lint et build de production. Aucun changement de
schéma. Installer par-dessus la v0.8.5, sans désinstaller, pour conserver les données locales.

**Reste à faire, un jour :** `WorkoutScreen.tsx` fait encore ~950 lignes pour une convention à 300.
La cadence est rangée ; le repos, l'effort et les feuilles ne le sont pas.

---

## v0.8.5 — les états parallèles de la séance, et le silence qui parlait

Revue de code du lot 21 : sept correctifs, tous sur des chemins que l'usage normal traverse.

La cadence armée à la saisie ne se désarmait jamais quand sa série cessait d'être la cible.
Valider une série pendant ses dix secondes de préparation — c'est-à-dire saisir après avoir fait
la série, le geste le plus courant — laissait l'attente en place pour toute la vie de l'écran, et
plus aucune saisie de répétitions n'armait de cadence ensuite. Même piège pour l'attente « il
manque les répétitions » quand la série concernée est validée ou supprimée.

« Silence » ne survivait pas à un redémarrage : le gain maître repartait à 1, et la narration du
tutoriel — qui ne passe pas par les règles d'annonce — parlait par-dessus un réglage qui promet
l'inverse. Le mode est maintenant réappliqué à l'ouverture du contexte audio, et la narration s'y
soumet en retombant sur son temps de lecture.

« Repos prolongé » s'annonçait même sans repos à prolonger : en superset, la bande d'effort
s'affiche alors qu'aucune minuterie ne tourne. L'annonce est désormais liée à l'extension réelle.

`rep-impact.wav` rejoint les clips mp3 dans le précache du service worker : hors ligne, l'impact
de répétition était muet pour toute la session, et l'échec était mémorisé sans nouvelle tentative.

Un repos démarré sur la carte d'une cadence en cours démontait le composant qui porte les
battements, et les tuait silencieusement en laissant le store armé. Le métronome survit maintenant
à l'affichage du repos.

Côté Android, le listener de focus audio ignorait `AUDIOFOCUS_LOSS` : après une perte décidée par
le système, l'app croyait détenir un focus qu'elle n'avait plus et cessait d'atténuer la musique.

Enfin, la trentaine de chaînes du tutoriel et de l'en-tête vivent dans `src/i18n/fr.ts`, comme le
veut la convention du projet.

1 663 tests / 155 fichiers, typecheck, lint et build de production. Aucun changement de schéma.
Installer par-dessus la v0.8.4, sans désinstaller, pour conserver les données locales.

---

## Clarification des outils de dépannage

Les anciennes actions génériques de « réparation » décrivent maintenant précisément leur effet :
recalculer les records, mettre à jour les instantanés des anciennes séances ou restaurer le
catalogue d’exercices. Elles sont regroupées dans « Dépannage et données » et affichent leur état
ou un aperçu du nombre de lignes concernées avant toute écriture.

Une routine supprimée d’un programme peut désormais être remplacée directement depuis la séance
manquante, ou recréée sur place. L’action disparaît avec une explication lorsque la semaine a déjà
été entraînée ou que le programme est terminé. Vérification mobile à 375 × 812 px, sans erreur
console ; typecheck et lint passent, ainsi que 1 663 tests répartis dans 155 fichiers et le build
de production.

---

## v0.8.4 — poser le téléphone une seule fois

La cadence automatique savait déjà enchaîner les séries d’un même exercice, mais elle s’arrêtait
à la frontière de l’exercice suivant. C’était particulièrement visible quand la première série du
prochain exercice avait été préremplie pendant le repos : à zéro, l’app considérait l’exercice
précédent terminé, coupait le chrono et ne faisait rien de la valeur déjà prête.

Le passage de relais suit maintenant l’ordre réel de la séance. À la fin du repos, l’app cherche
le premier exercice suivant qui possède encore une série de travail. Si ses répétitions ont été
renseignées, elle annonce « Début dans dix secondes », arme dix secondes de préparation, puis le
cadenceur joue 3, 2, 1 avant le premier impact. Les exercices déjà terminés sont sautés. Si la
prochaine série est vide, la voix demande toujours de renseigner les répétitions et la saisie
relance le même scénario de dix secondes.

**Bug rencontré pendant la vérification :** écrire les répétitions arme un lancement différé de
600 ms pour laisser une valeur à deux chiffres se stabiliser. Un lancement explicite par le menu
pouvait donc démarrer la cadence, puis l’ancien callback la redémarrait juste après un arrêt
manuel. Tout lancement explicite — menu ou fin de repos — annule désormais cette préparation
différée avant de prendre l’horloge audio.

La sélection du prochain exercice vit dans une fonction pure testée séparément ; le parcours
complet est aussi couvert dans l’écran de séance, avec saisie du prochain exercice pendant le
repos et vérification du départ à dix secondes. 1659 tests / 154 fichiers. Aucun changement de
schéma. Installer par-dessus la v0.8.3, sans désinstaller, pour conserver les données locales.

---

## v0.8.3 — la voix raconte, l’interface montre

Le panneau du tutoriel masquait presque la moitié de la fonctionnalité qu’il était censé
présenter. Chaque chapitre affiche désormais son titre, un résumé d’une phrase et sa progression,
puis replie automatiquement la transcription après 1,8 seconde pendant que la voix continue.
L’écran encadré redevient le sujet principal de la visite.

« Lire le texte » rouvre la transcription complète à la demande ; elle reste contenue dans le
viewport et peut défiler sur les petits écrans. Le choix manuel est ensuite respecté jusqu’au
chapitre suivant. Contrôle visuel effectué à 390 × 844 px sur les états replié et déplié, sans
erreur console.

Le verrou vocal de l’aide lit maintenant les échéances réelles : un ancien `setId` de repos ou de
cadence resté dans le store après la fin du chrono ne grise plus le bouton. Seul un décompte encore
actif reporte le tutoriel.

1656 tests / 154 fichiers. Aucun changement de schéma. Installer par-dessus la v0.8.2, sans
désinstaller, pour conserver les données locales.

---

## v0.8.2 — une séance commence par une intention

Le bouton « Démarrer une séance libre » quitte l'accueil : personne ne vient à la salle pour
ouvrir une coquille vide puis reconstruire sa séance exercice par exercice. Les routines et les
blocs restent les deux entrées visibles ; l'ajout d'un exercice pendant une séance préparée reste
disponible.

La voix avait un défaut lié à cette ancienne entrée : elle annonçait le démarrage dès l'ouverture
d'une séance qui ne contenait encore aucune série. L'annonce d'ouverture exige désormais au moins
une série disponible. Une ancienne séance vide reste donc silencieuse, sans casser la lecture des
anciens historiques ni les imports qui n'ont pas de routine d'origine.

1650 tests / 153 fichiers. Aucun changement de schéma. Installer par-dessus la v0.8.1, sans
désinstaller, pour conserver les données locales.

---

## Lot 21 — l'annonceuse (clips générés, chaîne audio en cours)

Demandé en cours de session : « des sons de notification et des phrases avec une voix féminine ia,
un peu à la squid game, une sorte d'admin ». Puis, deux précisions qui ont tout cadré :
**« l'intonation fait tout »** — donc des clips enregistrés, pas le TTS de l'appareil — et
**« faut pas que le son de la musique sur le côté baisse »** — donc Web Audio partout, jamais
`<audio>`, parce qu'un `HTMLAudioElement` demande le focus audio à Android et qu'Android
l'accorde en baissant Spotify.

**Ce qui existait déjà et a servi de socle :** `restChime.ts` (Lot 6) avait résolu le problème
difficile — le déblocage de l'`AudioContext` sur le premier geste. Ce fichier a été démonté dans
`src/audio/`, sa vibration part dans `haptics.ts`, son raisonnement dans `context.ts`.

**Le vrai travail n'est pas de jouer un son, c'est de décider de ne pas en jouer un.** `planCue`
tient le silence : un son part toujours, une _phrase_ doit trouver du silence devant elle, une
priorité plus haute coupe la parole, chaque cue a un temps de repos, et jamais deux fois la même
variante d'affilée. Piège tranché en test : une cue **muette** ne doit pas consommer de silence —
`set-validated` sonne trente fois par séance, et s'il ouvrait un délai de grâce il ferait taire
toutes les phrases de la séance.

**La fatigue, en trois endroits.** Le tempo du métronome de série s'allonge (+0,25 s par série
faite, +0,5 s sur la dernière, +0,5 s après 45 min, plafond 5 s) ; la bande « Effort ? » sous la
série validée écrit un RPE en une touche et ajoute 0/15/30/45 s de repos ; le repos prolongé
s'annonce. La bande s'efface seule au bout de 20 s — l'ignorer est une réponse valide, la série
est déjà écrite et le repos déjà lancé.

**Le geste dont je suis le plus content :** un tic réellement sorti prouve que l'app est au premier
plan, audible et non muette. Elle annule alors la notification Android de fin de repos
(`standDownRest`) — sinon deux alertes à une seconde d'écart, et c'est la notification, pas le
Web Audio, qui fait baisser la musique. Annulée à T−3 s et pas au début du repos : au pire on perd
trois secondes de filet de sécurité.

**Le manque signalé depuis le téléphone : « il y a une sorte d'écho sur les voix
administrateurs ».** Exact, et rien ne le spécifiait. Ce qui rend une annonce de sono
reconnaissable en un mot n'est pas le timbre de la personne qui lit, c'est **le haut-parleur et la
salle** — et aucun TTS ne le donne, la réverbération étant du post-traitement. `publicAddress.ts`
la produit donc à la lecture : bande passante de haut-parleur (170 Hz – 5,2 kHz, bosse de présence
à 2,6 kHz), écho de mur à 110 ms, hall d'environ 1,4 s en réverbération synthétique — pas de
fichier d'impulsion à embarquer. Le carillon d'annonce traverse la même chaîne, **les tics du
décompte restent secs** : un battement noyé dans une salle cesse d'être un battement.

Conséquence pour l'enregistrement, écrite là où quelqu'un qui s'apprête à enregistrer la lira :
**les clips doivent être secs.** Une réverbération gravée dans un fichier ne s'annule pas, elle
s'additionne. Et le garder en direct veut dire qu'on change d'avis sur la salle en modifiant trois
constantes, pas vingt-trois fichiers.

Le script porte désormais, ligne par ligne, une **indication de jeu** (`direction`) à côté des
réglages TTS — inutile au moteur, décisive pour quelqu'un au micro — et une consigne générale :
les phrases retombent, parce qu'une intonation montante fait d'un constat une question, et elle
n'en pose pas.

**Les 23 clips existent.** Voix conçue dans Voice Design d'ElevenLabs, rendue par
`eleven_v3`, générée par `npm run voice:generate`. Ce qui s'est révélé pendant la fabrication
tient en quelques pièges, tous payés en crédits :

**Un modèle ne sait pas dire un mot isolé.** « Trois. » demandé seul revient avec une mélodie
inventée, différente à chaque tirage : mesurées, douze prises séparées donnaient douze courbes
divergentes. Demandés **dans une même génération**, les trois mots partagent une ligne. Les
décomptes sont donc des `groups` dans `voiceScript.json` : une génération, découpée ensuite.
La ponctuation compte autant que le modèle — `Trois… Deux… Un.` aligne les trois courbes à un
tiers de ton près, là où points ou virgules les font diverger de trois à cinq demi-tons.

**Le premier mot d'une génération est toujours le pire** : le modèle s'installe dessus. Chaque
génération porte donc une amorce d'un mot, jetée, qui prend le coup — et qui sert au passage de
repère de découpage, le premier bloc sonore étant l'amorce.

**On ne découpe pas un mp3.** Les trames Layer III partagent un réservoir de bits ; couper entre
elles fait décoder du bruit aux premières trames d'après la coupe, pile sur la consonne d'attaque.
La voix est donc demandée en `pcm_24000`, découpée dans le signal avec des fondus de 6 ms, et
encodée **une seule fois**. Le `pcm_44100` est réservé au palier Pro ; sans importance, 12 kHz de
bande passante suffisent à une voix.

**Le script juge les prises avant l'oreille.** `scripts/voice/analysis.mjs` mesure la durée de
parole et la forme de la mélodie, et le générateur redemande une prise tant que les règles de
`accept` ne passent pas. Le critère qui prédit vraiment ce qu'on entend est **l'accord de sens**
entre les trois mots, pas le compte d'inversions : une prise validée à l'oreille comptait 8, 4 et
10 inversions et sonnait juste, tandis qu'un seuil serré rejetait des prises que l'utilisateur
avait approuvées. Le compte d'inversions n'est resté qu'un garde-fou large.

**Les prises brutes sont mises en cache** dans `.voice-cache/` (ignoré par git). Un bug dans
l'analyse ne doit jamais coûter une seconde génération — celui-ci a été appris en épuisant les
10 000 crédits d'un mois gratuit.

**Ce qui n'a pas marché, et qu'il est inutile de retenter :** lire tout le script d'un seul tenant
pour le découper ensuite. L'idée est bonne — un seul contexte pour les 23 lignes — mais le modèle
ne marque pas la fin d'une ligne plus longuement que la fin d'une phrase à l'intérieur d'une ligne.
Mesuré : des silences continus de 51 à 470 ms, 38 à 41 blocs sonores pour 31 attendus, aucun seuil
séparateur. Le décompte des répétitions fait exception et vient bien d'une lecture d'ensemble, mais
parce qu'il en occupe la toute fin, donc les trois derniers blocs, sans ambiguïté.

**Uniformité obtenue :** 126–132 ms d'avance de tête et −3,5 à −3,4 dB de crête sur les 23 clips.
La première empêche un mot d'arriver après le tic qu'il double, la seconde empêche un mot de sortir
plus fort que son voisin. L'égalisation vise −3 dB et non 0 : `publicAddress` somme le direct et
deux retours, et une voix écrêtée sur un haut-parleur de téléphone crache au lieu de sonner.

**Piège à retenir.** Un `<audio>` et un `BufferSource` jouent le même mp3 et ne coûtent pas la même
chose : le premier demande le focus audio au système, le second se contente de mixer. Sur un
téléphone qui joue de la musique, c'est toute la différence entre une annonce et une interruption.

**Reprise d'usage du 20 août — RPE et cadenceur.** Le brouillon laissé après le pack vocal ne
compilait plus : l'icône du métronome avait été retirée à moitié. La correction ne remet pas
l'icône. Le départ vit désormais sous un nom compréhensible dans le menu `⋯` de l'exercice :
« Lancer la cadence », avec `8 reps · 3 s par rep` avant de décider. Pendant l'effort, le seul
contrôle exposé est le carré d'arrêt de 48 px ; l'en-tête lit `Cadence · 2/8 · 3 s`.

Deux conflits découverts en pilotant l'app en 375 px ont été retirés. D'abord, la dernière série
repliait sa carte et faisait disparaître la bande RPE : elle survit maintenant au repli. Ensuite,
le repos restait vivant après le lancement du cadenceur, cachait sa lecture et préparait ses propres
tics par-dessus : lancer la cadence termine désormais explicitement le repos.

La bande RPE ne dessine plus quatre cartes dans la carte. Elle termine une seule phrase —
« C'était Facile / Correct / Dur / Limite » — sur la surface validée. Les quatre cibles mesurent
65 × 56 px à 375 px ; le bonus de repos n'est plus affiché sur les réponses, pour ne pas rémunérer
une réponse plus dure et fausser la mesure.

Enfin, la répétition ne reprend plus le tic carré aigu du décompte. `repTap` synthétise un petit
« tok » bas et arrondi avec deux sinus descendants ; le repos conserve son tic urgent. Les deux
restent Web Audio, hors focus système et hors réverbération. Vérification complète : **1 619 tests
sur 146 fichiers**, typecheck, lint et build de production passent. Aucun changement de schéma.

Détail complet : `docs/plans/lot-21-annonces-vocales.md`.

---

**Précédent :** 2026-08-19 (**Release Android v0.8.1 — « Jamais réalisée » sur une routine faite le matin même**).

## v0.8.1 — le jumeau qui passait devant

Signalé depuis le téléphone, capture à l'appui : l'accueil proposait « UPPER A ·
9 exercices · 28 séries · **Jamais réalisée** » alors que la même UPPER A, mêmes
compteurs, figurait dans les dernières séances à la date du jour.

**La cause, en deux temps.** La migration `version(8)` de la v0.8.0 a retiré le
versionnage des routines — et, ce faisant, a rendu visibles des lignes que
`listRoutineSummaries` masquait : anciennes versions publiées et brouillons de
version, chacun copie conforme de son original (même nom, même contenu). La
séance du matin porte le `routineId` de l'une ; l'autre, jamais lancée, passait
devant toutes les autres routines sous le même nom.

**Le correctif.** `pickSuggestedRoutine` rattachait une séance à **une seule**
routine : son `routineId` si elle en avait un, sinon celle qui portait son nom —
et rien du tout quand deux routines partageaient ce nom, pour ne pas deviner. Ce
refus coûtait plus cher que l'erreur qu'il évitait. Une séance compte désormais
pour **toutes** les routines qui portent son nom, en plus de celle dont
l'identifiant correspond : si tu as fait UPPER A, tu as fait ce que toutes tes
UPPER A décrivent.

**Ce que le correctif ne fait pas** : les doublons restent dans la bibliothèque.
Les champs de lignée (`originRoutineId`) ayant été supprimés par la migration,
plus rien ne permet de reconnaître à coup sûr une copie de version d'une
duplication volontaire. Ils se suppriment à la main depuis l'onglet Routines —
ce que la v0.8.0 autorise enfin.

**Piège à retenir.** Une migration qui _retire_ un filtre est une migration qui
_ajoute_ des lignes à l'écran. `version(8)` a été relue comme une suppression de
champs — elle était aussi un changement de ce que la liste affiche, et rien dans
les 1523 tests ne montait une base contenant une lignée de versions. **Quand une
migration supprime un champ, chercher qui filtrait dessus.**

1524 tests / 134 fichiers. Aucun changement de schéma.

---

**Précédent :** 2026-08-19 (**Release Android v0.8.0 — le bloc prescrit enfin quelque chose**).

## v0.8.0 — trois défauts du programme, trouvés en parcourant l'app

Parcours complet dans le navigateur : accueil → Programmes → cadre → split →
semaines → activation → fiche. Trois défauts majeurs, tous corrigés.

**1. Le niveau de semaine ne prescrivait rien.** `projectProgramPrescription`
n'appliquait jamais `loadIndex`, et `createDeloadTargets` s'ouvrait sur
`void input.week.loadIndex`. « 105 % · Progression » prescrivait donc les mêmes
kilos que « 100 % · Construction » : l'étape la plus longue de l'assistant ne
changeait rien à ce qu'on soulevait. Le niveau opère désormais **en crans,
jamais en facteur** — un cran tous les cinq points, et un cran c'est le plus
petit saut réel de l'exercice (`resolveLoadIncrementKg`). Passer par
`nextLoad`/`previousLoad` autant de fois que de crans garde chaque étape sur la
grille : deux crans au-dessus de 82,5 kg font 87,5 kg, jamais 86,625 kg.
L'assistance s'inverse, les échauffements ne bougent pas, rien ne passe sous
zéro, aucune répétition n'est inventée. Les décharges gardent leur recette.

**2. Le bloc naissait plat.** Huit semaines identiques à 100 % : ne rien toucher
revenait à n'avoir aucune périodisation, dans l'écran qui n'existe que pour ça.
Le trajet de départ est la recette Hypertrophie. Et « Semaines suivantes »
commence après la semaine que l'intention affiche déjà, en repliant les suites
identiques — « 02–08 — 100 % · Construction » au lieu de sept lignes.

**3. Composer un split supposait la bibliothèque déjà faite.** Sans routine,
impasse : sortir, composer, revenir. L'étape crée maintenant la routine qui lui
manque, vide et nommée, placée aussitôt. Le jour se choisit sur sept pastilles
au lieu d'un menu déroulant — quatre colonnes et non sept, parce que sept
faisaient 32 px de large là où la charte en exige 48 (mesuré au navigateur).

Au passage : chaque champ du cadre a son message d'erreur (un fourre-tout
redemandait le nom et la durée pour une date au mercredi), la règle du lundi est
écrite sous le champ avant d'être enfreinte, et la carte d'accueil ne lit plus
« Semaine 1 » deux fois.

**Pas touché, et volontairement** : les six lignes « Repos » d'une semaine à une
séance. C'est la décision du v0.7.4 — les jours de repos sont la moitié de
l'information d'un bloc — et rien dans ce parcours ne l'a contredite.

1523 tests / 134 fichiers.

⚠️ **Changement de schéma : `version(8)`.** La migration retire `version`,
`versionState` et `originRoutineId` des routines — aucun n'était indexé, et un
brouillon de version devient une routine ordinaire de la bibliothèque. Rien
n'est supprimé. Installer par-dessus, sans désinstaller.

---

**Précédent :** 2026-08-19 (**Découplage bloc / routine — les programmes sortent de l'onglet Routines**).

## Découplage bloc / routine

Signalé depuis l'usage : « l'intégration des programmes est mauvaise, bourrée de
frictions ». Deux causes, une de données, une de hiérarchie.

**Le cycle.** Le bloc pointait la routine (`programScheduleEntries.routineId`) et
la routine lisait le bloc en retour pour savoir si elle avait le droit d'être
modifiée. Or ce que ce scellage protégeait — les cibles d'une séance passée —
est déjà figé par l'instantané que `buildWorkoutEntities` recopie au démarrage :
l'historique ne relit jamais la routine. **Le cycle ne protégeait rien.**

Sont partis avec lui : `version` / `versionState` / `originRoutineId` (migration
`version(8)` ; aucun champ n'était indexé, et un brouillon devient une routine
ordinaire — rien n'est supprimé), `routineVersions.ts` en entier,
`RoutineReferencedError`, et `withEditableRoutine` qui rouvrait une transaction
sur les entrées de split avant chaque frappe.

**Trois frictions réparées au passage :**

- Renommer, déplacer ou supprimer une routine programmée **échouait en silence** :
  `void deleteRoutine(...)` sans `catch`, la feuille se fermait, rien ne bougeait,
  aucun message.
- Changer une série demandait cinq étapes et quatre mots — _version, brouillon,
  scellé, semaine d'entrée en vigueur_ — qui n'existent nulle part ailleurs.
- Le brouillon créé **disparaissait de la liste des routines**
  (`listRoutineSummaries` ne gardait que la dernière publiée par lignée) : il
  n'était atteignable que depuis la routine scellée qui l'avait engendré.

**La hiérarchie.** La ligne « Programmes » descend de l'onglet Routines vers
l'accueil, sous la carte du jour — c'est là qu'une séance commence, dans les
deux modes. Elle y est **toujours** : le nom du bloc quand un bloc tourne,
« Aucun bloc actif » sinon. L'onglet Routines redevient une bibliothèque et ne
lit plus le bloc actif : plus d'état d'erreur ni de bouton « Réessayer la
lecture » dupliqué sur deux écrans.

**Décision de produit :** on ne s'entraîne **jamais** obligatoirement sous un
bloc. La séance libre et la routine lancée seule restent à un appui (règle n°1,
aucune limite artificielle). Le bloc gouverne le calendrier quand il existe, il
ne le confisque pas.

**Ce qui devient possible :** supprimer une routine que programme un bloc. La
séance orpheline affiche « Routine indisponible » et propose « Réparer le
split » — un chemin qui existait déjà dans le code et que personne ne pouvait
atteindre.

`RoutineEditorScreen` : 570 → 304 lignes. 1504 tests / 132 fichiers.
Schéma : `version(8)`.

---

**Précédent :** 2026-08-15 (**Release Android v0.7.4 — la semaine entière sur la fiche du bloc**).

## v0.7.4 — les jours de repos sont la moitié de l'information

La section « Séances de la semaine » ne listait que les jours travaillés : on
voyait deux séances sans voir si elles étaient collées ni combien de jours les
séparaient.

- Les **sept jours** sont là, du lundi au dimanche ; un jour sans séance dit
  « Repos », en texte secondaire et sous le même gabarit (barre de sélection
  transparente comprise, pour que les colonnes restent alignées).
- La section apparaît **aussi avant la date de départ**. L'ancienne condition
  (bloc commencé ou terminé) laissait un bloc à venir sans aucun split à
  l'écran — or c'est le seul moment où le corriger ne coûte rien.
- Titre : « Séances de la semaine » → « **La semaine** ». Il mentait sur ce
  qu'on y trouve désormais.

1515 tests / 131 fichiers. Aucun changement de schéma.

---

**Précédent :** 2026-08-15 (**Release Android v0.7.3 — un bloc pas encore commencé était injoignable**).

## v0.7.3 — le bloc du 17 août n'avait aucune porte

Signalé depuis l'app : impossible de modifier ni de supprimer un bloc actif dont
la date de départ est encore devant.

- **La cause, à trois étages** : la liste retire le bloc actif de ses rangées
  puisqu'il est déjà en tête ; la carte du héros n'affiche un bouton que s'il y
  a une séance à démarrer ou un split à réparer ; avant la date de départ il n'y
  a ni l'un ni l'autre. La fiche du bloc — seule porte vers _modifier / décaler /
  supprimer_ — n'était donc atteignable par aucun chemin.
- **Le correctif** : l'en-tête de la carte ouvre la fiche, chevron à l'appui, sur
  l'accueil comme sur la liste. Assise inchangée (ni marge ni retrait ajoutés),
  l'appui se dit en opacité comme les autres surfaces qui ne se peignent pas de
  fond.
- **Reste ouvert** : le nom et la durée d'un bloc _actif_ ne sont pas modifiables,
  même quand il n'a pas commencé — `updateProgramDraft` et `replaceProgramWeeks`
  sont réservées aux brouillons. La date, elle, se rattrape par « Décaler ».

1515 tests / 131 fichiers. Aucun changement de schéma.

---

**Précédent :** 2026-08-15 (**Release Android v0.7.2 — deux corrections vues sur le téléphone**).

## v0.7.2 — « undefined » sur une version publiée

Signalé depuis l'app, capture à l'appui : une routine scellée par un bloc actif
lisait « undefined15 – 18 reps · undefined3,5 kg ».

- **La cause** : la fiche en lecture seule interpolait `part.prefix` sans garde.
  Seules l'assistance (`−`) et la charge ajoutée (`+`) en portent un ; sur une
  charge normale il vaut `undefined`, et le gabarit l'écrivait. Trois écrans
  recopiaient la même formule, deux avaient le `?? ''`. Elle vit maintenant une
  seule fois, `partReading` dans `i18n/labels`.
- **Sortie de l'éditeur de bloc** : après « Activer le bloc », la flèche ←
  revenait sur le wizard qu'on venait de valider — deux retours pour retrouver la
  liste. La fiche remplace l'éditeur dans l'historique.
- **Piège de test rencontré** : `toHaveTextContent` cherche une sous-chaîne, donc
  attendre `/programs/<id>` était déjà satisfait sur `/programs/<id>/edit`.
  L'attente rendait la main avant la navigation et le test lisait la base avant
  l'écriture — un échec qui accusait le code alors que le code était bon.

1514 tests / 131 fichiers. Aucun changement de schéma. Installer par-dessus.

---

**Précédent :** 2026-08-13 (**Release Android v0.7.1 — front Programmes + revue du Coach**).

## v0.7.1 — les branches en attente sont rentrées

Deux branches parallèles fusionnées dans master, cinq conflits, tous nés du
renommage `range_completed` → `range_ceiling_reached` fait par le Lot 17 **après**
le départ de ces branches.

- **Revue du Coach (Lot 18)** : plateau qui se taisait mal sur machine assistée
  (l'assistance était inversée dans `nextLoad` mais pas dans la règle du plateau),
  journal qui passait la reco vivante à `dismissed` — suivre le conseil effaçait la
  preuve —, et drop sets volontaires lus comme un effondrement intra-séance.
- **Résolutions à retenir** : `rangePartitionSignal` lit maintenant la partition
  plafond/fourchette du Lot 17 **sur `progressionSets`** du Lot 18 (ni échauffement,
  ni drop set, ni série allégée à dessein). `statusSuperseded` devient « Remplacée »
  tout court : deux causes écrivent ce statut désormais (activation d'un bloc,
  signal plus récent), « par le programme » mentait sur la seconde.
- **`markRecommendationFollowed` restaurée** : la branche l'avait supprimée alors que
  son appelant est né après elle. Sans elle la carte d'objectif ne quitte plus
  `pending` et reste affichée en pleine séance. Elle ne concurrence pas
  `reconcileFollowedLoads` — les deux ne touchent qu'une ligne `pending`.
- Un test de la branche attendait l'ancien nom du signal. Comportement bon
  (2 séries jugées, drop set écarté) : **l'assertion est renommée, pas affaiblie**.

Plus le nettoyage de clôture du Lot 17 : `editWeek` et `shiftDays*` supprimées,
vérifiées sans lecteur.

1513 tests / 131 fichiers.

---

**Précédent :** 2026-08-13 (**Release Android v0.7.0 — front Programmes : recettes, suppression, éditeur empilé**).

## Front Programmes (v0.7.0)

L’actif est le héros de la liste (`ProgramHeroCard`, `leadWith`), les autres blocs
restent des rangées. Suppression d’un bloc depuis le menu ⋯ sur les trois statuts,
avec confirmation : les séances déjà faites ne bougent pas de l’historique.

Trois recettes (Hypertrophie / Force / Reprise) posent le trajet des semaines :
motif de 4 semaines répété puis tronqué, **ancré au `weekIndex`** du bloc, niveaux
lus dans `SUGGESTED_LOAD_INDEX`. Rien n’est persisté : une recette est un point de
départ, pas un état — retoucher une semaine relâche la chip.

**L’édition n’est plus un wizard.** Le wizard (`Étape n sur 3 · Nom` + rail) reste
sur `/programs/new` seulement. `/programs/:id/edit` est un défilement de sections :

- Brouillon : Cadre, Split, Semaines éditables → « Enregistrer le brouillon ».
  L’activation a quitté l’éditeur : elle vit sur la fiche.
- Actif : le sélecteur de semaine d’entrée en vigueur gouverne **aussi** les
  semaines — `< effectiveFromWeekIndex` s’affiche en lecture seule (une rangée,
  pas un bouton grisé). « Utiliser à partir de la semaine {n} » écrit
  `createScheduleRevision` + `replaceProgramWeeksFrom` : les lignes scellées ne
  sont pas réécrites, elles gardent leur identité. Une seule règle de bornage,
  lue deux fois, plutôt que deux règles qui divergent.
- Terminé : pas d’entrée éditeur.

Fiche : brouillon incomplet → « Continuer la création » ; complet → « Activer le
bloc », avec la feuille « Remplacer le bloc actif » si un autre tourne déjà.

Pas d’arc de `loadIndex` au-dessus de la liste : il dupliquait la liste. L’arc se
lit dans la colonne des niveaux. `loadIndex` n’est toujours un multiplicateur
nulle part.

Piège consigné : `getActiveWorkout()` renvoie `undefined`, pas `null` — comparer
à `null` passe le typecheck et grise le bouton pour toujours.

`ProgramEditorScreen` est passé de 517 à 359 lignes (`programEditorModel.ts`,
`useProgramEditorData.ts`, `ProgramStepNav`, `ProgramEffectiveWeekSelect`).
Reste au-dessus des ~300 de la convention : le découper plus loin demanderait un
sac de 12 props, ce qui coûterait plus que ça ne rapporte.

1504 tests / 131 fichiers.

---

**Précédent :** 2026-08-13 (Release Android v0.6.0 — intention de bloc, le Coach tranche).

Le % 1RM de semaine est mort. Une semaine porte `loadIndex` + `phase`. « 105 % »
n’est plus une multiplication : c’est un niveau affiché. La routine reste le 100 %.

Le moteur distingue `range_satisfied` (dans la fourchette) et `range_ceiling_reached`
(plafond). On n’ajoute jamais de charge tant que la plage n’est pas saturée. Un
plateau retire toute escalade, y compris `add_set`. La phase de la **prochaine**
séance choisit parmi les actions déjà autorisées ; elle n’en invente aucune.

La Décharge transforme les cibles avant la séance (deux incréments en moins, une
série en moins). `loadIndex` 60 ou 90 donne la même recette. La séance snapshot
`programPhase` / `programLoadIndex` : reclasse la semaine plus tard, l’historique
ne ment pas.

UI : `05 — 60 % · Décharge`, accueil `Semaine 3 · Progression`, wizard
`Étape 2 sur 3 · Split` + 1 2 3 (plus de faux onglets). Carte Coach : plus de
« 100 → 0 kg » ; Progression sans incrément = « Maintien — progression différée ».

Revue des 12 commits : lint (`_removed`), bornes `loadIndex` 1–200, prochaine
séance = slots encore ouverts (pas l’ordre du split), et retrait du flux
d’avertissements 1RM (feuille + acquittement, devenus inatteignables).
`evaluateCoach` reste le moteur pur du lib ; l’écran de fin passe par
`evaluateCoachForWorkout`.

Bump mineur : `0.5.1` → `0.6.0`. Le modèle de données change (migration Dexie
`version(7)` : les semaines perdent `prescriptionKind` / `prescriptionValue` /
`isDeload` au profit de `loadIndex` + `phase`). `versionName` vient de
`package.json`, `versionCode` du run GitHub. Installer par-dessus,
**sans désinstaller** — la migration doit tourner sur la base existante.

Checkpoint téléphone (après prochain APK) : créer un bloc 8 semaines, poser une
Décharge en S5, terminer une séance au plafond juste avant : la feuille Coach
ne doit pas proposer d’ajouter du volume. En S6 Reprise, la grille est celle
de la routine, pas celle de la Décharge. Wizard : les trois chiffres 1 2 3
sont lisibles d’une main. Vendredi avancé, lundi encore ouvert : le Coach
reste sur la semaine en cours.

**Mise à jour précédente :** 2026-08-13 (**Release Android v0.5.1 — le CSV ouvre enfin la feuille**).

Le téléphone disait « Sauvegarde téléchargée » et aucun fichier n'arrivait. Dans la
WebView, `<a download>` réussit en JS et n'écrit rien. L'APK écrit désormais le CSV
dans le cache natif et l'envoie à la feuille Android.

Bump de rustine : `0.5.0` → `0.5.1`. `versionName` vient de `package.json`,
`versionCode` du run GitHub. Installer par-dessus, **sans désinstaller**.

**Mise à jour précédente :** 2026-08-13 (**Bug — « Sauvegarde téléchargée » sans fichier**).

## Rapport d'investigation (corrigé)

Signalé : l'export CSV ne fonctionne plus, soupçon sur le Lot 17. Premier diagnostic
faux : ce n'était **pas** un échec affiché. Le téléphone disait « Sauvegarde
téléchargée » (lu « sauvegarde effectuée ») et aucun fichier n'arrivait.

### Ce que le Lot 17 n'a pas cassé

Le sérialiseur n'a pas bougé depuis le Lot 8. Une séance née d'un programme s'écrit
et se relit. Les champs de bloc ne traversent pas le CSV : Hevy décrit des séances,
pas un programme. Ce n'est pas une régression.

### La vraie cause

Dans la WebView Capacitor, `canShare({ files })` renvoie `false`. `saveTextFile`
tombait alors sur `<a download>` + `click()`. En JS, le clic **réussit**. Android
n'écrit rien. Réglages traduit `downloaded` par « Sauvegarde téléchargée. » — un
succès pour une opération qui n'a pas eu lieu.

C'est pour ça que le premier correctif (`canShare` qui lève) ne pouvait pas
expliquer le symptôme : une exception aurait montré le bandeau rouge. Ici le
bandeau était vert.

Le Lot 17 n'a rien changé à ce fichier. Il a changé le moment où on s'en sert.

### Correctif

Sur l'APK, plus de faux téléchargement. Le CSV est écrit dans le cache natif
(`@capacitor/filesystem`) puis passé à la feuille de partage Android
(`@capacitor/share`). Fermer la feuille n'est pas un échec. Une écriture refusée
l'est vraiment, et on le dit. Le navigateur de bureau garde `<a download>`, qui
y fonctionne.

**Checkpoint téléphone :** installer l'APK par-dessus l'app, **sans la désinstaller**.
Réglages → « Sauvegarder l'historique (CSV) » : la feuille Android doit s'ouvrir
(Drive, Fichiers, Gmail…). **Plus** de « Sauvegarde téléchargée » sans fichier.
Enregistrer, rouvrir : les accents et les séances du bloc sont là.

**Mise à jour précédente :** 2026-08-13 (**Accueil — le corps en tête, le reste en dessous**).

L'accueil posait cinq questions en cinq blocs et cinq intertitres, avec le dessin du corps tout en
bas. Il en pose deux : **qu'est-ce que je travaille** (le corps, en tête d'écran) et **qu'est-ce
que je lance** (juste dessous). Les deux chiffres personnels — séances de la semaine, poids du jour
— tiennent une bande de deux tuiles sous la carte de séance ; l'historique récent ferme l'écran.

Ce qui part : la **série de semaines d'affilée** (un compteur qu'on lit une fois et qu'on perd en
se blessant — l'écran Rythme la garde), les **± de la pesée** (`NumberInput` prend un
`steppers={false}` : un poids se lit sur une balance et se tape, il ne s'ajuste pas par pas de
100 g), et **trois intertitres** — « À lancer » et « Semaine 2 sur 8 » sont passés en sur-titre
_dans_ leur carte.

La pesée était une carte permanente de 200 px pour un geste quotidien au mieux : elle est
maintenant une feuille (`HomeBodyWeightSheet`) derrière la tuile, qui se ferme d'elle-même sur une
écriture réussie — la tuile affichant la nouvelle valeur dit « c'est enregistré » mieux qu'une
ligne de texte.

**Le seul nombre à régler est dans `HomeMuscleMap` : `max-w-[15rem]`.** Le dessin est calé sur sa
largeur (deux figures deux fois et demie plus hautes que larges), donc c'est la largeur qui décide
de la hauteur, et la hauteur décide si le bouton « Lancer » passe au-dessus de la ligne de
flottaison. Mesuré sur 375 × 812 : carte du corps 96 → 463 px, carte de séance 487 → 697 px,
bouton à 586 → 642 px, barre d'action fixe à 699 px. Tout tient, à deux pixels près. Monter à
17rem donne un corps de 327 px et fait glisser le bas de la carte de séance sous la barre.

Prochaine étape évoquée : rendre les muscles cliquables pour ouvrir la liste des exercices qui les
travaillent. La géométrie est déjà nommée muscle par muscle (`musclesByGroup.ts`), donc c'est un
gestionnaire de clic et un écran, pas un nouveau dessin.

Checkpoint téléphone : ouvrir l'accueil et vérifier que le bouton de la séance à lancer est
visible sans faire défiler ; taper la tuile du poids et vérifier que le clavier suffit.

**Mise à jour précédente :** 2026-08-13 (**Release v0.4.0 — les programmes et une vraie anatomie**).

Deux gros morceaux dans la même version, écrits en parallèle sans se marcher dessus : le **Lot 17**
(périodisation, programmes multi-semaines, split hebdomadaire versionné) et le **remplacement de la
carte musculaire** par une géométrie dérivée de Z-Anatomy. Zéro fichier en commun entre les deux —
le recouvrement s'est limité à `src/i18n/fr.ts` et `PROGRESS.md`, tous deux fusionnés sans conflit.

Bump mineur : `versionName` vient de `package.json`, `versionCode` du numéro de run GitHub. Le tag
`v0.4.0` est ce qui publie la release et y attache l'APK ; un simple push sur `master` ne produit
qu'un artefact de 30 jours.

**Mise à jour précédente :** 2026-08-13 (**Carte musculaire Z-Anatomy — remplacement du body map**).

Les cinq écrans qui dessinaient un corps (accueil, bilan musculaire, fiche exercice, détail de
séance, fin de séance) passent d'une géométrie de 89 régions à 26 muscles anatomiques réels,
dérivés de Z-Anatomy. Le contrat `MuscleHighlight` n'a pas bougé d'un caractère : `BodyMap.tsx`
avait prévu ce remplacement par écrit, et aucun appelant n'a été réécrit.

**La couture est `src/ui/muscleMap/musclesByGroup.ts`, et nulle part ailleurs.** 16 groupes
dessinables → 23 muscles, plus 3 orphelins assumés (`hip_flexors`, `serratus_anterior`,
`tibialis_anterior`) : dessinés pour que le corps soit entier, jamais allumés faute d'un
`MuscleGroup` capable de les nommer. Exhaustif par construction via `satisfies`, et un test tient
la complémentarité 23 + 3 = 26.

`rotator_cuff` **est** allumé, avec `shoulders` — la coiffe stabilise l'épaule dans tout
mouvement, donc un développé qui l'allume dit vrai. C'est ce qui la sépare du serratus, qu'un
crunch ne travaille pas et qu'on refuse toujours de replier dans `abs`.

**Rampe de valeur, pas de couleur** : `color-mix(in srgb, var(--text-1) N%, var(--surface-2))`,
ce qui reproduit exactement l'ancien compositing en `fill-opacity` et garde l'accent réservé aux
actions principales. Deux instances côte à côte plutôt qu'un basculement de vue : la lecture
utile est _où sont les trous_, elle a besoin des deux moitiés dans l'œil en même temps.

**Nouvel écran `/settings/about`.** CC BY-SA 4.0 §3(a) exige que l'attribution accompagne l'œuvre
« par tout moyen raisonnable au vu du support » : un fichier dans le dépôt couvre qui clone, pas
qui installe la PWA. L'ancien NOTICE Apache-2.0 de `body-muscles` avait le même trou — il part
avec la géométrie qu'il couvrait.

L'ancien code vit sur la branche `archive/body-map-vendor`, poussée avant toute suppression.
`Z-Anatomy.zip` (102 Mo) est désormais ignoré : au-delà de la limite dure de GitHub, et c'est une
source, pas un produit.

**La rampe ne part pas de zéro, et c'est un correctif du téléphone.** Posée sur `--surface-2`,
la masse éteinte donnait **1,11:1** sur une carte `--surface-1` : le corps disparaissait et le
dessin se lisait en fil de fer, ses contours portant seuls la forme. Le muscle non travaillé
démarre donc à un cinquième de la rampe (2,05:1 en sombre, 1,71:1 en clair), et la silhouette —
tête, mains, pieds, sans contour propre — passe juste en dessous. Pas plus haut : un corps éteint
trop clair efface le trou, qui est précisément ce que ce dessin sert à montrer.

Checkpoint téléphone : ouvrir une fiche d'exercice et le bilan musculaire, vérifier que le dessin
reste lisible à cette taille — il est bien plus détaillé que l'ancien pour la même hauteur.

**Avant cela :** 2026-08-13 (**Lot 17 — périodisation et programmes multi-semaines : l'app sait
enfin où tu en es dans le bloc**).

Le lot que l'audit désignait comme **la** valeur ajoutée face à Hevy est livré : un bloc de 4 à
12 semaines, un split hebdomadaire versionné, une prescription par semaine (% du 1RM ou RPE
cible), des décharges planifiées, et un démarrage de séance depuis l'accueil — la bonne séance,
avec les bonnes charges, au bon jour.

**Six décisions valent d'être retenues, parce qu'aucune ne se relit dans le code.**

**1. Le bloc se décale en semaines entières, jamais en jours.** Le champ demandait un nombre de
jours ; décaler de 3 jours désalignait le bloc du lundi et faisait tomber la « semaine 5 » à
cheval sur deux semaines civiles. Le décalage se saisit maintenant en semaines (positif pour
repousser, négatif pour avancer) et le calage au lundi est un invariant, pas une intention. Le
champ reste **une saisie clavier bridée**, pas un sélecteur de préréglages.

**2. Une révision de split n'est jamais rétroactive.** On peut préparer le split d'une semaine
future, jamais réécrire une semaine déjà vécue. Et la semaine courante **disparaît du choix dès
qu'une séance du bloc y est enregistrée** : sinon la séance d'hier se retrouverait rattachée à un
split qui n'existait pas quand elle a été faite. La règle vivait en double — une fois dans la
publication de version de routine, une fois dans l'éditeur de programme ; elle est désormais
écrite une seule fois dans `programSchedules.ts`, parce que deux copies d'une règle finissent
toujours par diverger.

**3. Les replis de prescription se confirment, ils ne se subissent pas.** Un % du 1RM ne se
projette pas toujours : pas de 1RM utilisable, mesure qui ne se convertit pas en pourcentage,
exercice en assistance (où « 70 % » n'a aucun sens). Dans ces cas la cible écrite dans la routine
est conservée — mais **une feuille le dit, exercice par exercice, avant la moindre écriture en
base**, et il faut « Démarrer quand même ». Une séance qui démarre avec des charges silencieusement
différentes de la prescription, c'est pire que pas de programme du tout.

**4. Le programme a autorité sur le Coach du Lot 18.** `finalizeCoachForWorkout` n'émet plus de
recommandation de charge en fin de séance **programmée**. Les deux avaient raison chacun de leur
côté et se contredisaient à l'écran : le bloc dit « semaine 5, décharge à 60 % », le coach dit
« +2,5 kg car 3×12 atteint ». Quand un bloc pilote la charge, c'est le bloc qui parle.

**5. Un seul bloc actif, et le remplacer se demande explicitement.** Activer un deuxième bloc ne
« désactive » pas silencieusement le premier : une confirmation annonce que le bloc actif sera
**terminé avec tout son historique**, puis le nouveau prend sa place.

**6. Une routine supprimée n'invalide qu'une ligne.** Si une routine du split disparaît, sa
séance affiche « Routine indisponible » avec un bouton de réparation vers l'éditeur ; les autres
séances de la semaine restent démarrables. Un split n'est pas tout ou rien.

**Ménage de fin de lot :** trois clés i18n mortes supprimées (`shiftDaysLabel`, `shiftDaysHint`
restées du décalage en jours, `editWeek` remplacée par sa version lue à voix haute), et le détail
d'un bloc passait l'`entryId` dans le champ `routineId` des candidats — sans effet aujourd'hui
puisque `pickProgramSession` ne lit pas ce champ, mais c'était une mine posée pour le prochain qui
le lirait.

**Ce qui n'est pas fait :** rien dans le périmètre du lot. La version applicative n'est pas
montée — le lot est terminé, la release ne l'est pas.

Portes locales : lint, typecheck, **1434 tests dans 127 fichiers**, build PWA.

**Checkpoint téléphone à valider** (aucun ✅ ne sera coché sans lui) : créer un bloc de 8 semaines
avec une décharge en semaine 5, vérifier que l'accueil propose la bonne séance le bon jour avec la
prescription de la semaine, publier une nouvelle version d'une routine du split à partir d'une
semaine future, décaler le bloc d'une semaine, et refaire le tout **en mode avion**.

**Puis :** 2026-08-12 (**Release v0.3.3 — le coach sait enfin redescendre**).

La cinquième règle, `range_missed` : **deux séances de suite sous le bas de fourchette, à la même
charge → un incrément en moins.** C'est la moitié de RF-48 que le roadmap promettait depuis le
début et que le plan détaillé n'avait jamais retenue, sans que l'abandon soit consigné.

**Le « maintien » n'est volontairement pas un signal.** Le roadmap dit « maintien puis
diminution ». Mais un signal qui parle dès le premier bas de fourchette manqué parlerait presque
chaque séance — le « crier au loup » corrigé quelques heures plus tôt, refait à l'identique.
L'absence de reco **est** le maintien : c'est déjà ce que l'app dit quand elle se tait. Une seule
mauvaise séance, c'est du sommeil, un repas tardif ou un rack occupé, pas un programme à corriger.

**Deux garde-fous dans la règle :**

- **La même charge dans les deux séances**, sinon ce ne sont pas deux tentatives de la même chose
  et il n'y a rien à conclure.
- **Les séances de deload sont exclues**, comme partout ailleurs : les charges y baissent exprès.

**`previousLoad` est le miroir exact de `nextLoad`**, même grille, même arrondi, deux inversions
de signe pour l'assistance — reculer sur une machine assistée, c'est **remettre** du poids
dessus. Un test vérifie l'aller-retour : `previousLoad(nextLoad(x)) === x`, charge libre comme
assistée.

**Sévérité 50, au-dessus de `range_completed`** : échouer deux fois est plus urgent que réussir
une fois. Les deux ne peuvent de toute façon jamais coexister — l'une exige toutes les séries au
sommet de la fourchette, l'autre une série sous son plancher. En revanche `range_missed` masque
bien la « baisse de reps » qui l'accompagne forcément, et c'est voulu : entre une observation et
une charge à appliquer, c'est la charge qui vaut la place.

**Deux tests ont dû changer, et ce ne sont pas les assertions qui étaient en cause.** Les
fixtures de `plateau` et du deload de `coachEvaluate` prescrivaient une fourchette 8–12 puis
faisaient des séries de 5, deux séances d'affilée à la même charge : exactement la nouvelle règle.
Le moteur avait raison, la donnée de test était incohérente. Les fourchettes ont été alignées sur
ce qui est soulevé, pas les attentes sur ce qui sortait.

Portes locales : lint, typecheck, **1320 tests dans 119 fichiers**, build PWA.

**Mise à jour précédente :** 2026-08-12 (**Release v0.3.2 — le coach arrête de crier au loup, et un
refus ne l'éteint plus**).

Deuxième retour de terrain de la journée, quatre corrections. Trois d'entre elles sont des défauts
que seule une vraie séance pouvait révéler.

**1. La règle de chute de reps criait au loup.** Signalé : `80×12, 12, 12, 10` sur une fourchette
8–12 déclenchait « chute en séance ». Or 10 est **dans la prescription** — la fourchette dit 8 à
12, et finir à 10 c'est la respecter. `intraSessionDropSignal` ignore désormais une série qui
reste au-dessus du bas de fourchette ; seule une série qui **passe sous le plancher** est une
nouvelle. Un coach qu'on apprend à ignorer est un coach qu'on n'écoutera plus le jour où il a
raison. Deux tests gardent les deux côtés (silence à 10, signal à 7).

**2. La flèche voulait dire deux choses opposées.** La carte d'objectif dit `47,5 → 50 kg`
(« fais ça ») et l'observation disait `12 → 10 reps` (« j'ai vu ça ») — même grammaire visuelle,
sens inverses, introduits le même jour. L'observation devient « Baisse de reps observée : 12 puis
10 (−2). » La flèche reste réservée à ce qui se fait.

**3. Un refus éteignait la règle à vie.** `sameProposal` traitait « même exercice + même code +
pas de charge » comme la même proposition : refuser une fois « chute de reps » suffisait à ne
plus jamais la revoir sur cet exercice. Or refuser porte sur un **chiffre** (« non, pas 50 kg »),
pas sur une règle. Un signal sans charge n'est donc plus jamais mis en sourdine durablement — son
refus finit avec sa séance. Une règle qu'un seul appui peut tuer est une règle sur laquelle on ne
peut plus compter.

**4. L'appui : un chevron, pas une phrase.** « Appuyer pour appliquer aux séries restantes »
disparaît au profit du `ChevronRightIcon` déjà utilisé par `ListRow` pour « cette ligne fait
quelque chose ». Une phrase qui explique qu'une carte est tapable se lit une fois et s'enjambe
ensuite pour toujours. Et **la carte se ferme dès qu'on a appuyé** : appliquer, c'est accepter,
donc la reco passe en `followed` et sort de la file d'attente. Elle se ferme parce qu'elle quitte
`pending`, pas par un drapeau local qu'un remontage oublierait (règle n°4).

**Compromis assumé du point 4 :** si tu appliques puis que tu changes la charge en cours de
série, le journal dira « suivie » à la charge proposée. Marquer l'intention est plus juste que de
ne rien marquer, et `reconcileFollowedLoads` continue de rattraper le cas inverse — suivre la
proposition sans avoir appuyé.

**Ce qui restait ouvert : la baisse de charge.** — **livrée le jour même en v0.3.3**, cf. l'entrée
en tête de fichier.

Portes locales : lint, typecheck, **1305 tests dans 119 fichiers**, build PWA.

**Mise à jour précédente :** 2026-08-12 (**Release v0.3.1 — le coach s'applique d'un appui, et le
« +50 kg » qui voulait dire « passe à 50 »**).

Première session de terrain du Lot 18. Trois retours, dont un vrai bug, une fausse alerte et une
demande.

**1. Le libellé disait l'inverse de ce qu'il voulait dire.** La carte affiche déjà la charge à
mettre sur la barre en gros — `50 kg` — et la phrase en dessous reprenait la **même** valeur
derrière un `+` : « +50 kg car 3 × 12… », pour dire « passe à 50 ». Lu en salle, ça se comprend
comme « ajoute cinquante kilos ». Le libellé est maintenant un pas entre deux nombres :
`47,5 → 50 kg car 3 × 12 a atteint le haut de la fourchette.` La variante assistance garde la
même flèche avec le chiffre qui descend. `coachCopy.test.ts` verrouille les trois cas, dont un
`not.toContain('+')` explicite.

**2. « Aucune carte Coach en séance » n'était pas un bug.** Vérifié en rejouant la séquence en
base : une séance terminée en haut de fourchette laisse bien une reco en attente pour la
suivante. La cause est structurelle et attendue — `version(5)` crée le journal **vide**, sans
rattrapage, et une reco n'est écrite qu'à l'**enregistrement** d'une séance sous 0.3.0. Il faut
donc une séance sauvegardée avant que la carte ait quoi que ce soit à montrer. L'historique
antérieur n'est pas perdu pour autant : le moteur le lit à chaque évaluation (le plateau en a
besoin). Rien à corriger, mais à savoir avant de conclure à une panne.

**3. Un appui sur la carte applique l'objectif** (`applyCoachObjective`, demande utilisateur).
Ça ne rouvre pas la décision « ne jamais pré-remplir » de la tranche 3 : ce qui était interdit,
c'est que l'app décide seule — un chiffre qui apparaît tout seul est un chiffre qu'on arrête de
lire. Là c'est un geste explicite, et rien n'est verrouillé après. Les règles d'écriture sont
calquées sur `applyWorkoutDeload`, volontairement : une série déjà validée n'est **jamais**
réécrite, une série vierge reçoit une **cible** (le champ reste à remplir), une série déjà
saisie voit sa valeur remplacée. Le statut de la reco n'est pas touché à l'appui — c'est
`reconcileFollowedLoads` qui tranche en fin de séance sur ce qui a réellement été soulevé,
et non sur une intention.

Le geste est écrit sur la carte (« Appuyer pour appliquer aux séries restantes ») : une cible
tactile que rien n'annonce est une cible que personne ne trouve, encore moins entre deux séries.
« Ignorer » reste un bouton distinct à côté, à 48 px.

Portes locales : lint, typecheck, **1301 tests dans 119 fichiers**, build PWA.

**Checkpoints validés par l'utilisateur le 2026-08-12 :** Lots **5bis, 7, 8, 9, 10, 12, 13**.
Le Lot 18 reste partiel — l'incrément par exercice et la proposition de fin de séance sont
vérifiés en salle, la carte en séance et « Ignorer » attendent la prochaine séance (voir le
point 2 ci-dessus). Le deload est invérifiable à la main sans semaine de décharge : il est
couvert par `coachEvaluate.test.ts` (« pas de faux plateau en deload ») et validé par le code,
pas par l'usage. La courbe de progression attend d'avoir assez d'historique.

**Mise à jour précédente :** 2026-08-11 (**Lot 18 — coach déterministe, RF-48, sans IA**).

Plan suivi scrupuleusement : `docs/plans/lot-18-coach-deterministe.md`.

**Release Android v0.3.0 :** version applicative alignée sur le tag de publication. Le push de
`master` déploie la PWA et construit l’APK ; le tag `v0.3.0` publie l’APK dans GitHub Releases.

**Tranche 0 — mesure RPE avant toute règle de fatigue.** Source :
`%USERPROFILE%\Downloads\workout_data.csv` (export Hevy/FitTrack, 136 séries de travail).
Séries avec RPE : **0**. Taux : **0 %** (seuil ~50 %). **Décision figée :** les détections
qui exigent un RPE (charge trop lourde, signes de deload) restent hors V1. Les quatre règles
du plan (fourchette, chute intra-séance, plateau, repos long corrélé) n'utilisent pas le RPE
et sont livrées telles quelles. Ne pas contourner ce résultat.

**Tranche 1 — incrément de charge.** `Exercise.loadIncrementKg?` (non indexé, pas de
migration de backfill — défauts calculés), table `DEFAULT_LOAD_INCREMENT_KG` typée
`Record<Equipment, number>`, `nextLoad` qui inverse l'assistance, saisie dans « Tes réglages »
à côté du repos.

**Tranche 2 — moteur pur `src/lib/coach/`.** Signaux typés, jamais de phrases. Quatre règles,
comparateur un signal par exercice. Deload exclu des comparaisons ; imports Hevy sans
fourchette muets pour la double progression ; deux lignes du même exercice dans une séance
recollées.

**Tranche 3 — journal `coachRecommendations` (`version(5)`).** Statut pending / followed /
dismissed. Un refus à la même charge + même code ne revient pas. Réinjection : objectif
proposé en séance, **sans pré-remplir** la série.

**Tranche 4 — UX.** Carte Coach en séance (objectif + Ignorer), signaux en fin de séance sous
le corps, historique sur la fiche exercice. Accent interdit sur la carte (charte). Chaque
reco affiche le chiffre qui l'a produite.

**Revue des quatre tranches — trois corrections, toutes couvertes par des tests.** Les trois
bugs touchaient des pièges que le plan avait pourtant écrits :

- **Plateau sur machine assistée.** `nextLoad` inversait l'assistance, `plateauSignal` non :
  trois séances passant de 30 à 20 kg d'aide — de la vraie progression — sortaient un
  `plateau`. La règle est désormais **muette sur `weightRole === 'assist'`** : sans le poids
  du corps à soustraire, il n'y a rien d'honnête à comparer, et le moteur se tait plutôt que
  de lire un progrès comme une stagnation. C'est une limite assumée, pas un oubli.
- **Le journal enregistrait les succès comme des refus.** `recordCoachSignals` tournait avant
  `reconcileFollowedLoads` et passait la reco vivante à `dismissed` ; suivre le conseil _et_
  re-valider la fourchette effaçait donc la preuve. Ordre inversé, et nouveau statut
  **`superseded`** distinct de `dismissed` — un remplacement n'est pas un refus, et il ne doit
  pas interdire à cette charge de revenir.
- **Les drop sets déclenchaient « chute intra-séance ».** `isWorkingSet` n'exclut que
  l'échauffement. Nouveau `progressionSets` : séries de travail au sommet de la charge du
  jour, drop sets et séries de délestage exclus (avec l'inversion assist). Corrige aussi
  `range_completed`, qui proposait la charge suivante à partir du poids du drop set.

Plus : le coach ne bloque plus la fin de séance s'il jette, les échauffements ne comptent plus
comme charge de travail suivie, l'index `[exerciseId+status]` sert enfin, une observation sans
chiffre n'est plus étiquetée « Objectif proposé », et la fiche exercice n'affiche plus de carte
« Recommandations » vide.

Portes locales : lint, typecheck, **1299 tests dans 117 fichiers**, build PWA.

**Checkpoint téléphone :**

- [ ] Exercice barre / haltères / machine assistée : incrément crédible et modifiable.
- [ ] Valider toute une fourchette : fin de séance propose la charge suivante **avec**
      l'explication ; à la séance d'après l'objectif apparaît sans pré-remplir.
- [ ] Séance en deload : pas de faux plateau.
- [ ] **Machine assistée sur 3 séances : aucun plateau annoncé** (règle volontairement muette).
- [ ] **Séance avec drop set : aucune « chute en séance » signalée.**
- [ ] **Suivre une reco puis re-valider la fourchette : la fiche exercice affiche « Suivie »**,
      pas « Ignorée ».
- [ ] Ignorer une reco : elle ne revient pas à la charge identique.
- [ ] Migration `version(5)` au premier lancement : l'app s'ouvre, le journal Coach est vide
      tant qu'aucune séance n'a produit de signal.

**La vraie mesure vient après 3–4 semaines d'usage** — le « terminé » du lot sera long à
prononcer, et c'est normal.

**Mise à jour précédente :** 2026-08-11 (**Release Android v0.2.0 — records persistés, 1RM
estimé et schéma musculaire**).

Deux chantiers menés en parallèle, fusionnés pour cette release. Les deux entrées qui suivent
les décrivent en détail ; ce qu'il faut retenir de la fusion elle-même :

- **Aucune collision de migration.** La crainte consignée avant la fusion ne s'est pas
  matérialisée : le chantier des records n'a ajouté aucune version Dexie, donc la
  `version(4)` des muscles secondaires garde son numéro et son ordre.
- **`differs` de `historyRepair` a été étendue des deux côtés**, et les deux extensions sont
  justes : le coefficient de charge au poids du corps d'un côté, les muscles secondaires de
  l'autre. Les deux sont gardées — c'était le seul conflit de logique de la fusion.
- **Une assertion périmée sur la précision du 1RM** a été trouvée indépendamment par les deux
  sessions, et corrigée à la même valeur : une décimale, pas deux. `master` était rouge avant
  la fusion à cause d'elle — le test échouait sur `master` seul, sans aucune modification.

**Mise à jour précédente :** 2026-08-11 (**Lot 5bis — schéma musculaire, quatre écrans, et les
muscles secondaires figés dans l'instantané**).

> ⚠️ **À LIRE AVANT DE FUSIONNER `claude/lot-5bis-body-map`.**
>
> Cette branche ajoute **`this.version(4)`** dans `data/db.ts` (backfill des muscles
> secondaires). Une session parallèle travaille sur les records persistés et le 1RM estimé
> (design et plan déjà sur `master`), et persister `personalRecords` avec un recalcul complet
> demandera probablement **sa propre migration**.
>
> Deux `version(4)` fusionnées donnent soit une erreur Dexie, soit **pire et en silence** : un
> numéro déjà consommé sur le téléphone, et l'upgrade de l'autre branche qui ne s'exécute
> jamais. Aucune des deux sessions ne peut détecter ça seule — chacune ignore la migration de
> l'autre.
>
> **La règle : celui qui fusionne en second renumérote en `version(5)`.** Et l'ordre compte —
> un recalcul qui lit les instantanés doit passer **après** le backfill des secondaires, jamais
> avant. Vérifier ensuite `db.verno` dans `dbMigration.test.ts`, qui assère le numéro courant.
>
> Le reste ne se recoupe pas : `lib/records.ts` n'a pas été touché ici, et `best_1rm` était
> déjà déclaré dans `PersonalRecordType` avant les deux branches. Un conflit sur ce fichier est
> attendu et se règle à la main.

Le schéma est posé sur **quatre écrans** : la fiche exercice (ce qu'un mouvement travaille),
la fin de séance et le détail d'une séance au Journal (ce que cette séance a travaillé), et
« Séries par muscle » (tout ce que tu as travaillé). Un seul composant, une seule prop
`highlight`, trois façons de la calculer.

**Les muscles secondaires sont désormais figés dans l'instantané — `version(4)`.** Sans eux, un
développé couché allumait les pectoraux et laissait les triceps éteints : le dessin était faux
par rapport à ce qu'on sent. J'avais d'abord annoncé que corriger ça imposait de rouvrir la
décision 08B ; **c'était faux, et c'est la correction la plus utile de cette session.** 08B
interdit de lire la bibliothèque _au moment de l'affichage_ pour interpréter une séance passée
— c'est ainsi que la même séance a eu deux noms sur un même écran. Écrire la bibliothèque
d'aujourd'hui **une fois** dans l'instantané est le mouvement inverse : à partir de là, la ligne
répond d'elle-même et cesse de dépendre du catalogue. C'est le marché que `version(2)` avait
déjà fait et documenté — la meilleure information disponible, et la seule.

Deux garde-fous à ne pas perdre de vue :

- `resolveExerciseIdentity` ne retombe sur la bibliothèque pour les secondaires **que si la
  ligne n'a aucun instantané du tout**. Une ligne instantanée sans secondaires est soit
  antérieure au champ, soit celle d'un exercice qui n'en a réellement aucun — emprunter ceux
  d'aujourd'hui dans le second cas serait exactement la réécriture que 08B interdit. Un test
  garde ce cas.
- `snapshotOf` **copie** le tableau au lieu de le référencer. Le partager ferait qu'éditer un
  exercice réécrirait silencieusement les séances passées. Un test le vérifie en mutant la
  source.

**Les chiffres restent des comptes, seul le dessin est pondéré.** `muscleBalance` continue de
ne compter que le muscle principal, et son argument tient : « 48 » doit rester un nombre de
séries qu'on peut recompter dans l'historique. Un dessin n'a pas ce devoir — il ne se lit pas,
il se regarde. Donc `sessionMuscleInvolvement` pondère (1 pour le muscle visé, 0,4 pour chaque
muscle sollicité, les deux chiffres que la fiche exercice affiche déjà) et son champ s'appelle
`value`, jamais `sets`.

**Les quatre dessins suivent la même règle**, y compris l'agrégat. `HistoricalExercise` diffuse
déjà l'identité entière, donc les secondaires y arrivaient gratuitement : il a suffi de les
déclarer et de les faire porter par `MuscleRow`. L'écran « Séries par muscle » calcule donc
maintenant son dessin par `muscleInvolvement(rows)` et **non** par ses propres comptes — un
corps, une règle. Le module s'appelle `lib/analytics/involvement.ts` (renommé depuis
`sessionMuscles.ts`, qui ne décrivait plus que la moitié de son usage).

Vérifié après migration sur la base du preview : le backfill a bien écrit
`['triceps','shoulders']` sur les lignes de développé couché ; une séance passe de 18 à 28
régions allumées avec une rampe à six niveaux, arithmétiquement conforme ; et sur l'écran
d'équilibre, le dessin est pondéré pendant que la liste continue d'afficher des séries entières
(30, 24, 18, 18, 0, 0).

**Mise à jour précédente :** 2026-08-11 (**Lot 5bis — schéma musculaire sur la fiche exercice**).

RF-06 réclamait « image ou démonstration animée » depuis le Lot 2 et le champ `imageUrl` n'a
jamais été rempli. La moitié à notre portée est livrée : la fiche d'un exercice montre
désormais une silhouette de face et de dos, avec les muscles travaillés allumés.

**La géométrie est reprise, pas dessinée.** 89 régions SVG de
[`vulovix/body-muscles`](https://github.com/vulovix/body-muscles) au commit `15c8085`, sous
Apache-2.0, avec le texte de la licence et le NOTICE dans `licenses/body-muscles/`. Seuls les
tracés sont repris — ni le composant amont, ni sa rampe de couleurs : le §8 exclut les
composants tiers, et réutiliser des coordonnées n'est pas en dépendre. Zéro dépendance ajoutée
au `package.json`. **Réserve consignée :** la provenance du dessin n'est pas documentée en
amont, le NOTICE revendique la paternité sans citer de source antérieure. On s'appuie sur cette
déclaration, comme pour tout actif open source — c'est une déclaration, pas une preuve, et le
dépôt est public.

**Une rampe de valeur, pas une couleur.** La charte réserve l'accent aux actions principales,
aux séries validées et aux records ; `MuscleBalanceCard` le documente et tous les écrans
d'analytics s'y tiennent. Un muscle allumé est donc la même encre que le texte, posée sur la
surface du corps à l'intensité travaillée. Deux couches plutôt qu'une, pour n'avoir aucune
couleur à interpoler et pour qu'un muscle allumé ne passe jamais derrière une région dessinée
après lui.

**Le piège annoncé par le roadmap était déjà désamorcé.** `MUSCLE_SCOPE` (Lot 12) classait déjà
les 19 groupes en `region` / `unscoped`. Il passe d'une annotation à `satisfies` — une
annotation élargit les valeurs et la distinction disparaît au niveau du type — ce qui permet
d'en dériver `RegionMuscle` et de typer la table de correspondance dessus. Classer un nouveau
groupe en `region` sans lui donner d'endroit où être dessiné **casse le typecheck**.

**Trois arbitrages, tous commentés sur place :** les trois bandes du trapèze sont réparties
comme les mouvements le font (haussement → `traps`, tirage → `upper_back`) ; le grand dentelé
reste éteint plutôt que replié dans `abs` ; et un exercice dont le muscle principal n'a pas de
région — 18 entrées du catalogue, dont le stepper — **promeut ses secondaires à pleine
intensité**, parce que 0,4 ne veut dire quelque chose que par rapport à un principal.

Portes locales : lint, typecheck, build PWA, **1089 tests dans 98 fichiers**. Vérifié dans le
navigateur à 375 px : 96 × 256 px par silhouette, section de 417 px (comparable aux 480 px de
« Tes réglages »), aucun débordement horizontal, 14 régions allumées sur le développé couché
(pectoraux à 1, triceps et épaules à 0,4), 12 à pleine intensité sur le stepper, et **aucune
section** sur « Mobilité », qui n'a rien à montrer.

**Trois défauts de rendu corrigés, tous remontés par l'utilisateur et tous mesurés avant
correction** — c'est la leçon transverse de la session : chacun était invisible aux tests et
aux mesures au DOM.

1. **Le corps était invisible.** Remplissage à 1,11:1 contre la carte, contour à 1,45:1, trait
   rendu à 0,28 px. Corrigé en `--axis` à 0,3.
2. **Les muscles allumés avaient perdu leur contour.** Le remplissage clair recouvrait le trait
   de sa propre région — mesuré en rasterisant à 4× : _pas un pixel allumé ne touchait un pixel
   de trait_. Le trait est passé en troisième couche, au-dessus des deux remplissages. Ça
   referme aussi les coutures d'un pixel entre régions voisines.
3. **« C'est anguleux. »** Vérifié : **836 sommets pour 8 commandes de courbe**, soit 0,9 %. La
   géométrie est polygonale par construction. `roundPath` coupe chaque sommet et le franchit
   par une quadratique passant par le sommet d'origine — le seul lissage qui ne peut pas
   inventer de forme, la courbe restant dans le triangle du coin. Part de courbes portée à
   48,7 %, surface dessinée perdue : 0,9 %. Le module est **conservateur par défaut** : un
   tracé portant déjà une courbe, un triangle (souvent un doigt), ou une coupe qui mordrait
   plus d'un tiers d'une arête reviennent intacts.

**Ce qu'aucun correctif ne règlera : le registre.** Les tracés du fournisseur restent des
approximations grossières. Enquête faite : toute la famille `react-body-highlighter` est de
même nature, et le seul candidat au dessin plus fin n'a **aucune provenance documentée** —
motif d'exclusion déjà retenu pour `free-exercise-db`. Une planche de stock coûte quelques
dizaines d'euros mais ses conditions interdisent de redistribuer le fichier source, ce qu'un
SVG commité dans un dépôt **public** fait par définition. **La vraie question n'est donc pas le
prix, c'est de savoir si le dépôt passe en privé** — auquel cas la planche anatomique _et_ les
168 illustrations d'exercices (~150 $) se débloquent d'un seul coup. Décision de l'utilisateur
le 2026-08-11 : **on en reste là pour le moment.**

**Le corps était invisible, et les mesures au DOM ne l'ont pas vu.** Remonté par l'utilisateur
(« je ne vois absolument aucun schéma ») après une première passe déclarée vérifiée. Le
remplissage `--surface-2` du corps mesure **1,11:1** contre la carte et le contour `--border`
**1,45:1** ; en prime, `stroke-width` à 0,1 dans un viewBox large de 35 se rend à **0,28 px**.
Le corps était un fantôme et seuls les muscles allumés ressortaient — des taches blanches
flottantes, pas une anatomie. Contour repassé en `--axis` (l'encre de trait de la charte,
3,5:1 sur une carte) à `stroke-width` 0,3, soit 0,82 px.

**La leçon, et elle vaut au-delà de ce lot :** géométrie mesurée ≠ chose visible. Compter des
nœuds, des tailles et des `fill-opacity` au DOM prouve que le dessin _existe_, jamais qu'on le
_voit_. La contre-mesure est de rasteriser : le SVG est sérialisé avec ses variables résolues,
dessiné sur un canvas par-dessus la couleur de la carte, et les pixels sont comptés. Après
correction : 62 488 px de fond, **14 474 px de corps**, **4 170 px de contour**, 2 065 px de
muscle allumé, et **10,7 % du raster à 3:1 ou mieux** contre 2 % avant. C'est une vérification
qui marche sans capture d'écran, donc sans panneau navigateur affiché.

**Checkpoint téléphone :**

- [ ] Ouvrir « Développé couché (barre) » : les pectoraux sont allumés à fond, les triceps et
      les épaules en second, et ça correspond à ce que tu sens le lendemain.
- [ ] Ouvrir « Escalier (stepper) » : les jambes sont allumées, et « Cardio » reste écrit sous
      « Principal » sans rien allumer.
- [ ] Ouvrir « Mobilité » : aucune silhouette, pas un corps gris et muet.
- [ ] Terminer une séance : le corps de l'écran de fin ne montre que ce qui est enregistré,
      échauffements exclus — puis rouvrir la même séance au Journal et retrouver **le même
      dessin**.
- [ ] Analytics → Séries par muscle : les muscles jamais travaillés restent sombres, et la
      liste dessous affiche toujours des séries entières.
- [ ] Vérifier que la silhouette ne mange pas l'écran au point de rendre les records pénibles à
      atteindre.
- [ ] **La migration `version(4)` s'exécute sur ta vraie base au premier lancement.** Vérifier
      qu'un développé couché du passé allume bien ses triceps, et qu'aucune séance ancienne n'a
      changé de chiffre.

**Mise à jour précédente :** 2026-08-11 (**Records persistés, 1RM estimé et préparation
Android v0.2.0**).

Les records ne sont plus recalculés à l'affichage : ils sont **persistés** dans la table
`personalRecords` et rejoués comme une projection. Chaque série validée écrit ses records dans
la **même transaction** que la série — un crash entre les deux est impossible, conformément à
la règle « pas de perte de données ». Les catégories couvertes sont la charge max, le nombre max
de répétitions, la durée max, la distance max, l'assistance minimale, la meilleure série
(tonnage), le tonnage de séance et le **1RM estimé**. La formule d'estimation se choisit dans
Réglages → Entraînement (Epley par défaut, Brzycki, Lombardi) ; la changer ne touche **que** les
records `best_1rm`. Les valeurs brutes sont stockées en pleine précision, l'affichage arrondit —
au centième en général, au dixième de kg pour le 1RM, la précision du graphique.

La projection porte un numéro de version (`PERSONAL_RECORDS_PROJECTION_VERSION`). Au démarrage,
si la version enregistrée diffère, l'historique existant est reconstruit une fois en tâche de
fond — c'est ce qui rattrape les séances antérieures à cette version sans bloquer l'app. Toute
mutation qui peut déplacer un record le réconcilie : fin de séance, suppression, dévalidation
d'une série, édition ou suppression d'une séance passée, import Hevy, et correction d'une pesée
datée (qui ne rejoue que l'intervalle concerné, pour les exercices au poids du corps). Un
« Réparer les records » manuel reste disponible dans Réglages, et il est idempotent.

Nouvel écran **Records** (Progression → Records, ou depuis une fiche d'exercice, filtré) : un
rail chronologique des jalons, filtrable par exercice et par catégorie.

Portes locales : lint, typecheck, **1191 tests dans 108 fichiers**, build PWA, `android:sync`.

Une assertion périmée traînait dans `ExerciseDetailScreen.test.tsx` : elle attendait encore
`137,34 kg` alors que l'affichage du 1RM arrondit désormais au dixième. C'est le test qui avait
tort — la valeur brute persistée reste bien 137,34 —, l'assertion attend maintenant `137,3 kg`.

Benchmark `npm run bench:records` (fake-indexeddb, Node sous Windows, 2 000 séances × 8
exercices × 4 séries = 64 000 séries) : reconstruction complète initiale **3,85 s**,
reconstruction complète idempotente **5,71 s** (moyenne), reconstruction ciblée sur un exercice
**560 ms**, lecture du rail (les plus récents d'abord) **7,1 ms**. La lecture quotidienne est
donc ~80× plus rapide que la moindre reconstruction : la reconstruction complète reste réservée
au rattrapage de version et au bouton de réparation, jamais au chemin d'écriture. Dette assumée,
inchangée : pas d'index supplémentaire tant qu'un vrai téléphone ne dépasse pas 100 ms sur une
lecture de rail — un chiffre de `fake-indexeddb` ne justifie pas une migration de schéma.

Scénario local-first rejoué au navigateur à 375 px sur le serveur de dev, à travers les
dépôts et l'UI : première série validée → aucun message de félicitations mais un « Premier
jalon » sur Records ; amélioration stricte → la mention « 3 records » apparaît sous la bonne
série et le rail s'ouvre dessus ; égalité → aucun doublon ; édition à la baisse de l'ancien
record dans l'historique → le jalon précédent redevient courant (105 kg ramené à 95 kg, le
record retombe à 100 kg) ; bascule Epley → Brzycki → seul le 1RM change (116,7 → 112,5 kg) ;
rechargement complet → tout survit ; réparation manuelle → 0 créé, 0 modifié, 0 supprimé.
Aucune requête réseau hors du serveur de dev pendant tout le scénario.

**Checkpoint téléphone :** installer `FitTrack-v0.2.0.apk` par-dessus l'app existante **sans la
désinstaller** — c'est tout l'intérêt, le premier lancement doit rattraper l'historique existant
sans bloquer l'usage. À vérifier : le rail Records s'ouvre depuis Progression et reste fluide
sur l'historique complet ; une amélioration en séance apparaît tout de suite et survit à un
force-stop ; noms d'exercices longs, grandes valeurs, filtres et texte à 200 % restent lisibles ;
changer de formule met à jour les 1RM et le graphique ; une édition, une suppression, un import
ou une correction de pesée déplace bien les jalons concernés ; « Réparer les records » ne perd
aucune séance.

**Mise à jour précédente :** 2026-08-11 (**Champ du poids sur toute la ligne et préparation
Android v0.1.5**).

Rattrapage : la branche `claude/locked-exercise-card-padding-296653` portait un correctif jamais
fusionné, découvert en inventoriant les branches après coup — il n'était donc pas dans la v0.1.4.
Sur l'accueil, le champ du poids partageait sa ligne avec le bouton « Enregistrer » : il ne
mesurait que 85 px, dont 36 px de chaque côté pour les pas et le « kg », soit 13 px de texte.
« 80,5 » débordait et sa décimale était rognée — la pesée avait l'air tronquée. Le champ prend
maintenant la ligne entière et l'action passe dessous, la même disposition que la feuille
d'objectif hebdomadaire. Mesures relevées dans l'app par la session d'origine : 207 px de champ
à 375 px de large, 152 px à 320 px, rien de rogné jusqu'à « 1000,5 ».

Le commentaire introduit par ce correctif était rédigé en français ; il est repassé en anglais,
conformément à la règle « code et commentaires en anglais, interface en français ».

La version applicative est `0.1.5`. Portes locales : lint, typecheck, **1070 tests dans 96
fichiers**, build PWA — et `HomeBodyWeightCard.test.tsx` rejoué 5 fois après la fusion, vert à
chaque passe : le correctif d'attente tient malgré le changement de disposition.

**Checkpoint téléphone :** installer `FitTrack-v0.1.5.apk` par-dessus l'app existante sans la
désinstaller. Sur l'accueil, taper « 80,5 » dans le poids du jour : la décimale doit rester
lisible, le champ occuper toute la ligne et le bouton tenir dessous. La disposition n'a **pas**
été revérifiée au navigateur pendant cette session — c'est le point à regarder en premier.

**Mise à jour précédente :** 2026-08-11 (**Test instable du poids du corps et préparation
Android v0.1.4**).

Le test intermittent signalé dans la note précédente est corrigé, et c'était bien le test, pas
l'app. Le paragraphe `role="status"` de `HomeBodyWeightCard` est rendu en permanence — il porte
une espace insécable au repos — donc `findByRole('status')` renvoyait aussitôt l'élément vide et
l'assertion de texte courait contre l'écriture asynchrone : au hasard de l'ordonnancement, elle
lisait la chaîne vide. Les deux assertions de succès attendent maintenant le texte lui-même
(`findByText`), pas le rôle. Le second cas, « saves a first value and announces success », avait
le même défaut sans l'avoir encore montré : son `waitFor` sur le compteur Dexie est satisfait
_à l'intérieur_ de `saveBodyWeight`, avant que React n'ait re-rendu l'état `saved`. L'assertion
sur `findByRole('alert')` est laissée telle quelle — le rôle `alert` n'existe que dans l'état
d'erreur, donc la requête est sa propre attente. Aucun texte attendu n'a été touché.

La version applicative est `0.1.4`. Elle embarque aussi le correctif du champ « poids de la
barre » décrit plus bas, qui n'avait pas encore été publié. Portes locales : lint, typecheck,
**1070 tests dans 96 fichiers**, build PWA — et le fichier instable rejoué 8 fois de suite,
vert à chaque passe.

**Checkpoint téléphone :** installer `FitTrack-v0.1.4.apk` par-dessus l'app existante sans la
désinstaller, puis refaire le checkpoint « poids de la barre » ci-dessous : c'est le seul
changement visible de cette version, le reste est du test.

**Mise à jour précédente :** 2026-08-11 (**Poids de la barre : un champ vidé reste vide**).

Dans la feuille « Plaques à charger », effacer le poids de la barre y réécrivait aussitôt
« 0 » : le champ renvoyait `undefined` au parent, qui le ramenait à 0 (`value ?? 0`), et
`NumberInput` resynchronise son texte sur la valeur pendant le rendu. Le zéro revenait donc
dans le champ qu'on venait de vider, et chaque frappe suivante se posait derrière lui — taper
22,5 donnait « 022,5 ». Mesuré dans le navigateur à 375 px.

Le champ garde maintenant son propre brouillon, autorisé à être vide, et ne transmet qu'un
nombre réel : `barWeight` reste un `number` pour l'appelant, et les diagrammes continuent de
calculer sur le dernier poids réellement saisi au lieu de sauter à la barre nue en pleine
frappe. Le champ est remonté à chaque ouverture de la feuille, pour qu'un champ laissé vide ne
revienne pas vide au-dessus d'une barre qui vaut toujours 20 kg.

Portes locales : lint, typecheck, build PWA, **1069 tests passants sur 1070**. L'échec restant,
`HomeBodyWeightCard` « keeps the edited value and allows retry after a rejected write », est
intermittent et **antérieur à ce correctif** : le `role="status"` est toujours présent dans le
DOM (il affiche une espace insécable au repos), donc `findByRole` le trouve immédiatement et
l'assertion court contre l'écriture asynchrone. Le test passe ou échoue au hasard sur le même
arbre de travail — c'est le test qui est à corriger, pas l'app.

**Checkpoint téléphone :** dans une séance en cours, ouvrir « Plaques à charger » sur un
exercice à la barre, effacer le poids de la barre — le champ doit rester vide, pas afficher
« 0 » — puis taper 22,5 : le champ doit lire exactement « 22,5 ».

**Mise à jour précédente :** 2026-08-11 (**Marge des cartes à l'ordre verrouillé et
préparation Android v0.1.3**).

Quand l'ordre des exercices est verrouillé, la poignée de déplacement disparaît : c'était elle
qui écartait le titre du bord arrondi de la carte, et son retrait collait le nom et son
sous-titre contre la bordure. L'en-tête porte désormais lui-même une marge de 16 px, mais
seulement à l'état verrouillé — déverrouillé, la poignée reste le premier élément de la ligne et
la mise en page ne change pas. Même règle dans l'éditeur de routine et dans la séance en cours.
Mesuré dans l'app : 16 px verrouillé, 44 px déverrouillé (la largeur de la poignée) sur les
deux écrans.

La version applicative est `0.1.3`. Portes locales finales : lint, typecheck, **1068 tests dans
96 fichiers**, build PWA.

**Checkpoint téléphone :** installer `FitTrack-v0.1.3.apk` par-dessus l'app existante sans la
désinstaller. Ouvrir une routine et une séance en cours : verrouillé, le titre de chaque
exercice doit respirer par rapport au bord de la carte ; déverrouillé, la poignée doit reprendre
sa place sans que rien d'autre ne bouge.

**Mise à jour précédente :** 2026-08-11 (**Tonnage au poids du corps et préparation
Android v0.1.2**).

Le poids du jour se renseigne directement depuis l'accueil et reste local dans les mesures
datées. Pour une séance historique, FitTrack prend la dernière mesure connue à sa date ;
si la séance précède toutes les mesures, la première mesure disponible sert de repli.
Une correction le même jour remplace la valeur au lieu d'ajouter un doublon.

Le tonnage effectif estimé suit `(poids du corps × coefficient + lest) × reps`, ou
`max(poids du corps × coefficient - assistance, 0) × reps`. Les tractions, dips et
variantes comparables utilisent 100 %, les pompes et mouvements comparables 70 %, les squats,
pistols, mollets et burpees 90 %. Les exercices segmentaires ou isométriques restent exclus :
ce total est une approximation biomécanique, pas une mesure de travail physique absolue.
Les exercices personnalisés en répétitions ou avec assistance acceptent leur propre
coefficient, strictement supérieur à 0 et jusqu’à 100 % ; les instantanés de séance
conservent le coefficient utilisé.

Fin de séance, historique, volume hebdomadaire, courbes et exports utilisent désormais le
même calcul. La version applicative est `0.1.2`. Portes locales finales sur le merge incluant
le correctif d'accueil de Claude : lint, typecheck, **1064 tests dans 94 fichiers**, build PWA,
build Android Web et synchronisation Capacitor à 0.

**Checkpoint téléphone :** installer `FitTrack-v0.1.2.apk` par-dessus l'app existante
sans la désinstaller. Enregistrer le poids sur l'accueil, puis terminer des pompes, squats,
tractions, séries lestées et assistées. Comparer les totaux Fin/Historique/Volume
hebdomadaire, corriger le poids du même jour, forcer l'arrêt et relancer hors ligne pour
confirmer la persistance.

**Mise à jour précédente :** 2026-08-10 (**Verrouillage de l'ordre des exercices**).

L’éditeur de routine et la séance en cours démarrent avec leur ordre verrouillé. Deux cadenas
indépendants, conservés uniquement pendant la session de l’application, masquent ou rendent les
poignées et bloquent réellement le pointeur comme le clavier. Le cadenas de séance se trouve après
« 80 % » ; celui de routine accompagne le résumé de la liste.

La version `0.1.1` est prête pour la release Android. Les portes locales lint, typecheck, tests,
build PWA et synchronisation Capacitor sortent à 0.

**Checkpoint téléphone :** installer `FitTrack-v0.1.1.apk` par-dessus l’application existante sans
la désinstaller. Dans une routine puis une séance, vérifier que les poignées sont absentes par
défaut, que les cadenas fermé/ouvert permettent le déplacement séparément, puis forcer l’arrêt et
relancer l’app pour confirmer le retour des deux cadenas fermés sans perte de données.
**Correctif Claude fusionné le 2026-08-11 :** mesure de l'accueil et mémoïsation de la
régularité, initialement développés sur `perf/home-dashboard-reads` hors lot.

**Point de départ :** l'accueil charge **toutes** les séances terminées pour en afficher trois
(`listCompletedWorkouts` dans `getHomeDashboard`), relit les trois tables de routines en entier,
et rejouait `calculateWeeklyRegularity` à **chaque rendu** — la fonction était appelée dans le
corps de `useHomeDashboard`, ni dans le `useLiveQuery` ni sous mémo. Elle est désormais sous
`useMemo`, avant les retours anticipés, et rend l'objet d'état complet : identité stable en
prime.

**L'écran le plus souvent ouvert était le seul que le banc grande base ne regardait pas.**
`history.bench.ts` mesurait la pagination et l'export ; `home.bench.ts` (`npm run bench:home`)
comble le trou. Les routines et l'objectif hebdomadaire y sont semés **exprès** : sans routines
`pickSuggestedRoutine` sort sur `candidates.length === 0`, sans objectif la régularité rend zéro
sans dérouler sa boucle — le banc aurait mesuré un accueil au repos et annoncé une bonne
nouvelle. Les séances sont rattachées aux routines **à tour de rôle**, c'est-à-dire dans le cas
le plus favorable à un futur arrêt anticipé : une fixture complaisante donne raison à la
correction qu'on avait envie d'écrire.

**Les chiffres, sur 2 000 séances / 64 000 séries** (~71 ms au total pour l'accueil) :

|                                         | ms    | part  |
| --------------------------------------- | ----- | ----- |
| Lecture non bornée des séances          | 40,5  | 57 %  |
| Compteurs des **3** lignes affichées    | 17,7  | 25 %  |
| Résumés de routines (3 tables entières) | 2,2   | 3 %   |
| Régularité hebdomadaire                 | 1,3   | 2 %   |
| Suggestion de routine                   | 0,076 | 0,1 % |

**Trois corrections « évidentes » que la mesure a annulées.** Avant de mesurer, la suggestion
était annoncée comme le morceau difficile, avec un `lastPerformedAt` dénormalisé sur `Routine`,
ses quatre points de synchronisation et son bouton « réparer » : elle coûte **76 microsecondes**.
La série hebdomadaire était annoncée comme une décision produit — la borner à 52 semaines pour
éviter un parcours sans fin : le banc a déroulé **428 semaines en 1,3 ms**. Et la mémoïsation,
présentée comme l'évidence à faire en premier, est la **plus petite ligne du tableau** ; elle a
été faite parce qu'elle était gratuite, pas parce qu'elle était urgente. **Le coût est dans la
sortie des lignes d'IndexedDB, jamais dans ce qu'on en calcule** — un raisonnement sur la
complexité algorithmique désignait à chaque fois le mauvais coupable.

**Et ça fusionne deux corrections qu'on croyait séparables.** Comme la suggestion a besoin de
tout l'historique, borner la lecture **impose** le parcours arrière avec arrêt anticipé, donc
l'index composé `[status+startedAt]` et sa migration `version(4)`. Une seule décision, pas deux.
Piège noté au passage : `deletedAt === 0` n'est pas dans cet index, il faudra sur-lire et couper
après, sinon trois séances supprimées d'affilée rendent une liste vide.

**À creuser avant d'y toucher :** `buildWorkoutSummaries` pour **3 lignes** coûte 17,7 ms, un
quart de l'écran. Un `anyOf` sur trois identifiants indexés ne devrait pas coûter ça — probable
artefact de `fake-indexeddb`, à confirmer sur le vrai moteur avant d'en tirer quoi que ce soit.

**Ce que ces chiffres ne sont pas :** des millisecondes de téléphone. C'est Node + jsdom +
`fake-indexeddb`, une implémentation JS en mémoire. D'un lancement à l'autre le total a varié de
**71 à 130 ms** sur la même machine — **seules les proportions se lisent**. À 3 échantillons la
marge d'erreur dépassait 60 %, d'où les 15 itérations du banc.

**Décision : on n'en fait pas plus.** À 71 ms pour une base deux ordres de grandeur au-dessus de
l'usage réel, la migration de schéma ne vaut pas son risque. Le banc reste, il tournera quand ça
comptera.

**Checkpoint téléphone :** aucun. Le `useMemo` ne change rien de visible — si l'accueil affiche
autre chose qu'avant, c'est une régression.
**Mise à jour précédente :** 2026-08-09 (**Lot 10 — application Android Capacitor**).

Le projet Android Capacitor 8 est versionné avec l'identifiant `com.fittrack.app`. Le build
Android utilise des chemins relatifs et aucun service worker, tandis que GitHub Pages conserve
son préfixe et sa PWA. Les barres système suivent le thème, les zones sûres Android sont prises
en charge et le bouton Retour suit la pile ou un parent de route déterministe.

Une notification silencieuse reste affichée pendant la séance. Le minuteur programme une
notification Android exacte avec `allowWhileIdle`; la sonnerie Web reste le secours si la
programmation native échoue. Les remplacements et annulations sont sérialisés pour éviter une
ancienne alarme après une nouvelle série.

`.github/workflows/android.yml` vérifie lint, typecheck, tests et sync Capacitor, puis produit un
APK signé avec une clé externe stable. Un tag `v*` crée automatiquement la GitHub Release et y
joint l'APK installable. La procédure de sauvegarde de la clé, de téléchargement, d'installation
et de mise à jour est dans `docs/ANDROID.md`. La clé locale vit sous `.secrets/`, hors Git, et doit
être sauvegardée séparément.

Le nettoyage demandé avant compilation a retiré ou raccourci 938 lignes de commentaires sans
changer les instructions exécutables. Portes finales locales : lint, typecheck, **1000 tests dans
86 fichiers**, build PWA et build/sync Android à 0.

**Checkpoint téléphone :** installer l'APK de la release, autoriser notifications et alarmes,
démarrer une séance, verrouiller l'écran pendant un repos, vérifier la sonnerie à l'échéance,
puis installer l'APK suivant par-dessus sans désinstaller et confirmer que l'historique reste.

**Mise à jour précédente :** 2026-08-02 (**Lot 9 — PWA : l'app s'installe et démarre sans
réseau**). Le jalon V1. La ligne 3 du README promettait « hors-ligne » depuis le Lot 0 ;
elle est vraie depuis ce lot et pas avant.

**Ce que le lot ajoute, en une phrase :** `vite-plugin-pwa` en `registerType: 'prompt'`, un
manifeste complet, quatre icônes, un bandeau « nouvelle version disponible », une ligne
d'installation dans les réglages, et `docs/INSTALLATION.md`.

**Le vrai sujet n'était pas l'installation, c'était la mise à jour.** Le Lot 0 avait déjà
consigné la version douce du problème : après un déploiement, l'onglet servait l'ancien
`index.html` pendant quelques minutes. Un service worker transforme ces quelques minutes en
**définitif**, parce qu'une fois installé ce n'est plus le réseau qui décide de la version
qui tourne. D'où `registerType: 'prompt'` — mais ça ne fait que la moitié du travail :
l'autre moitié est que **quelque chose doit le dire**, sinon le nouveau worker attend
derrière l'ancien indéfiniment et l'app est figée tout aussi complètement, en silence.
`UpdateBanner` est cette moitié.

**Et le risque symétrique — recharger sous une séance en cours — est la raison pour laquelle
le bandeau demande au lieu d'agir.** Règle n°4. « Plus tard » ne fait que masquer : le worker
continue d'attendre, la bascule se fera à une ouverture suivante.

**Le bandeau a été vérifié en déployant vraiment une v2 sous une page ouverte**, pas en
lisant la config : v1 installée et aux commandes → build d'une v2 → bandeau affiché → « Plus
tard » masque → rechargement, le bandeau revient → « Recharger » bascule et l'app repart.
**Le premier essai a échoué pour une raison qui n'était pas un bug de l'app** : la
modification déclenchant la v2 était un commentaire, que la minification supprime — le bundle
ressortait octet pour octet identique et le worker ne voyait donc aucune nouvelle version.
À retenir pour le Lot 10 et pour tout test de déploiement : **une v2 se fabrique avec une
chaîne visible, jamais avec un commentaire.**

**Le hors-ligne a été vérifié en coupant le réseau dans un vrai Chromium** : accueil,
bibliothèque (175 exercices), et une route différée (`Progression`) s'ouvrent toutes, zéro
erreur de page. Le précache fait **28 entrées / 777 Kio** — la limite de 2 Mio par fichier de
Workbox n'est pas en vue, le plus gros morceau étant `index-*.js` à 433 Ko. Cette limite
mérite quand même d'être surveillée : elle est **silencieuse**, un fichier au-dessus est
simplement omis du précache et le build reste vert.

**Les icônes sont générées, pas dessinées.** `scripts/generate-icons.mjs` reprend la
géométrie de `BarbellIcon` (`src/ui/icons.tsx`) et sort le 192, le 512, le maskable et
l'apple-touch. `sharp` n'est **pas** en devDependency : le script tourne à la main quand la
marque change, et la CI fait un `npm ci` à chaque push — payer une chaîne d'image native à
chaque déploiement pour quatre fichiers déjà commités serait un mauvais échange. La commande
est dans l'en-tête du script.

**Le maskable est un fichier séparé, pas un `purpose: 'any maskable'` partagé.** Un lanceur
qui rogne l'icône « any » mangerait ses coins arrondis ; et le dessin n'est pas le même — la
version maskable est réduite (échelle 16 au lieu de 18,5) pour tenir dans le cercle de
sûreté de 80 %, où la marque à sa taille normale passait sur le papier et paraissait à
l'étroit à l'œil.

**Deux détails qui ne se voient qu'une fois sur le téléphone :** iOS ne lit pas le manifeste
pour choisir son icône, il lit `<link rel="apple-touch-icon">` — sans cette balise, « Sur
l'écran d'accueil » depuis Safari pose une capture de la page. Et le favicon reste en
data-URI malgré `public/icon.svg`, parce qu'il s'affiche au premier rendu, avant que le
service worker n'existe.

**`isInstalled()` garde `matchMedia` derrière un `typeof`** : jsdom ne l'implémente pas du
tout ici (vérifié, ce n'est pas une précaution théorique), et un appel nu ferait échouer
chaque test montant l'écran de réglages — pour une ligne qui ne parle que d'affichage.

**Ce que le lot ne fait pas :** le minuteur ne sonne toujours pas écran éteint. Une PWA ne
sait pas le faire de façon fiable ; c'est la raison d'être du Lot 10.

Les quatre portes sortent à 0 : lint, typecheck, **945 tests dans 80 fichiers**, build Vite.

**Checkpoint téléphone (jalon V1) :**

1. Ouvrir le site dans Chrome, aller dans **Réglages → Application → Installer sur l'écran
   d'accueil**. L'icône doit apparaître dans le tiroir d'applications.
2. Lancer depuis l'icône : **pas de barre d'adresse**.
3. La même section doit afficher « Prête pour le hors-ligne ».
4. **Mode avion, fermer l'app, la relancer depuis l'icône** : elle doit démarrer entièrement.
5. Pousser une version et rouvrir l'app : le bandeau « Une nouvelle version est disponible »
   doit apparaître, et « Recharger » doit basculer dessus.

La procédure complète, iPhone compris, est dans `docs/INSTALLATION.md`.

**Mise à jour précédente :** 2026-08-02 (**sauvegarde CSV : export depuis FitTrack, réimport
comme un fichier Hevy**). Dernier morceau avant le v1, décidé en discussion : un seul format
pour sortir et pour rentrer, plutôt qu'un export d'un côté et un importeur de l'autre.

**Le format est celui de Hevy, plus cinq colonnes.** Les 14 colonnes d'origine, dans leur
ordre, et `fittrack_routine`, `fittrack_rest_seconds`, `fittrack_measurement`,
`fittrack_equipment`, `fittrack_side` — exactement ce que le format de Hevy ne sait pas
transporter. Elles sont facultatives des deux côtés : un export Hevy authentique n'en a
aucune et s'importe comme avant, une valeur illisible est ignorée plutôt que refusée. Le
fichier reste donc lisible par n'importe quel outil qui lit du Hevy, et l'app y retrouve ce
que Hevy aurait perdu. **Réutiliser l'importeur existant est ce qui rend l'affaire petite :
seul le sérialiseur était à écrire.**

**Le vrai bug était ailleurs : l'import fabriquait une routine à partir de séances qui
restaient sans routine.** `hevyWorkoutEntities` écrivait `routineId: ''` pendant que
`hevyRoutineImport` déduisait les routines de ces mêmes séances groupées par titre. D'où
« LOWER A — jamais réalisée » sur un accueil dont l'historique en était plein (rapporté du
téléphone), et un export CSV qui ressortait sans routine ce que l'import venait d'en
déduire. Les séances importées pointent désormais vers la routine née d'elles. Le
rattachement par le nom dans `pickSuggestedRoutine` reste : il rattrape les bases déjà
importées, qu'aucune migration ne réécrit.

**Ce que la reconstruction rend maintenant, en plus :** le repos par exercice (colonne
`fittrack_rest_seconds`), les supersets — la donnée était déjà dans `superset_id`, le
constructeur de routines la mettait simplement à 0 — et le côté travaillé des séries
unilatérales. Les routines dormantes (aucune séance depuis un mois, `isDormantRoutine`)
partent dans un dossier « … — Archivé » séparé : un historique un peu long en ramène
toujours, et la liste qu'on ouvre avant une séance doit rester celle des routines vivantes.

**L'heure exportée est celle du fuseau de l'appareil, pas celle stockée par la séance.** Le
format n'écrit qu'une heure murale à la minute, et l'import la relit dans le fuseau de
l'appareil : écrire l'heure d'une séance faite à l'étranger la ferait revenir décalée. Entre
conserver l'instant et conserver l'heure affichée, une sauvegarde conserve l'instant. Sur un
téléphone qui n'a pas voyagé, les deux sont la même valeur — changements d'heure compris,
l'offset étant lu à l'instant de la séance.

**L'import sur une base non vide : on entre, on lit, on va vider.** Les séances sont
dédoublonnées par leur clé d'import, mais les routines reconstruites viendraient doubler
celles déjà là. L'écran s'ouvre donc quand même et explique, avec un bouton qui emmène à
l'écran de vidage — plutôt qu'un bouton grisé qui n'aurait rien dit. « Importer quand même »
reste d'un cran en dessous : ajouter un export Hevy à un historique existant est le cas pour
lequel cet écran a été écrit.

**Ce qui n'est pas dans le fichier, et ne peut pas y être :** une routine **jamais
réalisée** (le format décrit des séances, elle n'en a aucune), les réglages, et les secondes
des horaires. Le JSON complet du Lot 8 reste le seul « tout revient à l'identique ».

**Le test qui compte est l'aller-retour** (`csvRoundTrip.test.ts`) : on sème une séance
tordue à dessein — superset, échauffement, RPE, série unilatérale, repos non standard, notes
à guillemets —, on exporte, **on vide la base**, on réimporte, on compare. Vérifié aussi en
navigateur réel : import d'un `fittrack-….csv`, deux dossiers de routines dont l'archive,
accueil qui affiche « Réalisée le 3 janvier » au lieu de « jamais », téléchargement du
fichier et relecture de son en-tête. Les quatre portes sortent à 0 : lint, typecheck,
**921 tests dans 78 fichiers**, build Vite.

**Checkpoint téléphone :** Réglages → « Sauvegarder l'historique (CSV) » : la feuille de
partage doit proposer d'enregistrer le fichier (Drive, Fichiers…). Le rouvrir dans un
tableur pour vérifier les accents. Puis Historique → Importer : l'écran doit demander de
vider d'abord. Vider par Réglages → Diagnostic, revenir, choisir le fichier téléchargé, et
retrouver ses séances, ses routines — et le dossier « Archivé » s'il reste des routines
qu'on ne fait plus.

**Mise à jour précédente :** 2026-08-01 (**les graphiques passent dans la teinte du thème :
jeton `--accent-data`**). Rapporté du téléphone comme « le orange ne s'applique pas, mais
seulement en mode sombre » sur le volume et sur la progression d'exercice.

**Le diagnostic tenait en une capture des deux thèmes côte à côte.** Les marques des
graphiques étaient dessinées en `--text-2` — une couleur réglée pour du **texte**. En clair,
la lisibilité la pousse vers #5c675e : sombre, et encore visiblement vert, donc les colonnes
avaient l'air d'appartenir à l'app. En sombre elle la pousse vers #b9b1a8 : si clair que la
teinte a disparu et qu'une barre se lit blanche. D'où un défaut qui n'existait vraiment
qu'en sombre, sans qu'aucune ligne de code ne soit conditionnée au thème. **Une couleur
réglée pour un paragraphe ne peut pas être aussi l'encre de données de l'app.**

**`--accent-data` est un jeton neuf parce que c'est un métier neuf** — le même raisonnement
que `--axis` au retour précédent. Deux intensités d'**une seule** teinte, jamais une teinte
contre un gris : le ton atténué est l'observation ordinaire, `--accent-ink` est celle qui
veut dire quelque chose. Mesuré au plancher des objets graphiques (3:1) et les deux tons
tenus à plus de 2:1 l'un de l'autre — sombre #a85a20 (3,5:1 sur une carte, 2,2:1 contre
l'encre), clair #4d9c72 (3,3:1 sur une carte, 2,1:1 contre l'encre). En clair l'atténué est
plus **clair** que l'encre, en sombre plus **foncé** : chacun s'éloigne de son fond.

**Le contrat de sens n'a pas bougé, il est juste devenu lisible.** L'accent plein continue
de dire « objectif atteint » (séances) et « record » (courbe), et le volume n'a toujours
aucune colonne pleine — il n'a ni objectif ni record, et une grande quantité n'est pas un
compliment. Ce qui a changé, c'est que les autres marques ne sont plus grises.

**Trois phrases de légende, et c'est la moitié du correctif.** Deux intensités d'une même
teinte que personne n'explique sont de la décoration ; nommées, c'est de l'information —
« Les colonnes pleines sont les semaines où l'objectif est atteint », « Le point plein est
le record de la période », et sur le volume « Toutes les semaines ont la même couleur : le
volume n'a pas d'objectif à atteindre », qui répond à la question telle qu'elle a été posée.
Chacune est conditionnée à son repère : pas de légende d'objectif si aucun objectif n'a
jamais été défini, pas de légende de record sur une séance unique.

**Le test du cadre partagé reconnaissait une barre à sa couleur** (`!== var(--text-2)`) et
serait devenu aveugle. Il liste maintenant les deux encres de données. Vérifié par mutant :
repeindre la ligne de base en `--border` fait toujours tomber le test. Les quatre portes
sortent à 0 : lint, typecheck, **880 tests dans 72 fichiers**, build Vite.

**Checkpoint téléphone :** en sombre, ouvrir Progression → Volume d'entraînement et
Progression d'exercice : les colonnes et la courbe doivent être orange, pas beige. Sur
Séances par semaine, vérifier qu'on distingue au premier coup d'œil la semaine à l'objectif
(orange vif) des autres (orange sourd) — et lire les trois légendes sous les graphiques.
Repasser en clair et vérifier la même chose en vert.

**Mise à jour précédente :** 2026-08-01 (**V2 de l'écran d'accueil + Progression dans la
barre**). L'accueil était un compteur à zéro et un bouton ; il répond maintenant à quatre
questions dans l'ordre où on se les pose : où j'en suis cette semaine, quoi lancer, ce que
j'ai fait dernièrement, où sont les courbes.

**La suggestion est une fonction pure, pas une heuristique.** `pickSuggestedRoutine`
(`src/lib/home.ts`) rend la routine **réalisée le moins récemment**, une routine jamais faite
passant devant toutes les autres, égalités tranchées par l'ordre de la liste. Aucun modèle de
récupération musculaire : il demanderait des données que l'app n'a pas, et une suggestion
qu'on ne peut pas expliquer en une phrase est une suggestion qu'on ignore — la phrase est
d'ailleurs écrite sous le bouton. Les séances libres et les imports sans `routineId` sont
ignorés, et une routine supprimée ne peut pas revenir par la porte de l'historique : la carte
des dernières réalisations est filtrée sur les routines vivantes avant d'être lue.

**Une seule lecture pour tout l'écran.** `getHomeDashboard` lit les séances terminées **une
fois** et les trois blocs s'y servent : la régularité prend leurs dates, la suggestion leurs
`routineId`, le mini-historique leurs trois premières lignes — et les compteurs
d'exercices/séries ne sont calculés que pour ces trois-là. `listFilteredCompletedWorkouts` et
`buildSummaries` d'`history.ts` sont devenus publics pour ça, plutôt que de rejouer la même
requête à côté.

**Zéro deuxième implémentation de la série hebdomadaire.** L'accueil appelle
`calculateWeeklyRegularity`, la fonction de l'Historique, sur les mêmes dates et le même
historique d'objectifs. **Sans objectif défini, la carte n'affiche qu'une colonne** : la série
vaut zéro tant qu'il n'y a rien à tenir, et « 0 semaines d'affilée » à quelqu'un qui
s'entraîne trois fois par semaine serait un reproche fabriqué. Pas de `2 / 4` inventé non
plus.

**Progression remplace Réglages dans la barre.** On regarde ses courbes toutes les semaines,
on change une préférence trois fois par an. Les Réglages passent dans l'en-tête de l'accueil
(icône `SlidersIcon`), la barre reste à cinq onglets (§12.1), et `/analytics` devient une
racine d'onglet — sa flèche de retour vers l'Historique est retirée, une flèche sur une racine
d'onglet promet un ailleurs qui n'existe pas. Le chargement paresseux des cinq écrans
d'analyse est intact : l'accueil ne dessine aucun graphique, seulement trois liens.

**Preuves.** Six tests neufs sur la fonction de suggestion (jamais réalisée prioritaire, moins
récente choisie, séance sans routine ignorée, routine supprimée écartée, égalité stable dans
les deux sens, aucune routine → `null`). Les quatre portes sortent avec le code 0 : typecheck,
lint, **880 tests dans 72 fichiers** et build Vite. Vérifié en pilotant le navigateur sur les
deux thèmes : base vide (« aucune routine »), écran plein sans objectif hebdo (une colonne),
écran plein avec objectif (deux colonnes), et les deux entrées vers les analyses. Les états
de chargement et d'erreur de lecture n'ont pas été reproduits à l'écran — seul le code les
couvre.

**Checkpoint téléphone :** ouvrir l'accueil et vérifier que la routine proposée est bien celle
que tu as faite il y a le plus longtemps. Taper la carte de la semaine → Séances par semaine.
Taper une séance du mini-historique → son détail. Vérifier les cinq onglets (Accueil,
Routines, Historique, Progression, Exercices) et que l'icône en haut à droite ouvre les
Réglages. Démarrer la routine proposée, puis revenir à l'accueil : le bouton « Démarrer »
doit être inerte et la bande « séance libre » avoir disparu tant que la séance tourne.

**Dernière mise à jour :** 2026-08-01 (**retours téléphone sur la palette : cadre de
graphique unifié, header de séance décollé**). Trois défauts rapportés en photo, trois
causes distinctes — aucune n'était la palette.

**Les deux graphiques en colonnes avaient divergé sur leurs trois marques communes.**
Ligne de base, moignon de zéro et sélection : `--border` d'un côté, `--text-2` de l'autre ;
une fente pleine ici, un contour là. `ChartSurface` avait factorisé l'interaction en
laissant le dessin de côté — vrai d'une courbe contre un histogramme, **faux d'un
histogramme contre un histogramme**. `ColumnFrame` possède désormais les trois marques et
les deux écrans le partagent : la façon dont deux graphiques restent identiques, c'est
qu'il n'y en a plus qu'un à changer.

**La sélection devient une marque sous la colonne.** Les deux réponses précédentes
échouaient à la mesure sur le thème clair : la fente pleine était `--surface-2` sur une
carte blanche — **1,14:1, invisible** — et le contour traversant la base se lisait comme un
rectangle égaré. La marque reprend l'atome de l'onglet engagé de la barre du bas. Elle
fonctionne à n'importe quelle hauteur, **y compris zéro** — la semaine vide est justement
celle qui mérite d'être tapée — et elle est en `--text-1`, **jamais l'accent** : sur le
graphique des séances l'accent dit déjà « objectif atteint », et une encre ne peut pas dire
deux choses sur un même dessin.

**`--axis` est un jeton neuf parce que c'est un métier neuf.** Ni `--border`, réglé pour un
bord de carte et qui mesure **1,35:1** sur une carte claire — invisible sous une barre — ni
`--text-2`, qui dessinait une ligne de base plus lourde que la donnée posée dessus. Son
propre plancher : 3:1, le seuil des objets graphiques.

**Le « ça colle » du header avait une cause exacte, et elle mordait ailleurs aussi.**
`HeaderAction` portait `-mr-2` : une marge négative qui existe pour que la cible de 48 px
déborde la marge d'écran et que le glyphe tombe sur le bord optique. C'est une propriété du
bouton **du bord**, pas de tous. Appliquée à chacun, elle mangeait exactement le `gap-2` du
header de séance — d'où la puce deload collée au chrono — et **superposait de 8 px les deux
icônes du header de l'Historique**, sans que personne l'ait vu. `last:-mr-2` corrige les
deux. Vérifié en pilotant : gaps de 8 px réels, cibles de 48 px intactes.

**Le chrono passe devant les commandes.** Posé entre le deload et le menu, il était encadré
de deux boutons et se lisait comme un troisième bouton qui refuse de répondre. La lecture
d'abord, les commandes groupées contre le bord — l'ordre de l'en-tête des routines, où le
compte précède le `+`. Il gagne la graisse d'un instrument et **un nom accessible** : un
lecteur d'écran annonçait « 0:02 » tout seul. L'étiquette est optionnelle et posée au seul
appelant où le chiffre est nu ; sur l'écran de fin et la barre de reprise il est déjà sous
un libellé écrit, et le nommer ferait doublon.

**L'état deload actif passe en `--accent-soft`.** Il était un aplat `--surface-2`, une tache
grise ; le jeton existe désormais et son emploi est précisément celui-là — un état que
l'encre d'accent désigne déjà (6,4:1 en sombre, 6,5:1 en clair).

**Preuves.** Un test neuf compare les deux cadres marque par marque, et un mutant a été tué
en le vérifiant : remettre une ligne de base propre au graphique de volume fait sortir
**3 marques contre 2** et casse aussi le test du curseur. Les quatre portes sortent avec le
code 0 : lint, typecheck, **874 tests dans 71 fichiers** et build Vite.

**Checkpoint téléphone :** ouvrir Analyses → Séances par semaine puis Volume
d'entraînement, et vérifier que les deux écrans ont la même ligne de base, le même moignon
de zéro et le même curseur. Taper une semaine vide au milieu : elle doit rester
sélectionnable et son curseur visible. Puis, en séance, vérifier l'espace entre le chrono,
la puce `80%` et le menu, et le fond orange sourd une fois le deload appliqué.

**Dernière mise à jour :** 2026-08-01 (**nouvelle palette — vert en clair, orange en
sombre**). Recolorage complet des deux thèmes depuis une référence visuelle fournie par
l'utilisateur. Aucune logique, aucun layout, aucune structure, aucune chaîne d'UI n'a changé.

**Le recolorage a tenu dans les jetons, et c'est la mesure de la dette évitée.** Les 622 usages
de couleur répartis sur 94 fichiers passaient déjà tous par `var(--…)` : aucune classe de palette
Tailwind, aucun hex dans un composant. `src/index.css` était le seul fichier à recolorer.

**L'accent devient dépendant du thème, ce qu'il n'était pas.** Le vert acide était commun aux deux
thèmes ; il y a maintenant un vert `#15803D` en clair et un orange `#FF8A3D` en sombre. `@theme`
étant un scope statique unique, il ne fait plus que **relayer** (`--color-accent: var(--accent-fill)`).
Les trois noms publics `--color-accent`, `--color-accent-dim` et `--color-accent-fg` sont inchangés :
aucun composant n'a bougé et les utilitaires `bg-accent` suivent toujours le thème. Vérifié en
pilotant sur les deux thèmes plutôt que supposé.

**Un écart assumé, mesuré, et c'est le seul.** En clair, `#15803D` est le **fond** de bouton, pas
l'encre : il donne **4,33:1 sur `--surface-2`**, sous le plancher de 4,5, et l'encre d'accent
atterrit justement sur les lignes pressées et les étiquettes de 11 px. `--accent-ink` prend donc
`#166534`, le hover de la palette fournie — **7,1:1 sur une carte, 6,3:1 sur `--surface-2`**. En
sombre la question ne se pose pas : l'orange fait 8,0:1 sur le fond, encre et fond partagent une
valeur. La séparation fill/ink du Lot 1 n'a pas été inventée pour l'occasion, elle a resservi telle
quelle.

**`--accent-soft` a un consommateur, sinon c'était un jeton mort.** La carte soulevée pendant un
glisser-déposer utilisait `--surface-2`, qui est aussi sa couleur **au repos** : soulever ne
changeait que l'anneau. Trois fichiers, un échange de couleur, zéro layout.

**Couleurs codées en dur restantes, toutes remplacées :** le voile des feuilles (`bg-black/60` →
jeton `--scrim`), la barre système Android dans `stores/theme.ts` **et** dans `index.html` (le
script anti-flash synchrone, qui aurait sinon fait clignoter l'ancien noir au démarrage), et le
favicon SVG inline, qui portait encore le noir et le vert acide.

**Trois commentaires corrigés plutôt que laissés à mentir.** Ils citaient des mesures du vert acide
(« 1,29:1 sur la page claire ») devenues fausses. Dans ce dépôt un commentaire porte une mesure ;
un chiffre périmé y coûte plus cher qu'une phrase absente.

**Un test modifié, signalé plutôt que glissé.** `theme.test.ts` fixait `#0a0a0b` / `#ffffff` sur la
balise `theme-color`. Ce qu'il vérifie — la balise suit `--surface-0` — est intact ; c'est la
palette qui a changé, pas la règle.

**Preuves fraîches.** Les quatre portes sortent avec le code 0 : lint, typecheck, **870 tests dans
70 fichiers** et build Vite. `--danger` et `--warn` restent hors palette fournie ; seule leur tenue
sur les nouvelles surfaces a été revérifiée (rouge à 5,8:1 en sombre, 5,7:1 en clair).

**Checkpoint téléphone :** ouvrir l'app, vérifier l'orange sur le bouton primaire, l'onglet actif et
une série validée. Basculer en thème clair dans Réglages et contrôler que le vert n'a jamais l'air
délavé sur une ligne pressée ni sur une étiquette en petites capitales. Vérifier enfin qu'aucun
flash noir n'apparaît au démarrage en thème clair.

**Dernière mise à jour :** 2026-08-01 (**bouton deload en séance livré**).

- Bouton `80%` ajouté au header de la séance en cours : confirmation, réduction des seules séries
  restantes au pas de 2,5 kg, protection contre la double application et reprise après fermeture.
- Le deload ajoute sans écraser la note `Deload — charges réduites à 80 %.` ; l'export Markdown la
  restitue par son pipeline de notes existant.
- Checkpoint téléphone : valider une première série, activer `80%`, vérifier que seules les séries
  restantes changent, tuer/reprendre l'app puis partager la séance et contrôler la note.

**Preuves fraîches.** Les quatre portes sortent avec le code 0 : typecheck, **870 tests dans 70
fichiers**, build Vite de **197 modules** et lint.

**Dernière mise à jour :** 2026-08-01 (**export de tout l’historique depuis les
Réglages**). La section Données propose désormais « Exporter tout
l’historique ». Le document réutilise sans divergence la chaîne canonique
`listHistoricalWorkouts` → `projectCoachExport` → `serializeMarkdown`, avec la
portée `{ kind: 'all-history' }`, puis ouvre la feuille de partage native. Si
elle n’est pas disponible, le presse-papiers prend le relais ; les issues de
copie et d’échec sont annoncées dans l’écran.

**Preuves.** Le cycle TDD couvre deux séances réunies dans un même Markdown, la
portée globale, l’historique vide, le repli presse-papiers et l’échec total. Les
tests ciblés de Réglages, du partage individuel et de l’adaptateur de plateforme
passent : **17 tests dans 3 fichiers**. Les portes fraîches sortent avec le code
0 : lint, typecheck, **839 tests dans 67 fichiers** et build Vite de **194
modules**.

**Checkpoint téléphone demandé :** ouvrir Réglages → Données → Exporter tout
l’historique. Vérifier que la feuille de partage contient les premières et
dernières séances et annonce « Périmètre : tout l’historique ».

**Dernière mise à jour :** 2026-08-01 (**export coach — autorité des séries de
travail centralisée**). Quand les échauffements sont exclus, le contenu exporté
et `workingSetCount` reposent désormais tous deux sur `isWorkingSet`. Le format,
les options et le comportement public de l’export restent inchangés.

**Preuves.** Le test de caractérisation couvre les séries `warmup`, `normal`,
`dropset` et `failure`, leur renumérotation et la cohérence du compteur. Un
mutant manuel limitant l’autorité canonique aux séries `normal` a bien fait
échouer le test (1 série comptée au lieu de 3). Les portes fraîches sortent avec
le code 0 : lint, typecheck, **835 tests dans 66 fichiers**, build Vite de
**194 modules** et `git diff --check`.

**Checkpoint téléphone :** aucun — aucun écran, format d’export ni comportement
utilisateur n’a changé.

**Dernière mise à jour :** 2026-08-01 (**phase 6 — chronologie hebdomadaire
centralisée**). `knownWeekStarts` est désormais l’unique autorité qui décide
quelles semaines locales sont suffisamment connues pour être rendues. Les
analyses « Séances par semaine » et « Volume d’entraînement » lui confient la
même règle : commencer à la borne seulement quand l’historique la précède,
sinon à la plus ancienne semaine observée, conserver les trous internes et ne
rien inventer pour un historique complet vide.

**Comportement préservé.** Les interfaces de `weeklySessionCounts` et
`weeklyVolumeBuckets` restent inchangées. Comptage, objectifs historiques,
filtrage de période, offsets des séances, tonnage et durée restent propres à
leurs moteurs. L’énumération passe toujours par `startOfLocalWeek` et
`addLocalWeeks`, jamais par une durée fixe, afin de traverser les changements
d’heure sans décaler les semaines.

**Preuves.** Quatre tests ciblent directement la nouvelle seam : fenêtre
connue, plus ancienne semaine, historique `Tout` vide et DST. Deux mutants
manuels ont été tués, l’un ignorant `hasEarlierHistory`, l’autre imposant la
borne même quand l’application ne connaît pas encore ces semaines. La revue de
tâche ne relève aucun problème critique, important ou mineur. Les portes
fraîches sortent avec le code 0 : lint, typecheck, **835 tests dans 66 fichiers**,
build Vite de **194 modules** et `git diff --check`.

**Checkpoint téléphone demandé :** ouvrir Historique → Analyses, comparer les
vues 4 semaines et `Tout` de « Séances par semaine » puis « Volume
d’entraînement ». Les deux écrans doivent afficher les mêmes semaines connues,
les mêmes zéros internes, totaux et moyennes qu’avant cette refacto.

**Dernière mise à jour :** 2026-08-01 (**phase 6 — parcours de routine protégé
et collection approfondie**). Un test d’intégration traverse désormais les
vrais `RoutinesScreen`, `RoutineEditorScreen` et `ExercisePickerScreen`, avec le
routeur React, les repositories, Dexie et `fake-indexeddb`, sans mock. Il crée
une routine vide, la renomme, choisit un exercice, ajoute une deuxième série,
démonte entièrement le parcours puis remonte la liste et retrouve le nom ainsi
que le résumé persistant `1 exercice · 2 séries`.

**Premier gros découpage de `RoutinesScreen` terminé.** Le nouveau module profond
`RoutineCollection` reçoit seulement les résumés chargés, les dossiers chargés
et un callback d’intentions. Il masque l’état vide, les lignes, les headings
racine/dossiers, le drag clavier/tactile et la conversion d’un déplacement en
placement persistant. `RoutinesScreen` conserve les live queries, la distinction
chargement/vide, la navigation, les commandes repositories et toutes les
feuilles. Il passe de **429 à 280 lignes** ; le nouveau module en compte 197.
Aucun rendu, texte, route, repository, schéma, migration, donnée ou dépendance
n’a changé.

**Preuves.** Le test de parcours a tué un mutant qui neutralisait l’écriture des
exercices sélectionnés. Les tests d’interface ont tué la suppression du heading
racine et la perte du contexte dossier pendant un déplacement. Les revues de
tâche puis la revue globale finale ne relèvent plus aucun problème critique,
important ou mineur. Les portes fraîches sortent avec le code 0 : lint,
typecheck, **831 tests dans 66 fichiers**, build Vite de **194 modules** et
`git diff --check`.

**Suite de la phase 6.** `RoutineEditorScreen` reste hors de cette tranche à 318
lignes ; son éventuel découpage demandera une preuve de préservation et un plan
séparés. Le checkpoint manuel Hevy décrit dans l’entrée suivante reste lui aussi
à effectuer indépendamment.

**Checkpoint téléphone demandé :** créer une routine vide, la renommer, ajouter
un exercice et une deuxième série, forcer la fermeture de FitTrack, rouvrir
l’application, puis vérifier que la liste affiche le même nom et
`1 exercice · 2 séries`. Aucun changement visuel n’est attendu.

**Dernière mise à jour :** 2026-08-01 (**identité fiable des exercices importés
livrée**). La cause exacte de la régression était l’alias « Développé Debout
Poulie Centrée » encodé comme certitude vers `cable-shoulder-press`, alors que
les quatre séries concernées dans les deux séances `LOWER A` sont un **Pallof
press** pour les abdominaux. La suggestion pointe désormais vers
`pallof-press`, déjà correctement décrit `abs + cable + weight_reps`.

**Autorité séparée et persistante.** Le schéma Dexie v3 ajoute la table
`externalExerciseBindings`, distincte du catalogue canonique `exercises`. Une
clé d’identité exacte conserve tous les mots discriminants du titre source
(`poulie`, `machine`, `assis`, `debout`, `centrée`) tout en normalisant seulement
Unicode, casse, accents, ponctuation et espaces. Les aliases et le classement
lexical ne sont que des suggestions : ils ne sont **jamais préconfirmés** et
seule une décision explicite de l’utilisateur fait autorité puis peut être
réutilisée aux imports suivants. Une liaison absente ou devenue incompatible
reste à confirmer ou passe en conflit ; aucun fallback silencieux ne la
remplace.

**Import sûr et réimport idempotent.** Les exercices personnalisés éventuels,
liaisons confirmées, séances, séries, routines et clés d’import sont écrits
atomiquement dans une seule transaction : une erreur annule tout. Réimporter le
même CSV crée zéro séance, zéro série, zéro routine et zéro exercice en doublon.
La bibliothèque d’exercices n’a pas été remplacée : elle contenait déjà le bon
mouvement et une bibliothèque plus grande n’aurait pas fourni l’identifiant
stable absent du CSV Hevy.

**Chemin complet durci.** Le parseur groupe désormais les variantes de casse,
d’accent et de ponctuation dès leur clé d’identité exacte, avant l’inférence du
type de mesure. Le draft appelle réellement le registre central pour produire
les décisions autorisées ; le repository ne peut plus transformer seul une
suggestion en confirmation utilisateur. Le scénario anonymisé issu du CSV réel
protège 6 séances, 25 identités et 136 séries, l’échec transactionnel tardif,
la conservation des choix, la reprise et l’invariance des neuf tables au
réimport. Toutes les valeurs de performance de la fixture sont synthétiques ;
les commits locaux qui contenaient brièvement les anciennes valeurs ont été
réécrits et leur blob purgé avant tout push.

**Preuves fraîches.** `npm run lint` et `npm run typecheck` sortent avec le code
0 ; les **823 tests dans 64 fichiers** passent ; le build de production Vite
compile **193 modules** et sort avec le code 0. La revue finale de l’ensemble
des changements ne relève aucun problème critique, important ou mineur.

**Checkpoint téléphone demandé :** réinitialiser FitTrack, importer le CSV,
confirmer les **25 identités**, inspecter les deux séances `LOWER A` et les
analyses musculaires, puis réimporter exactement le même fichier et constater
zéro doublon.

**Dernière mise à jour :** 2026-07-29 (**phase 6 — première preuve
d’intégration du parcours de séance**). `WorkoutScreen` possède désormais un
test qui traverse le vrai routeur React, les repositories, Dexie et
`fake-indexeddb` sans mock : il saisit 80 kg et 10 répétitions, attend leur
écriture, démonte entièrement l’écran, le remonte puis vérifie la reprise avant
de valider la série.

**L’invariant « aucune perte de données » est protégé à son interface
utilisateur.** Les valeurs restent écrites avant la coche et la validation
conserve charge et répétitions tout en ajoutant `isCompleted` et `performedAt`.
Le store éphémère de repos est arrêté de part et d’autre du scénario pour ne
laisser aucun état singleton entre les tests. Aucun fichier de production,
texte UI, schéma, donnée ou dépendance n’a changé.

**Preuves.** Un mutant manuel qui coupait le branchement
`onWrite → updateSetValues` a fait échouer l’attente Dexie sur les deux valeurs,
puis le code exact a été restauré et son absence de diff confirmée. Une revue
indépendante n’a relevé aucun problème critique, important ou mineur. Lint,
typecheck, **776 tests dans 59 fichiers** et build de production passent.

**Checkpoint téléphone :** pendant une séance, saisir charge et répétitions
sans cocher la série, forcer la fermeture de FitTrack puis la rouvrir. Vérifier
que la même séance et les deux valeurs reviennent, puis cocher la série. Aucun
changement visuel neuf n’est attendu.

**Prochaine tranche de phase 6 :** composer une routine complète à travers
`RoutinesScreen`, `RoutineEditorScreen` et `ExercisePickerScreen`, puis
retrouver son résumé persistant dans la liste avant le premier gros découpage
de `RoutinesScreen`.

**Dernière mise à jour :** 2026-07-29 (**records visibles en séance
centralisés**). `lib/records` possède désormais la projection
`workoutRecordKinds(groups, setsByExercise)` : elle sélectionne les séries
validées de la séance, les compare à leur univers live et associe chaque série
à son unique record principal. `WorkoutScreen` ne reconstruit plus cette règle.

**Comportement préservé.** La comparaison inclut toujours les séries déjà
validées de la séance, ignore les échauffements via `recordsBeatenBy` et ne
félicite jamais une première performance sans record à battre. Lorsqu’une série
bat la charge et le volume, seule « Charge max » reste affichée. Aucun
changement de requête Dexie, de rendu, de texte, de schéma ou de donnée.

**Preuves.** La baseline comptait 25 tests de `records`. Quatre tests TDD
couvrent le chargement de l’univers live, l’exclusion des séries non validées,
la priorité d’un double record et l’isolation de plusieurs exercices. Deux
mutants manuels ont été tués : suppression du filtre `isCompleted`, puis prise
du dernier record au lieu du premier. Lint, typecheck, **775 tests** dans 58
fichiers et build de production passent.

**Checkpoint téléphone :** dans une séance avec historique, valider une série
qui bat à la fois la charge et le volume. Vérifier qu’une seule félicitation
« Charge max » apparaît, qu’elle disparaît au décochage et revient au
recochage.

**Dernière mise à jour :** 2026-07-29 (**plans de repos par bloc
centralisés**). `lib/rest` possède désormais la transformation des exercices
ordonnés en `RestPlan` : durée commune du bloc et identification de son dernier
membre. `WorkoutScreen` ne reconstruit plus cette règle et projette seulement
ses détails vers les lignes persistées.

**Comportement préservé.** Un exercice simple conserve sa propre durée. Les
membres d’un superset partagent toujours la durée la plus longue et seul le
dernier peut déclencher le minuteur. Les lignes historiques sans durée passent
toujours par `resolveRestSeconds`. Aucun changement de store, de rendu, de son,
de schéma ou de donnée.

**Preuves.** La baseline comptait 21 tests de `rest` et 24 de `routineOrder`.
Quatre tests TDD couvrent les lignes seules, le maximum d’un superset, les
durées historiques invalides et la non-mutation. Deux mutants manuels ont été
tués : durée du premier membre à la place du maximum, puis tous les membres
marqués comme fins de bloc. Lint, typecheck, **771 tests** dans 58 fichiers et
build de production passent.

**Checkpoint téléphone :** lancer une séance avec un exercice simple puis un
superset dont les repos diffèrent. Vérifier la durée propre du premier, aucun
repos entre les membres du superset, puis la durée la plus longue après son
dernier membre.

**Dernière mise à jour :** 2026-07-29 (**placement des supersets
centralisé**). `lib/routineOrder` possède désormais toute la projection d’un
superset persistant vers son rendu : `supersetPlaces(rows)` rend l’index A/B/C
et la taille du bloc. L’éditeur de routine et la séance en direct ne
reconstruisent plus cette règle chacun de leur côté.

**Connaissance réellement dédupliquée.** Les deux écrans utilisent la même
fonction et les deux cartes importent le même type `SupersetPlace`. Il ne reste
qu’une déclaration de l’interface et une implémentation de la règle. La
normalisation, la numérotation persistée, les props et le rendu visuel restent
inchangés.

**Preuves.** Les 20 tests existants de `routineOrder` formaient la baseline ;
quatre tests TDD couvrent les lignes seules, les index, la taille, plusieurs
blocs et la non-mutation. Deux mutants manuels ont été tués : inclusion de
`group === 0` et taille forcée à `1`. Lint, typecheck, **767 tests** dans 58
fichiers et build de production passent.

**Checkpoint téléphone :** ouvrir une routine avec un superset de trois
exercices, vérifier A/B/C et le filet continu, démarrer la séance puis contrôler
le même rendu. Réordonner ensuite un membre et vérifier que routine et séance
restent cohérentes.

**Dernière mise à jour :** 2026-07-29 (**chargement des périodes d’analyse
centralisé**). `useHistoricalPeriod(period, openedAt)` est désormais la seam
commune à « Séances par semaine », « Séries par muscle » et « Volume
d’entraînement ». Le hook calcule la fenêtre, choisit la portée historique, lit
les séances et l’antériorité, puis rend un snapshot cohérent avec son état
`stale`.

**Comportement préservé.** Les moteurs analytiques, périodes, tris, snapshots et
règles de séries n’ont pas changé. L’écran de progression d’un exercice garde sa
lecture spécialisée. Au premier chargement, les trois analyses globales
n’annoncent plus un faux état vide ; pendant un changement de période, elles ne
peuvent plus associer les nouvelles bornes à l’ancien résultat Dexie.

**Preuves.** Le cycle TDD couvre la fenêtre bornée, `Tout`, l’historique
antérieur et la conservation atomique du snapshot précédent. Lint, typecheck,
**763 tests** dans 58 fichiers et build de production passent. Aucun changement
de schéma, migration, donnée ou texte UI.

**Checkpoint téléphone :** ouvrir Historique → Analyses, puis les trois analyses
globales. Passer de 12 à 4 semaines puis à `Tout` : l’ancien rendu doit rester
brièvement visible à opacité réduite, sans faux message vide. Les chiffres,
semaines et répartitions doivent rester identiques.

**Dernière mise à jour :** 2026-07-29 (**projection historique — P0 corrigé,
module approfondi**). La lecture annuelle bornée respecte désormais la porte
opt-in de 5 000 ms sur le dataset de référence de 2 000 séances. Le schéma Dexie,
les données et les comportements visibles n'ont pas changé.

**Deux commits applicatifs séparés.** Le correctif remplace les grands `anyOf`
par des lectures `workoutId` petites, indexées et bornées. La refactorisation
fait de `listHistoricalWorkouts` la seam unique : sélection, soft-delete,
validation, ordre et identité historique restent derrière le repository ;
exports et analytics ne reçoivent plus les entités Dexie.

**Preuves.** Le benchmark annuel opt-in respecte la porte de 5 000 ms ; lint,
typecheck, tests unitaires et build de production sont verts. La baseline lente
reste versionnée dans `docs/baselines/2026-07-28-refactor-baseline.md`.

**Checkpoint téléphone :** ouvrir Historique → Analyses et comparer les périodes
4, 12, 26, 52 semaines et Tout. Vérifier ensuite une séance contenant un
exercice renommé ou supprimé, puis partager son export Markdown : nom historique,
totaux, séries et dates doivent être identiques à avant la refactorisation.

**Dernière mise à jour :** 2026-07-28 (**phase 0 — baseline de
refactorisation terminée**). Le tag `refactor-phase-0-start-2026-07-28` pointe
sur `fcfb03ab4cfea6e23c7c74a868feb46b3e219bb5` ; la référence durable est
`docs/baselines/2026-07-28-refactor-baseline.md`. Aucune fonctionnalité
applicative ni aucun schéma Dexie n'a changé.

**Historique de charge mesuré, pas produit.** Le dataset déterministe contient
2 000 séances, 16 000 lignes et 64 000 séries. Le benchmark opt-in a mesuré
`listHistoryPage({}, 0, 20)`, `listCompletedWorkoutTimestamps()` et une
projection annuelle bornée de `listExportSources`; la projection historique
reste le P0 à corriger séparément avant toute refactorisation structurelle.

**Scan d'architecture fait, sans décision d'interface.**
`improve-codebase-architecture`, `codebase-design` et `refactoring` ont été
utilisés. `reduce-system-complexity` n'est pas installé, car aucune source
vérifiée n'a été trouvée. Deux candidats sont consignés dans le rapport
temporaire ; la projection historique est la recommandation principale après
le correctif P0 séparé.

Les anomalies d'hôte sont consignées dans la baseline mais non corrigées :
`npm.ps1` est bloqué et le membre
`CompressionLevel.SmallestSize` manque sous Windows PowerShell 5.1. Les mesures
gzip utilisent une variante compatible. **57 fichiers, 766 tests** avant la
passation de cette tâche.

**Checkpoint manuel : aucune donnée du téléphone n'a été modifiée. Ouvrir
FitTrack, vérifier que l'accueil, l'historique et une séance existante
s'affichent comme avant. Aucun parcours fonctionnel neuf n'est attendu :
la phase 0 est une référence de mesure.**

**Dernière mise à jour :** 2026-07-28 (**jalon G4 — volume d’entraînement
hebdomadaire**). Le quatrième et dernier graphique de la première couche
d’analyse existe : `Historique → Analyses → Volume d’entraînement`. Spec :
`docs/superpowers/specs/2026-07-28-analytics-weekly-volume-design.md`.

**Un écran, deux cadrans, les semaines ne bougent pas.** `Tonnage` additionne
les charges externes réellement soulevées ; `Durée` additionne
`Workout.durationSeconds`, donc la séance complète et jamais les seules séries
chronométrées. Changer de métrique garde la semaine sélectionnée. Changer de
période revient à la semaine la plus récente.

**Le tonnage ne possède aucune formule neuve.** Chaque séance passe par
`sessionTotals()` avec le `weightRole` du type de mesure résolu par l’instantané
08A/08B : les échauffements, l’assistance et le lest ne se glissent donc pas
dans G4 par une seconde définition. Le poids du corps n’est pas inventé. Douze
tests neufs fixent en plus les deux séances d’une même semaine, les trous
internes, l’absence de semaines avant le début de l’historique, `Tout`, le
dimanche soir dans son offset, le changement d’heure, la moyenne avec zéro et
la durée de séance opposée exprès à celle d’une série.

**Quatrième graphique, quatrième passage par la même porte.**
`listExportSources({ kind: 'period', from, to })`, `periodBounds()` et
`listCompletedWorkoutTimestamps()` : aucune requête, aucun repository et aucune
définition de « séance qui compte » ajoutés. `WeeklyVolumeScreen` est différé ;
le build le sort à **6,72 kB** (**2,52 kB gzip**). Aucune dépendance, aucun jeton
de couleur et aucun octet de bibliothèque de graphiques.

**Le tonnage et la durée par muscle sont écartés, pas oubliés.** G3 donne déjà
la répartition des séries. Des kilos de squat et des kilos de mollets ne sont
pas commensurables ; une durée de séance ne se répartit pas honnêtement entre
ses exercices. G4 reste donc la seule lecture que ses deux unités partagent
réellement : leur évolution dans le temps.

**Zéro accent.** Une grosse semaine n’est ni un objectif atteint ni
automatiquement une victoire. Toutes les barres restent en `--text-2`.
La première version pilotée avait pourtant deux défauts que le typecheck ne
pouvait pas voir : l’axe écrivait **« 20,9 K »**, parce que `.label-xs`
capitalisait le suffixe compact `k`, et le moignon zéro, l’axe et la fente de
sélection ne mesuraient que **1,10:1 à 1,29:1**. L’axe est désormais en chiffres
tabulaires sans transformation de casse ; les repères informatifs utilisent
`--text-2` et la sélection est un contour qui franchit la base. Mesuré après
correction : **7,18:1 en sombre, 7,03:1 en clair**, sans introduire une couleur
qui porterait un faux sens.

**Revue indépendante refermée.** L’écran distingue maintenant la lecture Dexie
en cours d’une période réellement vide : il conserve le dernier graphique à
opacité réduite au changement de période et n’annonce plus prématurément
« Aucune séance ». Les dates longues incluent l’année pour rendre `Tout`
non ambigu, et une durée hebdomadaire nulle se lit **0 min**, jamais 0 s.

**56 fichiers, 764 tests** (+3 fichiers, +20) ; `lint`, `typecheck`, `test:run`
et `build` sont verts.

**Vérifié en pilotant, en 375 × 812 px**, sur les trois semaines présentes dans
la base locale : 8 842,5 kg, 20 868,4 kg puis une semaine courante à zéro ; la
liste et le cadran concordent, la semaine zéro est visible et sélectionnable,
la bascule vers la durée garde le 20 juillet sélectionné, et le retour au
tonnage rend bien 20 868,4 kg. Le changement 12 → 4 semaines revient à la
semaine la plus récente. SVG `role="img"` avec résumé complet, hors ordre de
tabulation ; une seule fente de sélection ; plus petite cible **48 px** ; aucun
débordement (`scrollWidth === innerWidth === 375`) ; aucune erreur console.
L’entrée « Volume d’entraînement » existe une seule fois entre le rythme et les
muscles sur l’écran Analyses.

**Checkpoint à vérifier sur le téléphone :** ouvre **Historique → Analyses →
Volume d’entraînement**. Sur « Tonnage », vérifie à la main une semaine avec une
séance de charge et une séance au poids du corps : seuls les kilos externes
réellement soulevés doivent compter. Passe à « Durée » : la semaine sélectionnée
ne doit pas changer et le total doit être la somme des durées complètes de tes
séances. Tape une semaine sans entraînement au milieu de ton historique : elle
doit rester visible et lire zéro. Change enfin de période et vérifie que les
semaines antérieures à ta première séance ne sont jamais inventées.

**Deux constats consignés, non codés** (2026-07-28, fin de session) :

**1. Une série n'est pas une unité de coût constante d'un muscle à l'autre.** Relevé par
l'utilisateur : « les lombaires et le haut du dos ne sont pas du tout chargés pareil ». Trois séries
d'hyperextension à 10 kg et trois de tirage horizontal à 47,5 kg pèsent identiquement sur cet écran.
**Le classement inter-muscles de G3 est donc un ordre de grandeur, pas un verdict** — ce qu'il sait
dire honnêtement, c'est un muscle comparé à lui-même dans le temps, et un zéro ou un quasi-zéro.
C'est une limite de la forme, pas un défaut à corriger ; à écrire dans la spec G3. (Le tonnage par
muscle de G4 ne la lèvera qu'en partie : des kilos de mollets et des kilos de squat ne sont pas
comparables non plus.)

**2. Une association Hevy mémorisée passe avant un alias canonique** (`saved ?? canonical`,
`hevyImportDraft.ts`). Conséquence : les quatre mauvais choix mémorisés lors du premier import
battraient les alias corrects ajoutés depuis, sur une réimportation future. **Le correctif envisagé
a été écarté en l'écrivant** : faire repasser en choix explicite les cas où les deux sources
divergent rouvrirait la question **à chaque import, indéfiniment**, puisque le conflit se recrée à
l'identique — et le cas le plus fréquent est légitime (un titre Hevy associé exprès à une machine
personnelle). Une vraie solution demande de savoir _quand_ le mapping a été enregistré, donc un
champ de plus. Risque faible et décroissant : l'usage est passé à la saisie dans l'app, et une
réimportation des mêmes séances est dédupliquée.

**Historique précédent :** 2026-07-28 (**le semis réconcilie la classification — sans quoi le
correctif catalogue n'atteignait personne**).

**Défaut livré par moi, trouvé par une capture d'écran du téléphone.** Après le correctif catalogue,
l'écran affichait encore **Fessiers 22**, **Grand dorsal 12 contre Haut du dos 6**, et Adducteurs à
zéro : exactement l'état d'avant. Cause : `seedDatabase()` était **strictement additif** — il
n'insérait que les slugs manquants et n'écrivait jamais sur une fiche existante. Les 4 exercices
neufs arrivaient donc bien, mais `Adduction à la machine` et les 7 rowings, déjà présents,
**gardaient leur ancien muscle**. Le correctif ne touchait qu'une installation neuve.

**Et la conséquence en cascade, qui est le vrai enseignement : « Réparer l'historique » relit la
bibliothèque.** Il a donc consciencieusement recopié `glutes` sur l'adduction. Le bouton
fonctionnait ; **c'est sa source qui était périmée**. Une réparation ne peut jamais dépasser la
qualité de ce qu'elle relit — le checkpoint annoncé envoyait droit dans le mur.

**`reconcileClassification()` réaligne `primaryMuscle` et `secondaryMuscles`, et rien d'autre.**
Arbitrage tranché après consultation (« le plus adapté ») : quel muscle un mouvement travaille est
une donnée anatomique dont l'app répond et dont **tous** les graphiques dépendent ; le **nom**, les
**notes** (`userNotes`, « siège position 4 » est l'exemple même du checkpoint du Lot 3) et le
**repos par défaut** appartiennent à l'utilisateur et ne sont touchés sur aucune ligne, jamais.
L'option « n'écrire que sur les fiches jamais modifiées » a été écartée pour une raison de fond :
elle échoue exactement là où ça compte, une seule note posée sur un rowing suffisant à lui laisser
son muscle faux à vie.

Écarts assumés, écrits plutôt que cachés : une fiche du catalogue **délibérément** reclassée par
l'utilisateur sera réalignée — ses propres exercices (`isCustom: 1`, sans slug) sont intouchables et
c'est là qu'un désaccord se loge. Les fiches **soft-deleted sont réalignées aussi** : un exercice
supprimé reste celui qui a été pratiqué, et son historique lit encore son muscle. Rien n'est écrit
quand rien ne diffère — la fonction tourne à chaque démarrage, et un `updatedAt` bougé pour rien
salirait toutes les lignes aux yeux de la synchronisation future (ADR-002).

Piège rencontré en écrivant les tests : **`slug` n'est pas indexé**, donc `where('slug')` échoue.
La réconciliation charge la table une fois — le semis la lisait déjà.

**53 fichiers, 744 tests** (+5), quatre portes vertes.

**Vérifié en pilotant, sur l'état exact du téléphone reproduit** : catalogue remis à l'ancienne
classification, note « Siège position 4 » et repos 210 s posés dessus, historique gelé sur les
anciens muscles. Au rechargement, la bibliothèque se réaligne seule (**adducteurs**, **haut du
dos**) et **la note, le repos et le nom sont intacts** ; l'historique, lui, **reste gelé** — le passé
ne se repeint pas tout seul. Après le bouton : « 2 exercices de séance corrigés », et l'écran affiche
**Adducteurs 6 · Haut du dos 4**.

**Ordre à respecter, et c'est le nouveau checkpoint :** ouvrir l'app **d'abord** (le semis réaligne
la bibliothèque), **puis** Réglages → Réparer. L'inverse ne donne rien.

**Historique précédent :** 2026-07-28 (**une hypothèse ne porte plus l'habit d'une certitude**).
Suite directe du correctif catalogue ci-dessous. Question posée par l'utilisateur : « on devrait
améliorer la reconnaissance des exos ? » — **non, et les chiffres le disent** : les quatre titres qui
partaient n'importe où n'avaient aucune cible au catalogue. Cinq exercices ajoutés et quatre lignes
d'alias ont fait 20/24 → **24/24 sans toucher une ligne d'algorithme**. Améliorer le classement de
secours n'aurait produit que de **meilleures mauvaises réponses** : il ne se déclenche que là où le
catalogue est muet, et aucun score ne sort une rotation externe d'une liste qui n'en contient pas.

**Ce qu'il fallait corriger, c'est ce que l'app fait quand elle ne sait pas.** `HevyMappingDraftRow`
portait `suggestion = canonical ?? rankHevyExerciseCandidates(...)[0]` — donc, faute d'alias, le
premier d'un classement flou. La feuille l'affichait en **bouton `primary`, pleine largeur, en tête**
(l'élément le plus sûr de la charte) et la ligne de revue affichait son **nom** sous l'étiquette
« Proposition ». Un appui, et l'hypothèse était gelée par l'instantané 08A.

**`suggestion` est supprimé, pas rendu prudent.** Réduit au certain, il devenait exactement
`resolution` : deux noms pour une chose. `resolution` n'est donc plus posé d'office que par un
**alias canonique** ou un **mapping mémorisé**, les deux seules sources sûres.

**Et la vraisemblance n'est pas jetée — elle descend à sa vraie place : elle ordonne la liste.**
`filterHevyMappingExercises` trie désormais par `rankHevyExerciseCandidates`. Le bon candidat reste à
un seul appui, mais c'est un choix pris **parmi ses alternatives** au lieu d'une réponse entérinée.
Rien n'est écarté : l'ordre change, jamais le contenu — un test le fixe.

Étiquettes suivies : « Proposition » devient **« À choisir »**, et `importUseSuggestion` est
supprimée (chaîne morte). **53 fichiers, 739 tests** (+1 fichier, +4), quatre portes vertes.

**Vérifié par les tests, pas en pilotant** — et c'est signalé plutôt que glissé : avec le catalogue
corrigé, les 24 titres du vrai CSV sont tous canoniques, donc la feuille d'association ne s'ouvre
plus du tout sur cet export. Le nouveau comportement se voit sur un titre non couvert ; les trois
tests neufs le fixent, le parcours réel n'a pas été rejoué au doigt.

**Historique précédent :** 2026-07-28 (**correctif catalogue — G3 a trouvé un vrai défaut, et ce
n'était pas dans G3**). Retour d'usage : « les séries me paraissent incohérentes… en fait j'ai
l'impression que certains exos sont mal mappés ». Il avait raison, et le vrai CSV Hevy l'a prouvé.

**Diagnostic fait sur ses vraies données, pas sur une fixture.** Son export réel (5 séances,
110 séries de travail, 24 titres) rejoué dans le vrai pipeline d'import : **abdominaux 15 et épaules
6**. Or il ne fait que du gainage en abdos. Quatre défauts, tous dans le **catalogue**, aucun dans
le moteur de G3 :

| Défaut                                                  | Effet                                                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Aucune rotation externe / coiffe dans les 168 exercices | « Rotation Externe Poulie » classé sur un **crunch** → 4 séries d'épaules en abdos                                     |
| Aucun développé épaules à la poulie                     | « Développé Debout Poulie Centrée » sur un **Pallof press** → 4 de plus en abdos                                       |
| `Adduction à la machine` classée `glutes`               | l'adduction travaille les **adducteurs** ; c'est l'ABduction qui fait le moyen fessier                                 |
| 7 rowings horizontaux classés `lats`                    | et le catalogue **se contredisait** : « Rowing buste appuyé » était en `upper_back`, « Rowing à la machine » en `lats` |

Après correction, sur les mêmes 110 séries : **abdominaux 7, épaules 14**, fessiers 22 → 16,
adducteurs 6, haut du dos 3 → 5. Et **les 24 titres tombent automatiquement, zéro « À choisir »**
(il y en avait 4).

**`adductors` est le 19e `MuscleGroup`,** décidé avec l'utilisateur. Le vocabulaire n'avait pas la
case, donc six séries par semaine atterrissaient sur le muscle que le mouvement _opposé_ travaille.
**Les deux garde-fous ont sauté au typecheck, exactement comme ils sont faits pour** : l'étiquette
française de `fr.ts` et le `Record<MuscleGroup, MuscleScope>` de G3. C'est la première fois qu'ils
servent, et ils ont désigné les deux seuls endroits à corriger.

**La règle de classement du dos est écrite plutôt que devinée** : **plan vertical** (traction,
tirage vertical, pull-over) → grand dorsal ; **plan horizontal** (rowing, tirage horizontal) → haut
du dos, parce que c'est de la rétraction d'omoplates. Appliquée aux 7 d'un coup. Piège désamorcé en
route : le slug `rowing-machine` n'est pas un rowing, c'est le **Rameur** (cardio) — première
tentative reprise depuis les vrais slugs, avec une garde qui refuse de reclasser ce qui n'était pas
`lats`.

**Quatre tests ont échoué, et il ne fallait surtout pas retourner leur assertion.**
`hevyExerciseMatch.test.ts` affirmait « does not invent a canonical target for » les quatre titres
en question. Ce test disait vrai **de l'état du catalogue**, pas d'un comportement voulu. Les quatre
sont donc passés dans le tableau « maps X to slug Y », même assertion, et **la règle de fond est
gardée dans un test neuf** sur un titre inconnu : un titre non couvert ne reçoit aucune association
d'office. Ce n'est pas l'assertion qui a changé, c'est le catalogue.

**Le vrai manque que ce bug a révélé, et il dépasse le cas : rien ne permettait de réparer un
historique déjà écrit.** La migration v2 a gelé le muscle sur chaque ligne — c'est tout l'acquis de
08A/08B — donc corriger le catalogue ne rattrape rien. D'où
`resnapshotHistory()` (`repositories/historyRepair.ts`) et **Réglages → Réparer les muscles de
l'historique**, sous `ConfirmSheet` : **ça repeint le passé, donc jamais automatique et jamais
silencieux**, et la phrase de confirmation annonce le prix (un exercice renommé depuis prendra son
nouveau nom) au lieu de demander « es-tu sûr ? ». Cinq tests, dont le piège qui compte :
`snapshotOf(undefined)` rend `{}`, et l'écrire **effacerait** la seule trace de ce qu'était une
ligne dont l'exercice a disparu — la fonction garde donc la ligne intacte. Les exercices
soft-deleted sont lus (un exercice supprimé est encore celui qui a été pratiqué), `updatedAt` est
touché seulement quand la ligne change vraiment (ADR-002).

**52 fichiers, 735 tests** (+1 fichier, +6) ; quatre portes vertes, aucun avertissement au build.

**Vérifié en pilotant**, base repartie de zéro pour semer le catalogue corrigé : Rameur toujours en
`cardio`, puis un historique fabriqué **dans l'état du bug** (adduction gelée en `glutes`, tirage
horizontal en `lats`, plus une ligne dont l'exercice n'existe pas). Avant : Fessiers 6, Grand dorsal 4. Après le bouton : **Adducteurs 6, Haut du dos 4**, Fessiers et Grand dorsal à 0, rapport
« 2 exercices de séance corrigés » — la troisième ligne gardée, et son instantané « Machine de la
vieille salle / quads » **intact**.

**Checkpoint à vérifier sur le téléphone :** ouvrir **Réglages → Réparer les muscles de
l'historique**, lire la phrase de confirmation, confirmer. Puis **Historique → Analyses → Séries par
muscle** : tes abdominaux doivent tomber à tes seules séries de gainage, et tes épaules remonter.
Vérifie ensuite dans l'Historique qu'aucune séance n'a changé de charge ni de répétitions — la
réparation ne touche que le nom, le muscle, le matériel et le type de mesure.

**Historique précédent :** 2026-07-28 (**jalon G3 — séries par muscle**). La répartition existe :
`Historique → Analyses → Séries par muscle`. Spec :
`docs/superpowers/specs/2026-07-28-analytics-muscle-group-series-design.md`.

**Aucune requête neuve, troisième fois de suite.** `listExportSources({ kind: 'period', from, to })`
et `periodBounds()`, comme G1 et G2. Un troisième fichier de requêtes ferait **une troisième
définition de « séance qui compte »** — la faute que 08B a passé une session à réparer.

**Le muscle principal seul, et c'était la décision à prendre d'avance.** `secondaryMuscles` a été
exclu de l'instantané exprès au jalon 08A et n'existe que dans la bibliothèque **d'aujourd'hui** :
une répartition qui le lirait redistribuerait six mois de séries passées à chaque édition d'un
exercice — le bug de 08B, transposé du nom au muscle. La migration v3 a été examinée et écartée :
elle ne pourrait remplir les lignes existantes qu'avec la bibliothèque d'aujourd'hui, donc en
**inventant** le passé au lieu de le conserver. Et surtout, la pondération (1 au principal, 0,4 aux
secondaires) ne peut pas devenir une unité de comptage : « 48 » cesserait d'être un nombre de séries
pour devenir un score dont le total ne vaut plus ce qui a été fait, et qu'aucun comptage manuel dans
l'Historique ne retrouve. **Un compte se vérifie, un score se croit** — et être vérifiable est la
seule prétention de cet écran. L'approximation est écrite sur l'écran, en une phrase.

**G3 est une troisième forme, et `ChartSurface` n'est pas touché — vérifié, pas supposé.** Ses trois
possessions tombent une par une. (1) **Pas de `<svg>`** : les étiquettes sont des noms français à
taille de lecture, et un `<text>` dans un `viewBox` mis à l'échelle ment sur sa taille — c'est
exactement pourquoi G1 et G2 gardent tout leur texte **hors** du SVG ; le texte en HTML impose la
barre en HTML. (2) **Pas de « marque la plus proche en x »** : les marques sont empilées en y. (3)
**Pas de résumé lecteur d'écran séparé, parce que le dessin EST la liste.** En G1 et G2, le `<svg>`
était muet et il fallait une liste jumelle en dessous ; une ligne classée porte son nom et son
nombre en texte. Il n'y a pas de doublon accessible à écrire quand il n'y a pas d'original
inaccessible.

**Donc aucune sélection, et c'est une conséquence, pas un oubli.** G1 et G2 ont un curseur parce
qu'une marque posée sur un axe partagé ne peut pas porter son étiquette. Une ligne classée la porte
déjà : une sélection ne révélerait **rien**. Les lignes ne sont donc pas des boutons — vérifié en
pilotant, aucun `<button>` dans les quinze `<li>`.

**Une troisième géométrie dans `plot.ts`, et pas une généralisation des deux premières.**
`barFractions(values, ceiling)` rend une **part de piste de 0 à 1**, et non des coordonnées, parce
que la piste est fluide (§ ci-dessus) — c'est aussi ce que le rail de `HistorySummaryCard` consomme
déjà (`scaleX`). Ce n'est pas `barLayout` couché : `barLayout` place N colonnes **le long** d'une
boîte (`slot`, `centerX`, `BAR_FILL`) parce que l'axe des abscisses est à lui ; ici la mise en page
appartient au DOM et quatre des cinq champs de `BarSlot` seraient ignorés. Ce que la fonction
possède vraiment : **une valeur nulle rend exactement 0, jamais le plancher** (l'absence n'est pas
une petite quantité), et **une valeur non nulle garde un plancher** de 2 % (1 série sur un plafond
de 60 fait deux pixels et se lit comme zéro). C'est le symétrique de la leçon de G2, que G2 n'avait
pas rencontré.

**Le zéro : information, et c'est le point de conception du jalon.** Transposition de la leçon de
G2, demandée au cadrage. Ce qui départageait en G2 n'était pas « vide » mais **ce que l'app sait** :
avant le premier enregistrement elle ne sait rien, au milieu elle sait tout. Ici, sur une période,
la couverture est complète par construction — « 0 série de mollets en 12 semaines » est un fait
**observé**, et c'est le seul fait que cet écran existe pour donner. **La liste des lignes vient donc
de l'anatomie, pas des données.** Un muscle négligé qui disparaît de la liste est un muscle qu'on ne
remarque pas : ce serait le seul vrai échec possible de cet écran. Un muscle à zéro reçoit **4 px en
`--border`**, la réponse exacte de G2 tournée de 90°.

**Sauf trois, et c'est ainsi que le type devient explicite.** `cardio`, `full_body` et `other` n'ont
aucune région anatomique. Le critère qui tranche est celui ci-dessus : « 0 série de Corps entier »
ne dit rien à personne — ce ne sont pas des muscles, ce sont des cases de rangement. Ils sortent du
classement et **n'apparaissent que s'ils portent quelque chose** : faire disparaître quarante séries
de cardio serait l'autre faute, celle que le Lot 5bis nomme (« ça existe, mais rien ne le montre »).
D'où `MUSCLE_SCOPE: Record<MuscleGroup, 'region' | 'unscoped'>` — **un `Record` et pas une liste** :
ajouter une valeur à `MUSCLE_GROUPS` sans la classer casse le typecheck, même mécanique que
`muscle.*` dans `fr.ts`. Un quatrième cas est nommé plutôt qu'avalé : une ligne dont le muscle ne se
résout pas va sous « Muscle inconnu », **jamais fondue dans `other`** — `other` est un choix de
l'utilisateur, l'inconnu est un trou de l'app. `neck` n'est pas un cas spécial : décider quels
muscles méritent une ligne serait l'app décidant ce que son utilisateur a le droit de négliger.

**Zéro chose colorée, et il faut le dire parce que la règle en demande une.** La charte réserve
l'accent aux actions primaires, aux séries validées et aux records ; **G3 n'a aucun des trois.**
Colorer le muscle le plus travaillé serait **féliciter un déséquilibre**, l'inverse exact de ce que
l'écran sert à voir ; colorer le moins travaillé serait une alerte que l'app n'a aucun seuil pour
justifier. La règle dit « une seule chose colorée **et c'est une information** », pas « il en faut
une ».

**Une erreur de la spec corrigée pendant l'implémentation, et elle valait la peine.** La spec
affirmait que `hasEarlierHistory` n'avait aucun sens ici — vrai pour la répartition (un muscle ne
commence pas d'exister à une date), **faux pour la moyenne hebdomadaire de l'en-tête**, qui est un
chiffre _par semaine_ et hérite mot pour mot du défaut que G2 a payé en usage. `listCompletedWorkoutTimestamps()`
est donc lu ici aussi, et le nombre de semaines n'est pas `WEEKS[period]` mais
**`weeklySessionCounts(...).length`**, le moteur de G2 lui-même : les deux écrans ne peuvent pas
diviser par deux nombres différents. Vérifié en pilotant — 4 semaines d'historique dans une fenêtre
de 12, 26 ou 52 donnent **13,6 par semaine** dans les trois cas, jamais 5,7.

**51 fichiers de tests, 729 tests** (+1 fichier, +21) ; `lint`, `typecheck`, `test:run` et `build`
sont verts, et le build n'a toujours **aucun** avertissement. `MuscleBalanceScreen` sort à
**4,94 kB** (gzip 1,89) en quatrième route différée.

**Vérifié en pilotant, en 375 × 812 px**, sur 8 séances et 68 séries de travail injectées sur
4 semaines, avec cinq pièges posés exprès et tous désamorcés : **4 échauffements exclus** (total 68
et non 72) ; **le même exercice deux fois dans une séance additionne** (Pectoraux 13 = 4+2+4+3) ; une
ligne dont **l'instantané dit « mollets » et la bibliothèque « épaules »** compte pour les mollets
(2), et les épaules restent à 3 ; **égalité Biceps 6 / Triceps 6 départagée par l'ordre canonique** ;
**Cardio 5 et Muscle inconnu 1 en « Hors répartition »**, jamais fondus ensemble ni dans « Autre ».
Quatre régions à 0 (Trapèzes, Avant-bras, Lombaires, Cou) restent à l'écran avec leur moignon de
4 px en `--border`, visuellement impossible à confondre avec la plus petite quantité réelle (20,2 px
pour 2 séries). **La longueur est la quantité** : 8/13 mesuré à 0,615 contre 0,615 attendu. Aucun
débordement horizontal (`scrollWidth === innerWidth === 375`), plus petite cible 48 px, aucune
erreur console, et l'état vide affiche bien sa phrase au lieu de quinze barres à zéro.

**Checkpoint à vérifier sur le téléphone :** ouvrir **Historique → l'icône de courbe → Séries par
muscle**. Le total en haut doit être **le nombre de séries de travail que tu as réellement faites**
sur la période — échauffements exclus — et il doit se retrouver à la main dans l'Historique si tu
comptes. Vérifie que les muscles que tu sais négliger sont bien **en bas de la liste, à zéro, et
toujours visibles** : c'est ce que l'écran existe pour montrer. Attention au sens de la mesure : un
exercice compte pour **son muscle principal seulement**, donc le développé couché ne donne rien aux
triceps — la phrase sous le graphique le dit. Renomme ou **reclasse** un exercice dans la
bibliothèque (change son muscle principal) : **la répartition passée ne doit pas bouger.** Enfin,
change de période — 4, 12, 26, 52 semaines et Tout : la moyenne « par semaine » ne doit pas
s'effondrer quand la fenêtre est plus large que ton historique.

**Historique précédent :** 2026-07-28 (**jalon G2 — séances par semaine**). Le rythme
d'entraînement a son histogramme : `Historique → Analyses → Séances par semaine`. Spec :
`docs/superpowers/specs/2026-07-28-analytics-weekly-sessions-design.md`.

**Aucune requête neuve, et l'alternative légère a été refusée pour une raison de fond.**
`listCompletedWorkoutTimestamps()` (Lot 07) rend exactement ce qu'un compte de séances demande —
sauf qu'elle ne rend que des `number`. Or une séance porte son propre
`startedTimezoneOffsetMinutes` (jalon 08A), et sans lui il est impossible de dire dans quelle
semaine civile elle tombe. `listExportSources({ kind: 'period', from, to })` rend le `Workout`
entier, donc l'offset vient avec. `'all'` passe par `{ kind: 'all-history' }`, qui existait déjà :
inventer `from: 0` aurait marché **et** aurait été l'app décidant en silence de sa date de
naissance.

**Contradiction connue, consignée plutôt que glissée :** la carte Régularité de l'Historique
groupe encore par l'offset du téléphone d'aujourd'hui. Sur une seule zone elle donne le même
résultat que cet écran ; après un voyage, non. Hors périmètre de G2 — la corriger veut dire changer
la signature d'une lecture du Lot 07 et rejouer ses 15 tests.

**Le moteur de régularité est réutilisé, et rien n'a été déplacé.** `startOfLocalWeek`,
`addLocalWeeks` et `resolveWeeklyGoal` sont importés de `lib/history.ts`, comme `periods.ts` le
faisait déjà. Déplacer aurait coûté un renommage à travers quatre fichiers du Lot 07 pour zéro
comportement gagné. `resolveWeeklyGoal` est le point qui compte : **l'objectif change dans le
temps**, et une semaine de juin doit être jugée sur l'objectif de juin. Vérifié en pilotant, et
c'est visible dans le dessin : avec un objectif passé à 4 il y a six semaines, la semaine du
1er juin à **3 séances est verte** parce que l'objectif d'alors était 2. Sous l'objectif
d'aujourd'hui le décompte donnerait 6 semaines validées, pas 8.

**Le fuseau :** `weekStartOf(startedAt, offset)` en trois pas — le jour civil de la séance
(`localDateKey`), ce jour reconstruit **à midi** dans le calendrier du lecteur, puis
`startOfLocalWeek`. Midi et non minuit : dans certains fuseaux minuit n'existe pas le jour d'un
passage à l'heure d'été et `new Date(y, m, d)` glisse d'un jour. La reconstruction dans le
calendrier du lecteur est aussi ce qui fait tomber le résultat **exactement** sur l'un des seaux
énumérés ; sans elle, une séance et son seau vivraient dans deux référentiels et ne se
rencontreraient jamais. Offset absent (séances d'avant la migration v2) → offset du lecteur, donc
le comportement du Lot 07 à l'identique.

**Un retour d'usage corrigé juste après, et il portait sur le raisonnement central du jalon :
« l'app me montre des semaines à 0 avant que mon historique commence, ça sert pas à
grand-chose ».** Il a raison. La règle « une semaine sans séance est une semaine où on ne s'est
pas entraîné » n'est vraie **qu'à partir de la première séance enregistrée**. Avant elle, un zéro
n'est pas une mesure : c'est une semaine dont l'app ne sait rien, donc exactement le zéro inventé
que G1 interdit — la règle avait été appliquée trop loin. Et il coûtait deux fois : trois semaines
d'historique réel dessinaient **neuf barres vides devant elles**, et la moyenne annonçait **0,5
séance par semaine au lieu de 1,5**, parce qu'elle divise par le nombre de seaux.

La distinction à tenir est fine : **une semaine vide _avant_ l'historique n'existe pas ; un trou
_dans_ l'historique reste**, c'est lui l'information. `weeklySessionCounts` reçoit donc
`hasEarlierHistory`, et **il ne peut pas être déduit à l'intérieur** : la fenêtre ne rend que son
propre contenu, et vu de l'intérieur « rien avant » et « rien pendant » sont indiscernables.
L'écran répond avec `listCompletedWorkoutTimestamps()` — la lecture de `number` nus écartée plus
haut pour le comptage, ici au bon niveau puisqu'on ne lui demande qu'un booléen. Vérifié dans les
deux sens en pilotant : 3 semaines d'historique dans une fenêtre de 12 → **4 barres**, axe partant
de la première séance, moyenne 1,5, et le trou du milieu conservé ; puis une séance ajoutée 20
semaines en arrière → les **12 barres** reviennent, vides du début comprises, moyenne 0,5. Trois
tests neufs fixent les deux sens et leur frontière.

**Un second retour d'usage, sur le dessin cette fois : « je comprends pas ce qu'est la colonne
blanche, ni pourquoi la hauteur est comme ça ».** Deux questions, une seule cause — si ça demande
une explication, c'est raté. (1) **La barre sélectionnée changeait de couleur** (`--text-2` →
`--text-1`), alors que la spec elle-même disait « la sélection n'est pas une couleur » : elle se
lisait donc comme une _troisième catégorie_ à côté du vert et du gris, au lieu d'un curseur. (2)
**Une semaine à zéro ne dessinait rien du tout**, donc l'œil lisait un espacement irrégulier
plutôt qu'une colonne vide — et une fois le rythme des colonnes cassé, toutes les hauteurs
paraissent arbitraires.

Corrigé en trois points : la sélection est **la fente allumée** (`--surface-2`), dessinée en
premier, et elle **franchit la ligne de base en haut et en bas** — parce qu'aucune barre ne fait
ça, donc elle ne peut pas être prise pour une valeur ; c'était exactement l'erreur de la version
blanche. Une barre garde une seule règle de couleur : accent si l'objectif est atteint, `--text-2`
sinon, quoi qu'il arrive. Et une semaine à zéro reçoit **4 px dans le ton de l'axe** : « cette
semaine existe, et elle vaut zéro », sans jamais se lire comme une petite quantité. Vérifié en
pilotant, y compris le cas décisif — taper la semaine vide pose bien la bande dessus et la lecture
affiche « 0 séance ».

**Zéro est une mesure — c'est la règle de G1 retournée, et c'est le point de conception du
jalon.** G1 : « une séance sans valeur pour la métrique ne produit aucun point, jamais un zéro »,
parce qu'un zéro inventé fait plonger la courbe. Ici, **une semaine sans séance n'est pas une
donnée manquante : c'est une semaine où on ne s'est pas entraîné**, et c'est l'information que
l'écran existe pour donner. Les deux règles disent la même chose — on ne trace que ce qu'on sait.
D'où la conséquence structurelle : **la liste des barres vient de la période, pas des séances.**
C'est aussi ce qui rend la moyenne honnête, « 3 séances par semaine » calculé en sautant les
semaines vides ne voulant rien dire.

**Une barre n'est pas une ligne — ce qui a été factorisé, et ce qui ne l'a pas été.** G1 interdisait
d'abstraire avant deux cas concrets ; il y en a deux, et la réponse est que **le dessin ne se
factorise pas et l'interaction se factorise entièrement**.

- _Pas partagé — l'échelle._ `plotBounds` borne par les données et non par zéro, et G1 a payé ce
  choix en gravant le min et le max. Pour un histogramme ce serait un mensonge : **la longueur
  d'une barre EST la quantité**, 2 et 4 doivent faire du simple au double. D'où `barLayout()` à
  côté de `plotPoints()`, et pas un drapeau : une ligne et une barre ne sont pas d'accord sur ce
  que veut dire le bas de la boîte. Les deux étiquettes gravées ne sont donc plus le min et le max
  mais **le plafond et le zéro**.
- _Pas partagé — la marque et la sélection._ Un anneau autour d'une barre de hauteur **zéro**
  n'entoure rien, or la semaine à zéro est précisément celle qu'on veut taper. La sélection est un
  repère **sous le filet de base**. Vérifié en pilotant : taper la colonne du 8 juin (0 séance)
  sélectionne bien cette semaine et affiche « 0 séance · Objectif 2 · il en manquait 2 ».
- _Partagé, et c'est tout — la surface._ `ChartSurface` : le `<svg>`, son `viewBox`, `role="img"`
  - résumé, l'absence d'ordre de tabulation, `touch-none`, la capture du pointeur et « la marque la
    plus proche en x ». Il reçoit **les abscisses**, pas les données : il ne sait ni ce qu'est une
    séance ni ce qu'est une semaine. `ProgressChart` est réécrit par-dessus — non-régression vérifiée
    en pilotant : même `viewBox -12 -12 324 144`, même résumé lecteur d'écran, un seul point accent,
    et le geste sélectionne toujours (appui au tiers → 82,5 kg au 25 mai).
- _Pas fait :_ aucun `<Chart type="line" | "bar">`, aucune couche « série ». Deux cas ne font pas
  une bibliothèque.

**Une seule chose est colorée : la semaine qui atteint son objectif.** La charte réserve l'accent
aux actions primaires, **aux séries validées** et aux records. Une semaine tenue est une semaine
validée au sens exact où une série cochée l'est : un engagement pris puis tenu. Même vert, même
fait, autre échelle. Et **l'objectif fixe le plafond de l'échelle** plutôt que d'ajouter une ligne
de repère : objectif 5 contre des semaines à 2 laisse les barres à deux cinquièmes, le manque se
voit sans qu'on l'écrive — et un repère aurait été un escalier, l'objectif changeant dans le temps.
Cas traité : **aucun objectif jamais défini** → aucune barre verte, et une phrase renvoyant vers
l'Historique. Inventer un objectif serait féliciter quelqu'un pour une cible qu'il n'a pas choisie ;
`goalWeeksReached` rend d'ailleurs `judged: 0` et non « 0 sur 12 ».

**Le warning Vite historique a disparu, et c'est un effet de bord à ne pas prendre pour une
victoire.** Avant ce jalon : `index` à **653,67 kB** (gzip 188,58) avec l'avertissement. Après :
`index` **398,10 kB** (gzip 107,06) + un chunk `Screen` partagé de **258,21 kB** (gzip 83,95), sans
avertissement. La troisième route différée a donné à Rollup une frontière pour sortir de l'entrée
du code déjà commun. **Les octets n'ont pas disparu, ils se sont scindés** ; c'est le premier
chargement qui est découpé, pas le total qui baisse. `ChartSurface` sort en chunk partagé de
1,48 kB, `WeeklySessionsScreen` à 6,41 kB (gzip 2,35).

**50 fichiers de tests, 708 tests** (+1 fichier, +29) ; `lint`, `typecheck`, `test:run` et `build`
sont verts, et le build n'a plus **aucun** avertissement.

**Vérifié en pilotant, en 375 × 812 px**, sur 67 séances injectées couvrant 26 semaines avec deux
trous, un changement d'objectif, deux séances le même jour et un dimanche à 23 h 30 porté à UTC+2 :
12 seaux dont les deux semaines vides ; les deux séances du même jour comptent pour 2 ; **la séance
du dimanche 23 h 30 reste dans SA semaine** (5 le 29 juin, 0 le 6 juillet — elle aurait glissé sans
son offset) ; moyenne 2,9 ; 8 semaines sur 12 à l'objectif ; échelle gravée 5 / 0 ; aucun
débordement horizontal (`scrollWidth === innerWidth === 375`) ; plus petite cible 48 px ; SVG hors
ordre de tabulation ; aucune erreur console.

**Checkpoint à vérifier sur le téléphone :** ouvrir **Historique → l'icône de courbe → Séances par
semaine**. Le nombre de barres doit être le nombre de semaines de la période, **trous compris** —
une semaine où tu n'as rien fait doit apparaître comme une colonne vide, pas disparaître. Tape une
de ces colonnes vides : la lecture doit dire « 0 séance ». Vérifie ensuite que les semaines vertes
sont bien celles où tu as tenu ton rythme, et que la phrase du bas (« X semaines sur Y à
l'objectif ») correspond à ce que tu comptes à la main. Si tu changes ton objectif hebdo dans
l'Historique, **les semaines passées ne doivent pas changer de couleur** — seules les semaines à
partir de ce lundi sont jugées sur la nouvelle cible. Enfin, change de période : 4, 12, 26, 52
semaines et Tout.

**Historique précédent :** 2026-07-28 (**jalons G0 + G1 — la couche d'analyse et la première
courbe**). Un exercice a maintenant sa progression : `Historique → Analyses`, ou « Voir la
progression » depuis sa fiche. Spec :
`docs/superpowers/specs/2026-07-28-analytics-exercise-progress-design.md`.

**G0 n'a ajouté aucune requête, et c'est le point de conception du jalon.** Le document de
finition demandait trois lectures bornées neuves (§9.1) ; les trois existaient déjà sous un autre
nom. `listExportSources(scope)` applique exactement ses règles — séances archivées, lignes et
séries vivantes, séries validées seulement, `from` inclusif / `to` exclusif, bornage par l'index
`startedAt` — et son en-tête l'annonçait depuis E1 (« the bounded reads the exports **and, later,
the charts** are built on »). Écrire `analyticsQueries.ts` aurait fait deux portes vers la même
table avec deux définitions possibles de « séance qui compte » : exactement la faute que 08B vient
de réparer entre l'écran d'historique et l'export.

Ce qui manquait, c'est l'agrégation. Elle est pure, dans `src/lib/analytics/` : `periods.ts`
(bornes tombant sur des débuts de semaine locale — « il y a 28 × 24 h » coupe une semaine en deux
et fait clignoter le premier point selon l'heure d'ouverture), `metrics.ts`, `plot.ts` et
`sessions.ts`.

**`metrics.ts` porte la seule règle qui compte : jamais la même métrique pour tous les types
d'exercice.** Onze métriques, réparties par `measurementType` **lu dans l'instantané**. Sans cette
table, « charge max » sur une machine assistée félicite la séance la plus _aidée_ — le poids d'une
assistance dort dans le même champ que celui d'un développé couché. D'où aussi
`betterWhen: 'higher' | 'lower'`, qui n'existe que pour l'assistance : **descendre y est une
victoire**, donc le record est le minimum. Vérifié en pilotant : sur les dips assistés, le point
accent est à `cy = 120`, tout en bas de la boîte.

Deux règles héritées, jamais réécrites : les échauffements sortent par `isWorkingSet`, et le
tonnage passe par `sessionTotals` — aucun troisième calcul du tonnage n'existe dans ce dépôt. Et
une règle neuve : **une séance sans valeur pour la métrique ne produit aucun point, jamais un
zéro.** Un zéro serait tracé, et une courbe qui plonge au sol parce qu'un exercice a été retypé est
un mensonge que le lecteur ne peut pas voir.

**Le graphique est un cadran, pas une illustration.** SVG à la main, zéro dépendance : la seule
chose qu'une bibliothèque calcule vraiment est dans `plot.ts`, où elle est testée, et Recharts
aurait coûté ~100 kB gzip sur un chunk déjà signalé, plus une charte à re-mater et des tooltips au
survol — inutilisables au doigt. **Une seule chose est colorée : le point qui détient le record**,
parce que la charte réserve l'accent aux actions primaires, séries validées et records, « rien
d'autre » — une courbe de séances passées n'est aucun des trois, son sommet si. Aucune grille : le
min et le max sont **gravés aux deux bouts**, ce qui est le prix payé comptant pour une échelle qui
ne part pas de zéro (80 → 85 kg sur un axe partant de zéro est plat, donc muet). Deux étiquettes,
jamais une par point. On **tape**, on ne survole pas : un appui n'importe où sélectionne le point le
plus proche en x, donc aucune cible ponctuelle à viser. Le tableau accessible n'est pas un doublon
caché : c'est la liste de séances, et elle porte chaque valeur.

**Un défaut trouvé uniquement en pilotant :** ouvrir la courbe d'un second exercice gardait la
sélection du premier — le gainage s'ouvrait sur le 2 juin parce que c'est là qu'on avait tapé sur le
développé couché. Cause : **React Router ne remonte pas le composant quand seul le paramètre
change.** Corrigé par l'état clé-sur-l'exercice, l'idiome que `ExerciseDetailScreen` utilise déjà.
La période, elle, survit exprès : c'est la fenêtre qu'on lit, pas une propriété de l'exercice.

**Les routes d'analyse sont les seules différées** (§12.2), et le découpage est mesuré :
`ExerciseAnalyticsScreen` sort à **9,34 kB** (gzip 3,25) du bundle principal. La séance en direct ne
paie pas le JavaScript des graphiques.

**Trois écarts argumentés avec le document de finition**, détaillés dans la spec : pas de
`analyticsQueries.ts` (ci-dessus) ; **pas d'allure (min/km)** — elle demande une seconde inversion
de sens et une unité composite que rien d'autre n'écrit, une inversion suffit à un premier jalon ;
**pas de 1RM estimé** — c'est RF-46 et il appartient au Lot 12, avec sa formule configurable en TDD.

**49 fichiers de tests, 679 tests** (+4 fichiers, +38) ; `lint`, `typecheck`, `test:run` et `build`
sont verts. Le warning Vite historique sur le chunk principal reste le seul avertissement.
Vérifié en 375 × 812 px sur un historique de 9 semaines injecté : aucun débordement horizontal
(`scrollWidth === innerWidth === 375`), cibles de 48 et 56 px, un seul point accent, résumé
lecteur d'écran complet, aucune erreur console.

**Deux retours d'usage corrigés juste après, sur capture d'écran :** (1) **le point du record était
rogné à droite** — l'anneau de sélection fait `r = 9` plus 1,5 px de trait, soit 9,75 px, et le
`viewBox` n'en réservait que 8 ; or le dernier point est précisément là où le record se trouve le
plus souvent. `PAD` passe à 12, marge restante mesurée : 2,25 px. (2) **le contenu collait à
l'en-tête sur tous les écrans** — `Screen` ne posait aucune marge haute sur sa zone de défilement.
`pt-3` ajouté **là**, dans le cadre, et pas dans vingt écrans dont un finirait par l'oublier : avec
le `pb-4` de l'en-tête ça fait 28 px, exactement l'écart que les écrans posent déjà entre deux blocs
(`space-y-7`). Vérifié à 12 px sur Historique, Exercices, Routines, Réglages, Analyses, Progression,
Diagnostic, formulaire d'exercice et éditeur de routine. La bande épinglée de la séance en direct
reste au ras de l'en-tête, volontairement : c'est un bandeau d'instruments qui porte son propre
filet, et le contenu reçoit ses 12 px sous elle.

**Simulation complète du checkpoint** (l'utilisateur n'a pas encore assez d'historique) : 78 séances
et 226 séries fabriquées sur 9 mois. Cinq cas vérifiés dans l'app réelle — 40 séances avec plateau,
blessure et remontée ; assistance décroissante ; séance unique ; exercice retypé (10 séances en
base, **6 points**, aucun zéro inventé) ; deux séances le même jour civil (**deux points**). Deux
pièges posés exprès et désamorcés : un échauffement à 150 kg au milieu de séries à 80 kg (la ligne
lit **80 kg**) et l'égalité de record (le point vert tombe sur la **première** fois atteinte).

**Checkpoint à vérifier sur le téléphone :** ouvrir **Historique → l'icône de courbe**, choisir un
exercice que tu pratiques depuis des semaines. La courbe doit correspondre à ce que tu as
réellement fait, et le point vert doit être la séance où tu as posé ta meilleure marque — la
**première** fois que tu l'as atteinte, pas la dernière. Balaie la courbe du doigt : le grand chiffre
au-dessus doit suivre, et la liste dessous doit donner les mêmes valeurs. Puis change de métrique et
de période. Enfin, ouvre un exercice **assisté** (dips ou traction assistée) : la courbe descend
quand tu progresses, la phrase sous le graphique doit dire « Moins, c'est mieux », et le point vert
doit être **en bas**.

**Historique précédent :** 2026-07-28 (**jalon 08B — l'historique lit l'instantané**).
La contradiction ouverte par E2 est refermée : après un renommage, l'écran de détail d'une séance
passée et le document partagé depuis cet écran donnent désormais **le même nom**, parce qu'ils
appliquent la même règle.

Cette règle a un seul endroit : `resolveExerciseIdentity(row, exercise)` dans
`src/lib/exerciseSnapshot.ts` — l'instantané de la ligne, puis la bibliothèque d'aujourd'hui, puis
rien, **champ par champ**. Elle vivait dans `projectCoachExport`, qui l'appelle maintenant au lieu
de la porter. Champ par champ et non « l'instantané ou la bibliothèque, en bloc » : une ligne peut
porter un instantané partiel, et retomber sur la bibliothèque pour les quatre parce qu'un seul
manque perdrait les trois autres. La fonction ne rend aucune clé absente plutôt qu'une clé à
`undefined` : nommer le trou en français reste au appelant — `t('history.deletedExercise')` sur un
écran, `t('export.unknownExercise')` dans un document.

**Ce n'est pas qu'un titre.** `exerciseMeasurementType` décide **quels chiffres d'une série sont
lus** : `HistoryWorkoutDetail` s'en sert pour `performedParts` (les valeurs affichées) et pour
`measurementShape().weightRole` (ce qui compte comme tonnage). D'où les tests du jalon, écrits sur
des fixtures où l'instantané et la bibliothèque se contredisent **exprès** — un test où les deux
concordent ne peut pas dire lequel a été lu : une séance enregistrée en gainage dont l'exercice est
retypé en charge × reps doit continuer à se lire « 45 s », et une séance en charge × reps dont
l'exercice devient assisté doit continuer à compter ses 800 kg de tonnage. Trois des six tests
échouent sur l'ancien code, vérifié en le remettant.

**`historyDraft.ts` avait le même défaut**, et il était plus grave : l'éditeur d'archive prenait
son `measurementType` dans la bibliothèque, donc le retypage d'un exercice changeait **quels champs
une série passée offrait à la saisie**. Rebranché aussi. Rien ne change côté persistance :
`saveArchivedWorkout` re-dérivait déjà l'instantané, et seulement quand l'`exerciseId` de la ligne
change réellement. `HistoryExerciseEditor` n'avait rien à corriger — il affiche ce que le brouillon
lui donne.

**La fiche exercice n'a pas ce défaut** : elle décrit l'exercice _lui-même_, pas une séance passée,
donc son titre et son sous-titre doivent bien être ceux d'aujourd'hui ; et sa liste de séances
passe par `topSetLabel`, qui ne lit aucun `measurementType`.

**Un point laissé tel quel, à décider :** `WorkoutFinishScreen` lit encore
`line.exercise.measurementType` et `line.exercise?.name`. C'est le récapitulatif de la séance qu'on
vient de finir — la fenêtre pour que la bibliothèque ait changé entre-temps est de quelques
minutes, et l'écran n'est pas de l'historique. Hors périmètre de ce jalon, signalé plutôt que
glissé dedans.

**45 fichiers de tests, 641 tests** (+1 fichier, +12) ; `lint`, `typecheck`, `test:run` et `build`
sont verts. Le warning Vite historique sur le chunk principal reste le seul avertissement.

**Checkpoint à vérifier sur le téléphone :** renommer un exercice de la bibliothèque, puis ouvrir
une ancienne séance qui l'utilise dans l'Historique — le détail doit afficher **l'ancien nom**, et
`⋯` → **Copier le texte** doit donner exactement le même. Puis `⋯` → **Modifier** sur cette même
séance : l'en-tête de l'exercice porte l'ancien nom lui aussi, et les champs de saisie de ses
séries n'ont pas changé de nature. Enregistrer sans rien toucher ne doit rien réécrire.

**Historique précédent :** 2026-07-28 (**jalons E1 + E2 — la projection d'export et le Markdown**).
Une séance sort maintenant de l'app en trois gestes : `⋯` → **Partager** → la feuille système.
Une entrée **Copier le texte** est à côté, au même rang, parce que « coller dans une IA » est
l'usage nommé et que le presse-papiers est ce geste-là.

La chaîne est en quatre maillons dont un seul touche Dexie :
`listExportSources` (requêtes bornées, quatre périmètres) → `projectCoachExport` (pur, aucune
chaîne française) → `serializeMarkdown` (pur) → `shareText` (`src/platform/`). Chaque flèche est
testée seule ; la projection et le sérialiseur n'ont jamais besoin d'une base.

**C'est le premier consommateur de l'instantané 08A, et il le valide.** Vérifié en pilotant sur une
vraie séance à trois exercices : renommer « Good morning (barre) » en « RENOMMÉ APRÈS COUP » et
changer son muscle et son matériel ne bouge **rien** dans le document réexporté — ni le nom, ni
« Ischio-jambiers · Barre ». Le tonnage du document (**922,5 kg**) et son compte de séries de
travail (**6**) sont exactement ceux affichés par l'écran, parce que la projection appelle la même
`sessionTotals` : l'assistance des dips et la série d'échauffement sont hors tonnage des deux
côtés. Aucune erreur console, aucun débordement horizontal en 375 px, cibles de 56 px.

**Une contradiction créée par ce jalon, laissée ouverte volontairement** (refermée depuis, par le
jalon 08B ci-dessus) **:** au même moment, l'écran
`HistoryWorkoutDetail` de cette séance affiche, lui, **le nouveau nom** — il lit encore la
bibliothèque. L'export a raison, l'écran a tort, et c'est l'état que le jalon 08A annonçait
(« aucun consommateur n'est encore rebranché »). Le rebrancher touche aussi
`exerciseMeasurementType`, donc la façon dont ses chiffres sont _lus_ et pas seulement son titre :
ça mérite son jalon et ses tests.

**Quatre écarts argumentés avec le document de finition**, détaillés dans la spec :
`src/lib/export/` plutôt qu'un second arbre `src/domain/` (§7 de l'architecture définit déjà `lib/`
comme LA couche pure, et deux couches au contrat identique n'auraient aucune règle pour les
départager) ; pas de `definitions: MetricDefinition[]` (un export de séances n'a aucune métrique —
le seul chiffre agrégé, le tonnage, dit lui-même ce qu'il ne compte pas, en une phrase dans
l'en-tête) ; **partage de texte et non de fichier** (le `.md` en pièce jointe fait ouvrir quelque
chose au lecteur, le téléchargement fait chercher un fichier — le fichier arrivera avec le CSV, où
il _est_ le produit) ; et la politique de fuseau appliquée ici, à son premier consommateur, plutôt
qu'en E0.

**Deux petits déplacements au passage :** `formatDuration` quitte `HistoryWorkoutDetail` pour
`i18n/labels.ts`, parce que l'écran et le document doivent écrire la même séance de la même
longueur ; et `src/platform/` naît, nommément comme un ajout au §7 de l'architecture (un
adaptateur d'API navigateur n'est ni pur, ni une porte vers la base, ni un composant).

**Hors périmètre assumé :** pas d'écran `/settings/export` (il n'a de sens qu'avec un choix de
format, donc avec E3/E4), pas de CSV, pas de JSON, pas de téléchargement.

**44 fichiers de tests, 629 tests** (+5 fichiers, +86) ; `lint`, `typecheck`, `test:run` et `build`
sont verts. Le warning Vite historique sur le chunk principal reste le seul avertissement.

**Checkpoint à vérifier sur le téléphone :** ouvrir une vraie séance dans l'Historique, `⋯` →
**Partager**, et vérifier que la feuille Android s'ouvre et que le texte arrive **dans le corps**
du message (WhatsApp, Gmail, une note) et non en pièce jointe. Fermer la feuille sans choisir :
l'app ne doit **rien** afficher. Puis `⋯` → **Copier le texte**, coller dans une conversation avec
une IA et lire le document : les colonnes doivent correspondre à ce que chaque exercice se mesure
en (pas de colonne « Charge » sur un gainage, « Assistance » sur une machine assistée), les
décimales être françaises, et aucune série ne doit être résumée.

**Historique précédent :** 2026-07-28 (**jalon 08A — l'instantané des métadonnées d'exercice**).
Chaque `WorkoutExercise` fige désormais le nom, le type de mesure, le muscle principal et le
matériel de son exercice **au moment où il entre dans la séance**, et chaque `Workout` porte
`startedTimezoneOffsetMinutes`. Renommer un exercice, changer son type de mesure ou son muscle ne
réécrit plus le passé — c'est le prérequis des exports et des graphiques, posé pendant qu'il reste
peu de données à rattraper.

Les quatre points de création écrivent l'instantané : `startWorkoutFromRoutine` (qui réutilise le
`bulkGet` déjà fait pour le repos), `addWorkoutExercise`, l'import Hevy, et l'éditeur d'archive.
Règle unique : **l'instantané suit l'`exerciseId`**. Ligne créée ou exercice corrigé → métadonnées
d'aujourd'hui ; ligne inchangée → jamais retouchée, même si la bibliothèque bouge.

Deux écarts assumés avec le document de finition, documentés dans la spec :
`deleteExercise` est un **soft delete**, donc supprimer un exercice ne perd aucune métadonnée —
d'où l'abandon de `snapshotQuality` (ses trois valeurs étaient inatteignables), remplacé par des
champs simplement optionnels dont l'absence est le seul signal. Et `secondaryMuscles` /
`isUnilateral` ne sont pas copiés : aucun export ni graphique planifié ne les lit, et la
bibliothèque les conserve.

Migration `version(2).upgrade()` sans changement de `stores` — aucun des cinq champs n'est indexé.
Elle est **testée sur une vraie base version 1** (`src/data/dbMigration.test.ts`) : c'est le seul
endroit du dépôt où le chemin de migration s'exécute, `resetDb` ouvrant partout ailleurs
directement le schéma courant. **39 fichiers de tests, 543 tests** ; `lint`, `typecheck`,
`test:run` et `build` sont verts. Le warning Vite historique sur le chunk principal reste le seul
avertissement.

**Aucun consommateur n'est encore rebranché sur l'instantané** : les écrans continuent de lire la
bibliothèque. Les brancher est le travail des jalons d'export et de graphiques, qui savent ce dont
ils ont besoin.

**Checkpoint à vérifier sur le téléphone :** ouvrir l'app une fois (la migration s'exécute au
premier chargement), vérifier qu'aucune séance de l'historique n'a changé d'apparence, puis
renommer un exercice de la bibliothèque et rouvrir une ancienne séance qui l'utilise — elle doit
encore afficher **l'ancien nom** une fois les écrans rebranchés, et l'ancien nom est déjà en base
dès maintenant (visible via l'écran de debug ou un export ultérieur).

**Historique précédent :** 2026-07-27 (**poids des routines Hevy**). Chaque série d’une routine
importée reprend maintenant le poids exact de la série correspondante dans la séance
représentative (`targetWeight`). Une série sans poids reste sans cible et le RPE n’est pas copié.

**Historique précédent :** 2026-07-27 (**filtres du sélecteur d’exercices Hevy**). La fenêtre de
validation manuelle propose maintenant les filtres **Muscle** et **Matériel** de la bibliothèque.
Recherche, muscle, matériel et compatibilité du type de mesure se combinent ; fermer ou valider
une association remet les trois critères à zéro. Vérifié avec le vrai CSV : `Épaules + Poulie +
elevations` ne conserve que `Élévations latérales (poulie)`. À **402 × 698 px**, aucun débordement
horizontal et aucune erreur console sur le parcours testé. **35 fichiers de tests, 521 tests** ;
`lint`, `typecheck`, `test:run` et `build` sont verts. Le warning Vite historique sur le chunk
principal reste le seul avertissement.

**État fonctionnel repris :** tester sur le téléphone les filtres Muscle et Matériel pendant les
quatre associations manuelles Hevy, puis terminer les checkpoints d’import et de séance décrits
ci-dessous.

**Historique précédent :** 2026-07-27 (**import Hevy enrichi : détection fiable + routines**).
Les titres Hevy connus sont maintenant associés par alias canonique vers les `slug` stables du
catalogue ; le classement de secours comprend des synonymes français/anglais et donne un poids
fort au matériel. Les identités de mapping incluent désormais le matériel : barre, haltères et
Smith ne peuvent plus s’écraser. Les anciens mappings sans matériel restent relus en repli.
Sur le vrai export de validation, **20 exercices sur 24** reviennent directement cochés et justes ;
seuls `Rotation Externe Poulie`, `Hip Thrust (Dumbbell)`, `Tirage bas iso-latéral` et
`Développé Debout Poulie Centrée` restent à choisir.

Le même import crée maintenant un dossier `Import Hevy — JJ/MM/AAAA` et une routine par nom de
séance. Pour chaque nom, la référence est la plus complète des cinq séances les plus récentes,
puis la plus récente en cas d’égalité. Ordre, nombre et type des séries sont repris ; aucun
superset, poids cible ni RPE cible n’est inventé. Dossier, routines, séances, exercices et mappings
partagent la même transaction Dexie.

**Vérification réelle en 375 × 812 px :** 4 séances, 24 exercices et 90 séries détectés ;
4 routines `LOWER A`, `UPPER B`, `LOWER B`, `UPPER A` créées dans un seul dossier daté ; zéro
débordement horizontal et zéro erreur console. La seconde importation annonce **0 importée,
4 ignorées** et laisse un seul dossier avec 4 routines. **34 fichiers de tests, 519 tests** ;
`lint`, `typecheck`, `test:run` et `build` sont verts. Le warning Vite historique sur le chunk
principal reste le seul avertissement.

**État fonctionnel repris :** le code du Lot 07 est complet jusqu’au jalon 07C et ses retours
d’usage. Restent les checkpoints sur le téléphone réel : choisir le CSV depuis Android, vérifier
les quatre associations manuelles, importer, recharger hors ligne, ouvrir/corriger une séance et
une routine importées, puis confirmer la réimportation sans doublon. Terminer aussi la vérification
07B et la bascule « Tout replier / Tout déplier » au milieu d’une vraie séance.

**Historique précédent :** 2026-07-27 (**jalon 07C implémenté**). L’Historique importe hors ligne
`workout_data.csv` depuis Hevy : lecture RFC 4180, validation détaillée, aperçu, association
explicite et mémorisée des exercices, créations personnalisées sans quota, déduplication et
écriture Dexie atomique.

**Historique précédent :** 2026-07-27 (**refactorisation pré-07B terminée**). Les façades publiques
`workouts.ts` et `routines.ts` conservent exactement leurs APIs, tandis que leurs responsabilités
sont réparties dans huit modules internes de moins de 300 lignes. Aucun consommateur, test,
comportement ou périmètre de transaction Dexie n’a changé.

**Historique précédent :** 2026-07-25 (**Lot 6 officiellement terminé — checkpoint téléphone
RF-28 validé par l’utilisateur**). Sans plaque de 25 kg, une cible de 100 kg sur une barre de 20 kg
affiche bien **2 × 20 kg par côté** ; la désélection persiste après rechargement ; remettre 25 kg
restaure **25 + 15 kg par côté**. Les trois tranches du Lot 6 sont maintenant validées en usage
réel.

**Historique antérieur :** 2026-07-24 (**RF-28 — les plaques disponibles sont désormais
configurables, globales et persistées dans IndexedDB** — cf. la section dédiée ci-dessous).
La feuille « Plaques à charger » propose les dix dénominations canoniques dans une section
repliable neutre, sans comptage de paires ni plaque personnalisée. Toutes sont actives par défaut ;
un inventaire vide reste valide. Chaque bascule écrit immédiatement via le repository `settings`,
réveille `useLiveQuery` et recalcule tous les schémas ouverts. Vérifié dans la vraie app en
375 × 812 px : cibles de 48 px, aucun débordement, focus neutre, 100 kg sur une barre de 20 kg
devient **2 × 20 kg par côté** sans plaque de 25 kg, persiste après rechargement, puis redevient
**25 · 15 kg** après resélection. 24 fichiers, **332 tests** (+12), quatre portes vertes.
**L’implémentation du Lot 6 est terminée ; sa clôture officielle attend le checkpoint téléphone
RF-28 demandé à l’utilisateur.**

**Historique antérieur :** 2026-07-24 (**Reste du Lot 6, tâche 5 sur 5 : le poids de
barre se règle là où il sert, dans « Plaques à charger » (RF-31)** — cf. la section dédiée
ci-dessous. Valeur éphémère par exercice de la séance affichée : elle survit à la fermeture de la
feuille, mais pas à une navigation ou un rechargement. Barre et Smith réglables ; machine à plaques
fixe à 0 kg, sans faux réglage de barre. Aucun schéma, repository, réglage global ni stockage ajouté.
Vérifié en 375 × 812 px : 20 → 15 kg recalcule immédiatement 100 kg en 25 + 15 + 2,5 par côté ;
15 kg est encore lu après fermeture/réouverture ; aucun débordement, cibles de 48 px, focus neutre,
console vide. 320 tests (+7 pour RF-31), quatre portes vertes. **La tranche 3 est terminée et
validée en usage réel ; le checkpoint RF-31 est validé sur téléphone et en salle.** —
Antérieurement : **Reste du Lot 6, tâche 4 sur 5 : le calculateur
d’échauffement insère une rampe configurable avant les séries de travail (RF-29)** — cf. la section
dédiée ci-dessous. Rampe proposée 40 % × 10, 60 % × 5, 80 % × 3, arrondie vers le bas au pas de
2,5 kg, sans limite de nombre d’étapes. Écriture immédiate dans une seule transaction Dexie :
`setType: 'warmup'`, cibles seulement, rangs continus, rollback complet. Vérifié en 375 × 812 px :
aucun débordement, cibles de 48 px minimum, focus et actions neutres, ordre 40/60/80 puis 100 × 5
encore lu après rechargement. 313 tests (+29 pour RF-29), quatre portes vertes. — Antérieurement :
**Reste du Lot 6, tâche 3 sur 5 : le RPE facultatif se saisit
dans la feuille de série sans charger la grille (RF-30)** — cf. la section dédiée ci-dessous.
Échelle 6–10 par pas de 0,5, effacement explicite, écriture immédiate via `updateSetValues`, état de
divulgation purement éphémère. Vérifié en 375 px : dix cibles de 48 × 60,64 px minimum, sélection et
focus neutres, valeur puis effacement relus après rechargement depuis IndexedDB via Dexie. 284 tests
(+4 pour RF-30), quatre portes vertes. — Antérieurement : **Reste du Lot 6, tâche 2 sur 5 : le record battu se
voit en direct, sur la ligne qui l'a battu (RF-23)** — cf. la section dédiée ci-dessous. **Rien n'est écrit
en base** : `personalRecords` reste vide et la question est reposée à chaque rendu, ce qui rend
gratuite l'invalidation d'un record décoché, supprimé ou requalifié en échauffement. 279 tests (+20),
quatre portes vertes. — Antérieurement : **Le rang d'une série passe sous transaction** — le défaut
hors périmètre relevé à la tâche 1 est corrigé, et il touchait bien `addWorkoutExercise` aussi : cf.
la note en fin de section « Types de séries ». 259 tests, quatre portes vertes. — Antérieurement :
**Reste du Lot 6, tâche 1 sur 5 : les types de séries sont
modifiables en séance (RF-20)** — cf. la section dédiée ci-dessous. Le crochet était posé depuis le
Lot 5 (le bouton de rang existait « pour que le Lot 6 y accroche le type ») et les quatre phrases
dormaient dans `fr.ts` depuis le Lot 4, lues par personne. **Les marques sont des pictogrammes, pas
des mots** — décision de l'utilisateur : « ÉCH. » et « ÉCHEC » ne se séparent pas à bout de bras.
**Et une règle de repos manquante, trouvée en lisant** : la série _avant_ une dégressive ne doit pas
reposer. 256 tests, quatre portes vertes. **Un défaut hors périmètre trouvé en pilotant** : `addSet`
lit le rang puis écrit sans transaction → deux séries au même `order` (sorti en tâche à part,
**corrigé depuis**). — Antérieurement : **Quatre retours d'usage post-séance, corrigés et vérifiés en
pilotant le navigateur en 375 px.** (1) **Scroll impossible en recherchant un exo** : la vraie cause
n'était pas la liste mais le clavier — sur Android il se pose _par-dessus_ la vue sans en réduire la
hauteur (`resizes-visual` par défaut), donc le conteneur `100dvh` ne débordait pas et ses derniers
résultats restaient piégés derrière le clavier. Corrigé **à la racine** par `interactive-widget=resizes-content`
dans le viewport (`index.html`) — global, pas seulement le picker de routine. (2) **Filet de repos collé
au séparateur** : relevé de `bottom-0` à `bottom-[5px]` (`RestRail.tsx`), 5,8 px de gap mesurés. (3)
**« x série sur y » qui partait au scroll** : déplacé dans le slot `sub` de `Screen` (épinglé sous
l'en-tête, hors défilement, sur sa propre ligne — règle du Lot 4), vérifié en direct qu'il suit la
validation. (4) **Impossible de supprimer une série dans une routine** : chaque ligne enveloppée dans
`SwipeToDelete`, le composant exact de la séance en direct (`RoutineExerciseCard.tsx` + `deleteRoutineSet`).
Piège corrigé au passage : le wrapper faisait de chaque ligne un `:last-child`, ce qui cassait les
séparateurs via `last:border-b-0` — le filet est désormais piloté par une prop `last`. 252 tests, trois
portes vertes. **Leçon transverse** : un scroll « impossible » est souvent un problème de clavier/viewport,
pas de liste ; la corriger dans la liste aurait masqué le défaut sans le résoudre. — Antérieurement :
**Trois retours d'usage sur les plaques + le repos, corrigés
en pilotant depuis le téléphone** — cf. section « Trois retours … » sous le calculateur de plaques.
En résumé : (1) le picker de repos débordait sur « 3:00 » → grille 5 colonnes ; (2) le filet de repos
tombait sous « Ajouter une série » → remonté sur le séparateur header/corps ; (3) les plaques étaient
introuvables **et** figées sur une seule charge → icône visible sur la carte + **un schéma par charge
distincte**. 252 tests, quatre portes vertes. — Antérieurement : **Tâche 2 du reste-Lot-6 livrée : le
calculateur de plaques (RF-28)**, moteur pur en TDD (10 tests), schéma monochrome par choix de charte.
Et : **Checkpoints en salle validés par l'utilisateur : Lot 5 et minuteur du Lot 6 sont bons.** Tout ce qui était livré a été jugé sur une vraie séance et tient — les
trois paris du minuteur (filet sous la série, repos dans le statut de la card, rendu fluide) sont
confirmés. Le Lot 5 est **terminé** ; le Lot 6 reste ouvert sur son **reste** (plaques, échauffement,
RPE, record en direct, types de séries), seule la tranche minuteur y est close. Prochain travail :
Lot 5bis (schéma musculaire) ou la suite du Lot 6. — Antérieurement : **Les trois derniers réglages
de la feuille routine / mise en page sont faits** — #7 espacement 1ère carte : re-mesuré, déjà résolu par la suppression du bandeau
(24 px, comme partout, aucun code) ; #6 well du `RestPicker` centré (`items-center`, nombre à 10/10 px
du well) ; #4 phrase de repos ramenée de 2 lignes à 1. **Un défaut de plus trouvé en pilotant** — le
`ConfirmSheet` mangeait ses boutons : `safe-bottom` et `pb-5` posaient tous deux `padding-bottom` et
s'écrasaient ; nouvel utilitaire additif `sheet-bottom`, **28 px** de gap sous les boutons. Quatre
passes vertes, 242 tests. Il ne reste que le **checkpoint en salle** de la refonte.
— Rappel antérieur : survie au kill et mode avion **validés**, bouton d'ajout en séance vide corrigé
(`614e523`), refonte de l'écran de séance complète (briques 2+3), vitest ne ramasse plus les
worktrees d'agent (`b7dda06`).)


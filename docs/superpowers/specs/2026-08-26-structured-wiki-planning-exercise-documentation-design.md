# Wiki structuré, documentation des exercices et espace Planifier

**Date :** 2026-08-26
**Statut :** conception validée en conversation, en attente de relecture écrite
**Branche :** `claude/task-7-complete-06d6ff`

## 1. Contexte et décision produit

La recherche lexicale retrouve 27 questions répondables sur 31, mais elle renvoie aussi un résultat
pour 28 questions sur 28 auxquelles le corpus ne peut pas répondre. Le refus n'est pas calibrable
sur ses scores. Le cross-encoder testé le 2026-08-26 est assez rapide après chargement
(`4 343 ms/question` sur 16 passages avec WebGPU), mais il dégrade le rappel de 27/31 à 22/31 et
la précision@1 de 17/31 à 5/31. Il ne doit donc ni équiper l'application ni débloquer CAL.

Le produit cesse de demander à une recherche de décider ce que le corpus veut dire. Il devient un
wiki rédigé, structuré et navigable. Les liens entre la littérature et les objets FitTrack sont
déclarés et validés ; ils ne sont jamais déduits d'un nom, d'une proximité lexicale ou d'un score de
modèle.

Phrase produit :

> La documentation explique. Les routines composent une séance. Les programmes organisent les
> semaines. Aucun de ces trois rôles ne se confond.

## 2. Matière réellement disponible

Trois sources distinctes alimentent le wiki :

| Source | Matière | État |
|---|---:|---|
| Anatomie, biomécanique et sélection d'exercices | 308 affirmations | extraction mixte, passages sources disponibles |
| Clinique et tolérance | 100 affirmations | extraction mixte, passages sources disponibles |
| Programmation de l'hypertrophie | 19 sections, 102 fiches | `pending_human_review` |

Les 408 affirmations anatomiques et cliniques se replient sur **209 passages de prose distincts**
après fusion des doublons stricts et des contextes imbriqués. Les 102 fiches de programmation sont
un artefact séparé (`f1-programming.json`) et ne doivent pas être comptées dans ces 209 passages.

Le wiki existant, ses routes, son index de questions et les liens de phases de programme sont une
base à faire évoluer, pas un prototype à jeter.

## 3. Objectifs

1. Transformer les passages et fiches existants en articles français complets et lisibles.
2. Garantir la traçabilité de chaque paragraphe factuel vers la matière source.
3. Donner à chaque exercice une documentation utile sans rapprochement automatique par son nom.
4. Supporter les exercices personnels grâce aux muscles déclarés et à une famille de mouvement
   facultative.
5. Expliquer la relation entre muscles lorsqu'une famille de mouvement documentée la justifie.
6. Rassembler Routines, Programmes et Guide dans un onglet **Planifier** sans créer un second objet
   programme.
7. Reprendre dans la bibliothèque de routines les deux protections déjà éprouvées : dossiers
   repliables et réordonnancement verrouillé par défaut.
8. Rester entièrement local-first, hors ligne et sans modèle embarqué.

## 4. Hors périmètre

- Génération ou rédaction à l'exécution.
- Assistant conversationnel, coach documentaire ou réponse synthétique à une question libre.
- Cross-encoder, embeddings distants ou recalibrage de CAL.
- Création automatique d'une routine ou d'un programme depuis un article.
- Inférence d'une famille de mouvement depuis le nom d'un exercice personnel.
- Affirmation biomécanique dérivée uniquement de `primaryMuscle` et `secondaryMuscles`.
- Ouverture de CAL ou TEST.
- Ajout de nouvelles sources scientifiques dans cette tranche ; la matière existante est d'abord
  organisée et relue.

## 5. Vocabulaire produit verrouillé

| Terme | Sens unique |
|---|---|
| **Routine** | Séance réutilisable : exercices et séries prévues. |
| **Programme** | Cycle multi-semaines existant, composé de routines et de semaines intentionnelles. |
| **Guide** | Partie programmation du wiki, en lecture seule. |
| **Documentation d'exercice** | Projection d'articles wiki applicables à un exercice. |
| **Famille de mouvement** | Catégorie contrôlée expliquant une coopération musculaire : poussée horizontale, extension du coude, squat, etc. |

Le Guide n'écrit jamais un `Program`. Seul l'éditeur existant `/programs/new` crée un programme.
Un article peut proposer l'action « Mettre en pratique », mais cette action ne fait que naviguer
vers le véritable éditeur.

## 6. Architecture : deux modules profonds

### 6.1 Module éditorial du wiki

Le module éditorial charge des articles versionnés avec l'application et cache leur format de
stockage. Son interface fournit :

- la navigation par familles et articles ;
- la lecture d'un article par identifiant stable ;
- les articles portant un muscle, une famille de mouvement ou un exercice précis ;
- une recherche textuelle limitée à un ensemble d'articles déjà sélectionné ;
- un état de revue explicite.

Les articles Markdown sous `fittrack-kb-contract/editorial/articles/` sont l'artefact canonique.
Un script validé génère `src/features/knowledge/wiki-articles.json` pour l'application. Le JSON
généré n'est jamais édité à la main ; le build vérifie qu'il correspond aux Markdown sources.

### 6.2 Module de résolution documentaire

Le module de résolution reçoit seulement les quatre identités documentaires d'un exercice et
retourne une projection prête à afficher. Son interface est :

```ts
type DocumentationExercise = Pick<
  Exercise,
  'primaryMuscle' | 'secondaryMuscles' | 'movementPattern' | 'slug'
>;

getDocumentationForExercise(exercise: DocumentationExercise): ExerciseDocumentation
```

Toute la complexité de priorité, de déduplication, de tri, de niveau de revue et de limites vit
derrière cette interface. L'écran d'exercice ne connaît ni identifiant d'article, ni `claimId`, ni
table de correspondance.

La résolution utilise uniquement des identités contrôlées :

- `primaryMuscle` ;
- `secondaryMuscles` ;
- `movementPattern`, facultatif ;
- `slug`, uniquement pour les exercices du catalogue.

Le nom visible et l'UUID local ne participent jamais au branchement.

## 7. Modèle éditorial

### 7.1 Portée d'un article

Chaque article possède :

- `articleId`, stable et unique ;
- un titre et un résumé ;
- une famille de navigation ;
- zéro ou plusieurs `muscleGroups` ;
- zéro ou plusieurs `movementPatterns` ;
- zéro ou plusieurs `exerciseSlugs` ;
- un état de revue ;
- des sections ordonnées.

Une section éditoriale contient des blocs. Chaque bloc factuel référence au moins un `claimId` ou
une fiche de programmation source. Un bloc purement éditorial peut introduire, relier ou résumer la
structure, mais ne porte aucune nouvelle affirmation scientifique.

### 7.2 Familles principales

Le sommaire présente cinq familles :

1. **Comprendre les muscles** — anatomie, fonctions, portions et rôle général.
2. **Comprendre les mouvements** — coopération musculaire dans les familles de mouvement.
3. **Choisir et comparer les exercices** — variantes, stabilité, amplitude, longueur musculaire et
   limites des comparaisons.
4. **Programmer l'entraînement** — volume, fréquence, charge, répétitions, RIR/RPE, repos, tempo,
   progression, périodisation, deload, splits, fatigue et spécialisation.
5. **Tolérance et clinique** — charge articulaire, symptômes, adaptation, contexte et limites de
   généralisation.

Les chapitres de méthode et de lecture des preuves restent accessibles depuis le sommaire. Ils ne
sont pas artificiellement rattachés à tous les exercices.

### 7.3 Structure d'une fiche musculaire

Une fiche musculaire suit un ordre commun :

1. résumé ;
2. anatomie et fonctions ;
3. rôle dans les principales familles de mouvement ;
4. interaction avec les synergistes et stabilisateurs ;
5. conséquences documentées pour le choix des exercices ;
6. ce que les données ne permettent pas d'affirmer ;
7. sources.

Cette structure commune facilite la lecture sans forcer toutes les fiches à remplir artificiellement
une section que le corpus ne traite pas.

### 7.4 Couverture de la matière

Le rapport part des **266 contextes distincts avant fusion**. Chacun reçoit exactement un état :

- `integrated` : utilisé dans un article ;
- `appendix` : conservé dans un article méthodologique ou une annexe ;
- `merged` : doublon strict ou contexte absorbé par un passage plus large.

Les 57 contextes imbriqués marqués `merged` sont absorbés par un contexte plus large, ce qui laisse
les 209 passages lisibles actuels. Leurs `claimIds` restent attachés au passage conservé : les 408
affirmations demeurent toutes traçables.

Chaque fiche de programmation reçoit un état analogue, sans être fusionnée avec les passages E5.
Un rapport de couverture bloque la livraison si un contexte ou une fiche n'a aucun état, si une
référence pointe vers une source inexistante ou si une fusion perd ses ancrages.

### 7.5 État de revue

Les 102 fiches de programmation conservent `pending_human_review` et le bandeau français existant
jusqu'à leur revue humaine. Le remaniement éditorial ne vaut pas validation scientifique.

Les métadonnées E5 mesurées peu fiables ne sont pas promues en niveau de preuve. Les articles
s'appuient sur le texte source et ses références. Une donnée non relue reste signalée ; aucune
transformation de format ne peut retirer ce statut.

## 8. Documentation d'un exercice

### 8.1 Ordre de projection

Le résolveur retourne, dans cet ordre :

1. l'article du muscle principal ;
2. l'article de la famille de mouvement, s'il existe ;
3. une synthèse des muscles secondaires et de leur rôle documenté dans cette famille ;
4. les articles propres au `slug` du catalogue, s'il en existe ;
5. les limites documentaires et liens vers les fiches complètes des muscles secondaires.

Les articles identiques sont dédupliqués. La priorité est une règle du module, pas de l'écran.

### 8.2 Exercices du catalogue

Le catalogue `exercises.json` reçoit une `movementPattern` contrôlée lorsque le mouvement peut être
classé honnêtement. Le seed la reporte dans l'exercice sans modifier l'identité stable existante.

Une correspondance propre à un exercice utilise son `slug`, jamais son nom français ni son UUID.
Un changement de libellé ne casse donc aucun lien.

### 8.3 Exercices personnels

La création et l'édition proposent une famille de mouvement facultative. Les choix viennent d'un
vocabulaire contrôlé et sont expliqués en français. L'utilisateur peut laisser le champ vide.

- Sans famille : l'onglet montre les muscles déclarés, mais n'invente aucune relation mécanique.
- Avec famille : l'article relationnel correspondant s'ajoute.
- Un renommage ultérieur ne change pas la documentation.

Les exercices personnels existants restent valides sans migration obligatoire : le nouveau champ
est optionnel. Aucune documentation ne disparaît, car `primaryMuscle` et `secondaryMuscles` existent
déjà.

### 8.4 États limites

- Si aucun article n'existe encore pour un muscle, l'écran le dit et propose le sommaire ; il ne
  lance pas une recherche globale pour combler le trou.
- Si une famille de mouvement n'a aucun article, le résolveur l'ignore et expose la lacune au rapport
  de validation.
- Un `slug` inconnu dans une portée éditoriale fait échouer la validation de contenu.
- Une famille absente sur un exercice personnel n'est pas une erreur.

## 9. Interface de la fiche exercice

La fiche d'exercice propose deux vues clairement nommées :

- **Suivi** — contenu actuel : muscles, records, historique, réglages et charge ;
- **Documentation** — projection du résolveur.

La vue Documentation commence par un sommaire court des sections applicables. Elle affiche ensuite
le muscle principal, la relation de mouvement, les particularités de l'exercice et les limites. Les
muscles secondaires mènent à leurs fiches complètes sans recopier tous leurs articles dans la page.

Un champ de recherche facultatif filtre uniquement les articles déjà rattachés à cet exercice. Il
ne décide jamais quel article charger. Une absence de résultat signifie simplement que le texte
actuel ne contient pas les mots saisis.

Toutes les cibles tactiles restent à 48 px minimum, tous les textes vivent dans `src/i18n/fr.ts`, et
la lecture reste utilisable hors ligne.

## 10. Onglet Planifier

### 10.1 Information architecture

Le libellé de navigation basse **Routines** devient **Planifier**. Ce point d'entrée rassemble trois
espaces sans fusionner leurs données :

- **Routines** — bibliothèque et création de séances réutilisables ;
- **Programmes** — liste, création et suivi de la fonctionnalité `Program` existante ;
- **Guide** — famille « Programmer l'entraînement » du wiki.

Les routes existantes `/routines`, `/programs` et `/knowledge/programmation` restent canoniques pour
éviter une migration de liens. Un contrôle de navigation partagé rend l'espace actif et la barre
basse considère ces trois routes comme appartenant à Planifier. Toucher l'onglet Planifier ouvre
Routines par défaut.

Le Guide reste en lecture seule. Son action « Mettre en pratique » navigue vers `/programs/new`.
Elle ne préremplit rien dans cette version et ne contourne jamais les repositories Program.

### 10.2 Dossiers repliables

Dans Planifier > Routines :

- chaque en-tête de dossier est un bouton avec `aria-expanded` ;
- il affiche le nom et le nombre de routines ;
- toucher l'en-tête replie ou déplie son contenu ;
- une commande permet « Tout replier » ou « Tout déplier » ;
- le dossier racine suit la même règle lorsqu'il est affiché ;
- le repli ne déclenche aucune écriture repository.

L'état de repli est éphémère et conservé pendant la session de l'application. Un redémarrage complet
revient à l'état déplié. Dexie ne stocke rien.

### 10.3 Verrou de réordonnancement

La bibliothèque reçoit son propre verrou, indépendant de ceux de l'éditeur de routine et de la
séance en cours :

- fermé au lancement ;
- état conservé pendant la session ;
- poignées entièrement masquées quand il est fermé ;
- `ReorderableList` fonctionnellement désactivée, y compris au clavier ;
- édition, ouverture, duplication, démarrage et menus restent disponibles.

Le bouton réutilise `OrderLockButton` et ses icônes. Deux clés dédiées annoncent exactement
« Déverrouiller l'ordre des routines » et « Verrouiller l'ordre des routines ». Le cadenas contrôle
uniquement la bibliothèque Routines, pas Programmes ni Guide.

### 10.4 Interaction entre repli et réordonnancement

Déverrouiller l'ordre :

1. mémorise les dossiers repliés ;
2. déplie tous les dossiers ;
3. désactive temporairement leurs boutons de repli ;
4. montre toutes les poignées et autorise les déplacements entre dossiers.

Reverrouiller :

1. termine ou annule tout geste actif selon le contrat existant de `ReorderableList` ;
2. masque les poignées ;
3. restaure l'état de repli mémorisé.

Cette règle garantit que la projection de réordonnancement contient toujours toutes les routines.
Aucun déplacement ne peut être calculé sur une liste dont une partie est invisible.

## 11. Données et persistance

- Les articles et leurs portées sont des données statiques versionnées dans le bundle.
- Les champs existants `primaryMuscle`, `secondaryMuscles` et `slug` restent la source d'identité.
- `movementPattern` est optionnel et non indexé ; aucune nouvelle table Dexie n'est requise.
- Les préférences de repli et de verrou sont éphémères, donc dans un store Zustand non persisté ou
  un état de module équivalent.
- Tous les accès aux exercices et programmes continuent de passer par les repositories existants.
- Le wiki n'accède jamais directement à `db`.

## 12. Recherche

La recherche cesse d'être une seam de routage. Deux usages subsistent :

1. filtre textuel dans un article ou une projection déjà déterminée ;
2. recherche globale du wiki comme raccourci facultatif, sans promesse de réponse ni refus calibré.

Le parcours principal passe par le sommaire, les catégories, les muscles, les mouvements et les
liens contextuels. Aucun résultat de recherche n'est requis pour accéder à une donnée depuis un
exercice ou un programme.

Le reranker et CAL restent hors produit. Le banc peut être conservé comme trace expérimentale, mais
ne participe ni au build ni au runtime.

## 13. Erreurs et dégradation gracieuse

La majorité des erreurs deviennent des erreurs de build, pas des surprises dans l'application :

- identifiant d'article dupliqué ;
- `claimId`, fiche de programmation, muscle, famille ou `slug` inconnu ;
- paragraphe factuel sans source ;
- passage ou fiche sans état de couverture ;
- lien vers une route wiki inexistante ;
- portée d'exercice ne correspondant à aucun article.

Au runtime :

- une documentation partielle s'affiche avec sa limite ;
- une famille absente sur un exercice personnel est acceptée ;
- un article statique introuvable ne provoque pas d'écran blanc ; la section fautive est omise et
  un état lisible renvoie vers le sommaire ;
- une recherche textuelle sans résultat conserve le contenu et permet d'effacer le filtre ;
- une erreur de lecture d'un exercice conserve les états actuels de chargement et d'introuvable.

## 14. Stratégie de tests

### 14.1 Contenu et validation

- Tous les `articleId` sont uniques.
- Toutes les portées utilisent des valeurs contrôlées existantes.
- Chaque bloc factuel possède une source résolue.
- Les 266 contextes anatomiques/cliniques avant fusion et les 102 fiches de programmation ont un
  état de couverture ; la projection finale contient 209 passages lisibles.
- Une fusion conserve tous les `claimIds` absorbés.
- Le statut `pending_human_review` de la programmation survit à toutes les projections.
- Un mutant supprimant une source ou inventant un `slug` fait échouer le validateur.

### 14.2 Résolveur documentaire

Tests purs, écrits avant l'implémentation :

- exercice du catalogue : muscle principal + mouvement + article spécifique ;
- exercice personnel sans mouvement : muscles uniquement ;
- exercice personnel avec mouvement : ajout de la relation ;
- secondaire sans rôle documenté : lien vers la fiche, aucune explication inventée ;
- déduplication et ordre stable ;
- renommage sans effet sur la projection ;
- portée cassée rejetée par le validateur.

### 14.3 Planifier et routines

Tests d'interface et d'intégration :

- l'onglet Planifier rend Routines, Programmes et Guide sans créer de nouveau type de données ;
- « Mettre en pratique » ouvre le véritable éditeur Program ;
- les dossiers s'ouvrent et se ferment, avec compteur et état accessible ;
- « Tout replier » et « Tout déplier » couvrent racine et dossiers ;
- le verrou est fermé au premier rendu ;
- aucune poignée ni action clavier de déplacement n'existe quand il est fermé ;
- déverrouiller déplie tout et bloque le repli ;
- déplacer entre dossiers persiste l'ordre et le `folderId` complets ;
- reverrouiller restaure les dossiers précédemment repliés ;
- les trois verrous bibliothèque, éditeur et séance restent indépendants.

### 14.4 Vérifications globales

Après chaque tranche :

```text
npm run lint
npm run typecheck
npm run test:run
npm run build
git diff --check
```

Les tests de contenu du paquet KB continuent de tourner avec leur propre commande `node --test` ou
le script de validation existant ; ils ne sont pas aspirés dans Vitest.

## 15. Découpage de livraison

Le chantier est trop large pour un seul commit, mais forme un seul design cohérent. L'ordre est :

1. consigner le verdict négatif du reranker et fermer T8/T9 ;
2. définir le format éditorial, le validateur et le rapport de couverture ;
3. rédiger et intégrer les articles à partir de la matière anatomique et clinique ;
4. intégrer la programmation en conservant son statut non relu, puis mener sa revue humaine ;
5. introduire le vocabulaire de familles de mouvement et documenter le catalogue ;
6. livrer le résolveur pur et la vue Documentation des exercices ;
7. livrer Planifier et le partage Routines / Programmes / Guide ;
8. livrer le repli des dossiers et le verrou de la bibliothèque ;
9. faire les checkpoints téléphone et mettre à jour `PROGRESS.md`.

Chaque étape doit laisser l'application buildable et le wiki utilisable. La rédaction peut avancer
article par article derrière le validateur ; aucune étape ne dépend d'un modèle téléchargé.

## 16. Checkpoints téléphone

1. Ouvrir un exercice du catalogue : Suivi et Documentation se distinguent ; la documentation
   charge hors ligne et explique le mouvement sans bloc hors sujet.
2. Créer un exercice personnel sans famille : les muscles sont documentés, la relation spécifique
   est annoncée absente. Ajouter ensuite une famille et vérifier que l'article relationnel apparaît.
3. Ouvrir Planifier : passer de Routines à Programmes puis Guide sans ambiguïté de vocabulaire.
4. Depuis le Guide, « Mettre en pratique » ouvre l'éditeur Program existant.
5. Replier plusieurs dossiers, vérifier que le contenu disparaît sans perdre l'ordre.
6. Déverrouiller : tous les dossiers se déplient, déplacer une routine entre dossiers, reverrouiller
   et vérifier le retour de l'état replié.
7. Force-close puis relancer : cadenas fermé et dossiers dépliés, données de routines intactes.
8. Couper le réseau et répéter les parcours Documentation et Guide.

## 17. Critères d'acceptation

Le design est réalisé lorsque :

- toute la matière existante possède un état de couverture contrôlé ;
- les articles sont lisibles sans consulter les artefacts d'extraction ;
- chaque affirmation factuelle affichée est traçable ;
- un exercice personnel obtient une documentation sans correspondance de nom ;
- aucune relation musculaire spécifique n'est inventée sans famille documentée ;
- le véritable objet `Program` reste l'unique cycle multi-semaines ;
- l'onglet Planifier rend Routines, Programmes et Guide accessibles ;
- la bibliothèque est repliable et protégée du drag-and-drop accidentel ;
- tout fonctionne hors ligne et les validations, tests, typecheck, lint et build passent ;
- les checkpoints téléphone sont validés et consignés dans `PROGRESS.md`.

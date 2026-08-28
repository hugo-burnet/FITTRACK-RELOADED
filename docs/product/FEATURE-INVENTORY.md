# FitTrack — Inventaire maître des fonctionnalités et du tutoriel

> **Statut :** document produit de référence, vérifié sur FitTrack `v2.2.0` après la fusion
> mouvement (`f439f16`) le 28 août 2026.
>
> **But :** dire ce que FitTrack sait réellement faire, où cela vit, ce qui reste incomplet et
> ce que le tutoriel doit apprendre avant de refaire les voix.

## 1. Comment lire ce document

Cet inventaire croise quatre sources :

1. l'application réellement parcourue au format mobile `390 × 844` ;
2. les routes, composants, repositories et tests présents dans `src/` ;
3. le cahier des charges `audit-hevy-cahier-des-charges.md`, la roadmap et `PROGRESS.md` ;
4. le script vocal et les fichiers présents dans `public/voice/`.

Le parcours navigateur a couvert les **36 routes** de l'application, les feuilles d'action
accessibles depuis ces routes, le premier lancement et la visite guidée. Une seconde origine
locale isolée a servi à exercer une séance active jusqu'au bilan sans modifier les données de
l'origine habituelle. Les états qui exigent des données indisponibles, une importation réelle ou
une action destructive ont été confirmés dans les composants, les textes et les tests ; ils sont
signalés comme tels dans le répertoire écran par écran.

### États fonctionnels

| État | Sens |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| **Livré** | Le parcours existe dans l'interface et son comportement est soutenu par le code/tests. |
| **Partiel** | Une partie utile existe, mais une exigence ou une porte d'entrée manque. |
| **Dette** | Livré, avec une limite mesurée ou explicitement assumée. |
| **Différé** | Prévu par la roadmap, hors V1 et non commencé dans le produit. |
| **Absent** | Demandé par le cahier des charges ou nécessaire au parcours, sans réalisation prévue assez précise. |
| **Hors périmètre** | Écart volontaire avec Hevy, notamment toute fonction sociale. |

### États du tutoriel

| État | Sens |
| ----------- | ---------------------------------------------------------------------- |
| **Action** | Le tutoriel accompagne un geste et vérifie son résultat. |
| **Survolé** | La voix cite la zone ou la fonctionnalité sans apprendre à l'utiliser. |
| **Absent** | Ni la visite complète ni l'aide contextuelle ne l'expliquent. |

L'orientation vocale reste un sommaire des grandes zones. Elle est désormais complétée par
**douze missions P1 opératoires**, toujours compréhensibles en Silence et validées par le résultat
réel des gestes plutôt que par un simple clic.

### Priorités

- **P0** : perte de données, blocage complet ou sécurité.
- **P1** : empêche une première séance réussie ou une récupération sûre.
- **P2** : amélioration importante, contournement possible.
- **P3** : finition et confort.

## 2. Résumé exécutif

FitTrack possède une V1 solide : catalogue, routines, programmation par blocs, séance local-first,
repos, cadence, RPE, records, historique éditable, import Hevy, analyses, sauvegardes, PWA et APK.
Les fondations respectent les règles majeures du projet : aucune limite artificielle, aucune
dépendance réseau pour s'entraîner et écriture immédiate des séries.

La première tranche d'activation est livrée : choisir un chemin, préparer une routine, démarrer,
saisir et valider une série, comprendre le repos, terminer la séance puis exporter et inspecter
une restauration. La progression vit sous `fittrack:tutorial:v2`, reprend à l'étape exacte après
fermeture et traverse la sauvegarde complète.

Une séance active atteint l'état ancien à **douze heures révolues** (`âge >= 12 h`). Elle reste
intacte tant que l'utilisateur n'a pas explicitement choisi Reprendre, Terminer ou confirmé
Abandonner ; aucune minuterie ne la supprime. Ce chemin est couvert par les tests et la revue, mais
son checkpoint sur un vrai téléphone reste à faire. Les outils avancés — cadence, RPE, plaques,
échauffement, historique et analyses — restent volontairement dans les P2/P3.

### Santé technique de l'interface

| Dimension | Score | Constat principal |
| ------------- | --------: | ---------------------------------------------------------------------------------------------------------------------------- |
| Accessibilité | 3/4 | Sémantique, focus visible et contrastes solides ; quelques cibles textuelles secondaires restent à vérifier. |
| Performance | 3/4 | Routes lourdes différées et bundle initial réduit ; certaines lectures d'historique restent non bornées. |
| Responsive | 3/4 | Aucun débordement racine à 390 px et commandes principales ≥ 44 px ; texte à 200 % et toutes les feuilles restent à auditer. |
| Thèmes | 4/4 | Tokens cohérents, sombre/clair, contrastes documentés et mouvement réduit. |
| Anti-patterns | 3/4 | Identité volontaire et cohérente ; densité de cartes et micro-labels capitalisés à surveiller. |
| **Total** | **16/20** | **Bon — corriger l'activation et les lacunes ciblées, pas refaire l'interface.** |

Le détecteur automatique n'a remonté que trois faux positifs dans les commentaires de
`src/platform/chartImage.ts` : les mentions de `<img>` décrivent la rasterisation, elles ne sont
pas des images cassées.

### Anomalie de texte détectée pendant le parcours

La ligne **Réglages → Effort et fatigue** affirme encore que la cadence s'allonge automatiquement
avec la fatigue. Le comportement actuel fait l'inverse : la cadence est choisie manuellement par
exercice et ne varie pas seule (`src/lib/tempo.ts`). Le tutoriel ne doit pas reprendre cette phrase
avant correction de `settings.effortTempoHint` dans `src/i18n/fr.ts`.

## 3. Répertoire écran par écran

Ce répertoire répond à la question pratique du tutoriel : **sur quel écran le geste existe-t-il,
et que produit-il réellement ?**

- **B** : écran ou état parcouru dans le navigateur.
- **S** : comportement secondaire confirmé dans le source et les tests.
- **B+S** : écran parcouru, avec ses états rares ou destructifs confirmés sans les exécuter.

Les feuilles, confirmations et menus sont listés avec leur écran d'origine : ils ne possèdent pas
de route, mais ce sont bien des surfaces que le tutoriel peut devoir expliquer.

### 3.1 Coquille commune et états transverses

| Surface                        | Vérification | Ce que l'utilisateur voit et peut faire                                                                                                            | Couverture actuelle |
| ------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Écran d'ouverture               | S            | Anime le chargement de la barre, puis affiche « FitTrack », « Progressive Overload » et « Production was the gym ». Il tient 2,5 s en parallèle de l'initialisation, mais disparaît immédiatement si une séance non périmée est déjà en cours.                 | Sans objet          |
| Échec du catalogue au démarrage | S            | L'app s'ouvre quand même, préserve les données personnelles et affiche une bannière explicite que l'utilisateur peut masquer.                                                                                                                                  | Absent              |
| Navigation basse               | B            | Ouvre Accueil, Planifier, Historique, Progression et Exercices. L'onglet actif est indiqué.                                                        | Survolé             |
| En-tête d'écran                | B            | Retour ou titre, action principale éventuelle et bouton `?`.                                                                                       | Survolé             |
| Transitions de navigation       | S            | Une ouverture avance vers la droite et un retour revient vers la gauche ; l'ancien écran sort pendant que le nouveau entre. La navigation basse et la barre de reprise restent stables. Sans API compatible, la navigation reste instantanée et fonctionnelle. | Sans objet          |
| Mouvement réduit du système     | S            | Retire déplacement, échelle et flou, tout en conservant les changements utiles d'opacité et de couleur ; l'ouverture et les transitions gardent donc un retour d'état sans mouvement spatial.                                                                  | Sans objet          |
| Aide `?`                       | B+S          | Propose les missions pertinentes pour la page, rejoue l'explication courte de la zone ou relance la visite complète.                               | Action              |
| Barre de séance active         | B            | Reste visible sur les autres écrans et ramène à la séance. À partir de 12 h, ouvre Reprendre, Terminer ou Abandonner sans suppression automatique. | Action              |
| Bannière de mise à jour        | S            | Signale une nouvelle version ; Recharger l'applique, Plus tard la reporte au prochain démarrage à froid.                                           | Absent              |
| Installation et hors-ligne     | B+S          | L'application peut être installée en PWA ; son cache permet un démarrage sans réseau.                                                              | Absent              |
| Erreur globale / route absente | S            | Affiche une sortie contrôlée au lieu d'un écran blanc ; les fiches supprimées ont un état « n'existe plus ».                                       | Absent              |

### 3.2 Accueil et planification

| Route / surface                             | Vérification | Fonctionnalités et effets                                                                                                                                                                                                                                                                                                                                                                                   | Tutoriel                                      |
| ------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `/` — Accueil                               | B+S          | Propose la routine la plus pertinente dans le dossier choisi et la démarre ; permet de changer ce dossier ou d'aller créer une routine. Montre le bloc actif, la carte musculaire des 12 dernières semaines, les raccourcis Rythme/Volume/Muscles, l'objectif hebdomadaire, le poids du jour et les séances récentes. Toucher un muscle ouvre les exercices associés ; toucher une séance ouvre son détail. | Survolé                                       |
| Feuille « Choisir un dossier »              | B            | Définit le dossier utilisé pour les suggestions de l'accueil ; l'état vide renvoie vers la création d'une routine.                                                                                                                                                                                                                                                                                          | Absent                                        |
| Feuille « Poids du jour »                   | B            | Enregistre le poids en kg. Cette valeur sert au tonnage des exercices au poids du corps selon leur facteur configuré.                                                                                                                                                                                                                                                                                       | Absent                                        |
| `/routines` — Routines                      | B+S          | Liste sans quota, groupée en dossiers. Crée une routine vide, part d'un modèle ou crée un dossier. Replie/déplie les groupes, verrouille/déverrouille puis réordonne dossiers et routines. Ouvre, duplique ou supprime une routine.                                                                                                                                                                         | Action sur la première routine ; reste absent |
| Feuilles de dossier                         | B+S          | Crée ou renomme un dossier. Le supprimer remonte ses routines à la racine au lieu de les supprimer.                                                                                                                                                                                                                                                                                                         | Absent                                        |
| Feuille des modèles                         | B            | Crée localement Poussée, Tirage, Jambes, Full-body, 5×5 A ou 5×5 B.                                                                                                                                                                                                                                                                                                                                         | Action                                        |
| `/routines/:id` — Éditeur de routine        | B+S          | Enregistre immédiatement nom, sous-titre et dossier. Ajoute, retire et réordonne les exercices ; ajoute/supprime les séries ; définit type, cible de charge, répétitions, durée, distance ou assistance selon la mesure. Règle repos, notes et superset, applique une cible à toutes les séries et démarre la séance.                                                                                       | Action sur ajout, cible, repos et démarrage   |
| Feuille « Cible de série »                  | B            | Choisit Normal ou Échauffement, saisit les objectifs compatibles avec la mesure, peut appliquer la cible à toutes les séries ou supprimer la série.                                                                                                                                                                                                                                                         | Action partielle                              |
| Feuille d'options d'exercice                | B            | Règle le repos par pas ou préréglage, saisit les notes, groupe avec l'exercice précédent en superset ou retire l'exercice.                                                                                                                                                                                                                                                                                  | Action sur le repos seulement                 |
| `/routines/:id/add` — Ajouter des exercices | B            | Recherche et filtre le catalogue par muscle et matériel, sélectionne plusieurs exercices, puis les ajoute ensemble à la routine.                                                                                                                                                                                                                                                                            | Action partielle                              |
| `/programs` — Programmes                    | B+S          | Liste les blocs Brouillon, Actif et Terminé, ouvre leur suivi et lance la création d'un bloc.                                                                                                                                                                                                                                                                                                               | Survolé                                       |
| `/programs/new` — Nouveau bloc, Cadre       | B            | Étape 1/3 : nom, lundi de départ et durée de 4 à 12 semaines.                                                                                                                                                                                                                                                                                                                                               | Absent                                        |
| `/programs/new` — Nouveau bloc, Split       | S            | Étape 2/3 : associe chaque séance récurrente à un jour et une routine, autorise plusieurs séances le même jour, ajoute/retire des créneaux et peut créer une routine vide sans quitter l'assistant.                                                                                                                                                                                                         | Absent                                        |
| `/programs/new` — Nouveau bloc, Semaines    | S            | Étape 3/3 : choisit pour chaque semaine une phase et un niveau. Applique une recette Hypertrophie, Force ou Reprise, puis retouche chaque semaine. Le niveau agit par crans de charge ; la Décharge retire aussi une série de travail et vise le bas de fourchette. Le brouillon est ensuite enregistré puis activé depuis sa fiche.                                                                        | Absent                                        |
| `/programs/:id` — Suivi du bloc             | S            | Montre l'avancement, l'intention de la semaine, les sept jours (repos compris), les séances terminées/du jour/manquées/à venir et les semaines suivantes. Démarre la routine prévue, signale une collision avec une séance active et répare une routine supprimée.                                                                                                                                          | Survolé                                       |
| Feuille « Actions du bloc »                 | S            | Modifie à partir d'une semaine future sans réécrire le passé, décale le calendrier par semaines entières, termine le bloc sans effacer les séances, ou supprime seulement le bloc.                                                                                                                                                                                                                          | Absent                                        |
| `/programs/:id/edit` — Modifier le bloc     | S            | Édite un brouillon ou choisit la semaine d'entrée en vigueur d'une révision future ; les semaines déjà scellées restent en lecture seule.                                                                                                                                                                                                                                                                   | Absent                                        |

### 3.3 Séance en direct

| Route / surface                    | Vérification | Fonctionnalités et effets                                                                                                                                                                                                                                                               | Tutoriel                                        |
| ---------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `/workout` — Séance active         | B+S          | Affiche temps réel, progression, exercices et séries. Renomme la séance et enregistre ses notes. Saisit les six familles de mesure, recopie une performance précédente, valide/dévalide chaque série avec écriture immédiate, ajoute/supprime/réordonne/replie les exercices et séries. | Action sur saisie et validation ; avancé absent |
| Ligne de série                     | B+S          | Gère Normal, Échauffement, Dégressive et Échec ; saisit ou efface le RPE ; supprime avec annulation. Une série d'échauffement est exclue du volume et des records, une dégressive enchaîne sans repos.                                                                                  | RPE survolé ; types absents                     |
| Bande d'effort                     | B            | Apparaît brièvement après une série de travail, propose un RPE de 6 à 10 par pas de 0,5 et peut prolonger le repos de 15, 30 ou 45 s. L'ignorer ne modifie rien.                                                                                                                        | Survolé                                         |
| Repos                              | B+S          | Démarre automatiquement selon l'exercice, reste fondé sur l'horloge réelle, se règle pendant le décompte, annonce 3–2–1 et peut notifier en arrière-plan sur Android. Supersets, échauffements et dégressives adaptent ou évitent le repos.                                             | Action                                          |
| Cadence de répétitions             | B+S          | Définit manuellement de 1 à 10 s par répétition, par pas de 0,25 s ou préréglage, estime la durée, lance/arrête le décompte et peut enregistrer la cadence par défaut. Elle n'est plus allongée automatiquement par une fatigue supposée.                                               | Survolé                                         |
| Maintien chronométré               | S            | Pour les mesures en durée, lance une préparation puis chronomètre le maintien ; la validation écrit le temps tenu en retirant 2 s de relâchement.                                                                                                                                       | Absent                                          |
| Exercice unilatéral                | S            | Une ligne représente les deux côtés. Le premier côté ne déclenche ni repos, ni RPE, ni record ; l'app annonce le changement, attend 10 s puis traite le second côté avec le même `setId`.                                                                                               | Absent                                          |
| Calculateur d'échauffement         | B+S          | Part de la charge cible, propose 40 %×10, 60 %×5 et 80 %×3, permet de modifier/ajouter/retirer les paliers puis insère les séries arrondies.                                                                                                                                            | Absent                                          |
| Calculateur de plaques             | B            | Règle barre/charge de base et inventaire de disques, calcule la combinaison exacte par côté pour barre ou machine, et affiche le reste impossible.                                                                                                                                      | Absent                                          |
| Notes et options d'exercice        | B            | Enregistre les notes, ajoute une série, ouvre cadence/maintien, échauffement ou plaques, et retire l'exercice.                                                                                                                                                                          | Absent                                          |
| Décharge ponctuelle                | S            | Applique 80 % aux charges éligibles restantes, avec arrondi et conservation de la valeur d'origine ; ne s'applique pas deux fois.                                                                                                                                                       | Absent                                          |
| Coach et records en direct         | B+S          | Signale un record, explique les hausses/baisses/plateaux déterministes et peut appliquer la prochaine charge aux séries compatibles ; une recommandation peut être ignorée.                                                                                                             | Survolé                                         |
| `/workout/add` — Ajouter en séance | B            | Recherche/filtre le catalogue, exclut les exercices déjà présents, sélectionne plusieurs lignes et les ajoute à la séance active.                                                                                                                                                       | Absent                                          |
| `/workout/finish` — Bilan          | B+S          | Montre durée, séries de travail, tonnage ou répétitions, muscles, signaux du coach et récapitulatif par exercice. Enregistre les notes, abandonne avec confirmation comptée ou sauvegarde définitivement la séance, ses records et ses recommandations.                                 | Action                                          |
| État sans séance                   | B            | Explique que la séance n'existe plus et évite d'écrire dans une session absente.                                                                                                                                                                                                        | Absent                                          |

### 3.4 Historique et import

| Route / surface                       | Vérification | Fonctionnalités et effets                                                                                                                                                                                                                                                                       | Tutoriel |
| ------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `/history` — Historique               | B+S          | Affiche régularité, série de semaines et objectif. Bascule Journal/Calendrier, navigue par mois, choisit une date ou filtre par exercice, puis ouvre une séance. Donne accès aux analyses et à l'import Hevy.                                                                                   | Survolé  |
| Feuille « Objectif hebdomadaire »     | B            | Modifie le nombre de séances visé chaque semaine.                                                                                                                                                                                                                                               | Absent   |
| `/history/:workoutId` — Détail        | B            | Affiche date, horaire, durée, séries de travail, répétitions, tonnage, carte musculaire, exercices, séries, types et RPE.                                                                                                                                                                       | Survolé  |
| Feuille d'actions du détail           | B+S          | Partage par la feuille système, copie un texte lisible, ouvre la modification ou supprime après confirmation. La suppression recalcule la projection des records sans toucher aux autres séances.                                                                                               | Absent   |
| `/history/:workoutId/edit` — Modifier | B+S          | Corrige nom, notes, date, heure, durée, ordre, exercices, séries, mesures, RPE et types ; ajoute ou retire des éléments puis enregistre l'ensemble.                                                                                                                                             | Absent   |
| `/history/import` — Choix du fichier  | B+S          | Accepte `workout_data.csv` de Hevy ou une sauvegarde CSV FitTrack, entièrement sur l'appareil. Valide en détail structure, dates, nombres, types de séries et mesures. Sur une base non vide, recommande de vider pour éviter les routines en double, avec une option explicite pour continuer. | Absent   |
| Import — association                  | S            | Compte séances/exercices/séries, présente les détections sûres, les associations mémorisées et les conflits. Chaque nom Hevy doit être confirmé vers un exercice FitTrack ou un exercice personnel à créer, avec exemples réels du fichier.                                                     | Absent   |
| Import — revue et exécution           | S            | Annonce séances importées/ignorées, exercices personnels, associations nouvelles/réutilisées et routines créées. Ignore les doublons, range les anciennes routines dans un dossier d'archives, puis affiche un bilan ; un échec n'écrit rien.                                                   | Absent   |

### 3.5 Progression et analyses

| Route                                                          | Vérification | Fonctionnalités et effets                                                                                                                                                                          | Tutoriel |
| -------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `/analytics` — Progression                                     | B            | Donne accès à Records, Séances par semaine, Volume, Muscles, Rapport mensuel et à la progression des exercices ayant un historique.                                                                | Survolé  |
| `/analytics/records` — Records                                 | B+S          | Filtre par exercice et par record : 1RM estimé, charge maximale, durée maximale, meilleure série ou tonnage de séance. Chaque jalon montre valeur, date et évolution, puis ouvre sa séance source. | Survolé  |
| `/analytics/weekly` — Séances/semaine                          | B            | Choisit 4, 12, 26, 52 semaines ou tout ; montre graphique, moyenne, objectif, semaines réussies et détail d'une semaine ; exporte une image.                                                       | Survolé  |
| `/analytics/volume` — Volume                                   | B            | Choisit période et métrique Tonnage/Durée ; montre total, moyenne et détail hebdomadaire ; explique les exclusions du tonnage ; exporte une image.                                                 | Survolé  |
| `/analytics/muscles` — Muscles                                 | B            | Compte les séries de travail par muscle principal, y compris les zéros et « Autres », sur la période choisie ; montre total et moyenne.                                                            | Survolé  |
| `/analytics/months` — Rapport mensuel                          | B            | Change de mois et compare au mois précédent : séances, jours, séries, répétitions, tonnage et durée. Classe aussi les exercices qui ont produit le plus de tonnage.                                | Absent   |
| `/analytics/exercises/:exerciseId` — Progression d'un exercice | B+S          | Choisit période et métrique : charge max, 1RM estimé, meilleure série, tonnage, répétitions ou séries de travail. Affiche graphique, record, séances sources et export image.                      | Survolé  |

### 3.6 Exercices

| Route / surface                         | Vérification | Fonctionnalités et effets                                                                                                                                                                                   | Tutoriel |
| --------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `/exercises` — Catalogue                | B            | Recherche sans tenir compte des accents, combine filtres Muscle/Matériel, groupe alphabétiquement les 178 exercices observés et marque les personnels. Propose d'en créer un si aucun résultat ne convient. | Survolé  |
| `/exercises/new` — Nouvel exercice      | B            | Saisit nom, muscle principal, muscles secondaires, matériel, famille de mesure, famille de mouvement et caractère unilatéral, puis crée l'exercice personnel sans quota.                                    | Survolé  |
| `/exercises/:id` — Fiche, Suivi         | B+S          | Affiche muscles, records, progression et historique. Enregistre immédiatement notes, repos par défaut et incrément de charge. Configure disques/barre ou fraction de poids du corps selon l'exercice.       | Survolé  |
| `/exercises/:id` — Fiche, Documentation | B            | Relie automatiquement l'exercice aux fiches du corpus par mouvement, muscles et sujets cliniques pertinents. Les liens ouvrent la base de preuves, sans ajouter d'instruction de mouvement inventée.        | Absent   |
| `/exercises/:id/edit` — Modifier        | B            | Modifie les mêmes champs pour un exercice personnel. La fiche officielle reste verrouillée. Supprimer un exercice personnel le retire de la bibliothèque mais préserve les instantanés des séances passées. | Absent   |
| Feuille « Type de mesure »              | B            | Choisit Poids+répétitions, Répétitions, Poids+durée, Durée, Distance+durée ou Assistance+répétitions ; ce choix détermine les champs de routine, séance et historique.                                      | Absent   |

### 3.7 Réglages, données et informations

| Route / surface                          | Vérification | Fonctionnalités et effets                                                                                                                                                                                                                                                     | Tutoriel                          |
| ---------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `/settings` — Application                | B+S          | Lance l'installation PWA ou explique le geste navigateur, indique si la copie hors-ligne est prête et ouvre la base de preuves.                                                                                                                                               | Absent                            |
| `/settings` — Apparence et annonces      | B            | Choisit thème sombre/clair, Silence/Sons/Sons+voix, vérifie le pack vocal et active/désactive l'effet de haut-parleur. Les annonces se mélangent à la musique sans la baisser.                                                                                                | Action sur le mode ; reste absent |
| `/settings` — Entraînement               | B            | Choisit Epley, Brzycki ou Lombardi pour le 1RM, avec exemple 100 kg×5. Active la demande de RPE et l'allongement associé du repos.                                                                                                                                            | Absent                            |
| `/settings` — Notifications              | B+S          | Active séparément fin de repos, record silencieux et rappels. Quand les rappels sont actifs : choisit jours et heure, affiche le prochain rappel. Fonctionne nativement sur Android ; le navigateur ne sonne que si l'app est ouverte.                                        | Absent                            |
| `/settings` — Données                    | B+S          | Partage tout l'historique en texte, sauvegarde l'historique en CSV réimportable et ouvre le dépannage.                                                                                                                                                                        | Absent                            |
| `/settings` — Sauvegarde complète        | B+S          | Exporte en JSON séances, routines, programmes, records, réglages, préférences et progression du tuto. La restauration lit et compte le fichier, refuse les formats/versions invalides, puis demande confirmation avant de remplacer toute la base ; un échec ne modifie rien. | Action                            |
| `/settings/debug` — Dépannage et données | B+S          | Vérifie/recalcule les records, prévisualise puis met à jour les instantanés historiques, affiche quota et compte de chaque table, liste les exercices récemment modifiés, restaure le catalogue officiel et peut réinitialiser la base après confirmation.                    | Absent                            |
| `/settings/about` — À propos et crédits  | B            | Attribue la carte musculaire dérivée de Z-Anatomy, ses auteurs et sa licence CC BY-SA 4.0, avec lien de licence.                                                                                                                                                              | Absent                            |

### 3.8 Base de preuves hors ligne

| Route                                                          | Vérification | Fonctionnalités et effets                                                                                                                                                                                                                                                                 | Tutoriel |
| -------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `/knowledge` — Base de preuves                                 | B            | Parcourt muscles, mouvements, comparaisons, programmation, clinique et méthode. Recherche les mots dans le corpus embarqué et retourne des passages sourcés, jamais une réponse synthétisée ni un diagnostic. Ouvre aussi le parcours d'apprentissage, les questions et la programmation. | Absent   |
| `/knowledge/apprendre` — Apprendre à programmer                | B+S          | Parcours ordonné de 14 étapes, de la progression aux limites de preuve ; chaque étape ouvre sa fiche et peut être marquée lue, avec progression persistée.                                                                                                                                | Absent   |
| `/knowledge/questions` — Questions                             | B+S          | Sépare les questions couvertes, qui pointent vers les passages pertinents, et les questions non couvertes, dont l'absence et la raison sont affichées au lieu d'inventer une réponse.                                                                                                     | Absent   |
| `/knowledge/programmation` — Programmation                     | B            | Liste 19 fiches extraites des tableaux du corpus, avec avertissement « non relu ». Ouvre le parcours d'apprentissage et permet de mettre en pratique via la création d'un bloc.                                                                                                           | Absent   |
| `/knowledge/programmation/:articleId` — Fiche de programmation | B+S          | Affiche affirmation, confiance, population, type de preuve, application pratique, contradictions, limites, ce qu'on ne peut pas conclure et références.                                                                                                                                   | Absent   |
| `/knowledge/a/:articleId` — Article thématique                 | B+S          | Même lecture structurée pour muscle, mouvement, comparaison, clinique ou méthode ; signale clairement une fiche absente.                                                                                                                                                                  | Absent   |
| `/knowledge/s/:sectionId` — Passage source                     | B+S          | Affiche le titre de section, les passages verbatim embarqués et leurs identifiants de claim/fragment pour revenir à la source exacte ; signale une section absente.                                                                                                                       | Absent   |

## 4. Inventaire fonctionnel

### 4.1 Fondations, stockage et plateforme

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
| ------ | --------------------------------------------------------------------------------------- | ----- | ---------- | --------------------------------------------------------------------------------- |
| FND-01 | Fonctionnement intégral hors ligne, sans compte | Livré | Survolé | L'annoncer dès le premier écran. |
| FND-02 | Persistance IndexedDB via Dexie et repositories | Livré | Absent | Expliquer simplement où vivent les données. |
| FND-03 | Écriture en base à chaque série validée | Livré | Action | La mission de validation attend la réussite de l'écriture durable. |
| FND-04 | Reprise d'une séance après kill ou interruption | Livré | Action | Une séance ancienne propose trois choix explicites, sans suppression automatique. |
| FND-05 | Routines, historique et exercices personnalisés sans quota | Livré | Absent | Le signaler dans l'aide des bibliothèques. |
| FND-06 | Navigation hash compatible GitHub Pages et Capacitor | Livré | Sans objet | Maintenir `createHashRouter`. |
| FND-07 | PWA installable et mise à jour contrôlée | Livré | Absent | Ajouter une aide d'installation et de mise à jour. |
| FND-08 | APK Android et ponts natifs | Livré | Absent | Expliquer les capacités réservées à Android. |
| FND-09 | Thèmes sombre/clair et préférence mémorisée | Livré | Survolé | Ajouter une micro-aide depuis Réglages. |
| FND-10 | Mouvement réduit : pas de déplacement/échelle/flou, retours d'opacité/couleur conservés | Livré | Sans objet | Valider le rendu sur un téléphone avec l'option système activée.                  |
| FND-11 | Gestion d'erreur globale et routes lourdes différées | Livré | Sans objet | Conserver le découpage ; surveiller les écrans différés sur téléphone. |
| FND-12 | Écran d'ouverture parallèle au seed, sauté pendant une séance active                    | Livré | Sans objet | Vérifier le rideau, sa sortie et le démarrage immédiat entre deux séries.         |
| FND-13 | Transitions avant/arrière avec sortie de l'ancien écran et fallback sans API            | Livré | Sans objet | Vérifier direction, fluidité et surfaces stables sur téléphone.                   |

**Traçabilité :** `src/data/db.ts`, `src/data/repositories/*`, `src/router.tsx`,
`src/app/Boot.tsx`, `src/app/navigation.ts`, `src/app/lazyRoute.tsx`, `src/platform/*`,
`src/index.css`, Lots 0–2, 9 et 10, RF-25, RF-51, RF-69.

### 4.2 Accueil

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
| ------ | ----------------------------------------------------- | ------- | -------- | -------------------------------------------------------------------------------------------- |
| HOM-01 | Proposition de la routine la plus pertinente à lancer | Livré | Survolé | Expliquer pourquoi cette routine est proposée. |
| HOM-02 | État du bloc actif et accès aux programmes | Livré | Survolé | Montrer la différence routine/bloc par une mission. |
| HOM-03 | Carte musculaire des douze dernières semaines | Livré | Survolé | Apprendre le geste « toucher un muscle ». |
| HOM-04 | Raccourcis Rythme, Volume et Muscles | Livré | Absent | Ajouter un chapitre « lire sa progression ». |
| HOM-05 | Objectif hebdomadaire et accès à son réglage | Livré | Absent | Expliquer objectif, semaine et absence de sanction. |
| HOM-06 | Poids du jour saisi depuis l'accueil | Livré | Absent | Contextualiser son effet sur le tonnage au poids du corps. |
| HOM-07 | Trois dernières séances | Livré | Absent | Montrer l'accès au détail et à la correction. |
| HOM-08 | Barre persistante de reprise de séance | Livré | Action | À partir de 12 h incluses, elle ouvre la récupération Reprendre/Terminer/Abandonner. |
| HOM-09 | Démarrage d'une séance vide depuis l'interface | Partiel | Absent | Le repository le permet, mais la porte UI a été retirée en v0.8.2 ; décider si elle revient. |

**Traçabilité :** `src/features/home/*`, `src/data/repositories/home.ts`, `src/lib/home.ts`,
`src/app/ActiveWorkoutBar.tsx`, RF-17, RF-34, RF-37, RF-42, RF-43.

### 4.3 Routines et dossiers

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
| ------ | ---------------------------------------------------------- | ----- | -------- | -------------------------------------------------------------------------------------- |
| ROU-01 | Liste illimitée de routines | Livré | Survolé | Distinguer bibliothèque et séance en cours. |
| ROU-02 | Création d'une routine | Livré | Action | La mission attend la routine réellement persistée. |
| ROU-03 | Dossiers, création, renommage et déplacement | Livré | Absent | Ajouter une aide secondaire, non bloquante. |
| ROU-04 | Nom, sous-titre et dossier enregistrés au fil de la frappe | Livré | Absent | Expliquer qu'il n'y a pas de bouton Enregistrer. |
| ROU-05 | Ajout et retrait d'exercices | Livré | Action | La P1 fait ajouter un exercice réel ; retrait différé à l'aide avancée. |
| ROU-06 | Ajout, suppression et édition de séries prévues | Livré | Action | La P1 fait ajouter une deuxième série puis définir sa cible. |
| ROU-07 | Repos, notes et paramètres par exercice | Livré | Action | La P1 fait enregistrer un repos positif ; notes et paramètres restent en aide avancée. |
| ROU-08 | Réorganisation tactile avec verrou | Livré | Absent | Expliquer verrou, poignée et persistance. |
| ROU-09 | Duplication et suppression | Livré | Absent | Ajouter à l'aide à la demande. |
| ROU-10 | Supersets et regroupements | Livré | Absent | Ajouter une micro-mission avancée. |
| ROU-11 | Modèles prêts à l'emploi semés localement | Livré | Action | L'activation propose modèle existant ou création, sans imposer l'un des deux. |
| ROU-12 | Démarrage d'une séance depuis une routine | Livré | Action | La mission avance après création durable de la séance active. |

**Traçabilité :** `src/features/routines/*`, `src/data/repositories/routines*.ts`,
`src/data/seed/routineTemplates.ts`, RF-11 à RF-15.

### 4.4 Programmes et blocs multi-semaines

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
| ------ | ------------------------------------------------------------------------------- | ------- | -------- | ----------------------------------------------------------------------------- |
| PRG-01 | Liste des blocs brouillons, actifs et terminés | Livré | Survolé | Expliquer les trois états. |
| PRG-02 | Assistant de création en trois étapes | Livré | Absent | Mission guidée : cadre, split, semaines. |
| PRG-03 | Départ un lundi et durée de 4 à 12 semaines | Livré | Absent | Expliquer la règle calendaire avant validation. |
| PRG-04 | Affectation des routines aux jours de la semaine | Livré | Absent | Montrer jours d'entraînement et repos. |
| PRG-05 | Niveaux de charge par semaine | Livré | Absent | Ajouter une lecture pédagogique des pourcentages. |
| PRG-06 | Recettes Hypertrophie, Force et Reprise | Livré | Absent | Présenter comme point de départ modifiable. |
| PRG-07 | Activation d'un bloc | Livré | Absent | Faire comprendre ce qui devient scellé. |
| PRG-08 | Démarrage de la séance prévue depuis le bloc | Livré | Survolé | Ajouter une mission depuis l'accueil. |
| PRG-09 | Révision future sans réécrire les semaines passées | Livré | Absent | Aide avancée sur la semaine d'effet. |
| PRG-10 | Décharge planifiée : deux crans en moins, une série en moins, bas de fourchette | Livré   | Absent   | La distinguer de la décharge ponctuelle à 80 % de la séance en direct.        |
| PRG-11 | Réparation d'une routine de split supprimée | Livré | Absent | Ajouter un guide de récupération. |
| PRG-12 | Modification du nom/durée d'un bloc actif | Partiel | Absent | La date se décale, mais nom et durée restent figés ; décider le comportement. |

**Traçabilité :** `src/features/programs/*`, `src/data/repositories/program*.ts`,
`src/lib/programs/*`, Lot 17, recommandation M3 sur la périodisation.

### 4.5 Séance en direct

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
| ------ | ----------------------------------------------------- | ------- | -------- | --------------------------------------------------------------------------------- |
| WRK-01 | Démarrage depuis une routine ou un bloc | Livré | Action | La P1 vérifie le démarrage depuis une routine ; les blocs restent en P2. |
| WRK-02 | Chronomètre dérivé de l'heure réelle | Livré | Absent | Expliquer qu'un kill ne remet pas le temps à zéro. |
| WRK-03 | Saisie selon six familles de mesure | Livré | Action | La mission attend une série enregistrable selon son type de mesure réel. |
| WRK-04 | Valeur précédente tapable pour préremplir | Livré | Action | La première série explique la valeur précédente et la saisie attendue. |
| WRK-05 | Validation d'une série en un geste | Livré | Action | La mission n'avance qu'après validation persistée. |
| WRK-06 | Ajout/suppression de séries en cours de séance | Livré | Absent | Ajouter une aide contextuelle. |
| WRK-07 | Ajout/suppression d'exercices en cours de séance | Livré | Absent | Ajouter une aide contextuelle. |
| WRK-08 | Réorganisation et repli des exercices | Livré | Absent | Expliquer verrou et Tout replier/déplier. |
| WRK-09 | Types normale, échauffement, dégressive, échec | Livré | Absent | Relier type, volume, repos et records. |
| WRK-10 | Notes de séance et notes d'exercice | Livré | Absent | Montrer où elles réapparaissent. |
| WRK-11 | Minuteur automatique de repos | Livré | Action | La mission montre le repos réel et attend sa fin. |
| WRK-12 | Notification Android de fin de repos écran éteint | Livré | Absent | Expliquer la différence navigateur/Android. |
| WRK-13 | Calculateur de plaques configurable | Livré | Absent | Mission avancée depuis une série chargée. |
| WRK-14 | Calculateur et insertion des séries d'échauffement | Livré | Absent | Mission avancée orientée sécurité. |
| WRK-15 | RPE facultatif et bande d'effort | Livré | Survolé | Expliquer l'effet sur le repos sans inciter à surévaluer. |
| WRK-16 | Cadenceur de répétitions avec préparation | Livré | Survolé | Montrer lancement, pose du téléphone et arrêt. |
| WRK-17 | RPE appliqué au repos ; tempo choisi manuellement     | Livré   | Absent   | Corriger le texte obsolète des Réglages qui promet encore un tempo automatique.   |
| WRK-18 | Détection et annonce d'un record en direct | Livré | Survolé | Montrer ce qui est enregistré et notifié. |
| WRK-19 | Décharge ponctuelle des séries restantes | Livré | Absent | Aide avancée avec aperçu avant application. |
| WRK-20 | Écran de fin, bilan et notes | Livré | Action | La mission ouvre le bilan puis attend l'enregistrement durable. |
| WRK-21 | Coach déterministe et proposition de prochaine charge | Partiel | Survolé | Hausse, baisse et plateau existent ; règles RPE lourdes/décharge restent hors V1. |
| WRK-22 | Abandon explicite sans confusion avec Terminer | Livré | Action | L'abandon d'une vieille séance exige une confirmation comptée. |
| WRK-23 | Chronomètre de maintien avec préparation              | Livré   | Absent   | Mission avancée pour les exercices mesurés en durée.                              |
| WRK-24 | Cycle unilatéral à deux côtés                         | Livré   | Absent   | Expliquer le changement de côté et l'unique validation finale.                    |

**Traçabilité :** `src/features/workout/*`, `src/data/repositories/workout*.ts`,
`src/stores/restTimer.ts`, `src/stores/repPacer.ts`, Lots 5, 6, 18 et 21, RF-17 à RF-31,
RF-48.

### 4.6 Historique, calendrier et import Hevy

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
| ------ | --------------------------------------------------- | ----- | ---------- | -------------------------------------------------------------------------------- |
| HIS-01 | Journal chronologique sans limite artificielle | Livré | Survolé | Montrer le passage Journal/Calendrier/Exercice. |
| HIS-02 | Régularité et objectif hebdomadaire | Livré | Absent | Expliquer le calcul par semaine. |
| HIS-03 | Calendrier mensuel | Livré | Survolé | Ajouter une micro-mission de recherche par date. |
| HIS-04 | Filtre par exercice | Livré | Absent | Ajouter une aide depuis l'onglet Exercice. |
| HIS-05 | Détail complet d'une séance | Livré | Survolé | Montrer totaux, temps, muscles et séries. |
| HIS-06 | Carte musculaire cliquable | Livré | Absent | Réutiliser la mission de l'accueil. |
| HIS-07 | Modification rétroactive | Livré | Absent | P1 : expliquer recalcul des records et Enregistrer. |
| HIS-08 | Suppression confirmée | Livré | Absent | Aide à la demande, sans l'inclure dans la visite initiale. |
| HIS-09 | Partage et copie d'une séance lisible | Livré | Absent | Montrer le menu d'actions. |
| HIS-10 | Import Hevy hors ligne avec association d'exercices | Livré | Absent | Créer un tutoriel dédié multi-étapes. |
| HIS-11 | Import idempotent et création de routines | Livré | Absent | Expliquer doublons ignorés et dossier créé. |
| HIS-12 | Lecture de tout l'historique avant pagination | Dette | Sans objet | Surveiller les benchmarks et ajouter un index si le seuil téléphone est dépassé. |

**Traçabilité :** `src/features/history/*`, `src/data/repositories/history*.ts`,
`src/data/repositories/hevyImport.ts`, `src/lib/hevy*.ts`, Lot 7, RF-32 à RF-36, RF-67.

### 4.7 Progression, records et rapports

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
| ------ | ------------------------------------------ | ------- | -------- | -------------------------------------------------------------- |
| ANA-01 | Vue d'ensemble des analyses | Livré | Survolé | Expliquer quelle question répond chaque écran. |
| ANA-02 | Historique et filtres de records | Livré | Survolé | Ajouter une mission de lecture d'un jalon. |
| ANA-03 | Séances par semaine et objectif | Livré | Survolé | Expliquer période, moyenne et semaine cible. |
| ANA-04 | Tonnage et durée par semaine | Livré | Survolé | Expliquer ce qui entre dans le tonnage. |
| ANA-05 | Séries par muscle | Livré | Survolé | Expliquer muscle principal et hors répartition. |
| ANA-06 | Rapport mensuel civil comparé au précédent | Livré | Absent | Ajouter une aide sur écarts et mois vides. |
| ANA-07 | Progression détaillée par exercice | Livré | Survolé | Montrer le choix de métrique. |
| ANA-08 | Export PNG des graphiques | Livré | Absent | Ajouter une aide courte sur le partage. |
| ANA-09 | Formule de 1RM configurable | Livré | Absent | Relier Réglages et lectures de records. |
| ANA-10 | Rétrospective annuelle | Différé | Absent | RF-45 : cadrer une V2 plutôt que l'ajouter au tutoriel actuel. |
| ANA-11 | Fatigue/charge aiguë-chronique | Différé | Absent | Recommandation de l'audit Hevy ; nécessite un design prudent. |

**Traçabilité :** `src/features/analytics/*`, `src/features/records/*`,
`src/lib/analytics/*`, `src/data/repositories/personalRecords*.ts`, Lots 12 et 13, RF-10,
RF-23, RF-41 à RF-46.

### 4.8 Bibliothèque d'exercices

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
| ------ | ------------------------------------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------- |
| EXE-01 | Catalogue local de 178 exercices observés | Livré | Survolé | Expliquer catalogue officiel vs perso. |
| EXE-02 | Recherche instantanée insensible aux accents | Livré | Survolé | Faire chercher un exercice dans une mission. |
| EXE-03 | Filtres Muscle et Matériel combinables | Livré | Absent | Ajouter à la mission de recherche. |
| EXE-04 | Création illimitée d'exercices personnalisés | Livré | Survolé | Mission dédiée avec type de mesure et unilatéral. |
| EXE-05 | Édition/suppression d'un exercice personnalisé | Livré | Absent | Aide à la demande. |
| EXE-06 | Fiche muscles principal/secondaires | Livré | Survolé | Faire le lien avec la carte musculaire. |
| EXE-07 | Records et historique par exercice | Livré | Survolé | Montrer les deux portes vers Progression. |
| EXE-08 | Notes et repos par défaut | Livré | Absent | Expliquer l'enregistrement immédiat. |
| EXE-09 | Incrément et chargement en disques par exercice | Livré | Absent | Ajouter une aide avancée. |
| EXE-10 | Type de mesure et facteur de poids du corps | Livré | Survolé | Expliquer leur effet en séance et dans le tonnage. |
| EXE-11 | Documentation reliée au corpus par mouvement et muscles | Livré  | Absent   | Ajouter une aide de lecture sans transformer les extraits en consigne.                      |
| EXE-12 | Image ou démonstration du mouvement                     | Absent | Absent   | La documentation couvre les preuves, pas l'exécution ; décider une source locale/licenciée. |

**Traçabilité :** `src/features/exercises/*`, `src/data/seed/*`,
`src/data/repositories/exercises*.ts`, `src/ui/muscleMap/*`, Lots 2, 3 et 5bis, RF-06 à
RF-10.

### 4.9 Base de preuves hors ligne

| ID     | Fonctionnalité                                                                       | État  | Tutoriel | Suite recommandée                                                     |
| ------ | ------------------------------------------------------------------------------------ | ----- | -------- | --------------------------------------------------------------------- |
| KNW-01 | Corpus de preuves intégralement embarqué et consultable hors ligne                   | Livré | Absent   | Présenter clairement la différence entre retrouver et répondre.       |
| KNW-02 | Navigation par muscles, mouvements, comparaisons, programmation, clinique et méthode | Livré | Absent   | Ajouter une orientation propre à la base.                             |
| KNW-03 | Recherche lexicale de passages sans synthèse générative                              | Livré | Absent   | Montrer une recherche et la lecture de sa source.                     |
| KNW-04 | Fiches structurées : preuve, pratique, contradictions, limites et non-conclusions    | Livré | Absent   | Apprendre à lire le niveau de confiance et les limites.               |
| KNW-05 | Questions couvertes et non couvertes déclarées explicitement                         | Livré | Absent   | Faire de l'absence de réponse un comportement tutoriel explicite.     |
| KNW-06 | Parcours « Apprendre à programmer » en 14 étapes persistées                          | Livré | Absent   | Mission facultative après la première séance.                         |
| KNW-07 | Guide de programmation en 19 fiches extraites et signalées non relues                | Livré | Absent   | Ne jamais masquer l'avertissement éditorial.                          |
| KNW-08 | Passages source avec identifiants de claim et fragment                               | Livré | Absent   | Expliquer la traçabilité sans exposer le jargon au premier lancement. |
| KNW-09 | Documentation d'exercice reliée automatiquement au corpus                            | Livré | Absent   | Relier la fiche Exercice à ce chapitre.                               |

**Traçabilité :** `src/features/knowledge/*`, `src/features/knowledge/wiki-*.json`,
`src/features/knowledge/programmingIndex.ts`, `src/features/knowledge/exerciseDocumentation.ts`,
plans KB et compléments v2.2.0.

### 4.10 Réglages, données et dépannage

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
| ------ | ----------------------------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------------ |
| SET-01 | Installation PWA depuis l'application | Livré | Absent | Aide spécifique selon navigateur/Android. |
| SET-02 | Thème sombre/clair | Livré | Survolé | Micro-aide contextuelle. |
| SET-03 | Silence, sons ou sons + voix | Livré | Action | Le choix final existe ; expliquer qu'il reste modifiable. |
| SET-04 | Effet de haut-parleur activable | Livré | Absent | Faire écouter un aperçu sans sauver automatiquement. |
| SET-05 | Choix Epley/Brzycki/Lombardi pour le 1RM              | Livré   | Absent   | Expliquer conséquence, pas la formule complète.                                            |
| SET-06 | Bande d'effort activable | Livré | Absent | Relier au RPE et au repos. |
| SET-07 | Notifications fin de repos, record et rappel séparées | Livré | Absent | Tutoriel Android dédié aux permissions et jours/heures. |
| SET-08 | Export lisible de tout l'historique | Livré | Absent | Ajouter au chapitre portabilité. |
| SET-09 | Export/import CSV réutilisable | Livré | Absent | Expliquer ce qui revient et ce qui ne revient pas. |
| SET-10 | Sauvegarde/restauration JSON complète | Livré | Action | Export réel puis ouverture de la confirmation, sans restaurer à la place de l'utilisateur. |
| SET-11 | Recalcul des records et mise à jour des instantanés | Livré | Absent | Garder dans une aide dépannage, pas la visite initiale. |
| SET-12 | État du stockage, tables, catalogue et reset | Livré | Absent | Ajouter des avertissements pédagogiques avant les actions destructrices. |
| SET-13 | Unités kg/lb et unités individuelles | Absent | Absent | RF-50 : l'interface et les calculs sont aujourd'hui en kg. |
| SET-14 | Taille de texte/police configurable | Absent | Absent | Partie non livrée de RF-51 ; préférer d'abord le support du zoom système. |
| SET-15 | Langues autres que le français | Différé | Absent | RF-52 ; hors besoin personnel immédiat, mais l'i18n est centralisée. |

**Traçabilité :** `src/features/settings/*`, `src/data/repositories/settings.ts`,
`src/data/repositories/backup.ts`, `src/lib/backup/*`, Lot 8 et compléments v1.0.0, RF-46,
RF-50 à RF-54, RF-66 à RF-69.

### 4.11 Audio, notifications et comportements natifs

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
| ------ | ------------------------------------------------------- | ------------- | -------- | ------------------------------------------------------------------------- |
| AUD-01 | Bus Web Audio sans prise de focus musical | Livré | Absent | Expliquer que la musique n'est pas interrompue. |
| AUD-02 | Planification, priorités, silences et anti-répétition | Livré | Absent | Conserver comme contrat technique. |
| AUD-03 | Carillon, sons de série, repos et cadence | Livré | Survolé | Ajouter un aperçu dans Réglages. |
| AUD-04 | Personnage vocal administratif | Livré | Survolé | Conserver le registre pour les nouveaux clips. |
| AUD-05 | Écho/réverbération appliqués à la lecture | Livré | Absent | Ne jamais graver l'effet dans les MP3. |
| AUD-06 | Ducking demandé seulement pour la narration du tutoriel | Livré | Absent | Maintenir la séparation avec les annonces de séance. |
| AUD-07 | Notification de repos fiable écran éteint | Livré Android | Absent | Expliquer la différence avec la PWA. |
| AUD-08 | Notification de record silencieuse | Livré Android | Absent | Expliquer pourquoi elle ne sonne pas. |
| AUD-09 | Rappels d'entraînement programmables | Livré Android | Absent | Guide de permission et de planification. |
| AUD-10 | Notification enrichie de séance/Live Activity | Partiel | Absent | La persistance Android existe, pas une surface riche équivalente à RF-60. |
| AUD-11 | Saisie vocale des séries | Différé | Absent | Lot 20 ; concevoir hors réseau et avec confirmation avant écriture. |

**Traçabilité :** `src/audio/*`, `src/platform/audioFocus.ts`,
`src/platform/nativeNotifications.ts`, `src/platform/NativeRuntimeBridge.tsx`, Lots 10, 13,
20 et 21, RF-26, RF-53, RF-60.

## 5. Fonctionnalités volontairement différées ou hors périmètre

| Domaine | État | Décision actuelle |
| ----------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Mesures corporelles complètes, mensurations et photos | Différé — Lot 11 | Le poids du jour existe ; les autres mesures, graphiques, photos et verrouillage biométrique manquent. |
| Compte, authentification et synchronisation cloud | Différé/optionnel — Lot 14 | Le produit reste mono-utilisateur et local-first. |
| Health Connect, Apple Health, fréquence cardiaque | Différé — Lot 15 | Aucune dépendance santé dans la V1. |
| Widgets d'accueil et notification de séance riche | Différé — Lot 16 | L'installation PWA/APK et les notifications ciblées existent. |
| Assistant conversationnel | Différé/optionnel — Lot 19 | Un proxy serait obligatoire ; aucun secret ne peut entrer dans le bundle. |
| Saisie vocale et passe accessibilité complète | Différé — Lot 20 | La voix actuelle parle ; elle ne saisit aucune donnée. |
| Montres et multi-appareils | Absent | Aucun besoin V1 et conflit avec le modèle local mono-utilisateur. |
| Fonctions sociales | Hors périmètre | Ne pas réintroduire profil public, fil, likes, abonnements ou partage communautaire. |

## 6. État du tutoriel actuel

### 6.1 Ce qui existe

- une invite au premier lancement : Commencer ou Passer ;
- une visite complète de **10 étapes** ;
- douze missions P1 contextuelles, avec un objectif et une réussite observée ;
- un coach non modal qui laisse la vraie commande accessible ;
- une aide contextuelle accessible par le point d'interrogation de chaque écran ;
- une transcription lisible et repliable ;
- Précédent, Suivant, Passer et progression visuelle ;
- navigation automatique entre les grandes routes ;
- attente de lecture quand un clip manque ;
- garde contre la concurrence avec repos/cadence actifs ;
- choix final Voix et sons / Sons / Silence ;
- progression versionnée `fittrack:tutorial:v2`, incluse dans la sauvegarde JSON complète ;
- reprise à la mission et à l'étape exactes après rechargement ;
- récupération explicite d'une séance active âgée de douze heures ou plus.

### 6.2 Couverture de l'orientation

| Étape actuelle | Route | Ce qu'elle fait | Limite |
| -------------- | ------------ | --------------------------------------------------- | ----------------------------------------------------------------- |
| Intro | `/` | Présente la visite | Aucun objectif utilisateur mesurable. |
| Accueil | `/` | Décrit suggestion, bloc, rythme et muscles | Ne fait toucher aucune commande. |
| Routines | `/routines` | Définit routine et bloc | Ne crée ni routine ni bloc. |
| Programmes     | `/programs`  | Montre la liste des blocs et leur porte de création | N'enseigne ni le Cadre, ni le Split, ni les Semaines.             |
| Séance | `/` | Décrit charge, reps, cadence et repos | Ne va pas sur l'écran de séance. |
| Coach | `/` | Décrit RPE et recommandations | Ne montre ni bande RPE ni écran de fin. |
| Historique | `/history` | Décrit journal et calendrier | N'enseigne ni filtre, ni édition, ni partage. |
| Progression | `/analytics` | Décrit les familles d'analyse | N'enseigne période, métrique ou export. |
| Exercices | `/exercises` | Décrit le catalogue | N'enseigne ni recherche, ni filtre, ni création. |
| Réglages | `/settings` | Énumère les catégories | N'enseigne ni sauvegarde, ni notifications. |
| Choix vocal | fin | Enregistre le mode d'annonce | Geste réel conservé ; les missions P1 prennent ensuite le relais. |

### 6.3 Couverture opératoire P1

La limite structurelle de l'orientation est contournée par des ancres précises
`data-tutorial-id` et des événements métier émis seulement après le résultat durable attendu. Les
missions peuvent donc viser une routine, la première ligne, sa coche, le repos, le bilan ou la
sauvegarde sans écrire à la place de l'utilisateur. Les cibles propres à une série n'apparaissent
que sur le premier exercice et la première série ; cette unicité est épinglée par les tests.

Le parcours P1 reste entièrement utilisable en Silence, mais ses **quinze instructions** portent
désormais chacune un `clipId` et un MP3. Le texte reste la source de vérité : un clip absent ne
doit jamais empêcher d'effectuer ou de reprendre une mission.

### 6.4 Ce qu'il reste à enseigner pour couvrir l'application

La visite initiale doit rester courte. L'exhaustivité vient de missions contextuelles, dans cet
ordre :

1. **Programmes** : Cadre → Split → Semaines → activation, puis lecture du suivi.
2. **Outils de séance** : types de série, RPE, plaques, échauffement, cadence/maintien,
   unilatéral, décharge et application d'une recommandation du coach.
3. **Historique** : retrouver, corriger et partager une séance, puis import Hevy complet.
4. **Progression** : choisir la bonne analyse, période et métrique, lire une source et exporter.
5. **Exercices** : rechercher/filtrer, créer un exercice, régler sa mesure et lire sa
   documentation.
6. **Base de preuves** : rechercher un passage, distinguer question couverte/non couverte et lire
   confiance, contradictions et limites.
7. **Accueil et données** : poids du jour, carte musculaire, objectif hebdomadaire,
   installation/hors-ligne, notifications et différence CSV/JSON.

Les révisions de bloc, la réparation d'un split, le recalcul des records, la mise à jour des
instantanés et le reset restent de l'aide experte à la demande, pas des étapes de première prise en
main.

## 7. Architecture cible du tutoriel

Le tutoriel doit avoir trois couches complémentaires, pas une visite interminable.

### Couche A — Orientation globale

Conserver la visite actuelle sous **2 min 30**. Elle répond seulement à : « où suis-je et où vais-je
pour préparer, m'entraîner, relire et sauvegarder ? ». Elle ne doit pas essayer d'expliquer toutes
les commandes.

### Couche B — Missions contextuelles

Une mission apprend une tâche complète et laisse l'utilisateur effectuer les gestes sur ses vraies
données. Elle possède :

- un identifiant stable ;
- une route et un ancrage précis `data-tutorial-id` ;
- un texte court affiché même sans son ;
- un clip facultatif ;
- une action attendue ;
- une condition `advanceWhen` observée sans écrire à la place de l'utilisateur ;
- un garde pour les états incompatibles ;
- une sortie Passer immédiate ;
- une reprise au dernier pas si l'application est fermée.

Le tutoriel ne doit jamais créer, valider, supprimer ou restaurer une donnée à la place de
l'utilisateur.

### Couche C — Aide à la demande

Le point d'interrogation doit ouvrir une liste courte de tâches propres à la route : « Créer une
routine », « Corriger cette séance », « Restaurer une sauvegarde ». Rejouer la visite complète reste
une action secondaire.

### Persistance

La préférence versionnée `fittrack:tutorial:v2` contient :

- orientation `completed | skipped` ;
- missions terminées ;
- mission et étape en cours ;
- missions refusées, afin de ne pas les reproposer automatiquement ;
- version du script.

Le namespace `fittrack:` garantit son inclusion automatique dans la sauvegarde complète. Une
ancienne valeur v1 migre vers « orientation terminée, missions non commencées ».

### Audio

- La transcription est toujours la source de vérité fonctionnelle.
- Le clip ne bloque jamais une mission s'il est absent ou si le mode Silence est actif.
- Les clips de mission visent 6 à 12 secondes et une seule instruction.
- La narration s'arrête immédiatement quand l'utilisateur agit, passe ou change de route.
- Aucun clip n'est généré avant validation finale du texte, de son identifiant et de sa condition
  de réussite.

## 8. Catalogue des missions tutoriel

### P1 — Première séance et sécurité des données

Les douze missions ci-dessous sont livrées au niveau **Action**, avec texte et voix. Certaines
missions possèdent deux gestes successifs, soit quinze clips d'instruction au total.

| ID         | Mission                                          | Départ                    | Réussite observée                                             | Voix actuelle                                         |
| ---------- | ------------------------------------------------ | ------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| TUT-ACT-01 | Choisir son chemin : modèle existant ou création | Premier lancement         | Une routine est ouverte ou créée                              | `mission-activation-1`                                |
| TUT-REC-01 | Résoudre une séance active ancienne              | Barre de reprise          | Reprise, fin ou abandon explicitement choisi                  | `mission-recovery-1`                                  |
| TUT-ROU-01 | Créer une première routine                       | État vide Routines        | Routine persistée avec un nom                                 | `mission-routine-create-1`                            |
| TUT-ROU-02 | Ajouter un exercice et ses séries                | Éditeur de routine        | Au moins un exercice avec une série cible                     | `mission-routine-exercise-1`, `mission-routine-set-1` |
| TUT-ROU-03 | Définir repos et cible                           | Carte exercice de routine | Repos et répétitions/charge renseignés                        | `mission-routine-targets-1`, `mission-routine-rest-1` |
| TUT-ROU-04 | Démarrer la routine                              | Fiche/liste routine       | Séance active liée à la routine                               | `mission-routine-start-1`                             |
| TUT-WRK-01 | Lire la valeur précédente et remplir la série    | Première série            | Charge/reps valides présentes                                 | `mission-set-input-1`                                 |
| TUT-WRK-02 | Valider et comprendre la sauvegarde immédiate    | Coche de série            | Série marquée terminée en base                                | `mission-set-validate-1`                              |
| TUT-WRK-03 | Lire et ajuster le repos                         | Repos actif               | Temps ajusté ou repos terminé                                 | `mission-rest-1`                                      |
| TUT-WRK-04 | Terminer la séance et lire le bilan              | Dernière série            | Séance terminée et écran de bilan vu                          | `mission-workout-finish-1`, `mission-workout-save-1`  |
| TUT-DAT-01 | Exporter une sauvegarde complète                 | Réglages                  | Fichier JSON produit/partagé                                  | `mission-backup-export-1`                             |
| TUT-DAT-02 | Comprendre une restauration                      | Réglages                  | Feuille de confirmation ouverte, sans imposer la restauration | `mission-backup-restore-1`                            |

### P2 — Maîtrise des outils

| ID | Mission | Départ | Réussite observée | Voix future |
| ---------- | ---------------------------------- | ----------------- | ---------------------------------------- | ----------------------------- |
| TUT-PRG-01 | Créer le cadre d'un bloc | Programmes | Étape Cadre valide | `tutorial-program-frame-1` |
| TUT-PRG-02 | Construire le split | Assistant bloc | Semaine contenant au moins une routine | `tutorial-program-split-1` |
| TUT-PRG-03 | Régler les semaines et activer | Assistant bloc | Bloc actif | `tutorial-program-activate-1` |
| TUT-WRK-05 | Ajouter une série ou un exercice | Séance | Ligne ajoutée | `tutorial-workout-add-1` |
| TUT-WRK-06 | Choisir le type d'une série | Rang de série | Type différent de normale choisi | `tutorial-set-type-1` |
| TUT-WRK-07 | Renseigner le RPE | Bande d'effort | RPE persisté | `tutorial-rpe-1` |
| TUT-WRK-08 | Utiliser les plaques | Série compatible | Feuille de plaques comprise/ajustée | `tutorial-plates-1` |
| TUT-WRK-09 | Insérer l'échauffement | Série cible | Séries d'échauffement insérées | `tutorial-warmup-1` |
| TUT-WRK-10 | Lancer et arrêter la cadence | Menu exercice | Cadence démarrée puis arrêtée | `tutorial-pace-1` |
| TUT-HIS-01 | Retrouver une séance | Historique | Date, calendrier ou exercice sélectionné | `tutorial-history-find-1` |
| TUT-HIS-02 | Corriger une séance | Détail historique | Éditeur ouvert puis sauvegardé | `tutorial-history-edit-1` |
| TUT-HIS-03 | Partager une séance | Menu historique | Feuille de partage ouverte | `tutorial-history-share-1` |
| TUT-IMP-01 | Importer un CSV Hevy | Historique | Fichier analysé et revue atteinte | `tutorial-hevy-import-1` |
| TUT-ANA-01 | Choisir une analyse et une période | Progression | Écran et période sélectionnés | `tutorial-analytics-read-1` |
| TUT-ANA-02 | Exporter un graphique | Graphique | Feuille de partage ouverte | `tutorial-chart-export-1` |
| TUT-EXE-01 | Rechercher et filtrer | Exercices | Résultat ciblé visible | `tutorial-exercise-search-1` |
| TUT-EXE-02 | Créer un exercice personnalisé | Exercices | Exercice personnalisé persisté | `tutorial-exercise-create-1` |
| TUT-SET-01 | Choisir annonces et ambiance | Réglages | Mode et écho choisis | `tutorial-audio-settings-1` |
| TUT-SET-02 | Régler les notifications Android | Réglages | Préférences enregistrées | `tutorial-notifications-1` |

### P3 — Aide experte

- réviser un bloc à partir d'une semaine future ;
- réparer un split dont une routine a disparu ;
- comprendre la décharge et le coach ;
- recalculer les records ;
- mettre à jour les instantanés historiques ;
- restaurer le catalogue ;
- comprendre les limites navigateur/Android.

Ces sujets appartiennent à l'aide à la demande, jamais à l'orientation initiale.

## 9. Inventaire vocal

### État présent

- `voiceScript.json` déclare **96 identifiants uniques** ;
- `public/voice/` contient **96 MP3 correspondants** ;
- **10 clips** appartiennent à l'orientation et **15** aux missions P1 ;
- aucun fichier déclaré par le manifeste actuel ne manque au moment de l'inventaire ;
- les clips de maintien, changement de côté, cadence, repos, records et coach complètent le pack.

### Règles pour la prochaine phase vocale

1. Finaliser texte, action attendue et identifiant de chaque mission.
2. Faire une revue de longueur et supprimer toute phrase qui donne deux instructions.
3. Pour toute nouvelle mission, générer puis écouter le clip dans l'application avec la chaîne
   `publicAddress` réelle.
4. Ne pas enregistrer écho ou réverbération dans les MP3.
5. Conserver le personnage administratif, impersonnel, sans encouragement.
6. Garder `.voice-cache/` pour ne jamais payer deux fois une prise déjà obtenue.
7. Vérifier automatiquement durée, présence du fichier et correspondance manifeste/pack.
8. Ne jamais exposer ni consigner la clé API dans le dépôt ou le bundle.

## 10. Backlog produit priorisé

### P1

1. **Livré :** missions tutoriel P1, ancrages précis et progression versionnée.
2. **Livré :** récupération explicite d'une séance active âgée d'au moins 12 h, sans suppression
   automatique.
3. **Livré :** export et lecture de la confirmation de restauration de la sauvegarde complète.
4. **Livré :** l'annonce de reprise reste muette tant que le RPE est ouvert, sans mettre en pause
   l'horloge du repos ni rejouer un repère dépassé.
5. **Livré :** chrono de série chronométrée. Un gainage, une planche, un dead hang ou un rameur se
   chronomètrent dans l'app ; la coche arrête le chrono, écrit la durée tenue (relâchement de 2 s
   retiré) et valide la série. Les repères toutes les 5 s jusqu'à 3 min sont enregistrés dans le
   pack vocal actuel.
6. **Livré :** exercices unilatéraux. Une ligne représente les deux côtés — une saisie, une
   validation, un `setId`. Changement de côté annoncé, dix secondes réelles, et aucun
   repos/RPE/record après le premier côté. Fonctionne sur les deux cadences, répétitions et
   maintien. Le changement de côté est enregistré dans le pack vocal actuel.
7. Décider explicitement si la séance vide retrouve une porte UI ou reste un comportement interne.

### P2

1. Ajouter les missions outils, programmes, historique, analyses et exercices.
2. Livrer les unités configurables de RF-50.
3. Cadrer les démonstrations d'exercices locales et licenciées manquantes de RF-06.
4. Borner les lectures d'historique quand les benchmarks téléphone dépassent le seuil accepté.
5. Fermer les parties restantes du coach déterministe liées au RPE et à la décharge.
6. Auditer texte à 200 %, TalkBack et toutes les feuilles à 320–390 px.

### V2/V3

1. Mesures corporelles et photos privées.
2. Rétrospective annuelle.
3. Health Connect et widgets.
4. Saisie vocale locale et accessibilité complète.
5. Assistant conversationnel uniquement derrière un proxy sans secret dans le bundle.

## 11. Ordre de réalisation recommandé

1. **Livré — socle tutoriel v2** : registre de missions, progression, ancrages et aide par route.
2. **Livré — activation P1** : routine → première série → repos → fin → sauvegarde.
3. **Livré — récupération** : séance ancienne, reprise après kill, abandon explicite.
4. **Livré — annonces de séance** : le bug RPE/repos est fermé, et le chrono de maintien comble le
   manque signalé (sortir de l'app pour chronométrer un gainage).
5. **Livré — cycle unilatéral à deux côtés**, sur les deux cadences : répétitions et maintien.
6. **Livré — revue des textes** : les quinze consignes de mission, les trente-six repères du
   chrono et le changement de côté sont figés et validés.
7. **Livré — voix** : 96 identifiants, 96 MP3, épinglés par un test du manifeste.
8. **Missions P2** : outils, blocs, historique, analyses et exercices.
9. **Audit final** : typecheck, tests, build, mobile 390 px, TalkBack et vraie séance hors ligne.

## 12. Critères de réussite du futur tutoriel

Le tutoriel sera considéré terminé quand :

- un nouvel utilisateur peut créer ou choisir une routine et terminer une première séance sans
  aide extérieure ;
- aucune mission ne modifie une donnée à sa place ;
- chaque mission fonctionne en Silence grâce au texte ;
- fermer l'app au milieu d'une mission permet de reprendre ;
- une séance active ancienne propose une sortie sûre sans perte de données ;
- l'aide de chaque sous-route propose des tâches réellement propres à cette route ;
- toutes les voix déclarées ont un MP3, et l'absence volontaire d'un MP3 ne bloque pas l'UI ;
- les cibles utilisées en séance mesurent au moins 48 px ;
- le parcours fonctionne hors ligne et sans compte ;
- la sauvegarde complète conserve la progression du tutoriel.

## 13. Fichiers de référence pour la suite

| Sujet | Fichiers principaux |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Tutoriel | `src/features/tutorial/TutorialProvider.tsx`, `tutorialScript.ts`, `tutorialStore.ts`, `tutorialNarration.ts` |
| Ancrages | `src/app/Screen.tsx`, `src/app/BottomNav.tsx`, composants ciblés de chaque mission |
| Textes UI | `src/i18n/fr.ts` |
| Script vocal | `src/audio/voiceScript.json` |
| Lecture vocale | `src/audio/voicePack.ts`, `src/audio/announce.ts`, `src/audio/publicAddress.ts` |
| Génération | `scripts/generate-voice.mjs`, `scripts/voice/*` |
| Sauvegarde | `src/data/repositories/backup.ts`, `src/lib/backup/*` |
| Routes | `src/router.tsx`, `src/features/*/routes.tsx` |
| Exigences | `audit-hevy-cahier-des-charges.md`, `docs/plans/00-ROADMAP.md`, `PROGRESS.md` |

---

Ce document est la source de vérité pour la conception du tutoriel v2. Toute nouvelle mission doit
d'abord y être ajoutée ou mise à jour ; toute nouvelle voix doit ensuite reprendre exactement le
même identifiant et le même texte validé.

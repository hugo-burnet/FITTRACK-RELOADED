# FitTrack — Inventaire maître des fonctionnalités et du tutoriel

> **Statut :** document produit de référence, établi à la version `v1.0.1` (`437bf83`) puis
> actualisé sur l'implémentation tutoriel P1 (`308dfcd`) le 22 août 2026.
>
> **But :** dire ce que FitTrack sait réellement faire, où cela vit, ce qui reste incomplet et
> ce que le tutoriel doit apprendre avant de refaire les voix.

## 1. Comment lire ce document

Cet inventaire croise quatre sources :

1. l'application réellement parcourue au format mobile `390 × 844` ;
2. les routes, composants, repositories et tests présents dans `src/` ;
3. le cahier des charges `audit-hevy-cahier-des-charges.md`, la roadmap et `PROGRESS.md` ;
4. le script vocal et les fichiers présents dans `public/voice/`.

Le parcours navigateur initial a couvert l'accueil, les routines, les blocs, la séance active,
l'historique, l'import Hevy, les analyses, les exercices, les réglages, le dépannage, les crédits,
le premier lancement et la visite guidée. Un second contrôle sur une origine isolée a ensuite
exercé le parcours P1 complet, sans toucher aux données de l'origine habituelle.

### États fonctionnels

| État | Sens |
|---|---|
| **Livré** | Le parcours existe dans l'interface et son comportement est soutenu par le code/tests. |
| **Partiel** | Une partie utile existe, mais une exigence ou une porte d'entrée manque. |
| **Dette** | Livré, avec une limite mesurée ou explicitement assumée. |
| **Différé** | Prévu par la roadmap, hors V1 et non commencé dans le produit. |
| **Absent** | Demandé par le cahier des charges ou nécessaire au parcours, sans réalisation prévue assez précise. |
| **Hors périmètre** | Écart volontaire avec Hevy, notamment toute fonction sociale. |

### États du tutoriel

| État | Sens |
|---|---|
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
|---|---:|---|
| Accessibilité | 3/4 | Sémantique, focus visible et contrastes solides ; quelques cibles textuelles secondaires restent à vérifier. |
| Performance | 3/4 | Routes lourdes différées et bundle initial réduit ; certaines lectures d'historique restent non bornées. |
| Responsive | 3/4 | Aucun débordement racine à 390 px et commandes principales ≥ 44 px ; texte à 200 % et toutes les feuilles restent à auditer. |
| Thèmes | 4/4 | Tokens cohérents, sombre/clair, contrastes documentés et mouvement réduit. |
| Anti-patterns | 3/4 | Identité volontaire et cohérente ; densité de cartes et micro-labels capitalisés à surveiller. |
| **Total** | **16/20** | **Bon — corriger l'activation et les lacunes ciblées, pas refaire l'interface.** |

Le détecteur automatique n'a remonté que trois faux positifs dans les commentaires de
`src/platform/chartImage.ts` : les mentions de `<img>` décrivent la rasterisation, elles ne sont
pas des images cassées.

## 3. Inventaire fonctionnel

### 3.1 Fondations, stockage et plateforme

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
|---|---|---|---|---|
| FND-01 | Fonctionnement intégral hors ligne, sans compte | Livré | Survolé | L'annoncer dès le premier écran. |
| FND-02 | Persistance IndexedDB via Dexie et repositories | Livré | Absent | Expliquer simplement où vivent les données. |
| FND-03 | Écriture en base à chaque série validée | Livré | Action | La mission de validation attend la réussite de l'écriture durable. |
| FND-04 | Reprise d'une séance après kill ou interruption | Livré | Action | Une séance ancienne propose trois choix explicites, sans suppression automatique. |
| FND-05 | Routines, historique et exercices personnalisés sans quota | Livré | Absent | Le signaler dans l'aide des bibliothèques. |
| FND-06 | Navigation hash compatible GitHub Pages et Capacitor | Livré | Sans objet | Maintenir `createHashRouter`. |
| FND-07 | PWA installable et mise à jour contrôlée | Livré | Absent | Ajouter une aide d'installation et de mise à jour. |
| FND-08 | APK Android et ponts natifs | Livré | Absent | Expliquer les capacités réservées à Android. |
| FND-09 | Thèmes sombre/clair et préférence mémorisée | Livré | Survolé | Ajouter une micro-aide depuis Réglages. |
| FND-10 | Réduction des animations système | Livré | Absent | Conserver et inclure dans l'audit accessibilité. |
| FND-11 | Gestion d'erreur globale et routes lourdes différées | Livré | Sans objet | Conserver le découpage ; surveiller les écrans différés sur téléphone. |

**Traçabilité :** `src/data/db.ts`, `src/data/repositories/*`, `src/router.tsx`,
`src/app/lazyRoute.tsx`, `src/platform/*`, `src/index.css`, Lots 0–2, 9 et 10, RF-25, RF-51,
RF-69.

### 3.2 Accueil

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
|---|---|---|---|---|
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

### 3.3 Routines et dossiers

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
|---|---|---|---|---|
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

### 3.4 Programmes et blocs multi-semaines

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
|---|---|---|---|---|
| PRG-01 | Liste des blocs brouillons, actifs et terminés | Livré | Survolé | Expliquer les trois états. |
| PRG-02 | Assistant de création en trois étapes | Livré | Absent | Mission guidée : cadre, split, semaines. |
| PRG-03 | Départ un lundi et durée de 4 à 12 semaines | Livré | Absent | Expliquer la règle calendaire avant validation. |
| PRG-04 | Affectation des routines aux jours de la semaine | Livré | Absent | Montrer jours d'entraînement et repos. |
| PRG-05 | Niveaux de charge par semaine | Livré | Absent | Ajouter une lecture pédagogique des pourcentages. |
| PRG-06 | Recettes Hypertrophie, Force et Reprise | Livré | Absent | Présenter comme point de départ modifiable. |
| PRG-07 | Activation d'un bloc | Livré | Absent | Faire comprendre ce qui devient scellé. |
| PRG-08 | Démarrage de la séance prévue depuis le bloc | Livré | Survolé | Ajouter une mission depuis l'accueil. |
| PRG-09 | Révision future sans réécrire les semaines passées | Livré | Absent | Aide avancée sur la semaine d'effet. |
| PRG-10 | Décharge planifiée et réduction à 80 % | Livré | Absent | Expliquer la décharge et l'arrondi. |
| PRG-11 | Réparation d'une routine de split supprimée | Livré | Absent | Ajouter un guide de récupération. |
| PRG-12 | Modification du nom/durée d'un bloc actif | Partiel | Absent | La date se décale, mais nom et durée restent figés ; décider le comportement. |

**Traçabilité :** `src/features/programs/*`, `src/data/repositories/program*.ts`,
`src/lib/programs/*`, Lot 17, recommandation M3 sur la périodisation.

### 3.5 Séance en direct

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
|---|---|---|---|---|
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
| WRK-17 | Fatigue appliquée au tempo et au repos | Livré | Absent | Documenter la règle et son plafond. |
| WRK-18 | Détection et annonce d'un record en direct | Livré | Survolé | Montrer ce qui est enregistré et notifié. |
| WRK-19 | Décharge ponctuelle des séries restantes | Livré | Absent | Aide avancée avec aperçu avant application. |
| WRK-20 | Écran de fin, bilan et notes | Livré | Action | La mission ouvre le bilan puis attend l'enregistrement durable. |
| WRK-21 | Coach déterministe et proposition de prochaine charge | Partiel | Survolé | Hausse, baisse et plateau existent ; règles RPE lourdes/décharge restent hors V1. |
| WRK-22 | Abandon explicite sans confusion avec Terminer | Livré | Action | L'abandon d'une vieille séance exige une confirmation comptée. |

**Traçabilité :** `src/features/workout/*`, `src/data/repositories/workout*.ts`,
`src/stores/restTimer.ts`, `src/stores/repPacer.ts`, Lots 5, 6, 18 et 21, RF-17 à RF-31,
RF-48.

### 3.6 Historique, calendrier et import Hevy

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
|---|---|---|---|---|
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

### 3.7 Progression, records et rapports

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
|---|---|---|---|---|
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

### 3.8 Bibliothèque d'exercices

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
|---|---|---|---|---|
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
| EXE-11 | Image ou démonstration du mouvement | Partiel | Absent | La carte musculaire couvre l'anatomie, pas l'exécution ; décider une source locale/licenciée. |

**Traçabilité :** `src/features/exercises/*`, `src/data/seed/*`,
`src/data/repositories/exercises*.ts`, `src/ui/muscleMap/*`, Lots 2, 3 et 5bis, RF-06 à
RF-10.

### 3.9 Réglages, données et dépannage

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
|---|---|---|---|---|
| SET-01 | Installation PWA depuis l'application | Livré | Absent | Aide spécifique selon navigateur/Android. |
| SET-02 | Thème sombre/clair | Livré | Survolé | Micro-aide contextuelle. |
| SET-03 | Silence, sons ou sons + voix | Livré | Action | Le choix final existe ; expliquer qu'il reste modifiable. |
| SET-04 | Effet de haut-parleur activable | Livré | Absent | Faire écouter un aperçu sans sauver automatiquement. |
| SET-05 | Choix Epley/Brzycki pour le 1RM | Livré | Absent | Expliquer conséquence, pas la formule complète. |
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

### 3.10 Audio, notifications et comportements natifs

| ID | Fonctionnalité | État | Tutoriel | Suite recommandée |
|---|---|---|---|---|
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

## 4. Fonctionnalités volontairement différées ou hors périmètre

| Domaine | État | Décision actuelle |
|---|---|---|
| Mesures corporelles complètes, mensurations et photos | Différé — Lot 11 | Le poids du jour existe ; les autres mesures, graphiques, photos et verrouillage biométrique manquent. |
| Compte, authentification et synchronisation cloud | Différé/optionnel — Lot 14 | Le produit reste mono-utilisateur et local-first. |
| Health Connect, Apple Health, fréquence cardiaque | Différé — Lot 15 | Aucune dépendance santé dans la V1. |
| Widgets d'accueil et notification de séance riche | Différé — Lot 16 | L'installation PWA/APK et les notifications ciblées existent. |
| Assistant conversationnel | Différé/optionnel — Lot 19 | Un proxy serait obligatoire ; aucun secret ne peut entrer dans le bundle. |
| Saisie vocale et passe accessibilité complète | Différé — Lot 20 | La voix actuelle parle ; elle ne saisit aucune donnée. |
| Montres et multi-appareils | Absent | Aucun besoin V1 et conflit avec le modèle local mono-utilisateur. |
| Fonctions sociales | Hors périmètre | Ne pas réintroduire profil public, fil, likes, abonnements ou partage communautaire. |

## 5. État du tutoriel actuel

### 5.1 Ce qui existe

- une invite au premier lancement : Commencer ou Passer ;
- une visite complète de **9 étapes** ;
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

### 5.2 Couverture de l'orientation

| Étape actuelle | Route | Ce qu'elle fait | Limite |
|---|---|---|---|
| Intro | `/` | Présente la visite | Aucun objectif utilisateur mesurable. |
| Accueil | `/` | Décrit suggestion, bloc, rythme et muscles | Ne fait toucher aucune commande. |
| Routines | `/routines` | Définit routine et bloc | Ne crée ni routine ni bloc. |
| Séance | `/` | Décrit charge, reps, cadence et repos | Ne va pas sur l'écran de séance. |
| Coach | `/` | Décrit RPE et recommandations | Ne montre ni bande RPE ni écran de fin. |
| Historique | `/history` | Décrit journal et calendrier | N'enseigne ni filtre, ni édition, ni partage. |
| Progression | `/analytics` | Décrit les familles d'analyse | N'enseigne période, métrique ou export. |
| Exercices | `/exercises` | Décrit le catalogue | N'enseigne ni recherche, ni filtre, ni création. |
| Réglages | `/settings` | Énumère les catégories | N'enseigne ni sauvegarde, ni notifications. |
| Choix vocal | fin | Enregistre le mode d'annonce | Geste réel conservé ; les missions P1 prennent ensuite le relais. |

### 5.3 Couverture opératoire P1

La limite structurelle de l'orientation est contournée par des ancres précises
`data-tutorial-id` et des événements métier émis seulement après le résultat durable attendu. Les
missions peuvent donc viser une routine, la première ligne, sa coche, le repos, le bilan ou la
sauvegarde sans écrire à la place de l'utilisateur. Les cibles propres à une série n'apparaissent
que sur le premier exercice et la première série ; cette unicité est épinglée par les tests.

Le parcours P1 est **text-only** : aucune de ses étapes ne porte encore de `clipId`. Il reste donc
entièrement utilisable en Silence, mais les douze futurs clips n'ont pas été générés.

## 6. Architecture cible du tutoriel

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

## 7. Catalogue des missions tutoriel

### P1 — Première séance et sécurité des données

Les douze missions ci-dessous sont livrées au niveau **Action (texte)**. Les identifiants de voix
restent réservés pour la phase suivante : aucun clip P1 n'est encore généré ou déclaré.

| ID | Mission | Départ | Réussite observée | Voix future |
|---|---|---|---|---|
| TUT-ACT-01 | Choisir son chemin : modèle existant ou création | Premier lancement | Une routine est ouverte ou créée | `tutorial-activation-choice-1` |
| TUT-REC-01 | Résoudre une séance active ancienne | Barre de reprise | Reprise, fin ou abandon explicitement choisi | `tutorial-workout-recovery-1` |
| TUT-ROU-01 | Créer une première routine | État vide Routines | Routine persistée avec un nom | `tutorial-routine-create-1` |
| TUT-ROU-02 | Ajouter un exercice et ses séries | Éditeur de routine | Au moins un exercice avec une série cible | `tutorial-routine-exercise-1` |
| TUT-ROU-03 | Définir repos et cible | Carte exercice de routine | Repos et répétitions/charge renseignés | `tutorial-routine-targets-1` |
| TUT-ROU-04 | Démarrer la routine | Fiche/liste routine | Séance active liée à la routine | `tutorial-routine-start-1` |
| TUT-WRK-01 | Lire la valeur précédente et remplir la série | Première série | Charge/reps valides présentes | `tutorial-set-input-1` |
| TUT-WRK-02 | Valider et comprendre la sauvegarde immédiate | Coche de série | Série marquée terminée en base | `tutorial-set-validate-1` |
| TUT-WRK-03 | Lire et ajuster le repos | Repos actif | Temps ajusté ou repos terminé | `tutorial-rest-timer-1` |
| TUT-WRK-04 | Terminer la séance et lire le bilan | Dernière série | Séance terminée et écran de bilan vu | `tutorial-workout-finish-1` |
| TUT-DAT-01 | Exporter une sauvegarde complète | Réglages | Fichier JSON produit/partagé | `tutorial-backup-export-1` |
| TUT-DAT-02 | Comprendre une restauration | Réglages | Feuille de confirmation ouverte, sans imposer la restauration | `tutorial-backup-restore-1` |

### P2 — Maîtrise des outils

| ID | Mission | Départ | Réussite observée | Voix future |
|---|---|---|---|---|
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

## 8. Inventaire vocal

### État présent

- `voiceScript.json` déclare **43 identifiants uniques** ;
- `public/voice/` contient **43 MP3 correspondants** ;
- les deux groupes de décompte réutilisent six de ces identifiants ;
- **10 clips** appartiennent au tutoriel actuel ;
- aucun fichier déclaré par le manifeste actuel ne manque au moment de l'inventaire ;
- les **12 clips P1 futurs ne sont ni déclarés ni générés** : les missions utilisent leur texte.

La future « voix manquante » désigne donc principalement les **nouveaux clips des missions**, pas
un trou entre le manifeste actuel et `public/voice/`.

### Règles pour la prochaine phase vocale

1. Finaliser texte, action attendue et identifiant de chaque mission.
2. Faire une revue de longueur et supprimer toute phrase qui donne deux instructions.
3. Générer d'abord les P1, écouter dans l'application avec la chaîne `publicAddress` réelle.
4. Ne pas enregistrer écho ou réverbération dans les MP3.
5. Conserver le personnage administratif, impersonnel, sans encouragement.
6. Garder `.voice-cache/` pour ne jamais payer deux fois une prise déjà obtenue.
7. Vérifier automatiquement durée, présence du fichier et correspondance manifeste/pack.
8. Ne jamais exposer ni consigner la clé API dans le dépôt ou le bundle.

La clé API rebranchée le 22 août 2026 n'a pas été utilisée pendant cet inventaire.

## 9. Backlog produit priorisé

### P1

1. **Livré :** missions tutoriel P1, ancrages précis et progression versionnée.
2. **Livré :** récupération explicite d'une séance active âgée d'au moins 12 h, sans suppression
   automatique.
3. **Livré :** export et lecture de la confirmation de restauration de la sauvegarde complète.
4. **Livré :** l'annonce de reprise reste muette tant que le RPE est ouvert, sans mettre en pause
   l'horloge du repos ni rejouer un repère dépassé.
5. **Livré :** chrono de série chronométrée. Un gainage, une planche, un dead hang ou un rameur se
   chronomètrent dans l'app ; la coche arrête le chrono, écrit la durée tenue (relâchement de 2 s
   retiré) et valide la série. Trente-six repères toutes les 5 s jusqu'à 3 min, **déclarés mais
   pas encore enregistrés**.
6. Pour un exercice unilatéral, faire représenter les deux côtés par une seule ligne : changement
   de côté vocal, reprise après 10 s, et aucun repos/RPE/record après le premier côté. **Se pose
   sur le chrono** : la cadence d'une ligne est désormais soit des répétitions, soit un maintien,
   et le cycle deux côtés doit fonctionner sur les deux.
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

## 10. Ordre de réalisation recommandé

1. **Livré — socle tutoriel v2** : registre de missions, progression, ancrages et aide par route.
2. **Livré — activation P1** : routine → première série → repos → fin → sauvegarde.
3. **Livré — récupération** : séance ancienne, reprise après kill, abandon explicite.
4. **Livré — annonces de séance** : le bug RPE/repos est fermé, et le chrono de maintien comble le
   manque signalé (sortir de l'app pour chronométrer un gainage).
5. **Cycle unilatéral à deux côtés**, sur les deux cadences — répétitions et maintien.
6. **Revue des textes** : figer les douze transcriptions P1, les trente-six repères du chrono et
   le texte du changement de côté, puis les faire valider.
7. **Voix** : auditer les manques, générer **uniquement** ce qui manque, écouter dans l'app et
   vérifier manifeste/MP3 — sans jamais exposer ni consigner la clé.
8. **Missions P2** : outils, blocs, historique, analyses et exercices.
9. **Audit final** : typecheck, tests, build, mobile 390 px, TalkBack et vraie séance hors ligne.

## 11. Critères de réussite du futur tutoriel

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

## 12. Fichiers de référence pour la suite

| Sujet | Fichiers principaux |
|---|---|
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

# Tutoriel campagne, Programmes et mode Voix uniquement — design

**Date :** 28 août 2026

**Statut :** validé par l'utilisateur

**Sources :** audit navigateur mobile, `docs/product/FEATURE-INVENTORY.md`, tutoriel v2 existant,
design unilatéral du 22 août 2026.

**Plan d'exécution :**
`docs/superpowers/plans/2026-08-28-tutorial-campaign-voice-only.md`.

## 1. Objectif

Transformer le tutoriel actuel en apprentissage interactif de type jeu vidéo : FitTrack ouvre le
bon écran, montre exactement la commande décrite, attend le vrai geste de l'utilisateur et reprend
au même endroit après une fermeture.

Le même chantier doit :

- offrir un parcours débutant réalisable sans aucune donnée préalable ;
- apprendre une routine simple contenant **Curl haltères** ;
- ajouter un tutoriel détaillé de l'onglet **Programmes** ;
- terminer les missions contextuelles recensées dans l'inventaire produit ;
- ajouter le mode **Voix uniquement**, sans cadence de répétitions ;
- rendre l'avancement Premier côté / Second côté explicite et persistant ;
- supprimer la double annonce « Reprise dans dix secondes » observée sur le gainage.

La génération et le branchement de nouvelles voix restent une phase ultérieure. Le texte français
et les identifiants de clips sont préparés, mais aucun MP3 n'est créé dans ce chantier.

## 2. Constats vérifiés dans le navigateur

- La visite globale navigue bien vers `/routines` et `/programs`, mais l'aide contextuelle retire
  volontairement la route et peut donc expliquer Routines depuis `/routines/:id`.
- Les étapes s'enchaînent après la voix ou un minuteur de secours, sans attendre un geste métier.
- La navigation et la narration démarrent en parallèle ; la voix peut commencer avant que la route
  et la cible soient prêtes.
- En mode Silence, la transcription reste ouverte. Sur 390 × 844, certains panneaux occupent
  environ 359 px et masquent près de la moitié de l'écran.
- Plusieurs cibles sont trop générales : onglet Planifier pour parler des routines, bouton `+` pour
  décrire le fonctionnement complet des programmes.
- La mission dit « Nouvelle routine » alors que l'action réelle s'appelle « Routine vide ».
- Une mission de composition lancée sans identifiant de routine peut viser un éditeur impossible à
  rejoindre. La garde actuelle qui masque ces missions inaccessibles doit être conservée.
- Le cycle unilatéral est actuellement ouvert par le moteur de cadence ou de maintien. Couper la
  cadence sans le découpler ferait perdre à l'application la notion du côté en cours.

## 3. Principes verrouillés

1. **Le tutoriel n'écrit jamais à la place de l'utilisateur.** Il peut naviguer, cadrer et attendre ;
   toute création, saisie, validation, activation, suppression ou restauration vient d'un geste
   explicite.
2. **Aucune fausse séance.** La routine découverte est une vraie donnée créée volontairement ; la
   partie séance ne reprend que lorsque l'utilisateur démarre réellement cette routine.
3. **Une étape, une cible, une phrase, une réussite.** Une consigne ne décrit pas plusieurs zones.
4. **Pas d'avance automatique après narration.** Une étape d'action avance sur un événement métier
   durable. Une étape purement explicative attend un bouton explicite « Continuer ».
5. **La route et la cible précèdent la voix.** La narration ne démarre qu'après navigation,
   chargement de la route et présence de l'ancre.
6. **Le texte reste suffisant.** Toutes les missions fonctionnent hors ligne et en Silence.
7. **Le parcours est reprenable.** Mission, étape et identifiants de routine/programme sont
   persistés dans le namespace `fittrack:` et inclus dans la sauvegarde.
8. **Mobile d'abord.** Cibles tactiles d'au moins 48 px, panneau compact, thème sombre et clair,
   clavier, lecteur d'écran et réduction des animations pris en charge.
9. **Les skills frontend sont obligatoires.** Toute réalisation visuelle utilise brainstorming,
   Impeccable, frontend-design et une vérification dans le navigateur réel.

## 4. Architecture du tutoriel

### 4.1 Couche A — campagne débutant

La première ouverture propose une campagne courte. Ce n'est plus un diaporama des dix rubriques :
elle fait accomplir une tâche utile, puis se met en retrait.

Le parcours est découpé en deux actes :

- **Acte 1 — préparer** : créer « Séance découverte », ajouter Curl haltères, préparer deux séries,
  une cible de répétitions et un repos ;
- **Acte 2 — réaliser** : déclenché seulement quand cette routine est réellement démarrée, puis
  saisie, validation, repos, deuxième série, fin et sauvegarde.

L'orientation générale devient un écran d'introduction très court expliquant les quatre lieux :
Accueil, Planifier, Historique, Progression. Les explications détaillées appartiennent aux missions.

### 4.2 Couche B — chapitres contextuels

Le bouton `?` affiche des chapitres propres à la sous-route exacte. Une entrée peut être :

- une **mission d'action**, validée par un événement métier ;
- une **visite explicative**, avec navigation exacte et « Continuer » manuel ;
- une **mission gardée**, masquée si la donnée requise n'existe pas.

Les routes dynamiques utilisent des références persistées : `campaignRoutineId`,
`missionRoutineId`, `missionProgramId`. Le moteur n'invente jamais un identifiant.

### 4.3 Couche C — aide experte

Les opérations rares ou risquées restent à la demande : révision future d'un programme, réparation
d'un split, restauration JSON, recalcul des records, mise à jour d'instantanés et réinitialisation.
Une mission destructive s'arrête avant la confirmation irréversible.

## 5. HUD de mission

Le tutoriel reprend les tokens existants :

| Rôle            |    Sombre |     Clair |
| --------------- | --------: | --------: |
| Page            | `#12110f` | `#f7f8f6` |
| Panneau         | `#1b1916` | `#ffffff` |
| Surface relevée | `#25221e` | `#eef1ec` |
| Texte           | `#f5f3f0` | `#182019` |
| Accent          | `#ff8a3d` | `#166534` |

- Corps : police système FitTrack existante.
- Progression : utilitaire monospace `record-figure` existant.
- Signature : une ligne de mission accentuée relie visuellement le HUD à la cible.
- Hauteur cible : 112 à 152 px, jamais plus de 28 % de `100dvh`.
- Placement : en bas si la cible est dans la moitié haute, en haut dans le cas inverse.
- Une seule phrase principale ; le détail est replié par défaut, y compris en Silence.
- Le scrim ne bloque pas la cible ; le reste de l'écran peut rester non interactif pendant une
  étape strictement dirigée.
- Si la cible est absente, le HUD reste muet et affiche un état de chargement discret ; après un
  délai borné, il propose de réessayer ou quitter au lieu de parler devant le mauvais écran.
- Les animations utilisent les durées existantes et disparaissent avec
  `prefers-reduced-motion: reduce`.

## 6. Scénario campagne — Curl haltères

`Curl haltères` est l'exercice catalogue de slug `dumbbell-curl`, mesuré en `weight_reps` et marqué
bilatéral (`isUnilateral: 0`). Les répétitions sont donc effectuées avec les deux bras ensemble,
avec une seule validation par série.

| Étape | Écran / cible                | Consigne fonctionnelle                          | Réussite                         |
| ----- | ---------------------------- | ----------------------------------------------- | -------------------------------- |
| C01   | Invite initiale              | Commencer la découverte ou remettre à plus tard | Choix explicite                  |
| C02   | `/routines`, onglet Routines | Ouvrir la création                              | Feuille de création ouverte      |
| C03   | Action « Routine vide »      | Créer la routine                                | `routine-created`                |
| C04   | Nom de routine               | La nommer « Séance découverte »                 | Nom persistant non vide          |
| C05   | « Ajouter un exercice »      | Ouvrir le catalogue                             | Picker ouvert                    |
| C06   | Recherche                    | Rechercher « Curl haltères »                    | Requête correspondante           |
| C07   | Rangée `dumbbell-curl`       | Sélectionner le curl                            | Slug sélectionné                 |
| C08   | Barre « Ajouter »            | Ajouter l'exercice                              | Exercice présent dans la routine |
| C09   | « Ajouter une série »        | Ajouter une seconde série                       | Deux séries présentes            |
| C10   | Première série               | Définir une cible de répétitions                | Cible positive persistée         |
| C11   | Menu exercice / repos        | Définir un repos positif                        | Repos persistant                 |
| C12   | Éditeur prêt                 | Expliquer que tout est déjà enregistré          | « Terminer la préparation »      |
| C13   | Campagne suspendue           | Attendre le vrai démarrage de cette routine     | `workout-started` avec le bon ID |
| C14   | Première série en séance     | Saisir charge et répétitions                    | Valeurs recordables persistées   |
| C15   | Coche première série         | Valider                                         | Série complétée en base          |
| C16   | Repos                        | Lire, ajouter/retirer du temps ou terminer      | Repos ajusté ou terminé          |
| C17   | Deuxième série               | Saisir puis valider                             | Deuxième série complétée         |
| C18   | « Terminer »                 | Ouvrir le bilan                                 | Écran de fin ouvert              |
| C19   | « Enregistrer »              | Sauvegarder la séance                           | Workout terminé en base          |
| C20   | Bilan / accueil              | Expliquer historique et progression débloqués   | « Terminer la campagne »         |

Si l'utilisateur possède déjà des données, la campagne ne les écrase pas. Elle peut créer sa
routine découverte à côté des autres, ou être ignorée. Si `dumbbell-curl` a été supprimé du
catalogue local, l'étape explique comment le restaurer ou permet de choisir un autre curl sans
inventer une sélection.

## 7. Scénario détaillé — Programmes

Le chapitre s'appelle **Construire et suivre un programme**. Il est disponible depuis `/programs`
et ne se confond plus avec Routines.

| Étape | Écran / cible                  | Apprentissage                                                                          | Réussite                               |
| ----- | ------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------- |
| P01   | `/programs`, onglet Programmes | Une routine décrit une séance ; un programme organise plusieurs routines dans le temps | Continuer                              |
| P02   | `program-create`               | Ouvrir l'assistant                                                                     | `/programs/new` atteint                |
| P03   | Champ nom                      | Nommer le bloc                                                                         | Nom non vide                           |
| P04   | Date de départ                 | Choisir le premier jour                                                                | Date valide                            |
| P05   | Durée                          | Choisir le nombre de semaines                                                          | Durée valide                           |
| P06   | Barre « Continuer »            | Enregistrer le Cadre                                                                   | Brouillon créé, ID retenu              |
| P07   | Première séance du Split       | Choisir un jour                                                                        | Jour sélectionné                       |
| P08   | Routine du Split               | Choisir une routine ; proposer « Séance découverte » si elle existe                    | Routine valide sélectionnée            |
| P09   | « Ajouter une séance »         | Montrer comment ajouter un autre jour, sans l'imposer                                  | Continuer ou entrée ajoutée            |
| P10   | Barre « Continuer »            | Enregistrer le Split                                                                   | Révision contenant au moins une entrée |
| P11   | Recettes de semaines           | Appliquer une recette puis lire son arc                                                | Recette appliquée au brouillon         |
| P12   | Une semaine                    | Ouvrir et lire phase + niveau de charge                                                | Feuille de semaine ouverte             |
| P13   | « Activer le bloc »            | Enregistrer les semaines et activer                                                    | Programme actif                        |
| P14   | Fiche programme                | Lire semaine courante et intention                                                     | Continuer                              |
| P15   | Liste des séances              | Sélectionner la séance proposée                                                        | Entrée sélectionnée                    |
| P16   | Semaines à venir               | Comprendre la progression et la décharge                                               | Continuer                              |
| P17   | Menu `…`                       | Découvrir Modifier la suite, Décaler et Terminer                                       | Feuille d'actions ouverte              |
| P18   | Fin                            | Expliquer que « Démarrer » lance une vraie séance et arrêter avant de le faire         | Chapitre terminé                       |

La suppression n'est jamais exigée. Une visite experte séparée peut ouvrir sa confirmation, puis
s'arrête sans confirmer. Si aucune routine n'existe, l'étape Split cible « Nouvelle routine » et
reprend après la création explicite de cette routine.

## 8. Catalogue des autres chapitres

Le catalogue P1 existant est corrigé, puis les missions P2 de
`docs/product/FEATURE-INVENTORY.md` sont livrées par zone :

- **Séance :** ajouter série/exercice, type de série, RPE, plaques, échauffement, cadence,
  maintien, unilatéral, décharge et recommandation Coach.
- **Historique :** retrouver, filtrer, calendrier, corriger, partager, supprimer avec garde, import
  Hevy jusqu'à l'écran de revue.
- **Progression :** choisir l'analyse, la période et la métrique, lire la source, partager un
  graphique.
- **Exercices :** recherche, filtres, fiche, création personnalisée, type de mesure, unilatéral,
  documentation.
- **Connaissances :** rechercher une question, lire confiance/contradictions/limites et reprendre
  « Apprendre à programmer ».
- **Accueil :** suggestion, poids du jour, carte musculaire, rythme et objectif hebdomadaire.
- **Réglages :** annonces, Voix uniquement, écho, notifications Android, sauvegarde JSON, exports
  CSV et installation hors ligne.

Chaque sous-route possède sa propre liste d'aide ; aucune explication générique ne remplace les
missions spécifiques.

## 9. Persistance tutoriel v3

La clé devient `fittrack:tutorial:v3`. La migration v2 conserve l'orientation et les missions dont
l'identifiant existe encore, mais remet l'ancienne visite passive à « vue » sans prétendre que la
nouvelle campagne interactive est terminée.

```ts
interface TutorialStateV3 {
  version: 3;
  scriptVersion: 2;
  orientation: 'completed' | 'skipped' | null;
  campaign:
    'not-started' | 'preparing' | 'routine-ready' | 'workout-active' | 'completed' | 'dismissed';
  activeMissionId: TutorialMissionId | null;
  activeStepIndex: number;
  campaignRoutineId: string | null;
  missionRoutineId: string | null;
  missionProgramId: string | null;
  missions: Partial<Record<TutorialMissionId, 'completed' | 'dismissed'>>;
}
```

Un événement n'avance que l'étape qui attend son type **et**, lorsqu'il y en a un, son identifiant
de routine, programme, workout, ligne ou série.

## 10. Mode Voix uniquement

Les modes deviennent :

| Mode            | Voix |      Sons utiles | Cadence de répétitions | 3–2–1 dernières reps |
| --------------- | ---: | ---------------: | ---------------------: | -------------------: |
| Silence         |  non |              non |          oui, visuelle |          non audible |
| Sons            |  non |              oui |                    oui |            oui, sons |
| Sons + voix     |  oui |              oui |                    oui |                  oui |
| Voix uniquement |  oui | oui hors cadence |                **non** |              **non** |

« Tout ce qui ne concerne pas la cadence reste » : départ et fin de repos, 3–2–1 de repos,
changement de côté, maintien, dernière série, record, fin d'exercice, récapitulatif et fin de séance.

Le mode est une politique centrale, pas une collection de `if` dans les composants. Les cues de
répétition sont marqués `repCadence: true`; `planCue` les rend silencieux en Voix uniquement, y
compris s'ils avaient été planifiés avant un changement de mode. Le moteur de séance refuse aussi
d'armer ou relancer un `RepPacer` dans ce mode. Les chronos de maintien restent actifs.

## 11. Bilatéral et unilatéral

### 11.1 Bilatéral

Un exercice bilatéral, dont Curl haltères dans le catalogue actuel, garde le chemin existant : une
ligne, une saisie, une validation. L'application ne prétend pas suivre chaque bras.

### 11.2 Unilatéral

Sans cadence, FitTrack ne peut pas deviner où l'utilisateur en est. L'utilisateur devient donc la
source explicite :

1. la ligne affiche **Premier côté en cours** ;
2. le bouton devient **Premier côté terminé** ;
3. ce geste persiste `unilateralSecondSideStartsAt = now + 10_000`, sans compléter la série ;
4. l'application annonce une seule fois le changement et affiche le décompte de transition ;
5. après l'échéance, la ligne affiche **Second côté en cours** ;
6. le bouton devient **Terminer la série** ;
7. ce second geste complète la série, démarre le repos et efface l'état intermédiaire.

Les libellés Premier/Second sont retenus plutôt que Gauche/Droite : l'utilisateur choisit son côté
de départ. Le champ optionnel est écrit sur `WorkoutSet`, non indexé ; aucune nouvelle table ni
migration Dexie n'est requise. Il survit à un kill, à un rechargement et à une sauvegarde JSON.

Avec cadence, la fin du premier cycle peut envoyer le même événement de changement. Le bouton
manuel reste la sortie d'autorité. La machine des côtés ne dépend plus d'une horloge audio.

Les échauffements restent hors cycle unilatéral. Une série décochée revient au premier côté.

## 12. Double annonce du gainage

Le comportement attendu est :

- exactement un cue `side-change` au passage du premier au second côté ;
- aucune émission concurrente `rest-10` ou `pace-start-10` pendant cette transition ;
- une seule phrase « Changement de côté. Reprise dans dix secondes. » ;
- le 3–2–1 de transition reste présent ;
- aucune annonce de repos avant la validation du second côté.

Le correctif commence par une reproduction instrumentée. Si un seul cue est émis mais que le MP3
répète la phrase, l'artefact est marqué à régénérer lors de la phase voix ; le code ne masque pas un
fichier défectueux en supprimant une annonce légitime.

## 13. Tests et validation

- Tests purs : store v3, migrations, machine de mission, résolution des routes, politique audio,
  machine Premier/Second côté.
- Tests repository : persistance du premier côté, reprise après rechargement, nettoyage après
  validation/décochage, sauvegarde complète.
- Tests d'intégration : campagne sans donnée, pause avant vraie séance, reprise au démarrage,
  création/activation d'un programme, Voix uniquement, unilatéral manuel et gainage sans doublon.
- Tests navigateur : 390 × 844 sombre et clair, cible exacte, panneau opposé, clavier ouvert,
  rotation, réduction des animations, route fraîche sans données et route peuplée.
- Portes finales : `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`.

## 14. Hors périmètre

- Génération ou remplacement des MP3.
- Détection automatique des répétitions par capteur, caméra ou microphone.
- Deux lignes ou deux valeurs historiques séparées pour gauche et droite.
- Doublement du tonnage unilatéral.
- Création automatique d'une séance ou d'un programme pour faire avancer le tutoriel.
- Réorganisation générale du design FitTrack ou ajout d'une nouvelle police.

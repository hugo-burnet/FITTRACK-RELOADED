# Audit fonctionnel de Hevy — Cahier des charges (hors fonctionnalités sociales)

> Document de référence pour la conception d'une application de suivi de musculation.
> Toutes les fonctionnalités liées au réseau social (fil d'actualité, profils publics, abonnés, likes/commentaires, classements, partage Strava, découverte d'athlètes) ont été volontairement **exclues** de cet audit, conformément à la demande.

---

## 1. Objectif du document

Ce document recense de façon exhaustive les fonctionnalités de l'application **Hevy** (application de référence du marché pour le suivi d'entraînements de musculation), afin de servir de base à la rédaction d'un cahier des charges pour le développement d'une application équivalente ou concurrente. Chaque fonctionnalité est décrite avec son objectif, son comportement attendu et, quand c'est pertinent, les règles de gestion associées. Une section de recommandations et de corrections potentielles est ajoutée à la fin de chaque grand module, ainsi qu'une synthèse globale.

---

## 2. Vue d'ensemble des modules fonctionnels

| # | Module | Rôle |
|---|--------|------|
| M1 | Compte & authentification | Créer/gérer un compte utilisateur |
| M2 | Bibliothèque d'exercices | Référentiel des mouvements disponibles |
| M3 | Routines & programmes | Modèles de séances réutilisables |
| M4 | Séance en direct (logging) | Saisie des séries pendant l'entraînement |
| M5 | Outils d'aide à l'entraînement | Minuteur de repos, calculateur de plaques, RPE, échauffement |
| M6 | Historique & calendrier | Consultation des séances passées |
| M7 | Mesures corporelles & photos | Suivi du physique dans le temps |
| M8 | Statistiques & rapports | Analyse de la progression |
| M9 | Coaching automatisé / IA | Génération et adaptation de programmes |
| M10 | Paramètres de l'application | Personnalisation du comportement de l'app |
| M11 | Intégrations santé | Apple Health, Health Connect / Google Fit |
| M12 | Widgets & Live Activity | Affichage hors application |
| M13 | Multi-appareils | Montres connectées, synchronisation |
| M14 | Export / Import de données | Portabilité des données |

---

## 3. Détail des fonctionnalités par module

### M1 — Compte & authentification

- **RF-01** Création de compte (email/mot de passe, ou fournisseur tiers type Apple/Google Sign-In).
- **RF-02** Connexion multi-appareils avec synchronisation du même compte.
- **RF-03** Récupération de mot de passe.
- **RF-04** Suppression de compte et de toutes les données associées (droit à l'effacement RGPD).

**Corrections/recommandations :**
- Prévoir une exportation automatique proposée *avant* toute suppression de compte (peu d'apps le font bien).
- Authentification à deux facteurs en option, absente chez Hevy.

---

### M2 — Bibliothèque d'exercices

- **RF-06** Catalogue d'exercices préexistant (plusieurs centaines), avec pour chaque exercice : nom, groupe musculaire principal, groupes secondaires, équipement requis (barre, haltère, machine, poids du corps, élastique, câble...), type de mesure (poids/reps, temps, distance, poids de corps assisté, etc.), image ou démonstration animée.
- **RF-07** Recherche et filtrage par nom, groupe musculaire, équipement.
- **RF-08** Création d'exercices personnalisés par l'utilisateur (nom, groupe musculaire, équipement, type de mesure).
- **RF-09** Notes personnalisées attachées à un exercice (ex. réglages de machine, position de banc).
- **RF-10** Historique par exercice : dernière performance, meilleure performance (record personnel).

**Corrections/recommandations :**
- Chez Hevy, le nombre d'exercices personnalisés est limité en version gratuite (7) pour inciter à l'abonnement. Dans un usage personnel sans modèle payant, ce champ doit rester illimité.
- Ajouter un champ « exercice unilatéral » explicite (gauche/droite) — actuellement géré de façon peu claire par beaucoup d'apps du secteur.
- Prévoir une validation/modération légère pour les exercices personnalisés partagés (si une fonctionnalité de partage de routines est réintroduite plus tard).

---

### M3 — Routines & programmes

- **RF-11** Création de routines (modèles de séance) : liste ordonnée d'exercices, nombre de séries prévues, répétitions cibles, poids cible, temps de repos par exercice.
- **RF-12** Organisation des routines en dossiers/catégories.
- **RF-13** Duplication, réorganisation (glisser-déposer), édition, suppression d'une routine.
- **RF-14** Supersets, tri-sets, circuits (regroupement de plusieurs exercices sans repos entre eux).
- **RF-15** Bibliothèque de routines prêtes à l'emploi (programmes standards type push/pull/legs, 5x5, etc.) fournie par l'éditeur.
- **RF-16** Génération automatique de programme par IA/algorithme à partir d'un questionnaire (objectif, niveau, jours disponibles, matériel) — cf. M9.

**Corrections/recommandations :**
- Hevy ne propose pas de véritable **périodisation multi-semaines** (mésocycles, semaines de décharge planifiées à l'avance) en dehors de son moteur d'auto-progression — un vrai plan de programmation (bloc de 4 à 12 semaines avec variation de charge planifiée) serait une valeur ajoutée forte pour un produit concurrent.
- Hevy limite à 4 routines en version gratuite pour pousser à l'abonnement ; pour un usage personnel, aucune limite de nombre de routines n'est nécessaire.
- Ajouter la possibilité de dupliquer une routine dans une nouvelle version « versionnée » pour suivre son évolution dans le temps sans perdre l'historique de la version précédente.

---

### M4 — Séance en direct (logging)

- **RF-17** Démarrage d'une séance vide (sans routine) ou à partir d'une routine existante.
- **RF-18** Saisie série par série : poids, répétitions, RPE/RIR optionnel, coché comme « terminé ».
- **RF-19** Affichage de la « valeur précédente » (dernier poids/reps réalisés sur cet exercice) pour guider la surcharge progressive.
- **RF-20** Types de séries : normale, échauffement, dégressive (drop set), échec, superset.
- **RF-21** Ajout/suppression de séries en cours de séance.
- **RF-22** Minuteur de repos automatique déclenché à la validation d'une série (voir M5).
- **RF-23** Notification en direct de record personnel battu pendant la séance.
- **RF-24** Sauvegarde de la séance en fin d'entraînement (durée totale, date, notes générales).
- **RF-25** Reprise d'une séance interrompue (fermeture de l'app, appel téléphonique, etc.) sans perte de données.
- **RF-26** Affichage en « Live Activity »/écran verrouillé (iOS) ou notification persistante (Android) de l'état de la séance en cours.

**Corrections/recommandations :**
- Ajouter une saisie vocale des séries (mains occupées par la barre) — fonctionnalité absente chez Hevy et fortement demandée par les utilisateurs.
- Fiabiliser la reprise de séance en mode hors-ligne strict (voir M14/offline) : c'est un point de friction récurrent dans les retours utilisateurs des apps du secteur en cas de coupure réseau prolongée.
- Permettre la réorganisation des exercices *pendant* la séance (pas seulement dans l'édition de routine).

---

### M5 — Outils d'aide à l'entraînement

- **RF-27** Minuteur de repos automatique, réglable de quelques secondes à plusieurs minutes, spécifique par exercice, avec notification sonore/vibration en fin de repos.
- **RF-28** Calculateur de plaques (barre olympique standard configurable), à partir du poids total à charger.
- **RF-29** Calculateur de poids d'échauffement (répartition automatique des séries d'approche avant la charge de travail).
- **RF-30** Échelle RPE (perception de l'effort) et/ou RIR (répétitions en réserve) associée à chaque série.
- **RF-31** Réglages globaux : unité de poids (kg/lb), incrément de plaque disponible en salle, poids de la barre par défaut.

**Corrections/recommandations :**
- Le calculateur de plaques de Hevy ne fonctionne qu'avec des barres — l'étendre aux haltères chargeables et aux machines à charge sélective (leviers, poids empilés) serait une amélioration notable.
- Chez Hevy, le calculateur d'échauffement est réservé à l'abonnement payant ; dans une app personnelle sans restriction, il doit être disponible directement, car c'est un outil de sécurité/qualité d'exécution, pas un luxe.
- Ajouter un réglage « décharge automatique » suggérée après X semaines consécutives de progression, en lien avec M9.

---

### M6 — Historique & calendrier

- **RF-32** Vue calendrier des séances passées (jours d'entraînement marqués).
- **RF-33** Détail d'une séance archivée : exercices, séries, poids, répétitions, durée, notes.
- **RF-34** Suivi de la régularité (série de jours/semaines consécutifs d'entraînement, « streak »).
- **RF-35** Modification a posteriori d'une séance déjà enregistrée (correction d'une erreur de saisie).
- **RF-36** Suppression d'une séance.

**Corrections/recommandations :**
- La version gratuite de Hevy limite l'historique consultable à 3 mois glissants pour pousser à l'abonnement ; pour un usage personnel, l'historique complet doit être conservé et consultable sans limite de durée.
- Ajouter un filtre par exercice dans l'historique (« toutes les séances où j'ai fait du développé couché ») indépendamment des graphiques de progression.

---

### M7 — Mesures corporelles & photos de progression

- **RF-37** Saisie de mesures corporelles : poids de corps, pourcentage de masse grasse, tour de taille/bras/cuisses/poitrine, et champs personnalisables.
- **RF-38** Historique graphique de chaque mesure dans le temps.
- **RF-39** Photos de progression datées, organisées par ordre chronologique, comparaison côte à côte.
- **RF-40** Synchronisation de la masse corporelle (et éventuellement masse maigre) avec les apps santé du système d'exploitation (voir M11).

**Corrections/recommandations :**
- Stocker les photos de progression avec un chiffrement local/à la source, et permettre un verrouillage par biométrie de cette section spécifique (données sensibles) — non garanti explicitement chez Hevy.
- Permettre l'ajout de mesures rétroactives avec une date antérieure (utile en cas de migration depuis un autre outil).

---

### M8 — Statistiques & rapports

- **RF-41** Graphique de progression par exercice (charge, volume, répétitions, estimation de 1RM dans le temps).
- **RF-42** Volume total d'entraînement (par séance, semaine, mois) et répartition par groupe musculaire.
- **RF-43** Carte de chaleur / répartition du nombre de séries effectuées par groupe musculaire sur une période donnée (pour repérer les déséquilibres).
- **RF-44** Rapport mensuel automatique (résumé d'activité).
- **RF-45** Rétrospective annuelle (« bilan de l'année »).
- **RF-46** Estimation de la force maximale théorique (1RM) par formule reconnue (Epley, Brzycki, etc.), configurable.

**Corrections/recommandations :**
- Ajouter un indicateur de fatigue/charge d'entraînement cumulée (ex. ratio charge aiguë/chronique) pour aider à prévenir le surentraînement — actuellement absent de l'offre Hevy.
- Permettre l'export des graphiques en image pour un usage personnel (suivi coach non intégré à l'app) sans passer par une capture d'écran.

---

### M9 — Coaching automatisé / IA

- **RF-47** Génération d'un programme complet à partir d'un onboarding (objectif, expérience, jours disponibles par semaine, matériel accessible).
- **RF-48** Ajustement automatique des charges de travail après chaque séance selon la performance réelle : si la fourchette de répétitions haute est atteinte sur toutes les séries de travail, la charge suivante augmente ; sinon elle est maintenue ou diminuée.
- **RF-49** Assistant conversationnel pour répondre à des questions sur l'entraînement, ajuster une séance, ou obtenir des explications sur un exercice.

**Corrections/recommandations :**
- L'algorithme d'auto-progression de Hevy est une « boîte noire » pour l'utilisateur : exposer les règles de décision (pourquoi la charge a monté/baissé) renforcerait la confiance et la valeur pédagogique.
- Prévoir un mode « supervision humaine » où un coach (si le produit propose un volet coaching professionnel) peut valider ou modifier les ajustements automatiques avant qu'ils s'appliquent.
- Le risque principal d'un tel module est la sur-confiance dans l'IA pour des utilisateurs débutants sans encadrement : prévoir des garde-fous (alertes en cas de progression irréaliste, rappel de forme d'exécution).

---

### M10 — Paramètres de l'application

- **RF-50** Unités de mesure (poids, distance, taille) configurables individuellement.
- **RF-51** Thème clair/sombre, choix de la police/taille d'affichage.
- **RF-52** Langue de l'interface (multilingue).
- **RF-53** Notifications (rappels d'entraînement, fin de repos, records battus) activables/désactivables individuellement.
- **RF-54** Réglages spécifiques d'entraînement (comportement du minuteur, affichage RPE par défaut, incréments de poids proposés, etc.) — recensés chez Hevy comme un ensemble d'une douzaine de réglages dédiés à l'expérience de séance.
- **RF-55** Gestion de la confidentialité des données (visibilité, si des fonctionnalités sociales existent par ailleurs — hors périmètre ici).

**Corrections/recommandations :**
- Centraliser les réglages d'entraînement (M10.RF-54) dans un seul écran clairement identifié : chez Hevy ils sont dispersés et peu découvrables pour un nouvel utilisateur.
- Ajouter un mode « accessibilité » dédié : contraste renforcé, cibles tactiles agrandies, compatibilité lecteur d'écran complète (VoiceOver/TalkBack), non garantie de façon homogène aujourd'hui.

---

### M11 — Intégrations santé

- **RF-56** Synchronisation bidirectionnelle avec Apple Health (séances d'entraînement, poids de corps, masse maigre).
- **RF-57** Intégration avec Health Connect sur Android, servant de passerelle vers Google Fit et d'autres apps santé (Google a retiré la connexion directe à Google Fit ; le passage par Health Connect est désormais obligatoire).
- **RF-58** Synchronisation de la fréquence cardiaque pendant la séance (si capteur disponible, notamment via montre connectée).

**Corrections/recommandations :**
- Documenter clairement dans l'app, pour l'utilisateur Android, que la connexion « directe » à Google Fit n'existe plus et que Health Connect est requis (source de confusion actuelle chez plusieurs utilisateurs Hevy).
- Ajouter la calorie estimée dépensée par séance en synchronisation vers les apps santé, actuellement absente ou peu mise en avant.

---

### M12 — Widgets & Live Activity

- **RF-59** Widget d'écran d'accueil (iOS/Android) affichant un résumé (prochaine séance prévue, statistiques rapides).
- **RF-60** Live Activity / notification enrichie pendant une séance en cours : exercice courant, séries réalisées, poids et répétitions prescrits.
- **RF-61** Complications pour cadran de montre connectée.

**Corrections/recommandations :**
- Proposer plusieurs formats de widgets (petit/moyen/grand) avec un contenu personnalisable par l'utilisateur (ex. choix entre « streak », « prochain PR possible », « prochaine séance »).

---

### M13 — Multi-appareils / montres connectées

- **RF-62** Application compagnon sur montre connectée (Apple Watch confirmé ; support Android/Wear OS à vérifier au moment du développement, car en évolution constante) permettant de lancer une routine et saisir les séries directement au poignet.
- **RF-63** Synchronisation en direct entre la montre et le téléphone pendant la séance.
- **RF-64** Suivi de la fréquence cardiaque pendant l'entraînement via la montre.
- **RF-65** Accès à l'assistant/génération de programme automatique directement depuis la montre.

**Corrections/recommandations :**
- Garantir un fonctionnement autonome de l'app montre sans dépendance stricte à la présence du téléphone à proximité (rupture Bluetooth fréquente en salle de sport bondée) — point de friction connu sur ce type de produit.

---

### M14 — Export / Import de données

- **RF-66** Export des données d'entraînement (format CSV a minima).
- **RF-67** Import de données depuis un autre outil de suivi (migration facilitée).
- **RF-68** Sauvegarde cloud automatique liée au compte utilisateur.
- **RF-69** Fonctionnement hors-ligne avec mise en file d'attente des séances et synchronisation dès reconnexion réseau.

**Corrections/recommandations :**
- Proposer un export au format structuré (JSON) en plus du CSV, pour une portabilité réelle des données (interopérabilité, sauvegarde personnelle, scripts d'analyse).
- Fiabiliser la résolution de conflits de synchronisation lors d'une saisie effectuée sur deux appareils différents pendant une coupure réseau (règle claire : dernière séance modifiée fait foi, avec historique de version en cas de conflit détecté).

---

## 4. Synthèse des recommandations transverses

1. **Aucune limite artificielle** : usage personnel sans modèle payant, donc pas de restriction sur le nombre de routines, la durée de l'historique ou le nombre d'exercices personnalisés — tout doit être illimité par défaut.
2. **Transparence de l'algorithme d'auto-progression** : expliciter les règles de décision de l'IA de coaching pour ne pas créer une dépendance aveugle chez l'utilisateur.
3. **Accessibilité** : lecteur d'écran, contraste, cibles tactiles, saisie vocale des séries — actuellement un point faible du secteur dans son ensemble.
4. **Robustesse hors-ligne** : reprise de séance et synchronisation fiables en cas de coupure réseau ou Bluetooth (salle de sport = environnement réseau dégradé fréquent).
5. **Portabilité des données** : export structuré (JSON), pas seulement CSV ; procédure claire de suppression de compte avec proposition d'export préalable.
6. **Calculateur de plaques/charges élargi** : au-delà de la barre olympique, couvrir haltères chargeables et machines à charge sélective.
7. **Programmation réelle par blocs** (périodisation) en plus de l'auto-progression séance par séance, absente aujourd'hui.
8. **Sécurité des données sensibles** : verrouillage biométrique dédié pour les photos de progression et mesures corporelles.

---

## 5. Proposition de modèle de données (pour l'implémentation)

Entités principales à prévoir dès la conception de la base de données :

- **User** (id, email, unités préférées, langue, date de création)
- **Exercise** (id, nom, groupe musculaire principal, groupes secondaires, équipement, type de mesure, source : catalogue global ou personnalisé, propriétaire si personnalisé)
- **Routine** (id, user_id, nom, dossier/catégorie, ordre, date de création, date de dernière modification)
- **RoutineExercise** (id, routine_id, exercise_id, ordre, nombre de séries cibles, repos cible, notes)
- **Workout** (id, user_id, routine_id d'origine (nullable), date de début, date de fin, durée, notes générales)
- **WorkoutExercise** (id, workout_id, exercise_id, ordre)
- **WorkoutSet** (id, workout_exercise_id, type de série [normale/échauffement/dégressive/échec], poids, répétitions, RPE/RIR, temps de repos réel, statut terminé)
- **BodyMeasurement** (id, user_id, type de mesure, valeur, unité, date)
- **ProgressPhoto** (id, user_id, url/chemin chiffré, date)
- **PersonalRecord** (id, user_id, exercise_id, type de record [poids max, volume max, 1RM estimé...], valeur, date d'obtention)
- **UserSettings** (id, user_id, clé, valeur) — pour les réglages listés en M10

---

## 6. Priorisation suggérée

| Priorité | Modules concernés |
|---|---|
| **MVP (V1)** | M1, M2, M3 (routines simples), M4, M5 (minuteur + calculateur de plaques), M6, M10 (réglages de base), M14 (sauvegarde cloud + hors-ligne basique) |
| **V2** | M7, M8 (statistiques principales), M11, M12 |
| **V3** | M9 (coaching automatisé / IA), M13 (montres connectées), statistiques avancées de M8 (carte de chaleur, charge cumulée), export JSON avancé de M14 |

---

*Document rédigé à partir d'une analyse des fonctionnalités publiques de l'application Hevy (site officiel, centre d'aide, stores applicatifs) — juillet 2026. Toute fonctionnalité à caractère social a été délibérément omise du périmètre.*

# FitTrack — Feuille de route de développement

> **Pour l'agent de dev :** ne jamais attaquer un lot sans avoir lu `docs/plans/01-ARCHITECTURE.md`
> et la section du lot ci-dessous. Un lot = une session. À la fin d'un lot, mettre à jour
> `PROGRESS.md` et s'arrêter pour le checkpoint utilisateur.

**Objectif :** une application personnelle de suivi de musculation, utilisable hors-ligne en salle,
d'abord comme site web installable (GitHub Pages), puis comme application Android.

**Stratégie :** local-first. On construit une app complète qui n'a jamais besoin de réseau, puis on
l'empaquette. La synchronisation cloud est une couche optionnelle ajoutée tard, sur un schéma déjà
prévu pour elle.

---

## 1. Comment travailler avec ce plan

### Le principe

Le projet est découpé en **21 lots**. Chaque lot est conçu pour tenir dans **une à trois sessions**
de Claude Code, et se termine par un **checkpoint que tu vérifies toi-même**, pas l'agent. Tant
qu'un checkpoint n'est pas validé, on ne passe pas au lot suivant.

Un lot livre toujours quelque chose de **visible et utilisable**. Il n'y a pas de lot « plomberie
invisible » — même le Lot 0 se termine par une URL en ligne. C'est ce qui permet d'arrêter le
projet à n'importe quel moment sans se retrouver avec un chantier inutilisable.

### Le rituel de session

**Au début de chaque session**, ouvre Claude Code dans le dossier du projet et écris :

```
Lis CLAUDE.md, PROGRESS.md et docs/plans/00-ROADMAP.md.
On attaque le Lot N. Détaille-moi le plan de ce lot tâche par tâche
(fichiers exacts, tests, commits), puis exécute-le.
```

Pour les lots 0 à 2, le plan détaillé existe déjà : dis simplement
`Exécute docs/plans/lot-00-bootstrap.md`.

Pour les lots suivants, l'agent génère le plan détaillé au début de la session. **C'est
volontaire** : écrire aujourd'hui les 400 étapes du Lot 17 produirait un document périmé avant
d'être lu — le code réel aura divergé. Le cadrage (périmètre, fichiers, DoD, checkpoint) est
figé ici ; le détail est produit au dernier moment, à partir du code qui existe vraiment.

**À la fin de chaque session**, l'agent doit avoir :
1. fait passer `npm run typecheck && npm run test:run && npm run build`,
2. commité,
3. mis à jour `PROGRESS.md`,
4. annoncé le checkpoint à vérifier.

### Si une session est coupée en plein lot

C'est normal et prévu. `PROGRESS.md` sert exactement à ça. La session suivante démarre par :

```
Lis CLAUDE.md et PROGRESS.md. Reprends là où on s'est arrêté.
```

### Conseils d'économie de contexte

- Un lot par session. Ne pas enchaîner deux lots dans la même session, même si ça semble tenir :
  la qualité chute nettement en fin de contexte.
- Ne jamais demander à l'agent de relire tout le cahier des charges : les `RF-xx` pertinents sont
  déjà recopiés dans chaque lot.
- Si l'agent part dans une mauvaise direction, l'arrêter tôt. Le laisser finir puis corriger coûte
  beaucoup plus cher que redémarrer.

---

## 2. Vue d'ensemble

| Phase | Lots | Résultat |
|---|---|---|
| **Phase 0 — Fondations** | 0 → 2 | Un site déployé, une charte visuelle, une base de données. |
| **Phase 1 — MVP (V1)** | 3 → 9 | **App utilisable en salle**, installable sur le téléphone. |
| **Phase 2 — Android** | 10 | **APK installé**, minuteur fiable écran éteint. |
| **Phase 3 — V2** | 11 → 16 | Mesures, statistiques, sync, santé. |
| **Phase 4 — V3** | 17 → 20 | Périodisation, auto-progression, IA, accessibilité. |

Budget indicatif : **~30 à 38 sessions** au total, dont **~14 pour arriver au V1 utilisable**
(fin du Lot 9) et **~16 pour l'APK Android** (fin du Lot 10).

Les deux moments où le projet devient réellement utile :
- **Fin du Lot 9** → tu peux logger tes séances sur ton téléphone.
- **Fin du Lot 10** → c'est une vraie app Android, sans navigateur.

Tout ce qui suit le Lot 10 est du confort. Si tu t'arrêtes là, tu as déjà un produit complet.

---

# PHASE 0 — FONDATIONS

## Lot 0 — Bootstrap & déploiement continu

**Objectif :** un dépôt GitHub, un projet Vite qui compile, et un déploiement automatique sur
GitHub Pages à chaque push. Déployer **avant** d'écrire des fonctionnalités : si la chaîne de
livraison casse, autant le découvrir sur un « Hello » que sur 5 000 lignes.

**RF couverts :** aucun (infrastructure).
**Dépend de :** rien.
**Plan détaillé :** `docs/plans/lot-00-bootstrap.md`
**Budget :** 1 session.

**Livrables :** Vite + React + TS strict, Tailwind v4, Vitest, ESLint/Prettier, workflow GitHub
Actions de déploiement, `base` Vite configurée sur le nom du dépôt.

**Definition of Done :**
- `npm run build` passe, `npm run test:run` passe (1 test de fumée).
- Un push sur `master` déclenche le workflow et met le site à jour.

**✅ Checkpoint :**
- [ ] `https://<ton-pseudo>.github.io/fittrack/` s'ouvre **depuis ton téléphone** et affiche
      l'écran d'accueil.
- [ ] Tu modifies un texte, tu pushes, et le changement est visible en ligne 2 minutes plus tard.

---

## Lot 1 — Design system & coquille de l'application

**Objectif :** la charte visuelle et la navigation. Tous les écrans suivants s'appuient dessus ;
la refaire au Lot 8 coûterait dix fois plus cher.

**RF couverts :** RF-51 (thème clair/sombre), base de RF-52, base du mode accessibilité.
**Dépend de :** Lot 0.
**Plan détaillé :** `docs/plans/lot-01-design-system.md`
**Budget :** 1 à 2 sessions.

**Livrables :** jetons de couleur/typo/espacement en CSS custom properties, thème sombre par
défaut avec bascule clair, primitives `ui/` (Button, Input, NumberInput, Sheet, Dialog, Tabs,
EmptyState, ListRow), barre de navigation basse à 5 onglets, routeur hash avec 5 écrans vides,
`src/i18n/fr.ts`.

**Contraintes de conception :**
- Thème **sombre par défaut** (salle de sport, écran lumineux la nuit).
- Cibles tactiles **≥ 48 px**. Les boutons de l'écran de séance seront utilisés avec les mains
  moites, une seule main, sans regarder.
- Le `NumberInput` (poids/reps) est le composant le plus utilisé de l'app : gros pas
  d'incrément/décrément tactiles, clavier numérique natif, pas de spinner minuscule.
- Zone de pouce : les actions primaires en bas d'écran, jamais en haut.

**✅ Checkpoint :**
- [ ] Sur ton téléphone, tu navigues entre les 5 onglets, l'app **ressemble à une app** (pas à
      une page web) : pas de zoom au double-tap, pas de barre d'adresse qui saute, transitions nettes.
- [ ] La bascule clair/sombre fonctionne et est mémorisée après rechargement.

---

## Lot 2 — Couche de données

**Objectif :** la base IndexedDB, les repositories, et le catalogue d'exercices. C'est le contrat
que tous les lots suivants consomment.

**RF couverts :** RF-06 (catalogue), socle de tout le reste.
**Dépend de :** Lot 0.
**Plan détaillé :** `docs/plans/lot-02-data-layer.md`
**Budget :** 2 sessions.

**Livrables :** `db.ts` (schéma §4.3 de l'architecture), `types.ts`, repositories CRUD avec soft
delete, seed idempotent d'un catalogue d'exercices, tests unitaires sur `fake-indexeddb`, écran
de debug listant le contenu des tables.

**Point d'attention — le catalogue d'exercices :** deux options.
1. Réutiliser un jeu de données libre (p. ex. `yuhonas/free-exercise-db`, ~800 exercices avec
   images). **Vérifier la licence avant de l'intégrer** et consigner le résultat dans `PROGRESS.md`.
2. Repli : générer ~150 exercices couvrant tous les groupes musculaires et tous les équipements.

150 exercices bien choisis suffisent largement pour un usage personnel — ne pas bloquer le lot
sur la quête du catalogue parfait, l'utilisateur peut créer les siens (RF-08).

**✅ Checkpoint :**
- [ ] `npm run test:run` : les tests de repositories passent (création, lecture, soft delete,
      « la dernière performance sur cet exercice »).
- [ ] Sur l'écran de debug, tu vois la liste des exercices chargés.
- [ ] Tu fermes complètement l'onglet, tu le rouvres : les données sont toujours là.

---

# PHASE 1 — MVP UTILISABLE EN SALLE (V1)

## Lot 3 — Bibliothèque d'exercices (M2)

**Objectif :** consulter, chercher et créer des exercices.

**RF couverts :** RF-06, RF-07 (recherche/filtres), RF-08 (exercices personnalisés, **illimités**),
RF-09 (notes), RF-10 (historique et record par exercice).
**Dépend de :** Lots 1, 2.
**Budget :** 1 à 2 sessions.

**Livrables :**
- Liste virtualisée avec recherche instantanée (insensible aux accents : « developpe » doit
  trouver « Développé »).
- Filtres par groupe musculaire et par équipement.
- Fiche exercice : historique, records, notes personnelles, repos par défaut.
- Création/édition d'exercice personnalisé, avec le champ **unilatéral** (recommandation audit M2).

**✅ Checkpoint :**
- [ ] Tu cherches « squat », tu trouves. Tu filtres sur « haltères », la liste se réduit.
- [ ] Tu crées un exercice à toi, il apparaît dans la liste et survit à un rechargement.
- [ ] Tu écris une note sur une machine (« siège position 4 »), tu la retrouves.

---

## Lot 4 — Routines (M3)

**Objectif :** composer des modèles de séance réutilisables.

**RF couverts :** RF-11 (création), RF-12 (dossiers), RF-13 (duplication/réorganisation/édition/
suppression), RF-14 (supersets), RF-15 (routines prêtes à l'emploi).
**Dépend de :** Lot 3.
**Budget :** 2 sessions.

**Livrables :**
- Éditeur de routine : ajout d'exercices via un sélecteur, séries prévues (avec fourchette de
  reps et poids cible), repos par exercice, notes.
- Réorganisation par glisser-déposer — utiliser l'API HTML5 native ou `dnd-kit` ; **tester au
  doigt sur téléphone**, le drag tactile est le piège classique.
- Dossiers, duplication, suppression.
- Supersets via `supersetGroup`.
- 3 à 4 routines prêtes à l'emploi (Push/Pull/Legs, Full-body 3j, 5×5).

**✅ Checkpoint :**
- [ ] Tu crées ta vraie routine de séance, avec tes exercices, tes séries et tes charges cibles.
- [ ] Tu réordonnes les exercices **au doigt sur ton téléphone**, ça marche sans frustration.
- [ ] Tu dupliques une routine et tu la modifies sans altérer l'originale.

---

## Lot 5 — Séance en direct, cœur (M4)

**Objectif :** l'écran le plus important de l'application. Celui que tu regarderas 60 fois par
séance, entre deux séries, essoufflé.

**RF couverts :** RF-17 (séance vide ou depuis routine), RF-18 (saisie série par série), RF-19
(valeur précédente), RF-21 (ajout/suppression de séries), RF-24 (sauvegarde), RF-25 (reprise
après interruption).
**Dépend de :** Lot 4.
**Budget :** 3 sessions. **C'est le lot le plus lourd du projet.**

**Livrables :**
- Démarrage d'une séance vide ou depuis une routine.
- Grille de saisie : une ligne par série (n°, précédent, kg, reps, ✓).
- Affichage de la valeur précédente en gris clair, **tapable pour pré-remplir** — le geste le plus
  utilisé de l'app.
- Chronomètre de séance, ajout/suppression de séries et d'exercices en cours de route,
  réorganisation pendant la séance (recommandation audit M4).
- **Persistance immédiate** : chaque case validée écrit en base.
- Reprise automatique : au démarrage, si une séance `status: 'active'` existe, proposer de la
  reprendre.
- Écran de fin : durée, volume total, séries effectuées, notes, enregistrer / abandonner.

**Attention particulière :** ce lot doit être testé en conditions réelles avant de continuer.
Une saisie de série doit demander **au maximum 2 appuis** quand les valeurs sont identiques à la
fois précédente.

**✅ Checkpoint (le plus important du projet) :**
- [ ] **Tu fais une vraie séance complète en salle avec l'app.**
- [ ] En pleine séance : tu tues l'app depuis le gestionnaire de tâches, tu la rouvres → la séance
      reprend exactement où elle en était, aucune série perdue.
- [ ] Tu actives le mode avion pendant toute la séance → aucune différence.
- [ ] Tu peux saisir une série sans lunettes, d'une main, en 3 secondes.

---

## Lot 5bis — Schéma musculaire (la moitié manquante de RF-06)

> **Pourquoi « 5bis » et pas une renumérotation :** décaler les Lots 6 à 20 d'un cran invaliderait
> chaque référence croisée de `PROGRESS.md`, des plans détaillés et des messages de commit déjà
> écrits. Un numéro laid coûte moins cher qu'une renumérotation.

**Objectif :** montrer quel muscle travaille un exercice, sans dépendre du réseau ni d'un jeu
d'images tiers.

**Origine :** RF-06 demande « image ou démonstration animée » pour chaque exercice. Le Lot 2 a
écarté `free-exercise-db` pour deux bonnes raisons (noms anglais, images en URL distante,
incompatibles avec la règle non négociable n°2) — mais **la conséquence, l'abandon de la partie
visuelle de RF-06, n'avait jamais été consignée**, et le tableau de couverture annonçait M2 comme
complet. Ce lot répare la moitié qui est à notre portée.

**RF couverts :** complète RF-06, prépare RF-43 (carte de chaleur, Lot 12).
**Dépend de :** Lot 3 (la fiche exercice existe) et Lot 5 (pas de finition avant de savoir logger).
**Budget :** 1 session.

**Livrables :**
- `ui/BodyMap.tsx` : silhouette de face et de dos en SVG. **La géométrie est reprise d'une source
  sous licence permissive, pas dessinée à la main** — une anatomie crédible ne s'improvise pas, et
  un tracé maladroit se voit immédiatement. Candidats vérifiés à l'API GitHub le 2026-07-22 :
  [`vulovix/body-muscles`](https://github.com/vulovix/body-muscles) (**Apache-2.0**, SVG,
  70+ régions, **zéro dépendance** — donc compatible avec le §8 qui exclut les composants tiers,
  puisqu'on reprend la géométrie et non le composant) et
  [`soroojshehryar/react-muscle-highlighter`](https://github.com/soroojshehryar/react-muscle-highlighter)
  (**MIT**). Dans les deux cas : ré-indexer les régions sur nos `MuscleGroup`, restyler avec nos
  jetons, **et porter la mention d'attribution** qu'Apache-2.0 exige.
- Coloration pilotée par une seule prop `highlight: Partial<Record<MuscleGroup, number>>` (0 à 1).
  La fiche exercice passe `1` pour le muscle principal et `0,4` pour les secondaires ; le Lot 12
  passera un volume normalisé. **Un composant, deux usages** — c'est ce qui rend ce lot rentable.
- Intégration sur la fiche exercice, sous la ligne d'identité.

**Ce qui n'est PAS dans ce lot — l'illustration animée du mouvement.** Ce n'est pas un problème de
développement, c'est un problème de **licence** : cf. la section « hors périmètre » ci-dessous.

**Point de vigilance :** les 18 valeurs de `MUSCLE_GROUPS` ne se dessinent pas toutes — `cardio`,
`full_body` et `other` n'ont pas de région anatomique. Le type doit rendre ce cas **explicite**
plutôt que de laisser trois groupes silencieusement invisibles sur le dessin. C'est exactement le
piège du champ indexé à `null` du Lot 2, transposé au graphisme : ça existe, mais rien ne le montre.

**✅ Checkpoint :**
- [ ] Tu ouvres « Développé couché » : les pectoraux sont allumés, les triceps et les épaules en
      second, et ça correspond à ce que tu sens le lendemain.
- [ ] Tu ouvres un exercice de cardio : l'app n'affiche pas une silhouette vide et muette.

---

## Lot 6 — Outils de séance (M5 + fin du M4)

**Objectif :** tout ce qui rend la séance efficace et sûre.

**RF couverts :** RF-20 (types de séries : échauffement, dégressive, échec), RF-22 + RF-27
(minuteur de repos), RF-23 (record battu en direct), RF-28 (calculateur de plaques), RF-29
(calculateur d'échauffement), RF-30 (RPE/RIR), RF-31 (réglages de charge).
**Dépend de :** Lot 5.
**Budget :** 2 sessions.

**Livrables :**
- **Minuteur de repos** : déclenché à la validation d'une série, durée par exercice, son + vibration,
  ajustement ±15 s, visible en haut de l'écran de séance. ⚠️ En PWA il ne sonnera pas de façon
  fiable écran éteint — c'est attendu, le Lot 10 le corrige.
- **Calculateur de plaques** (`lib/plates.ts`, TDD) : élargi aux haltères chargeables et aux
  machines, pas seulement à la barre olympique (recommandation audit M5). Barre et plaques
  disponibles configurables.
- **Calculateur d'échauffement** (`lib/warmup.ts`, TDD) : répartition des séries d'approche.
  Gratuit et accessible, c'est un outil de sécurité (recommandation audit M5).
- **RPE/RIR** optionnel, masquable.
- **Détection de record en direct** avec animation de félicitation.
- Types de séries : normale, échauffement (exclue du volume et des records), dégressive, échec.

**✅ Checkpoint :**
- [ ] Tu valides une série → le minuteur démarre seul et sonne à la fin (app au premier plan).
- [ ] Tu tapes « 102,5 kg » → l'app affiche les plaques à mettre de chaque côté.
- [ ] Tu bats un record → l'app te le dit **pendant** la séance.
- [ ] Les séries d'échauffement ne polluent ni le volume ni les records.

---

## Lot 7 — Historique & calendrier (M6)

**Objectif :** consulter et corriger le passé. Sans limite de durée (recommandation transverse n°1).

**RF couverts :** RF-32 (calendrier), RF-33 (détail d'une séance), RF-34 (régularité/streak),
RF-35 (modification a posteriori), RF-36 (suppression).
**Dépend de :** Lot 5.
**Budget :** 1 à 2 sessions.

**Livrables :** liste chronologique paginée, vue calendrier mensuelle avec jours d'entraînement
marqués, détail d'une séance archivée, édition rétroactive (réutiliser l'éditeur du Lot 5),
suppression avec confirmation, streak, **filtre par exercice** (« toutes mes séances de développé
couché » — recommandation audit M6).

**Règle importante :** modifier une séance passée doit **recalculer les records** concernés.

**✅ Checkpoint :**
- [ ] Tes séances réelles apparaissent dans le calendrier.
- [ ] Tu corriges une faute de frappe sur une séance d'il y a 3 jours, le total se met à jour.
- [ ] Tu filtres l'historique sur un exercice et tu vois toutes les séances concernées.

---

## Lot 8 — Réglages & portabilité des données (M10 + M14 local)

**Objectif :** personnaliser l'app et **pouvoir en sortir ses données**. À faire **avant** de
commencer à accumuler des mois d'historique.

**RF couverts :** RF-50 (unités), RF-51 (thème), RF-53 (notifications), RF-54 (réglages de séance
centralisés), RF-66 (export CSV), RF-67 (import), export JSON (recommandation transverse n°5).
**Dépend de :** Lots 6, 7.
**Budget :** 1 à 2 sessions.

**Livrables :**
- Écran de réglages **unique et structuré** — l'audit reproche explicitement à Hevy de les
  disperser (recommandation audit M10).
- Unités kg/lb, poids de barre par défaut, plaques disponibles, incréments, comportement du
  minuteur, affichage RPE, thème.
- **Export JSON complet** (toutes les tables, avec numéro de version de schéma) et **export CSV**
  des séances.
- **Import JSON** avec écrasement ou fusion, testé unitairement sur un aller-retour
  export → import → comparaison.
- Bouton « réparer les records » (recalcul complet).

**✅ Checkpoint :**
- [ ] Tu exportes un JSON, tu le récupères sur ton PC, tu l'ouvres : tes données sont lisibles.
- [ ] Tu vides la base (bouton de debug), tu réimportes le JSON → tout est revenu à l'identique.
- [ ] Tu passes en lb : tous les écrans affichent des livres, l'historique reste cohérent.

---

## Lot 9 — PWA & installation sur le téléphone

**Objectif :** transformer le site en application installable qui marche sans réseau.

**RF couverts :** RF-69 (fonctionnement hors-ligne), RF-59 (préparation des widgets).
**Dépend de :** Lot 8.
**Budget :** 1 session.

**Livrables :** `vite-plugin-pwa`, manifest complet (nom, icônes 192/512/maskable, thème,
`display: standalone`, orientation portrait), service worker avec précache de l'app,
invite d'installation personnalisée, écran « nouvelle version disponible », icône et splash screen,
`docs/INSTALLATION.md`.

**Point de vigilance :** la stratégie de mise à jour du service worker. Un service worker mal
configuré sert indéfiniment une version périmée. Utiliser `registerType: 'prompt'` et afficher
explicitement « une mise à jour est disponible ».

**✅ Checkpoint :**
- [ ] Sur ton téléphone : « Ajouter à l'écran d'accueil » → l'icône apparaît sur le bureau.
- [ ] Tu lances depuis l'icône : **pas de barre d'adresse**, ça ressemble à une app native.
- [ ] **Mode avion, tu lances l'app : elle démarre et fonctionne entièrement.**
- [ ] Tu pushes une nouvelle version → l'app te propose de recharger.

> ### 🏁 JALON MAJEUR — V1
> À ce stade, l'application est **réellement utilisable au quotidien**. Utilise-la 2 à 3 semaines
> avant d'attaquer le Lot 10. Note ce qui t'agace : cette liste vaut plus que la suite de ce plan.

---

# PHASE 2 — APPLICATION ANDROID

## Lot 10 — Empaquetage Android avec Capacitor

**Objectif :** un vrai APK, et surtout **un minuteur de repos fiable écran éteint** — la seule
chose qu'une PWA ne sait pas faire correctement.

**RF couverts :** RF-26 (notification persistante de séance), fiabilisation de RF-27.
**Dépend de :** Lot 9.
**Budget :** 1 à 2 sessions.

**Livrables :**
- Capacitor installé, plateforme Android ajoutée, `capacitor.config.ts` pointant sur `dist/`.
- `@capacitor/local-notifications` : le minuteur devient une notification programmée, elle sonne
  même écran verrouillé ou app en arrière-plan.
- Notification persistante pendant la séance (RF-26).
- Gestion du bouton retour Android, de la barre de statut, du safe-area.
- **Build de l'APK dans GitHub Actions** (le runner Ubuntu a le SDK Android), APK debug signé
  publié en artefact téléchargeable. Évite d'installer Android Studio (~10 Go) sur ta machine.
- `docs/ANDROID.md` : procédure d'installation par transfert (activer « sources inconnues »).

**Prérequis à connaître :** l'installation par sideload d'un APK debug est normale et suffisante
pour un usage personnel. Le Play Store n'est **pas** nécessaire et impose des frais et des
contraintes sans contrepartie ici.

**✅ Checkpoint :**
- [ ] L'APK produit par GitHub Actions s'installe sur ton téléphone.
- [ ] L'app apparaît dans le tiroir d'applications, avec son icône.
- [ ] **Tu valides une série, tu verrouilles l'écran, tu poses le téléphone : le minuteur sonne.**
- [ ] Le bouton retour Android navigue correctement au lieu de fermer l'app.

> ### 🏁 JALON MAJEUR — Application Android
> Le produit est complet pour un usage personnel. Tout ce qui suit est optionnel.

---

# PHASE 3 — V2

## Lot 11 — Mesures corporelles & photos (M7)

**RF couverts :** RF-37 (mesures), RF-38 (graphiques), RF-39 (photos comparées), + verrouillage
biométrique (recommandation transverse n°8), + saisie rétroactive (recommandation audit M7).
**Dépend de :** Lot 10.
**Budget :** 2 sessions.

**Livrables :** saisie de mesures (poids, masse grasse, tour de taille/bras/cuisses/poitrine +
champs personnalisés), avec **date modifiable** pour la saisie rétroactive ; graphique par mesure ;
photos datées stockées **localement uniquement** avec vignettes, comparaison côte à côte,
verrouillage de la section par biométrie (`@capacitor/biometric` ou code PIN en repli).

**Point de vigilance :** les photos de progression sont des données intimes. Elles ne quittent
jamais l'appareil, ne sont pas incluses dans l'export JSON par défaut (case à cocher séparée), et
sont redimensionnées avant stockage pour ne pas saturer le quota.

**✅ Checkpoint :**
- [ ] Tu saisis ton poids sur 5 dates, le graphique se dessine.
- [ ] Tu ajoutes 2 photos et tu les compares côte à côte.
- [ ] La section photos demande ton empreinte/code avant de s'ouvrir.

---

## Lot 12 — Statistiques & rapports (M8)

**RF couverts :** RF-41 (progression par exercice), RF-42 (volume et répartition), RF-43 (carte de
chaleur musculaire), RF-44 (rapport mensuel), RF-46 (1RM estimé), + export des graphiques en image
(recommandation audit M8).
**Dépend de :** Lot 11.
**Budget :** 2 sessions.

**Livrables :** `lib/oneRepMax.ts` (Epley/Brzycki/Lombardi, formule configurable, **en TDD**),
graphiques de progression par exercice (charge max, volume, 1RM estimé), volume par semaine/mois,
répartition des séries par groupe musculaire, carte de chaleur corporelle, rapport mensuel,
export PNG d'un graphique.

**✅ Checkpoint :**
- [ ] Tu ouvres un exercice que tu pratiques depuis des semaines : la courbe monte (ou pas, mais
      elle est juste).
- [ ] La répartition par groupe musculaire révèle un déséquilibre réel et vérifiable.

---

## Lot 13 — Moteur de records & notifications (transverse)

**RF couverts :** consolidation de RF-10 et RF-23, RF-53 (rappels d'entraînement).
**Dépend de :** Lot 12.
**Budget :** 1 session.

**Livrables :** consolidation de `lib/records.ts` (tous les types de PR, recalcul complet fiable),
page « mes records », historique d'un record dans le temps, rappels d'entraînement programmables.

**✅ Checkpoint :**
- [ ] La page records affiche des valeurs cohérentes avec ton historique réel.
- [ ] Le recalcul complet donne exactement le même résultat que le calcul incrémental.

---

## Lot 14 — Synchronisation cloud (M1 + M14) — **optionnel**

> ⚠️ **Ne fais ce lot que si tu utilises réellement l'app sur plusieurs appareils.** C'est le lot
> le plus complexe et le plus risqué du projet. Un export JSON manuel (Lot 8) couvre déjà le besoin
> de sauvegarde.

**RF couverts :** RF-01 à RF-04 (compte), RF-68 (sauvegarde cloud), RF-69 (file d'attente et
synchronisation), + résolution de conflits (recommandation transverse n°5).
**Dépend de :** Lot 13.
**Budget :** 3 à 4 sessions.

**Approche :** Supabase (offre gratuite) attaqué **directement depuis le client** — pas de backend
à écrire, compatible avec un hébergement statique. Auth email/mot de passe + Row Level Security.

**Livrables :** schéma Postgres miroir du schéma Dexie, authentification, moteur de synchronisation
différentielle basé sur `updatedAt` (c'est précisément ce que l'ADR-002 a préparé), file d'attente
hors-ligne, résolution de conflits « dernière écriture gagne » **avec journal des conflits détectés**,
export automatique proposé avant toute suppression de compte (recommandation audit M1).

**✅ Checkpoint :**
- [ ] Tu logges une séance sur le téléphone en mode avion, tu réactives le réseau, elle apparaît
      sur ton PC.
- [ ] Tu modifies la même séance sur deux appareils hors-ligne, tu reconnectes : la règle de
      résolution s'applique et le conflit est **visible**, pas silencieux.

---

## Lot 15 — Intégrations santé (M11)

**RF couverts :** RF-56/RF-57 (Health Connect), RF-58 (fréquence cardiaque), + calories
(recommandation audit M11).
**Dépend de :** Lot 10.
**Budget :** 1 à 2 sessions.

**Livrables :** plugin Health Connect (écriture des séances et du poids de corps, lecture du poids
et de la fréquence cardiaque), calories estimées, écran expliquant que **la connexion directe à
Google Fit n'existe plus** et que Health Connect est obligatoire (recommandation audit M11).

**✅ Checkpoint :**
- [ ] Une séance terminée dans FitTrack apparaît dans Health Connect.
- [ ] Ton poids saisi dans une autre app remonte dans FitTrack.

---

## Lot 16 — Widgets (M12)

**RF couverts :** RF-59 (widget d'accueil), RF-60 (notification enrichie).
**Dépend de :** Lot 15.
**Budget :** 2 sessions. ⚠️ Nécessite du **code Android natif (Kotlin)**, pas du web.

**Livrables :** widget d'écran d'accueil (streak, prochaine séance, dernier record), notification
enrichie pendant la séance avec l'exercice en cours.

**✅ Checkpoint :**
- [ ] Le widget est posé sur ton écran d'accueil et affiche des données à jour.

---

# PHASE 4 — V3

## Lot 17 — Périodisation & programmes multi-semaines

> C'est **la** valeur ajoutée identifiée par l'audit face à Hevy (recommandation transverse n°7).
> Si tu ne devais faire qu'un lot de la Phase 4, c'est celui-ci.

**RF couverts :** comble le manque relevé en M3 (mésocycles, semaines de décharge planifiées).
**Dépend de :** Lot 13.
**Budget :** 2 à 3 sessions.

**Livrables :** entité `Program` (bloc de 4 à 12 semaines), planification par semaine avec
variation de charge (% du 1RM ou RPE cible), semaines de décharge, vue « où j'en suis dans le
bloc », démarrage d'une séance depuis la semaine courante du programme.

**✅ Checkpoint :**
- [ ] Tu crées un bloc de 8 semaines avec une décharge en semaine 5.
- [ ] L'app te propose la bonne séance, avec les bonnes charges, au bon jour.

---

## Lot 18 — Auto-progression transparente (M9, sans IA)

**RF couverts :** RF-48 (ajustement automatique des charges), + **transparence de l'algorithme**
(recommandation transverse n°2).
**Dépend de :** Lot 17.
**Budget :** 2 sessions.

**Livrables :** moteur de règles explicite en TDD (`lib/progression.ts`) : si toutes les séries de
travail atteignent le haut de la fourchette de reps → charge suivante augmentée d'un incrément ;
si échec deux séances de suite → maintien puis diminution. **Chaque décision est affichée avec sa
justification en français** (« +2,5 kg car 3×12 atteint la semaine dernière »).

Suggestion de décharge après X semaines de progression continue (recommandation audit M5).

**Pourquoi sans IA :** un moteur de règles est déterministe, testable, instantané, gratuit, et
surtout **explicable** — ce que l'audit reproche justement à la boîte noire de Hevy.

**✅ Checkpoint :**
- [ ] L'app te propose une charge pour ta prochaine séance **et t'explique pourquoi**.
- [ ] Tu peux refuser la proposition et saisir ta propre charge.

---

## Lot 19 — Assistant conversationnel (M9, RF-49) — **optionnel**

**Dépend de :** Lot 18.
**Budget :** 2 sessions.

⚠️ **Contrainte de sécurité incontournable :** une clé d'API **ne peut pas** être embarquée dans
l'app. Le bundle GitHub Pages est public, et un APK se décompile en quelques secondes. Il faut un
**proxy serverless** (Cloudflare Workers ou Vercel, offres gratuites) qui détient la clé et relaie
les requêtes.

**Livrables :** proxy serverless, chat contextualisé (l'assistant reçoit ton historique récent),
garde-fous explicites (rappel qu'il ne remplace pas un coach, alerte en cas de progression
irréaliste — recommandation audit M9).

**✅ Checkpoint :**
- [ ] Tu poses une question sur ta séance et la réponse tient compte de ton historique réel.
- [ ] La clé d'API est introuvable dans le bundle et dans l'APK.

---

## Lot 20 — Saisie vocale & accessibilité

**RF couverts :** recommandation transverse n°3 (point faible de tout le secteur), RF-51 (tailles
de police), mode accessibilité (recommandation audit M10).

**Dépend de :** Lot 10.
**Budget :** 2 sessions.

**Livrables :** saisie vocale des séries (« cent kilos, huit reps ») via l'API de reconnaissance
vocale — mains occupées par la barre, fonctionnalité absente chez Hevy et très demandée ; audit
complet TalkBack ; mode contraste renforcé ; tailles de police ajustables ; cibles tactiles
agrandies.

**✅ Checkpoint :**
- [ ] Tu dictes une série sans toucher le téléphone, elle est correctement enregistrée.
- [ ] Tu navigues dans l'app avec TalkBack activé, les yeux fermés, et tu peux logger une série.

---

## 3. Hors périmètre (assumé)

| Écarté | Raison |
|---|---|
| **Illustration animée du mouvement** (moitié de RF-06) | **Décision du 2026-07-22 : pas d'achat.** Ce n'est pas introuvable, c'est **vendu** — cf. l'encadré ci-dessous. Le **muscle ciblé**, lui, est traité au Lot 5bis à partir d'une source libre. |
| Toutes les fonctionnalités sociales | Exclues du cahier des charges dès l'origine. |
| M13 — Montres connectées / Wear OS | Projet Android natif séparé, pairing, sync Bluetooth. Coût sans commune mesure avec le gain pour un usage personnel. |
| iOS / App Store | 99 $/an, un Mac obligatoire pour compiler. À rouvrir seulement si tu changes de téléphone. |
| Publication sur le Play Store | 25 $, revue, politique de confidentialité, conformité. Le sideload suffit pour soi. |
| RF-05, RF-55, RF-61 à RF-65 | Liés au compte multi-utilisateur, au social ou à la montre. |

### L'enquête sur les illustrations d'exercices — 2026-07-22

Menée parce que la question « des schémas comme dans Hevy, c'est prévu ? » n'avait pas de réponse
écrite. Résultat : **le jeu d'images que tout le monde reconnaît est un produit commercial.**

| Source | Licence vérifiée | Verdict |
|---|---|---|
| [`hasaneyldrm/exercises-dataset`](https://github.com/hasaneyldrm/exercises-dataset) — 1 324 exos, GIFs animés, 10 langues dont le français | MIT sur les **données**, images **© [Gym Visual](https://gymvisual.com/)** | ❌ Le MIT ne couvre pas `images/`. Le dépôt les redistribue « avec permission » — une permission qui ne s'étend pas à nous : « obtain your own license there before reusing the media ». |
| [Gym Visual](https://gymvisual.com/) — le vendeur d'origine, ciblant explicitement les développeurs d'apps | Commerciale, à l'unité | 💰 ~0,90 $ le GIF animé, <0,75 $ l'illustration au-delà de 10 articles. **~150 $ pour nos 168 exercices.** Remise « Pack » à négocier. |
| [`ExerciseDB`](https://github.com/ExerciseDB/exercisedb-api) — 11 000 exos | **AGPL-3.0** | ❌ Virale, **et** c'est une API donc du réseau : disqualifiée deux fois. |
| [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db) | Unlicense **sur le dépôt** | ⚠️ La provenance des images **n'est pas documentée** dans le README. Cf. la mise en garde de `PROGRESS.md`. |
| [`vulovix/body-muscles`](https://github.com/vulovix/body-muscles) — carte musculaire SVG, 70+ régions, zéro dépendance | **Apache-2.0** | ✅ Retenue pour le Lot 5bis. |
| [`soroojshehryar/react-muscle-highlighter`](https://github.com/soroojshehryar/react-muscle-highlighter) | **MIT** | ✅ Repli équivalent. |

**Pourquoi « c'est juste pour moi » ne dispense de rien :** le dépôt est **public**
(`"visibility": "public"`, vérifié) et le site répond **HTTP 200 à n'importe qui**. Tout ce qui est
commité est redistribué, quelle que soit l'intention. C'est le raisonnement de la règle non
négociable n°3 sur les clés d'API, appliqué aux images.

**À rouvrir si** l'app passe en dépôt privé, ou si le manque se fait assez sentir pour justifier
les ~150 $. L'intégration serait alors triviale : `imageUrl` existe déjà dans le schéma, les
fichiers seraient embarqués au build (jamais chargés à distance — règle n°2), et il ne resterait
que la correspondance avec les 168 slugs.

---

## 4. Récapitulatif de la couverture du cahier des charges

| Module | Lots | Couverture |
|---|---|---|
| M1 Compte | 14 | Optionnel, tardif — sans objet en mono-appareil |
| M2 Exercices | 2, 3, **5bis** | Sans limite de nombre. RF-06 n'est **pas** complet avant le Lot 5bis : le champ `imageUrl` existe mais rien ne le remplit, et l'illustration du **mouvement** reste hors périmètre (cf. Lot 5bis). |
| M3 Routines | 4, 17 | Complète + périodisation (au-delà de Hevy) |
| M4 Séance | 5, 6 | Complète + réorganisation en séance |
| M5 Outils | 6 | Complète + plaques élargies aux haltères/machines |
| M6 Historique | 7 | Complète, sans limite de durée, + filtre par exercice |
| M7 Mesures & photos | 11 | Complète + verrouillage biométrique |
| M8 Statistiques | 12, 13 | Complète hors charge aiguë/chronique |
| M9 Coaching | 18, 19 | Complète, avec transparence des règles |
| M10 Réglages | 1, 8, 20 | Complète, centralisés + accessibilité |
| M11 Santé | 15 | Complète (Android) |
| M12 Widgets | 16 | Widget + notification |
| M13 Montres | — | **Hors périmètre** |
| M14 Export/Import | 8, 14 | Complète (JSON + CSV), sync optionnelle |

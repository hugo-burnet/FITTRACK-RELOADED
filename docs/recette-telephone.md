# Recette téléphone — une seule passe

> **Pourquoi ce fichier.** `PROGRESS.md` listait dix checkpoints téléphone « encore dus », les plus
> anciens depuis fin août, plus ceux de chaque version livrée depuis. La feuille de route dit qu'on
> ne passe pas au lot suivant tant qu'un checkpoint n'est pas validé ; la pratique les a laissés
> s'accumuler. Ils sont ici **dédoublonnés et rangés par l'endroit où l'on se trouve** : une passe
> d'environ 20 minutes, en salle ou à défaut à bout de bras.
>
> **Ce que cette liste ne contient plus.** Les parcours E2E (`npm run test:e2e`) vérifient déjà,
> dans un navigateur à 390 px : le premier lancement en silence, une séance de bout en bout, la
> série qui survit à un rechargement, les cibles de 48 px, l'absence de débordement dans les trois
> thèmes à 100, 130 et 200 % (TTY1 : 130 %), l'app qui démarre sans réseau, et la sauvegarde.
> Reste ici **ce qu'un navigateur ne dit pas** : le toucher, le son, les notifications, le bouton
> retour d'Android, la vraie WebView, une police de 16 px à bout de bras.
>
> **Comment s'en servir.** Installer l'APK **par-dessus** l'ancien (jamais de désinstallation : elle
> efface les données). Cocher au fur et à mesure. Au premier écart, noter l'écran et ce qui
> s'affiche. Une fois la passe finie, supprimer les lignes validées de « Checkpoints téléphone
> encore dus » dans `PROGRESS.md` et y consigner ce qui a échoué.
>
> Entre parenthèses : la version où le point est apparu, pour retrouver sa section dans
> `docs/journal/`.

## 0. Installation (2 min)

- [ ] Installer l'APK par-dessus : l'en-tête de l'accueil dit la bonne version, les séances et
      routines sont intactes. *(toute version)*
- [ ] **Capacitor 8.5.1** : l'icône et l'écran de démarrage sont ceux d'avant ; les barres du système
      (haut et bas) gardent la couleur du thème ; rien ne passe sous la barre de gestes en bas de
      l'écran de séance. *(cette session — 8.5.2, qui retouche les zones sûres, n'est pas pris)*
- [ ] Le bouton retour d'Android remonte d'un cran (sous-écran de séance, séance, onglets) au lieu de
      fermer l'app. *(v1, `docs/ANDROID.md`)*

## 1. Accueil et Réglages (4 min)

- [ ] **Rappel de sauvegarde.** Sur une installation qui n'a jamais été sauvegardée et qui a au moins
      trois séances, l'accueil porte « Sauvegarde ton historique » **sous** la séance à lancer, avec
      « Sauvegarder » et « Plus tard ». « Plus tard » le fait taire une semaine. *(cette session)*
- [ ] « Sauvegarder » ouvre la feuille de partage d'Android ; choisir Drive ou un dossier : le
      rappel disparaît, et Réglages › Sauvegarde complète dit « Dernière sauvegarde : aujourd'hui. À jour. »
      Fermer la feuille sans choisir ne retient rien. *(cette session)*
- [ ] Le fichier sauvegardé s'ouvre sur un ordinateur : du JSON lisible, sans caractère parasite en
      tête. *(v2.6.0)*
- [ ] Réglages › Apparence › **TTY1** : fermer et rouvrir l'app plusieurs fois — sept parties, un
      contenu différent à chaque fois, environ 4,6 secondes, une fonction de l'app qui attend puis se
      valide ; toucher l'écran pendant l'ouverture la coupe sans que l'accueil reçoive le toucher ;
      une séance en cours saute l'ouverture. *(v2.8.0, v2.9.0)*
- [ ] « Réduire les animations » du système : la console TTY1 est là d'emblée, deux secondes.
      *(v2.9.0)*
- [ ] Repasser en Sombre : rien n'a changé, sinon le numéro de version en haut à droite de chaque
      écran. *(v2.8.0)*
- [ ] **Taille de police du système au maximum** (Android › Affichage) : l'en-tête de la séance garde
      son bouton d'aide à l'écran, rien ne défile de côté. *(cette session)*

## 2. En séance (8 min)

Une séance de deux exercices au moins, dont un en barre.

- [ ] **Échauffement.** Toucher le numéro de la série 1 › « Type de série » › Échauffement ; saisir
      40 × 5 et valider ; rouvrir la carte (elle s'est repliée) › « Ajouter une série » : la série 2
      n'a **pas** de flamme, elle est vide, ses chiffres en gris sont ceux de la séance d'avant.
      *(v2.10.0)*
- [ ] **Cadenas d'ordre.** Fermé au lancement, dans la barre d'avancement à gauche de « Tout
      replier ». Le toucher : les poignées apparaissent ; déplacer un exercice, retoucher : elles
      partent. Appliquer la décharge (menu ⋮ › deload) : « 80 % » apparaît, le cadenas reste à côté.
      *(v2.10.0)*
- [ ] **Unilatéral sans cadence.** Cocher le premier côté : la coche reste grisée dix secondes,
      affiche le décompte, puis se réactive seule pour valider le second côté. *(30 août)*
- [ ] **Kill pendant le repos.** Valider une série, tuer l'app depuis le gestionnaire de tâches, la
      rouvrir : la séance reprend, le repos aussi, aucune série perdue. *(v2.5.0)*
- [ ] **Bilan de fin** d'une séance à deux charges différentes (20 × 8 puis 30 × 6) : la ligne de
      l'exercice dit « 2 série(s) · dernière : 6 reps · 30 kg » et non « 2 × 6 reps · 30 kg ».
      *(v2.5.0)*
- [ ] **Remplacer l'exercice.** Menu ⋮ d'un exercice dont aucune série n'est validée › « Remplacer
      l'exercice » › toucher un autre exercice : la carte prend son nom sur place, même rang, séries vides.
      Avec une série **déjà validée** : elle reste sous l'ancien nom, une carte du nouvel exercice
      s'ouvre juste dessous avec les séries restantes. Une fois tout validé, l'entrée est grisée et dit
      pourquoi. Le retour d'Android depuis la liste revient à la séance. *(cette session)*
- [ ] **Coach, cible unique.** Un 5×5 (modèle « 5×5 — A ») fait en entier à la même charge : l'écran de
      fin propose **le cran** (par exemple 100 → 102,5 kg), sans réclamer 6 répétitions. *(cette
      session)*
- [ ] **Coach, tranches 1 à 4.** Au plafond sur une machine où tu charges par 2,5 kg : la carte propose
      +2,5 kg. Au plafond à RPE 9,5 ou plus : pas de charge, et elle dit pourquoi. Même charge avec un
      RPE plus bas : « la charge se consolide ». Reprise après deux semaines : « Reprise après N
      jours », sans charge ; le récap vocal ne dit pas « une hausse de charge est prévue ». Un curl aux
      haltères à 10 kg × 12 sur 10–12 : « vise 18 répétitions », pas 12 kg. *(v2.11.0)*
- [ ] **Cran de la fiche.** Renseigner 1,125 kg sur les élévations latérales ; au plafond avec assez de
      répétitions, la charge proposée depuis 5 kg est 6,125. *(v2.11.0)*
- [ ] Série validée en thème **TTY1** : `[x]`, le repos qui clignote, la jauge d'effort ; la feuille
      des plaques ; l'historique. Police lisible à bout de bras. *(v2.8.0)*

## 3. Planifier (5 min)

- [ ] **Appliquer à toutes les séries.** Dans l'éditeur d'une routine qui porte un échauffement planifié
      (« Échauffement », 40 kg) et deux séries de travail : monter la charge d'une série de travail,
      « Appliquer à toutes les séries » : l'échauffement n'a pas bougé, les séries de travail ont la
      nouvelle charge ; ouvrir l'échauffement : le bouton dit « Appliquer aux échauffements ».
      *(v2.10.0)*
- [ ] **Note de routine.** Menu d'un exercice › « Ajouter une note » : la consigne apparaît **sous le
      nom** sur la carte et, séance démarrée, sous le nom de l'exercice ; la corriger en séance ne
      touche pas la routine. *(v2.6.0)*
- [ ] **Export markdown.** Bibliothèque › menu d'une routine › « Partager en markdown », et le même
      geste sur un dossier. *(v2.6.0)*
- [ ] **Revue des cibles.** Ouvrir une routine dont une charge a été dépassée en séance, « Mettre à jour
      les cibles » : la carte du rowing affiche 57,5 → 70, « Refuser » ne change rien, « Accepter »
      l'écrit ; un exercice descendu en charge n'apparaît pas et se lit dans « Laissées telles quelles »
      avec sa raison. *(v2.7.0)*
- [ ] **Programme, cycle de deux semaines.** Planifier › Programmes › « + », au Split **2 semaines** :
      « Ajouter un dossier » › UL (quatre séances, du lundi au jeudi) ; sous la semaine 2 › PPL 45'
      (six, du lundi au samedi). Activer : la fiche dit « Semaine N du cycle de 2 semaines », et
      l'accueil propose la séance du jour du bloc. *(v2.10.0)*
- [ ] **« À lancer » sur plusieurs dossiers.** Accueil sans bloc actif : cocher deux dossiers,
      « Terminé » : la carte annonce `UL + PPL …` et propose la routine la plus ancienne des deux ;
      fermer et rouvrir l'app : le choix est resté ; fermer la feuille **sans** « Terminé » ne change
      rien. *(v2.10.0)*
- [ ] **Corpus d'un programme.** Ouvrir un bloc actif puis « Ce qu'en dit le corpus » : l'article du
      Guide correspondant à la phase s'ouvre, sans page d'erreur. *(30 août)*

## 4. Guide, paliers, tutoriel (3 min)

- [ ] **Documentation d'un exercice.** Adduction à la machine › Documentation : taper un titre de
      l'encadré du haut ouvre l'article nommé. Étirements : le cadre général est proposé, l'accueil
      du wiki n'est pas la seule sortie. *(v2.5.4)*
- [ ] **Paliers.** Progression › Paliers : des jetons-images (Pepe, git gud, stonks…) à la place du
      disque chiffré, thème clair aussi ; **noclip** sous « Secrets », daté du jour de la mise à
      jour. *(29 août ; noclip : v2.9.0)*
- [ ] **Première séance et DOMS** (installation neuve ou IndexedDB réinitialisé) : enregistrer une
      première séance, voir le Malphite-Chad « Rock solid. » sur l'accueil ; 48 h plus tard la
      notification « Tes premières DOMS », puis la porte au toucher. *(31 août)*
- [ ] **Tutoriel.** Le sélecteur de guidage à quatre modes, une série unilatérale menée jusqu'au bout ;
      « Passer » ne rouvre rien d'autre. *(v2.5.0)*
- [ ] **Ouverture normale.** Fermer l'app, la relancer à froid : plaques, deux phrases, accueil.
      *(30 août)*

## 5. Sauvegarde et hors-ligne (3 min)

- [ ] **Restaurer une sauvegarde tronquée à la main** : le message nomme la table et la ligne, rien ne
      bouge. Puis une vraie : le récapitulatif donne la date du fichier et les nombres, et Réglages
      dit « Dernière sauvegarde : aujourd'hui » juste après. *(v2.5.1, cette session)*
- [ ] Réglages › Dépannage et données › Stockage : une ligne dit si le stockage est protégé (sur
      l'APK, « non protégé » est normal : la WebView n'a pas la notion). *(cette session)*
- [ ] **Mode avion**, app tuée puis rouverte : l'app complète et la séance active sont là. *(v1,
      `docs/ANDROID.md`)*
- [ ] Notifications : valider une série, verrouiller l'écran, poser le téléphone : le repos sonne à
      l'heure ; remplacer puis annuler un repos : aucune ancienne alarme ne sonne. *(v1)*

## Si quelque chose ne va pas

Noter : l'écran, la version affichée en haut à droite, ce qui s'affiche, ce qui était attendu. Une
capture d'écran vaut mieux qu'une description. Ne rien corriger dans `PROGRESS.md` avant d'avoir
retrouvé le point ici : c'est ce qui permet de savoir, la fois d'après, ce qui reste vraiment dû.

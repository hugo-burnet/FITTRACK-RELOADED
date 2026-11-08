# Préparation homelab et restauration du backend

> Exécution : superpowers:executing-plans, dans le checkout existant sur la
> branche `ccr-homelab-sync-20261108`. Le propriétaire demande une préparation
> sans installation serveur (8 novembre 2026).

**But :** préparer une instance récupérable et un paquet local vérifiable pour
la VM en quarantaine. La synchronisation web/APK et l'ouverture publique ne
sont pas encore livrées par FitTrack v2.17.5.

**Architecture :** conserver Django/SQLite et le format `backup_sync`. Une
restauration crée exclusivement une nouvelle instance, avec secret et génération
neufs hors du volume SQLite ; elle ne remplace jamais un service en cours.
Le paquet de préparation embarque uniquement les sources backend suivies par
Git et les dépendances Linux verrouillées. Aucun secret ni base réelle.

**Référence :** homelab `docs/superpowers/specs/2026-11-06-fittrack-public-design.md`.

## Contraintes

- Aucun déploiement, aucune installation sur le homelab, aucune publication.
- Ne jamais réutiliser la génération d'un export ; invalider les sessions restaurées.
- Refuser une destination existante et un export incomplet, altéré ou incompatible.
- Conserver les données des deux comptes et l'historique des opérations.
- Le backend reste non exposable publiquement : authentification, client et limites à livrer.

## Task 1: Restauration vers une nouvelle instance

Fichiers : `backend/sync_app/restores.py`, commande `restore_sync.py`,
`backend/sync_app/tests/test_restore.py`, `backend/README.md`.

- [x] Écrire les tests d'un vrai export Django : comptes A/B, état et sessions.
- [x] Vérifier RED : commande absente.
- [x] Implémenter `restore_backup(source, destination)` et `restore_sync`.
- [x] Tester corruption, liens, génération, schéma incompatible et destination existante.
- [x] Exécuter la suite backend et le contrôle des migrations.

## Task 2: Préparation du paquet homelab

Fichiers homelab : `scripts/prepare-fittrack.ps1`,
`scripts/build-fittrack-bundle.py`, `tests/test_fittrack_bundle.py`,
`docs/13-fittrack-sync.md`.

- [x] Tester l'archive produite et son manifeste, sans secret ni état local.
- [x] Vérifier RED, puis implémenter le packaging depuis un commit backend propre.
- [x] Télécharger les roues Linux Python 3.12 avec `--require-hashes`, sans les installer.
- [x] Préparer les fichiers Compose et proxy sans port publié, sur réseau interne.
- [ ] Construire réellement le paquet ; vérifier les empreintes, la syntaxe et les tests.

## Review Focus

- Un export changé pendant la copie doit être refusé par l'empreinte du fichier copié.
- Une restauration ne doit pas accepter de chemins dictés par le manifeste.
- Les exports et environnements locaux ne doivent jamais entrer dans le paquet.
- Un service préparé ne doit ni écouter sur le LAN ni ouvrir le réseau de la VM.
- Le paquet ne doit pas être présenté comme une synchronisation déjà opérationnelle.

## Vérification et décisions de relecture

- Backend Linux : 47/47 réussites, dont permissions, liens et FIFO.
- Backend Windows : 42 réussites, cinq contrôles POSIX ignorés.
- Migrations : aucun changement. Typecheck, lint et build frontend réussis.
  Suite frontend complète : 3 864 réussites, un ignoré (673,18 secondes).
- Caddy 2.11.8 : adaptation et validation natives réussies. Compose : schéma
  officiel validé ; pas de daemon Docker local pour une recette conteneur.
- Relecture indépendante : schéma réel vérifié en plus des migrations,
  destinations imbriquées dans l'export refusées, FIFO non bloquants,
  noms/tags/glibc des roues et présence des fichiers de déploiement vérifiés.
  Les tests de régression ont échoué avant correction puis passent.
- Choix : aucun port publié, car Docker ne publie pas les ports d'un
  conteneur uniquement sur réseau interne. Recette ultérieure depuis la VM
  Linux vers l'IP interne du proxy. Ce choix conserve la quarantaine actuelle.

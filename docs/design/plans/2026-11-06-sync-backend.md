# Backend homelab : première tranche de synchronisation

Le propriétaire demande l’auto-hébergement et une synchronisation web/APK
multi-utilisateur, sans VPN pour les utilisateurs. Il délègue les choix et
leur vérification. Le lancement sera restreint, puis ouvert plus largement.
Cette préparation ne publie pas de service. La release Android v2.17.4
porte la correction Windows ; elle ne livre pas encore de synchronisation.

L’ancien Lot 14 Supabase est remplacé pour cette demande par un backend
auto-hébergé. La règle local-first et les autres conventions restent applicables.
Les choix de stockage/conflits sont consignés dans le projet homelab : VM
isolée, compte serveur distinct, instantanés révisionnés, aucun écrasement
automatique en cas de divergence.

## Contrat de la première tranche backend

Créer sous `backend/` un service Django avec tests natifs, indépendant du
build du frontend. Employer les comptes Django pour porter la propriété des
données, sans modifier le schéma Dexie dans cette tranche.

Cette première tranche livre uniquement le protocole protégé et sa persistance.
Les écrans de connexion, le parcours d’inscription/invitation, le pont Android,
le moteur de sync client et le déploiement public suivent séparément. Ne pas
exposer cette tranche tant qu’ils ne sont pas terminés et vérifiés.

## Tâches et interfaces

1. Tests d’intégration Django avec deux vrais utilisateurs : toute route de
   données exige une session, A ne voit ni ne remplace l’état de B, aucune
   propriété n’est déduite d’un `userId` fourni. Tester le CSRF avec un client
   qui applique réellement le middleware.
2. Modèles `SyncHead` et `SyncOperation`, liés au compte. Un curseur est
   `(generation, revision)`. Une publication est conditionnelle et idempotente
   par compte/génération/identifiant d’opération. Une réutilisation d’identifiant
   avec un autre corps est un conflit, pas un succès.
3. Routes `GET /api/sync/state` et `POST /api/sync/publish`. L’état initial a
   révision zéro et aucun instantané. Une génération différente exige une
   réconciliation, sans créer d’état ni modifier les données.
4. Valider l’enveloppe JSON du backup, le format/version, le schéma, les tables
   et le type des préférences. Le serveur traite les lignes comme des données,
   sans exécuter du code ni utiliser leurs IDs comme identité de compte.
   La validation métier complète/migration des lignes existante côté client
   reste obligatoire avant toute application locale.
5. Limiter la taille des requêtes. Comparaison de révision et mise à jour
   atomiques ; deux publications concurrentes à la même révision ne doivent
   pas réussir toutes deux. SQLite requiert une acquisition explicite du verrou
   d’écriture avant la décision, pas `select_for_update()` seul.
6. Sessions liées à une génération externe à SQLite. Un changement de
   génération invalide les sessions ; une restauration ne ressuscite pas les
   appareils précédemment révoqués. Stockage de production, secret et hôtes
   configurés explicitement ; pas de configuration de développement implicite.
7. Migrations, documentation des limites et exemple d’environnement sans
   secrets. Dépendances Python verrouillées après résolution ; exécuter les
   tests backend puis les portes frontend requises par le dépôt.

## Vérifications critiques

- GET/POST sans connexion : refus ; méthode HTTP incorrecte : refus.
- Principal A/B : deux espaces indépendants, y compris idempotence et historique.
- Curseur périmé, génération inconnue, ID d’opération réutilisé avec un autre
  corps : refus sans mutation.
- JSON invalide, backup incomplet ou trop volumineux : refus sans mutation.
- Répétition exacte d’un envoi après une perte de réponse : même résultat.
- Changement de génération : anciennes sessions refusées.
- La réponse distante ne doit jamais conduire directement à `restoreBackup`
  sans contrôle de l’état local, du compte actif et d’une séance en cours.

## Registre d’exécution

- Source : branche locale `ccr-homelab-sync`, depuis `master` v2.17.3.
- État initial : dépendances npm installées avec le lock et scripts d’installation
  désactivés. Audit npm production : aucun signalement le 6 novembre 2026 ;
  l’audit complet signale des dépendances de développement à examiner.
- Typecheck, lint et build passent ; suite complète frontend : 3 862 tests
  réussis, un ignoré. Une collision de noms de modules sous Windows a été
  corrigée sans changement de logique métier. Voir le journal v2.17.4.

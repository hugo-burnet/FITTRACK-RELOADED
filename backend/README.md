# Backend de synchronisation — tranche locale, non déployable publiquement

Cette première tranche implémente la persistance d’instantanés par compte,
le contrôle atomique de révision et l’idempotence. Elle n’est pas encore
connectée à l’application web ou à l’APK et n’est déployée sur aucun serveur.

Les parcours de connexion, invitations, récupération et MFA, le stockage
Android, les limites d’abus/stockage et la procédure de restauration sont
encore à livrer. **Ne pas exposer ce service sur Internet en l’état.**
Les tests établissent leurs sessions avec l’authentification de test Django ;
il n’existe pas de route publique pour obtenir une session dans cette tranche.

## Dépendances et tests

Python 3.12 est utilisé pour cette tranche. Créer un environnement virtuel,
puis installer les versions et empreintes verrouillées :

```bash
python -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements.lock
.venv/bin/python manage.py test sync_app --settings=fittrack_server.test_settings --noinput
```

Sous Windows, employer `.venv\Scripts\python.exe`. Le module `test_settings`
utilise une clé publique de test et un hachage rapide, et ne doit jamais servir
à un déploiement. Les tests emploient uniquement `.data/test-sync.sqlite3`.

## Contrat HTTP actuel

Toutes les routes de données exigent une session authentifiée, liée à la
génération courante. Le propriétaire provient de la session, jamais d’un ID
fourni dans la requête. Les sessions web gardent la protection CSRF Django.

- `GET /api/sync/state` : génération, révision et instantané de ce compte.
- `POST /api/sync/publish` : `operationId` UUID, `base` avec génération/révision
  et `snapshot` au format de sauvegarde FitTrack version 1, schéma 13.
- Une publication obsolète reçoit HTTP 409. La répétition exacte d’une opération
  retourne le même accusé. La réutilisation de son ID avec d’autres données
  reçoit HTTP 409. Les IDs d’opération sont cloisonnés par compte/génération.
- Requête limitée à 16 Mio décompressés dans cette tranche ; HTTP 413 laisse
  les données locales intactes. Le futur proxy doit aussi appliquer cette
  limite et ses propres délais avant exposition.

Le serveur vérifie l’enveloppe et le type des lignes, pas toute leur sémantique
métier. Le client doit encore valider et migrer le contenu avec son module
de sauvegarde avant toute application. Il n’existe pas de fusion implicite.

SQLite utilise `BEGIN IMMEDIATE` pour sérialiser les publications concurrentes.
Les instantanés sont actuellement archivés par opération, sans purge ; une
politique d’espace et de rétention est requise avant le lancement.

## Configuration future de déploiement

`fittrack_server.settings` refuse le démarrage sans fichiers explicites pour
`FITTRACK_SECRET_FILE` et `FITTRACK_GENERATION_FILE`, hôtes autorisés explicites
et volume de données existant via `FITTRACK_DATA_DIR`. Pas de clé par défaut,
de mode DEBUG ou de CORS universel. Argon2 est le hachage de production prévu.

Le backend ne doit publier aucun port hôte. Son seul reverse proxy doit
nettoyer les en-têtes de forwarding et joindre l’API via un réseau interne.
L’authentification ne se fonde jamais sur ces en-têtes.

Une restauration doit renouveler la génération externe **avant** de réouvrir
l’accès et invalider les autres credentials restaurés. Le middleware refuse
déjà les sessions d’une ancienne génération ; la procédure de rotation et de
restauration opérable reste à développer et tester avant déploiement.

## Export SQLite cohérent

Avec l'environnement de production explicitement configuré, depuis `backend/` :

```sh
python manage.py backup_sync /chemin/prive/exports/nouvel-export
```

Le dossier parent doit exister et être contrôlé par l'administrateur. La
commande refuse tout nom existant, même un lien symbolique. Elle utilise
l'API SQLite de sauvegarde pour inclure les transactions validées, même en
mode WAL, sans inclure celles encore en cours. L'export contient une base
autonome `database.sqlite3` et un manifeste versionné avec date, empreinte
SHA-256 et génération d'origine informative. Un contrôle d'intégrité SQLite
est exécuté avant le succès. Sous POSIX, dossier 0700 et fichiers 0600 ;
sous Windows, les ACL du dossier parent restent à la charge de l'opérateur.

La commande ne copie ni le secret Django ni le fichier de génération et
ne remplace pas une sauvegarde chiffrée hors machine. L'empreinte détecte
une corruption ; elle n'authentifie pas un export fourni par un tiers.
Archiver uniquement après le succès de la commande. Un export sans manifeste
valide n'est pas complet. Un arrêt brutal peut laisser un dossier incomplet :
il faut un nouveau nom pour réessayer, sans écraser la sauvegarde précédente.

**Ne pas remettre cette base en ligne par simple copie.** La restauration
opérable, avec arrêt du service, contrôle de la provenance, rotation de la
génération externe et tests d'invalidation des sessions, reste à livrer.
La génération d'origine du manifeste ne doit jamais redevenir la génération
active d'une restauration. Cette commande n'est pas encore déployée ni
planifiée sur le homelab.

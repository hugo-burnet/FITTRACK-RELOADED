# Backend de synchronisation — test privé dans le homelab

Cette première tranche implémente la persistance d’instantanés par compte,
le contrôle atomique de révision et l’idempotence. Elle n’est pas encore
connectée à l’application web ou à l’APK. Ses fondations sont maintenant
installées dans la VM isolée du homelab, sans port publié ni accès Internet.
La recette native du 8 novembre 2026 donne **47 tests réussis**, HTTPS avec
certificat vérifié et réponse 401 attendue sans session. Le réseau Docker
interne et les processus non root sont contrôlés sur les conteneurs actifs.

Les parcours de connexion, invitations, récupération et MFA, le stockage
Android et les limites d’abus/stockage sont
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
déjà les sessions d’une ancienne génération. `restore_sync` prépare maintenant
une nouvelle instance hors ligne avec rotation et révocation des sessions.

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

**Ne pas remettre cette base en ligne par simple copie.** Une restauration
exige le contrôle de la provenance et la procédure ci-dessous.
La génération d'origine du manifeste ne doit jamais redevenir la génération
active d'une restauration. La commande est disponible et testée dans la VM ;
elle n'est pas encore planifiée automatiquement.

## Restauration hors ligne vers une nouvelle instance

Depuis un environnement backend de même version, configuré explicitement :

```sh
python manage.py restore_sync /exports/export-de-confiance /instances/nouvelle-instance
```

Le parent de destination doit exister et être privé. La commande ne remplace
aucun chemin existant, ne touche pas à la base active et n'active aucun service.
Elle vérifie le format, l'empreinte de la copie, l'intégrité SQLite, les clés
étrangères et la correspondance exacte des migrations avec le code courant.
Les liens symboliques en entrée sont refusés. Un export plus récent ou ancien
doit être restauré avec la version correspondante avant migration.

Le résultat comprend `data/fittrack.sqlite3`, `secrets/generation`,
`secrets/django-key` et un marqueur `restore.json` écrit en dernier.
La génération et le secret sont neufs, en dehors du dossier de données ; les
sessions de la copie sont supprimées. Les comptes, mots de passe et instantanés
restent présents. Deux restaurations du même export reçoivent des secrets et
des générations différents. Permissions POSIX : dossiers 0700, fichiers 0600.

Avant activation : arrêter l'ancien backend, conserver son volume, pointer
explicitement les trois variables de fichiers/données vers la nouvelle instance,
vérifier les permissions pour l'UID du service, contrôler migrations et état
des deux comptes, puis ouvrir le trafic. Ne jamais remettre en ligne un ancien
volume sans refaire cette procédure : il ferait revivre son ancienne génération.
Un retour arrière passe lui aussi par une nouvelle restauration et une nouvelle
génération. Aucune substitution automatique des données d'un appareil n'est permise.

La recette du 8 novembre valide aussi sur la VM un export de la base active
et sa restauration dans une copie hors ligne : secret et génération neufs,
instance d'origine maintenue active, copie non activée. Ce test ne constitue
pas une restauration complète du serveur. Les parcours de connexion et la
synchronisation web/APK restent à livrer.

# Backend de synchronisation — test privé dans le homelab

Cette première tranche implémente la persistance d’instantanés par compte,
le contrôle atomique de révision et l’idempotence. Elle n’est pas encore
connectée à l’application web ou à l’APK. Ses fondations sont maintenant
installées dans la VM isolée du homelab, sans port publié ni accès Internet.
La recette native du 8 novembre 2026 donne **69 tests réussis**, sans exclusion,
sur le code `1ea1703`. HTTPS avec certificat vérifié : session anonyme 200,
connexion invalide 401, invitation invalide 400, mutation sans CSRF 403 et
instantané sans session 401. Le réseau Docker interne et les processus non root
sont contrôlés sur les conteneurs actifs.

L'API de comptes et d'invitations décrite ci-dessous est installée uniquement
dans cette VM privée. Les écrans et le transport web/Android sont implémentés
sur la branche de travail, sans release. La récupération et MFA, la recette
téléphone et les limites d'abus/stockage avant ouverture publique restent
à livrer. **Ne pas exposer ce service sur Internet en l'état.**

## API de comptes privée

Le compte reste facultatif pour l'usage local. Créer un compte ou se connecter
ne publie aucun instantané et n'active pas la synchronisation d'un appareil.
L'identité serveur vient de la session Django, jamais d'un `userId` demandé
par le client. La sortie JSON ne contient pas de credential de session.

| Route | Contrat |
| --- | --- |
| `GET /api/auth/session` | `authenticated`, `user` (ID/username ou null), `csrfToken` masqué et `generation` |
| `POST /api/auth/register` | JSON `username`, `password`, `invitation` ; compte normal et session, HTTP 201 |
| `POST /api/auth/login` | JSON `username`, `password` ; HTTP 200 ou erreur générique 401 |
| `POST /api/auth/logout` | JSON `{}` ; session révoquée, données du compte conservées |

Les POST exigent le cookie CSRF et l'en-tête `X-CSRFToken` obtenu par la
route de session. Connexion et inscription renvoient un nouveau jeton après
rotation. Cookies Secure/HttpOnly/SameSite=Strict, réponses non cachables,
aucun CORS universel ni exemption CSRF. Se déconnecter avant de changer de
compte sur une même session. Les comptes inactifs et les administrateurs
ne peuvent pas se connecter par cette API ; promouvoir un compte en admin
invalide sa session de sync existante. Il n'y a pas d'administration web.

Identifiant normalisé en minuscules : 3 à 32 caractères ASCII, lettres,
chiffres, `_`, `.` et `-`, début alphanumérique. Mot de passe de 12 caractères
minimum, contrôlé par les validateurs Django, 1 024 maximum et Argon2 en
production. Corps JSON de 8 Kio maximum, champs inconnus/dupliqués et chaînes
Unicode malformées refusés avant le hachage.

Les invitations sont créées **uniquement depuis l'administration privée** :

```sh
python manage.py create_sync_invitation --hours 24
```

Le code n'est affiché qu'à l'opérateur. Ne pas publier la sortie ou la
journaliser. Seul son SHA-256 est stocké ; durée configurable de 1 à 168 heures,
usage unique, consommation atomique avec la création du compte. Les codes
d'une ancienne génération/restauration sont invalides. Aucun vrai compte ou
code destiné à un utilisateur n'est créé pendant la recette automatique.

Les budgets sont **par adresse cliente**, par fenêtre de 15 minutes : trente
tentatives par client et par action (connexion et inscription séparées), et
cinq **échecs** de connexion par client et identifiant. Une connexion réussie
ne consomme pas le budget d'échecs ; des échecs venus d'un autre client ne
verrouillent pas le compte ; des inscriptions avec des invitations inventées
ne bloquent jamais les connexions. HTTP 429 indique `Retry-After`. Les clés de
compteurs sont des HMAC, sans nom ni adresse en clair.

L'adresse cliente vient de `REMOTE_ADDR`, sauf si le déploiement nomme
`AUTH_CLIENT_ADDRESS_HEADER`. La configuration de production lit
`X-Forwarded-For`, que l'unique proxy Caddy efface puis réécrit avec l'adresse
réelle ; le backend n'a aucun port publié. Une valeur qui n'est pas une seule
adresse IP partage un budget commun et strict. Derrière un relais qui masque
les adresses (tunnel), tous les clients partagent un budget : à revoir avant
toute ouverture. Purge des compteurs expirés, récupération et MFA restent à
traiter avant publication.

## Limites des publications

`POST /api/sync/publish` refuse avant tout décodage un corps de plus de
16 Mio (413) ou de plus d'un million de conteneurs JSON (400) : 16 Mio de `[]`
coûteraient environ 350 Mo une fois décodés. Un seul décodage ou encodage
volumineux (publication ou lecture d'état) s'exécute à la fois par conteneur,
sous verrou `flock` (`SYNC_HEAVY_LOCK_FILE`). Chaque compte dispose de
120 publications par 15 minutes (429 `too_many_requests`).

Le journal des opérations ne garde que l'empreinte et la révision nécessaires
aux reprises idempotentes, **plus aucune copie d'instantané**. La migration
`0003` supprime les copies historiques et `0004` exécute `VACUUM` : le
déploiement exporte la base avant de migrer, cet export privé reste la seule
trace de l'historique supprimé.

## Effacer un compte

```sh
python manage.py delete_sync_account <identifiant>
```

Supprime le compte, son instantané, ses opérations et ses sessions, puis
exécute `VACUUM`. Les administrateurs sont refusés. Les exports privés déjà
réalisés contiennent encore le compte : les supprimer séparément.

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

La commande ne copie ni le secret Django ni le fichier de génération, ni
aucune session : la table `django_session` est vidée dans la copie puis
`VACUUM` retire ses anciennes pages. Une fuite d'export ne donne donc pas de
session valide ; elle contient toujours les données d'entraînement et les
empreintes Argon2. Elle ne remplace pas une sauvegarde chiffrée hors machine. L'empreinte détecte
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
pas une restauration complète du serveur. Le client ajouté sur cette branche
ne constitue pas encore une publication des écrans et de la synchronisation web/APK.

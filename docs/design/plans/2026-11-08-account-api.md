# Comptes FitTrack — API privée et invitations

**But :** poursuivre les comptes sans intervention au terminal du propriétaire,
avec les sessions Django existantes ; aucune ouverture publique ni release APK.

**Architecture :** endpoints JSON sous `/api/auth/`, cookies Secure/HttpOnly,
CSRF Django sur toutes les mutations. Invitation aléatoire à usage unique,
expirante et liée à la génération externe ; seul son hash est persisté.
Une transaction SQLite IMMEDIATE lie la création de compte à sa consommation.

**Référence :** proposition publique du homelab et README : compte facultatif,
local par défaut, consentement à la sync indépendant de la connexion.

## Contrat

- GET `/api/auth/session` fournit identité courante et jeton CSRF masqué,
  jamais les cookies d'authentification dans le JSON.
- POST `/api/auth/register` : username ASCII 3–32 caractères, password,
  invitation. Création et connexion, sans instantané ni activation de sync.
- POST `/api/auth/login` : username/password. Réponse générique sur échec,
  refus des comptes inactifs et administrateurs (aucun parcours admin public).
- POST `/api/auth/logout` : déconnexion de cette session, données préservées.
- Une session déjà connectée doit être déconnectée avant changement de compte.
- Mot de passe validé avec les validateurs Django (12 caractères minimum),
  hachage Argon2 en production. Aucun secret ni identifiant de compte déterminé
  par un `userId` fourni dans le corps.
- Limites atomiques : cinq tentatives par action/identifiant sur 15 minutes,
  plafond global trente tentatives sur la même fenêtre. Clés HMAC sans nom brut.
  Ces limites initiales ne constituent pas une protection par IP cliente :
  le proxy et Funnel devront être traités avant ouverture publique.
- `create_sync_invitation --hours 24` est une commande privée ; aucune route
  générant des invitations. Les invitations restaurées d'une autre génération
  sont invalides. Les codes ne sont pas générés pour un vrai utilisateur ici.

## Tâches et vérifications

- [x] Tests RED HTTP réels avec CSRF actif, deux comptes et mots de passe stockés hachés.
- [x] Modèles Invitation/AuthRateBucket, migration, service transactionnel et CLI privée.
- [x] Vues et routes : corps borné, champs stricts, aucune donnée sync modifiée.
- [x] Concurrence d'inscription sur un même code, expiration, restauration,
  rotation CSRF/session, rate limit et conservation des données après logout.
- [x] Suite backend complète, migrations, portes frontend et relecture indépendante.
- [ ] Construire les nouvelles images depuis le runtime déjà présent dans la VM,
  sauvegarder avant migration, recette native/HTTPS et réseau sans port publié.

Le client web/APK, la récupération, MFA et la gestion des abus avant exposition
publique suivent séparément. Aucun appel réseau n'est ajouté à l'application.

## Vérification et relecture

- Windows/Python 3.12 : 69 tests, 64 réussites et cinq contrôles POSIX ignorés.
- Frontend : typecheck/lint/build et 3 864 tests réussis, un ignoré (619,98 s).
- Caddy : adaptation/validation natives avec les routes `/api/auth/*` et `/api/sync/*`.
- Relecture indépendante : cookies CSRF explicitement Strict et chaînes JSON
  avec surrogates isolés refusées avant budget/hachage ; régressions RED→GREEN.
  Promotion en administrateur : session normale révoquée immédiatement.
- Différé avant public : purge des compteurs expirés ; test supplémentaire
  de concurrence sur le dernier créneau d'un budget. L'invitation concurrente
  est déjà testée avec deux vrais clients et un seul succès.
- Références : documentation officielle Django 5.2, authentification,
  protection CSRF et validation des mots de passe.

# Client de synchronisation — plan d'implémentation

> Exécution dans la session avec superpowers:executing-plans ; une relecture
> indépendante de la branche complète avant livraison.

**But :** client local-first avec comptes, consentement et instantanés sans perte silencieuse.
**Architecture :** protocole typé, décision pure, repository Dexie transactionnel,
transport web/Android et composant Réglages utilisant les composants existants.
**Stack :** React/TypeScript, Dexie 4, Capacitor 8/Java, Django existant.
**Spécification :** `docs/design/specs/2026-11-08-sync-client-design.md`.

## Contraintes et points de relecture

- Aucun réseau sans action de compte ou consentement ; arrêt immédiat des futurs échanges.
- Réponse tardive, changement de compte, import manuel et séance active ne doivent pas écraser de données.
- Réponse perdue : reprendre exactement le même UUID/corps, même après redémarrage.
- Plusieurs onglets : décisions transactionnelles et réponse d'une ancienne opération sans effet.
- JSON hostile, génération restaurée, cookies natifs expirés/corrompus : refus fermé.

## Tâches

- [x] 1. TDD : protocole et matrice de rapprochement (`src/lib/sync/{types,protocol,decision}.ts`).
  Valider les curseurs/réponses/backup ; tester identiques, local seul, distant seul,
  divergence et génération différente. Empreinte stable hors date/préférences locales.
- [x] 2. TDD : métadonnées et transactions (`src/data/repositories/sync.ts`,
  `src/data/syncControl.ts`, `backup.ts`). Préparer publication durable, réessai exact,
  consentement/compte, garde des données/séances, copie de secours, imports sans consentement.
- [x] 3. TDD : transport et orchestration (`src/platform/syncTransport.ts`,
  `src/stores/sync.ts`). Auth CSRF, limites/erreurs, annulation, polling optionnel,
  session anonyme et compte distinct ; tests avec repository réel et transport simulé.
- [x] 4. Pont Android dédié (`FitTrackSyncPlugin`, stockage Keystore et règles HTTP),
  configuration compile-time et tests Java des règles. Aucune API HTTP générique.
- [x] 5. UI Réglages (`src/features/settings/SyncSettings.tsx`, traductions),
  confirmation, statut, conflits, export de secours. E2E mobile du vrai build :
  absence réseau par défaut, connexion sans sync, opt-in/off, erreurs et conflit.
- [x] 6. Portes frontend/backend et Android disponibles, recette visuelle mobile,
  relecture indépendante, corrections avec régressions, documentation/PROGRESS et
  commits locaux. Déploiement frontend privé seulement si toutes les préconditions passent.

## Registre

- Décision : conserver le schéma Dexie 13 et réserver une entrée de `settings`,
  filtrée sur tous les chemins de sauvegarde/restauration. Le serveur reste compatible.
- Décision : application distante explicite au premier plan, afin de ne pas recharger
  un formulaire ou remplacer une séance active par un effet de polling.
- Relecture indépendante : confirmations liées à la comparaison affichée et
  consentement Android lié à une installation non sauvegardée. Deux régressions
  reproduites RED puis corrigées. Aucun HTTP automatique sur un appareil restauré.
- Validation : 49 champs facultatifs connus supplémentaires et membres de preuves
  du coach contrôlés par le validateur partagé de backup ; 53 cas RED→GREEN.
  Les références de contexte historiques disparues restent lisibles ; les parents
  propriétaires d'une ligne doivent exister. Les préférences de terminal restent locales.
- Réponse d'erreur serveur `toString` : crash reproduit dans Chromium puis corrigé
  avec recherche de propriété propre.
- Native : `loggingBehavior: none` évite les arguments de connexion dans les logs
  Capacitor. Le coffre et l'UUID d'installation sont exclus des sauvegardes Android.
- Recette locale : suite globale 3 949 réussites et un ignoré (628,27 s),
  324 fichiers réussis et un ignoré. Le garde d'arrêt sur refus d'écriture,
  ajouté ensuite, est vérifié avec 33 tests ciblés, dont les dix du coordinateur.
  Typecheck/lint finaux et builds web/Android réussis ; 43 parcours existants
  et huit nouveaux Chromium réussis. Recette visuelle des quatre thèmes,
  formulaire à 200 % sans débordement. API simulée dans les huit parcours client ;
  le backend privé conserve sa recette native réelle de 69 tests.
- Android : sept tests JVM réussis et lint réussi. APK de contrôle local
  `2.17.5-sync-local`, 15 029 176 octets, SHA-256
  `ed3e4ffc0ed899665f1e8eacff6266b6d44547967886b0121e8a7ace7dc6091e`.
  Configuration embarquée vérifiée : logs désactivés, origine publique vide.
  APK ni installé ni publié ; il ne remplace pas un candidat signé pour mise à jour.
- Un refus d'enregistrement de l'arrêt bloque les cycles en mémoire et propose
  de réessayer l'arrêt avant fermeture ; aucune réussite de persistance inventée.
- Transport natif : le plugin CapacitorCookies 8 installe un CookieHandler
  global même si son option JS est désactivée. Le transport final utilise
  directement OkHttp 4.12.1 et `CookieJar.NO_COOKIES`, sans redirection, cache
  ou réessai implicite ; TLS système conservé. Deux tests avec un vrai serveur
  local et un CookieHandler espion vérifient zéro lecture/écriture partagée et
  l'absence de suivi de redirection. Relecture ciblée indépendante sans défaut
  important restant. Licence HTTP incluse dans les ressources de l'APK.
  Version vérifiée : [release officielle 4.12.1](https://github.com/square/okhttp/releases/tag/parent-4.12.1).
- Frontend privé installé : sources web `e426ad50da48c5bf75bab694f2b4a0fb3cf347e0`,
  paquet SHA-256 `fcc3e387fa41106562258bd39cb3f162083829f4eaefbe23604389deb2575431`.
  Index, asset et session HTTPS 200, sync anonyme 401 et `.env` 404, certificat
  vérifié. Backend conservé sur `1ea1703`, conteneur inchangé, aucun port publié.
  Sondes TCP LAN/Internet bloquées, services hôte actifs et garde stocké conforme.
  Empreinte nftables active non relue (reçu `hostVerified: false` conservé).
  Aucun compte réel créé, aucune publication d'APK/PWA ni ouverture publique.
- Seconde relecture indépendante (fonctionnelle et sécurité), corrigée en TDD :
  envoi possible après désactivation (garde synchrone juste avant chaque
  requête, annulation des autres onglets par BroadcastChannel, l'onglet émetteur
  s'ignore) ; copie de secours unique écrasée au remplacement suivant (une ligne
  par copie, suppression seulement confirmée) ; publication refusée renvoyée à
  chaque cycle (abandonnée sur 409, puis comparaison) ; écran Réglages qui
  interrogeait le serveur sans compte (indice de compte non secret, session
  revérifiée à l'activation). Côté serveur : budget de conteneurs JSON avant
  décodage et un seul gros décodage à la fois, plus de copie d'instantané par
  opération (migrations 0003/0004), budgets d'authentification par client et
  échecs seuls, exports sans sessions, effacement de compte. Client homelab
  servi avec une CSP générée au build (empreinte du script inline) et vérifiée
  par un parcours E2E sans violation. Non traité : MFA et récupération de compte.

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
- [ ] 6. Portes frontend/backend et Android disponibles, recette visuelle mobile,
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
- Android : cinq tests JVM réussis et lint réussi. APK de contrôle local
  `2.17.5-sync-local`, 11 214 695 octets, SHA-256
  `0a8961b1a93d03c5033a34f4457133b2278b5a198471c5354668f6287e550267`.
  Configuration embarquée vérifiée : logs désactivés, origine publique vide.
  APK ni installé ni publié ; il ne remplace pas un candidat signé pour mise à jour.
- Un refus d'enregistrement de l'arrêt bloque les cycles en mémoire et propose
  de réessayer l'arrêt avant fermeture ; aucune réussite de persistance inventée.
  Livraison du frontend privé à consigner après sa vérification HTTPS.

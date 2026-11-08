# Client de synchronisation facultative

Suite demandée par « Continue », après livraison privée de l'API. Le contrat
utilisateur reste local par défaut, compte facultatif, consentement par appareil.
Les choix ci-dessous sont ceux de l'implémentation, dans ce cadre délégué.

- Ajouter « Compte et synchronisation » aux Réglages existants, mêmes composants,
  textes français et cibles de 48 px. Inscription sur invitation, connexion,
  session et déconnexion ; jamais de réseau au démarrage sans consentement.
- Connexion seule : aucune lecture/publication d'instantané. Activer exige une
  confirmation nommant le compte et l'envoi des données d'entraînement/planification.
  Désactiver invalide immédiatement les opérations en cours ; une requête déjà
  reçue par le serveur ne peut pas être rappelée. Données locales conservées.
- Instantanés du format actuel, préférences localStorage exclues : apparence,
  voix et consentement restent sur cet appareil. Métadonnées de sync dans un
  réglage réservé exclu des sauvegardes/imports et de la sync, sans credential.
  Restaurer manuellement un backup coupe la sync et invalide les réponses tardives.
- Lien au compte et à l'origine conservé : changer de compte ne réattribue jamais
  automatiquement les données locales. Bloquer la sync vers un autre compte.
- Ancre (génération/révision/empreinte locale), opération sortante durable avec
  UUID et corps exact pour les reprises idempotentes. Validation complète des
  instantanés entrants avant toute utilisation ; refuser les séances actives et
  photos binaires non transportées par le format actuel.
- Polling au premier plan toutes les 30 s et au retour du réseau, uniquement si
  activée. Aucune opération pendant une séance active. Modifications locales
  seules : publication conditionnelle. Distantes seules : proposer leur application
  dans Réglages, sans recharger une saisie en cours à l'insu de l'utilisateur.
  Deux côtés modifiés, premier rapprochement différent ou génération différente :
  conflit explicite, jamais de fusion/écrasement silencieux.
- Un choix de résolution s'applique à la révision et à l'empreinte affichées :
  contrôle atomique dans une transaction Dexie verrouillant toutes les tables,
  l'état du compte/consentement et la présence d'une séance. Si cela a changé,
  refaire le rapprochement. Avant remplacement local, conserver un backup local
  exportable dans les métadonnées. Après import explicite, recharger pour réinitialiser
  les stores. Avant remplacement serveur, conserver sa copie locale exportable.
- Web : requêtes `/api/` de même origine uniquement, cookies HttpOnly du navigateur,
  CSRF, pas de CORS. Build homelab sous `/`, Pages existant inchangé. Aucun secret
  stocké dans IndexedDB/localStorage.
- Android : pont dédié à une origine HTTPS configurée à la compilation, routes et
  méthodes limitées, TLS système sans dérogation ni redirection. Cookies isolés
  de la WebView, chiffrés AES-GCM avec clé AndroidKeyStore, jamais renvoyés au JS.
  Pas d'origine publique inventée : sans configuration, afficher indisponible.
  L'identité d'installation Android est également exclue de la sauvegarde OS :
  un autre appareil restaure les données, jamais le consentement aux échanges.
  Désactiver les logs du pont Capacitor, qui peuvent inclure les arguments de connexion.
- Préparer et vérifier sur les branches actuelles, sans fusion/push/release ni
  accès public. Déployer au besoin le frontend uniquement derrière le proxy privé.
  Tests métier TDD, parcours Chromium mobile, compilation Android si SDK présent ;
  recette téléphone réelle reste à faire avant publication.

# Partage de tout l’historique — Design

**Date :** 2026-08-01  
**Statut :** validé par la demande « applique tout, pas besoin de le demander »

## Objectif

Permettre de partager en une seule action toutes les séances terminées de
l’historique FitTrack, dans le même document Markdown lisible que l’export
d’une séance individuelle.

Cette fonctionnalité n’est pas la sauvegarde JSON restaurable de toutes les
tables prévue au Lot 8. Elle exporte l’historique d’entraînement destiné à être
lu, partagé ou copié.

## Approches considérées

1. **Action directe dans Réglages — retenue.** Réutilise la chaîne existante
   `listHistoricalWorkouts` → `projectCoachExport` → `serializeMarkdown` →
   `shareText`, avec la portée `{ kind: 'all-history' }`. C’est le plus petit
   changement cohérent avec l’interface actuelle.
2. **Nouvel écran d’export.** Utile lorsque CSV, JSON et options d’export seront
   disponibles, mais prématuré pour une seule action.
3. **Sauvegarde JSON complète.** Couvre la restauration de toute la base, pas le
   besoin de partager l’historique ; elle reste au Lot 8.

## Interface

La section « Données » des Réglages reçoit une ligne « Exporter tout
l’historique ». Son sous-titre précise qu’elle partage toutes les séances dans
un document texte lisible. La cible conserve les 48 px minimum déjà garantis
par `ListRow`.

La ligne est désactivée pendant la préparation et lorsque l’historique ne
contient aucune séance terminée. Aucun écran ni option supplémentaire n’est
ajouté.

Après l’action :

- le partage natif est utilisé lorsqu’il existe ;
- le presse-papiers prend le relais si le partage est indisponible ou échoue ;
- une copie réussie ou un échec est annoncé sous la section Données ;
- une feuille de partage fermée par l’utilisateur ne produit aucun message.

## Architecture et flux de données

`SettingsScreen` prépare le Markdown avec `useLiveQuery`, afin qu’aucun accès
Dexie asynchrone ne consomme le geste utilisateur avant l’ouverture de la
feuille de partage Android. La portée canonique est
`{ kind: 'all-history' }` et les `DEFAULT_EXPORT_OPTIONS` restent inchangées.

La lecture de la base reste dans `src/data/repositories/historicalWorkouts.ts`.
La projection et la sérialisation restent pures dans `src/lib/export/`. Le
composant n’importe jamais `db` directement.

Le document conserve l’ordre chronologique existant, exclut les séances
actives, abandonnées ou supprimées, et applique les mêmes règles de séries,
notes, instantanés d’exercice et comptage que l’export individuel.

## Erreurs et cas limites

- Historique vide : action désactivée, aucun partage vide.
- Chargement en cours : action désactivée sans déplacement de mise en page.
- Partage refusé ou indisponible : repli presse-papiers existant.
- Presse-papiers également indisponible : message d’échec dédié à l’historique.
- Nouvelle séance terminée ou modification historique : le document est
  recalculé par la requête réactive.

## Tests

Un test de `SettingsScreen` vérifie le parcours utilisateur avec plusieurs
séances : l’action appelle le partage une seule fois et le texte contient la
portée globale ainsi que toutes les séances. Un second test vérifie que
l’action est désactivée pour un historique vide. Les tests existants de la
projection, de la sérialisation et de l’adaptateur de partage continuent de
couvrir leurs responsabilités propres.

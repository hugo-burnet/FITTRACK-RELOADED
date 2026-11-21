# Réglages en sommaire — design court

> 2026-11-21. L'utilisateur : « tu trouves pas que le menu des paramètres fait un peu bricolage ? », puis, entre
> trois pistes de maquettes (sommaire, page resserrée, tuiles), « A ». Maquettes :
> https://claude.ai/artifact/GoYX4owTtbiRKiaTG9oApr (piste A : Sommaire, Séance, Sauvegarde).

## Pourquoi

Réglages est une seule page de quatre écrans de haut : dix sections à plat, des paragraphes sous presque chaque
option, la sauvegarde coupée en deux sections, « Dépannage » et « À propos » rangés dans les données.

## Ce qui change

**L'écran Réglages devient un sommaire** de cinq lignes ; chacune ouvre sa page et montre son état en sous-titre :

| Ligne | Sous-titre (état) | Page | Contenu de la page |
|---|---|---|---|
| Apparence | le thème courant (« Sombre ») | `/settings/appearance` | le sélecteur de thème et sa phrase |
| Séance | le mode d'annonce (« Sons + voix ») | `/settings/session` | Annonces, Effort et fatigue, Estimation du 1RM, Notifications |
| Coach | le pas par défaut (« 1,125 kg » ou « Selon le matériel ») | `/settings/coach` | Pas de charge par défaut, Volume par muscle |
| Sauvegarde | « Dernière : il y a N jours » ou « Aucune sauvegarde sur cet appareil » | `/settings/backup` | l'état en tête, Exporter tout le compte (JSON), Restaurer, puis « Exporter » : historique lisible, CSV |
| Application | « Prête hors-ligne » ou « Hors-ligne en préparation » | `/settings/app` | Installer, l'état hors-ligne, Base de preuves, Dépannage et données, À propos et crédits |

- Le numéro de version reste où il est. Chaque page a la flèche de retour à gauche (`Screen` `onBack`) vers
  `/settings` ; le retour d'Android y revient aussi (routeur à hash, comme les autres sous-écrans).
- **Une phrase d'aide au plus par groupe.** Les paragraphes actuels ne sont pas supprimés : ils passent derrière
  une ligne « En savoir plus » qui les déplie sur place (un seul composant réutilisé, état local, rien en base).
- Les composants de réglage existants (`AnnouncerSettings`, `EffortPromptSettings`, `OneRepMaxSettings`,
  `NotificationSettings`, `CoachSettings`, `BackupActions`…) sont **déplacés**, pas réécrits ; seul leur texte
  d'aide passe derrière « En savoir plus ».
- Les routes existantes (`/settings/volume`, `/settings/debug`, `/settings/about`) ne changent pas ; leur retour
  pointe vers leur nouvelle page parente (Coach, Application, Application).

## Choix de l'agent (à relire)

- **La Base de preuves reste dans Application.** La maquette proposait de la sortir des réglages, mais c'est son seul
  accès dans l'appli : lui trouver un onglet est une autre décision. Elle reste joignable, une ligne plus bas.
- Le sommaire n'a pas de section « Coach : règle RPE 8 » : la règle n'est pas réglable.

## Hors périmètre

Le style des lignes elles-mêmes (`ListRow`, `Toggle`) ne change pas ; les thèmes Clair, TTY1 et Cyber gardent leur
rendu. Aucun réglage n'est ajouté ni retiré, aucune donnée ne bouge.

## Approches

1. **Un sommaire et cinq sous-pages** (piste A) — retenue par l'utilisateur.
2. Une page resserrée (B) : moins de travail, mais on garde deux écrans à défiler et une sauvegarde noyée.
3. Des tuiles (C) : visuel, moins d'état affiché, motif rare pour des réglages.

## Tests

- Un test par page qu'elle rend ses réglages ; le sommaire rend ses cinq états (dont « Aucune sauvegarde »).
- E2E : les parcours qui passent par Réglages (pas de charge, sauvegarde, volume, mise en page) suivent le nouveau
  chemin ; la mise en page vérifie le sommaire et chaque sous-page sans débordement dans les quatre thèmes ; cibles
  de 48 px.

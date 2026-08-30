# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.
> L'historique détaillé vit dans `docs/progress/` et `docs/journal/`.

**Dernière mise à jour :** 2026-08-30 (**ouverture simplifiée + terminal GRUB** — la barre se
charge sans chute, sol, poussière ni secousse ; les deux phrases apparaissent successivement puis
le rideau révèle l'accueil. Tous les 14 à 28 jours environ, un terminal noir à écriture blanche
(comme GRUB, hors thème) remplace les phrases. Fusionné avec `origin/master` v2.4.0 : paliers,
découpage de l'écran de séance, `docs/design/`. **Checkpoint téléphone : cold start, puis le
terminal noir.**).

## Archives

| Fichier | Contenu |
| --- | --- |
| [journal-2026.md](docs/progress/journal-2026.md) | Sessions 2026 (tutoriel, wiki, investigation) |
| [lots.md](docs/progress/lots.md) | Journaux des lots 0 à 7 |
| [decisions-et-pieges.md](docs/progress/decisions-et-pieges.md) | Décisions, pièges, dette technique |
| [2026-08-29-versions-v0-v1.md](docs/journal/2026-08-29-versions-v0-v1.md) | Versions v0–v1 |

## Checkpoints téléphone encore dus

1. **Ouverture** — fermer l'app, la relancer à froid : plaques, deux phrases, accueil. Puis forcer
   le terminal (clé `fittrack.bootEasterEggAfter` due) : écran noir, glyphes blancs, comme GRUB.
2. **Paliers** — Progression › Paliers (état vide puis historique), carte d'accueil après une
   séance qui en franchit un, thème clair.
3. **Tutoriel** — sélecteur de guidage à quatre modes, série unilatérale menée jusqu'au bout.

## Ouverture simplifiée et terminal GRUB (2026-08-30)

### Ce qui change

- La barre conserve uniquement son chargement de plaques. La chute, la compression, la secousse,
  le sol et la poussière sont supprimés — y compris la « deuxième passe » d'impact encore sur
  `origin/master` au moment de la fusion.
- « Progressive Overload » apparaît, puis « Production was the gym » 180 ms plus tard ; le rideau
  fond ensuite vers l'accueil en opacité seule.
- Durées : 2 180 ms (normal), 3 360 ms (console). Une séance active saute le rideau et **ne
  consomme pas** la date du terminal.
- Une date `fittrack.bootEasterEggAfter` (hors sauvegarde `fittrack:`) programme une variante
  rare tous les 14 à 28 jours. Quatre logs fixes, curseur, `progressive_overload = true`.
  Fond `#000`, glyphes `#fff`, indépendant du thème.
- `prefers-reduced-motion: reduce` : fondus / états statiques, pas de glitch ni de frappe.

### Vérifications

- 17 tests ciblés boot / easter egg verts avant fusion `origin/master`.
- Typecheck, suite et build : à rejouer sur l'arbre fusionné.

## Les paliers (2026-08-29)

Catalogue de 56 seuils acquis à vie, table Dexie `milestones` (schéma 12), rétrospective
d'anniversaire. Aucune notification. Une carte au maximum sur l'accueil. Jeton SVG, le contenu
est le chiffre. Correctifs origin : un seuil retiré ne fait plus taire les anniversaires ;
rattrapage après import Hevy.

## Découpage de l'écran de séance (2026-08-29)

`WorkoutScreen.tsx` sort les feuilles, les gestes, le chargement et les recherches dans des
modules dédiés. Aucun comportement changé, livré dans v2.4.0.

# Jetons de paliers dessinés

Les cinquante jetons de `public/milestones/` sont des illustrations (voir
`docs/design/specs/2026-08-30-milestone-meme-tokens-design.md`). Celui-ci est **généré**, et son
générateur est ici parce que sans lui personne ne saurait refaire l'image.

| Fichier | Produit | Jeton |
|---|---|---|
| `noclip.py` | `public/milestones/noclip.jpg`, 384 × 384 | le palier secret « noclip » : une pluie de glyphes verts |

```bash
python3 scripts/milestone-art/noclip.py
```

Python 3 sans dépendance, et ImageMagick (`convert`) pour l'encodage JPEG. Le dessin est déterministe
(graine fixe) : le même script redonne le même fichier à version d'ImageMagick égale. `--png sortie.png`
garde le PNG intermédiaire, `--out` change la destination, `--quality` règle le JPEG (80 par défaut,
en 4:2:0 : 29 Ko).

Les glyphes sont des traits tracés sur une grille de 5 × 7 points, jamais une police : l'image ne
dépend pas de ce que l'appareil sait afficher. Le jeton fait 384 px, et non 192 comme la plupart des
autres, parce qu'une pluie floue n'est plus une pluie et que le jeton est montré en grand dans la
feuille du bas.

Ce dossier n'est **pas** dans `package.json` : c'est un outil de développement, comme
`scripts/tty1-font/`.

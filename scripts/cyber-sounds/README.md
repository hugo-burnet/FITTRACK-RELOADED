# Sons de la coche du skin Cyber

Quatre sons de validation (et un pour décocher), mixés à partir d'enregistrements des packs de
**Kenney** (kenney.nl), versés au domaine public (CC0, voir `sources/LICENSE-Kenney-CC0.txt`) :
ils peuvent être publiés avec l'app, sans attribution obligatoire. Les sons de Cyberpunk 2077,
eux, appartiennent à leur studio et n'entrent pas dans le dépôt.

Chaque recette empile des échantillons (retard, gain, vitesse), un **corps grave synthétisé** que
ces enregistrements n'ont pas, et une **pièce courte** (réverbération) : c'est ce qui donne le côté
plein, « ASMR ».

| Son | Recette |
|---|---|
| `culasse` | un petit cran métallique, puis le verrou (`metalLatch`) sur un coup sourd : « tchk… TCHAK » |
| `douille` | un clic, puis un étui qui tinte et rebondit deux fois, plus haut et plus court |
| `jeton` | une pile de jetons de casino qu'on pose |
| `interrupteur` | un gros inverseur qui fait « thock », avec une miette de glitch |
| `decocher` | le verrou joué à l'envers, doux, commun aux quatre |

Pour les refaire (Python 3, `numpy`, `soundfile`, `ffmpeg` avec `libmp3lame`) :

```bash
python mix.py   # lit sources/, écrit out/*.mp3
```

Les sources sont tirées de `series-ai/jam-ready-assets` (copie des packs Kenney Impact Sounds,
Interface Sounds, UI Audio, RPG Audio et Casino Audio). Le mixage est déterministe (graine fixe).

# Sons de la coche du skin Cyber

Quatre sons de validation (et un pour décocher), mixés à partir d'enregistrements des packs de
**Kenney** (kenney.nl), versés au domaine public (CC0, voir `sources/LICENSE-Kenney-CC0.txt`) :
ils peuvent être publiés avec l'app, sans attribution obligatoire. Les sons de Cyberpunk 2077,
eux, appartiennent à leur studio et n'entrent pas dans le dépôt.

Ils sont faits pour taper **au téléphone**. Un haut-parleur de téléphone ne rend presque rien sous
200 Hz : un coup sourd à 60 Hz y disparaît, et il ne reste que le cliquetis (c'était le défaut de la
première version, « ça fait pas impact »). Chaque recette empile donc :

- une pointe d'attaque (souffle filtré, 6 ms) et des impacts enregistrés à l'attaque de moins de 2 ms ;
- un **corps synthétisé entre 150 et 400 Hz**, là où le téléphone joue ;
- une **saturation** (les harmoniques font entendre le grave), un **compresseur** (−20 dB, 6:1) et un
  limiteur doux, pour que tout arrive dans les 30 premières millisecondes, vers −6 dBFS efficaces ;
- un passe-haut à 160 Hz, qui retire le sous-grave inutile au téléphone et qui mange la marge.

| Son | Recette |
|---|---|
| `frappe` | un coup de poing sur une plaque de métal : sec, plein, sans traîne |
| `culasse` | un petit cran, puis le verrou (`metalLatch`) sur un vrai coup : « tchk… TCHAK » |
| `surcharge` | un impact numérique, un éclat de crunch écrasé en 6 bits, une miette de glitch |
| `enclume` | une cloche de métal courte sur une pierre : un coup lourd qui sonne un instant |
| `decocher` | le verrou joué à l'envers, sec, commun aux quatre |

Le script affiche, pour chaque son, l'attaque, le niveau efficace des 30 premières ms, la part entre
200 et 800 Hz et ce qu'un haut-parleur de téléphone en garde (deux passe-haut à 250 Hz, grossièrement).

Pour les refaire (Python 3, `numpy`, `soundfile`, `ffmpeg` avec `libmp3lame`) :

```bash
python mix.py   # lit sources/, écrit out/*.mp3
```

Les sources sont tirées de `series-ai/jam-ready-assets` (copie des packs Kenney Impact Sounds,
Sci-Fi Sounds, Interface Sounds, RPG Audio et Foley Sounds). Le mixage est déterministe (graine fixe).

# Sons du skin Cyber

**Retenus** (2026-11-01) : `surcharge` pour la coche, `decocher` pour l'annuler, `glitch` pour
l'arrivée sur un écran. Les trois autres recettes restent pour mémoire.

Quatre sons de validation, un pour décocher et un glitch, mixés à partir d'enregistrements des packs de
**Kenney** (kenney.nl), versés au domaine public (CC0, voir `sources/LICENSE-Kenney-CC0.txt`) :
ils peuvent être publiés avec l'app, sans attribution obligatoire. Les sons de Cyberpunk 2077,
eux, appartiennent à leur studio et n'entrent pas dans le dépôt.

Ils doivent être **percutants, au téléphone**. Deux leçons des versions précédentes :

1. Un haut-parleur de téléphone ne rend presque rien sous 200 Hz. Un coup sourd à 60 Hz y disparaît
   (v1, « ça fait pas impact ») : le corps est synthétisé entre 150 et 400 Hz.
2. Un son propre et compressé reste poli (v2, « ça doit être percutant »). Ce qui percute, c'est un son
   **court** (moins de 0,22 s), une **pointe d'attaque très forte** (une craque de bruit de 4 à 6 ms) et
   un **écrêtage franc**, adouci au-dessus de 9 kHz : les 30 premières ms passent vers −3 à −5 dBFS
   efficaces, presque le double de la v2.

| Son | Recette |
|---|---|
| `detonation` | le « PAF » d'une arme : craque de 4 ms, souffle médium qui meurt en 50 ms, coup qui plonge, culasse derrière |
| `marteau` | métal lourd sur métal, un seul coup, rien qui traîne |
| `frappe` | un coup de poing sur une plaque de métal, resserré |
| `surcharge` | un impact numérique, un éclat de crunch écrasé en 5 bits, deux miettes de glitch |
| `decocher` | le verrou joué à l'envers, sec, commun aux quatre |
| `glitch` | l'arrivée sur un écran : une rafale par image de la déchirure (cinq, toutes les 50 ms), fragments de glitch à vitesse tirée au sort, bruit d'ordinateur écrasé en 4 bits, piaillements carrés ; 0,32 s, environ 3 dB sous la coche |

Le script affiche, pour chaque son, le niveau efficace des 30 premières ms, le rapport crête/efficace
et ce qu'un haut-parleur de téléphone en garde (deux passe-haut à 250 Hz, grossièrement).

Pour les refaire (Python 3, `numpy`, `soundfile`, `ffmpeg` avec `libmp3lame`) :

```bash
python mix.py   # lit sources/, écrit out/*.mp3
```

Les sources sont tirées de `series-ai/jam-ready-assets` (copie des packs Kenney Impact Sounds,
Sci-Fi Sounds, Interface Sounds, RPG Audio et Foley Sounds). Le mixage est déterministe (graine fixe).

# Les clips de la voix

Ce dossier reçoit les enregistrements de l'annonceuse, un fichier `.mp3` par
ligne du script `src/audio/voiceScript.json` : `rest-over-1.mp3`,
`last-set-ahead-2.mp3`, etc.

**Il peut rester vide.** Une phrase sans fichier ne se joue pas, et l'app se
contente alors de ses sons de synthèse — « Sons + voix » se comporte
exactement comme « Sons ». Rien à désactiver, rien qui échoue.

## Fabriquer les clips

```bash
export VOICE_API_KEY="ta-clé-elevenlabs"
export VOICE_ID="l-identifiant-de-la-voix-choisie"
npm run voice:generate            # tout le script
npm run voice:generate -- rest-over-1 rest-over-2   # seulement ces lignes
```

La clé reste dans ton shell. Elle n'entre jamais dans le bundle — règle non
négociable n°3 : le site est public, une clé embarquée est une clé publiée.
Le script tourne sur ta machine, les `.mp3` sont commités, l'app ne connaît
que les fichiers.

## Ce qui compte, à l'oreille

- **Le silence de tête.** Un clip qui met 250 ms à démarrer arrive après le
  tic qu'il double. Coupe le blanc initial.
- **La régularité.** « Trois », « Deux », « Un » doivent durer à peu près
  pareil, sinon le décompte boite.
- **Le personnage.** Administratrice, vouvoiement, aucune chaleur. Elle
  constate ; elle n'encourage pas. C'est le contraste avec l'effort qui fait
  l'effet — une voix qui motive tue la blague en trois séances.

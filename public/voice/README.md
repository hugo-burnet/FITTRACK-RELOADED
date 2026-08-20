# Les clips de la voix

Ce dossier reçoit les enregistrements de l'annonceuse, un fichier `.mp3` par
ligne du script `src/audio/voiceScript.json` : `rest-over-1.mp3`,
`last-set-ahead-2.mp3`, etc.

**Il peut rester vide.** Une phrase sans fichier ne se joue pas, et l'app se
contente alors de ses sons de synthèse — « Sons + voix » se comporte
exactement comme « Sons ». Rien à désactiver, rien qui échoue.

## La règle qui compte avant toutes les autres

**Enregistre à sec.** Aucune réverbération, aucun écho, aucun filtre « radio »
ou « mégaphone » dans les fichiers.

L'écho fait partie du personnage — mais il est **ajouté par l'app à la
lecture**, pas gravé dans les clips. Une réverbération enregistrée ne s'annule
pas, elle s'additionne : deux salles donnent de la bouillie. Pièce mate, micro
proche, pas de salle de bain.

C'est aussi ce qui te permet de changer d'avis sans rien refaire : la salle est
trois constantes dans `src/audio/publicAddress.ts`, pas vingt-trois fichiers.

## Ce que l'app ajoute, exactement

| Étage | Réglage | Pourquoi |
|---|---|---|
| Passe-haut | 170 Hz | Sous cette limite une voix ne porte que du grondement. |
| Présence | +4 dB à 3,2 kHz | Là où se décident les occlusives françaises. À 2,6 kHz, le /t/ de « trois » s'entend comme un /k/ — « croix ». |
| Plateau aigu | +4 dB à 5 kHz | Remplace le passe-bas de l'ancienne chaîne. Celui-ci fabriquait le haut-parleur de sono ; le personnage n'en est plus un. |
| Écho de mur | 110 ms, réinjecté à 17 % | Un mur en face. Deux ou trois retours, puis plus rien. |
| Pièce | ~0,6 s, mix 22 % | Resserrée en même temps que le haut s’ouvrait : une queue brillante s’entend bien plus qu’une queue sourde au même dosage. |

Le carillon d'annonce traverse la même chaîne — c'est la cloche qui précède la
phrase, elle doit venir de la même pièce qu'elle. **Les tics du décompte
restent secs** : un battement noyé dans une salle cesse d'être un battement.

Le tout se coupe dans **Réglages → Annonces → Écho de haut-parleur**, sans rien
régénérer.

## Le personnage

Une administratrice. Elle ne s'adresse pas à toi, elle diffuse une information
dans un lieu où tu te trouves. Vouvoiement, impersonnel, aucune chaleur.

- **Débit** posé, régulier, jamais pressé. Volume constant d'une ligne à
  l'autre. Les phrases **retombent** à la fin : une intonation montante
  transforme un constat en question, et elle ne pose pas de questions.
- **Jamais** de sourire dans la voix, d'ironie, ou d'emphase sur un mot pour le
  « vendre ». Surtout aucun encouragement : « Dernière série » dit avec entrain
  devient un coach, et un coach n'est pas ce personnage.
- Le **déadpan** est la consigne — y compris, et surtout, sur « Vous en aurez
  besoin ».

Chaque ligne du script porte son indication de jeu dans le champ `direction`.
Elle ne sert à rien à un moteur TTS ; elle sert de tout à quelqu'un qui
s'enregistre au micro.

## Fabriquer les clips avec un TTS

```bash
export VOICE_API_KEY="ta-clé-elevenlabs"
export VOICE_ID="l-identifiant-de-la-voix-choisie"
npm run voice:generate            # tout le script
npm run voice:generate -- rest-over-1 rest-over-2   # seulement ces lignes
npm run voice:generate -- --force rest-over-1       # refaire une prise
```

La clé reste dans ton shell. Elle n'entre jamais dans le bundle — règle non
négociable n°3 : le site est public, une clé embarquée est une clé publiée.

Les réglages par ligne, dans le script :

- **`stability`** — plus haut, plus monocorde et plus reproductible. C'est ce
  qu'on veut presque partout, et au maximum sur les décomptes, dont les trois
  mots doivent être interchangeables.
- **`style`** — l'exagération d'intonation. Proche de zéro partout, sauf une
  pointe sur le record.
- **`similarity`** — la fidélité au timbre de la voix source. À laisser haut.

## À l'oreille, avant de commiter

- **Le silence de tête.** Un clip qui met 250 ms à démarrer arrive après le tic
  qu'il double. Coupe le blanc initial, et le blanc final aussi : la traîne,
  c'est l'app qui la fournit.
- **La régularité.** « Trois », « Deux », « Un » doivent durer à peu près
  pareil, sinon le décompte boite.
- **Le format.** mp3, mono, 44,1 kHz, 64 kbps. Vingt-trois lignes tiennent
  largement sous 500 Ko, et le service worker les précache.

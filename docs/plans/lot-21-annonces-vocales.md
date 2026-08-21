# Lot 21 — L'annonceuse (sons, voix, cadence, fatigue)

> Écrit pendant la session du 2026-08-19, à partir du code réellement existant.
> Aucun cadrage préalable dans `00-ROADMAP.md` : la demande est venue de l'utilisateur en cours
> de session, et ce fichier fait office de plan **et** de compte rendu.

**Objectif :** que l'app se fasse entendre. Les yeux sont sur la barre, les mains sont prises, le
téléphone est dans la poche : l'audio est le seul canal libre pendant une séance.

**À ne pas confondre avec le Lot 20**, qui est la saisie _vocale_ (dicter une série). Ici, c'est
l'app qui parle, jamais elle qui écoute. Aucun micro, aucune permission.

## Le besoin, dans les mots de l'utilisateur

> « dans fittrack, tu aurais des sons de notification et des phrases de notification avec une voix
> féminine ia, un peu à la squid game, une sorte d'admin. déjà ça te conserve ton attention et ça
> fait une feat sympa »

> « l'intonation fait tout… et j'aurais bien vu aussi un son qui te donne la cadence et qui te
> valide quand tu as fini. et la voix pourrait te dire : 3, 2, 1, validés. **par contre faut pas
> que le son de la musique sur le côté baisse** »

> « faut aussi prévoir la fatigue. en laissant plus de temps pour faire la rep à la fin ou sur une
> dernière série »

Ton retenu : **administratrice froide**, vouvoiement, aucune chaleur. Elle constate, elle
n'encourage pas — c'est le contraste avec l'effort qui fait l'effet.

---

## Décidé — ne pas rouvrir

- **Tout passe par Web Audio, jamais par `<audio>`.** Un `HTMLAudioElement` demande le focus audio
  à Android, qui l'accorde en _baissant_ ce qui joue. Un `BufferSource` se mélange. C'est une
  exigence de l'utilisateur, pas un détail d'implémentation.
- **Les sons sont synthétisés, la voix est enregistrée.** Zéro octet et zéro licence pour les
  premiers ; le personnage n'existe que dans la seconde. Le TTS de l'appareil a été écarté :
  voix Google neutre, l'effet tombe à plat.
- **Les clips sont optionnels.** Le dépôt porte le _script_ (`src/audio/voiceScript.json`), pas
  forcément les enregistrements. Un clip absent = silence, jamais une erreur, et jamais redemandé.
  « Sons + voix » sans pack se comporte exactement comme « Sons ».
- **L'écho est ajouté à la lecture, jamais enregistré.** Le personnage n'est pas dans le timbre,
  il est dans le haut-parleur et dans la salle. Une réverbération gravée dans les fichiers ne
  s'annule pas et s'additionne à celle de l'app ; elle fige aussi une décision sur vingt-trois
  fichiers, là qu'elle tient en trois constantes.
- **Aucune clé dans le bundle** (règle n°3). `npm run voice:generate` tourne sur la machine de
  l'utilisateur, lit `VOICE_API_KEY` dans l'environnement, écrit des `.mp3` qui sont commités.
- **Un mot en retard est pire que pas de mot.** `voicePack.play` ne joue que ce qui est déjà
  décodé ; un clip pas prêt se met en file pour la fois suivante et la cue passe avec son seul son.
- **Le décompte est programmé sur l'horloge audio**, jamais en `setTimeout` chaînés. Un décompte
  qui dérive s'entend avant d'être faux.
- **Le son ne compte pas les répétitions à ta place.** Le métronome ne se déclenche que sur demande
  explicite (un bouton par carte d'exercice) et jamais sur un échauffement.
- **Repos et répétitions n'ont pas le même battement.** Les trois secondes de repos gardent leur
  tic carré, aigu et urgent. La cadence emploie un « tok » plus bas et arrondi (`repTap`) : deux
  sinus descendants, sans fichier audio, assez présents pour traverser la musique sans fatiguer
  l'oreille sur douze répétitions.

## Les règles de cadence — le vrai travail

Jouer un son est trivial. Décider de **ne pas** en jouer un est la fonctionnalité. `planCue`
(`src/audio/announcer.ts`, 10 tests) :

| Règle                                                 | Pourquoi                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Un **son** part à chaque cue                          | Un son est une information, et il est court.                                                                                    |
| Une **phrase** exige du silence devant elle (`gapMs`) | Deux phrases qui se chevauchent ne s'entendent ni l'une ni l'autre.                                                             |
| Une **priorité plus haute** coupe la parole           | Un record vaut d'interrompre « dernière série ». Rien n'interrompt un record.                                                   |
| Chaque cue a un **temps de repos** (`cooldownMs`)     | Sinon la même phrase revient trois fois en dix secondes.                                                                        |
| Jamais **deux fois de suite la même variante**        | Deux phrases identiques d'affilée : c'est là qu'une voix enregistrée devient une machine.                                       |
| Une cue **muette** ne consomme pas de silence         | `set-validated` sonne trente fois par séance ; s'il ouvrait un délai de grâce, il ferait taire toutes les phrases de la séance. |

## La voix : le personnage, la salle, et ce qui produit quoi

Trois choses différentes, souvent confondues, et qui ne se règlent pas au même endroit.

**1. Le texte** — `voiceScript.json`, champ `text`. Vouvoiement, phrases courtes, aucun
encouragement. C'est le seul étage qui change ce qui est _dit_.

**2. L'intonation** — champ `direction` (pour un humain au micro) et champ `settings` (pour le
moteur TTS). La consigne générale : débit posé, volume constant, **les phrases retombent** — une
intonation montante fait d'un constat une question, et elle n'en pose pas. `stability` haut
partout, au maximum sur les décomptes dont les trois mots doivent être interchangeables ; `style`
proche de zéro sauf une pointe sur le record. Le déadpan est la consigne, y compris — surtout — sur
« Vous en aurez besoin ».

**3. La salle** — `src/audio/publicAddress.ts`, appliquée en direct, identique quelle que soit
l'origine des clips :

| Étage        | Réglage                  | Rôle                                                                                                                       |
| ------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Passe-haut   | 170 Hz                   | Sous cette limite une voix ne porte que du grondement.                                                                     |
| Présence     | +4 dB à 3,2 kHz          | Là où se décident les occlusives françaises. À 2,6 kHz, le /t/ de « trois » s'entend comme un /k/ — « croix ».             |
| Plateau aigu | +4 dB à 5 kHz            | Remplace le passe-bas de l'ancienne chaîne. Celui-ci fabriquait le haut-parleur de sono ; le personnage n'en est plus un.  |
| Écho de mur  | 110 ms, réinjection 17 % | Un mur en face. Deux ou trois retours, pas un canyon.                                                                      |
| Pièce        | ~0,6 s, mix 22 %         | Resserrée en même temps que le haut s’ouvrait : une queue brillante s’entend bien plus qu’une queue sourde au même dosage. |

Le **carillon** d'annonce traverse la même chaîne : c'est la cloche qui précède la phrase, elle doit
venir de la même pièce. Les **tics du décompte et les taps de répétition restent secs** — un
battement noyé dans une salle cesse d'être un battement, et la cadence n'a qu'un seul travail.

Le mélange humide reste sous un tiers : ça s'écoute dans une salle de sport par-dessus de la
musique, et l'intelligibilité passe avant l'atmosphère. Coupable dans Réglages → Annonces.

## La fatigue, en trois endroits

1. ~~**Le tempo de la répétition** (`src/lib/tempo.ts`) — la cadence s'allonge : +0,25 s par série
   déjà faite (plafond +1 s), +0,5 s sur la dernière série de travail, +0,5 s après 45 min de
   séance, **5 s par rep au maximum**.~~ **Retiré en v0.8.8.** Chaque terme se défendait, la somme
   non : l'app décidait du tempo d'un exercice à partir d'un modèle de fatigue qu'elle ne mesure
   pas. Le tempo est désormais **choisi** — chrono dans le bandeau de la carte, valeur portée par
   `WorkoutExercise.repSeconds`, préférence derrière. `src/lib/tempo.ts` ne garde que la grille au
   quart de seconde et la résolution. Les deux autres règles de fatigue ci-dessous n'ont pas
   bougé : elles paient un effort constaté, elles ne prédisent rien.
2. **Le repos, payé à l'effort** (`src/lib/restBonus.ts`) — la bande d'effort sous la série
   validée écrit un RPE en une touche, et ajoute 0 / 15 / 30 / 45 s. **Elle n'enlève jamais de
   repos** : une app qui punit l'honnêteté cesse d'être renseignée honnêtement.
3. **Le repos prolongé s'annonce** (« Repos prolongé. ») — le nombre sur la ligne de repos vient de
   changer, quelque chose doit le dire.

La bande d'effort est **ignorable** : elle s'efface seule après 20 s, comme `UndoRow`. La série est
déjà écrite, le repos déjà lancé. Rien ici n'est une porte fermée.

## La notification Android qu'on rend

Un tic réellement sorti prouve trois choses : le contexte audio tourne, l'app est au premier plan,
l'utilisateur n'a pas coupé le son. Dans cet état, la notification de fin de repos n'est plus un
filet — c'est une seconde alerte une seconde derrière la première, et c'est **elle** qui fait
baisser la musique. Le décompte l'annule donc (`standDownRest`), et pas au début du repos mais à
T−3 s : au pire on perd trois secondes de filet, pas deux minutes.

## Fichiers

| Fichier                                                                | Rôle                                                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/audio/context.ts`                                                 | Le seul `AudioContext`, son déblocage, son volume.                               |
| `src/audio/tones.ts`                                                   | Les quatre sons synthétisés.                                                     |
| `src/audio/voicePack.ts`                                               | Chargement, décodage, cache — et le cache des absences.                          |
| `src/audio/publicAddress.ts`                                           | La salle : haut-parleur, écho de mur, hall.                                      |
| `src/audio/voiceScript.json`                                           | **Source unique** : ce que l'app peut dire, ce que le générateur doit fabriquer. |
| `src/audio/cues.ts`                                                    | Le vocabulaire d'événements et leurs règles.                                     |
| `src/audio/announcer.ts`                                               | La décision. Pur, testé.                                                         |
| `src/audio/announce.ts`                                                | Le câblage : `announce(cue)`, `primeAnnouncer()`, l'aperçu des réglages.         |
| `src/lib/tempo.ts`, `src/lib/restBonus.ts`                             | Les deux règles de fatigue. Pures, testées.                                      |
| `src/features/workout/restCountdown.ts`                                | 3, 2, 1 — et la reprise en main de la notification.                              |
| `src/features/workout/repBeats.ts`, `paceTarget.ts`, `RepPaceRail.tsx` | Le métronome de série.                                                           |
| `src/features/workout/EffortStrip.tsx`                                 | La question « Effort ? », sous sa série.                                         |
| `src/stores/announcer.ts`, `effortPrompt.ts`, `repPacer.ts`            | Réglages et état éphémère.                                                       |
| `scripts/generate-voice.mjs`                                           | Fabrique les clips. Jamais exécuté par l'app.                                    |

## Ce qui reste

- **Écoute en salle du nouveau tap de répétition.** Le profil synthétique est volontairement plus
  bas et plus rond que le tic du repos. Le seul réglage encore empirique est son gain face à une
  vraie musique dans des écouteurs ; ne pas remonter l'aigu pour le rendre audible, augmenter le
  gain du `repTap` si nécessaire.
- **Les 23 clips sont présents et normalisés.** La prochaine passe voix est une écoute sur le
  haut-parleur du téléphone, pas une nouvelle génération.

## ✅ Checkpoint manuel (téléphone)

- [ ] Musique lancée dans Spotify, séance ouverte : valider une série ne fait **pas** baisser la
      musique.
- [ ] Un repos de 90 s : trois tics aux trois dernières secondes, puis le carillon — et **une
      seule** alerte, pas la notification en plus.
- [ ] Écran éteint, téléphone en poche : la notification Android sonne toujours à la fin du repos.
- [ ] Bande « Effort ? » sous la série validée ; « Dur » ajoute 30 s à la ligne de repos.
- [ ] Chrono du bandeau d'un exercice → feuille « Cadence » : le tempo se règle au quart de
      seconde, « Lancer la cadence » arrête le repos et fait apparaître la cadence, et le même
      chrono — devenu carré — l'arrête (depuis v0.8.8).
- [ ] Le « tok » des répétitions reste audible avec de la musique sans devenir agressif sur une
      série de 12 ; le tic aigu reste réservé aux trois dernières secondes du repos.
- [ ] Réglages → Annonces → « Silence » : plus rien ne sort, immédiatement.
- [ ] « Écho de haut-parleur » : le carillon change de pièce en une touche, les tics du décompte
      ne bougent pas.

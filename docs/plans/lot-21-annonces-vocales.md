# Lot 21 — L'annonceuse (sons, voix, cadence, fatigue)

> Écrit pendant la session du 2026-08-19, à partir du code réellement existant.
> Aucun cadrage préalable dans `00-ROADMAP.md` : la demande est venue de l'utilisateur en cours
> de session, et ce fichier fait office de plan **et** de compte rendu.

**Objectif :** que l'app se fasse entendre. Les yeux sont sur la barre, les mains sont prises, le
téléphone est dans la poche : l'audio est le seul canal libre pendant une séance.

**À ne pas confondre avec le Lot 20**, qui est la saisie *vocale* (dicter une série). Ici, c'est
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
  à Android, qui l'accorde en *baissant* ce qui joue. Un `BufferSource` se mélange. C'est une
  exigence de l'utilisateur, pas un détail d'implémentation.
- **Les sons sont synthétisés, la voix est enregistrée.** Zéro octet et zéro licence pour les
  premiers ; le personnage n'existe que dans la seconde. Le TTS de l'appareil a été écarté :
  voix Google neutre, l'effet tombe à plat.
- **Les clips sont optionnels.** Le dépôt porte le *script* (`src/audio/voiceScript.json`), pas
  forcément les enregistrements. Un clip absent = silence, jamais une erreur, et jamais redemandé.
  « Sons + voix » sans pack se comporte exactement comme « Sons ».
- **Aucune clé dans le bundle** (règle n°3). `npm run voice:generate` tourne sur la machine de
  l'utilisateur, lit `VOICE_API_KEY` dans l'environnement, écrit des `.mp3` qui sont commités.
- **Un mot en retard est pire que pas de mot.** `voicePack.play` ne joue que ce qui est déjà
  décodé ; un clip pas prêt se met en file pour la fois suivante et la cue passe avec son seul son.
- **Le décompte est programmé sur l'horloge audio**, jamais en `setTimeout` chaînés. Un décompte
  qui dérive s'entend avant d'être faux.
- **Le son ne compte pas les répétitions à ta place.** Le métronome ne se déclenche que sur demande
  explicite (un bouton par carte d'exercice) et jamais sur un échauffement.

## Les règles de cadence — le vrai travail

Jouer un son est trivial. Décider de **ne pas** en jouer un est la fonctionnalité. `planCue`
(`src/audio/announcer.ts`, 10 tests) :

| Règle | Pourquoi |
|---|---|
| Un **son** part à chaque cue | Un son est une information, et il est court. |
| Une **phrase** exige du silence devant elle (`gapMs`) | Deux phrases qui se chevauchent ne s'entendent ni l'une ni l'autre. |
| Une **priorité plus haute** coupe la parole | Un record vaut d'interrompre « dernière série ». Rien n'interrompt un record. |
| Chaque cue a un **temps de repos** (`cooldownMs`) | Sinon la même phrase revient trois fois en dix secondes. |
| Jamais **deux fois de suite la même variante** | Deux phrases identiques d'affilée : c'est là qu'une voix enregistrée devient une machine. |
| Une cue **muette** ne consomme pas de silence | `set-validated` sonne trente fois par séance ; s'il ouvrait un délai de grâce, il ferait taire toutes les phrases de la séance. |

## La fatigue, en trois endroits

1. **Le tempo de la répétition** (`src/lib/tempo.ts`) — la cadence s'allonge : +0,25 s par série
   déjà faite (plafond +1 s), +0,5 s sur la dernière série de travail, +0,5 s après 45 min de
   séance, **5 s par rep au maximum**. En secondes, jamais en pourcentage — même raisonnement que
   les crans de charge du programme.
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

| Fichier | Rôle |
|---|---|
| `src/audio/context.ts` | Le seul `AudioContext`, son déblocage, son volume. |
| `src/audio/tones.ts` | Les quatre sons synthétisés. |
| `src/audio/voicePack.ts` | Chargement, décodage, cache — et le cache des absences. |
| `src/audio/voiceScript.json` | **Source unique** : ce que l'app peut dire, ce que le générateur doit fabriquer. |
| `src/audio/cues.ts` | Le vocabulaire d'événements et leurs règles. |
| `src/audio/announcer.ts` | La décision. Pur, testé. |
| `src/audio/announce.ts` | Le câblage : `announce(cue)`, `primeAnnouncer()`, l'aperçu des réglages. |
| `src/lib/tempo.ts`, `src/lib/restBonus.ts` | Les deux règles de fatigue. Pures, testées. |
| `src/features/workout/restCountdown.ts` | 3, 2, 1 — et la reprise en main de la notification. |
| `src/features/workout/repBeats.ts`, `paceTarget.ts`, `RepPaceRail.tsx` | Le métronome de série. |
| `src/features/workout/EffortStrip.tsx` | La question « Effort ? », sous sa série. |
| `src/stores/announcer.ts`, `effortPrompt.ts`, `repPacer.ts` | Réglages et état éphémère. |
| `scripts/generate-voice.mjs` | Fabrique les clips. Jamais exécuté par l'app. |

## Ce qui reste

- **Les clips.** Le script compte 23 lignes ; aucune n'est enregistrée. Tant qu'elles manquent,
  l'app sonne mais ne parle pas. `npm run voice:generate` avec une clé, puis écoute avant commit :
  un blanc en tête de clip retarde tout le décompte.
- **Le silence de tête et la régularité** sont les deux seuls critères qui comptent à
  l'enregistrement ; « Trois », « Deux », « Un » doivent durer pareil.

## ✅ Checkpoint manuel (téléphone)

- [ ] Musique lancée dans Spotify, séance ouverte : valider une série ne fait **pas** baisser la
      musique.
- [ ] Un repos de 90 s : trois tics aux trois dernières secondes, puis le carillon — et **une
      seule** alerte, pas la notification en plus.
- [ ] Écran éteint, téléphone en poche : la notification Android sonne toujours à la fin du repos.
- [ ] Bande « Effort ? » sous la série validée ; « Dur » ajoute 30 s à la ligne de repos.
- [ ] Bouton métronome sur une carte : le tempo affiché passe de 3 s à 3,5 s sur la dernière série.
- [ ] Réglages → Annonces → « Silence » : plus rien ne sort, immédiatement.

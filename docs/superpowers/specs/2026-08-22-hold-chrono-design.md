# Chrono de série chronométrée — design

> **Date :** 22 août 2026 · **Branche :** `codex/tutorial-v2-p1-tail`
> **Statut :** validé par l'utilisateur avant écriture du plan.
> **Suite :** l'unilatéral (une ligne, deux côtés) se pose sur ce socle et fait
> l'objet de sa propre spec.

## 1. Le manque

`measurementType` distingue les exercices chronométrés depuis le Lot 2. La
colonne « secondes » de la grille se saisit **à la main**, et rien dans l'app ne
compte ce temps : pour un gainage, une planche, un dead hang ou un rameur, il
faut sortir de FitTrack et ouvrir le chronomètre du téléphone. C'est exactement
le geste que la règle « mobile-first, une main, en sueur » interdit, et c'est
signalé depuis l'usage réel.

Le chrono comble ce manque et supprime au passage la saisie manuelle des
secondes : la durée tenue est écrite par le geste qui valide la série.

## 2. Ce qui est décidé

1. **Temps écoulé, pas décompte.** Les repères disent où on en est, toutes les
   5 s, de 5 s à 3 min. Un gainage à l'usure n'a pas de cible ; un décompte
   n'aurait rien à décompter.
2. **Départ par la porte existante.** Le chronomètre du bandeau ouvre la feuille
   de cadence ; « Démarrer » lance une préparation de 10 s (annonce, puis 3-2-1
   à T−3), puis le chrono compte. La fin du repos de la série précédente
   enchaîne toute seule, exactement comme pour les répétitions.
3. **La coche fait tout, en un geste.** Elle arrête le chrono, écrit la durée
   tenue dans la cellule et valide la série — puis repos, RPE et records
   suivent leur chemin habituel.
4. **Moins deux secondes.** On tape *après* avoir relâché. Sans correction,
   chaque série serait sur-notée de deux secondes, à chaque fois, pour
   toujours. `HOLD_RELEASE_SECONDS = 2`, constante nommée et commentée — pas un
   réglage : c'est un nombre qu'on règle une fois, et qu'on corrige en une ligne
   s'il est faux en salle.
5. **La cible n'arrête rien.** Une série qui prescrit 45 s voit son repère
   annoncé à l'échéance, et le chrono continue : une cible est un objectif, pas
   une limite.
6. **Aucun échauffement.** `prepareNextPace` refuse déjà les échauffements et
   ce n'est pas rouvert : un échauffement est là où on trouve sa journée, être
   cliqué dessus est exactement la mauvaise aide.

## 3. Architecture

La cadence de répétitions et le chrono de maintien sont le même objet vu deux
fois : une fenêtre de préparation, une horloge qui appartient à **un** set, une
fin. `repPacer` n'est pas fusionné dans une horloge générique — c'est un chemin
audio lourdement testé et le fusionner ferait porter le risque de cette
fonctionnalité sur les répétitions, qui marchent. Le chrono est un jumeau, et
l'arbitrage entre les deux est explicite et testé.

| Module | Rôle | Nature |
|---|---|---|
| `audio/holdMarks.ts` | `HOLD_MARK_SECONDS` (5 → 180, pas de 5) et le cue d'un repère ; importé par `audio/cues.ts` | pur, TDD |
| `features/workout/holdDuration.ts` | `heldSecondsAt(startedAt, tappedAt)` : écoulé arrondi moins le relâchement | pur, TDD |
| `features/workout/holdBeats.ts` | `holdBeats()`, `pendingHoldBeats()`, `armHoldChrono()` — calqué sur `repBeats.ts` | pur + timers, TDD |
| `stores/holdTimer.ts` | état éphémère `{ rowId, setId, startedAt }`, jumeau de `repPacer` | store |
| `features/workout/HoldRail.tsx` | le relevé : « Départ · 7 », puis « 1:12 » | affichage |

### La cible de cadence devient discriminée

`paceTarget.ts` passe d'une cible unique à une union :

```ts
type PaceTarget =
  | { kind: 'reps'; setId: string; reps: number; repSeconds: number }
  | { kind: 'hold'; setId: string };
```

`prepareNextPace` reçoit désormais le type de mesure de la ligne. La différence
structurante tient en une phrase : **une série timée sans valeur saisie est
`ready`, pas `missing-reps`.** Sur un gainage à l'usure il n'y a rien à taper
avant de partir, là où une série en répétitions ne peut pas être cadencée sans
savoir combien de fois battre.

`useWorkoutPace` reste le seul arbitre. Il garantit qu'une seule des deux
horloges tourne à un instant donné — le même invariant que « un seul repos à la
fois », et il est épinglé par un test plutôt que laissé à la discipline.

### Les 36 repères

Chaque repère est un `CueId` à part entière : il faut jouer **le** bon nombre,
et le mécanisme d'annonce tire au sort parmi les clips d'un cue. Les 36 entrées
ne sont pas écrites à la main : `HOLD_MARK_SECONDS` est le seul littéral, le
type `hold-${…}` en dérive, et les définitions sont générées depuis ce tableau.

Chaque repère porte une **tonalité douce**, pour que le mode « sons » ne soit
pas muet sur un gainage — ce serait rater le besoin d'origine. **Le mode
Silence reste silencieux**, sans exception.

Au-delà de 3 min, le chrono continue à l'écran et se tait : aucun repère n'est
inventé sans clip derrière lui.

## 4. La voix — ce qui n'est pas fait maintenant

Les 36 clips ne sont **ni déclarés dans `voiceScript.json`, ni générés** dans ce
lot. C'est la même règle que les douze textes P1 : un identifiant déclaré sans
MP3 est un silence qui se fait passer pour une phrase. Ils rejoignent l'audit
voix déjà prévu, après validation des transcriptions françaises.

Transcriptions proposées, à valider : « cinq », « dix », … « cinquante-cinq »,
« une minute », « une minute cinq », … « deux minutes cinquante-cinq »,
« trois minutes ».

## 5. Ce qui est testé

- `heldSecondsAt` : le relâchement est retiré, le résultat ne descend jamais
  sous zéro, un tap immédiat ne note pas une durée négative.
- `holdBeats` : 36 repères, aux bons instants, dérivés d'un `startedAt` absolu
  et jamais accumulés — même règle que `repBeats`.
- `pendingHoldBeats` : un chrono armé en retard garde les repères qu'il peut encore
  honorer.
- Une seule horloge à la fois : démarrer un maintien arrête la cadence, et
  réciproquement.
- Une série timée validée à la main, sans chrono, garde exactement son
  comportement actuel.
- Une horloge ne survit pas à la suppression du set qu'elle suit.
- Un échauffement chronométré n'arme aucun chrono.

## 6. Ce qui n'est pas persisté, et pourquoi

Rien. Le chrono vit dans un store éphémère, comme le repos et la cadence
(ADR-004). Un maintien perdu par un kill coûte **une série mal notée**, pas une
séance : la règle n°4 protège les séries validées, elle n'a rien à dire sur une
horloge en cours. La durée, elle, est écrite en base au moment de la coche —
c'est-à-dire par le chemin d'écriture qui existe déjà.

## 7. Hors périmètre

- L'unilatéral : sa propre spec, posée sur celle-ci.
- Rendre le relâchement réglable.
- Les repères au-delà de 3 min.
- Toute génération de voix.

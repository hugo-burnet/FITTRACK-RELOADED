# Première séance et premières DOMS — conception

**Date :** 31 août 2026

**Statut :** validé (sections 1–4)

**Plan d'exécution :** `docs/design/plans/2026-08-31-first-session-doms-paliers.md`

## 1. Objectif

Deux paliers à vie, les premiers de la pratique :

1. **Ta première séance** — à l'enregistrement de la première séance close.
   Jeton : Giga Chad, abdos absurdes, tête de golem de pierre façon Malphite.
   Légende : `Rock solid.`
2. **Tes premières DOMS** — 48 h après cette même séance. Jeton : un type
   raide qui n'arrive pas à ouvrir une porte. Légende : la douleur, FitTrack
   est toujours là, on ne lâche pas.

Sur un compte neuf : la carte d'accueil après la première séance, puis le
badge à la relance 48 h plus tard. Sur l'APK seulement : une notification
locale pile à 48 h. Sur la PWA : pas de pop-up, pas de notif.

Sur un compte déjà en route (le nôtre, un import Hevy, une restauration) : les
deux s'écrivent **acquittés**, sans carte ni notif.

## 2. Approches considérées

1. **Moteur + horloge injectée (retenu).** `sessions-1` réutilise
   `session_count`. `doms-48` est un genre nouveau, `now` passé par l'appelant.
   Relancer l'app suffit pour écrire les DOMS. L'APK arme une notif seulement
   si la première séance a été fêtée en direct.
2. **Comme les années de pratique.** Les DOMS n'existent qu'après une *deuxième*
   séance close. Refusé : le badge PWA à la relance disparaît.
3. **Deux cas spéciaux hors moteur.** Le dépôt écrit les IDs à la main.
   Refusé : deux paliers qui ne se comportent comme personne.

## 3. Catalogue

Groupe **Pratique**, insérés **avant** `sessions-10`.

| id | kind | seuil | titre |
|---|---|---|---|
| `sessions-1` | `session_count` | 1 | Ta première séance |
| `doms-48` | `hours_since_first_session` | 48 | Tes premières DOMS |

`sessions-1` n'utilise pas le gabarit `{value} séances` : « 1 séances » n'est
pas du français. Même exception que `years-1` → « Un an de pratique ».

`doms-48` a sa phrase entière, pas un gabarit. Le jeton affiche `48`.

Les identifiants ne se renomment pas. Le plafond du catalogue reste 60 ; on
passe de 56 à 58.

**Datation.** `sessions-1` : `startedAt` de la première séance close, même
définition de « séance » que `sessions-10`. `doms-48` : `startedAt + 48 h`,
rattaché au même `workoutId`. Ouvrir l'app à +72 h ne recule pas la date : le
palier est dû à +48 h, l'anniversaire restera stable. Une deuxième séance à
+24 h ne décale rien.

**Ce que ce n'est pas.** `training_years` attend encore une séance après
l'anniversaire. Les DOMS, non. Relancer l'app suffit. Effacer la première
séance retire les deux — la preuve a disparu, comme pour n'importe quel palier.

## 4. Moteur

`earnMilestones` reste pur. L'entrée gagne `now?: number`.

- Absent → le genre `hours_since_first_session` ne rend rien. Les tests
  existants ne passent pas `now` et ne voient donc pas `doms-48`.
- Présent, première séance connue, `now >= startedAt + 48 h` → `doms-48`,
  `achievedAt = startedAt + 48 h`, `value = 48`.
- Présent, trop tôt → rien. 47 h 59 : pas encore. 48 h 00 : si.

Le dépôt passe toujours `Date.now()` (ou un `now` de test). L'horloge de
l'appareil n'est pas corrigée : même contrat que les anniversaires.

Nouveau `MilestoneKind` : `hours_since_first_session`. Le `switch` de
`firstCrossing`, `titleOf` et `naturalThreshold` l'ajoutent. Un `kind` oublié
dans l'un des trois est un palier muet ou un titre brut — les tests de
catalogue / lecture ferment la classe.

## 5. Projection, fête, rattrapage

`MILESTONES_PROJECTION_VERSION` passe de 1 à 2. Le bump existant
(`ensureMilestoneProjection`) tourne en `celebrate: false` : chez nous, et
après un import, les deux lignes naissent acquittées.

**Drapeau de suivi** — clé settings `milestoneDomsFollowUp`, valeur
`{ dueAt: number }`. Il n'existe que si `sessions-1` vient d'être *créé* avec
`celebrate: true` (première séance vécue dans l'app, pas un rattrapage).
`dueAt` = `achievedAt` de `sessions-1` + 48 h.

Sans ce drapeau, `doms-48` s'écrit toujours acquitté, même s'il tombe au
lancement. C'est ce qui empêche un import Hevy daté d'hier de fêter les DOMS
demain matin.

**Boot et retour au premier plan** (`initializePersistentData`, déjà non
bloquant ; `appStateChange` actif dans `NativeRuntimeBridge` pour l'APK) :

1. Si la version de projection est périmée : `syncMilestones({ celebrate: false })`,
   écrire la version.
2. Sinon : `syncMilestones({ celebrate: drapeau présent })`.
3. Réconcilier la notif APK (ci-dessous).

Un échec ici n'empêche pas l'app de s'ouvrir.

Le cold start PWA relance `initialize` : relancer l'onglet suffit. Un onglet
laissé ouvert 48 h n'est pas une relance, on n'installe pas d'intervalle. Sur
Android, l'app reste souvent en mémoire : sans sync au `appStateChange`, les
DOMS n'apparaîtraient qu'après un kill. C'est pour ça que le pont natif
resynchronise au retour.

**Après une séance close** : inchangé, `celebrate: true`. Si `sessions-1` est
dans les lignes créées, poser le drapeau et armer la notif. Le retour accueil
montre déjà la carte — pas de feuille sur l'écran de fin, pas de pop-up PWA.

**Réconciliation après chaque sync.**

| État | Drapeau | Notif APK |
|---|---|---|
| `sessions-1` absent | effacé | annulée |
| `doms-48` présent | effacé | annulée |
| `sessions-1` oui, `doms-48` non, drapeau oui, `now < dueAt` | conservé | (ré)armée à `dueAt` |
| `sessions-1` oui, `doms-48` non, drapeau non | rien | rien |

`clearAll()` de séance (workout + repos) **ne touche pas** cet id. Les rappels
survivent déjà ; les DOMS aussi.

## 6. Notification APK

Uniquement `isNativeAndroid()`. PWA : zéro programmation, zéro pop-up. Le
badge d'accueil à la relance suffit.

- Id : `41004` (`DOMS_NOTIFICATION_ID`). Hors de `clearAll`, hors de la plage
  des rappels `41100+`.
- Canal dédié `fittrack-doms`, importance 4, vibration, comme les rappels :
  l'app est fermée, c'est tout l'intérêt. Pas d'interrupteur dans Réglages —
  c'est un one-shot, pas un rappel de séance. RF-53 ne s'étend pas.
- `schedule.at = new Date(dueAt)`, `allowWhileIdle: true`, `autoCancel: true`.
- Titre : `Tes premières DOMS`. Corps : `La porte résiste. Toi aussi.` Pas
  d'image dans la notif : le mème se voit dans l'app.
- Taper ouvre l'accueil. Le boot a déjà synchronisé : la carte est là.
- Permission refusée, alarme exacte refusée, Capacitor qui jette : la séance
  s'est enregistrée, le palier s'écrira, le badge à la relance suffit. La notif
  n'est jamais une barrière.

## 7. Surfaces

Rien de nouveau à inventer.

- Accueil : `HomeMilestoneCard`, une carte max, fermeture au doigt. PWA et APK.
- Feuille : `MilestonePeek`, image pleine largeur, légende d'une à trois
  phrases. `Rock solid.` est l'exception anglaise, demandée, testée telle
  quelle.
- Mur : `MilestonesScreen`. `?demoPaliers=1` (DEV) itère le catalogue, les
  deux nouveaux viennent tout seuls. Le commentaire « 56 jetons » passe à 58.

Pas de 4ᵉ carte, pas de toast, pas de feuille sur l'écran de fin.

## 8. Visuels et copies

Deux JPEG originaux dans `public/milestones/`, ~192 px, précachés, `BASE_URL`.
Pas de splash Riot, pas de photo volée, Nintendo dehors. Même contrat que
Pepe : un hommage, pas un scan.

| palier | clé | image | légende |
|---|---|---|---|
| `sessions-1` | `rock-solid` | Corps Giga Chad, abdos absurdes, tête de golem de pierre façon Malphite. Lisible à 64 px. | `Rock solid.` |
| `doms-48` | `doms-door` | Un type raide, deux mains sur une poignée, le dos qui refuse. | `Ça fait mal. FitTrack est toujours là. Tu lâches pas.` |

Les deux clés ne se partagent avec aucun autre palier. Le test « ne répète que
gigachad et rare Pepe » reste vrai.

i18n, toutes les chaînes dans `src/i18n/fr.ts` :

- `milestone.sessionOne` — Ta première séance
- `milestone.doms` — Tes premières DOMS
- `milestone.art.rock-solid` — Rock solid.
- `milestone.art.doms-door` — Ça fait mal. FitTrack est toujours là. Tu lâches pas.
- `androidNotification.domsChannel` / `domsChannelDescription`
- `androidNotification.domsTitle` — Tes premières DOMS
- `androidNotification.domsBody` — La porte résiste. Toi aussi.

Le test des légendes cesse d'exiger « une phrase française » pour *chaque*
clé : `rock-solid` est anglais. Il exige une légende non vide, et l'égalité
exacte sur `rock-solid` et `doms-door`.

## 9. Bords

- **47 h 59 / 48 h 00.** Frontière inclusive à 48 h pile.
- **Deuxième séance avant 48 h.** Ignore. Le compteur part de la première.
- **Horloge de l'appareil reculée ou avancée.** On ne corrige pas.
- **Séance vide** (zéro série validée, quand même close). C'est une séance pour
  `sessions-10` ; ça en est une pour `sessions-1`. On n'invente pas un filtre.
- **Première séance effacée.** Les deux paliers orphelins sautent, drapeau
  effacé, notif annulée.
- **App ouverte pile à 48 h.** Pas d'intervalle. Cold start, `appStateChange`
  actif (APK), ou prochaine séance close. La notif APK sonne à l'heure même si
  l'app est fermée.
- **Reinstall APK, IndexedDB intacte.** La réconciliation au boot réarme.

## 10. Tests (TDD, moteur d'abord)

1. Une séance ⇒ `sessions-1` daté de son `startedAt`. Zéro séance ⇒ ni l'un ni
   l'autre.
2. `now` absent ⇒ pas de `doms-48`, même avec une séance vieille.
3. `now = startedAt + 48 h - 1` ⇒ pas de DOMS. `now = startedAt + 48 h` ⇒
   `doms-48`, `achievedAt = startedAt + 48 h`, `workoutId` de la première.
4. Une deuxième séance à +24 h ne change ni la date ni le `workoutId` des DOMS.
5. Dépôt : `celebrate: false` écrit les deux avec `acknowledgedAt > 0` dès
   qu'ils sont dus. `celebrate: true` sans drapeau n'arrive pas pour les DOMS
   au boot — le drapeau n'est posé que si `sessions-1` vient d'être créé fêté.
6. Notif : armée seulement si drapeau, jamais après un import / bump de
   projection. Annulée si la première séance disparaît. Absente de `clearAll`.
7. Copie : `milestoneReading('sessions-1', 1).title === 'Ta première séance'`.
   Légendes exactes pour `rock-solid` et `doms-door`. Mapping : 58 ids, chaque
   nouvelle clé utilisée une fois, JPEG présent.
8. Catalogue : longueur ≤ 60, `sessions-1` avant `sessions-10` dans la famille
   `session_count`.

Les JPEG ne se testent pas au pixel. Le mapping id → clé et l'existence du
fichier, si.

## 11. Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/milestones/types.ts` | `hours_since_first_session`, `now?` |
| `src/lib/milestones/catalogue.ts` | `sessions-1`, `doms-48` |
| `src/lib/milestones/engine.ts` | franchissement à +48 h |
| `src/lib/milestones/art.ts` | clés `rock-solid`, `doms-door` |
| `src/data/repositories/milestones.ts` | v2, `now`, drapeau, boot |
| `src/data/initialize.ts` | sync au-delà du seul bump |
| `src/platform/nativeNotifications.ts` | canal, id 41004, schedule / cancel |
| `src/platform/NativeRuntimeBridge.tsx` | sync + réconciliation au `appStateChange` |
| `src/i18n/fr.ts` | titres, légendes, notif |
| `src/features/milestones/milestoneCopy.ts` | `sessionOne`, `doms` |
| `public/milestones/rock-solid.jpg` | jeton première séance |
| `public/milestones/doms-door.jpg` | jeton DOMS |

Les composants d'accueil et de mur ne changent pas de comportement : ils lisent
le catalogue et la table.

## 12. Hors périmètre

- Interrupteur Réglages pour ce one-shot.
- Image dans la notification système.
- Pop-up ou feuille sur l'écran de fin.
- Recaler les DOMS sur `endedAt` (le moteur des séances n'a que `startedAt`).
- D'autres messages à +24 h, +72 h, ou après chaque séance.
- Nintendo, art officiel Riot, photos de mèmes copyrightés.

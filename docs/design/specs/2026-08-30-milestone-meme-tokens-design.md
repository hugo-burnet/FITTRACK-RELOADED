# Jetons de paliers en mèmes — conception

**Date :** 30 août 2026

**Statut :** validé (set visuel + mapping 56/56)

**Plan d'exécution :** `docs/design/plans/2026-08-30-milestone-meme-tokens.md`

## 1. Objectif

Remplacer le disque chiffré de l'onglet Paliers (et de la carte d'accueil) par
un jeton-image : un mème internet 2000–2026, illustration originale embarquée.
Le chiffre reste dans le titre. Rien de ce qui n'est pas acquis n'est montré.

## 2. Approches considérées

1. **Illustrations originales embarquées (retenu).** 22 JPEG dans
   `public/milestones/`, mapping statique id → clé, URL via `BASE_URL`. Hors-ligne,
   pas de clé, pas de réseau. Les originaux copyrightés (Boy's Club, Getty,
   Kabosu, KC Green, etc.) ne sont pas copiés.
2. **Disque chiffré (actuel).** Lisible, zéro poids, zéro risque. Refusé : trop
   pauvre une fois qu'on a vu les jetons.
3. **Hommages géométriques SVG.** Refusé : on ne reconnaît pas l'univers.
4. **Fichiers originaux des mèmes.** Refusé : dépôt public, strike.

Nintendo reste dehors. Pepe est dedans, en illustration originale (feels good,
smug, feels bad, rare holographic) — pas un scan de *Boy's Club*.

## 3. Forme du jeton

- Carré arrondi (`rounded-xl`), **pas** un disque : un cercle coupe les visages.
- 48×48 px dans la liste, 56×56 px (`h-14`) sur la carte d'accueil.
- `object-cover`. Pas de chiffre superposé : le titre à côté le dit déjà.
- Accent (carte « vient de tomber ») : anneau `ring-2` accent, pas un fond orange
  qui noie l'image.
- `aria-hidden` + `alt=""` : le titre adjacent porte le nom.

## 4. Mapping

Une famille **monte** : wojak / we go jim → doge / stonks → smug / gigachad →
rare Pepe. Git gud est réservé à la première traction. Rare Pepe aux plafonds.

| id | clé |
|---|---|
| bench-60 | we-go-jim |
| bench-80 | doge |
| bench-100 | stonks |
| bench-120 | pepe-smug |
| bench-140 | pepe-rare |
| squat-60 | leg-day |
| squat-100 | stonks |
| squat-140 | disaster-girl |
| squat-180 | pepe-rare |
| deadlift-100 | we-go-jim |
| deadlift-140 | pepe-smug |
| deadlift-180 | gigachad |
| deadlift-220 | pepe-rare |
| overhead-40 | wojak |
| overhead-60 | skill-issue |
| overhead-80 | gigachad |
| hipthrust-100 | woman-cat |
| hipthrust-150 | stonks |
| hipthrust-200 | gigachad |
| row-60 | wojak |
| row-80 | doge |
| row-100 | pepe-smug |
| dumbbell-20 | wojak |
| dumbbell-30 | doge |
| dumbbell-40 | distracted |
| dumbbell-50 | gigachad |
| pullup-1 | git-gud |
| pullup-5 | this-is-fine |
| pullup-10 | pepe-smug |
| pullup-20 | gigachad |
| chinup-1 | pepe-classic |
| dip-1 | pepe-classic |
| dip-10 | pepe-smug |
| pistol-1 | skill-issue |
| plank-120 | this-is-fine |
| plank-300 | pepe-sad |
| deadhang-60 | this-is-fine |
| deadhang-120 | pepe-sad |
| sessions-10 | we-go-jim |
| sessions-50 | pepe-classic |
| sessions-100 | chicken-rice |
| sessions-250 | trollface |
| sessions-500 | press-f |
| sessions-1000 | pepe-rare |
| weeks-10 | this-is-fine |
| weeks-52 | chicken-rice |
| weeks-104 | two-buttons |
| weeks-260 | loss |
| years-1 | pepe-classic |
| years-2 | expanding-brain |
| years-5 | pepe-smug |
| years-10 | pepe-rare |
| tonnage-100 | stonks |
| tonnage-500 | doge |
| tonnage-1000 | gigachad |
| tonnage-5000 | pepe-rare |

Les 22 clés sont toutes utilisées au moins une fois. Un id retiré du catalogue
n'a plus d'art : l'écran saute déjà ces lignes.

## 5. Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/milestones/art.ts` | clés, table, URL (`BASE_URL`) |
| `src/lib/milestones/art.test.ts` | TDD : 56 ids, 22 clés utilisées, id inconnu |
| `public/milestones/{clé}.jpg` | 22 JPEG ~192 px, précachés |
| `src/features/milestones/MilestoneToken.tsx` | `<img>` à la place du disque |
| `MilestonesScreen.tsx`, `HomeMilestoneCard.tsx` | passent `definitionId` |
| `vite.config.ts` | `jpg` dans `globPatterns` (sinon 404 hors-ligne) |

Pas de chaîne mème dans l'UI. Pas d'`import` Dexie. Pas de `VITE_*`.

## 6. Hors périmètre

- Ne pas afficher les paliers manquants, même en gris.
- Ne pas nommer les mèmes à l'écran.
- Ne pas régénérer les images à l'exécution.
- Pas de Nintendo.

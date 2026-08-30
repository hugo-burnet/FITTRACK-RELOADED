# Jetons de paliers en mèmes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le disque chiffré des paliers par 22 illustrations de mèmes embarquées, mappées 1:1 sur les 56 ids du catalogue.

**Architecture:** Table statique `id → MilestoneArtKey` dans `src/lib/milestones/art.ts`. Les JPEG vivent dans `public/milestones/` et s'ouvrent via `import.meta.env.BASE_URL`, comme la voix. `MilestoneToken` devient un `<img>` carré arrondi. Le titre à côté continue de porter le chiffre.

**Tech Stack:** Vite + React + TypeScript, Vitest, Workbox (`globPatterns`).

## Global Constraints

- UI française, code anglais, zéro chaîne en dur dans un composant.
- Accès données uniquement via repositories ; ici aucun accès données.
- Pas de `any`, pas de `VITE_*` secret, 100 % hors-ligne.
- IDs catalogue : jamais renommés.
- Tests métier avant le code. Les composants d'affichage purs ne sont pas testés unitairement.
- Branche : `master`. Commits `feat:` / `test:` / `chore:`.

---

### Task 1: Table de mapping (TDD)

**Files:**
- Create: `src/lib/milestones/art.ts`
- Create: `src/lib/milestones/art.test.ts`

**Interfaces:**
- Consumes: `MILESTONES` from `src/lib/milestones/catalogue.ts`
- Produces: `MilestoneArtKey`, `artForMilestone(id: string): MilestoneArtKey | undefined`, `milestoneArtUrl(key: MilestoneArtKey): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { MILESTONES } from './catalogue';
import { artForMilestone, MILESTONE_ART_KEYS, milestoneArtUrl } from './art';

describe('l’art d’un palier', () => {
  it('donne une clé à chaque entrée du catalogue', () => {
    const missing = MILESTONES.filter((row) => artForMilestone(row.id) === undefined);
    expect(missing.map((row) => row.id)).toEqual([]);
  });

  it('ne rend rien pour un palier retiré', () => {
    expect(artForMilestone('palier-supprime')).toBeUndefined();
  });

  it('utilise chaque clé au moins une fois', () => {
    const used = new Set(MILESTONES.map((row) => artForMilestone(row.id)));
    for (const key of MILESTONE_ART_KEYS) {
      expect(used.has(key), key).toBe(true);
    }
  });

  it('réserve git-gud à la première traction', () => {
    expect(artForMilestone('pullup-1')).toBe('git-gud');
  });

  it('pose rare Pepe sur les plafonds', () => {
    for (const id of [
      'bench-140',
      'squat-180',
      'deadlift-220',
      'sessions-1000',
      'years-10',
      'tonnage-5000',
    ]) {
      expect(artForMilestone(id), id).toBe('pepe-rare');
    }
  });

  it('préfixe l’URL avec BASE_URL, comme la voix', () => {
    expect(milestoneArtUrl('pepe-classic')).toBe(
      `${import.meta.env.BASE_URL}milestones/pepe-classic.jpg`,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test:run -- src/lib/milestones/art.test.ts`

Expected: FAIL (module `./art` missing)

- [ ] **Step 3: Write minimal implementation**

`art.ts` exporte `MILESTONE_ART_KEYS` (22 clés), `ART_BY_MILESTONE` (les 56 ids de la spec), `artForMilestone`, `milestoneArtUrl`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm.cmd run test:run -- src/lib/milestones/art.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
test(milestones): mapping mèmes des 56 paliers
```

---

### Task 2: JPEG embarqués + précache hors-ligne

**Files:**
- Create: `public/milestones/{clé}.jpg` (22 fichiers, ~192 px)
- Modify: `vite.config.ts` — ajouter `jpg` à `workbox.globPatterns`

**Interfaces:**
- Consumes: illustrations déjà générées (session / companion)
- Produces: URLs `milestones/{clé}.jpg` servies et précachées

- [ ] **Step 1:** Recopier et recadrer les 22 JPEG en 192×192, qualité ~82, noms = clés.
- [ ] **Step 2:** Ajouter `jpg` dans `globPatterns` : `**/*.{js,css,html,svg,png,webmanifest,mp3,wav,jpg}`. Sans ça, Workbox ignore les jetons et l'onglet casse en sous-sol.
- [ ] **Step 3:** Commit `chore(milestones): embarquer les jetons mèmes`

---

### Task 3: Jeton image sur Paliers et accueil

**Files:**
- Modify: `src/features/milestones/MilestoneToken.tsx`
- Modify: `src/features/milestones/MilestonesScreen.tsx`
- Modify: `src/features/milestones/HomeMilestoneCard.tsx`
- Modify: `src/features/milestones/milestoneCopy.ts` (commentaire : le chiffre vit dans le titre)

**Interfaces:**
- Consumes: `artForMilestone`, `milestoneArtUrl`
- Produces: `MilestoneToken({ definitionId, tone?, size? })`

- [ ] **Step 1:** `MilestoneToken` rend un `<img>` 48/56 px, `rounded-xl`, `object-cover`. Accent = `ring-2` accent. Pas d'art → pastille neutre vide (ligne déjà filtrée).
- [ ] **Step 2:** Les deux écrans passent `definitionId` au lieu de `value={line.token}`.
- [ ] **Step 3:** `npm.cmd run typecheck && npm.cmd run test:run && npm.cmd run build`
- [ ] **Step 4:** Commit `feat(milestones): jetons mèmes sur paliers et accueil`

---

### Task 4: Vérification navigateur

- [ ] Ouvrir l'app, aller sur Paliers (vide OK si aucun palier). Forcer au moins un palier en debug ou via une séance seed si disponible, vérifier accueil + liste.
- [ ] Viewport mobile et desktop.

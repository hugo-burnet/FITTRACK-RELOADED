# Boot Barbell Impact Implementation Plan

> ## ⛔ Révoqué le 2026-08-30 — l'impact est entièrement supprimé de l'app
>
> Cette fonctionnalité n'existe plus. Sur retour de l'utilisateur (« la suite est un peu naze, ça
> fait cheap »), la chute, l'écrasement, la secousse et la poussière ont été retirés du code : il ne
> reste que le chargement des plaques, suivi d'un silence, puis d'un resserrement d'interlettrage
> sur le principe. `boot-drop`, `boot-impact-shake`, `boot-dust-l`, `boot-dust-r`,
> `boot-dust-fade`, `.boot-impact`, `.boot-barbell` et `.boot-dust` ne sont plus dans le dépôt.
>
> **Ce que ce chantier a appris, et qui vaut au-delà de lui.** Le défaut n'était pas dans la courbe
> de chute — elle était juste. Il était dans le nombre de couches démarrant sur la même frame :
> quatre animations à 1 600 ms pour un seul événement, sur un dessin qui fait quatre traits, se
> lisent comme un effet et non comme une conséquence. Chacune des quatre était défendable seule ;
> c'est leur somme qui a coûté la fonctionnalité. Un écran vu une fois par démarrage supporte un
> geste, pas une cinématique.
>
> Le détail de la suppression, le défaut de saut vertical trouvé en la vérifiant et le nouveau
> contrat de test sont dans « L'ouverture, troisième passe » de `PROGRESS.md`. Ce document reste en
> lecture seule, comme trace de la décision et de son motif.


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the opening barbell's upward hop with a heavy ground impact, damped shake, and restrained SVG dust.

**Architecture:** Keep the existing React boot component and CSS-only motion system. Turn the logo SVG into a small layered scene: an independently dropping barbell, two dust groups, and a ground line inside a short shake wrapper; reduced-motion overrides replace all physical movement with fades.

**Tech Stack:** React 19, TypeScript 6, SVG, CSS keyframes, Vitest, Testing Library

> **Livré le 2026-08-29**, commits `dc0d27f` → `6e67585`. Les cases ci-dessous sont cochées après
> relecture du code contre le plan, et non au fil de l'exécution : elles étaient toutes restées
> vides alors que les trois tâches étaient faites.
>
> **Deux écarts, tous deux volontaires.**
>
> 1. ~~*La barre ne remonte pas après le choc.*~~ **Revenu le 2026-08-29 sur décision de
>    l'utilisateur.** L'écart tenait tant que la barre tombait de nulle part : un rebond seul
>    ressemblait au saut que ce chantier supprimait. Une fois l'élévation ajoutée avant la chute, le
>    geste se lit « on soulève, on lâche », et le rebond en est la conséquence attendue. Il reste
>    trois fois plus court que l'élévation — c'est ce rapport qui dit « lourd ».
> 2. *La poussière n'est pas floutée.* La conception mentionnait « un flou très limité aux petits
>    éléments de poussière ». Le flou est resté sur les plaques, où il existait déjà ; six disques
>    de moins d'un pixel de rayon ne gagnent rien à être floutés, et chaque `filter` animé est une
>    couche de composition de plus sur le premier écran de l'app.
>
> Un **défaut** a par ailleurs été trouvé et corrigé le 2026-08-29 : la poussière ne partait pas du
> point de contact. `transform-origin: center` sous `transform-box: view-box` désigne le centre du
> viewBox et non celui du groupe ; à petite échelle les particules naissaient donc au milieu de la
> barre, là où rien ne heurte. Chaque nappe a désormais son origine sur sa grande plaque.
>
> Deux commits vont par ailleurs au-delà du plan : `d80ee40` donne au sol et à la poussière un état
> de repos stable — sans lui, la poussière re-clignotait pendant le fondu de sortie, parce que
> `BootCurtain` remonte `BootScreen` — et `49f761d` verrouille ce contrat par des tests.

## Global Constraints

- Keep `BOOT_HOLD_MS` at exactly `2500`; the effect must not delay app startup.
- Add no dependency and no network or raster asset; the application remains fully offline.
- Animate only `transform`, `opacity`, and the existing bounded plate blur.
- Under `prefers-reduced-motion: reduce`, play no drop, compression, or shake.
- Keep the scene decorative with `aria-hidden="true"`; do not add UI copy.
- Preserve the current plate-loading sequence and the existing app palette.

---

### Task 1: Define the impact scene contract

**Files:**

- Create: `src/app/Boot.test.tsx`
- Modify: `src/app/Boot.tsx:41-96`

**Interfaces:**

- Consumes: `BootScreen({ exiting?: boolean })` and the existing `PLATES` geometry.
- Produces: `.boot-impact`, `.boot-barbell`, `.boot-ground`, and two `.boot-dust` SVG layers consumed by `src/index.css`.

- [x] **Step 1: Write the failing structural test**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BootScreen } from './Boot';

describe('BootScreen', () => {
  it('exposes the layered scene used for the ground impact', () => {
    const { container } = render(<BootScreen />);

    expect(container.querySelector('.boot-impact')).not.toBeNull();
    expect(container.querySelector('.boot-barbell')).not.toBeNull();
    expect(container.querySelector('.boot-ground')).not.toBeNull();
    expect(container.querySelectorAll('.boot-dust')).toHaveLength(2);
  });
});
```

- [x] **Step 2: Run the focused test and verify the missing layers fail**

Run: `npm run test:run -- src/app/Boot.test.tsx`

Expected: FAIL because `.boot-impact`, `.boot-barbell`, `.boot-ground`, and `.boot-dust` do not exist.

- [x] **Step 3: Layer the existing barbell with ground and dust geometry**

In `LoadedBar`, keep the current paths and plate mapping inside `<g className="boot-barbell">`.
Change the SVG view box to `2 6 20 12`, render the ground before the barbell, and render dust after it:

```tsx
<svg className="boot-bar" viewBox="2 6 20 12" fill="none" aria-hidden="true">
  <path className="boot-ground" d="M1.5 16.2H22.5" />
  <g className="boot-barbell">
    <path
      className="boot-rail"
      d="M8 12h8"
      stroke="var(--accent-ink)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {PLATES.flatMap(({ x, half, travel, delay }) =>
      [x, 24 - x].map((cx) => (
        <path
          key={cx}
          className={`boot-plate boot-plate--${cx < 12 ? 'l' : 'r'}`}
          style={{ '--boot-delay': `${delay}ms`, '--boot-travel': `${travel}px` } as CSSProperties}
          d={`M${cx} ${12 - half}v${half * 2}`}
          stroke="var(--accent-ink)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )),
    )}
  </g>
  <g className="boot-dust boot-dust--l">
    <path d="M10.8 15.7c-1.4-.9-2.8-.9-4.1-.2-1.1.6-2.2.6-3.3.2" />
    <circle cx="7" cy="14.8" r=".35" />
  </g>
  <g className="boot-dust boot-dust--r">
    <path d="M13.2 15.7c1.4-.9 2.8-.9 4.1-.2 1.1.6 2.2.6 3.3.2" />
    <circle cx="17" cy="14.8" r=".35" />
  </g>
</svg>
```

Replace the `.boot-lift` wrapper around `<LoadedBar />` with `.boot-impact` and update the adjacent comments so they describe the fall and impact rather than a lift.

- [x] **Step 4: Run the focused test and typecheck**

Run: `npm run test:run -- src/app/Boot.test.tsx`

Expected: PASS, 1 test passed.

Run: `npm run typecheck`

Expected: exit code 0 with no TypeScript errors.

- [x] **Step 5: Commit the scene structure**

```bash
git add -- src/app/Boot.tsx src/app/Boot.test.tsx
git commit -m "test: cadrer l'impact de la barre au démarrage"
```

### Task 2: Animate the fall, compression, shake, and dust

**Files:**

- Modify: `src/index.css:286-322,384-603`

**Interfaces:**

- Consumes: `.boot-impact`, `.boot-barbell`, `.boot-ground`, `.boot-dust--l`, and `.boot-dust--r` from Task 1.
- Produces: `boot-drop`, `boot-impact-shake`, `boot-ground-reveal`, `boot-dust-l`, and `boot-dust-r` keyframes plus reduced-motion overrides.

- [x] **Step 1: Replace the lift trigger with coordinated impact triggers**

At the existing third-beat rules, remove the `.boot-lift` animation and add:

```css
.boot[data-phase='in'] .boot-barbell {
  animation: boot-drop 600ms linear 1280ms both;
  will-change: transform;
}

.boot[data-phase='in'] .boot-impact {
  animation: boot-impact-shake 360ms linear 1600ms both;
  will-change: transform;
}

.boot[data-phase='in'] .boot-ground {
  animation: boot-ground-reveal 420ms var(--ease-mech) 1600ms both;
}

.boot[data-phase='in'] .boot-dust--l {
  animation: boot-dust-l 520ms var(--ease-mech) 1600ms both;
}

.boot[data-phase='in'] .boot-dust--r {
  animation: boot-dust-r 520ms var(--ease-mech) 1600ms both;
}
```

Move `.boot-principle` to `animation: pop 380ms var(--ease-mech) 1600ms both;` and keep the tagline at `1860ms`.

- [x] **Step 2: Add the scene styling and physical keyframes**

Add transform origins for the new layers, style the ground with `var(--border)`, and style the dust with `var(--text-2)`, rounded strokes, and low opacity. Replace `@keyframes boot-lift` with the following motion:

```css
.boot-ground {
  opacity: 0.28;
  transform: scaleX(0.94);
  stroke: var(--border);
}

.boot-dust {
  opacity: 0;
  color: var(--text-2);
}

@keyframes boot-drop {
  0% {
    transform: translateY(-12px);
    animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
  }
  53.333% {
    transform: translateY(0) scaleX(1.06) scaleY(0.82);
    animation-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  74% {
    transform: scaleX(0.99) scaleY(1.025);
  }
  88% {
    transform: scaleX(1.015) scaleY(0.985);
  }
  100% {
    transform: none;
  }
}

@keyframes boot-impact-shake {
  0%,
  100% {
    transform: none;
  }
  16% {
    transform: translateX(-3px) rotate(-0.6deg);
  }
  32% {
    transform: translateX(2.5px) rotate(0.45deg);
  }
  48% {
    transform: translateX(-1.5px) rotate(-0.25deg);
  }
  64% {
    transform: translateX(0.75px) rotate(0.12deg);
  }
}

@keyframes boot-ground-reveal {
  from {
    opacity: 0;
    transform: scaleX(0.18);
  }
  35% {
    opacity: 0.5;
    transform: scaleX(1);
  }
  to {
    opacity: 0.28;
    transform: scaleX(0.94);
  }
}

@keyframes boot-dust-l {
  from {
    opacity: 0;
    transform: translate(2px, 1px) scale(0.35);
  }
  24% {
    opacity: 0.5;
  }
  to {
    opacity: 0;
    transform: translate(-7px, -5px) scale(1.35);
  }
}

@keyframes boot-dust-r {
  from {
    opacity: 0;
    transform: translate(-2px, 1px) scale(0.35);
  }
  24% {
    opacity: 0.5;
  }
  to {
    opacity: 0;
    transform: translate(7px, -5px) scale(1.35);
  }
}
```

- [x] **Step 3: Preserve the reduced-motion and exit-remount contracts**

Add `.boot-ground` to the existing `boot-fade` override. Give `.boot-dust` a dedicated opacity-only `boot-dust-fade` keyframe so it also disappears under reduced motion. Replace the `.boot-lift` reset with:

```css
.boot[data-phase='in'] .boot-impact,
.boot[data-phase='in'] .boot-barbell {
  animation: none !important;
  will-change: auto;
}
```

Keep dust and ground opacity-only fades and set all new impact layers' `will-change` back to `auto` in the reduced-motion block.

The base `opacity: 0` on dust and the settled base ground state above are required because
`BootCurtain` remounts `BootScreen` with `data-phase="out"`; that new tree must inherit the settled
visual state without replaying or flashing any transient layer.

- [x] **Step 4: Run focused and global verification**

Run: `npm run test:run -- src/app/Boot.test.tsx`

Expected: PASS, 1 test passed.

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run test:run`

Expected: all test files pass.

Run: `npm run build`

Expected: production build completes successfully.

- [x] **Step 5: Commit the animation**

```bash
git add -- src/index.css
git commit -m "feat: donner du poids à l'impact de la barre"
```

### Task 3: Record the session and perform final repository checks

**Files:**

- Modify: `PROGRESS.md`

**Interfaces:**

- Consumes: the verified startup animation from Tasks 1 and 2.
- Produces: a durable project handoff describing the changed opening motion and mobile checkpoint.

- [x] **Step 1: Add the session outcome to `PROGRESS.md`**

Record that the opening barbell now falls into a compressed ground impact with a damped shake and SVG dust, that reduced motion uses fades only, and that the full typecheck, test suite, and production build passed on 2026-08-29.

- [x] **Step 2: Verify the final diff and repository state**

Run: `git diff --check`

Expected: no output.

Run: `git status --short`

Expected: only the intended `PROGRESS.md` change plus the pre-existing `.codex-remote-attachments/` entry.

- [x] **Step 3: Commit the progress handoff**

```bash
git add -- PROGRESS.md
git commit -m "docs: consigner le nouvel impact de démarrage"
```

- [x] **Step 4: Re-run the mandatory completion gate after the last commit**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run test:run`

Expected: all test files pass.

Run: `npm run build`

Expected: production build completes successfully.

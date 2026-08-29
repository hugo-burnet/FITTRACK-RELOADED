# Boot Impact Rebound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one small, damped rebound after the boot barbell hits the ground and make both dust clouds originate on the visible ground line.

**Architecture:** Keep the existing `LoadedBar` SVG and CSS-only timeline. Tighten the dust geometry and give each dust group a contact-point transform origin on `y = 16.2`; extend `boot-drop` with a single 2 px lift and a short return to rest without changing the 1,600 ms contact time or the 2,500 ms boot hold.

**Tech Stack:** React 19, TypeScript 6, SVG, CSS keyframes, Vitest, Testing Library

## Global Constraints

- Keep `BOOT_HOLD_MS` at exactly `2500` and the impact contact at exactly `1600ms`.
- Add no dependency, network request, image, or canvas; FitTrack remains fully offline.
- Animate only `transform` and `opacity` in the impact correction.
- Use one damped rebound, not elastic or repeated bouncing.
- Anchor dust to the ground path at `y = 16.2` and keep the left/right clouds symmetrical.
- Under `prefers-reduced-motion: reduce`, keep the existing opacity-only dust and disable barbell movement.

---

### Task 1: Lock the physical contact contract

**Files:**

- Modify: `src/app/Boot.test.tsx`
- Test: `src/app/Boot.test.tsx`

**Interfaces:**

- Consumes: the SVG circles rendered by `BootScreen` and the `boot-drop` / dust rules in `src/index.css`.
- Produces: regression assertions that require a post-impact lift and ground-level dust origins.

- [ ] **Step 1: Write the failing rebound test**

Add a test that slices `@keyframes boot-drop` and requires the contact, lift, and landing frames:

```tsx
it('gives the barbell one small rebound after ground contact', () => {
  const stylesheet = readFileSync('src/index.css', 'utf8');
  const drop = stylesheet.slice(
    stylesheet.indexOf('@keyframes boot-drop'),
    stylesheet.indexOf('@keyframes boot-impact-shake'),
  );

  expect(drop).toMatch(/53\.333%\s*{[^}]*translateY\(0\)/s);
  expect(drop).toMatch(/70%\s*{[^}]*translateY\(-2px\)/s);
  expect(drop).toMatch(/84%\s*{[^}]*translateY\(0\)/s);
});
```

- [ ] **Step 2: Write the failing dust-origin test**

Add a test that requires every SVG particle center to sit at the floor band and both transform origins to use the ground coordinate:

```tsx
it('anchors both dust clouds to the ground line', () => {
  const { container } = render(<BootScreen />);
  const particleY = [...container.querySelectorAll<SVGCircleElement>('.boot-dust circle')].map(
    (particle) => Number(particle.getAttribute('cy')),
  );
  const stylesheet = readFileSync('src/index.css', 'utf8');

  expect(particleY).toHaveLength(6);
  expect(particleY.every((cy) => cy >= 15.9 && cy <= 16.2)).toBe(true);
  expect(stylesheet).toMatch(/\.boot-dust--l\s*{[^}]*transform-origin:\s*9\.65px 16\.2px;/s);
  expect(stylesheet).toMatch(/\.boot-dust--r\s*{[^}]*transform-origin:\s*14\.35px 16\.2px;/s);
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run: `npm run test:run -- src/app/Boot.test.tsx`

Expected: FAIL because `boot-drop` has no `translateY(-2px)`, two particle rows are above `15.9`, and the dust groups still inherit the center of the SVG as their transform origin.

- [ ] **Step 4: Commit the regression tests**

```bash
git add -- src/app/Boot.test.tsx
git commit -m "test: cadrer le rebond et la poussière au sol"
```

### Task 2: Add the damped rebound and grounded dust

**Files:**

- Modify: `src/app/Boot.tsx:70-80`
- Modify: `src/index.css:447-455,632-715`
- Test: `src/app/Boot.test.tsx`

**Interfaces:**

- Consumes: the existing `.boot-barbell`, `.boot-dust--l`, `.boot-dust--r`, and ground path at `y = 16.2`.
- Produces: symmetric contact-level particle geometry, grounded transform origins, and a single damped 2 px rebound.

- [ ] **Step 1: Move all dust particles into the ground band**

Replace the six circle coordinates with mirrored positions whose centers stay between `y = 15.9` and `y = 16.2`:

```tsx
<g className="boot-dust boot-dust--l">
  <circle cx="9.65" cy="16.05" r="1" />
  <circle cx="8.1" cy="15.9" r=".72" opacity=".72" />
  <circle cx="6.45" cy="16.1" r=".48" opacity=".46" />
</g>
<g className="boot-dust boot-dust--r">
  <circle cx="14.35" cy="16.05" r="1" />
  <circle cx="15.9" cy="15.9" r=".72" opacity=".72" />
  <circle cx="17.55" cy="16.1" r=".48" opacity=".46" />
</g>
```

- [ ] **Step 2: Ground each dust transform and refine its flight**

Add dedicated origins after `.boot-dust circle`, then make the particles start almost unscaled on the contact line before moving outward and upward:

```css
.boot-dust--l {
  transform-origin: 9.65px 16.2px;
}

.boot-dust--r {
  transform-origin: 14.35px 16.2px;
}

@keyframes boot-dust-l {
  from {
    opacity: 0;
    transform: translate(1px, 0.2px) scale(0.3);
  }
  22% {
    opacity: 0.68;
  }
  to {
    opacity: 0;
    transform: translate(-9px, -6px) scale(1.35);
  }
}

@keyframes boot-dust-r {
  from {
    opacity: 0;
    transform: translate(-1px, 0.2px) scale(0.3);
  }
  22% {
    opacity: 0.68;
  }
  to {
    opacity: 0;
    transform: translate(9px, -6px) scale(1.35);
  }
}
```

- [ ] **Step 3: Add one post-impact rebound**

Replace only the post-contact frames of `boot-drop`; keep the fall and `53.333%` contact unchanged:

```css
70% {
  transform: translateY(-2px) scaleX(0.99) scaleY(1.025);
  animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
}
84% {
  transform: translateY(0) scaleX(1.012) scaleY(0.99);
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
100% {
  transform: none;
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm run test:run -- src/app/Boot.test.tsx`

Expected: PASS, all `BootScreen` tests green.

- [ ] **Step 5: Commit the implementation**

```bash
git add -- src/app/Boot.tsx src/index.css
git commit -m "fix: ancrer le rebond de la barre au sol"
```

### Task 3: Verify, document, and deploy

**Files:**

- Modify: `PROGRESS.md`

**Interfaces:**

- Consumes: the corrected boot motion from Task 2.
- Produces: a durable session record and the public GitHub Pages deployment.

- [ ] **Step 1: Inspect the animation at mobile size**

Run the app at `/FITTRACK-RELOADED/` in a 390 × 844 viewport. Confirm that the first lift peaks at about 2 px, both dust clouds start on the line, no transient layer flashes during exit, and reduced motion remains opacity-only.

- [ ] **Step 2: Run the mandatory verification gate**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run test:run`

Expected: all test files pass.

Run: `npm run build`

Expected: production PWA build completes successfully.

- [ ] **Step 3: Update the session record**

Add the 2026-08-30 rebound and ground-dust correction, exact verification counts, and the phone checkpoint to `PROGRESS.md`.

- [ ] **Step 4: Commit and push `master`**

```bash
git add -- PROGRESS.md
git commit -m "docs: consigner le rebond de l'ouverture"
git push origin master
```

- [ ] **Step 5: Confirm the public deployment**

Verify that the GitHub Pages workflow for the pushed HEAD concludes successfully and that the public bundle contains `boot-impact`, `boot-barbell`, and `boot-dust`.

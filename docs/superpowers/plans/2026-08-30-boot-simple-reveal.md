# Boot Simple Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the simplified boot (plates + two lines) and the rare GRUB-black terminal, then split `PROGRESS.md` after merging independent work.

**Architecture:** Keep the existing CSS-only boot timeline and the `bootEasterEgg` localStorage date. Paint the rare console as a theme-proof `#000` / `#fff` overlay. Split the session journal only after boot and milestones share one `master`, so the cut happens once.

**Tech Stack:** React 19, TypeScript, CSS keyframes, Vitest, Testing Library, Dexie unchanged.

## Global Constraints

- No Dexie table, no generic easter-egg engine, no network, no image.
- Storage key is exactly `fittrack.bootEasterEggAfter` (dot, not `fittrack:`).
- Console palette is exactly `background: #000` and `color: #fff`, ignoring the app theme.
- `BOOT_HOLD_MS.normal === 2180` and `BOOT_HOLD_MS.console === 3360`.
- Consume the due date only after a full opening; an active workout must not consume it.
- Work in `.worktrees/boot-simple-reveal` until boot commits exist; do not touch the in-progress milestones merge on `master` until those commits are done.
- Keep `archive/*` branches. Do not force-push `master`.

---

### Task 1: Lock the GRUB terminal contract

**Files:**

- Modify: `src/app/Boot.test.tsx`
- Modify: `src/index.css`
- Test: `src/app/Boot.test.tsx`

**Interfaces:**

- Consumes: `.boot-console` and `.boot-console-log` already rendered by `BootScreen`.
- Produces: a theme-proof black terminal with white glyphs.

- [ ] **Step 1: Write the failing GRUB test**

Add:

```tsx
it('paints the rare console as a GRUB terminal, black with white glyphs', () => {
  const stylesheet = readFileSync('src/index.css', 'utf8');
  const block = stylesheet.slice(
    stylesheet.indexOf('.boot-console {'),
    stylesheet.indexOf('.boot-console-command {'),
  );

  expect(block).toMatch(/\.boot-console\s*{[^}]*background:\s*#000;/s);
  expect(block).toMatch(/\.boot-console-log\s*{[^}]*color:\s*#fff;/s);
  expect(block).not.toMatch(/var\(--surface-0\)/);
  expect(block).not.toMatch(/var\(--text-1\)/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:run -- src/app/Boot.test.tsx`

Expected: FAIL because `.boot-console` still uses `var(--surface-0)` and `.boot-console-log` still uses `var(--text-1)`.

- [ ] **Step 3: Paint the console like GRUB**

In `src/index.css`, set:

```css
.boot-console {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: #000;
  color: #fff;
}

.boot-console-log {
  width: min(100%, 32rem);
  color: #fff;
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  font-size: clamp(0.6875rem, 3.125vw, 0.75rem);
  line-height: 1.65;
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm run test:run -- src/app/Boot.test.tsx src/app/bootEasterEgg.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/app/Boot.test.tsx src/index.css src/app/bootEasterEgg.ts src/app/bootEasterEgg.test.ts src/main.tsx
git commit -m "fix: peindre le terminal d'ouverture comme GRUB"
```

### Task 2: Record the spec and the remaining boot notes

**Files:**

- Create: `docs/superpowers/specs/2026-08-30-boot-simple-reveal-design.md`
- Create: `docs/superpowers/plans/2026-08-30-boot-simple-reveal.md`
- Modify: `PROGRESS.md` (live header only; do not split yet)

**Interfaces:**

- Consumes: Task 1 motion and the already-landed simplified boot.
- Produces: a durable design record. Historical `PROGRESS.md` body stays intact until Task 4.

- [ ] **Step 1: Keep the live header short**

The top of `PROGRESS.md` must mention the simplified opening, the GRUB console, and the phone checkpoint. Do not move historical sections in this task.

- [ ] **Step 2: Commit the documents**

```bash
git add -- docs/superpowers/specs/2026-08-30-boot-simple-reveal-design.md docs/superpowers/plans/2026-08-30-boot-simple-reveal.md PROGRESS.md
git commit -m "docs: concevoir l'ouverture simplifiée et le terminal GRUB"
```

### Task 3: Merge milestones, then the boot branch

**Files:**

- Modify: `PROGRESS.md` (conflict only, on `master`)
- Merge: `origin/claude/secret-vivre-vieux-01bl4s`
- Merge: `codex/boot-simple-reveal`

**Interfaces:**

- Consumes: boot commits from the worktree and the already-staged milestones tree on `master`.
- Produces: one `master` with both features.

- [ ] **Step 1: Finish the in-progress milestones merge on `master`**

Resolve `PROGRESS.md` by keeping both latest sections (paliers + impact, then boot will replace the impact header on the next merge). Do not split the file here.

- [ ] **Step 2: Merge `codex/boot-simple-reveal` into `master`**

Resolve `src/i18n/fr.ts` and `PROGRESS.md` if they conflict. Keep GRUB copy and milestone copy.

- [ ] **Step 3: Run the mandatory gate on the merged tree**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run test:run`

Expected: all tests pass.

Run: `npm run build`

Expected: production build succeeds.

### Task 4: Split PROGRESS.md

**Files:**

- Modify: `PROGRESS.md`
- Create: `docs/progress/journal-2026.md`
- Create: `docs/progress/lots.md`
- Create: `docs/progress/decisions-et-pieges.md`

**Interfaces:**

- Consumes: the merged `PROGRESS.md`.
- Produces: a short live journal plus three archives. `PROGRESS.md` remains the file every session updates.

- [ ] **Step 1: Cut the historical body out of `PROGRESS.md`**

Live file keeps: last-update blurb, current boot and milestones sections, open phone checkpoints, and links to the three archives.

Move:

- dated session notes older than the current boot/milestones work → `docs/progress/journal-2026.md`
- Lot 0–7 journals → `docs/progress/lots.md`
- « Décisions prises », « Pièges rencontrés », « Dette technique » → `docs/progress/decisions-et-pieges.md`

- [ ] **Step 2: Commit the split**

```bash
git add -- PROGRESS.md docs/progress
git commit -m "docs: découper le journal d'avancement"
```

- [ ] **Step 3: Push `master` and delete merged feature branches**

```bash
git push origin master
```

Keep every `archive/*` branch. Delete merged feature branches (local and remote) that are no longer checked out, including `origin/claude/secret-vivre-vieux-01bl4s` after the merge. Remove the boot worktree, then delete `codex/boot-simple-reveal`.

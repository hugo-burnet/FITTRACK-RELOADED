import { expect, type Page } from '@playwright/test';

export type ThemeName = 'dark' | 'light' | 'tty1';

/**
 * Le premier lancement, tel que la personne le passe : « Passer », sans son.
 *
 * Par l'interface et non en écrivant l'état du tutoriel dans `localStorage` : le format de cet état
 * change (v3 aujourd'hui), le bouton, lui, est ce que l'utilisateur touche.
 */
export async function skipFirstRun(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Passer' }).click();
  await expect(page.getByRole('dialog', { name: 'Avant le premier son' })).toBeHidden();
}

/** Ouvre l'app (une route en hash, ou l'accueil) et passe le premier lancement. */
export async function openApp(page: Page, hash = ''): Promise<void> {
  await page.goto(hash);
  await skipFirstRun(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/**
 * Planifier › Partir d'un modèle › le modèle, puis retour à l'accueil.
 *
 * On attend l'éditeur de la routine avant de repartir : le modèle s'écrit en base puis l'app
 * navigue, et un « Accueil » touché entre les deux était écrasé par cette navigation tardive —
 * le test se retrouvait dans l'éditeur, devant un bouton qui n'existait plus.
 */
export async function createRoutineFromTemplate(page: Page, template: RegExp): Promise<void> {
  await page.getByRole('link', { name: 'Planifier' }).click();
  await page.getByRole('button', { name: 'Partir d’un modèle' }).click();
  await page.getByRole('button', { name: template }).click();
  await expect(page).toHaveURL(/#\/routines\/[^/]+$/);
  await page.getByRole('link', { name: 'Accueil' }).click();
  await expect(page).toHaveURL(/#\/$/);
}

/** Lance la routine que l'accueil propose. */
export async function startSuggestedWorkout(page: Page, routineName: string): Promise<void> {
  await page.getByRole('button', { name: `Démarrer ${routineName}` }).click();
  await expect(page).toHaveURL(/#\/workout$/);
}

/**
 * Écrit des séances terminées directement dans IndexedDB.
 *
 * Trois séances par l'interface, ce sont une trentaine de gestes pour ce qu'un test de rappel
 * veut seulement *avoir derrière lui*. La base `fittrack` existe déjà (l'app l'a ouverte) : on y
 * écrit sur une seconde connexion, puis on **recharge** — les requêtes vivantes de Dexie
 * n'entendent que ses propres écritures.
 */
export async function seedCompletedWorkouts(page: Page, count: number): Promise<void> {
  await page.evaluate(async (howMany) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fittrack');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('workouts', 'readwrite');
    const store = transaction.objectStore('workouts');
    const day = 86_400_000;
    const now = Date.now();
    for (let index = 0; index < howMany; index += 1) {
      const endedAt = now - (howMany - index) * day;
      store.put({
        id: crypto.randomUUID(),
        createdAt: endedAt - 3_600_000,
        updatedAt: endedAt,
        deletedAt: 0,
        routineId: '',
        name: `Séance ${index + 1}`,
        status: 'completed',
        startedAt: endedAt - 3_600_000,
        endedAt,
        durationSeconds: 3600,
      });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, count);
}

/**
 * Écrit des mensurations directement dans IndexedDB, comme `seedCompletedWorkouts` le fait des
 * séances : un test de mise en page veut les avoir derrière lui, pas les saisir. `daysAgo` est
 * compté en jours locaux du navigateur, à midi.
 */
export async function seedMeasurements(
  page: Page,
  rows: { type: string; value: number; unit: string; daysAgo: number }[],
): Promise<void> {
  await page.evaluate(async (entries) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fittrack');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('bodyMeasurements', 'readwrite');
    const store = transaction.objectStore('bodyMeasurements');
    for (const entry of entries) {
      const day = new Date();
      day.setDate(day.getDate() - entry.daysAgo);
      day.setHours(12, 0, 0, 0);
      store.put({
        id: crypto.randomUUID(),
        createdAt: day.getTime(),
        updatedAt: day.getTime(),
        deletedAt: 0,
        type: entry.type,
        value: entry.value,
        unit: entry.unit,
        measuredAt: day.getTime(),
      });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, rows);
}

/**
 * Écrit des séances de musculation terminées directement dans IndexedDB, rangées par semaine complète
 * (le mercredi à midi, **dans le fuseau du navigateur**), avec l'identité du muscle sur la ligne
 * d'exercice — l'historique n'a pas besoin de la bibliothèque pour le lire. `weeksAgo` : 1 est la
 * dernière semaine complète. Pour les mêmes raisons que `seedCompletedWorkouts`, il faut recharger
 * ensuite.
 */
export async function seedMuscleSessions(
  page: Page,
  sessions: { weeksAgo: number; muscle: string; sets: number }[],
): Promise<void> {
  await page.evaluate(async (entries) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fittrack');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['workouts', 'workoutExercises', 'workoutSets'],
      'readwrite',
    );
    const workouts = transaction.objectStore('workouts');
    const exercises = transaction.objectStore('workoutExercises');
    const sets = transaction.objectStore('workoutSets');

    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

    for (const entry of entries) {
      const day = new Date(monday);
      day.setDate(day.getDate() - entry.weeksAgo * 7 + 2);
      day.setHours(12, 0, 0, 0);
      const startedAt = day.getTime();
      const stamps = { createdAt: startedAt, updatedAt: startedAt, deletedAt: 0 };
      const workoutId = crypto.randomUUID();
      const rowId = crypto.randomUUID();
      const exerciseId = `e2e-${entry.muscle}`;

      workouts.put({
        id: workoutId,
        ...stamps,
        routineId: '',
        name: `Séance ${entry.muscle}`,
        status: 'completed',
        startedAt,
        endedAt: startedAt + 3_600_000,
        durationSeconds: 3600,
      });
      exercises.put({
        id: rowId,
        ...stamps,
        workoutId,
        exerciseId,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: `Exercice ${entry.muscle}`,
        exerciseMeasurementType: 'weight_reps',
        exercisePrimaryMuscle: entry.muscle,
        exerciseEquipment: 'barbell',
      });
      for (let order = 0; order < entry.sets; order += 1) {
        sets.put({
          id: crypto.randomUUID(),
          ...stamps,
          workoutExerciseId: rowId,
          exerciseId,
          workoutId,
          order,
          setType: 'normal',
          side: 'both',
          weight: 60,
          reps: 10,
          isCompleted: 1,
          performedAt: startedAt + order * 120_000,
        });
      }
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, sessions);
}

/** `AAAA-MM-JJ` d'il y a `days` jours, **dans le fuseau du navigateur** — celui de l'app. */
export async function isoDaysAgo(page: Page, days: number): Promise<string> {
  return page.evaluate((count) => {
    const date = new Date();
    date.setDate(date.getDate() - count);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }, days);
}

/**
 * Ce qui dépasse de l'écran à droite ou à gauche, ou une page qui défile de côté.
 *
 * Les éléments dans un défilement horizontal volontaire (`overflow-x: auto|scroll`) sont exclus :
 * ils sont faits pour déborder. Un `overflow: hidden` n'excuse rien — ce qu'il coupe au bord de
 * l'écran est un texte ou une commande qu'on ne verra pas.
 */
export async function findHorizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const problems: string[] = [];
    const sideScroll = document.documentElement.scrollWidth - width;
    if (sideScroll > 0) problems.push(`la page défile de côté de ${sideScroll} px`);

    for (const element of document.body.querySelectorAll('*')) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (box.right <= width + 1 && box.left >= -1) continue;

      let ancestor = element.parentElement;
      let scrolls = false;
      while (ancestor && ancestor !== document.body) {
        const overflowX = getComputedStyle(ancestor).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') {
          scrolls = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (scrolls) continue;

      const text = (element.getAttribute('aria-label') ?? element.textContent ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      problems.push(
        `<${element.tagName.toLowerCase()}> « ${text} » de ${Math.round(box.left)} à ${Math.round(box.right)} px sur ${width}`,
      );
    }
    return problems.slice(0, 8);
  });
}

/** Deux images : le temps que la mise en page se pose après un changement de route ou de taille. */
export async function settleLayout(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

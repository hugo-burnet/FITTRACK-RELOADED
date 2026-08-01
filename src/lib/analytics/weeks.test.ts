import { describe, expect, it } from 'vitest';
import { localOffsetMinutes } from '@/lib/timezone';
import { addLocalWeeks, startOfLocalWeek } from '@/lib/history';
import { periodBounds } from './periods';
import {
  goalWeeksReached,
  knownWeekStarts,
  weeklyAverage,
  weeklySessionCounts,
  weekStartOf,
} from './weeks';

/** Lundi 27 juillet 2026, 14 h locale — l'instant depuis lequel on lit. */
const now = new Date(2026, 6, 27, 14, 0, 0).getTime();

const week = (year: number, month: number, day: number): number =>
  startOfLocalWeek(new Date(year, month, day, 12).getTime());

const session = (at: number, timezoneOffsetMinutes?: number) =>
  timezoneOffsetMinutes === undefined
    ? { startedAt: at }
    : { startedAt: at, timezoneOffsetMinutes };

describe('knownWeekStarts', () => {
  const bounds = periodBounds('4w', now);

  it('part de la borne quand une histoire antérieure rend toute la fenêtre connue', () => {
    expect(knownWeekStarts([], bounds, true)).toEqual([
      week(2026, 6, 6),
      week(2026, 6, 13),
      week(2026, 6, 20),
      week(2026, 6, 27),
    ]);
  });

  it('part de la plus ancienne semaine observée et conserve les trous internes', () => {
    expect(knownWeekStarts([week(2026, 6, 20), week(2026, 6, 6)], bounds)).toEqual([
      week(2026, 6, 6),
      week(2026, 6, 13),
      week(2026, 6, 20),
      week(2026, 6, 27),
    ]);
  });

  it('ne fabrique aucune semaine pour une histoire complète vide', () => {
    expect(knownWeekStarts([], periodBounds('all', now))).toEqual([]);
  });

  it('énumère les semaines par calendrier local à travers un changement d’heure', () => {
    const october = new Date(2026, 9, 27, 14, 0, 0).getTime();
    const starts = knownWeekStarts([], periodBounds('4w', october), true);

    expect(starts).toHaveLength(4);
    expect(starts[3]).toBe(addLocalWeeks(starts[0]!, 3));
    expect(starts.every((start) => new Date(start).getHours() === 0)).toBe(true);
  });
});

describe('weekStartOf', () => {
  it('range une séance dans la semaine de son propre jour civil', () => {
    const at = new Date(2026, 6, 22, 18, 0, 0).getTime(); // mercredi 22 juillet
    expect(weekStartOf(at, localOffsetMinutes(at))).toBe(week(2026, 6, 20));
  });

  it('retombe sur le fuseau du lecteur quand la séance n’en porte pas', () => {
    // Les séances d'avant la migration v2 n'ont pas d'offset : le comportement
    // du Lot 07 doit rester exactement celui-là.
    const at = new Date(2026, 6, 22, 18, 0, 0).getTime();
    expect(weekStartOf(at)).toBe(startOfLocalWeek(at));
  });

  it('garde une séance de fin de soirée dans SA semaine, lue d’ailleurs', () => {
    // Dimanche 26 juillet 23 h 30 à Paris (UTC+2) : la séance appartient au
    // dimanche, donc à la semaine du 20. Lue depuis un fuseau très à l'ouest,
    // l'instant tombe le dimanche plus tôt — même semaine — mais l'inverse est
    // le cas qui compte : une séance enregistrée à UTC+13 le lundi 27 à 00 h 30
    // est un LUNDI, donc la semaine du 27, même si en local c'est encore
    // dimanche.
    const paris = Date.UTC(2026, 6, 26, 21, 30); // dimanche 23 h 30 à UTC+2
    expect(weekStartOf(paris, 120)).toBe(week(2026, 6, 20));

    const auckland = Date.UTC(2026, 6, 26, 11, 30); // lundi 00 h 30 à UTC+13
    expect(weekStartOf(auckland, 780)).toBe(week(2026, 6, 27));
  });

  it('ne dépend pas du fuseau du lecteur pour une séance qui porte le sien', () => {
    // Les deux instants ci-dessus lus « à la lecteur » tomberaient tous les deux
    // le dimanche 26 dans la plupart des fuseaux ; avec leur offset, non.
    const auckland = Date.UTC(2026, 6, 26, 11, 30);
    expect(weekStartOf(auckland, 780)).not.toBe(weekStartOf(auckland));
  });

  it('traverse un changement d’heure sans décaler la semaine', () => {
    // Dimanche 25 octobre 2026 : retour à l'heure d'hiver en Europe. La séance
    // reste dans la semaine du lundi 19.
    const at = new Date(2026, 9, 25, 10, 0, 0).getTime();
    expect(weekStartOf(at, localOffsetMinutes(at))).toBe(week(2026, 9, 19));
  });
});

describe('weeklySessionCounts', () => {
  const bounds = periodBounds('4w', now); // 6, 13, 20 et 27 juillet

  it('rend une semaine par semaine de la fenêtre dès que l’historique la précède', () => {
    // C'est le renversement de la règle de G1 : une semaine sans séance n'est
    // pas une donnée manquante, c'est une semaine sans entraînement — à
    // condition que l'historique existe déjà à ce moment-là.
    const buckets = weeklySessionCounts([], bounds, [], true);
    expect(buckets).toHaveLength(4);
    expect(buckets.map((bucket) => bucket.sessions)).toEqual([0, 0, 0, 0]);
    expect(buckets.map((bucket) => bucket.weekStart)).toEqual([
      week(2026, 6, 6),
      week(2026, 6, 13),
      week(2026, 6, 20),
      week(2026, 6, 27),
    ]);
  });

  it('ne commence pas avant la première séance enregistrée', () => {
    // Le défaut trouvé en usage : un historique de trois semaines dessinait
    // neuf barres vides devant lui. Avant la première séance, un zéro n'est pas
    // une semaine sans entraînement — c'est une semaine dont l'app ne sait
    // rien, donc le zéro inventé que G1 interdit.
    const at = new Date(2026, 6, 21, 18, 0, 0).getTime();
    const buckets = weeklySessionCounts([session(at, localOffsetMinutes(at))], bounds, [], false);
    expect(buckets.map((bucket) => bucket.weekStart)).toEqual([
      week(2026, 6, 20),
      week(2026, 6, 27),
    ]);
    expect(buckets.map((bucket) => bucket.sessions)).toEqual([1, 0]);
  });

  it('garde les trous situés DANS l’historique, eux', () => {
    // La semaine du 13 est vide mais l'historique la précède : c'est une vraie
    // semaine sans entraînement, elle doit rester visible. C'est toute la
    // différence avec le cas ci-dessus.
    const early = new Date(2026, 6, 7, 18, 0, 0).getTime();
    const late = new Date(2026, 6, 21, 18, 0, 0).getTime();
    const buckets = weeklySessionCounts(
      [session(early, localOffsetMinutes(early)), session(late, localOffsetMinutes(late))],
      bounds,
      [],
      false,
    );
    expect(buckets.map((bucket) => bucket.sessions)).toEqual([1, 0, 1, 0]);
  });

  it('garde toute la fenêtre quand l’historique commence avant elle, même vide', () => {
    // Quelqu'un qui s'entraîne depuis un an et n'a rien fait depuis trois mois
    // doit voir douze barres à zéro : là, c'est l'information.
    const buckets = weeklySessionCounts([], bounds, [], true);
    expect(buckets).toHaveLength(4);
  });

  it('compte deux séances du même jour comme deux', () => {
    const morning = new Date(2026, 6, 21, 8, 0, 0).getTime();
    const evening = new Date(2026, 6, 21, 19, 0, 0).getTime();
    const buckets = weeklySessionCounts(
      [session(morning, localOffsetMinutes(morning)), session(evening, localOffsetMinutes(evening))],
      bounds,
      [],
      true,
    );
    expect(buckets[2]!.sessions).toBe(2);
  });

  it('ignore une séance hors de la fenêtre plutôt que de l’écraser sur un bord', () => {
    const old = new Date(2026, 5, 1, 10, 0, 0).getTime();
    const buckets = weeklySessionCounts([session(old, localOffsetMinutes(old))], bounds, [], true);
    expect(buckets).toHaveLength(4);
    expect(buckets.reduce((total, bucket) => total + bucket.sessions, 0)).toBe(0);
  });

  it('part de la plus ancienne séance quand la période est « tout »', () => {
    const old = new Date(2026, 6, 8, 10, 0, 0).getTime();
    const buckets = weeklySessionCounts(
      [session(old, localOffsetMinutes(old))],
      periodBounds('all', now),
      [],
    );
    expect(buckets[0]!.weekStart).toBe(week(2026, 6, 6));
    expect(buckets[buckets.length - 1]!.weekStart).toBe(week(2026, 6, 27));
  });

  it('ne rend rien sur « tout » sans aucune séance, plutôt qu’une date de naissance inventée', () => {
    expect(weeklySessionCounts([], periodBounds('all', now), [])).toEqual([]);
  });

  it('juge chaque semaine sur l’objectif applicable à elle, pas sur celui d’aujourd’hui', () => {
    const goals = [
      { effectiveFromWeek: 0, sessions: 2 },
      { effectiveFromWeek: week(2026, 6, 20), sessions: 4 },
    ];
    const buckets = weeklySessionCounts([], bounds, goals, true);
    expect(buckets.map((bucket) => bucket.goal)).toEqual([2, 2, 4, 4]);
  });

  it('laisse l’objectif absent quand aucun n’a jamais été défini', () => {
    const buckets = weeklySessionCounts([], bounds, [], true);
    expect(buckets).toHaveLength(4);
    expect(buckets.every((bucket) => bucket.goal === null)).toBe(true);
  });

  it('ne juge pas les semaines antérieures à un objectif qui n’est pas le premier', () => {
    const goals = [{ effectiveFromWeek: week(2026, 6, 20), sessions: 3 }];
    expect(weeklySessionCounts([], bounds, goals, true).map((bucket) => bucket.goal)).toEqual([
      null,
      null,
      3,
      3,
    ]);
  });

  it('compte les semaines d’un changement d’heure comme les autres', () => {
    const october = new Date(2026, 9, 27, 14, 0, 0).getTime();
    const buckets = weeklySessionCounts([], periodBounds('4w', october), [], true);
    expect(buckets).toHaveLength(4);
    for (const bucket of buckets) {
      expect(new Date(bucket.weekStart).getDay()).toBe(1);
      expect(new Date(bucket.weekStart).getHours()).toBe(0);
    }
    expect(buckets[3]!.weekStart).toBe(addLocalWeeks(buckets[0]!.weekStart, 3));
  });
});

describe('weeklyAverage', () => {
  it('divise par toutes les semaines, y compris les vides', () => {
    // Sauter les semaines vides donnerait « 3 séances par semaine » à quelqu'un
    // qui s'est entraîné une semaine sur deux.
    const buckets = [
      { weekStart: 0, sessions: 3, goal: null },
      { weekStart: 1, sessions: 0, goal: null },
      { weekStart: 2, sessions: 3, goal: null },
      { weekStart: 3, sessions: 0, goal: null },
    ];
    expect(weeklyAverage(buckets)).toBe(1.5);
  });

  it('rend zéro sans semaine, plutôt que NaN', () => {
    expect(weeklyAverage([])).toBe(0);
  });
});

describe('goalWeeksReached', () => {
  it('compte les semaines à l’objectif parmi celles qui en avaient un', () => {
    const buckets = [
      { weekStart: 0, sessions: 3, goal: 3 },
      { weekStart: 1, sessions: 2, goal: 3 },
      { weekStart: 2, sessions: 5, goal: 4 },
    ];
    expect(goalWeeksReached(buckets)).toEqual({ reached: 2, judged: 3 });
  });

  it('ne juge pas une semaine sans objectif', () => {
    // Une semaine sans objectif n'est pas une semaine ratée : elle n'est pas
    // jugée. Sinon l'écran annonce « 0 sur 12 » à quelqu'un qui n'a jamais
    // choisi de cible.
    const buckets = [
      { weekStart: 0, sessions: 4, goal: null },
      { weekStart: 1, sessions: 0, goal: null },
    ];
    expect(goalWeeksReached(buckets)).toEqual({ reached: 0, judged: 0 });
  });
});

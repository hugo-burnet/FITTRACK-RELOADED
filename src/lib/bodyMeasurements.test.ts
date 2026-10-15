import { describe, expect, it } from 'vitest';
import {
  BODY_WEIGHT_TYPE,
  CUSTOM_NAME_MAX,
  PRESET_MEASUREMENTS,
  compareMeasurementTypes,
  customName,
  customType,
  dayInputValue,
  isCustomType,
  isPlausibleMeasurement,
  localDayBounds,
  measuredAtForDay,
  presetUnit,
  readingChange,
  roundMeasurement,
} from './bodyMeasurements';

const at = (month: number, day: number, hour = 0, minute = 0): number =>
  new Date(2026, month - 1, day, hour, minute).getTime();

describe('le catalogue', () => {
  it('propose quinze mesures, chacune avec une clé unique et une unité', () => {
    const keys = PRESET_MEASUREMENTS.map((preset) => preset.type);

    expect(keys).toHaveLength(15);
    expect(new Set(keys).size).toBe(15);
    expect(PRESET_MEASUREMENTS.every((preset) => ['kg', '%', 'cm'].includes(preset.unit))).toBe(
      true,
    );
  });

  it('range le poids en kilogrammes, la masse grasse en pourcents, le reste en centimètres', () => {
    expect(presetUnit('body_weight')).toBe('kg');
    expect(presetUnit('body_fat')).toBe('%');
    expect(presetUnit('waist')).toBe('cm');
    expect(presetUnit('left_biceps')).toBe('cm');
    expect(presetUnit('right_calf')).toBe('cm');
  });

  it('a des paires gauche et droite pour biceps, avant-bras, cuisse et mollet', () => {
    for (const part of ['biceps', 'forearm', 'thigh', 'calf']) {
      expect(presetUnit(`left_${part}`)).toBe('cm');
      expect(presetUnit(`right_${part}`)).toBe('cm');
    }
  });

  it("ne connaît pas l'unité d'un champ libre, ni d'un type inconnu", () => {
    expect(presetUnit('custom:Poignet')).toBeUndefined();
    expect(presetUnit('wrist')).toBeUndefined();
  });
});

describe('les champs libres', () => {
  it('se rangent sous le préfixe custom: et se reconnaissent à lui', () => {
    expect(customType('Tour de poignet')).toBe('custom:Tour de poignet');
    expect(isCustomType('custom:Tour de poignet')).toBe(true);
    expect(isCustomType('waist')).toBe(false);
    expect(isCustomType('body_weight')).toBe(false);
  });

  it('un nom libre ne se fait jamais passer pour le poids', () => {
    expect(customType('body_weight')).toBe('custom:body_weight');
    expect(customType('body_weight')).not.toBe(BODY_WEIGHT_TYPE);
  });

  it('normalise les espaces autour et à l’intérieur du nom', () => {
    expect(customType('  Tour   de \t poignet ')).toBe('custom:Tour de poignet');
  });

  it('refuse un nom vide, ou fait seulement d’espaces', () => {
    expect(customType('')).toBeUndefined();
    expect(customType('   \t ')).toBeUndefined();
  });

  it(`coupe un nom à ${CUSTOM_NAME_MAX} caractères`, () => {
    const type = customType('x'.repeat(CUSTOM_NAME_MAX + 25));

    expect(type).toBe(`custom:${'x'.repeat(CUSTOM_NAME_MAX)}`);
  });

  it('rend le nom saisi, sans traduction ni changement de casse', () => {
    expect(customName('custom:Tour de poignet')).toBe('Tour de poignet');
    expect(customName('custom:ÉPAULE gauche')).toBe('ÉPAULE gauche');
  });

  it('ne rend pas de nom pour une mesure du catalogue', () => {
    expect(customName('waist')).toBeUndefined();
    expect(customName('body_weight')).toBeUndefined();
  });
});

describe('une valeur plausible', () => {
  it('refuse ce qui n’est pas un nombre fini strictement positif, poids compris', () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isPlausibleMeasurement('body_weight', 'kg', value)).toBe(false);
      expect(isPlausibleMeasurement('waist', 'cm', value)).toBe(false);
    }
  });

  it('accepte un poids de corps sans maximum, comme la spec du 2026-08-10', () => {
    expect(isPlausibleMeasurement('body_weight', 'kg', 80)).toBe(true);
    expect(isPlausibleMeasurement('body_weight', 'kg', 5000)).toBe(true);
  });

  it('garde un pourcentage strictement sous 100', () => {
    expect(isPlausibleMeasurement('body_fat', '%', 99.9)).toBe(true);
    expect(isPlausibleMeasurement('body_fat', '%', 100)).toBe(false);
    expect(isPlausibleMeasurement('body_fat', '%', 180)).toBe(false);
  });

  it('plafonne une longueur à 300 cm, bornes comprises', () => {
    expect(isPlausibleMeasurement('waist', 'cm', 300)).toBe(true);
    expect(isPlausibleMeasurement('waist', 'cm', 300.1)).toBe(false);
    expect(isPlausibleMeasurement('waist', 'cm', 825)).toBe(false);
  });

  it('plafonne un champ libre en kilogrammes à 1 000', () => {
    expect(isPlausibleMeasurement('custom:Lest', 'kg', 1000)).toBe(true);
    expect(isPlausibleMeasurement('custom:Lest', 'kg', 1001)).toBe(false);
  });

  it('ne juge pas une unité qu’il ne connaît pas', () => {
    expect(isPlausibleMeasurement('custom:Pli', 'mm', 12)).toBe(true);
    expect(isPlausibleMeasurement('custom:Pli', 'mm', -3)).toBe(false);
  });
});

describe('arrondir une mesure', () => {
  it('garde deux décimales : ce qui est enregistré est ce qui s’affiche', () => {
    expect(roundMeasurement(82.456)).toBe(82.46);
    expect(roundMeasurement(82.4)).toBe(82.4);
    expect(roundMeasurement(1.005)).toBe(1.01);
  });
});

describe("l'instant d'une date saisie", () => {
  const now = at(10, 14, 18, 30);

  it('prend le début du jour local pour un jour passé', () => {
    expect(measuredAtForDay('2026-10-03', now)).toBe(at(10, 3, 0, 0));
  });

  it('prend l’instant présent pour aujourd’hui, comme la tuile du poids', () => {
    expect(measuredAtForDay('2026-10-14', now)).toBe(now);
  });

  it('refuse demain et au-delà', () => {
    expect(measuredAtForDay('2026-10-15', now)).toBeUndefined();
    expect(measuredAtForDay('2027-01-01', now)).toBeUndefined();
  });

  it('refuse une chaîne qui n’est pas une date', () => {
    expect(measuredAtForDay('', now)).toBeUndefined();
    expect(measuredAtForDay('hier', now)).toBeUndefined();
    expect(measuredAtForDay('14/10/2026', now)).toBeUndefined();
  });

  it('refuse un jour qui n’existe pas au lieu de le glisser au mois suivant', () => {
    expect(measuredAtForDay('2026-02-30', now)).toBeUndefined();
    expect(measuredAtForDay('2026-13-01', now)).toBeUndefined();
  });

  it('accepte le 29 février d’une année bissextile', () => {
    expect(measuredAtForDay('2024-02-29', now)).toBe(new Date(2024, 1, 29).getTime());
  });
});

describe('la date dans le champ', () => {
  it('s’écrit AAAA-MM-JJ, en jour local', () => {
    expect(dayInputValue(at(10, 3, 0, 0))).toBe('2026-10-03');
    expect(dayInputValue(at(1, 9, 23, 59))).toBe('2026-01-09');
  });

  it('relit ce qu’elle a écrit', () => {
    const now = at(10, 14, 18, 30);

    expect(measuredAtForDay(dayInputValue(at(9, 21, 7, 45)), now)).toBe(at(9, 21, 0, 0));
  });
});

describe('l’écart sur une série', () => {
  const reading = (value: number, measuredAt: number) => ({
    id: String(measuredAt),
    value,
    measuredAt,
  });

  it('ne dit rien sans mesure, ni avec une seule', () => {
    expect(readingChange([])).toBeUndefined();
    expect(readingChange([reading(82, at(10, 1))])).toBeUndefined();
  });

  it('donne la différence entre la dernière et la première, et la date de la première', () => {
    const change = readingChange([
      reading(84, at(9, 14)),
      reading(83.2, at(10, 1)),
      reading(82.5, at(10, 14)),
    ]);

    expect(change).toEqual({ change: -1.5, since: at(9, 14) });
  });

  it('ne laisse pas le bruit des flottants faire un écart de zéro', () => {
    expect(readingChange([reading(0.1 + 0.2, at(10, 1)), reading(0.3, at(10, 2))])?.change).toBe(0);
  });

  it('lit l’ordre des dates, pas l’ordre du tableau', () => {
    const change = readingChange([reading(82.5, at(10, 14)), reading(84, at(9, 14))]);

    expect(change).toEqual({ change: -1.5, since: at(9, 14) });
  });
});

describe('l’ordre des types', () => {
  it('suit le catalogue, puis les champs libres par ordre alphabétique', () => {
    const types = ['custom:Poignet', 'waist', 'custom:Cheville', 'body_weight', 'left_thigh'];

    expect([...types].sort(compareMeasurementTypes)).toEqual([
      'body_weight',
      'waist',
      'left_thigh',
      'custom:Cheville',
      'custom:Poignet',
    ]);
  });

  it('range un type inconnu après le catalogue', () => {
    expect(['custom:A', 'mystère', 'neck'].sort(compareMeasurementTypes)).toEqual([
      'neck',
      'custom:A',
      'mystère',
    ]);
  });
});

describe('les bornes d’un jour local', () => {
  it('va de minuit à minuit, la borne haute exclue', () => {
    const [start, end] = localDayBounds(at(10, 14, 18, 30));

    expect(start).toBe(at(10, 14, 0, 0));
    expect(end).toBe(at(10, 15, 0, 0));
  });

  it('contient l’instant demandé, y compris minuit pile', () => {
    for (const instant of [at(10, 14, 0, 0), at(10, 14, 12), at(10, 14, 23, 59)]) {
      const [start, end] = localDayBounds(instant);
      expect(start).toBeLessThanOrEqual(instant);
      expect(instant).toBeLessThan(end);
    }
  });

  it('passe la fin de mois et d’année par le calendrier, pas par 24 heures', () => {
    expect(localDayBounds(at(12, 31, 9))[1]).toBe(new Date(2027, 0, 1).getTime());
    expect(localDayBounds(at(2, 28, 9))[1]).toBe(new Date(2026, 2, 1).getTime());
  });
});

import { describe, expect, it } from 'vitest';
import { pickRetrospective, retrospectiveKey } from './retrospective';

const DAY = 86_400_000;
const at = (year: number, month: number, day: number): number =>
  new Date(year, month - 1, day, 10).getTime();

const earned = (definitionId: string, achievedAt: number) => ({ definitionId, achievedAt });

const pick = (
  items: readonly { definitionId: string; achievedAt: number }[],
  now: number,
  acknowledged: readonly string[] = [],
) => pickRetrospective(items, { now, acknowledged: new Set(acknowledged) });

describe('la rétrospective', () => {
  it('ne rend rien la plupart du temps — c’est son travail principal', () => {
    const items = [earned('bench-100', at(2023, 3, 14))];
    expect(pick(items, at(2024, 7, 2))).toBeUndefined();
  });

  it('rend l’anniversaire le jour même', () => {
    const items = [earned('bench-100', at(2023, 3, 14))];
    expect(pick(items, at(2024, 3, 14))).toMatchObject({
      definitionId: 'bench-100',
      years: 1,
    });
  });

  it('laisse une semaine pour l’ouvrir — on ne s’entraîne pas tous les jours', () => {
    const items = [earned('bench-100', at(2023, 3, 14))];
    expect(pick(items, at(2024, 3, 20))).toMatchObject({ years: 1 });
  });

  it('se tait passé la semaine, plutôt que de rattraper des mois plus tard', () => {
    const items = [earned('bench-100', at(2023, 3, 14))];
    expect(pick(items, at(2024, 3, 25))).toBeUndefined();
  });

  it('ne rend rien la veille de l’anniversaire', () => {
    const items = [earned('bench-100', at(2023, 3, 14))];
    expect(pick(items, at(2024, 3, 13))).toBeUndefined();
  });

  it('ne fête que les âges qui se disent : 1, 2, 3, 5 et 10 ans', () => {
    const items = [earned('bench-100', at(2019, 3, 14))];
    // Quatre ans n'est pas un âge dont on parle. Sept non plus.
    expect(pick(items, at(2023, 3, 14))).toBeUndefined();
    expect(pick(items, at(2024, 3, 14))).toMatchObject({ years: 5 });
  });

  it('ne montre jamais deux fois le même anniversaire', () => {
    const items = [earned('bench-100', at(2023, 3, 14))];
    const seen = [retrospectiveKey('bench-100', 1)];
    expect(pick(items, at(2024, 3, 14), seen)).toBeUndefined();
  });

  it('remontre le même palier l’année suivante, sous un autre âge', () => {
    const items = [earned('bench-100', at(2023, 3, 14))];
    const seen = [retrospectiveKey('bench-100', 1)];
    expect(pick(items, at(2025, 3, 14), seen)).toMatchObject({ years: 2 });
  });

  it('n’en rend qu’une seule, même quand trois tombent le même jour', () => {
    const items = [
      earned('bench-100', at(2023, 3, 14)),
      earned('squat-140', at(2023, 3, 14)),
      earned('sessions-100', at(2023, 3, 14)),
    ];
    const result = pick(items, at(2024, 3, 14));
    expect(result).toBeDefined();
    // Une carte, pas trois : trois cartes le même matin, c'est le spam que la
    // fonctionnalité existe pour ne pas produire.
    expect(items.filter((item) => item.definitionId === result?.definitionId)).toHaveLength(1);
  });

  it('préfère le plus vieil anniversaire quand plusieurs se présentent', () => {
    // Dix ans passe avant un an : c'est le plus rare des deux, et le plus rare
    // est celui qu'on regretterait de ne pas avoir vu.
    const items = [
      earned('bench-100', at(2023, 3, 14)),
      earned('pullup-1', at(2014, 3, 14)),
    ];
    expect(pick(items, at(2024, 3, 14))).toMatchObject({
      definitionId: 'pullup-1',
      years: 10,
    });
  });

  it('ignore un palier acquis dans le futur', () => {
    // Une date d'appareil déréglée ne doit pas faire fêter un anniversaire.
    const items = [earned('bench-100', at(2030, 3, 14))];
    expect(pick(items, at(2024, 3, 14))).toBeUndefined();
  });

  it('ne rend rien sur une liste vide', () => {
    expect(pick([], at(2024, 3, 14))).toBeUndefined();
  });

  it('traverse une année bissextile sans se décaler', () => {
    // Le 29 février n'a pas d'anniversaire en 2025 : JS le reporte au 1er mars,
    // et une semaine de fenêtre absorbe le report sans le signaler.
    const items = [earned('bench-100', at(2024, 2, 29))];
    const result = pick(items, at(2025, 3, 1));
    expect(result).toMatchObject({ years: 1 });
  });

  it('donne une clé d’acquittement stable', () => {
    expect(retrospectiveKey('bench-100', 1)).toBe(retrospectiveKey('bench-100', 1));
    expect(retrospectiveKey('bench-100', 1)).not.toBe(retrospectiveKey('bench-100', 2));
  });

  it('rend une fenêtre qui se ferme exactement au septième jour', () => {
    const achievedAt = at(2023, 3, 14);
    const items = [earned('bench-100', achievedAt)];
    const anniversary = at(2024, 3, 14);
    expect(pick(items, anniversary + 7 * DAY - 1)).toBeDefined();
    expect(pick(items, anniversary + 7 * DAY)).toBeUndefined();
  });
});

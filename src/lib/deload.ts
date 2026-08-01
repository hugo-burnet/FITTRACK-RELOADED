export const DELOAD_PERCENT = 80;
export const DELOAD_INCREMENT_KG = 2.5;

export function calculateDeloadWeight(weightKg: number): number {
  const reduced = weightKg * (DELOAD_PERCENT / 100);
  const rounded = Math.round(reduced / DELOAD_INCREMENT_KG) * DELOAD_INCREMENT_KG;
  return Number(rounded.toFixed(10));
}

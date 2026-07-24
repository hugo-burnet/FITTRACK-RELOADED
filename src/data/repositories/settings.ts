import { db } from '@/data/db';
import { DEFAULT_PLATES_KG } from '@/lib/plates';

const AVAILABLE_PLATE_WEIGHTS_KEY = 'availablePlateWeightsKg';
const CANONICAL_PLATE_WEIGHTS = new Set<number>(DEFAULT_PLATES_KG);

function defaultPlateWeights(): number[] {
  return [...DEFAULT_PLATES_KG];
}

function normalizeAvailablePlateWeightsKg(value: unknown): number[] {
  if (!Array.isArray(value)) return defaultPlateWeights();
  if (value.length === 0) return [];

  const validWeights = new Set(
    value.filter(
      (weight): weight is number =>
        typeof weight === 'number' &&
        Number.isFinite(weight) &&
        weight > 0 &&
        CANONICAL_PLATE_WEIGHTS.has(weight),
    ),
  );
  const normalized = DEFAULT_PLATES_KG.filter((weight) => validWeights.has(weight));

  return normalized.length > 0 ? normalized : defaultPlateWeights();
}

export async function getAvailablePlateWeightsKg(): Promise<number[]> {
  const setting = await db.settings.get(AVAILABLE_PLATE_WEIGHTS_KEY);

  return setting === undefined
    ? defaultPlateWeights()
    : normalizeAvailablePlateWeightsKg(setting.value);
}

export async function setAvailablePlateWeightsKg(
  weights: readonly number[],
): Promise<number[]> {
  const normalized = normalizeAvailablePlateWeightsKg([...weights]);

  await db.settings.put({
    key: AVAILABLE_PLATE_WEIGHTS_KEY,
    value: normalized,
    updatedAt: Date.now(),
  });

  return normalized;
}

/**
 * The three rules that make a decimal typable on a French phone.
 *
 * Extracted from `NumberInput` at Lot 5, unchanged, because the live workout
 * grid needs the same behaviour in a cell with no room for the ± steppers —
 * 96 px of chrome per cell, twice per row, on a 375 px screen. Copying them
 * would fork the one module that made "102,5" possible to enter.
 */

/** Digits and at most one separator. Rejects letters and a second comma. */
export const NUMERIC = /^\d*[.,]?\d*$/;

export const parseNumber = (raw: string): number | undefined => {
  if (raw === '') return undefined;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isNaN(parsed) ? undefined : parsed;
};

/**
 * The decimal separator is UI text, and this UI is French. Only ever applied to
 * values arriving from outside — what you typed is left exactly as you typed it.
 */
export const formatNumber = (value: number | undefined): string =>
  value === undefined ? '' : String(value).replace('.', ',');

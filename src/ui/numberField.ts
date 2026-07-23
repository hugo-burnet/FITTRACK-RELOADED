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

/**
 * The same field with the separator taken away — digits only.
 *
 * The live grid's duration cell shares its input with the load, where a
 * separator is not merely allowed but required: "102,5" for a half-plate. That
 * is exactly what makes a duration dangerous in the same shape of field — a
 * lifter reaching for a 1:30 plank types "1,3", the shape of a clock read as a
 * decimal, and stores 1.3 seconds. Lot 6 met this on the rest timer and answered
 * it by removing the text field outright (`RestPicker`); a 3.5rem grid cell has
 * no room for a picker's ±48px steppers, so the duration column keeps the field
 * and refuses the separator instead. A duration is entered in whole seconds
 * (`measurement` ENTRY_UNIT), so it never had a use for one.
 */
export const INTEGER = /^\d*$/;

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

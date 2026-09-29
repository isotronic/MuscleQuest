// The single home for unit conversion. Storage is canonical (weights in kg,
// distances in metres, body lengths in cm); convert only at the display
// boundary. The eslint config rejects these factors anywhere else.
export type WeightUnit = "kg" | "lbs";

// Exact by definition. The inverses are derived, never typed, so a round trip
// through both directions returns the value it started from.
export const KG_PER_LB = 0.45359237;
export const M_PER_FT = 0.3048;
export const CM_PER_IN = 2.54;

export const kgToDisplay = (kg: number, unit: string): number =>
  unit === "lbs" ? kg / KG_PER_LB : kg;

export const displayToKg = (value: number, unit: string): number =>
  unit === "lbs" ? value * KG_PER_LB : value;

export const metresToDisplay = (m: number, unit: string): number =>
  unit === "ft" ? m / M_PER_FT : m;

export const displayToMetres = (value: number, unit: string): number =>
  unit === "ft" ? value * M_PER_FT : value;

export const cmToDisplay = (cm: number, unit: string): number =>
  unit === "in" ? cm / CM_PER_IN : cm;

export const displayToCm = (value: number, unit: string): number =>
  unit === "in" ? value * CM_PER_IN : value;

/**
 * Rounds a converted value before it is stored, so the same input always
 * stores the same number. Unrounded, 225 lbs stored as 102.05820832500001 kg.
 * Three decimals is well below display precision in every unit.
 */
export const roundCanonical = (value: number): number =>
  Math.round(value * 1000) / 1000;

/** Converts kg for display and formats it, without the unit label. */
export const formatWeight = (
  kg: number,
  unit: string,
  { decimals = 1 }: { decimals?: number } = {},
): string => kgToDisplay(kg, unit).toFixed(decimals);

/**
 * Rows saved before roundCanonical carry float noise, and rounding moves a
 * stored kg value by up to 0.0005, which a 1RM metric scales by up to about 4.
 * Compare stored metrics with this tolerance so equal lifts compare equal.
 * The smallest real improvement (half a pound, or one rep) is far larger.
 */
export const METRIC_EPSILON = 0.01;

export const nearlyEqual = (a: number, b: number): boolean =>
  Math.abs(a - b) < METRIC_EPSILON;

/** True when value matches or beats target, allowing for float noise. */
export const isAtLeast = (value: number, target: number): boolean =>
  value > target - METRIC_EPSILON;

// Pounds fall back to this step when the rack has no plates stocked.
const FALLBACK_LBS_STEP = 0.5;

/**
 * Converts a kg progression suggestion to the weight shown and pre-filled.
 * Kg keeps the engine's 0.1 precision. Pounds round to the nearest multiple
 * of lbsStep (the smallest plate pair), since a kg increment converted to
 * pounds lands on weights nobody can load, like 229.9.
 */
export const suggestedWeightForDisplay = (
  kg: number,
  unit: string,
  lbsStep: number | null,
): number => {
  const display = kgToDisplay(kg, unit);
  if (unit !== "lbs") return Math.round(display * 10) / 10;
  const step = lbsStep != null && lbsStep > 0 ? lbsStep : FALLBACK_LBS_STEP;
  // toFixed guards against artifacts such as 3 * 0.1 = 0.30000000000000004.
  return parseFloat((Math.round(display / step) * step).toFixed(2));
};

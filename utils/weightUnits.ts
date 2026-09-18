// Weights are stored in kg; convert only at the display boundary.
export type WeightUnit = "kg" | "lbs";

export const KG_PER_LB = 0.45359237;

export const kgToDisplay = (kg: number, unit: string): number =>
  unit === "lbs" ? kg / KG_PER_LB : kg;

export const displayToKg = (value: number, unit: string): number =>
  unit === "lbs" ? value * KG_PER_LB : value;

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

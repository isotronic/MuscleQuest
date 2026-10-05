import { getLocales } from "expo-localization";

/**
 * Decimal separator of the device region (not the app language), read once at
 * module load. Values stay canonical strings with "." everywhere in the app;
 * the separator is only swapped at text fields and display formatting.
 */
export const DECIMAL_SEPARATOR: string =
  getLocales()[0]?.decimalSeparator || ".";

/**
 * Normalises typed text to a canonical decimal string. Both "," and "." are
 * accepted as the decimal mark (inputs never use grouping); everything else
 * apart from digits is dropped, as are any later marks.
 */
export function toCanonicalDecimal(text: string): string {
  let result = "";
  let seenMark = false;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") {
      result += ch;
    } else if ((ch === "." || ch === ",") && !seenMark) {
      result += ".";
      seenMark = true;
    }
  }
  return result;
}

/** Shows a canonical decimal string with the device separator. */
export function toDisplayDecimal(canonical: string): string {
  return DECIMAL_SEPARATOR === "."
    ? canonical
    : canonical.replace(".", DECIMAL_SEPARATOR);
}

/** Parses typed text to a number, or null when it holds no number. */
export function parseDecimalInput(text: string): number | null {
  const value = parseFloat(toCanonicalDecimal(text));
  return Number.isNaN(value) ? null : value;
}

/** Keeps digits only, for whole-number fields such as reps. */
export function sanitizeIntegerInput(text: string): string {
  return text.replace(/\D/g, "");
}

/** Formats a number for display with the device separator. */
export function formatDecimal(value: number, decimals: number): string {
  return toDisplayDecimal(value.toFixed(decimals));
}

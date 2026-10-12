import { displayToKg } from "@/utils/units";

/**
 * The body weight setting as numbers. fetchSettings already returns it in
 * the user's weight unit, so `display` needs no conversion and `kg` converts
 * back. Both are null while no body weight is set.
 */
export function settingsBodyWeight(
  settings: { bodyWeight?: string; weightUnit?: string } | undefined,
): { display: number | null; kg: number | null } {
  const display = parseFloat(settings?.bodyWeight ?? "");
  if (!(display > 0)) return { display: null, kg: null };
  return {
    display,
    kg: displayToKg(display, settings?.weightUnit ?? "kg"),
  };
}

/**
 * Paper's Checkbox forwards extra props to its touchable but does not declare
 * accessibilityLabel in its types. Spread the result onto a Checkbox so it is
 * announced as, e.g., "Warm-up set, checkbox, checked".
 */
export function checkboxLabel(label: string): object {
  return { accessibilityLabel: label };
}

/**
 * For the visible text beside a labelled checkbox: the checkbox already speaks
 * it, so the text is skipped instead of being a second, inert stop.
 */
export const checkboxCaptionA11y = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no",
} as const;

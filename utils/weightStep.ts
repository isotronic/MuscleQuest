// Rounds to 2 decimal places to guard against floating-point artifacts
// (e.g. 61.3 + 2.3 === 63.599999999999994) while preserving weights a user
// may have manually entered with up to 2 decimals of precision.
export function computeSteppedWeight(
  currentWeight: string,
  amount: number,
): string {
  const parsed = parseFloat(currentWeight);
  const base = isNaN(parsed) ? 0 : parsed;
  const stepped = Math.max(0, base + amount);
  return parseFloat(stepped.toFixed(2)).toString();
}

export type ValueKind = "mass" | "length" | "percent";

export interface MeasurementDisplayOptions {
  weightUnit: "kg" | "lbs";
  sizeUnit: "cm" | "in";
}

export function toDisplayValue(
  canonicalValue: number,
  value_kind: ValueKind,
  options: MeasurementDisplayOptions,
): { displayValue: number; displayUnit: string } {
  switch (value_kind) {
    case "mass":
      if (options.weightUnit === "lbs") {
        return {
          displayValue: parseFloat((canonicalValue * 2.2046226).toFixed(1)),
          displayUnit: "lbs",
        };
      }
      return {
        displayValue: parseFloat(canonicalValue.toFixed(1)),
        displayUnit: "kg",
      };
    case "length":
      if (options.sizeUnit === "in") {
        return {
          displayValue: parseFloat((canonicalValue / 2.54).toFixed(1)),
          displayUnit: "in",
        };
      }
      return {
        displayValue: parseFloat(canonicalValue.toFixed(1)),
        displayUnit: "cm",
      };
    case "percent":
      return {
        displayValue: parseFloat(canonicalValue.toFixed(1)),
        displayUnit: "%",
      };
    default:
      throw new Error(`Unsupported value_kind: ${value_kind}`);
  }
}

export function toCanonicalValue(
  displayValue: number,
  value_kind: ValueKind,
  options: MeasurementDisplayOptions,
): number {
  switch (value_kind) {
    case "mass":
      if (options.weightUnit === "lbs") {
        return parseFloat((displayValue * 0.45359237).toFixed(4));
      }
      return displayValue;
    case "length":
      if (options.sizeUnit === "in") {
        return parseFloat((displayValue * 2.54).toFixed(4));
      }
      return displayValue;
    case "percent":
      return displayValue;
    default:
      throw new Error(`Unsupported value_kind: ${value_kind}`);
  }
}

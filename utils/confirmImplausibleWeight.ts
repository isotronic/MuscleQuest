import { Alert } from "react-native";
import { t } from "@lingui/core/macro";
import { toDisplayDecimal } from "./numberFormat";
import {
  NO_HISTORY_LIMIT_KG,
  NO_HISTORY_LIMIT_LBS,
} from "./weightPlausibility";

const show = (value: number) => toDisplayDecimal(String(value));

/**
 * Asks before recording a weight that checkWeightPlausibility flagged. Edit
 * dismisses the dialog and leaves the set open; the other buttons complete it.
 */
export function confirmImplausibleWeight({
  weight,
  suggestion,
  reference,
  weightUnit,
  onUse,
  onKeep,
}: {
  weight: number;
  suggestion: number | null;
  reference: number | null;
  weightUnit: string;
  onUse: (corrected: number) => void;
  onKeep: () => void;
}): void {
  const entered = show(weight);
  const body =
    reference !== null
      ? t`Your heaviest recent set is ${show(reference)} ${weightUnit}.`
      : t`That is more than ${show(
          weightUnit === "lbs" ? NO_HISTORY_LIMIT_LBS : NO_HISTORY_LIMIT_KG,
        )} ${weightUnit}.`;

  Alert.alert(t`Is ${entered} ${weightUnit} right?`, body, [
    { text: t`Edit`, style: "cancel" },
    ...(suggestion !== null
      ? [
          {
            text: t`Use ${show(suggestion)}`,
            onPress: () => onUse(suggestion),
          },
        ]
      : []),
    { text: t`Keep ${entered}`, onPress: onKeep },
  ]);
}

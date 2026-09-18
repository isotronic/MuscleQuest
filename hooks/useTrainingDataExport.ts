import { useState } from "react";
import { Alert } from "react-native";
import { t } from "@lingui/core/macro";
import { exportTrainingData, ExportFormat } from "@/utils/dataExport";
import { notifyBugsnag } from "@/utils/bugsnagDedup";

// Asks for a format, then writes the export to a folder the user picks.
export const useTrainingDataExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const runExport = async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      const saved = await exportTrainingData(format);
      if (saved) {
        Alert.alert(
          t`Export complete`,
          t`Your training data was saved to the folder you picked.`,
        );
      }
    } catch (error) {
      notifyBugsnag(error);
      Alert.alert(
        t`Export failed`,
        t`Your training data could not be exported. Please try again.`,
      );
    } finally {
      setIsExporting(false);
    }
  };

  const promptExport = () => {
    if (isExporting) return;
    Alert.alert(
      t`Export training data`,
      t`CSV creates two spreadsheet files: your sets and your body measurements. JSON creates one file with everything, including plans and custom exercises. Weights are in kg and distances in meters.`,
      [
        { text: t`Cancel`, style: "cancel" },
        { text: t`JSON`, onPress: () => runExport("json") },
        { text: t`CSV`, onPress: () => runExport("csv") },
      ],
    );
  };

  return { isExporting, promptExport };
};

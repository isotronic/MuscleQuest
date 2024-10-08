import { deleteAllAnimatedImages } from "@/utils/deleteAllAnimatedImaged";
import { downloadAllAnimatedImages } from "@/utils/downloadAllAnimatedImages";
import { useState } from "react";
import { Alert } from "react-native";

export const useImageManagement = (
  updateSetting: ({ key, value }: { key: string; value: string }) => void,
) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggleDownloadImages = (value: boolean) => {
    if (value === true) {
      Alert.alert(
        "Download Images",
        "Are you sure you want to download all animated images? This may take a while.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Download",
            onPress: () => handleDownloadAllImages(),
          },
        ],
      );
    } else {
      Alert.alert(
        "Download Images",
        "Are you sure you want to delete all animated images? Single images will be automatically re-downloaded when viewed.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            onPress: () => handleDeleteAllImages(),
          },
        ],
      );
    }
  };

  const handleDownloadAllImages = async () => {
    setProgress(0);
    setIsDownloading(true);
    updateSetting({ key: "downloadImages", value: "true" });

    try {
      const { success, failedDownloads } = await downloadAllAnimatedImages(
        (currentProgress) => {
          setProgress(currentProgress);
        },
      );

      if (success) {
        Alert.alert("Success", "All images downloaded successfully!");
      } else {
        Alert.alert(
          "Download Complete",
          `Some images failed to download after retries. Failed exercise IDs: ${failedDownloads.join(", ")}`,
        );
        console.error(
          "Some images failed to download after retries:",
          failedDownloads,
        );
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred while downloading images.");
      console.error("Error downloading images:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteAllImages = async () => {
    setProgress(0);
    setIsDeleting(true);
    updateSetting({ key: "downloadImages", value: "false" });
    // Confirm with the user before deleting
    try {
      const { success, failedDeletes } = await deleteAllAnimatedImages(
        (currentProgress) => {
          setProgress(currentProgress);
        },
      );

      if (success) {
        Alert.alert("Success", "All images deleted successfully!");
      } else {
        Alert.alert(
          "Delete Complete",
          `Some images failed to delete. Failed exercise IDs: ${failedDeletes.join(", ")}`,
        );
        console.error("Some images failed to delete:", failedDeletes);
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred while deleting images.");
      console.error("Error deleting images:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isDownloading,
    isDeleting,
    progress,
    toggleDownloadImages,
  };
};

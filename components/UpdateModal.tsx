import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Modal, Portal, Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useAppUpdates } from "@/hooks/useAppUpdates";
import { t } from "@lingui/core/macro";

export const UpdateModal = () => {
  const { status, errorType, reloadApp, dismissError } = useAppUpdates();

  // Only show modal when downloading, ready, or error (skip checking state to avoid flash)
  if (status === "idle" || status === "checking" || status === "no-update") {
    return null;
  }

  const getContent = () => {
    switch (status) {
      case "downloading":
        return {
          title: t`Downloading Update`,
          message: t`Please wait while we download the latest version...`,
          showButton: false,
        };
      case "ready":
        return {
          title: t`Update Ready`,
          message: t`A new version has been downloaded. Tap the button below to restart and apply the update.`,
          showButton: true,
          buttonText: t`Restart App`,
          onPress: reloadApp,
        };
      case "error": {
        switch (errorType) {
          case "download-failed":
            return {
              title: t`Download Failed`,
              message: t`The update couldn't be downloaded. Check your internet connection and reopen the app to try again.`,
              showButton: true,
              buttonText: t`Dismiss`,
              onPress: dismissError,
            };
          case "reload-failed":
            return {
              title: t`Restart Failed`,
              message: t`The update is ready but the app couldn't restart automatically. Try tapping the button below, or close and reopen the app manually.`,
              showButton: true,
              buttonText: t`Try Again`,
              onPress: reloadApp,
            };
          default:
            return {
              title: t`Download Failed`,
              message: t`The update couldn't be downloaded. Check your internet connection and reopen the app to try again.`,
              showButton: true,
              buttonText: t`Dismiss`,
              onPress: dismissError,
            };
        }
      }
      default: {
        const _exhaustiveCheck: never = status;
        return _exhaustiveCheck;
      }
    }
  };

  const content = getContent();

  return (
    <Portal>
      <Modal
        visible={true}
        dismissable={status === "error"}
        onDismiss={status === "error" ? dismissError : undefined}
        theme={{ colors: { backdrop: "rgba(0, 0, 0, 0.65)" } }}
      >
        <View style={styles.container}>
          <ThemedText type="subtitle">{content.title}</ThemedText>

          {!content.showButton && (
            <ActivityIndicator
              size="large"
              color={Colors.dark.tint}
              style={styles.spinner}
            />
          )}

          <ThemedText style={styles.message}>{content.message}</ThemedText>

          {content.showButton && (
            <Button
              mode="contained"
              onPress={content.onPress}
              style={styles.button}
            >
              {content.buttonText}
            </Button>
          )}
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.cardBackground2,
    padding: 24,
    margin: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  spinner: {
    marginVertical: 24,
  },
  message: {
    textAlign: "center",
    marginTop: 16,
    lineHeight: 20,
  },
  button: {
    marginTop: 24,
    width: "100%",
  },
});

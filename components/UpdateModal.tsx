import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Modal, Portal, Button } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useAppUpdates } from "@/hooks/useAppUpdates";

export const UpdateModal = () => {
  const { status, reloadApp } = useAppUpdates();

  // Only show modal when downloading or ready (skip checking state to avoid flash)
  if (
    status === "idle" ||
    status === "checking" ||
    status === "no-update" ||
    status === "error"
  ) {
    return null;
  }

  const getContent = () => {
    switch (status) {
      case "downloading":
        return {
          title: "⬇️ Downloading Update",
          message: "Please wait while we download the latest version...",
          showButton: false,
        };
      case "ready":
        return {
          title: "✨ Update Ready!",
          message:
            "A new version has been downloaded. Tap the button below to restart and apply the update.",
          showButton: true,
        };
      default:
        return {
          title: "",
          message: "",
          showButton: false,
        };
    }
  };

  const content = getContent();

  return (
    <Portal>
      <Modal visible={true} dismissable={false}>
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
            <Button mode="contained" onPress={reloadApp} style={styles.button}>
              Restart App
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

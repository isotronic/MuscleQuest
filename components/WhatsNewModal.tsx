import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Modal, Portal, Button, Divider } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import {
  CURRENT_APP_VERSION,
  WHATS_NEW_ENTRIES,
  WhatsNewEntry,
} from "@/constants/WhatsNew";
import { Colors } from "@/constants/Colors";

export const WhatsNewModal = () => {
  const [visible, setVisible] = useState(false);
  const [entriesToShow, setEntriesToShow] = useState<WhatsNewEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { data: settings } = useSettingsQuery();
  const { mutate: setSetting } = useUpdateSettingsMutation();

  useEffect(() => {
    if (!settings) return;

    const seenVersion = parseInt(settings.lastSeenVersion ?? "0", 10);
    const unseenEntries = WHATS_NEW_ENTRIES.filter(
      (entry) => entry.version > seenVersion,
    );
    if (unseenEntries.length > 0) {
      setEntriesToShow(unseenEntries.sort((a, b) => a.version - b.version));
      setVisible(true);
    }
  }, [settings]);

  const handleNext = () => {
    if (currentIndex + 1 < entriesToShow.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setSetting({
        key: "lastSeenVersion",
        value: CURRENT_APP_VERSION.toString(),
      });
      setVisible(false);
    }
  };

  if (!visible || entriesToShow.length === 0) return null;

  const currentEntry = entriesToShow[currentIndex];

  return (
    <Portal>
      <Modal visible={visible} onDismiss={handleNext}>
        <View
          style={{
            backgroundColor: Colors.dark.cardBackground2,
            padding: 16,
            margin: 16,
            borderRadius: 12,
          }}
        >
          <ThemedText type="subtitle">🎉 What's New</ThemedText>
          <Divider style={{ marginTop: 12 }} />
          <ThemedText>{currentEntry.message}</ThemedText>
          <Button
            mode="contained"
            onPress={handleNext}
            style={{ marginTop: 24 }}
          >
            {currentIndex + 1 < entriesToShow.length ? "Next" : "Got it!"}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
};

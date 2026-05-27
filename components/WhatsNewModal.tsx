import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Modal, Portal, Button, Divider } from "react-native-paper";
import { ThemedText } from "@/components/ThemedText";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useUpdateSettingsMutation } from "@/hooks/useUpdateSettingsMutation";
import {
  CURRENT_WHATS_NEW_VERSION,
  WHATS_NEW_ENTRIES,
  WhatsNewEntry,
} from "@/constants/WhatsNew";
import { Colors } from "@/constants/Colors";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { radii } from "@/theme";

export const WhatsNewModal = () => {
  const [visible, setVisible] = useState(false);
  const [entriesToShow, setEntriesToShow] = useState<WhatsNewEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { data: settings } = useSettingsQuery();
  const { mutate: setSetting } = useUpdateSettingsMutation();

  const { _ } = useLingui();

  useEffect(() => {
    if (!settings) return;

    if (settings.lastSeenVersion == null) {
      setSetting({
        key: "lastSeenVersion",
        value: CURRENT_WHATS_NEW_VERSION.toString(),
      });
      return;
    }

    const parsed = Number.parseInt(settings.lastSeenVersion, 10);
    const seenVersion = Number.isNaN(parsed) ? 0 : parsed;
    const unseenEntries = WHATS_NEW_ENTRIES.filter(
      (entry) => entry.version > seenVersion,
    );
    if (unseenEntries.length > 0) {
      setCurrentIndex(0);
      setEntriesToShow(unseenEntries.sort((a, b) => a.version - b.version));
      setVisible(true);
    }
  }, [setSetting, settings]);

  const handleNext = () => {
    if (currentIndex + 1 < entriesToShow.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setSetting({
        key: "lastSeenVersion",
        value: CURRENT_WHATS_NEW_VERSION.toString(),
      });
      setVisible(false);
    }
  };

  const handleSkipAll = () => {
    const highestVersion = Math.max(...entriesToShow.map((e) => e.version));
    setSetting({
      key: "lastSeenVersion",
      value: highestVersion.toString(),
    });
    setVisible(false);
  };

  if (!visible || entriesToShow.length === 0) return null;

  const currentEntry = entriesToShow[currentIndex];

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleNext}
        theme={{ colors: { backdrop: "rgba(0, 0, 0, 0.65)" } }}
      >
        <View
          style={{
            backgroundColor: Colors.dark.cardBackground2,
            padding: 16,
            margin: 16,
            borderRadius: radii.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <ThemedText type="subtitle">
              <Trans>🎉 What's New</Trans>
            </ThemedText>
            {entriesToShow.length > 1 && (
              <ThemedText
                style={{ opacity: 0.5, fontSize: 13 }}
              >{`${currentIndex + 1}/${entriesToShow.length}`}</ThemedText>
            )}
          </View>
          <Divider style={{ marginTop: 12 }} />
          <ThemedText>{_(currentEntry.message)}</ThemedText>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 24,
            }}
          >
            {currentIndex + 1 < entriesToShow.length && (
              <Button mode="outlined" onPress={handleSkipAll}>
                <Trans>Skip all</Trans>
              </Button>
            )}
            <Button mode="contained" onPress={handleNext}>
              {currentIndex + 1 < entriesToShow.length ? t`Next` : t`Got it!`}
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );
};

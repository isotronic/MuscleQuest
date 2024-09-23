import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useEffect } from "react";

export default function useKeepScreenOn() {
  const { data: settings } = useSettingsQuery();

  useEffect(() => {
    let keepAwakeActive = false;

    if (settings?.keepScreenOn === "true") {
      activateKeepAwakeAsync().then(() => {
        keepAwakeActive = true;
      });
    }

    return () => {
      if (keepAwakeActive) {
        deactivateKeepAwake();
      }
    };
  }, [settings?.keepScreenOn]);
}

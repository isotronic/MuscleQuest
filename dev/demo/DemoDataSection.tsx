// Settings → About, dev builds started with EXPO_PUBLIC_DEMO_DATA=1 only.
// Not translated: it never reaches users.
import { useCallback, useEffect, useState } from "react";
import { Alert, DevSettings } from "react-native";
import { SettingRow, SettingsHeader } from "@/components/settings/SettingRow";
import { useAppTheme } from "@/theme";
import { useSocialRefreshStore } from "@/store/socialRefreshStore";
import { isDemoBuild, setDemoActive } from "./state";
import {
  clearDemoSeedRecord,
  countUserWorkouts,
  readDemoSeedRecord,
  removeDemoData,
  seedDemoData,
  type DemoSeedRecord,
} from "./seed";
import { clearDemoSocialState } from "./social";

type Status =
  | { kind: "loading" }
  | { kind: "ready"; record: DemoSeedRecord | null; userWorkouts: number };

const describe = (record: DemoSeedRecord | null, userWorkouts: number) => {
  if (record?.status === "seeded") {
    const seededOn = new Date(record.seededAt).toLocaleDateString();
    const extra =
      userWorkouts > 0
        ? ` ${userWorkouts} workout(s) logged since are kept on removal.`
        : "";
    return `Loaded ${seededOn}: ${record.completedWorkoutIds.length} workouts, ${record.measurementEntryIds.length} measurements, 3 demo friends.${extra}`;
  }
  if (record?.status === "removed") return "Removed. Not loaded on launch.";
  if (userWorkouts > 0) {
    return `Not loaded: this database already has ${userWorkouts} workout(s). Clear the app's storage first, or load it alongside them.`;
  }
  return "Not loaded.";
};

export function DemoDataSection() {
  const { colors } = useAppTheme();
  const requestSocialRefresh = useSocialRefreshStore((s) => s.requestRefresh);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const record = await readDemoSeedRecord();
    setStatus({
      kind: "ready",
      record,
      userWorkouts: await countUserWorkouts(
        record?.status === "seeded" ? record : null,
      ),
    });
  }, []);

  useEffect(() => {
    refresh().catch((e) => console.error("Demo status failed:", e));
  }, [refresh]);

  if (!isDemoBuild() || status.kind === "loading") return null;
  const { record, userWorkouts } = status;
  const seeded = record?.status === "seeded";

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      // Every query and the social listeners start over on the new data.
      DevSettings.reload();
    } catch (e) {
      console.error("Demo data action failed:", e);
      Alert.alert("Demo data", String(e));
      await refresh().catch((refreshError) =>
        console.error("Demo status refresh failed:", refreshError),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert(
      "Remove demo data?",
      "Deletes the seeded plan, workouts, measurements, feedback and pins, and restores the settings it changed. The app reloads.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            run(async () => {
              await removeDemoData();
              setDemoActive(false);
              clearDemoSocialState();
              requestSocialRefresh();
            }),
        },
      ],
    );

  const load = () => {
    const doLoad = () =>
      run(async () => {
        if (record) await clearDemoSeedRecord();
        await seedDemoData();
        setDemoActive(true);
      });
    if (userWorkouts === 0) {
      doLoad();
      return;
    }
    Alert.alert(
      "Load demo data anyway?",
      `This database already has ${userWorkouts} workout(s). Demo data is added alongside them, and the screenshots will include them.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Load", onPress: doLoad },
      ],
    );
  };

  return (
    <>
      <SettingsHeader>Demo data (dev build)</SettingsHeader>
      {seeded ? (
        <SettingRow
          icon="delete-outline"
          iconColor={colors.danger}
          title="Remove demo data"
          titleColor={colors.danger}
          value={describe(record, userWorkouts)}
          onPress={remove}
          disabled={busy}
        />
      ) : (
        <SettingRow
          icon="database-plus"
          title="Load demo data"
          value={describe(record, userWorkouts)}
          onPress={load}
          disabled={busy}
        />
      )}
    </>
  );
}

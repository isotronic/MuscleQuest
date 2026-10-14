// Demo mode for marketing screenshots, dev variant only.
//
// Loaded through ./gate when the dev server runs with EXPO_PUBLIC_DEMO_DATA=1.
// On the first launch it seeds 8 weeks of training, measurements and a
// scheduled plan (./seed, data in ./fixtures/history.json), and puts three
// local demo friends and a friend request in the social layer (./social).
// Settings → About can remove it all again. Nothing in demo mode is sent to
// Firestore or Storage: isLocalDataOwnedBy answers false, which every
// publish, push and backup checks first.
import { Alert } from "react-native";
import { isDemoBuild, setDemoActive } from "./state";
import { countUserWorkouts, readDemoSeedRecord, seedDemoData } from "./seed";

export { isDemoActive, isDemoBuild, isDemoUid } from "./state";
export {
  acceptDemoRequest,
  applyDemoSocialState,
  declineDemoRequest,
  demoFriendData,
  removeDemoFriend,
} from "./social";
export { DemoDataSection } from "./DemoDataSection";

export const LOADING_LABEL = "Loading demo data…";

export type StartupSeedResult =
  | { status: "inactive" }
  | { status: "seeded" }
  | { status: "already-seeded" }
  | { status: "removed" }
  | { status: "existing-history"; workouts: number }
  | { status: "failed"; error: Error };

/**
 * Runs after the normal startup and before the first screen: seeds once, or
 * notes that demo data is already there. Never throws, so a demo problem
 * cannot keep the app from starting.
 */
export const runStartupSeed = async (
  /** Called just before seeding, which takes a few seconds. */
  onSeedStart?: () => void,
): Promise<StartupSeedResult> => {
  if (!isDemoBuild()) return { status: "inactive" };
  try {
    const record = await readDemoSeedRecord();
    if (record?.status === "seeded") {
      setDemoActive(true);
      return { status: "already-seeded" };
    }
    // Removed from Settings → About: loading again is a choice made there.
    if (record?.status === "removed") return { status: "removed" };

    const workouts = await countUserWorkouts();
    if (workouts > 0) {
      Alert.alert(
        "Demo data not loaded",
        `This database already has ${workouts} workout(s). Clear the dev app's storage in Android settings, or load the demo data anyway from Settings → About.`,
      );
      return { status: "existing-history", workouts };
    }

    onSeedStart?.();
    await seedDemoData();
    setDemoActive(true);
    return { status: "seeded" };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error("Demo seed failed:", error);
    Alert.alert("Demo data failed to load", error.message);
    return { status: "failed", error };
  }
};

import Constants from "expo-constants";

/** Settings key holding what the seed inserted, see DemoSeedRecord. */
export const DEMO_SEED_KEY = "demo_seed";

/** uids of demo friends; never sent to Firestore. */
const DEMO_UID_PREFIX = "demo-";

/**
 * The runtime half of the gate (the build-time half is ./gate): a dev bundle
 * of the dev variant. Off everywhere else, even when the module is loaded.
 */
export const isDemoBuild = (): boolean =>
  __DEV__ && Constants.expoConfig?.extra?.appVariant === "development";

// Whether demo data is in the database this session. Set at startup (before
// any screen renders) and by the About screen actions, so the social layer
// can check it synchronously.
let active = false;

export const isDemoActive = (): boolean => isDemoBuild() && active;

export const setDemoActive = (value: boolean): void => {
  active = value;
};

export const isDemoUid = (uid: string | null | undefined): uid is string =>
  isDemoActive() && !!uid && uid.startsWith(DEMO_UID_PREFIX);

import { create } from "zustand";

/** idle: no background seeding this boot (a returning install). */
export type SeedingStatus = "idle" | "running" | "done" | "failed";

// Not persisted: each boot works out again whether seeding is needed.
export const useFirstLaunchSeedingStore = create<{ status: SeedingStatus }>(
  () => ({ status: "idle" }),
);

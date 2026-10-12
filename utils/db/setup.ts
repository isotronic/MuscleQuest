import { notifyBugsnag } from "@/utils/bugsnagDedup";
import type { SetupWrite } from "@/utils/setupChanges";
import { SETUP_DONE_KEY, SetupState } from "@/utils/setupState";
import { openDatabase } from "./connection";
import { insertBodyWeightMeasurement } from "./measurements";
import { writeWeekStart } from "./settings";

/**
 * Applies the setup screen's changes (see setupChanges) and marks setup
 * done, in one transaction: a failure part way leaves every setting as it
 * was, so trying again cannot log the body weight twice.
 */
export const saveSetupChanges = async (
  write: SetupWrite,
  today: Date = new Date(),
): Promise<void> => {
  const db = await openDatabase("userData.db");
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const set = (key: string, value: string) =>
        txn.runAsync(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          [key, value],
        );
      for (const { key, value } of write.settings) await set(key, value);
      if (write.weekStartsOn !== undefined) {
        await writeWeekStart(
          txn,
          write.weekStartsOn,
          today,
          !!write.weekStartImmediately,
        );
      }
      if (write.bodyWeightKg !== undefined) {
        await insertBodyWeightMeasurement(txn, write.bodyWeightKg);
        await set("bodyWeight", String(write.bodyWeightKg));
      }
      await set(SETUP_DONE_KEY, SetupState.done);
    });
  } catch (error) {
    console.error("Error saving setup:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    await db.closeAsync();
  }
};

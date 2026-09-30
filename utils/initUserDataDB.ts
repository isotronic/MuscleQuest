import { openDatabase } from "./database";
import { runMigrations } from "./db/runMigrations";
import { repairLocalDates } from "./db/repairLocalDates";

// Schema changes go in a new numbered file under utils/db/migrations/, not
// here.
export async function initUserDataDB() {
  const db = await openDatabase("userData.db");
  try {
    await db.execAsync("PRAGMA busy_timeout = 3000;");
    await db.execAsync("PRAGMA journal_mode = WAL;");
    await runMigrations(db);
    await repairLocalDates(db);
  } finally {
    await db.closeAsync();
  }
}

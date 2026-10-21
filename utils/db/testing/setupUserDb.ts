// Test-only: a migrated in-memory userData.db that the mocked `openDatabase`
// from `@/utils/db/connection` hands out. The calling test file must declare
// `jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }))`.
// Never imported by app code.
import { openDatabase } from "@/utils/db/connection";
import { runMigrations } from "@/utils/db/runMigrations";
import { createNodeSqliteDb } from "./nodeSqliteDb";

export const setupUserDb = async () => {
  const created = createNodeSqliteDb();
  await runMigrations(created.db);
  (openDatabase as jest.Mock).mockResolvedValue(created.db);
  return created;
};

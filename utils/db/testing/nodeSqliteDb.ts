// Test-only: expo-sqlite's async surface backed by Node's built-in SQLite, so
// tests can assert on what the database actually ends up holding. Never
// imported by app code.
import type { SQLiteDatabase } from "expo-sqlite";
import { DatabaseSync } from "node:sqlite";

export const createNodeSqliteDb = () => {
  const sqlite = new DatabaseSync(":memory:");
  const db: any = {
    execAsync: async (sql: string) => sqlite.exec(sql),
    runAsync: async (sql: string, params: any[] = []) => {
      const result = sqlite.prepare(sql).run(...params);
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    getAllAsync: async (sql: string, params: any[] = []) =>
      sqlite.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, params: any[] = []) =>
      sqlite.prepare(sql).get(...params) ?? null,
    // expo-sqlite runs this on a second connection. An in-memory database
    // has only one, so the transaction runs on it directly; commit and
    // rollback behave the same.
    withExclusiveTransactionAsync: async (
      task: (txn: SQLiteDatabase) => Promise<void>,
    ) => {
      sqlite.exec("BEGIN");
      try {
        await task(db);
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    closeAsync: async () => {},
  };
  return { sqlite, db: db as SQLiteDatabase };
};

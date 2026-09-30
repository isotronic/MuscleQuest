import { notifyBugsnag } from "@/utils/bugsnagDedup";
import * as SQLite from "expo-sqlite";
import { openDatabase } from "./connection";

export const saveNote = async (
  referenceId: number,
  secondaryReferenceId: number | null,
  note: string,
  noteType: string,
) => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");

    if (secondaryReferenceId == null) {
      // Insert/update where secondary_reference_id IS NULL
      await db.runAsync(
        `
        INSERT OR REPLACE INTO notes (
          id, note, type, reference_id, secondary_reference_id, created_at
        )
        VALUES (
          (SELECT id FROM notes
            WHERE type = ?
              AND reference_id = ?
              AND secondary_reference_id IS NULL
          ), -- preserve existing ID if it exists
          ?,  -- new note text
          ?,  -- type
          ?,  -- reference_id
          NULL,  -- secondary_reference_id is NULL
          CURRENT_TIMESTAMP
        );
        `,
        [noteType, referenceId, note, noteType, referenceId],
      );
    } else {
      // Insert/update using secondary_reference_id = ?
      await db.runAsync(
        `
        INSERT OR REPLACE INTO notes (
          id, note, type, reference_id, secondary_reference_id, created_at
        )
        VALUES (
          (SELECT id FROM notes
            WHERE type = ?
              AND reference_id = ?
              AND secondary_reference_id = ?
          ), -- preserve existing ID if it exists
          ?,  -- new note text
          ?,  -- type
          ?,  -- reference_id
          ?,  -- secondary_reference_id
          CURRENT_TIMESTAMP
        );
        `,
        [
          noteType,
          referenceId,
          secondaryReferenceId,
          note,
          noteType,
          referenceId,
          secondaryReferenceId,
        ],
      );
    }
  } catch (error: any) {
    console.error("Error saving note:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

export const fetchNote = async (
  referenceId: number,
  secondaryReferenceId: number | null,
  noteType: string,
) => {
  let db: SQLite.SQLiteDatabase | undefined;
  try {
    db = await openDatabase("userData.db");

    let query = `
      SELECT note FROM notes 
      WHERE type = ? 
        AND reference_id = ? 
        AND secondary_reference_id = ?
    `;
    let params: (string | number | null)[] = [
      noteType,
      referenceId,
      secondaryReferenceId,
    ];

    // If secondaryReferenceId is null, we must use "IS NULL" instead of "= ?"
    if (secondaryReferenceId == null) {
      query = `
        SELECT note FROM notes 
        WHERE type = ? 
          AND reference_id = ? 
          AND secondary_reference_id IS NULL
      `;
      params = [noteType, referenceId];
    }

    const result = (await db.getFirstAsync(query, params)) as { note?: string };
    return result?.note || "";
  } catch (error: any) {
    console.error("Error fetching note:", error);
    notifyBugsnag(error);
    throw error;
  } finally {
    if (db) await db.closeAsync();
  }
};

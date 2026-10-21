import { setupUserDb } from "@/utils/db/testing/setupUserDb";
import {
  deleteBodyMeasurementSession,
  fetchActiveBodyMetricDefinitions,
  fetchBodyMeasurementSessions,
  insertCustomBodyMetricDefinition,
  softDeleteCustomBodyMetricDefinition,
  toggleBodyMetricActive,
  updateBodyMeasurementSession,
} from "@/utils/db/measurements";

jest.mock("@/utils/db/connection", () => ({ openDatabase: jest.fn() }));

const OLDER = "2026-10-01T08:00:00.000Z";
const NEWER = "2026-10-10T08:00:00.000Z";

describe("body measurement edits", () => {
  let sqlite: Awaited<ReturnType<typeof setupUserDb>>["sqlite"];
  let weightId: number;
  let waistId: number;

  const bodyWeightSetting = () =>
    (
      sqlite
        .prepare(`SELECT value FROM settings WHERE key = 'bodyWeight'`)
        .get() as { value: string } | undefined
    )?.value;

  const legacyWeight = (date: string) =>
    (
      sqlite
        .prepare(`SELECT body_weight FROM body_measurements WHERE date = ?`)
        .get(date) as { body_weight: number | null } | undefined
    )?.body_weight;

  const valuesFor = (entryId: number) =>
    sqlite
      .prepare(
        `SELECT metric_id, value FROM body_measurement_values
         WHERE entry_id = ? ORDER BY metric_id`,
      )
      .all(entryId);

  beforeEach(async () => {
    ({ sqlite } = await setupUserDb());
    const metricId = (key: string) =>
      (
        sqlite
          .prepare(`SELECT id FROM body_metric_definitions WHERE key = ?`)
          .get(key) as { id: number }
      ).id;
    weightId = metricId("weight");
    waistId = metricId("waist");

    sqlite.exec(`
      INSERT INTO body_measurement_entries (id, recorded_at, local_date)
      VALUES (1, '${OLDER}', '2026-10-01'), (2, '${NEWER}', '2026-10-10');
      INSERT INTO body_measurement_values (entry_id, metric_id, value)
      VALUES (1, ${weightId}, 80), (2, ${weightId}, 82);
      INSERT INTO body_measurements (date, body_weight)
      VALUES ('${OLDER}', 80), ('${NEWER}', 82);
      INSERT OR REPLACE INTO settings (key, value) VALUES ('bodyWeight', '82');
    `);
  });

  afterEach(() => sqlite.close());

  describe("updateBodyMeasurementSession", () => {
    it("updates body weight when the newest entry changes", async () => {
      await updateBodyMeasurementSession(2, [
        { metric_id: weightId, value: 83 },
      ]);

      expect(legacyWeight(NEWER)).toBe(83);
      expect(bodyWeightSetting()).toBe("83");
    });

    it("keeps body weight when an older entry changes", async () => {
      await updateBodyMeasurementSession(1, [
        { metric_id: weightId, value: 79 },
      ]);

      expect(legacyWeight(OLDER)).toBe(79);
      expect(bodyWeightSetting()).toBe("82");
    });

    it("falls back to the older weight when the newest entry loses its weight", async () => {
      await updateBodyMeasurementSession(2, [
        { metric_id: waistId, value: 90 },
      ]);

      expect(legacyWeight(NEWER)).toBeNull();
      expect(bodyWeightSetting()).toBe("80");
      expect(valuesFor(2)).toEqual([{ metric_id: waistId, value: 90 }]);
    });

    it("removes every value when given none", async () => {
      await updateBodyMeasurementSession(2, []);

      expect(valuesFor(2)).toEqual([]);
    });

    it("adds the legacy row when the entry has none", async () => {
      sqlite.exec(`
        INSERT INTO body_measurement_entries (id, recorded_at, local_date)
        VALUES (3, '2026-10-05T08:00:00.000Z', '2026-10-05');
      `);

      await updateBodyMeasurementSession(3, [
        { metric_id: weightId, value: 81 },
      ]);

      expect(legacyWeight("2026-10-05T08:00:00.000Z")).toBe(81);
      expect(bodyWeightSetting()).toBe("82");
    });
  });

  describe("deleteBodyMeasurementSession", () => {
    it("removes the newest entry and falls back to the older weight", async () => {
      await deleteBodyMeasurementSession(2);

      expect(valuesFor(2)).toEqual([]);
      expect(
        sqlite.prepare(`SELECT id FROM body_measurement_entries`).all(),
      ).toEqual([{ id: 1 }]);
      expect(legacyWeight(NEWER)).toBeUndefined();
      expect(bodyWeightSetting()).toBe("80");
    });

    it("removes the body weight setting when no weight is left", async () => {
      await deleteBodyMeasurementSession(2);
      await deleteBodyMeasurementSession(1);

      expect(bodyWeightSetting()).toBeUndefined();
    });

    it("keeps body weight when an older entry is deleted", async () => {
      await deleteBodyMeasurementSession(1);

      expect(bodyWeightSetting()).toBe("82");
    });
  });

  it("adds, hides, shows and deletes a custom metric", async () => {
    const activeIds = async () =>
      (await fetchActiveBodyMetricDefinitions()).map((m) => m.id);

    const id = await insertCustomBodyMetricDefinition("Neck", "length");
    expect(id).toBeGreaterThan(0);
    expect(await activeIds()).toContain(id);

    await toggleBodyMetricActive(id, false);
    expect(await activeIds()).not.toContain(id);

    await toggleBodyMetricActive(id, true);
    expect(await activeIds()).toContain(id);

    await softDeleteCustomBodyMetricDefinition(id);
    expect(await activeIds()).not.toContain(id);
  });

  it("limits sessions to the newest ones", async () => {
    const sessions = await fetchBodyMeasurementSessions(
      { weightUnit: "kg", sizeUnit: "cm" },
      1,
    );

    expect(sessions.map((s) => s.entry.id)).toEqual([2]);
    expect(sessions[0].values.map((v) => v.canonicalValue)).toEqual([82]);
  });
});

import { Directory } from "expo-file-system";
import {
  buildTrainingDataExport,
  saveExportToFolder,
  ExportFile,
} from "../dataExport";

jest.mock("expo-constants", () => ({ expoConfig: { version: "9.9.9" } }));

interface Workout {
  id: number;
  date_completed: string;
  duration: number | null;
  is_deload: number;
  workout_name: string | null;
  plan_name: string | null;
}

let workouts: Workout[] = [];
let sets: Record<string, unknown>[] = [];
let measurements: Record<string, unknown>[] = [];
let settings: { key: string; value: string }[] = [];
let plans: Record<string, unknown>[] = [];
const mockClose = jest.fn();

const mockDb = {
  getAllAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("FROM completed_workouts")) {
      const [lastDate, , lastId, pageSize] = params as [
        string,
        string,
        number,
        number,
      ];
      return workouts
        .filter(
          (w) =>
            w.date_completed > lastDate ||
            (w.date_completed === lastDate && w.id > lastId),
        )
        .slice(0, pageSize);
    }
    if (sql.includes("FROM completed_exercises")) {
      return sets.filter((s) =>
        (params as number[]).includes(s.completed_workout_id as number),
      );
    }
    if (sql.includes("FROM body_measurement_entries")) return measurements;
    if (sql.includes("FROM settings")) return settings;
    if (sql.includes("FROM user_plans")) return plans;
    if (sql.includes("FROM exercises")) return [];
    throw new Error(`Unexpected query: ${sql}`);
  }),
  closeAsync: mockClose,
};

jest.mock("../database", () => ({
  openDatabase: jest.fn(async () => mockDb),
}));

const workout = (id: number, name = "Push Day"): Workout => ({
  id,
  date_completed: new Date(Date.UTC(2026, 0, id, 10))
    .toISOString()
    .slice(0, 19),
  duration: 3600,
  is_deload: 0,
  workout_name: name,
  plan_name: "PPL",
});

const set = (workoutId: number, exerciseId: number, setNumber: number) => ({
  completed_workout_id: workoutId,
  completed_exercise_id: exerciseId,
  exercise_name: "Bench Press",
  tracking_type: "weight",
  set_number: setNumber,
  weight: 100,
  reps: 5,
  time: null,
  distance: null,
  is_warmup: setNumber === 1 ? 1 : 0,
  is_drop_set: 0,
  is_to_failure: 0,
});

const csvLines = (file: ExportFile) =>
  file.content.split("\r\n").filter((line) => line.length > 0);

beforeEach(() => {
  jest.clearAllMocks();
  workouts = [workout(1), workout(2)];
  sets = [set(1, 10, 1), set(1, 10, 2), set(1, 11, 1), set(2, 20, 1)];
  measurements = [
    {
      entry_id: 1,
      recorded_at: "2026-01-01",
      key: "weight",
      label: "Body Weight",
      value_kind: "mass",
      value: 80,
    },
    {
      entry_id: 1,
      recorded_at: "2026-01-01",
      key: "waist",
      label: "Waist",
      value_kind: "length",
      value: 85,
    },
    {
      entry_id: 2,
      recorded_at: "2026-01-08",
      key: "weight",
      label: "Body Weight",
      value_kind: "mass",
      value: 79.5,
    },
  ];
  settings = [
    { key: "weightUnit", value: "lbs" },
    { key: "loginShown", value: "true" },
    { key: "warmup_backfill_completed", value: "true" },
    { key: "progression_unit_fix_v1", value: "true" },
  ];
  plans = [
    {
      plan_id: 1,
      plan_name: "PPL",
      is_active: 1,
      workout_id: 5,
      workout_name: "Push Day",
      exercise_name: "Bench Press",
      sets: '[{"repsMin":5}]',
      superset_group_id: null,
    },
  ];
});

describe("buildTrainingDataExport csv", () => {
  it("writes one row per completed set", async () => {
    const [setsFile] = await buildTrainingDataExport("csv");

    const lines = csvLines(setsFile);
    expect(lines[0]).toBe(
      "date,workout,exercise,set_number,weight_kg,reps,time_s,distance_m,is_warmup,is_drop_set,is_to_failure",
    );
    expect(lines).toHaveLength(1 + sets.length);
    expect(lines[1]).toBe(
      "2026-01-01T10:00:00,Push Day,Bench Press,1,100,5,,,true,false,false",
    );
  });

  it("reads every page of a long history", async () => {
    workouts = Array.from({ length: 450 }, (_, i) => workout(i + 1));
    sets = workouts.map((w) => set(w.id, w.id * 10, 1));

    const [setsFile] = await buildTrainingDataExport("csv");

    expect(csvLines(setsFile)).toHaveLength(1 + 450);
    const workoutQueries = mockDb.getAllAsync.mock.calls.filter(([sql]) =>
      (sql as string).includes("FROM completed_workouts"),
    );
    expect(workoutQueries).toHaveLength(3);
  });

  it("quotes fields containing commas and quotes", async () => {
    workouts = [workout(1, 'Legs, "heavy"')];
    sets = [set(1, 10, 1)];

    const [setsFile] = await buildTrainingDataExport("csv");

    expect(csvLines(setsFile)[1]).toContain('"Legs, ""heavy"""');
  });

  it("writes body measurements with one column per metric", async () => {
    const [, measurementsFile] = await buildTrainingDataExport("csv");

    expect(csvLines(measurementsFile)).toEqual([
      "date,weight_kg,waist_cm",
      "2026-01-01,80,85",
      "2026-01-08,79.5,",
    ]);
  });

  it("works with no workouts", async () => {
    workouts = [];
    sets = [];
    measurements = [];

    const files = await buildTrainingDataExport("csv");

    expect(files).toHaveLength(2);
    expect(csvLines(files[0])).toHaveLength(1);
    expect(csvLines(files[1])).toEqual(["date"]);
  });

  it("closes the database", async () => {
    await buildTrainingDataExport("csv");
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});

describe("buildTrainingDataExport json", () => {
  const parse = async () => {
    const [file] = await buildTrainingDataExport("json");
    expect(file.mimeType).toBe("application/json");
    return JSON.parse(file.content);
  };

  it("includes canonical units and app version", async () => {
    const data = await parse();
    expect(data.units).toEqual({ weight: "kg", distance: "m", length: "cm" });
    expect(data.appVersion).toBe("9.9.9");
    expect(typeof data.exportedAt).toBe("string");
  });

  it("nests exercises and sets under each workout", async () => {
    const data = await parse();
    expect(data.workouts).toHaveLength(2);
    expect(data.workouts[0].exercises).toHaveLength(2);
    expect(data.workouts[0].exercises[0].sets).toHaveLength(2);
    expect(data.workouts[0].exercises[0].sets[0]).toMatchObject({
      weight: 100,
      reps: 5,
      isWarmup: true,
    });
  });

  it("leaves out internal settings", async () => {
    const data = await parse();
    expect(data.settings).toEqual({ weightUnit: "lbs" });
  });

  it("parses plan exercise sets", async () => {
    const data = await parse();
    expect(data.plans[0].workouts[0].exercises[0].sets).toEqual([
      { repsMin: 5 },
    ]);
  });

  it("works with no workouts", async () => {
    workouts = [];
    sets = [];
    const data = await parse();
    expect(data.workouts).toEqual([]);
  });
});

describe("saveExportToFolder", () => {
  const files: ExportFile[] = [
    { name: "a.csv", mimeType: "text/csv", content: "x" },
    { name: "b.csv", mimeType: "text/csv", content: "y" },
  ];

  it("writes every file into the picked folder", async () => {
    const write = jest.fn();
    const createFile = jest.fn(() => ({ write }));
    (
      Directory as unknown as { pickDirectoryAsync: jest.Mock }
    ).pickDirectoryAsync = jest.fn().mockResolvedValue({ createFile });

    await expect(saveExportToFolder(files)).resolves.toBe(true);

    expect(createFile).toHaveBeenCalledWith("a.csv", "text/csv");
    expect(createFile).toHaveBeenCalledWith("b.csv", "text/csv");
    expect(write).toHaveBeenCalledWith("x");
    expect(write).toHaveBeenCalledWith("y");
  });

  it("returns false when the picker is dismissed", async () => {
    (
      Directory as unknown as { pickDirectoryAsync: jest.Mock }
    ).pickDirectoryAsync = jest
      .fn()
      .mockRejectedValue(
        new Error("The file picker was cancelled by the user"),
      );

    await expect(saveExportToFolder(files)).resolves.toBe(false);
  });

  it("rethrows other picker errors", async () => {
    (
      Directory as unknown as { pickDirectoryAsync: jest.Mock }
    ).pickDirectoryAsync = jest.fn().mockRejectedValue(new Error("boom"));

    await expect(saveExportToFolder(files)).rejects.toThrow("boom");
  });
});

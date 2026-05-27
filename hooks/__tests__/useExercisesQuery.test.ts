import { useExercisesQuery } from "../useExercisesQuery";
import { fetchAllRecords } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));

const mockDb = { getAllAsync: jest.fn() };
jest.mock("@/utils/database", () => ({
  fetchAllRecords: jest.fn(),
  openDatabase: jest.fn(() => Promise.resolve(mockDb)),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

const makeExercise = (overrides: Record<string, any> = {}) => ({
  exercise_id: 1,
  name: "Bench Press",
  favorite: 0,
  equipment: "barbell",
  body_part: "chest",
  target_muscle: "pecs",
  secondary_muscles: [],
  description: "",
  image: [],
  local_animated_uri: "",
  animated_url: "",
  ...overrides,
});

describe("useExercisesQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls useQuery with correct queryKey", () => {
    useExercisesQuery(false, false);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["exercises", "", ""],
      }),
    );
  });

  it("includes 'includeActivePlan' in queryKey when flag is set", () => {
    useExercisesQuery(true, false);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["exercises", "includeActivePlan", ""],
      }),
    );
  });

  it("includes 'includeFavorite' in queryKey when flag is set", () => {
    useExercisesQuery(false, true);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["exercises", "", "includeFavorite"],
      }),
    );
  });

  it("queryFn puts all exercises in otherExercises when no flags", async () => {
    const exercises = [
      makeExercise({ exercise_id: 1 }),
      makeExercise({ exercise_id: 2 }),
    ];
    (fetchAllRecords as jest.Mock).mockResolvedValue(exercises);
    mockDb.getAllAsync.mockResolvedValue([]);

    useExercisesQuery(false, false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result.otherExercises).toHaveLength(2);
    expect(result.activePlanExercises).toHaveLength(0);
    expect(result.favoriteExercises).toHaveLength(0);
  });

  it("queryFn separates favorites into favoriteExercises", async () => {
    const exercises = [
      makeExercise({ exercise_id: 1, favorite: 0 }),
      makeExercise({ exercise_id: 2, favorite: 1, name: "Squat" }),
    ];
    (fetchAllRecords as jest.Mock).mockResolvedValue(exercises);

    useExercisesQuery(false, true);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result.favoriteExercises).toHaveLength(1);
    expect(result.favoriteExercises![0].exercise_id).toBe(2);
    expect(result.otherExercises).toHaveLength(1);
    expect(result.otherExercises[0].exercise_id).toBe(1);
  });

  it("queryFn separates active plan exercises when includeActivePlan is true", async () => {
    const exercises = [
      makeExercise({ exercise_id: 1 }),
      makeExercise({ exercise_id: 2, name: "Squat" }),
    ];
    (fetchAllRecords as jest.Mock).mockResolvedValue(exercises);
    // Active plan has exercise_id = 1
    mockDb.getAllAsync.mockResolvedValue([{ exercise_id: 1 }]);

    useExercisesQuery(true, false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(result.activePlanExercises).toHaveLength(1);
    expect(result.activePlanExercises![0].exercise_id).toBe(1);
    expect(result.otherExercises).toHaveLength(1);
    expect(result.otherExercises[0].exercise_id).toBe(2);
  });

  it("queryFn handles fetchAllRecords error by notifying Bugsnag and rethrowing", async () => {
    const error = new Error("fetch failed");
    (fetchAllRecords as jest.Mock).mockRejectedValue(error);

    useExercisesQuery(false, false);
    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];

    await expect(queryFn()).rejects.toThrow("fetch failed");
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

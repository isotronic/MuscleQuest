import { useFriendSharedCompletedWorkoutsQuery } from "../useFriendSharedCompletedWorkoutsQuery";
import { useFriendSharedMeasurementsQuery } from "../useFriendSharedMeasurementsQuery";
import { useFriendCompletedWorkoutCountQuery } from "../useFriendCompletedWorkoutCountQuery";
import { useQuery } from "@tanstack/react-query";

const mockGetDocs = jest.fn();
const mockGetCountFromServer = jest.fn();

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => "db"),
  collection: jest.fn((_db, ...parts: string[]) => ({ path: parts.join("/") })),
  orderBy: jest.fn((field: string, dir: string) => ({ orderBy: [field, dir] })),
  limit: jest.fn((n: number) => ({ limit: n })),
  query: jest.fn((ref: unknown, ...constraints: unknown[]) => ({
    ref,
    constraints,
  })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args),
}));
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: () => ({ uid: "me" }),
}));
jest.mock("@/context/AuthProvider", () => ({ AuthContext: {} }));
const mockIsOnline = jest.fn(() => true);
jest.mock("../useIsOnline", () => ({ useIsOnline: () => mockIsOnline() }));
jest.mock("@/utils/reportFirestoreReadError", () => ({
  reportFirestoreReadError: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));

let captured: any;
beforeEach(() => {
  jest.clearAllMocks();
  (useQuery as jest.Mock).mockImplementation((args) => {
    captured = args;
    return {};
  });
  mockGetDocs.mockResolvedValue({ docs: [] });
});

it("asks for the ten most recent workouts by date", async () => {
  useFriendSharedCompletedWorkoutsQuery("friend");
  await captured.queryFn();

  expect(mockGetDocs).toHaveBeenCalledWith({
    ref: { path: "users/friend/sharedWorkouts" },
    constraints: [{ orderBy: ["dateCompleted", "desc"] }, { limit: 10 }],
  });
});

it("asks for the five most recent measurements by date", async () => {
  useFriendSharedMeasurementsQuery("friend");
  await captured.queryFn();

  expect(mockGetDocs).toHaveBeenCalledWith({
    ref: { path: "users/friend/sharedMeasurements" },
    constraints: [{ orderBy: ["recordedAt", "desc"] }, { limit: 5 }],
  });
});

it("counts all shared workouts on the server", async () => {
  mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 42 }) });

  useFriendCompletedWorkoutCountQuery("friend");
  const count = await captured.queryFn();

  expect(count).toBe(42);
  expect(mockGetCountFromServer).toHaveBeenCalledWith({
    path: "users/friend/sharedWorkouts",
  });
});

// A server count has no offline cache, so it can only fail offline, and each
// retry would send another report.
it("does not run the count while offline", () => {
  mockIsOnline.mockReturnValueOnce(false);

  useFriendCompletedWorkoutCountQuery("friend");

  expect(captured.enabled).toBe(false);
});

it("runs the count when online", () => {
  useFriendCompletedWorkoutCountQuery("friend");
  expect(captured.enabled).toBe(true);
});

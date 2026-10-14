// Demo friends never reach Firestore: the friend hooks answer demo- uids from
// the fixtures, friend actions only change local state, and local data is
// never published or backed up while demo mode is on.
import { useQuery } from "@tanstack/react-query";
import { useFriendCompletedWorkoutCountQuery } from "@/hooks/useFriendCompletedWorkoutCountQuery";
import { useFriendSharedCompletedWorkoutsQuery } from "@/hooks/useFriendSharedCompletedWorkoutsQuery";
import { useFriendSharedCustomExercisesQuery } from "@/hooks/useFriendSharedCustomExercisesQuery";
import { useFriendSharedMeasurementsQuery } from "@/hooks/useFriendSharedMeasurementsQuery";
import { useFriendSharedPlansQuery } from "@/hooks/useFriendSharedPlansQuery";
import { useFriendSharedStandaloneWorkoutsQuery } from "@/hooks/useFriendSharedStandaloneWorkoutsQuery";
import { useFriendSharedStrengthQuery } from "@/hooks/useFriendSharedStrengthQuery";
import {
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "@/utils/friends";
import { isLocalDataOwnedBy } from "@/utils/accountOwnership";
import { useAccountOwnershipStore } from "@/store/accountOwnershipStore";
import { useSocialStore } from "@/store/socialStore";
import { setDemoActive } from "../state";
import {
  applyDemoSocialState,
  demoFriendData,
  resetDemoSocialState,
  type DemoFriendData,
} from "../social";

const mockFirestore = {
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  getCountFromServer: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  writeBatch: jest.fn(),
};

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => "db"),
  collection: jest.fn(),
  doc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(),
  getDocs: (...args: unknown[]) => mockFirestore.getDocs(...args),
  getDoc: (...args: unknown[]) => mockFirestore.getDoc(...args),
  getCountFromServer: (...args: unknown[]) =>
    mockFirestore.getCountFromServer(...args),
  setDoc: (...args: unknown[]) => mockFirestore.setDoc(...args),
  updateDoc: (...args: unknown[]) => mockFirestore.updateDoc(...args),
  writeBatch: (...args: unknown[]) => mockFirestore.writeBatch(...args),
}));
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: () => ({ uid: "me" }),
}));
jest.mock("@/context/AuthProvider", () => ({ AuthContext: {} }));
const mockIsOnline = jest.fn(() => true);
jest.mock("@/hooks/useIsOnline", () => ({ useIsOnline: () => mockIsOnline() }));
jest.mock("@/utils/reportFirestoreReadError", () => ({
  reportFirestoreReadError: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { appVariant: "development" } } },
}));
jest.mock("../DemoDataSection", () => ({ DemoDataSection: () => null }));
// As the dev server builds it with EXPO_PUBLIC_DEMO_DATA=1.
jest.mock("@/dev/demo/gate", () => ({
  demoMode: jest.requireActual("@/dev/demo/index"),
}));

const HOOKS: [string, (uid: string) => unknown, keyof DemoFriendData][] = [
  ["useFriendSharedPlansQuery", useFriendSharedPlansQuery, "plans"],
  [
    "useFriendSharedStandaloneWorkoutsQuery",
    useFriendSharedStandaloneWorkoutsQuery,
    "standaloneWorkouts",
  ],
  [
    "useFriendSharedCustomExercisesQuery",
    useFriendSharedCustomExercisesQuery,
    "customExercises",
  ],
  [
    "useFriendSharedCompletedWorkoutsQuery",
    useFriendSharedCompletedWorkoutsQuery,
    "completedWorkouts",
  ],
  [
    "useFriendCompletedWorkoutCountQuery",
    useFriendCompletedWorkoutCountQuery,
    "completedWorkoutCount",
  ],
  [
    "useFriendSharedMeasurementsQuery",
    useFriendSharedMeasurementsQuery,
    "measurements",
  ],
  ["useFriendSharedStrengthQuery", useFriendSharedStrengthQuery, "strength"],
];

let captured: { queryFn: () => Promise<unknown> };

const noFirestoreCalls = () => {
  for (const fn of Object.values(mockFirestore)) {
    expect(fn).not.toHaveBeenCalled();
  }
};

// Timestamps carry functions; compare what they stand for.
const plain = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, v) =>
      v && typeof v.toDate === "function" ? v.toDate().toISOString() : v,
    ),
  );

beforeEach(() => {
  jest.clearAllMocks();
  setDemoActive(true);
  resetDemoSocialState();
  (useQuery as jest.Mock).mockImplementation((args) => {
    captured = args;
    return {};
  });
  mockFirestore.getDocs.mockResolvedValue({ docs: [] });
  mockFirestore.getCountFromServer.mockResolvedValue({
    data: () => ({ count: 0 }),
  });
});

afterEach(() => setDemoActive(false));

describe.each(HOOKS)("%s", (_name, hook, field) => {
  it.each(["demo-maya", "demo-jonas", "demo-lena", "demo-sam"])(
    "answers %s from the fixtures without Firestore",
    async (uid) => {
      hook(uid);
      const data = await captured.queryFn();
      expect(plain(data)).toEqual(plain(demoFriendData(uid)[field]));
      noFirestoreCalls();
    },
  );

  it("still reads Firestore for a real friend", async () => {
    hook("real-friend-uid");
    await captured.queryFn();
    expect(
      mockFirestore.getDocs.mock.calls.length +
        mockFirestore.getCountFromServer.mock.calls.length,
    ).toBe(1);
  });
});

it("gives each demo friend different things to show", () => {
  const maya = demoFriendData("demo-maya");
  expect(maya.plans).toHaveLength(1);
  expect(maya.completedWorkouts.length).toBeGreaterThan(0);
  expect(maya.completedWorkouts[0].exercises[0].sets.length).toBeGreaterThan(0);
  expect(maya.strength.length).toBeGreaterThan(0);
  expect(maya.measurements.length).toBeGreaterThan(0);

  const jonas = demoFriendData("demo-jonas");
  expect(jonas.plans).toHaveLength(0);
  expect(jonas.measurements).toHaveLength(0);
  expect(jonas.completedWorkouts.length).toBeGreaterThan(0);
  expect(jonas.strength.length).toBeGreaterThan(0);

  const lena = demoFriendData("demo-lena");
  expect(lena.plans).toHaveLength(1);
  expect(lena.completedWorkouts).toHaveLength(0);
  expect(lena.strength).toHaveLength(0);
});

it("dates a friend's workouts relative to today", () => {
  const now = new Date(2026, 9, 14, 12, 0);
  const [latest] = demoFriendData("demo-maya", now).completedWorkouts;
  const done = latest.dateCompleted.toDate();
  expect(done.getDate()).toBe(13);
  expect(done.getMonth()).toBe(9);
});

it("puts three friends and one incoming request in the social store", () => {
  applyDemoSocialState();
  const state = useSocialStore.getState();
  expect(state.friends.map((f) => f.uid)).toEqual([
    "demo-maya",
    "demo-jonas",
    "demo-lena",
  ]);
  expect(state.pendingRequests.map((r) => r.fromUid)).toEqual(["demo-sam"]);
  expect(state.privacySettings).toMatchObject({
    shareCompletedWorkouts: false,
  });
  expect(state.publishedPlanIds).toEqual([]);
});

describe("friend actions on demo friends", () => {
  beforeEach(() => applyDemoSocialState());

  it("accepts a request locally", async () => {
    await acceptFriendRequest("demo-sam", "me");
    const state = useSocialStore.getState();
    expect(state.pendingRequests).toEqual([]);
    expect(state.friends.map((f) => f.uid)).toContain("demo-sam");
    noFirestoreCalls();
  });

  it("declines a request locally", async () => {
    await declineFriendRequest("demo-sam", "me");
    const state = useSocialStore.getState();
    expect(state.pendingRequests).toEqual([]);
    expect(state.friends.map((f) => f.uid)).not.toContain("demo-sam");
    noFirestoreCalls();
  });

  it("removes a friend locally", async () => {
    await removeFriend("me", "demo-jonas");
    expect(useSocialStore.getState().friends.map((f) => f.uid)).toEqual([
      "demo-maya",
      "demo-lena",
    ]);
    noFirestoreCalls();
  });
});

describe("publishing and backups", () => {
  beforeEach(() =>
    useAccountOwnershipStore.setState({
      currentUid: "me",
      resolvedFor: "me",
      ownedByCurrentUser: true,
    }),
  );

  it("are refused while demo mode is on", async () => {
    expect(await isLocalDataOwnedBy("me")).toBe(false);
  });

  it("go ahead as before once it is off", async () => {
    setDemoActive(false);
    expect(await isLocalDataOwnedBy("me")).toBe(true);
  });
});

it("counts a demo friend's workouts offline, but not a real friend's", () => {
  mockIsOnline.mockReturnValue(false);
  try {
    useFriendCompletedWorkoutCountQuery("demo-maya");
    expect((captured as unknown as { enabled: boolean }).enabled).toBe(true);
    useFriendCompletedWorkoutCountQuery("real-friend-uid");
    expect((captured as unknown as { enabled: boolean }).enabled).toBe(false);
  } finally {
    mockIsOnline.mockReturnValue(true);
  }
});

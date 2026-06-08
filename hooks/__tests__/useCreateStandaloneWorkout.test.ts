import {
  useCreateStandaloneWorkout,
  useUpdateStandaloneWorkout,
  useDeleteStandaloneWorkout,
} from "../useCreateStandaloneWorkout";
import {
  createStandaloneWorkout,
  updateStandaloneWorkout,
  deleteStandaloneWorkout,
} from "@/utils/database";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Bugsnag from "@bugsnag/expo";

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useContext: jest.fn().mockReturnValue(null),
}));
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return { AuthContext: React.createContext(null) };
});
jest.mock("@react-native-firebase/firestore", () => {
  const mockFirestore: any = jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() =>
          Promise.resolve({ exists: false, data: jest.fn(() => null) }),
        ),
        set: jest.fn(() => Promise.resolve()),
        update: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve()),
        onSnapshot: jest.fn(() => jest.fn()),
        collection: jest.fn(() => ({ doc: jest.fn() })),
      })),
    })),
    batch: jest.fn(() => ({
      set: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn(() => Promise.resolve()),
    })),
  }));
  mockFirestore.FieldValue = { serverTimestamp: jest.fn() };
  mockFirestore.Timestamp = {
    fromDate: jest.fn((d: Date) => ({ toDate: () => d })),
  };
  return mockFirestore;
});
jest.mock("@/store/socialStore", () => ({
  useSocialStore: jest.fn(() => ({
    privacySettings: null,
    publishedPlanIds: null,
    publishedWorkoutIds: null,
  })),
}));
jest.mock("@/utils/sharing", () => ({
  publishStandaloneWorkout: jest.fn(() => Promise.resolve()),
  unpublishStandaloneWorkout: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/utils/database", () => ({
  createStandaloneWorkout: jest.fn(),
  updateStandaloneWorkout: jest.fn(),
  deleteStandaloneWorkout: jest.fn(),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const mockInvalidateQueries = jest.fn();

function setupMocks() {
  (useQueryClient as jest.Mock).mockReturnValue({
    invalidateQueries: mockInvalidateQueries,
  });
}

// ---------------------------------------------------------------------------
// useCreateStandaloneWorkout
// ---------------------------------------------------------------------------

describe("useCreateStandaloneWorkout", () => {
  let capturedArgs: any;

  beforeEach(() => {
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls createStandaloneWorkout with name and exercises", async () => {
    (createStandaloneWorkout as jest.Mock).mockResolvedValue(1);
    useCreateStandaloneWorkout();

    const exercises: any[] = [];
    await capturedArgs.mutationFn({ name: "Quick Session", exercises });

    expect(createStandaloneWorkout).toHaveBeenCalledWith(
      "Quick Session",
      exercises,
    );
  });

  it("onSuccess invalidates ['standaloneWorkouts']", () => {
    useCreateStandaloneWorkout();
    capturedArgs.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["standaloneWorkouts"],
    });
  });

  it("onError notifies Bugsnag", () => {
    useCreateStandaloneWorkout();
    const error = new Error("create failed");
    capturedArgs.onError(error);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// useUpdateStandaloneWorkout
// ---------------------------------------------------------------------------

describe("useUpdateStandaloneWorkout", () => {
  let capturedArgs: any;

  beforeEach(() => {
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls updateStandaloneWorkout with workoutId, name, and exercises", async () => {
    (updateStandaloneWorkout as jest.Mock).mockResolvedValue(undefined);
    useUpdateStandaloneWorkout();

    const exercises: any[] = [];
    await capturedArgs.mutationFn({
      workoutId: 42,
      name: "Updated",
      exercises,
    });

    expect(updateStandaloneWorkout).toHaveBeenCalledWith(
      42,
      "Updated",
      exercises,
    );
  });

  it("onSuccess invalidates ['standaloneWorkouts']", () => {
    useUpdateStandaloneWorkout();
    capturedArgs.onSuccess(undefined, {
      workoutId: 42,
      name: "Updated",
      exercises: [],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["standaloneWorkouts"],
    });
  });

  it("onError notifies Bugsnag", () => {
    useUpdateStandaloneWorkout();
    const error = new Error("update failed");
    capturedArgs.onError(error);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

// ---------------------------------------------------------------------------
// useDeleteStandaloneWorkout
// ---------------------------------------------------------------------------

describe("useDeleteStandaloneWorkout", () => {
  let capturedArgs: any;

  beforeEach(() => {
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
    jest.clearAllMocks();
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedArgs = args;
      return { mutate: jest.fn() };
    });
  });

  it("mutationFn calls deleteStandaloneWorkout with workoutId", async () => {
    (deleteStandaloneWorkout as jest.Mock).mockResolvedValue(undefined);
    useDeleteStandaloneWorkout();

    await capturedArgs.mutationFn(99);

    expect(deleteStandaloneWorkout).toHaveBeenCalledWith(99);
  });

  it("onSuccess invalidates ['standaloneWorkouts']", () => {
    useDeleteStandaloneWorkout();
    capturedArgs.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["standaloneWorkouts"],
    });
  });

  it("onError notifies Bugsnag", () => {
    useDeleteStandaloneWorkout();
    const error = new Error("delete failed");
    capturedArgs.onError(error);
    expect(Bugsnag.notify).toHaveBeenCalledWith(error);
  });
});

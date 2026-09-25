import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-musclequest",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const seed = async (docs: Record<string, object>) => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [path, data] of Object.entries(docs)) {
      await setDoc(doc(db, path), data);
    }
  });
};

const asAlice = () => testEnv.authenticatedContext("alice").firestore();

// ─── profiles (B1) ────────────────────────────────────────────────────────────

describe("user profile writes", () => {
  // Exactly what utils/userProfile.ts upsertUserProfile writes.
  const profile = {
    displayName: "Alice",
    email: "alice@example.com",
    photoURL: "https://example.com/a.png",
    createdAt: new Date(),
  };

  it("allows the fields the app writes", async () => {
    await assertSucceeds(setDoc(doc(asAlice(), "users/alice"), profile));
  });

  it("allows a merge update that omits createdAt", async () => {
    await seed({ "users/alice": profile });
    await assertSucceeds(
      setDoc(
        doc(asAlice(), "users/alice"),
        { displayName: "Alice B", email: "alice@example.com", photoURL: "" },
        { merge: true },
      ),
    );
  });

  it("denies an extra field", async () => {
    await assertFails(
      setDoc(doc(asAlice(), "users/alice"), { ...profile, isAdmin: true }),
    );
  });

  it("denies a displayName over 100 characters", async () => {
    await assertFails(
      setDoc(doc(asAlice(), "users/alice"), {
        ...profile,
        displayName: "x".repeat(101),
      }),
    );
  });

  it("denies a non-string displayName", async () => {
    await assertFails(
      setDoc(doc(asAlice(), "users/alice"), { ...profile, displayName: 42 }),
    );
  });

  it("denies writing someone else's profile", async () => {
    await assertFails(setDoc(doc(asAlice(), "users/bob"), profile));
  });
});

// ─── friends (B2) ─────────────────────────────────────────────────────────────

describe("friends subcollection writes", () => {
  // Exactly what utils/friends.ts acceptFriendRequest writes.
  const friendDoc = {
    since: new Date(),
    displayName: "Bob",
    email: "bob@example.com",
    photoURL: "https://example.com/b.png",
  };

  it("allows the owner to write their own friend record", async () => {
    await assertSucceeds(
      setDoc(doc(asAlice(), "users/alice/friends/bob"), friendDoc),
    );
  });

  it("allows the accepting friend to write the mirror record", async () => {
    // acceptFriendRequest: bob accepts alice's request and writes into
    // alice's tree as well.
    await seed({
      "friendRequests/alice_bob": {
        from: "alice",
        to: "bob",
        status: "pending",
      },
    });
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(
      setDoc(doc(bob, "users/alice/friends/bob"), friendDoc),
    );
  });

  it("allows the profile backfill update from useSocialListeners", async () => {
    await seed({ "users/alice/friends/bob": friendDoc });
    await assertSucceeds(
      updateDoc(doc(asAlice(), "users/alice/friends/bob"), {
        displayName: "Bob",
        email: "bob@example.com",
        photoURL: "",
      }),
    );
  });

  it("denies an extra field", async () => {
    await assertFails(
      setDoc(doc(asAlice(), "users/alice/friends/bob"), {
        ...friendDoc,
        note: "anything",
      }),
    );
  });

  it("denies an oversized displayName", async () => {
    await assertFails(
      setDoc(doc(asAlice(), "users/alice/friends/bob"), {
        ...friendDoc,
        displayName: "x".repeat(101),
      }),
    );
  });
});

// ─── shared content (B3) ──────────────────────────────────────────────────────

const sharedExercise = {
  appExerciseId: 1,
  name: "Bench Press",
  equipment: "barbell",
  bodyPart: "chest",
  targetMuscle: "pectorals",
  secondaryMuscles: ["triceps"],
  trackingType: "weight",
  isUnilateral: false,
  doubleWeight: false,
  animatedUrl: null,
  sets: [{ repsMin: 5, repsMax: 8, restMinutes: 2, restSeconds: 0 }],
  exerciseOrder: 0,
  supersetGroupId: null,
  trackingTypeOverride: null,
};

// Each payload is shaped exactly like the corresponding utils/sharing.ts write.
const payloads: Record<string, Record<string, unknown>> = {
  sharedPlans: {
    localPlanId: 1,
    name: "Push Pull Legs",
    imageUrl: null,
    publishedAt: new Date(),
    updatedAt: new Date(),
    workouts: [{ name: "Push", workoutOrder: 0, exercises: [sharedExercise] }],
  },
  sharedStandaloneWorkouts: {
    localWorkoutId: 2,
    name: "Quick Arms",
    imageUrl: null,
    publishedAt: new Date(),
    updatedAt: new Date(),
    exercises: [sharedExercise],
  },
  sharedCustomExercises: {
    localExerciseId: 3,
    name: "Cable Fly",
    equipment: "cable",
    bodyPart: "chest",
    targetMuscle: "pectorals",
    secondaryMuscles: ["deltoids"],
    description: null,
    trackingType: "weight",
    isUnilateral: false,
    doubleWeight: false,
    animatedUrl: null,
    publishedAt: new Date(),
    updatedAt: new Date(),
  },
  sharedWorkouts: {
    localWorkoutId: 4,
    planName: "PPL",
    workoutName: "Push",
    dateCompleted: new Date(),
    durationSeconds: 3600,
    totalSetsCompleted: 18,
    isDeload: false,
    exercises: [{ name: "Bench Press", sets: [{ setNumber: 1, weight: 60 }] }],
  },
  sharedMeasurements: {
    localEntryId: 5,
    recordedAt: new Date(),
    values: { weight: 80.5, waist: 82 },
  },
  sharedStrength: {
    exerciseName: "Bench Press",
    appExerciseId: 1,
    trackingType: "weight",
    allTimePR: 100,
    allTimePRDate: new Date(),
    topPRSets: [
      { weight: 100, reps: 1, time: null, distance: null, date: new Date() },
    ],
  },
};

describe.each(Object.entries(payloads))(
  "%s writes",
  (subcollection, payload) => {
    const path = `users/alice/${subcollection}/doc1`;

    it("allows the payload the app publishes", async () => {
      await assertSucceeds(setDoc(doc(asAlice(), path), payload));
    });

    it("allows a re-publish that omits publishedAt", async () => {
      await seed({ [path]: payload });
      const { publishedAt: _omitted, ...rest } = payload;
      await assertSucceeds(setDoc(doc(asAlice(), path), rest, { merge: true }));
    });

    it("denies an unknown field", async () => {
      await assertFails(
        setDoc(doc(asAlice(), path), { ...payload, injected: "x" }),
      );
    });

    it("denies a write by another user", async () => {
      const bob = testEnv.authenticatedContext("bob").firestore();
      await assertFails(setDoc(doc(bob, path), payload));
    });

    it("lets the owner delete", async () => {
      await seed({ [path]: payload });
      await assertSucceeds(deleteDoc(doc(asAlice(), path)));
    });
  },
);

describe("shared content list bounds", () => {
  it("denies a plan with too many workouts", async () => {
    await assertFails(
      setDoc(doc(asAlice(), "users/alice/sharedPlans/doc1"), {
        ...payloads.sharedPlans,
        workouts: Array.from({ length: 51 }, (_, i) => ({
          name: `W${i}`,
          workoutOrder: i,
          exercises: [],
        })),
      }),
    );
  });

  it("denies a plan name over 200 characters", async () => {
    await assertFails(
      setDoc(doc(asAlice(), "users/alice/sharedPlans/doc1"), {
        ...payloads.sharedPlans,
        name: "x".repeat(201),
      }),
    );
  });

  it("denies a standalone workout with too many exercises", async () => {
    await assertFails(
      setDoc(doc(asAlice(), "users/alice/sharedStandaloneWorkouts/doc1"), {
        ...payloads.sharedStandaloneWorkouts,
        exercises: Array.from({ length: 101 }, () => sharedExercise),
      }),
    );
  });

  it("denies a strength doc with too many top sets", async () => {
    await assertFails(
      setDoc(doc(asAlice(), "users/alice/sharedStrength/doc1"), {
        ...payloads.sharedStrength,
        topPRSets: Array.from({ length: 21 }, () => ({ weight: 1, reps: 1 })),
      }),
    );
  });

  it("denies a measurement entry with too many values", async () => {
    const values: Record<string, number> = {};
    for (let i = 0; i < 101; i++) values[`m${i}`] = i;
    await assertFails(
      setDoc(doc(asAlice(), "users/alice/sharedMeasurements/doc1"), {
        ...payloads.sharedMeasurements,
        values,
      }),
    );
  });
});

// ─── read access regression ───────────────────────────────────────────────────

describe("shared content reads", () => {
  beforeEach(async () => {
    await seed({
      "users/alice/sharedPlans/doc1": payloads.sharedPlans,
      "users/alice/friends/bob": { displayName: "Bob" },
    });
  });

  it("lets a friend read a shared doc", async () => {
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(getDoc(doc(bob, "users/alice/sharedPlans/doc1")));
  });

  it("blocks a non-friend", async () => {
    const carol = testEnv.authenticatedContext("carol").firestore();
    await assertFails(getDoc(doc(carol, "users/alice/sharedPlans/doc1")));
  });

  it("blocks an unauthenticated reader", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "users/alice/sharedPlans/doc1")));
  });
});

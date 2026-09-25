import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

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

// Must match utils/emailIndex.ts hashEmail: lowercase hex SHA-256 of the
// lowercased, trimmed address.
const hashEmail = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

const ALICE_EMAIL = "Alice@Example.com";
const aliceHash = hashEmail(ALICE_EMAIL);

const alice = () =>
  testEnv
    .authenticatedContext("alice", {
      email: ALICE_EMAIL,
      email_verified: true,
    })
    .firestore();

describe("emailIndex writes", () => {
  it("lets a user claim the hash of their own verified address", async () => {
    await assertSucceeds(
      setDoc(doc(alice(), `emailIndex/${aliceHash}`), { uid: "alice" }),
    );
  });

  it("pins the client hash against the rules' own sha256", async () => {
    // If expo-crypto's digest or the rules' hashing expression ever stops
    // agreeing on casing or normalisation, this write starts failing.
    const db = alice();
    await assertSucceeds(
      setDoc(doc(db, `emailIndex/${hashEmail("  ALICE@EXAMPLE.COM  ")}`), {
        uid: "alice",
      }),
    );
  });

  it("denies claiming the hash of someone else's address", async () => {
    await assertFails(
      setDoc(doc(alice(), `emailIndex/${hashEmail("bob@example.com")}`), {
        uid: "alice",
      }),
    );
  });

  it("denies pointing your own hash at another uid", async () => {
    await assertFails(
      setDoc(doc(alice(), `emailIndex/${aliceHash}`), { uid: "bob" }),
    );
  });

  it("denies an extra field", async () => {
    await assertFails(
      setDoc(doc(alice(), `emailIndex/${aliceHash}`), {
        uid: "alice",
        email: ALICE_EMAIL,
      }),
    );
  });

  it("denies an unverified email", async () => {
    const db = testEnv
      .authenticatedContext("alice", {
        email: ALICE_EMAIL,
        email_verified: false,
      })
      .firestore();
    await assertFails(
      setDoc(doc(db, `emailIndex/${aliceHash}`), { uid: "alice" }),
    );
  });

  it("denies an unauthenticated write", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, `emailIndex/${aliceHash}`), { uid: "alice" }),
    );
  });
});

describe("emailIndex reads", () => {
  beforeEach(async () => {
    await seed({ [`emailIndex/${aliceHash}`]: { uid: "alice" } });
  });

  it("lets any signed-in user resolve an address they already know", async () => {
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(getDoc(doc(bob, `emailIndex/${aliceHash}`)));
  });

  it("blocks an unauthenticated read", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, `emailIndex/${aliceHash}`)));
  });

  // The whole point: without list, the hashes cannot be enumerated and walked
  // back to addresses.
  it("blocks listing the collection", async () => {
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertFails(getDocs(collection(bob, "emailIndex")));
  });
});

describe("emailIndex deletes", () => {
  beforeEach(async () => {
    await seed({ [`emailIndex/${aliceHash}`]: { uid: "alice" } });
  });

  it("lets the owning uid delete its entry", async () => {
    await assertSucceeds(deleteDoc(doc(alice(), `emailIndex/${aliceHash}`)));
  });

  it("blocks another user from deleting it", async () => {
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertFails(deleteDoc(doc(bob, `emailIndex/${aliceHash}`)));
  });
});

describe("private contact document", () => {
  it("lets the owner write and read their address", async () => {
    const db = alice();
    await assertSucceeds(
      setDoc(doc(db, "users/alice/private/contact"), { email: ALICE_EMAIL }),
    );
    await assertSucceeds(getDoc(doc(db, "users/alice/private/contact")));
  });

  it("blocks a friend from reading it", async () => {
    await seed({
      "users/alice/private/contact": { email: ALICE_EMAIL },
      "users/alice/friends/bob": { displayName: "Bob" },
    });
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bob, "users/alice/private/contact")));
  });
});

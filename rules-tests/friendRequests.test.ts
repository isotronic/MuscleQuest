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
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
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

const pendingRequest = { from: "alice", to: "bob", status: "pending" };

describe("friendRequests delete", () => {
  it("lets the sender delete", async () => {
    await seed({ "friendRequests/alice_bob": pendingRequest });
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(deleteDoc(doc(db, "friendRequests/alice_bob")));
  });

  it("lets the receiver delete", async () => {
    await seed({ "friendRequests/alice_bob": pendingRequest });
    const db = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(deleteDoc(doc(db, "friendRequests/alice_bob")));
  });

  it("blocks a third user", async () => {
    await seed({ "friendRequests/alice_bob": pendingRequest });
    const db = testEnv.authenticatedContext("carol").firestore();
    await assertFails(deleteDoc(doc(db, "friendRequests/alice_bob")));
  });

  it("blocks unauthenticated users", async () => {
    await seed({ "friendRequests/alice_bob": pendingRequest });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(deleteDoc(doc(db, "friendRequests/alice_bob")));
  });

  it("allows deleting a missing request whose id contains your uid", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(deleteDoc(doc(db, "friendRequests/bob_alice")));
  });

  it("blocks deleting a missing request that does not involve you", async () => {
    const db = testEnv.authenticatedContext("carol").firestore();
    await assertFails(deleteDoc(doc(db, "friendRequests/alice_bob")));
  });
});

describe("removeFriend batch", () => {
  // Mirrors utils/friends.ts removeFriend: both friend edges plus the
  // request doc in both directions (one of which never exists).
  it("succeeds for a real friend pair", async () => {
    await seed({
      "users/alice/friends/bob": { displayName: "Bob" },
      "users/bob/friends/alice": { displayName: "Alice" },
      "friendRequests/alice_bob": { ...pendingRequest, status: "accepted" },
    });
    const db = testEnv.authenticatedContext("bob").firestore();
    const batch = writeBatch(db);
    batch.delete(doc(db, "users/bob/friends/alice"));
    batch.delete(doc(db, "users/alice/friends/bob"));
    batch.delete(doc(db, "friendRequests/bob_alice"));
    batch.delete(doc(db, "friendRequests/alice_bob"));
    await assertSucceeds(batch.commit());
  });
});

describe("account deletion", () => {
  it("lets a user find and delete every request involving them", async () => {
    await seed({
      "friendRequests/alice_bob": pendingRequest,
      "friendRequests/carol_alice": {
        from: "carol",
        to: "alice",
        status: "declined",
      },
    });
    const db = testEnv.authenticatedContext("alice").firestore();
    const requests = collection(db, "friendRequests");
    const [sent, received] = await Promise.all([
      assertSucceeds(getDocs(query(requests, where("from", "==", "alice")))),
      assertSucceeds(getDocs(query(requests, where("to", "==", "alice")))),
    ]);
    expect(sent.size + received.size).toBe(2);
    for (const d of [...sent.docs, ...received.docs]) {
      await assertSucceeds(deleteDoc(d.ref));
    }
  });

  it("lets a user delete their profile and private settings", async () => {
    await seed({
      "users/alice": { displayName: "Alice" },
      "users/alice/private/settings": { sharePlans: true },
    });
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(deleteDoc(doc(db, "users/alice/private/settings")));
    await assertSucceeds(deleteDoc(doc(db, "users/alice")));
  });
});

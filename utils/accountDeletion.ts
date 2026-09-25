import {
  getAuth,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "@react-native-firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  deleteDoc,
  query,
  where,
} from "@react-native-firebase/firestore";
import {
  getStorage,
  ref,
  listAll,
  deleteObject,
} from "@react-native-firebase/storage";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { removeFriend } from "./friends";
import { deleteAllSharedData } from "./sharing";
import { notifyBugsnag } from "./bugsnagDedup";
import { useSocialStore } from "../store/socialStore";

// Order matters: what other people can see goes first, the auth user last.
// Every step is idempotent, so retrying after a partial failure reruns the
// whole sequence and finishes the job.
export const DELETION_STEPS = [
  "reauth",
  "friends",
  "requests",
  "shared",
  "profile",
  "backups",
  "auth",
] as const;

export type DeletionStep = (typeof DELETION_STEPS)[number];

export class AccountDeletionError extends Error {
  constructor(
    readonly step: DeletionStep,
    readonly cause: unknown,
    // The user dismissed the Google re-auth prompt. Nothing was deleted and
    // there is nothing to report.
    readonly cancelled = false,
  ) {
    super(
      `Account deletion failed at "${step}": ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = "AccountDeletionError";
  }
}

// currentUser.delete() throws auth/requires-recent-login for older sessions.
// Failing there, at the very end, would leave a half-deleted account, so get a
// fresh credential before touching anything.
const reauthenticate = async (uid: string): Promise<void> => {
  const user = getAuth().currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Signed-in user does not match the account being deleted");
  }
  await GoogleSignin.hasPlayServices();
  const { idToken } = await GoogleSignin.signIn();
  if (!idToken) {
    throw new Error("Google sign-in returned no ID token");
  }
  await reauthenticateWithCredential(
    user,
    GoogleAuthProvider.credential(idToken),
  );
};

const removeAllFriends = async (uid: string): Promise<void> => {
  const db = getFirestore();
  const snapshot = await getDocs(collection(db, "users", uid, "friends"));
  // Attempt every removal so one failure doesn't leave the rest for a retry.
  const results = await Promise.allSettled(
    snapshot.docs.map((friendDoc: { id: string }) =>
      removeFriend(uid, friendDoc.id),
    ),
  );
  const failed = results.find(
    (r: PromiseSettledResult<void>): r is PromiseRejectedResult =>
      r.status === "rejected",
  );
  if (failed) throw failed.reason;
};

const deletePendingRequests = async (uid: string): Promise<void> => {
  const db = getFirestore();
  const requests = collection(db, "friendRequests");
  const [sent, received] = await Promise.all([
    getDocs(query(requests, where("from", "==", uid))),
    getDocs(query(requests, where("to", "==", uid))),
  ]);
  await Promise.all(
    [...sent.docs, ...received.docs].map((d) => deleteDoc(d.ref)),
  );
};

const deleteProfile = async (uid: string): Promise<void> => {
  const db = getFirestore();
  await deleteDoc(doc(db, "users", uid, "private", "settings"));
  await deleteDoc(doc(db, "users", uid));
};

const deleteBackups = async (uid: string): Promise<void> => {
  const { items } = await listAll(ref(getStorage(), `backups/${uid}`));
  await Promise.all(
    items.map(async (item) => {
      try {
        await deleteObject(item);
      } catch (error) {
        if ((error as { code?: string }).code !== "storage/object-not-found") {
          throw error;
        }
      }
    }),
  );
};

const deleteAuthUser = async (uid: string): Promise<void> => {
  const user = getAuth().currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Signed-in user does not match the account being deleted");
  }
  await deleteUser(user);
};

// Runs after the account is gone, so failures are reported but not thrown:
// there is nothing left to retry against.
const cleanUpAfterDeletion = async (): Promise<void> => {
  // Guarded separately so a failed revoke still signs out of Google.
  try {
    await GoogleSignin.revokeAccess();
  } catch (error) {
    notifyBugsnag(error);
  }
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    notifyBugsnag(error);
  }
  useSocialStore.setState({
    pendingRequests: [],
    sentRequests: [],
    friends: [],
    privacySettings: null,
    publishedPlanIds: null,
    publishedWorkoutIds: null,
    pendingRevocations: [],
  });
  try {
    await useSocialStore.persist.clearStorage();
  } catch (error) {
    notifyBugsnag(error);
  }
};

const STEP_RUNNERS: Record<DeletionStep, (uid: string) => Promise<void>> = {
  reauth: reauthenticate,
  friends: removeAllFriends,
  requests: deletePendingRequests,
  shared: deleteAllSharedData,
  profile: deleteProfile,
  backups: deleteBackups,
  auth: deleteAuthUser,
};

// Deletes the account and everything stored server-side for it. Local
// training data is untouched; the caller asks the user what to do with it.
// On failure, stops and throws AccountDeletionError naming the failed step.
// The user stays signed in so the caller can offer a retry.
export const deleteAccount = async (
  uid: string,
  onStepStart?: (step: DeletionStep) => void,
): Promise<void> => {
  for (const step of DELETION_STEPS) {
    onStepStart?.(step);
    try {
      await STEP_RUNNERS[step](uid);
    } catch (error) {
      const cancelled =
        step === "reauth" &&
        (error as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED;
      const deletionError = new AccountDeletionError(step, error, cancelled);
      if (!cancelled) {
        notifyBugsnag(deletionError, (event) => {
          event.addMetadata("account_deletion", {
            step,
            code: (error as { code?: string }).code,
          });
        });
      }
      throw deletionError;
    }
  }
  await cleanUpAfterDeletion();
};

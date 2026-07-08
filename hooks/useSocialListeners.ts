import { useEffect, useContext, useState } from "react";
import { AppState } from "react-native";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { AuthContext } from "../context/AuthProvider";
import {
  useSocialStore,
  PendingRequest,
  SentRequest,
} from "../store/socialStore";
import { fetchFriendProfile } from "../utils/fetchFriendProfile";
import { FriendInfo, FirestorePrivateSettings } from "../types/firestore";
import Bugsnag from "@bugsnag/expo";

type QDocSnap = FirebaseFirestoreTypes.QueryDocumentSnapshot;
type DocSnap = FirebaseFirestoreTypes.DocumentSnapshot;

type ListenerScope =
  | "pendingRequests"
  | "sentRequests"
  | "friends"
  | "privacySettings"
  | "publishedPlanIds"
  | "publishedWorkoutIds";

export const useSocialListeners = () => {
  const user = useContext(AuthContext);
  const {
    setPendingRequests,
    setSentRequests,
    setFriends,
    updateFriendProfile,
    setPrivacySettings,
    setPublishedPlanIds,
    setPublishedWorkoutIds,
  } = useSocialStore();

  // A listener that hits an error (e.g. a transient permission-denied right
  // after a cold-start auth/App Check race) unsubscribes for good — nothing
  // else brings it back. Bumping this on every foreground transition forces
  // the effect below to tear down and re-subscribe all six listeners, so a
  // stuck session recovers on next app open instead of needing a full
  // force-quit.
  const [resubscribeGeneration, setResubscribeGeneration] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: string) => {
        if (nextState === "active") {
          setResubscribeGeneration((generation) => generation + 1);
        }
      },
    );
    return () => subscription.remove();
  }, []);

  // Resets only the store slice owned by the listener that actually failed —
  // a permission-denied on e.g. the friendRequests listener must not wipe
  // unrelated state (like publishedPlanIds) that other listeners populated
  // correctly. Always reports to Bugsnag (with the failing scope as
  // metadata) so a recurring permission-denied is visible instead of being
  // silently swallowed.
  const notifyError = (scope: ListenerScope, error: unknown) => {
    if ((error as any)?.code === "firestore/permission-denied") {
      switch (scope) {
        case "pendingRequests":
          setPendingRequests([]);
          break;
        case "sentRequests":
          setSentRequests([]);
          break;
        case "friends":
          setFriends([]);
          break;
        case "privacySettings":
          setPrivacySettings(null);
          break;
        case "publishedPlanIds":
          setPublishedPlanIds(null);
          break;
        case "publishedWorkoutIds":
          setPublishedWorkoutIds(null);
          break;
      }
    }
    Bugsnag.notify(
      error instanceof Error ? error : new Error(String(error)),
      (event) => {
        event.addMetadata("useSocialListeners", {
          scope,
          code: (error as any)?.code ?? null,
        });
      },
    );
  };

  useEffect(() => {
    if (!user) {
      setPendingRequests([]);
      setSentRequests([]);
      setFriends([]);
      setPrivacySettings(null);
      setPublishedPlanIds(null);
      setPublishedWorkoutIds(null);
      return;
    }

    const db = getFirestore();

    // Incoming pending requests
    const unsubPending = onSnapshot(
      query(
        collection(db, "friendRequests"),
        where("to", "==", user.uid),
        where("status", "==", "pending"),
      ),
      async (snapshot) => {
        try {
          const requests: PendingRequest[] = await Promise.all(
            snapshot.docs.map(async (docSnap: QDocSnap) => {
              const data = docSnap.data();
              const senderDoc = await getDoc(doc(db, "users", data.from));
              const sender = senderDoc.data();
              return {
                id: docSnap.id,
                fromUid: data.from,
                displayName: sender?.displayName ?? "",
                email: sender?.email ?? "",
                photoURL: sender?.photoURL ?? "",
                createdAt: data.createdAt?.toDate() ?? new Date(),
              };
            }),
          );
          setPendingRequests(requests);
        } catch (error) {
          notifyError("pendingRequests", error);
        }
      },
      (error) => {
        notifyError("pendingRequests", error);
      },
    );

    // Outgoing sent requests (still pending)
    const unsubSent = onSnapshot(
      query(
        collection(db, "friendRequests"),
        where("from", "==", user.uid),
        where("status", "==", "pending"),
      ),
      async (snapshot) => {
        try {
          const requests: SentRequest[] = await Promise.all(
            snapshot.docs.map(async (docSnap: QDocSnap) => {
              const data = docSnap.data();
              const receiverDoc = await getDoc(doc(db, "users", data.to));
              const receiver = receiverDoc.data();
              return {
                id: docSnap.id,
                toUid: data.to,
                displayName: receiver?.displayName ?? "",
                email: receiver?.email ?? "",
                photoURL: receiver?.photoURL ?? "",
                createdAt: data.createdAt?.toDate() ?? new Date(),
              };
            }),
          );
          setSentRequests(requests);
        } catch (error) {
          notifyError("sentRequests", error);
        }
      },
      (error) => {
        notifyError("sentRequests", error);
      },
    );

    // Friends list — synchronous pass first (renders immediately), then background
    // retry for any docs that lack inline profile data (old friendships).
    const unsubFriends = onSnapshot(
      collection(db, "users", user.uid, "friends"),
      (snapshot) => {
        // Populate store immediately from whatever the snapshot contains.
        const friends: FriendInfo[] = snapshot.docs.map((docSnap: QDocSnap) => {
          const data = docSnap.data();
          return {
            uid: docSnap.id,
            displayName: data.displayName ?? "",
            email: data.email ?? "",
            photoURL: data.photoURL ?? "",
            since: data.since ? data.since.toDate().getTime() : Date.now(),
          };
        });
        setFriends(friends);

        // For docs without inline profile data, fetch with retry in background.
        snapshot.docs.forEach((docSnap: QDocSnap) => {
          const docData = docSnap.data();
          if (
            docData.displayName == null ||
            docData.email == null ||
            docData.photoURL == null
          ) {
            fetchFriendProfile(docSnap.id)
              .then((profile) => {
                updateFriendProfile(docSnap.id, profile);
                updateDoc(
                  doc(db, "users", user.uid, "friends", docSnap.id),
                  profile as unknown as Record<string, unknown>,
                ).catch(() => {});
              })
              .catch(() => {});
          }
        });
      },
      (error) => {
        notifyError("friends", error);
      },
    );

    // Privacy settings
    const unsubSettings = onSnapshot(
      doc(db, "users", user.uid, "private", "settings"),
      (docSnap: DocSnap) => {
        if (docSnap.exists()) {
          setPrivacySettings(docSnap.data() as FirestorePrivateSettings);
        } else {
          setPrivacySettings(null);
        }
      },
      (error) => {
        notifyError("privacySettings", error);
      },
    );

    const unsubPublishedPlans = onSnapshot(
      collection(db, "users", user.uid, "sharedPlans"),
      (snap) => setPublishedPlanIds(snap.docs.map((d: QDocSnap) => d.id)),
      (error) => notifyError("publishedPlanIds", error),
    );

    const unsubPublishedWorkouts = onSnapshot(
      collection(db, "users", user.uid, "sharedStandaloneWorkouts"),
      (snap) => setPublishedWorkoutIds(snap.docs.map((d: QDocSnap) => d.id)),
      (error) => notifyError("publishedWorkoutIds", error),
    );

    return () => {
      unsubPending();
      unsubSent();
      unsubFriends();
      unsubSettings();
      unsubPublishedPlans();
      unsubPublishedWorkouts();
    };
  }, [user?.uid, resubscribeGeneration]);
};

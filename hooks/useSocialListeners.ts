import { useEffect, useContext } from "react";
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

  const notifyError = (error: unknown) => {
    if ((error as any)?.code === "firestore/permission-denied") {
      setPendingRequests([]);
      setSentRequests([]);
      setFriends([]);
      setPrivacySettings(null);
      setPublishedPlanIds(null);
      setPublishedWorkoutIds(null);
      return;
    }
    Bugsnag.notify(error instanceof Error ? error : new Error(String(error)));
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
          notifyError(error);
        }
      },
      (error) => {
        notifyError(error);
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
          notifyError(error);
        }
      },
      (error) => {
        notifyError(error);
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
          if (docSnap.data().displayName == null) {
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
        notifyError(error);
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
        notifyError(error);
      },
    );

    const unsubPublishedPlans = onSnapshot(
      collection(db, "users", user.uid, "sharedPlans"),
      (snap) => setPublishedPlanIds(snap.docs.map((d: QDocSnap) => d.id)),
      (error) => notifyError(error),
    );

    const unsubPublishedWorkouts = onSnapshot(
      collection(db, "users", user.uid, "sharedStandaloneWorkouts"),
      (snap) => setPublishedWorkoutIds(snap.docs.map((d: QDocSnap) => d.id)),
      (error) => notifyError(error),
    );

    return () => {
      unsubPending();
      unsubSent();
      unsubFriends();
      unsubSettings();
      unsubPublishedPlans();
      unsubPublishedWorkouts();
    };
  }, [user?.uid]);
};

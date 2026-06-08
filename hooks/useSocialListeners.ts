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

    // Friends list
    const unsubFriends = onSnapshot(
      collection(db, "users", user.uid, "friends"),
      async (snapshot) => {
        const friends: FriendInfo[] = await Promise.all(
          snapshot.docs.map(async (docSnap: QDocSnap) => {
            const data = docSnap.data();
            // Profile data stored inline for new friendships — no extra round trip needed.
            if (data.displayName != null) {
              return {
                uid: docSnap.id,
                displayName: data.displayName,
                email: data.email ?? "",
                photoURL: data.photoURL ?? "",
                since: data.since,
              };
            }
            // Fallback for existing friendships written before this change.
            try {
              const friendDoc = await getDoc(doc(db, "users", docSnap.id));
              const friend = friendDoc.data();
              const profile = {
                displayName: friend?.displayName ?? "",
                email: friend?.email ?? "",
                photoURL: friend?.photoURL ?? "",
              };
              // Backfill so future loads use the fast inline path.
              updateDoc(
                doc(db, "users", user.uid, "friends", docSnap.id),
                profile,
              ).catch(() => {});
              return { uid: docSnap.id, ...profile, since: data.since };
            } catch {
              return {
                uid: docSnap.id,
                displayName: "",
                email: "",
                photoURL: "",
                since: data.since,
              };
            }
          }),
        );
        setFriends(friends);
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
      (snap) => setPublishedPlanIds(snap.docs.map((d) => d.id)),
      (error) => notifyError(error),
    );

    const unsubPublishedWorkouts = onSnapshot(
      collection(db, "users", user.uid, "sharedStandaloneWorkouts"),
      (snap) => setPublishedWorkoutIds(snap.docs.map((d) => d.id)),
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

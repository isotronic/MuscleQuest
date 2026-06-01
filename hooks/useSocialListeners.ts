import { useEffect, useContext } from "react";
import firestore from "@react-native-firebase/firestore";
import { AuthContext } from "../context/AuthProvider";
import {
  useSocialStore,
  PendingRequest,
  SentRequest,
} from "../store/socialStore";
import { FriendInfo } from "../types/firestore";
import Bugsnag from "@bugsnag/expo";

export const useSocialListeners = () => {
  const user = useContext(AuthContext);
  const { setPendingRequests, setSentRequests, setFriends } = useSocialStore();

  useEffect(() => {
    if (!user) {
      setPendingRequests([]);
      setSentRequests([]);
      setFriends([]);
      return;
    }

    const db = firestore();

    // Incoming pending requests
    const unsubPending = db
      .collection("friendRequests")
      .where("to", "==", user.uid)
      .where("status", "==", "pending")
      .onSnapshot(
        async (snapshot) => {
          try {
            const requests: PendingRequest[] = await Promise.all(
              snapshot.docs.map(async (doc) => {
                const data = doc.data();
                const senderDoc = await db
                  .collection("users")
                  .doc(data.from)
                  .get();
                const sender = senderDoc.data();
                return {
                  id: doc.id,
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
            Bugsnag.notify(error as Error);
          }
        },
        (error) => {
          Bugsnag.notify(error);
        },
      );

    // Outgoing sent requests (still pending)
    const unsubSent = db
      .collection("friendRequests")
      .where("from", "==", user.uid)
      .where("status", "==", "pending")
      .onSnapshot(
        async (snapshot) => {
          try {
            const requests: SentRequest[] = await Promise.all(
              snapshot.docs.map(async (doc) => {
                const data = doc.data();
                const receiverDoc = await db
                  .collection("users")
                  .doc(data.to)
                  .get();
                const receiver = receiverDoc.data();
                return {
                  id: doc.id,
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
            Bugsnag.notify(error as Error);
          }
        },
        (error) => {
          Bugsnag.notify(error);
        },
      );

    // Friends list
    const unsubFriends = db
      .collection("users")
      .doc(user.uid)
      .collection("friends")
      .onSnapshot(
        async (snapshot) => {
          try {
            const friends: FriendInfo[] = await Promise.all(
              snapshot.docs.map(async (doc) => {
                const data = doc.data();
                const friendDoc = await db
                  .collection("users")
                  .doc(doc.id)
                  .get();
                const friend = friendDoc.data();
                return {
                  uid: doc.id,
                  displayName: friend?.displayName ?? "",
                  email: friend?.email ?? "",
                  photoURL: friend?.photoURL ?? "",
                  since: data.since,
                };
              }),
            );
            setFriends(friends);
          } catch (error) {
            Bugsnag.notify(error as Error);
          }
        },
        (error) => {
          Bugsnag.notify(error);
        },
      );

    return () => {
      unsubPending();
      unsubSent();
      unsubFriends();
    };
  }, [user?.uid]);
};

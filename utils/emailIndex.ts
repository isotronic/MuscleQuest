import * as Crypto from "expo-crypto";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "@react-native-firebase/firestore";

// Maps an email address to a uid without storing the address itself, so
// friend search no longer needs `email` on the public profile and the users
// collection cannot be scraped for addresses.
//
// The document id is the lowercase hex SHA-256 of the lowercased, trimmed
// email. firestore.rules verifies it against
// hashing.sha256(request.auth.token.email.lower()).toHexString().lower(), so
// only the owner of an address can claim its entry. The normalisation below
// must keep matching that expression byte for byte; rules-tests/emailIndex.test.ts
// pins both sides against a plain SHA-256 of the same string.
export const hashEmail = async (email: string): Promise<string> => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    email.trim().toLowerCase(),
  );
  return digest.toLowerCase();
};

export const upsertEmailIndex = async (
  uid: string,
  email: string,
): Promise<void> => {
  const db = getFirestore();
  await setDoc(doc(db, "emailIndex", await hashEmail(email)), { uid });
};

export const deleteEmailIndex = async (email: string): Promise<void> => {
  const db = getFirestore();
  await deleteDoc(doc(db, "emailIndex", await hashEmail(email)));
};

// A caller must already know the exact address to find anything: there is no
// `list` on emailIndex, and the hash is not reversible. Someone holding an
// address can still confirm it has an account, which is inherent to
// email-based friend search.
export const lookupUidByEmail = async (
  email: string,
): Promise<string | null> => {
  const db = getFirestore();
  const snap = await getDoc(doc(db, "emailIndex", await hashEmail(email)));
  if (!snap.exists()) return null;
  const uid = snap.data()?.uid;
  return typeof uid === "string" ? uid : null;
};

import { createHash } from "crypto";
import {
  hashEmail,
  upsertEmailIndex,
  deleteEmailIndex,
  lookupUidByEmail,
} from "../emailIndex";

const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  // Stands in for the native digest, which returns uppercase-or-lowercase hex
  // depending on platform; the util lowercases whatever it gets.
  digestStringAsync: async (_algorithm: string, data: string) =>
    require("crypto")
      .createHash("sha256")
      .update(data)
      .digest("hex")
      .toUpperCase(),
}));

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(),
  doc: jest.fn((_db: unknown, ...segments: string[]) => segments.join("/")),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

const sha256Hex = (value: string) =>
  createHash("sha256").update(value).digest("hex");

beforeEach(() => jest.clearAllMocks());

describe("hashEmail", () => {
  // firestore.rules computes
  // hashing.sha256(token.email.lower()).toHexString().lower(), so the client
  // must produce lowercase hex of the lowercased address or every write is
  // rejected.
  it("returns lowercase hex sha256 of the lowercased, trimmed address", async () => {
    await expect(hashEmail("  Alice@Example.COM ")).resolves.toBe(
      sha256Hex("alice@example.com"),
    );
  });

  it("maps every casing and padding of one address to one id", async () => {
    const variants = [
      "alice@example.com",
      "ALICE@EXAMPLE.COM",
      "  Alice@Example.com  ",
    ];
    const hashes = await Promise.all(variants.map(hashEmail));
    expect(new Set(hashes).size).toBe(1);
  });
});

describe("upsertEmailIndex", () => {
  it("writes only the uid, under the hashed id", async () => {
    await upsertEmailIndex("uid-alice", "Alice@Example.com");
    expect(mockSetDoc).toHaveBeenCalledWith(
      `emailIndex/${sha256Hex("alice@example.com")}`,
      { uid: "uid-alice" },
    );
  });

  it("never writes the address itself", async () => {
    await upsertEmailIndex("uid-alice", "alice@example.com");
    expect(JSON.stringify(mockSetDoc.mock.calls[0][1])).not.toContain("@");
  });
});

describe("deleteEmailIndex", () => {
  it("deletes the hashed id", async () => {
    await deleteEmailIndex("alice@example.com");
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      `emailIndex/${sha256Hex("alice@example.com")}`,
    );
  });
});

describe("lookupUidByEmail", () => {
  it("returns the uid when the entry exists", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ uid: "uid-alice" }),
    });
    await expect(lookupUidByEmail("alice@example.com")).resolves.toBe(
      "uid-alice",
    );
  });

  it("returns null when there is no entry", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await expect(lookupUidByEmail("nobody@example.com")).resolves.toBeNull();
  });

  it("returns null when the stored uid is not a string", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ uid: 42 }),
    });
    await expect(lookupUidByEmail("alice@example.com")).resolves.toBeNull();
  });
});

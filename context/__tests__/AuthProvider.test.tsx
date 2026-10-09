import React from "react";
import { render } from "@testing-library/react-native";
import { AuthProvider } from "../AuthProvider";
import { resolveAccountOwnership } from "../../utils/accountOwnership";

let authCallback: (user: unknown) => void = () => {};

jest.mock("@react-native-firebase/auth", () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  onAuthStateChanged: jest.fn((_auth, cb) => {
    authCallback = cb;
    return jest.fn();
  }),
}));
jest.mock("../../utils/accountOwnership", () => ({
  resolveAccountOwnership: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/utils/userProfile", () => ({
  upsertUserProfile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { setUser: jest.fn(), notify: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

it("resolves who owns the local data on sign-in", () => {
  render(<AuthProvider>{null}</AuthProvider>);

  authCallback({ uid: "alice", email: null, displayName: null });

  expect(resolveAccountOwnership).toHaveBeenCalledWith("alice");
});

it("resolves again on sign-out", () => {
  render(<AuthProvider>{null}</AuthProvider>);

  authCallback(null);

  expect(resolveAccountOwnership).toHaveBeenCalledWith(null);
});

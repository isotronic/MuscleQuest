/* eslint-disable no-undef */

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Mock SettingsManager
jest.mock("react-native/Libraries/Settings/Settings", () => ({
  Settings: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

// Mock Bugsnag
jest.mock("@bugsnag/expo", () => ({
  notify: jest.fn(),
}));

// Mock Firebase Auth
jest.mock("@react-native-firebase/auth", () => {
  const mockAuth = {
    signInWithCredential: jest.fn(),
    currentUser: { uid: "mockUserId" }, // Add a mock user
  };
  return Object.assign(() => mockAuth, {
    GoogleAuthProvider: {
      credential: jest.fn(),
    },
  });
});

// Mock Firebase Storage
jest.mock("@react-native-firebase/storage", () => {
  const mockRef = jest.fn(() => ({
    getMetadata: jest.fn(),
    getDownloadURL: jest.fn(),
    putFile: jest.fn(() => ({
      on: jest.fn(),
    })),
  }));

  return jest.fn(() => ({
    ref: mockRef,
  }));
});

// Mock Expo File System
jest.mock("expo-file-system", () => ({
  documentDirectory: "/mock/document/directory/",
  getInfoAsync: jest.fn((path) =>
    Promise.resolve({
      exists: path.includes("appData2.db"), // Simulate appData2.db existence
      isDirectory: false,
    }),
  ),
  createDownloadResumable: jest.fn(() => ({
    downloadAsync: jest.fn(() => Promise.resolve()),
  })),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock Expo Asset
jest.mock("expo-asset", () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      localUri: "mockDatabaseFileUri",
      downloadAsync: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock Expo Updates
jest.mock("expo-updates", () => ({
  reloadAsync: jest.fn(),
}));

// Mock Google Sign-In
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn().mockResolvedValue(true), // Default to resolved
    signIn: jest.fn().mockResolvedValue({ idToken: "mockIdToken" }),
  },
}));

// Mock Alert
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return {
    ...RN,
    Alert: {
      alert: jest.fn(),
    },
  };
});

jest.mock("@/utils/database", () => ({
  fetchExercisesWithLocalAnimatedUri: jest.fn(),
  clearAllLocalAnimatedUri: jest.fn(),
  fetchExercisesWithoutLocalAnimatedUri: jest.fn(),
  insertAnimatedImageUri: jest.fn(),
  openDatabase: jest.fn(),
}));

// Mock delay to resolve immediately
jest.mock("@/utils/downloadAllAnimatedImages", () => {
  const originalModule = jest.requireActual(
    "@/utils/downloadAllAnimatedImages",
  );
  return {
    ...originalModule,
    delay: jest.fn().mockResolvedValue(undefined),
  };
});

// Mock NativeEventEmitter
jest.mock("react-native/Libraries/EventEmitter/NativeEventEmitter");

// Suppress specific warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    args[0].includes("ProgressBarAndroid has been extracted") ||
    args[0].includes("Clipboard has been extracted") ||
    args[0].includes("PushNotificationIOS has been extracted") ||
    args[0].includes("NativeEventEmitter")
  ) {
    return;
  }
  originalWarn(...args);
};

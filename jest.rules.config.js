// Security rules tests. They need the Firestore emulator, so they run
// separately from the app suite: `npm run test:rules`. Requires the Firebase
// CLI (`npm install -g firebase-tools`) and Java 11+ for the emulator. Not run
// in CI.
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/rules-tests/**/*.test.ts"],
  testTimeout: 30000,
  // Every suite shares one emulator project, so clearFirestore() in one
  // suite's beforeEach would wipe another's seeded documents if they ran in
  // parallel.
  maxWorkers: 1,
};

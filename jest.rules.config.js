// Security rules tests. They need the Firestore emulator, so they run
// separately from the app suite: `npm run test:rules`.
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/rules-tests/**/*.test.ts"],
  testTimeout: 30000,
};

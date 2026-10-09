/* eslint-env jest */
/* eslint-disable no-console -- restores console spies */
// Runs after the test framework is installed (jestSetupFile.js runs before).
// Tests that exercise a failure path silence its expected log with
// jest.spyOn(console, ...). Restore after every test so a log that no test
// expects stays visible.
afterEach(() => {
  for (const method of ["error", "warn", "log"]) {
    if (jest.isMockFunction(console[method])) console[method].mockRestore();
  }
});

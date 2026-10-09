import { getBackupErrorMessage } from "../backupErrorMessage";
import { BackupError } from "../backup";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("../backup", () => jest.requireActual("../backup"));

it("explains a backup refused because the data belongs to another account", () => {
  const message = getBackupErrorMessage(
    new BackupError("account-mismatch", "x"),
    "backup",
  );
  expect(message).toMatch(/another account/);
});

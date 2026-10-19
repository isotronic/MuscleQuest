// The exercise library shipped in assets/db. A new library ships under a new
// name so every install copies it fresh (utils/initAppDataDB.ts only copies a
// missing file); the names below are deleted on the next boot. The asset
// require in initAppDataDB.ts has to match, since Metro needs a literal path.
export const APP_DATA_DB = "appData4.db";

export const OLD_APP_DATA_DBS = ["appData1.db", "appData2.db", "appData3.db"];

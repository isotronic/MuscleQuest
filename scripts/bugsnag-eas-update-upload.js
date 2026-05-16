#!/usr/bin/env node

const { promisify } = require("util");
const { execFile } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const { reactNative } = require("@bugsnag/source-maps");
const { getConfig } = require("@expo/config");

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = process.cwd();

// Default channel; override with EAS_UPDATE_CHANNEL=staging etc.
const CHANNEL = process.env.EAS_UPDATE_CHANNEL || "production";

async function run() {
  console.log(`Running EAS Update on channel "${CHANNEL}" for Android...`);

  // 1) Run eas update and capture JSON output (array of updates)
  const { stdout } = await execFileAsync(
    "eas",
    [
      "update",
      "--channel",
      CHANNEL,
      "--platform",
      "android",
      "--non-interactive",
      "--auto",
      "--json",
    ],
    {
      cwd: PROJECT_ROOT,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const updates = JSON.parse(stdout);
  const androidUpdate =
    Array.isArray(updates) && updates.find((u) => u.platform === "android");

  if (!androidUpdate) {
    throw new Error(
      "No Android update found in EAS update JSON output. Check that eas update ran successfully.",
    );
  }

  // Prefer group (update group ID) to match manifest.metadata.updateGroup
  const codeBundleId =
    androidUpdate.group || androidUpdate.groupId || androidUpdate.id;

  if (!codeBundleId) {
    throw new Error(
      "Could not determine codeBundleId from EAS update output (no group/groupId/id).",
    );
  }

  console.log(`Using codeBundleId: ${codeBundleId}`);

  // 2) Find Android bundle + sourcemap in dist/bundles
  const bundlesDir = path.join(PROJECT_ROOT, "dist", "bundles");
  const entries = await fs.readdir(bundlesDir);

  const bundleFile = entries.find((f) => /^android-.*\.js$/.test(f));
  const sourceMapFile = entries.find((f) => /^android-.*\.map$/.test(f));

  if (!bundleFile || !sourceMapFile) {
    throw new Error(
      `Could not find android-*.js / android-*.map in ${bundlesDir}. ` +
        "Confirm that EAS Update produced bundles there.",
    );
  }

  const bundle = path.join(bundlesDir, bundleFile);
  const sourceMap = path.join(bundlesDir, sourceMapFile);

  console.log("Found bundle and sourcemap:");
  console.log(`  bundle:    ${bundle}`);
  console.log(`  sourcemap: ${sourceMap}`);

  // 3) Read Bugsnag API key from Expo config
  const appConfig = getConfig(PROJECT_ROOT);
  const apiKey = appConfig?.exp?.extra?.bugsnag?.apiKey;

  if (!apiKey) {
    throw new Error("No Bugsnag API key found in expo.extra.bugsnag.apiKey.");
  }

  console.log("Uploading Android EAS Update sourcemap to Bugsnag...");

  await reactNative.uploadOne({
    apiKey,
    platform: "android",
    bundle,
    sourceMap,
    projectRoot: PROJECT_ROOT,
    codeBundleId, // must match Bugsnag.start({ codeBundleId: ... })
  });

  console.log("Successfully uploaded Android EAS Update sourcemap to Bugsnag.");
}

run().catch((err) => {
  console.error("Error during EAS Update + Bugsnag upload:");
  console.error(err?.stack || err);
  process.exit(1);
});

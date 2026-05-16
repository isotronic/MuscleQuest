#!/usr/bin/env node

require("dotenv").config();

const { promisify } = require("util");
const { execFile } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");
const { reactNative } = require("@bugsnag/source-maps");

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = process.cwd();
const CHANNEL = process.env.EAS_UPDATE_CHANNEL || "production";

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function run() {
  console.log(`Preparing EAS Update for channel "${CHANNEL}" (Android)...`);

  // 0) Ask for update message
  const defaultMessage = "OTA update";
  const msgInput = await ask(
    `EAS update message [default: "${defaultMessage}"]: `,
  );
  const message = (msgInput && msgInput.trim()) || defaultMessage;

  console.log(
    "\n1) Exporting bundles + sourcemaps for Android (expo export)...\n",
  );

  // 1) Create a local export with sourcemaps
  const exportResult = await execFileAsync(
    "npx",
    [
      "expo",
      "export",
      "--platform",
      "android",
      "--dump-sourcemap",
      "--output-dir",
      "dist",
    ],
    {
      cwd: PROJECT_ROOT,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (exportResult.stdout) {
    process.stdout.write(exportResult.stdout);
  }
  if (exportResult.stderr) {
    process.stderr.write(exportResult.stderr);
  }

  console.log("\n2) Running EAS Update for Android...\n");

  // 2) Run eas update and capture JSON output
  const updateResult = await execFileAsync(
    "eas",
    [
      "update",
      "--channel",
      CHANNEL,
      "--platform",
      "android",
      "--non-interactive",
      "--json",
      "--message",
      message,
    ],
    {
      cwd: PROJECT_ROOT,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (updateResult.stdout) {
    process.stdout.write(updateResult.stdout);
  }
  if (updateResult.stderr) {
    process.stderr.write(updateResult.stderr);
  }

  let updates;
  try {
    updates = JSON.parse(updateResult.stdout);
  } catch (err) {
    throw new Error(
      `Failed to parse EAS Update JSON output. Did --json run correctly?\n${err}`,
    );
  }

  const androidUpdate =
    Array.isArray(updates) && updates.find((u) => u.platform === "android");

  if (!androidUpdate) {
    throw new Error(
      "No Android update found in EAS update JSON output. Check that eas update ran successfully.",
    );
  }

  const codeBundleId =
    androidUpdate.group || androidUpdate.groupId || androidUpdate.id;

  if (!codeBundleId) {
    throw new Error(
      "Could not determine codeBundleId from EAS update output (no group/groupId/id).",
    );
  }

  console.log(`\nUsing codeBundleId: ${codeBundleId}\n`);

  // 3) Find Android bundle + sourcemap in dist/_expo/static/js/android
  const bundlesDir = path.join(
    PROJECT_ROOT,
    "dist",
    "_expo",
    "static",
    "js",
    "android",
  );
  const entries = await fs.readdir(bundlesDir).catch((err) => {
    throw new Error(
      `Could not read ${bundlesDir}. Did expo export run successfully?\n${err}`,
    );
  });

  const androidBundleFile = entries.find((f) => /^entry-.*\.(hbc|js)$/.test(f));
  const androidSourceMapFile = entries.find((f) =>
    /^entry-.*\.(hbc|js)\.map$/.test(f),
  );

  if (!androidBundleFile || !androidSourceMapFile) {
    throw new Error(
      `Could not find entry-*.hbc/js or entry-*.hbc.map/entry-*.js.map in ${bundlesDir}.`,
    );
  }

  const originalBundle = path.join(bundlesDir, androidBundleFile);
  const originalSourceMap = path.join(bundlesDir, androidSourceMapFile);

  // 4) Copy to the names Bugsnag expects
  const bugSnagDir = path.join(PROJECT_ROOT, "dist", "bugsnag-android");
  await fs.mkdir(bugSnagDir, { recursive: true });

  const bundle = path.join(bugSnagDir, "index.android.bundle");
  const sourceMap = path.join(bugSnagDir, "index.android.bundle.map");

  await fs.copyFile(originalBundle, bundle);
  await fs.copyFile(originalSourceMap, sourceMap);

  // 5) Read Bugsnag API key from .env and upload to Bugsnag
  const apiKey = process.env.EXPO_PUBLIC_BUGSNAG_API_KEY;

  if (!apiKey) {
    throw new Error(
      "No Bugsnag API key found. Set EXPO_PUBLIC_BUGSNAG_API_KEY in your .env.",
    );
  }

  console.log("3) Uploading Android EAS Update sourcemap to Bugsnag...\n");

  await reactNative.uploadOne({
    apiKey,
    platform: "android",
    bundle,
    sourceMap,
    projectRoot: PROJECT_ROOT,
    codeBundleId,
  });

  console.log(
    "✅ Successfully uploaded Android EAS Update sourcemap to Bugsnag.\n",
  );
}

run().catch((err) => {
  console.error("Error during EAS Update + Bugsnag upload:");
  console.error(err?.stack || err);
  process.exit(1);
});

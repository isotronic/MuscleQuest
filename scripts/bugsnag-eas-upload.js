#!/usr/bin/env node

const { access } = require("fs").promises;
const { reactNative } = require("@bugsnag/source-maps");
const { exit } = require("process");
const { getConfig } = require("@expo/config");

const PROJECT_ROOT = process.cwd();

if (process.env.EAS_BUILD_PLATFORM !== "android") {
  console.log("Skipping Android source map upload: Android build not detected");
  exit(0);
} else if (process.env.EAS_BUILD_PROFILE === "development") {
  console.log("Skipping Android source map upload: Development build detected");
  exit(0);
}

const uploadSourceMaps = async () => {
  const bundle = `${PROJECT_ROOT}/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle`;
  await access(bundle).catch((error) => {
    console.log(
      `Skipping Android source map upload: App bundle ${bundle} could not be found.\n${error}`,
    );
    exit(0);
  });

  const sourceMap = `${PROJECT_ROOT}/android/app/build/generated/sourcemaps/react/release/index.android.bundle.map`;
  await access(sourceMap).catch((error) => {
    console.error(
      `Error: source map ${sourceMap} could not be found.\n${error}`,
    );
    exit(1);
  });

  let appConfig, apiKey;
  try {
    appConfig = getConfig(PROJECT_ROOT);
    apiKey = appConfig?.exp?.extra?.bugsnag?.apiKey;
  } catch (error) {
    console.error(
      `Error: Failed to read app config in ${PROJECT_ROOT}.\n${error}`,
    );
    exit(1);
  }

  if (!apiKey) {
    console.error("Error: No Bugsnag API key detected in app config");
    exit(1);
  }

  const versionName = appConfig?.exp?.version;
  const versionCode = appConfig?.exp?.android?.versionCode;

  console.log("Uploading Android source map to Bugsnag...");
  try {
    await reactNative.uploadOne({
      apiKey,
      platform: "android",
      bundle,
      sourceMap,
      projectRoot: PROJECT_ROOT,
      ...(versionName && { appVersion: versionName }),
      ...(versionCode && { appVersionCode: String(versionCode) }),
    });
    console.log(
      `Successfully uploaded the following files:\n${[bundle, sourceMap].join("\n")}`,
    );
  } catch (error) {
    console.error(`Error uploading source map: ${error}`);
    exit(1);
  }
};

uploadSourceMaps().catch((err) => {
  console.error(`Unhandled error in uploadSourceMaps: ${err?.stack || err}`);
  process.exitCode = 1;
});

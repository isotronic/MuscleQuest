const { withAndroidManifest } = require("@expo/config-plugins");

// expo-audio registers AudioControlsService (mediaPlayback) and AudioRecordingService (microphone)
// as foreground services. Both types are restricted in Android 15+ when started from BOOT_COMPLETED
// broadcast receivers (which expo-notifications registers). This app only uses expo-audio for
// simple sound playback — no lock screen controls, no recording — so we remove both services
// from the merged manifest entirely.
const withRemovedAudioForegroundServices = (config) => {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    if (!manifest.application || manifest.application.length === 0) {
      return config;
    }
    const application = manifest.application[0];
    if (!application.service) {
      application.service = [];
    }

    const toRemove = [
      "expo.modules.audio.service.AudioControlsService",
      "expo.modules.audio.service.AudioRecordingService",
    ];

    for (const name of toRemove) {
      const alreadyPresent = application.service.some(
        (s) => s.$["android:name"] === name,
      );
      if (!alreadyPresent) {
        application.service.push({
          $: { "android:name": name, "tools:node": "remove" },
        });
      }
    }

    return config;
  });
};

module.exports = withRemovedAudioForegroundServices;

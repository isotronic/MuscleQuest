#!/usr/bin/env bash
# Local Android build for development and E2E testing. Store builds stay on
# EAS (npm run build). Needs JDK 17 (JAVA_HOME) and ANDROID_HOME; Gradle fetches
# the NDK and CMake on the first run.
#
#   scripts/build-local-android.sh e2e [abi]   release APK, dummy Bugsnag key
#   scripts/build-local-android.sh dev [abi]   debug dev-client APK (com.isotronic.musclequest.dev)
#
# abi defaults to x86_64 (the emulator); pass arm64-v8a for a phone.
# Switching between e2e and dev changes the app id, so add --clean then:
#   CLEAN=1 scripts/build-local-android.sh dev
set -euo pipefail

variant="${1:-e2e}"
abi="${2:-x86_64}"
cd "$(dirname "$0")/.."

case "$variant" in
  e2e)
    export EXPO_PUBLIC_BUGSNAG_API_KEY=00000000000000000000000000000000
    export NODE_ENV=production
    task=assembleRelease
    apk=android/app/build/outputs/apk/release/app-release.apk
    ;;
  dev)
    export APP_VARIANT=development
    task=assembleDebug
    apk=android/app/build/outputs/apk/debug/app-debug.apk
    ;;
  *)
    echo "usage: $0 e2e|dev [abi]" >&2
    exit 1
    ;;
esac

CI=1 npx expo prebuild -p android --no-install ${CLEAN:+--clean}

# Two workers and a 4 GB heap keep the build from starving the emulator.
(cd android && ./gradlew "$task" --max-workers=2 \
  -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=1g" \
  -PreactNativeArchitectures="$abi" -x lint)
(cd android && ./gradlew --stop >/dev/null)

echo "Built $apk"

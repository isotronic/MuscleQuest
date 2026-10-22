#!/usr/bin/env bash
# Upgrade install E2E: a workout left in progress on the old build must resume
# after the new build is installed over it.
#
#   scripts/e2e-upgrade-install.sh <old.apk> <new.apk>
#
# Both APKs must share a signing key (local e2e builds use the debug key).
# Uninstalls the app from the connected emulator first (and refuses to run
# against anything that is not an emulator). Needs adb and the
# Maestro CLI (MAESTRO overrides its path).
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "usage: $0 <old.apk> <new.apk>" >&2
  exit 1
fi
old="$(realpath "$1")"
new="$(realpath "$2")"
maestro="${MAESTRO:-$HOME/.maestro/bin/maestro}"
app=com.isotronic.musclequest
cd "$(dirname "$0")/.."

# The app id is the store one: never uninstall it from a real phone, which
# would wipe its training history.
if [ "$(adb shell getprop ro.kernel.qemu 2>/dev/null | tr -d '\r')" != 1 ]; then
  echo "The adb device is not an emulator; refusing to uninstall $app." >&2
  exit 1
fi

adb uninstall "$app" >/dev/null 2>&1 || true
adb install "$old"
adb shell settings put secure immersive_mode_confirmations confirmed
"$maestro" test .maestro/upgrade-before.yml
adb install -r "$new"
"$maestro" test .maestro/upgrade-after.yml

# E2E flows (Maestro)

Flows drive the release build of the app on an Android emulator. Building
blocks live in `flows/`; the top-level files are the suites:

| Suite | Contents |
|---|---|
| `smoke.yml` | Starter plan, plan workout with the rest timer (one rest ends with the app in the background and must notify), quick workout that survives the app being killed |
| `full.yml` | Everything, chained on one install; each flow starts and ends on home |
| `german.yml` | Onboarding and the quick workout on a German device |
| `upgrade-before.yml`, `upgrade-after.yml` | A workout left in progress on an old build resumes after a new build is installed over it; run through `scripts/e2e-upgrade-install.sh` |

Selectors use `testID`s. Text is only used for names the flows type
themselves, entered or converted values, the German welcome check, and
Android's own UI (the rest notification in the shade, the folder picker in
`export-data.yml`), so `full.yml` needs an English device.

## Running

On EAS (uses CI minutes; the free plan has 60 a month):

```
npm run test:e2e                          # new e2e-test build, then smoke
npm run test:e2e:full                     # new build, then full and german
npm run test:e2e-existing -- <build-id>   # smoke on an existing build
npm run test:e2e-existing:full -- <build-id>
```

Locally (free): an emulator from the `system-images;android-34;default;x86_64`
image with gesture navigation, the Maestro CLI in `~/.maestro`, and an APK
from `npm run build:local-e2e` (a few minutes once cached) or an `e2e-test`
build on EAS (`eas build --profile e2e-test --platform android`). A local APK
is signed with the debug key, so uninstall an EAS-built app first.

OTA updates on the `e2e` channel are no use for testing: on the EAS e2e build,
any update bundle (even the embedded one) failed at launch with "Cannot read
property 'ErrorBoundary' of undefined" and was rolled back. Rebuild instead.

```
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell settings put secure immersive_mode_confirmations confirmed
~/.maestro/bin/maestro test .maestro/full.yml --test-output-dir <dir>
```

Do not build while the emulator runs: together they exhaust the RAM on a
14 GB machine. Build, then boot the emulator.

Upgrade install, with two APKs signed with the same key (local builds are):

```
scripts/e2e-upgrade-install.sh old.apk new.apk
```

It uninstalls the app, installs the old APK, leaves a plan workout in progress
with one set logged, installs the new APK over it, and checks the workout
resumes on the right set and finishes.

For `german.yml`, switch the emulator first: `adb root`, wait until
`adb shell whoami` prints `root`, then
`adb shell "setprop persist.sys.locale de-DE; setprop ctl.restart zygote"`. Switch back the
same way with `en-US`, then `adb reboot` before running other flows: after a
zygote restart Maestro stopped seeing React Native `Modal` windows (the
weekly-goal settings modal) until a full reboot.

## Later

- **Drag to reorder.** Maestro has no long-press-then-drag gesture, so the
  plan editor's drag to reorder (react-native-sortables) is checked by hand.
  `adb shell input draganddrop <x1> <y1> <x2> <y2> 1500` may do it from a
  script.

- **Stale workout prompt.** Move the emulator clock forward a few hours (needs
  root) after starting a workout, relaunch, and check the resume, finish or
  discard prompt (`stale-resume`, `stale-finish`, `stale-discard`). Changing
  the device clock can upset other flows, so run it last and on its own.
- **Three-button navigation.** Run the suite once after
  `adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.threebutton`
  and relaunch the app (back with `...navbar.gestural`). A plain
  `overlay enable` leaves the gestural overlay on too: the buttons are drawn
  but apps get the small gesture inset, so everything looks covered.

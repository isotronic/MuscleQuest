# E2E flows (Maestro)

Flows drive the release build of the app on an Android emulator. Building
blocks live in `flows/`; the top-level files are the suites:

| Suite | Contents |
|---|---|
| `smoke.yml` | Starter plan, plan workout with the rest timer, quick workout that survives the app being killed |
| `full.yml` | Everything, chained on one install; each flow starts and ends on home |
| `german.yml` | Onboarding and the quick workout on a German device |

Selectors use `testID`s. Text is only used for names the flows type
themselves, entered or converted values, and the German welcome check.

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
~/.maestro/bin/maestro test .maestro/full.yml
```

For `german.yml`, switch the emulator first: `adb root`, wait until
`adb shell whoami` prints `root`, then
`adb shell "setprop persist.sys.locale de-DE; setprop ctl.restart zygote"`.

## Later

- **Stale workout prompt.** Move the emulator clock forward a few hours (needs
  root) after starting a workout, relaunch, and check the resume, finish or
  discard prompt (`stale-resume`, `stale-finish`, `stale-discard`). Changing
  the device clock can upset other flows, so run it last and on its own.
- **Three-button navigation.** Run the suite once after
  `adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.threebutton`
  and relaunch the app (back with `...navbar.gestural`). A plain
  `overlay enable` leaves the gestural overlay on too: the buttons are drawn
  but apps get the small gesture inset, so everything looks covered.

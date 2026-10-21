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
from an `e2e-test` build (`eas build --profile e2e-test --platform android`).

```
adb install -r e2e.apk
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
- **Three-button navigation.** Run the suite once with
  `adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton`.
  It fails on the exercise pickers until their bottom buttons use the safe-area
  inset instead of a fixed `paddingBottom: 28`.

// Dev-only demo data for marketing screenshots (see dev/demo/index.ts).
//
// The only file of dev/demo that app code imports, and the only one that can
// reach a production bundle. Metro inlines __DEV__ and EXPO_PUBLIC_* values,
// then folds the condition before it collects dependencies, so a release
// build (or a dev server started without EXPO_PUBLIC_DEMO_DATA=1) never sees
// the require below: the demo code and its JSON fixtures stay out of the
// bundle. Inside, the module checks again at runtime that this is the dev
// variant (see isDemoBuild in ./state).
import type * as DemoModule from "./index";

export const demoMode: typeof DemoModule | null =
  __DEV__ && process.env.EXPO_PUBLIC_DEMO_DATA === "1"
    ? // A conditional require, unlike an import, can be dropped by Metro.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("./index") as typeof DemoModule)
    : null;

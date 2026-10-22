import { router } from "expo-router";

/**
 * Opens a plan's overview on the Plans tab with the plans list under it, so
 * Back and a tap on the tab return to the list.
 *
 * withAnchor has each navigator first mount its first screen (Home, then the
 * plans list) before the overview goes on top. Pushing the overview into a
 * Plans stack that has not mounted yet would make it the stack's root.
 * `replace` swaps out the current screen instead (Get started).
 */
export function openPlanOverview(
  planId: number,
  { replace = false }: { replace?: boolean } = {},
) {
  const href = {
    pathname: "/(app)/(tabs)/(plans)/overview",
    params: { planId: String(planId) },
  } as const;
  if (replace) {
    router.replace(href, { withAnchor: true });
  } else {
    router.push(href, { withAnchor: true });
  }
}

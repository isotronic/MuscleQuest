import React from "react";
import { Portal, Snackbar } from "react-native-paper";
import { useSnackbarStore } from "@/store/snackbarStore";

const DEFAULT_DURATION = 4000;

/** The app-wide snackbar; show messages with `showSnackbar` from the store. */
export function AppSnackbar() {
  const current = useSnackbarStore((s) => s.current);
  const pressAction = useSnackbarStore((s) => s.pressAction);
  const dismiss = useSnackbarStore((s) => s.dismiss);

  return (
    <Portal>
      <Snackbar
        // A new id remounts it, so a replacement gets its own full duration.
        key={current?.id ?? 0}
        visible={current != null}
        onDismiss={dismiss}
        duration={current?.duration ?? DEFAULT_DURATION}
        action={
          current?.action
            ? { label: current.action.label, onPress: pressAction }
            : undefined
        }
      >
        {current?.message ?? ""}
      </Snackbar>
    </Portal>
  );
}

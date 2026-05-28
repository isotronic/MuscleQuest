import React from "react";
import {
  BottomSheetModal,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import { useAppTheme } from "@/theme";

type AppBottomSheetProps = Omit<BottomSheetModalProps, "backgroundStyle">;

export const AppBottomSheet = React.forwardRef<
  BottomSheetModal,
  AppBottomSheetProps
>(function AppBottomSheet(props, ref) {
  const { colors } = useAppTheme();

  return (
    <BottomSheetModal
      ref={ref}
      backgroundStyle={{ backgroundColor: colors.card }}
      {...props}
    />
  );
});

import React from "react";
import type { StyleProp } from "react-native/Libraries/StyleSheet/StyleSheet";
import type { ViewStyle } from "react-native/Libraries/StyleSheet/StyleSheetTypes";
import SliderLib, { type SliderProps } from "@react-native-community/slider";
import { useAppTheme } from "@/theme";

const SliderComponent =
  SliderLib as unknown as React.ComponentType<SliderProps>;

interface AppSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  style?: StyleProp<ViewStyle>;
}

export function AppSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onSlidingComplete,
  style,
}: AppSliderProps) {
  const { inputs } = useAppTheme();

  return (
    <SliderComponent
      value={value}
      minimumValue={min}
      maximumValue={max}
      step={step}
      onValueChange={onChange}
      onSlidingComplete={onSlidingComplete}
      minimumTrackTintColor={inputs.trackActive}
      maximumTrackTintColor={inputs.trackInactive}
      thumbTintColor={inputs.thumb}
      style={style}
    />
  );
}

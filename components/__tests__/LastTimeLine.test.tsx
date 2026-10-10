import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import LastTimeLine from "../LastTimeLine";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/theme", () => ({
  useAppTheme: () => ({ colors: { contentSecondary: "#aaa" } }),
}));

const previous = {
  weight: 60,
  reps: 8,
  time: null,
  distance: null,
  localDate: "2026-09-12",
};
// The device's short form of the day, so the test holds in any locale.
const day = new Date(2026, 8, 12).toLocaleDateString(undefined, {
  day: "numeric",
  month: "short",
});
const props = {
  previous,
  trackingType: "weight",
  weightUnit: "kg",
  distanceUnit: "m",
};

describe("LastTimeLine", () => {
  it("shows last time's weight, reps and training day", () => {
    const { getByText } = render(<LastTimeLine {...props} />);
    expect(getByText(`Last time: 60 kg × 8 (${day})`)).toBeTruthy();
  });

  it("shows assistance, reps, time and distance in their own terms", () => {
    const { getByText, rerender } = render(
      <LastTimeLine {...props} trackingType="assisted" weightUnit="lbs" />,
    );
    expect(getByText(`Last time: 60 lbs assist × 8 (${day})`)).toBeTruthy();

    rerender(<LastTimeLine {...props} trackingType="reps" />);
    expect(getByText(`Last time: 8 reps (${day})`)).toBeTruthy();

    rerender(
      <LastTimeLine
        {...props}
        trackingType="time"
        previous={{ ...previous, time: 95 }}
      />,
    );
    expect(getByText(`Last time: 1:35 (${day})`)).toBeTruthy();

    rerender(
      <LastTimeLine
        {...props}
        trackingType="distance"
        distanceUnit="ft"
        previous={{ ...previous, distance: 1312.34 }}
      />,
    );
    expect(getByText(`Last time: 1312.34 ft (${day})`)).toBeTruthy();
  });

  it("shows the suggestion next to last time when one prefilled the weight", () => {
    const { getByText } = render(
      <LastTimeLine {...props} suggestedWeight={62.5} />,
    );
    expect(
      getByText(`Last: 60 kg × 8 (${day}) · Suggested: 62.5 kg`),
    ).toBeTruthy();
  });

  it("renders nothing when history has no values for this type", () => {
    const { toJSON } = render(<LastTimeLine {...props} trackingType="time" />);
    expect(toJSON()).toBeNull();
  });

  it("copies the values on press, with a spoken label", () => {
    const onPress = jest.fn();
    const { getByRole } = render(<LastTimeLine {...props} onPress={onPress} />);
    fireEvent.press(
      getByRole("button", {
        name: "Use last time's values: 60 kilograms, 8 reps",
      }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is plain text without a handler", () => {
    const { queryByRole } = render(<LastTimeLine {...props} />);
    expect(queryByRole("button")).toBeNull();
  });

  it("shows last time's note on a line of its own, expanding on tap", () => {
    const { getByText, getByRole } = render(
      <LastTimeLine
        {...props}
        previous={{ ...previous, note: "felt shoulder on rep 6" }}
      />,
    );
    const note = getByText("Note: felt shoulder on rep 6");
    expect(note.props.numberOfLines).toBe(1);

    fireEvent.press(
      getByRole("button", { name: "Last time's note: felt shoulder on rep 6" }),
    );
    expect(getByText("Note: felt shoulder on rep 6").props.numberOfLines).toBe(
      undefined,
    );
  });

  it("still shows the note when history has no values for this type", () => {
    const { getByText, queryByText } = render(
      <LastTimeLine
        {...props}
        trackingType="time"
        previous={{ ...previous, note: "skipped, knee" }}
      />,
    );
    expect(getByText("Note: skipped, knee")).toBeTruthy();
    expect(queryByText(/Last time/)).toBeNull();
  });
});

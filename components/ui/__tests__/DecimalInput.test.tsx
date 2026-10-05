import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

type DecimalInputModule = typeof import("../DecimalInput");

function loadWithSeparator(decimalSeparator: string): DecimalInputModule {
  let mod: DecimalInputModule | undefined;
  jest.isolateModules(() => {
    jest.doMock("expo-localization", () => ({
      getLocales: () => [{ decimalSeparator }],
    }));
    mod = require("../DecimalInput");
  });
  return mod!;
}

describe("DecimalInput on a comma device", () => {
  const { DecimalInput } = loadWithSeparator(",");

  it.each(["62,5", "62.5"])(
    "reports typed %j as the canonical 62.5",
    (typed) => {
      const onChangeValue = jest.fn();
      const { getByTestId } = render(
        <DecimalInput
          testID="input"
          accessibilityLabel="Weight"
          value=""
          onChangeValue={onChangeValue}
        />,
      );
      fireEvent.changeText(getByTestId("input"), typed);
      expect(onChangeValue).toHaveBeenCalledWith("62.5");
    },
  );

  it("shows a canonical value with the device separator", () => {
    const { getByTestId } = render(
      <DecimalInput
        testID="input"
        accessibilityLabel="Weight"
        value="62.5"
        onChangeValue={jest.fn()}
      />,
    );
    expect(getByTestId("input").props.value).toBe("62,5");
  });

  it("shows a whole number from the +/- buttons unchanged", () => {
    const { getByTestId } = render(
      <DecimalInput
        testID="input"
        accessibilityLabel="Weight"
        value="60"
        onChangeValue={jest.fn()}
      />,
    );
    expect(getByTestId("input").props.value).toBe("60");
  });

  it("asks for the decimal keypad", () => {
    const { getByTestId } = render(
      <DecimalInput
        testID="input"
        accessibilityLabel="Weight"
        value=""
        onChangeValue={jest.fn()}
      />,
    );
    expect(getByTestId("input").props.keyboardType).toBe("decimal-pad");
  });
});

describe("DecimalInput on a point device", () => {
  const { DecimalInput } = loadWithSeparator(".");

  it("shows a canonical value unchanged", () => {
    const { getByTestId } = render(
      <DecimalInput
        testID="input"
        accessibilityLabel="Weight"
        value="62.5"
        onChangeValue={jest.fn()}
      />,
    );
    expect(getByTestId("input").props.value).toBe("62.5");
  });
});

import React from "react";
import { render } from "@testing-library/react-native";
import { SettingRow, SettingsScroll } from "../SettingRow";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ highlight: "defaultRestTime" }),
}));

const rowStyle = (node: any) => {
  // The animated wrapper around the row's touchable.
  let current = node;
  while (current && !current.props.onLayout) current = current.parent;
  return current?.props.style;
};

describe("SettingRow", () => {
  it("highlights the row a search result opened, and no other", () => {
    const { getByText } = render(
      <SettingsScroll>
        <SettingRow id="defaultRestTime" icon="clock" title="Rest" />
        <SettingRow id="defaultSets" icon="numeric" title="Sets" />
      </SettingsScroll>,
    );
    expect(rowStyle(getByText("Rest"))).toEqual(
      expect.objectContaining({ backgroundColor: expect.anything() }),
    );
    expect(rowStyle(getByText("Sets"))).toBeFalsy();
  });
});

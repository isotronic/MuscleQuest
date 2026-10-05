import { Alert } from "react-native";
import { confirmImplausibleWeight } from "../confirmImplausibleWeight";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
}));
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "de", decimalSeparator: "," }],
}));

type AlertButton = { text: string; style?: string; onPress?: () => void };
const lastAlert = () => {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1)!;
  return {
    title: call[0] as string,
    body: call[1] as string,
    buttons: call[2] as AlertButton[],
  };
};
const press = (label: string) =>
  lastAlert()
    .buttons.find((b) => b.text === label)!
    .onPress?.();

describe("confirmImplausibleWeight", () => {
  beforeEach(() => jest.clearAllMocks());

  it("offers the comma-corrected weight next to the recent best", () => {
    const onUse = jest.fn();
    const onKeep = jest.fn();
    confirmImplausibleWeight({
      weight: 625,
      suggestion: 62.5,
      reference: 65,
      weightUnit: "kg",
      onUse,
      onKeep,
    });

    const { title, body, buttons } = lastAlert();
    expect(title).toBe("Is 625 kg right?");
    expect(body).toContain("65 kg");
    expect(buttons.map((b) => b.text)).toEqual([
      "Edit",
      "Use 62,5",
      "Keep 625",
    ]);

    press("Use 62,5");
    expect(onUse).toHaveBeenCalledWith(62.5);
    expect(onKeep).not.toHaveBeenCalled();
  });

  it("keeps the entry as typed", () => {
    const onKeep = jest.fn();
    confirmImplausibleWeight({
      weight: 200,
      suggestion: null,
      reference: 60,
      weightUnit: "kg",
      onUse: jest.fn(),
      onKeep,
    });
    expect(lastAlert().buttons.map((b) => b.text)).toEqual([
      "Edit",
      "Keep 200",
    ]);
    press("Keep 200");
    expect(onKeep).toHaveBeenCalled();
  });

  it("does nothing on Edit", () => {
    const onUse = jest.fn();
    const onKeep = jest.fn();
    confirmImplausibleWeight({
      weight: 625,
      suggestion: 62.5,
      reference: 65,
      weightUnit: "kg",
      onUse,
      onKeep,
    });
    press("Edit");
    expect(onUse).not.toHaveBeenCalled();
    expect(onKeep).not.toHaveBeenCalled();
  });

  it("explains the ceiling when there is no history", () => {
    confirmImplausibleWeight({
      weight: 700,
      suggestion: null,
      reference: null,
      weightUnit: "lbs",
      onUse: jest.fn(),
      onKeep: jest.fn(),
    });
    expect(lastAlert().title).toBe("Is 700 lbs right?");
    expect(lastAlert().body).toContain("660 lbs");
  });
});

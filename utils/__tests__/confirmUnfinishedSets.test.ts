import { Alert } from "react-native";
import {
  confirmUnfinishedSets,
  findUnfinishedSets,
  unfinishedSetsMessage,
} from "../confirmUnfinishedSets";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));

const sets = (n: number) => Array.from({ length: n }, () => ({}));

describe("findUnfinishedSets", () => {
  it("counts the sets not marked complete, per exercise", () => {
    const exercises = [
      { name: "Bench", sets: sets(3) },
      { name: "Curls", sets: sets(3) },
      { name: "Face pulls", sets: sets(2) },
    ];
    const completed = {
      0: { 0: true, 1: true, 2: true },
      1: { 0: true, 1: false },
    };
    expect(findUnfinishedSets(exercises, completed)).toEqual([
      { name: "Curls", count: 2 },
      { name: "Face pulls", count: 2 },
    ]);
  });

  it("returns nothing when every set is done", () => {
    expect(
      findUnfinishedSets([{ name: "Bench", sets: sets(1) }], {
        0: { 0: true },
      }),
    ).toEqual([]);
  });
});

describe("unfinishedSetsMessage", () => {
  it("names the exercises and totals the sets", () => {
    expect(
      unfinishedSetsMessage([
        { name: "Curls", count: 2 },
        { name: "Face pulls", count: 2 },
      ]),
    ).toBe(
      "4 sets not completed (Curls 2, Face pulls 2). They will not be saved.",
    );
    expect(unfinishedSetsMessage([{ name: "Curls", count: 1 }])).toBe(
      "1 set not completed (Curls 1). It will not be saved.",
    );
  });

  it("lists three exercises, then how many more", () => {
    const unfinished = ["A", "B", "C", "D", "E"].map((name) => ({
      name,
      count: 1,
    }));
    expect(unfinishedSetsMessage(unfinished)).toBe(
      "5 sets not completed (A 1, B 1, C 1 and 2 more). They will not be saved.",
    );
  });
});

describe("confirmUnfinishedSets", () => {
  it("finishes straight away when nothing is left", () => {
    const onFinish = jest.fn();
    confirmUnfinishedSets([], onFinish);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("asks first, and Go back does not finish", () => {
    const onFinish = jest.fn();
    confirmUnfinishedSets([{ name: "Curls", count: 2 }], onFinish);

    expect(onFinish).not.toHaveBeenCalled();
    const [title, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe("Finish workout?");
    expect(buttons.map((b: { text: string }) => b.text)).toEqual([
      "Go back",
      "Finish anyway",
    ]);

    buttons[0].onPress?.();
    expect(onFinish).not.toHaveBeenCalled();
    buttons[1].onPress();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

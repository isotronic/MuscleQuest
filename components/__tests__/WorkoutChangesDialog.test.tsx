import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { WorkoutChangesDialog, describeChange } from "../WorkoutChangesDialog";
import type { WorkoutChange } from "@/utils/workoutChanges";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({ colors: {} }),
  radii: { lg: 12 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return { ThemedText: (props: any) => <Text {...props} /> };
});
jest.mock("@/components/ui/AppIcon", () => ({ AppIcon: () => null }));
jest.mock("react-native-paper", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    Portal: ({ children }: any) => children,
    Modal: ({ visible, children }: any) =>
      visible ? <View>{children}</View> : null,
    Button: ({ children, onPress, disabled }: any) => (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        onPress={() => !disabled && onPress()}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

const changes: WorkoutChange[] = [
  {
    id: "modify:id:1",
    kind: "modified",
    name: "Bench press",
    details: [{ kind: "setCount", from: 3, to: 4 }, { kind: "rest" }],
  },
  { id: "add:new:2", kind: "added", name: "Dips", supersetWith: "Bench press" },
  { id: "order", kind: "reordered" },
];

describe("describeChange", () => {
  it("names what happened to each exercise", () => {
    expect(describeChange(changes[0])).toEqual({
      title: "Bench press",
      subtitle: "3 → 4 sets, New rest times",
    });
    expect(describeChange(changes[1])).toEqual({
      title: "Dips",
      subtitle: "Added, in a superset with Bench press",
    });
    expect(
      describeChange({
        id: "swap:id:3",
        kind: "swapped",
        from: "Squat",
        to: "Leg press",
        details: [],
      }),
    ).toEqual({ title: "Squat → Leg press", subtitle: "Swapped" });
    expect(
      describeChange({ id: "unlink:g", kind: "unlinked", names: ["A", "B"] }),
    ).toEqual({ title: "A + B", subtitle: "No longer a superset" });
  });
});

describe("WorkoutChangesDialog", () => {
  it("starts with every change chosen and saves only the ones left ticked", () => {
    const onDone = jest.fn();
    render(
      <WorkoutChangesDialog visible isPlan changes={changes} onDone={onDone} />,
    );

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    boxes.forEach((box) => expect(box).toBeChecked());

    fireEvent.press(
      screen.getByLabelText("Dips, Added, in a superset with Bench press"),
    );
    expect(boxes[1]).not.toBeChecked();

    fireEvent.press(screen.getByText("Update plan"));
    expect(onDone).toHaveBeenCalledWith(["modify:id:1", "order"]);
  });

  it("keeps the workout as it was", () => {
    const onDone = jest.fn();
    render(
      <WorkoutChangesDialog
        visible
        isPlan={false}
        changes={changes}
        onDone={onDone}
      />,
    );
    fireEvent.press(screen.getByText("Keep workout as is"));
    expect(onDone).toHaveBeenCalledWith(null);
  });

  it("cannot save with nothing chosen", () => {
    const onDone = jest.fn();
    render(
      <WorkoutChangesDialog
        visible
        isPlan
        changes={[changes[2]]}
        onDone={onDone}
      />,
    );
    fireEvent.press(screen.getByRole("checkbox"));
    fireEvent.press(screen.getByText("Update plan"));
    expect(onDone).not.toHaveBeenCalled();
  });
});

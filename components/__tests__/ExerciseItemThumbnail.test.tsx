import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import ExerciseItem from "../ExerciseItem";
import type { Exercise } from "@/utils/database";

jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray, ...v: unknown[]) => String.raw({ raw: s }, ...v),
  msg: (s: TemplateStringsArray, ...v: unknown[]) =>
    String.raw({ raw: s }, ...v),
}));
jest.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (descriptor: unknown) => descriptor }),
}));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: any) => <View {...props} /> };
});

jest.mock("@/components/ui/AppBottomSheet", () => ({
  AppBottomSheet: () => null,
}));

const exercise = (imageUri: string | null) =>
  ({
    exercise_id: 3,
    name: "My curl",
    body_part: "upper arms",
    equipment: "dumbbell",
    image: null,
    image_uri: imageUri,
  }) as unknown as Exercise;

const renderItem = (item: Exercise) =>
  render(
    <ExerciseItem
      item={item}
      selected={false}
      onSelect={jest.fn()}
      onPress={jest.fn()}
    />,
  );

// The source as text, so assertions compare strings rather than objects.
const shownSource = (view: ReturnType<typeof renderItem>) =>
  JSON.stringify(view.getByTestId("exercise-thumbnail").props.source);

describe("ExerciseItem thumbnail", () => {
  it("shows the image file", () => {
    const view = renderItem(exercise("file:///doc/photo.jpg"));

    expect(shownSource(view)).toBe('{"uri":"file:///doc/photo.jpg"}');
  });

  it("shows the placeholder when there is no image", () => {
    const view = renderItem(exercise(null));

    expect(shownSource(view)).not.toContain("uri");
  });

  // A custom exercise photo is not part of a backup, so after a restore the
  // uri can point at a file that no longer exists.
  it("falls back to the placeholder when the file cannot be loaded", () => {
    const withoutImage = renderItem(exercise(null));
    const placeholder = shownSource(withoutImage);
    withoutImage.unmount();
    const view = renderItem(exercise("file:///doc/photo.jpg"));

    fireEvent(view.getByTestId("exercise-thumbnail"), "error", {
      error: "File not found",
    });

    expect(shownSource(view)).toBe(placeholder);
  });

  it("tries again when the exercise gets a different image", () => {
    const view = renderItem(exercise("file:///doc/photo.jpg"));
    fireEvent(view.getByTestId("exercise-thumbnail"), "error", {
      error: "File not found",
    });

    view.rerender(
      <ExerciseItem
        item={exercise("file:///doc/new-photo.jpg")}
        selected={false}
        onSelect={jest.fn()}
        onPress={jest.fn()}
      />,
    );

    expect(shownSource(view)).toBe('{"uri":"file:///doc/new-photo.jpg"}');
  });
});

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import WorkoutPickerModal from "../WorkoutPickerModal";
import { useAllPlansQuery } from "@/hooks/useAllPlansQuery";
import { useStandaloneWorkoutsQuery } from "@/hooks/useStandaloneWorkoutsQuery";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useActiveWorkoutStore } from "@/store/activeWorkoutStore";
import { router } from "expo-router";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      card: "#fff",
      contentPrimary: "#000",
      contentSecondary: "#888",
      accent: "#f00",
      modalBackdrop: "#0008",
    },
  }),
  radii: { sm: 4, md: 8, lg: 12 },
}));
jest.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
  };
});
jest.mock("react-native-paper", () => {
  const { View } = require("react-native");
  return {
    Portal: ({ children }: any) => children,
    Modal: ({ visible, children }: any) =>
      visible ? <View>{children}</View> : null,
    ActivityIndicator: () => {
      const { View: RNView } = require("react-native");
      return <RNView testID="loading-indicator" />;
    },
  };
});
jest.mock("@/components/StandaloneWorkoutListItem", () => ({
  __esModule: true,
  default: ({ workout, onPress, onStart }: any) => {
    const { Text, TouchableOpacity, View } = require("react-native");
    return (
      <View>
        <TouchableOpacity
          onPress={onPress}
          testID={`workout-item-${workout.id}`}
        >
          <Text>{workout.name}</Text>
        </TouchableOpacity>
        {onStart && (
          <TouchableOpacity
            onPress={onStart}
            testID={`workout-start-${workout.id}`}
          />
        )}
      </View>
    );
  },
}));
jest.mock("@/hooks/useAllPlansQuery", () => ({
  useAllPlansQuery: jest.fn(),
}));
jest.mock("@/hooks/useStandaloneWorkoutsQuery", () => ({
  useStandaloneWorkoutsQuery: jest.fn(),
}));
jest.mock("@/hooks/useSettingsQuery", () => ({
  useSettingsQuery: jest.fn(),
}));
jest.mock("@/utils/startWorkout", () => ({
  confirmStartWorkout: jest.fn((_setLoading: any, onStart: () => void) =>
    onStart(),
  ),
}));
jest.mock("@/store/activeWorkoutStore", () => ({
  useActiveWorkoutStore: { getState: jest.fn() },
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

const planWorkout = { id: 10, name: "Push Day", exercises: [] };
const standaloneWorkout = { id: 20, name: "Quick Legs", exercises: [] };

const baseProps = {
  visible: true,
  onDismiss: jest.fn(),
  setIsStartingWorkout: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (useAllPlansQuery as jest.Mock).mockReturnValue({
    data: {
      userPlans: [{ id: 1, name: "My Plan", workouts: [planWorkout] }],
      appPlans: [],
    },
    isLoading: false,
  });
  (useStandaloneWorkoutsQuery as jest.Mock).mockReturnValue({
    data: [standaloneWorkout],
    isLoading: false,
  });
  (useSettingsQuery as jest.Mock).mockReturnValue({
    data: { countUnilateralDouble: "false" },
  });
  (useActiveWorkoutStore.getState as jest.Mock).mockReturnValue({
    setWorkout: jest.fn(),
  });
});

describe("WorkoutPickerModal", () => {
  it("renders plan and standalone sections with workout names", () => {
    const { getByText } = render(<WorkoutPickerModal {...baseProps} />);
    expect(getByText("My Plan")).toBeTruthy();
    expect(getByText("Push Day")).toBeTruthy();
    expect(getByText("Standalone Workouts")).toBeTruthy();
    expect(getByText("Quick Legs")).toBeTruthy();
  });

  it("filters out non-matching workouts and their empty sections", () => {
    const { getByPlaceholderText, queryByText, getByText } = render(
      <WorkoutPickerModal {...baseProps} />,
    );
    fireEvent.changeText(getByPlaceholderText("Search"), "legs");
    expect(queryByText("Push Day")).toBeNull();
    expect(queryByText("My Plan")).toBeNull();
    expect(getByText("Quick Legs")).toBeTruthy();
  });

  it("shows empty state when search matches nothing", () => {
    const { getByPlaceholderText, getByText } = render(
      <WorkoutPickerModal {...baseProps} />,
    );
    fireEvent.changeText(getByPlaceholderText("Search"), "nonexistent");
    expect(getByText("No workouts found")).toBeTruthy();
  });

  it("starts a plan workout: dismisses and calls setWorkout with the plan id", () => {
    const setWorkout = jest.fn();
    (useActiveWorkoutStore.getState as jest.Mock).mockReturnValue({
      setWorkout,
    });
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <WorkoutPickerModal {...baseProps} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByTestId("workout-start-10"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(setWorkout).toHaveBeenCalledWith(planWorkout, 1, 10, "Push Day");
  });

  it("starts a standalone workout: calls setWorkout with a null plan id", () => {
    const setWorkout = jest.fn();
    (useActiveWorkoutStore.getState as jest.Mock).mockReturnValue({
      setWorkout,
    });
    const { getByTestId } = render(<WorkoutPickerModal {...baseProps} />);
    fireEvent.press(getByTestId("workout-start-20"));
    expect(setWorkout).toHaveBeenCalledWith(
      standaloneWorkout,
      null,
      20,
      "Quick Legs",
    );
  });

  it("shows a loading indicator while data is loading instead of the list", () => {
    (useAllPlansQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    const { queryByText, getByTestId } = render(
      <WorkoutPickerModal {...baseProps} />,
    );
    expect(queryByText("Push Day")).toBeNull();
    expect(getByTestId("loading-indicator")).toBeTruthy();
  });

  it("shows 'No workouts yet' when there are no plans or standalone workouts at all", () => {
    (useAllPlansQuery as jest.Mock).mockReturnValue({
      data: { userPlans: [], appPlans: [] },
      isLoading: false,
    });
    (useStandaloneWorkoutsQuery as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
    });
    const { getByText } = render(<WorkoutPickerModal {...baseProps} />);
    expect(getByText("No workouts yet")).toBeTruthy();
  });

  it("views a plan workout: dismisses and pushes workout-details with the plan index", () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <WorkoutPickerModal {...baseProps} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByTestId("workout-item-10"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/workout-details",
      params: { planId: "1", workoutIndex: "0" },
    });
  });

  it("views a searched plan workout using its original index, not the filtered one", () => {
    (useAllPlansQuery as jest.Mock).mockReturnValue({
      data: {
        userPlans: [
          {
            id: 1,
            name: "My Plan",
            workouts: [{ id: 9, name: "Leg Day", exercises: [] }, planWorkout],
          },
        ],
        appPlans: [],
      },
      isLoading: false,
    });
    const { getByPlaceholderText, getByTestId } = render(
      <WorkoutPickerModal {...baseProps} />,
    );
    fireEvent.changeText(getByPlaceholderText("Search"), "push");
    fireEvent.press(getByTestId("workout-item-10"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/workout-details",
      params: { planId: "1", workoutIndex: "1" },
    });
  });

  it("views a standalone workout: pushes the non-tab standalone route", () => {
    const { getByTestId } = render(<WorkoutPickerModal {...baseProps} />);
    fireEvent.press(getByTestId("workout-item-20"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/standalone-workout",
      params: { workoutId: "20" },
    });
  });

  it("renders nothing when visible is false", () => {
    const { queryByText } = render(
      <WorkoutPickerModal {...baseProps} visible={false} />,
    );
    expect(queryByText("Push Day")).toBeNull();
  });
});

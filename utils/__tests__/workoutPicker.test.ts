import { buildWorkoutPickerSections } from "../workoutPicker";
import { Plan } from "@/hooks/useAllPlansQuery";
import { Workout } from "@/store/workoutStore";

const pushDay: Workout = { id: 1, name: "Push Day", exercises: [] };
const legDay: Workout = { id: 2, name: "Leg Day", exercises: [] };
const quickLegs: Workout = { id: 10, name: "Quick Legs", exercises: [] };
const armBlast: Workout = { id: 11, name: "Arm Blast", exercises: [] };

const userPlans: Plan[] = [
  {
    id: 100,
    name: "My Plan",
    image_url: "",
    is_active: 1,
    workouts: [pushDay, legDay],
  },
];

const standaloneWorkouts: Workout[] = [quickLegs, armBlast];

describe("buildWorkoutPickerSections", () => {
  it("returns all plan sections and standalone workouts when query is empty", () => {
    const result = buildWorkoutPickerSections(
      userPlans,
      standaloneWorkouts,
      "",
    );

    expect(result.planSections).toEqual([
      { planId: 100, planName: "My Plan", workouts: [pushDay, legDay] },
    ]);
    expect(result.standaloneWorkouts).toEqual([quickLegs, armBlast]);
  });

  it("filters workouts by case-insensitive substring match on name", () => {
    const result = buildWorkoutPickerSections(
      userPlans,
      standaloneWorkouts,
      "leg",
    );

    expect(result.planSections).toEqual([
      { planId: 100, planName: "My Plan", workouts: [legDay] },
    ]);
    expect(result.standaloneWorkouts).toEqual([quickLegs]);
  });

  it("omits a plan section entirely when none of its workouts match", () => {
    const result = buildWorkoutPickerSections(
      userPlans,
      standaloneWorkouts,
      "arm",
    );

    expect(result.planSections).toEqual([]);
    expect(result.standaloneWorkouts).toEqual([armBlast]);
  });

  it("returns empty sections when nothing matches", () => {
    const result = buildWorkoutPickerSections(
      userPlans,
      standaloneWorkouts,
      "nonexistent",
    );

    expect(result.planSections).toEqual([]);
    expect(result.standaloneWorkouts).toEqual([]);
  });

  it("treats surrounding whitespace in the query as insignificant", () => {
    const result = buildWorkoutPickerSections(
      userPlans,
      standaloneWorkouts,
      "  push  ",
    );

    expect(result.planSections).toEqual([
      { planId: 100, planName: "My Plan", workouts: [pushDay] },
    ]);
  });

  it("handles empty plans and standalone lists", () => {
    const result = buildWorkoutPickerSections([], [], "");

    expect(result).toEqual({ planSections: [], standaloneWorkouts: [] });
  });
});

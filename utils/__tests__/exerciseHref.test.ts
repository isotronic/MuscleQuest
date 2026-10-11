import { exerciseHref } from "../exerciseHref";

describe("exerciseHref", () => {
  it("links to the exercise screen, with a tab only when given", () => {
    expect(exerciseHref(7)).toEqual({
      pathname: "/(app)/exercise-info",
      params: { exercise_id: "7" },
    });
    expect(exerciseHref(7, "progress")).toEqual({
      pathname: "/(app)/exercise-info",
      params: { exercise_id: "7", tab: "progress" },
    });
  });
});

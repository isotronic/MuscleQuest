import { adjacentGroup, exerciseGroups } from "../listLogging";

const ex = (supersetGroupId?: string) => ({ supersetGroupId });

describe("exerciseGroups", () => {
  it("keeps a superset's two exercises together where the first appears", () => {
    expect(exerciseGroups([ex(), ex("s"), ex(), ex("s")])).toEqual([
      [0],
      [1, 3],
      [2],
    ]);
  });
});

describe("adjacentGroup", () => {
  const exercises = [ex(), ex("s"), ex("s"), ex()];

  it("steps over a superset as one", () => {
    expect(adjacentGroup(exercises, 0, 1)).toEqual([1, 2]);
    expect(adjacentGroup(exercises, 2, 1)).toEqual([3]);
    expect(adjacentGroup(exercises, 3, -1)).toEqual([1, 2]);
  });

  it("has nothing past either end", () => {
    expect(adjacentGroup(exercises, 0, -1)).toBeNull();
    expect(adjacentGroup(exercises, 3, 1)).toBeNull();
  });
});

import { useQuery } from "@tanstack/react-query";
import { useDeloadWeekQuery } from "../useDeloadWeekQuery";

jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("@/utils/database", () => ({ getDeloadWeek: jest.fn() }));

describe("useDeloadWeekQuery", () => {
  it("answers for the week of a given day, not only this week", () => {
    (useQuery as jest.Mock).mockReturnValue({ data: "2026-W10" });

    const { isDeloadWeekOf } = useDeloadWeekQuery(1);

    // Sunday night of the deload week, saved on the Monday after.
    expect(isDeloadWeekOf(new Date(2026, 2, 8, 23, 30))).toBe(true);
    expect(isDeloadWeekOf(new Date(2026, 2, 9, 9, 0))).toBe(false);
  });

  it("is never a deload week without a stored one", () => {
    (useQuery as jest.Mock).mockReturnValue({ data: null });

    expect(useDeloadWeekQuery(1).isDeloadWeekOf(new Date())).toBe(false);
  });
});

import { usePlanScheduleQuery } from "../usePlanScheduleQuery";
import { fetchPlanSchedule } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  fetchPlanSchedule: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

describe("usePlanScheduleQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls useQuery with queryKey ['planSchedule', planId]", () => {
    usePlanScheduleQuery(5);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["planSchedule", 5],
      }),
    );
  });

  it("is disabled when planId is null", () => {
    usePlanScheduleQuery(null);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it("is enabled when planId is not null", () => {
    usePlanScheduleQuery(1);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      }),
    );
  });

  it("queryFn calls fetchPlanSchedule with planId", async () => {
    const entries = [{ day_of_week: 0, workout_id: 10 }];
    (fetchPlanSchedule as jest.Mock).mockResolvedValue(entries);

    usePlanScheduleQuery(3);

    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(fetchPlanSchedule).toHaveBeenCalledWith(3);
    expect(result).toEqual(entries);
  });
});

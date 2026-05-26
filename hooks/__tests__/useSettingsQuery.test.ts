import { useSettingsQuery } from "../useSettingsQuery";
import { fetchSettings } from "@/utils/database";
import { useQuery } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  fetchSettings: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));

describe("useSettingsQuery", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls useQuery with queryKey ['settings'] and queryFn = fetchSettings", () => {
    useSettingsQuery();

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["settings"],
        queryFn: fetchSettings,
      }),
    );
  });

  it("queryFn calls fetchSettings", async () => {
    const mockSettings = { weightUnit: "kg", weeklyGoal: "3" };
    (fetchSettings as jest.Mock).mockResolvedValue(mockSettings);

    useSettingsQuery();

    const { queryFn } = (useQuery as jest.Mock).mock.calls[0][0];
    const result = await queryFn();

    expect(fetchSettings).toHaveBeenCalled();
    expect(result).toEqual(mockSettings);
  });
});

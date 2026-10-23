import { renderHook } from "@testing-library/react-native";
import { useBottomScrollPadding } from "../useBottomScrollPadding";

const mockBottom = jest.fn(() => 48);
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 0,
    bottom: mockBottom(),
    left: 0,
    right: 0,
  }),
}));

describe("useBottomScrollPadding", () => {
  it("adds the bottom inset to the base padding", () => {
    const { result } = renderHook(() => useBottomScrollPadding(32));
    expect(result.current).toBe(80);
  });

  it("returns the base padding when there is no bottom inset", () => {
    mockBottom.mockReturnValue(0);
    const { result } = renderHook(() => useBottomScrollPadding(32));
    expect(result.current).toBe(32);
  });
});

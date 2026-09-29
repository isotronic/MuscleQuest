import React from "react";
import { render } from "@testing-library/react-native";
import { OfflineBanner } from "../OfflineBanner";
import { useIsOnline } from "@/hooks/useIsOnline";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/hooks/useIsOnline", () => ({ useIsOnline: jest.fn() }));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: { card: "#eee", contentSecondary: "#888" },
  }),
  radii: { sm: 4, md: 8, lg: 12, xl: 20, full: 999 },
}));
jest.mock("@/components/ui", () => {
  const { Text } = require("react-native");
  return {
    AppText: ({ children, ...props }: any) => (
      <Text {...props}>{children}</Text>
    ),
    AppIcon: () => null,
  };
});

describe("OfflineBanner", () => {
  it("renders nothing while online", () => {
    (useIsOnline as jest.Mock).mockReturnValue(true);
    const { toJSON } = render(<OfflineBanner />);
    expect(toJSON()).toBeNull();
  });

  it("explains what still works while offline", () => {
    (useIsOnline as jest.Mock).mockReturnValue(false);
    const { getByText } = render(<OfflineBanner />);
    expect(
      getByText(
        "You're offline. Friends and shared content will load when you reconnect. Training and logging still work.",
      ),
    ).toBeTruthy();
  });

  it("shows a custom message when given one", () => {
    (useIsOnline as jest.Mock).mockReturnValue(false);
    const { getByText } = render(<OfflineBanner message="Custom text" />);
    expect(getByText("Custom text")).toBeTruthy();
  });
});

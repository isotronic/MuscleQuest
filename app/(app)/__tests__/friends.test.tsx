import React from "react";
import { render, act } from "@testing-library/react-native";
import FriendsScreen from "../friends";
import { useSocialRefreshStore } from "@/store/socialRefreshStore";

jest.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@lingui/core/macro", () => ({
  t: (s: TemplateStringsArray) => s[0],
}));
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("react-native-paper", () => {
  const { View } = require("react-native");
  const Stub = (props: any) => <View {...props} />;
  return {
    Button: Stub,
    Avatar: { Image: Stub, Text: Stub },
    IconButton: Stub,
    Modal: () => null,
    Portal: ({ children }: any) => children,
  };
});
jest.mock("@/components/PrivacySettings", () => ({
  PrivacySettings: () => null,
}));
jest.mock("@/components/OfflineBanner", () => ({ OfflineBanner: () => null }));
jest.mock("@/components/friends/FriendListItem", () => {
  const { Text } = require("react-native");
  return {
    FriendListItem: ({ friend }: any) => <Text>{friend.displayName}</Text>,
  };
});
jest.mock("@/components/friends/FriendRequestItem", () => ({
  FriendRequestItem: () => null,
}));
jest.mock("@/hooks/useSendFriendRequestMutation", () => ({
  useSendFriendRequestMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/utils/friends", () => ({ searchUserByEmail: jest.fn() }));
jest.mock("@/theme", () => ({
  useAppTheme: () => ({
    colors: {
      background: "#000",
      accent: "#0f0",
      contentPrimary: "#fff",
      contentSecondary: "#aaa",
    },
    borders: { divider: "#222" },
  }),
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
jest.mock("@/context/AuthProvider", () => {
  const React = jest.requireActual("react");
  return {
    AuthContext: React.createContext({ uid: "me" }),
    AuthLoadingContext: React.createContext(false),
  };
});
jest.mock("@/store/socialStore", () => ({
  useSocialStore: () => ({
    friends: [],
    pendingRequests: [],
    sentRequests: [],
  }),
}));

describe("FriendsScreen pull-to-refresh", () => {
  it("asks the social listeners to resubscribe, even with no friends yet", () => {
    const before = useSocialRefreshStore.getState().generation;
    const { getByTestId } = render(<FriendsScreen />);

    const refreshControl = getByTestId("friends-list").props.refreshControl;
    act(() => {
      refreshControl.props.onRefresh();
    });

    expect(useSocialRefreshStore.getState().generation).toBe(before + 1);
  });
});

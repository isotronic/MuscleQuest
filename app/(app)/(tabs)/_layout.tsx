import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMenu } from "@/components/AppMenu";
import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { useMenuStore } from "@/store/menuStore";
import { useSocialStore } from "@/store/socialStore";
import { t } from "@lingui/core/macro";
import { useAppTheme } from "@/theme";

export default function TabLayout() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const openMenu = useMenuStore((s) => s.openMenu);
  const { pendingRequests } = useSocialStore();

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: colors.background,
            height: 50 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarActiveTintColor: colors.accent,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.contentPrimary,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t`MuscleQuest`,
            tabBarLabel: t`Home`,
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? "home" : "home-outline"}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="(plans)"
          options={{
            headerShown: false,
            title: t`Plans`,
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? "barbell" : "barbell-outline"}
                color={color}
              />
            ),
          }}
        />
        {/* <Tabs.Screen
          name="meso"
          options={{
            title: "Meso Cycle",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? "calendar-number" : "calendar-number-outline"}
                color={color}
              />
            ),
          }}
        /> */}
        <Tabs.Screen
          name="(stats)"
          options={{
            headerShown: false,
            title: t`Stats`,
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? "stats-chart" : "stats-chart-outline"}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="menu"
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              openMenu();
            },
          }}
          options={{
            title: t`More`,
            tabBarBadge:
              pendingRequests.length > 0 ? pendingRequests.length : undefined,
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={
                  focused
                    ? "ellipsis-horizontal"
                    : "ellipsis-horizontal-outline"
                }
                color={color}
              />
            ),
          }}
        />
      </Tabs>
      <AppMenu />
    </>
  );
}

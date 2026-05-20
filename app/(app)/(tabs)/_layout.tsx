import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMenu } from "@/components/AppMenu";
import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { Colors } from "@/constants/Colors";
import { useMenuStore } from "@/store/menuStore";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const openMenu = useMenuStore((s) => s.openMenu);

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: Colors.dark.background,
            height: 50 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarActiveTintColor: Colors.dark.tint,
          headerStyle: {
            backgroundColor: Colors.dark.background,
          },
          headerTintColor: Colors.dark.text,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "MuscleQuest",
            tabBarLabel: "Home",
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
            title: "Plans",
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
            title: "Stats",
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
            title: "More",
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

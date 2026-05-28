import type { ComponentProps } from "react";
import { AppIcon } from "@/components/ui";

type TabBarIconProps = {
  name: Extract<ComponentProps<typeof AppIcon>, { set: "ion" }>["name"];
  color: string;
  size?: number;
};

export function TabBarIcon({ name, color, size = 28 }: TabBarIconProps) {
  return (
    <AppIcon
      set="ion"
      name={name}
      size={size}
      color={color}
      style={{ marginBottom: -3 }}
    />
  );
}

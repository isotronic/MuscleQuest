import { useAppTheme } from "@/theme";

export function useChartTheme() {
  const { charts } = useAppTheme();
  return charts;
}

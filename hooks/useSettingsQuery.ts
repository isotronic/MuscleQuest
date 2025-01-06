import { useQuery } from "@tanstack/react-query";
import { fetchSettings } from "@/utils/database";

export const useSettingsQuery = () => {
  return useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

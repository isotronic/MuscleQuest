import { useQuery } from "@tanstack/react-query";
import { fetchSettings } from "@/utils/database";

export const useSettingsQuery = () => {
  return useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });
};

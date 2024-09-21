import { useMutation } from "@tanstack/react-query";
import { updateSettings } from "@/utils/database";
import { useQueryClient } from "@tanstack/react-query";

export const useUpdateSettingsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newSetting: { key: string; value: string }) =>
      updateSettings(newSetting.key, newSetting.value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => {
      console.error("Failed to update settings:", error);
    },
  });
};

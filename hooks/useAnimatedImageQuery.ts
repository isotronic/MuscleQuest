import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import storage from "@react-native-firebase/storage";

const fetchAnimatedImageUrl = async (
  animatedUrlPath: string,
): Promise<string> => {
  try {
    return await storage().ref(animatedUrlPath).getDownloadURL();
  } catch (error) {
    console.error("Failed to load animated image:", error);
    throw error;
  }
};

export const useAnimatedImageQuery = (animatedUrlPath?: string) => {
  return useQuery<string, Error>({
    queryKey: ["animatedImage", animatedUrlPath],
    queryFn: () => fetchAnimatedImageUrl(animatedUrlPath!),
    enabled: !!animatedUrlPath,
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 60 * 24, // 24 hours
  } as UseQueryOptions<string, Error>);
};

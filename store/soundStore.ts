import { create } from "zustand";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { Vibration } from "react-native";
import { reportError } from "@/utils/utility";

type SoundStore = {
  sound: Audio.Sound | null;
  isLoaded: boolean;

  loadSound: () => Promise<Audio.Sound | null>;
  unloadSound: () => Promise<void>;
  playSound: () => Promise<void>;
  triggerVibration: (pattern?: number | number[]) => void;
};

export const useSoundStore = create<SoundStore>((set, get) => ({
  sound: null,
  isLoaded: false,

  // 1) Load or reload the sound
  loadSound: async () => {
    try {
      const currentSound = get().sound;
      if (currentSound) {
        await currentSound.unloadAsync();
        set({ sound: null, isLoaded: false });
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/boxing_bell.mp3"),
        { shouldPlay: false },
      );

      set({ sound: newSound, isLoaded: true });
      return newSound;
    } catch (error) {
      reportError(error);
      set({ sound: null, isLoaded: false });
      return null;
    }
  },

  // 2) Unload any existing sound
  unloadSound: async () => {
    const currentSound = get().sound;
    if (currentSound) {
      try {
        await currentSound.unloadAsync();
      } catch (error) {
        reportError(error);
      }
    }
    set({ sound: null, isLoaded: false });
  },

  // 3) Play the bell (load if needed, then play, wait for finish, unload)
  playSound: async () => {
    let localSound = get().sound;

    // If no sound loaded, load a new one
    if (!localSound) {
      localSound = await get().loadSound();
    }
    if (!localSound) {
      return;
    }

    try {
      await localSound.setPositionAsync(0);
      await localSound.playAsync();

      // Optional: If you have extremely short clips, you can add a tiny delay:
      // await new Promise((resolve) => setTimeout(resolve, 100));

      await new Promise<void>((resolve) => {
        localSound.setOnPlaybackStatusUpdate((status) => {
          if ("didJustFinish" in status && status.didJustFinish) {
            resolve();
          }
        });
      });

      await localSound.unloadAsync();
      set({ sound: null, isLoaded: false });
    } catch (error) {
      reportError(error);

      const reloaded = await get().loadSound();
      if (reloaded) {
        await reloaded.playAsync();
      }
    }
  },

  // 4) Trigger vibration
  triggerVibration: (pattern = [0, 400, 100, 400, 100, 600]) => {
    Vibration.vibrate(pattern);
  },
}));

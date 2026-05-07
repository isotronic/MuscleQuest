import { create } from "zustand";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import { Vibration } from "react-native";
import { reportError } from "@/utils/utility";

type SoundStore = {
  sound: AudioPlayer | null;
  isLoaded: boolean;

  loadSound: () => Promise<AudioPlayer | null>;
  unloadSound: () => Promise<void>;
  playSound: () => Promise<void>;
  triggerVibration: (pattern?: number | number[]) => void;
};

export const useSoundStore = create<SoundStore>((set, get) => ({
  sound: null,
  isLoaded: false,

  loadSound: async () => {
    try {
      const currentSound = get().sound;
      if (currentSound) {
        currentSound.remove();
        set({ sound: null, isLoaded: false });
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "duckOthers",
      });

      const newSound = createAudioPlayer(
        require("@/assets/sounds/boxing_bell.mp3"),
      );

      set({ sound: newSound, isLoaded: true });
      return newSound;
    } catch (error) {
      reportError(error);
      set({ sound: null, isLoaded: false });
      return null;
    }
  },

  unloadSound: async () => {
    const currentSound = get().sound;
    if (currentSound) {
      try {
        currentSound.remove();
      } catch (error) {
        reportError(error);
      }
    }
    set({ sound: null, isLoaded: false });
  },

  playSound: async () => {
    let localSound = get().sound;

    if (!localSound) {
      localSound = await get().loadSound();
    }
    if (!localSound) {
      return;
    }

    const playToCompletion = async (player: AudioPlayer) => {
      await player.seekTo(0);
      player.play();

      const finishPromise = new Promise<void>((resolve) => {
        const subscription = player.addListener(
          "playbackStatusUpdate",
          (status) => {
            if (status.didJustFinish) {
              subscription.remove();
              resolve();
            }
          },
        );
      });
      const timeoutPromise = new Promise<void>((resolve) =>
        setTimeout(resolve, 5000),
      );
      await Promise.race([finishPromise, timeoutPromise]);

      player.remove();
      set({ sound: null, isLoaded: false });
    };

    try {
      await playToCompletion(localSound);
    } catch (error) {
      reportError(error);

      const reloaded = await get().loadSound();
      if (reloaded) {
        await playToCompletion(reloaded);
      }
    }
  },

  triggerVibration: (pattern = [0, 400, 100, 400, 100, 600]) => {
    Vibration.vibrate(pattern);
  },
}));

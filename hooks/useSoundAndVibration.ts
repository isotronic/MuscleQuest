import { useEffect, useState } from "react";
import { Vibration } from "react-native";
import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess } from "expo-av";

export const useSoundAndVibration = (soundFile: any) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(soundFile);
        setSound(sound);
      } catch (error) {
        console.error("Failed to load sound:", error);
      }
    };

    loadSound();

    return () => {
      if (sound) {
        sound.unloadAsync(); // Unload sound when the component unmounts
      }
    };
  }, [soundFile]);

  const playSound = async () => {
    if (sound) {
      try {
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate(async (status: AVPlaybackStatus) => {
          if (
            status.isLoaded &&
            !(status as AVPlaybackStatusSuccess).isBuffering
          ) {
            const playbackStatus = status as AVPlaybackStatusSuccess;

            if (playbackStatus.didJustFinish) {
              // Once the sound finishes, unload it
              await sound.unloadAsync();
            }
          }
        });
      } catch (error) {
        console.error("Error playing sound:", error);
      }
    }
  };

  const triggerVibration = (
    pattern: number | number[] = [0, 200, 100, 300, 100, 400],
  ) => {
    Vibration.vibrate(pattern);
  };

  const playSoundAndVibrate = (
    vibrationPattern: number | number[] = [0, 200, 100, 300, 100, 400],
  ) => {
    playSound();
    triggerVibration(vibrationPattern);
  };

  return {
    playSound,
    triggerVibration,
    playSoundAndVibrate,
  };
};

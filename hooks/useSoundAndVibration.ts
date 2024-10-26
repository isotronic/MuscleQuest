import { useEffect, useState } from "react";
import { Vibration } from "react-native";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

export const useSoundAndVibration = () => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    const loadSound = async () => {
      try {
        Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          require("@/assets/sounds/boxing-bell.mp3"),
        );
        setSound(sound);
      } catch (error) {
        console.error("Failed to load sound:", error);
      }
    };

    loadSound();

    return () => {};
  }, []);

  const playSound = async () => {
    if (sound) {
      try {
        await sound.playAsync();
      } catch (error) {
        console.error("Error playing sound:", error);
      }
    }
  };

  const unloadSound = async () => {
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error("Failed to unload sound:", error);
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
    unloadSound,
    triggerVibration,
    playSoundAndVibrate,
  };
};

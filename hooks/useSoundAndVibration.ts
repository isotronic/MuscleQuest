import { useEffect, useState, useRef } from "react";
import { Vibration } from "react-native";
import { Audio } from "expo-av";

export const useSoundAndVibration = (soundFile: any) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const hasLoadedSound = useRef(false);

  useEffect(() => {
    const setAudioMode = async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });
    };

    const loadSound = async () => {
      try {
        if (!hasLoadedSound.current) {
          await setAudioMode();
          const { sound } = await Audio.Sound.createAsync(soundFile);
          setSound(sound);
          hasLoadedSound.current = true;
        }
      } catch (error) {
        console.error("Failed to load sound:", error);
      }
    };

    requestAnimationFrame(() => {
      loadSound();
    });
  }, [soundFile]);

  useEffect(() => {
    return () => {
      if (sound) {
        requestAnimationFrame(() => {
          sound.unloadAsync();
        });
      }
    };
  }, [sound]);

  const playSound = async () => {
    if (sound) {
      try {
        await sound.playAsync();
      } catch (error) {
        console.error("Error playing sound:", error);
      }
    }
  };

  const triggerVibration = (
    pattern: number | number[] = [0, 200, 100, 200, 100, 400],
  ) => {
    Vibration.vibrate(pattern);
  };

  const playSoundAndVibrate = (
    vibrationPattern: number | number[] = [0, 200, 100, 200, 100, 400],
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

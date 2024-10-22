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
        playsInSilentModeIOS: true, // Ensures sound plays even in silent mode on iOS
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });
    };

    const loadSound = async () => {
      try {
        if (!hasLoadedSound.current) {
          await setAudioMode(); // Set audio mode before loading sound
          const { sound } = await Audio.Sound.createAsync(soundFile);
          setSound(sound);
          hasLoadedSound.current = true; // Mark as loaded
          console.log("Sound loaded");
        }
      } catch (error) {
        console.error("Failed to load sound:", error);
      }
    };

    requestAnimationFrame(() => {
      loadSound(); // Ensure the sound is loaded on the main thread
    });
  }, [soundFile]);

  useEffect(() => {
    return () => {
      if (sound) {
        requestAnimationFrame(() => {
          sound.unloadAsync(); // Ensure unloading happens on the main thread
        });
      }
    };
  }, [sound]);

  const playSound = async () => {
    if (sound) {
      try {
        const status = await sound.playAsync();
        console.log("Sound status:", status);
      } catch (error) {
        console.error("Error playing sound:", error);
      }
    }
  };

  const triggerVibration = (pattern: number | number[] = 500) => {
    Vibration.vibrate(pattern);
  };

  const playSoundAndVibrate = (vibrationPattern: number | number[] = 500) => {
    playSound();
    triggerVibration(vibrationPattern);
  };

  return {
    playSound,
    triggerVibration,
    playSoundAndVibrate,
  };
};

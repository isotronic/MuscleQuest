import { useEffect, useState, useCallback, useRef } from "react";
import { Vibration, AppState } from "react-native";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import Bugsnag from "@bugsnag/expo";

export const useSoundAndVibration = () => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const isMounted = useRef(true);
  const lastPlayAttempt = useRef<Date | null>(null);

  const loadSound = useCallback(async () => {
    if (!isMounted.current) return;

    try {
      // First ensure any existing sound is unloaded
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsLoaded(false);
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        staysActiveInBackground: true,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/boxing_bell.mp3"),
        { shouldPlay: false },
      );

      if (isMounted.current) {
        setSound(newSound);
        setIsLoaded(true);
      } else {
        await newSound.unloadAsync();
      }
    } catch (error) {
      console.error("Failed to load sound:", error);
      if (error instanceof Error) {
        Bugsnag.notify(error);
      } else {
        Bugsnag.notify(new Error(String(error)));
      }
      if (isMounted.current) {
        setIsLoaded(false);
      }
    }
  }, [sound]);

  const playSound = useCallback(async () => {
    if (!isLoaded || !sound) {
      await loadSound();
      // Return early if sound failed to load
      if (!sound || !isLoaded) return;
    }

    try {
      // Add timestamp for debugging
      lastPlayAttempt.current = new Date();

      const status = await sound.getStatusAsync();
      Bugsnag.leaveBreadcrumb("Sound status check", {
        isLoaded: status.isLoaded,
        timestamp: lastPlayAttempt.current.toISOString(),
      });

      if (status.isLoaded) {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      } else {
        // Sound became unloaded, try to reload
        await loadSound();
        if (sound) {
          await sound.playAsync();
        }
      }
    } catch (error) {
      console.error("Error playing sound:", error);
      if (error instanceof Error) {
        Bugsnag.notify(error);
      } else {
        Bugsnag.notify(new Error(String(error)));
      }
      // If playing fails, try one reload attempt
      try {
        await loadSound();
        if (sound) {
          await sound.playAsync();
        }
      } catch (retryError) {
        console.error("Retry failed:", retryError);
        if (retryError instanceof Error) {
          Bugsnag.notify(retryError);
        } else {
          Bugsnag.notify(new Error(String(retryError)));
        }
      }
    }
  }, [isLoaded, loadSound, sound]);

  const unloadSound = useCallback(async () => {
    if (sound) {
      try {
        await sound.unloadAsync();
        if (isMounted.current) {
          setSound(null);
          setIsLoaded(false);
        }
      } catch (error) {
        console.error("Failed to unload sound:", error);
        if (error instanceof Error) {
          Bugsnag.notify(error);
        } else {
          Bugsnag.notify(new Error(String(error)));
        }
      }
    }
  }, [sound]);

  useEffect(() => {
    loadSound();

    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: string) => {
        if (nextAppState === "active") {
          // Small delay to ensure Audio API is ready
          setTimeout(() => {
            loadSound();
          }, 100);
        }
      },
    );

    return () => {
      isMounted.current = false;
      subscription.remove();
      unloadSound();
    };
  }, [loadSound, unloadSound]);

  const triggerVibration = useCallback(
    (pattern: number | number[] = [0, 400, 100, 400, 100, 600]) => {
      Vibration.vibrate(pattern);
    },
    [],
  );

  const playSoundAndVibrate = useCallback(
    (vibrationPattern: number | number[] = [0, 400, 100, 400, 100, 600]) => {
      playSound();
      triggerVibration(vibrationPattern);
    },
    [playSound, triggerVibration],
  );

  return {
    playSound,
    unloadSound,
    triggerVibration,
    playSoundAndVibrate,
    isLoaded,
  };
};

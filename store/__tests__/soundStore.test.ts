import { act } from "@testing-library/react-native";
import { useSoundStore } from "../soundStore";

const mockPlay = jest.fn();
const mockSeekTo = jest.fn().mockResolvedValue(undefined);
const mockRemove = jest.fn();
const mockAddListener = jest.fn().mockReturnValue({ remove: jest.fn() });

const mockPlayer = {
  play: mockPlay,
  seekTo: mockSeekTo,
  remove: mockRemove,
  addListener: mockAddListener,
};

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => mockPlayer),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("react-native", () => ({
  Vibration: { vibrate: jest.fn() },
}));

jest.mock("@/utils/utility", () => ({
  reportError: jest.fn(),
}));

describe("useSoundStore", () => {
  beforeEach(() => {
    useSoundStore.setState({ sound: null, isLoaded: false });
    jest.clearAllMocks();
    mockPlayer.seekTo.mockResolvedValue(undefined);
    mockPlayer.addListener.mockReturnValue({ remove: jest.fn() });
  });

  it("initial state: sound is null and isLoaded is false", () => {
    const state = useSoundStore.getState();
    expect(state.sound).toBeNull();
    expect(state.isLoaded).toBe(false);
  });

  describe("triggerVibration", () => {
    it("calls Vibration.vibrate with default pattern", () => {
      const { Vibration } = require("react-native");

      act(() => {
        useSoundStore.getState().triggerVibration();
      });

      expect(Vibration.vibrate).toHaveBeenCalledWith([
        0, 400, 100, 400, 100, 600,
      ]);
    });

    it("calls Vibration.vibrate with custom pattern", () => {
      const { Vibration } = require("react-native");

      act(() => {
        useSoundStore.getState().triggerVibration([0, 200]);
      });

      expect(Vibration.vibrate).toHaveBeenCalledWith([0, 200]);
    });

    it("calls Vibration.vibrate with a single number pattern", () => {
      const { Vibration } = require("react-native");

      act(() => {
        useSoundStore.getState().triggerVibration(500);
      });

      expect(Vibration.vibrate).toHaveBeenCalledWith(500);
    });
  });

  describe("loadSound", () => {
    it("creates a new audio player and updates state", async () => {
      const { createAudioPlayer } = require("expo-audio");

      await act(async () => {
        await useSoundStore.getState().loadSound();
      });

      expect(createAudioPlayer).toHaveBeenCalled();
      const state = useSoundStore.getState();
      expect(state.isLoaded).toBe(true);
      expect(state.sound).toBe(mockPlayer);
    });

    it("removes existing sound before loading a new one", async () => {
      useSoundStore.setState({ sound: mockPlayer as any, isLoaded: true });

      await act(async () => {
        await useSoundStore.getState().loadSound();
      });

      expect(mockPlayer.remove).toHaveBeenCalled();
    });

    it("returns null and resets state on error", async () => {
      const { createAudioPlayer } = require("expo-audio");
      createAudioPlayer.mockImplementationOnce(() => {
        throw new Error("audio init failed");
      });

      let result: any;
      await act(async () => {
        result = await useSoundStore.getState().loadSound();
      });

      expect(result).toBeNull();
      expect(useSoundStore.getState().isLoaded).toBe(false);
    });
  });

  describe("unloadSound", () => {
    it("removes the current sound and resets state", async () => {
      useSoundStore.setState({ sound: mockPlayer as any, isLoaded: true });

      await act(async () => {
        await useSoundStore.getState().unloadSound();
      });

      expect(mockPlayer.remove).toHaveBeenCalled();
      expect(useSoundStore.getState().sound).toBeNull();
      expect(useSoundStore.getState().isLoaded).toBe(false);
    });

    it("does nothing when sound is null", async () => {
      await act(async () => {
        await useSoundStore.getState().unloadSound();
      });

      expect(mockPlayer.remove).not.toHaveBeenCalled();
    });
  });
});

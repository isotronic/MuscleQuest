import Bugsnag from "@bugsnag/expo";

// Report an error to Bugsnag
export function reportError(error: unknown): void {
  if (error instanceof Error) {
    Bugsnag.notify(error);
  } else {
    Bugsnag.notify(new Error(String(error)));
  }
}

// Convert a byte array to a base64 string
export const byteArrayToBase64 = (byteArray: any) => {
  const binaryString = Object.keys(byteArray)
    .map((key) => {
      return String.fromCharCode(byteArray[key]);
    })
    .join("");
  return btoa(binaryString);
};

// Format a time string in minutes and seconds
export const formatTimeInput = (value: string): string => {
  const numericValue = value.replace(/\D/g, ""); // Remove any non-digit characters
  const totalLength = numericValue.length;

  if (totalLength === 0) {
    return "0:00";
  }

  if (totalLength <= 2) {
    const seconds = parseInt(numericValue, 10);
    return `0:${seconds.toString().padStart(2, "0")}`;
  }

  const minutes = parseInt(numericValue.slice(0, -2), 10);
  const seconds = parseInt(numericValue.slice(-2), 10);

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// Format total seconds into minutes:seconds string
export function formatFromTotalSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Convert a formatted string (minutes:seconds) back to total seconds
export function convertToTotalSeconds(formattedTime: string): number {
  const parts = formattedTime.split(":").map(Number);

  // Validate input
  if (parts.length !== 2 || parts.some((part) => isNaN(part) || part < 0)) {
    throw new Error(`Invalid time format: "${formattedTime}"`);
  }

  const [minutes, seconds] = formattedTime.split(":").map(Number);
  return minutes * 60 + (seconds || 0);
}

// Format total seconds into hours:minutes string
export const formatToHoursMinutes = (totalSeconds: number): string => {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const formattedHours = hours > 0 ? hours.toString().padStart(2, "0") : "00";
  const formattedMinutes = minutes.toString().padStart(2, "0");

  return `${formattedHours}:${formattedMinutes}`;
};

export function convertTimeStrToSeconds(timeStr: string): number {
  let totalSeconds = 0;
  if (timeStr.length > 0) {
    if (timeStr.length <= 2) {
      totalSeconds = parseInt(timeStr) || 0;
    } else {
      // Convert from display format (e.g., "600" for 6:00) to seconds
      const minutes = parseInt(timeStr.slice(0, -2)) || 0;
      const seconds = parseInt(timeStr.slice(-2)) || 0;
      totalSeconds = minutes * 60 + seconds;
    }
  }
  return totalSeconds;
}

// Capitalize the first letter of each word in a string
export const capitalizeWords = (str: string) => {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

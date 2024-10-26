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

// Capitalize the first letter of each word in a string
export const capitalizeWords = (str: string) => {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

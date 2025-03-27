import {
  byteArrayToBase64,
  formatTimeInput,
  formatFromTotalSeconds,
  convertToTotalSeconds,
  formatToHoursMinutes,
  capitalizeWords,
} from "@/utils/utility";

describe("Utility Functions", () => {
  describe("byteArrayToBase64", () => {
    it("should convert a byte array to a base64 string", () => {
      expect(byteArrayToBase64([72, 101, 108, 108, 111])).toBe("SGVsbG8=");
    });

    it("should return an empty string for an empty array", () => {
      expect(byteArrayToBase64([])).toBe("");
    });

    it("should handle byte values at extremes", () => {
      expect(byteArrayToBase64([0, 255])).toBe("AP8=");
    });
  });

  describe("formatTimeInput", () => {
    it("should handle invalid input", () => {
      expect(formatTimeInput("abc")).toBe("0:00");
    });

    it("should handle input with more than 4 digits", () => {
      expect(formatTimeInput("12345")).toBe("123:45");
    });

    it("should format input with leading zeros when minutes are less than 100", () => {
      expect(formatTimeInput("00123")).toBe("1:23");
    });

    it("should format an empty string as 0:00", () => {
      expect(formatTimeInput("")).toBe("0:00");
    });

    it("should format single-digit inputs as seconds", () => {
      expect(formatTimeInput("5")).toBe("0:05");
    });

    it("should format two-digit inputs as seconds", () => {
      expect(formatTimeInput("45")).toBe("0:45");
    });

    it("should format three-digit inputs as minutes and seconds", () => {
      expect(formatTimeInput("123")).toBe("1:23");
    });

    it("should remove non-numeric characters", () => {
      expect(formatTimeInput("12abc3")).toBe("1:23");
    });
  });

  describe("formatFromTotalSeconds", () => {
    it("should format 0 seconds as 0:00", () => {
      expect(formatFromTotalSeconds(0)).toBe("0:00");
    });

    it("should format seconds less than a minute", () => {
      expect(formatFromTotalSeconds(45)).toBe("0:45");
    });

    it("should format minutes and seconds", () => {
      expect(formatFromTotalSeconds(125)).toBe("2:05");
    });

    it("should handle large numbers", () => {
      expect(formatFromTotalSeconds(3601)).toBe("60:01");
    });
  });

  describe("convertToTotalSeconds", () => {
    it("should convert 0:00 to 0 seconds", () => {
      expect(convertToTotalSeconds("0:00")).toBe(0);
    });

    it("should convert minutes and seconds to total seconds", () => {
      expect(convertToTotalSeconds("1:30")).toBe(90);
    });

    it("should convert single seconds", () => {
      expect(convertToTotalSeconds("0:05")).toBe(5);
    });

    it("should throw an error for invalid strings", () => {
      expect(() => convertToTotalSeconds("abc")).toThrow();
    });
  });

  describe("formatToHoursMinutes", () => {
    it("should format 0 seconds as 00:00", () => {
      expect(formatToHoursMinutes(0)).toBe("00:00");
    });

    it("should format exactly 1 hour", () => {
      expect(formatToHoursMinutes(3600)).toBe("01:00");
    });

    it("should format hours and minutes correctly", () => {
      expect(formatToHoursMinutes(3665)).toBe("01:01");
    });

    it("should format large numbers of seconds", () => {
      expect(formatToHoursMinutes(90000)).toBe("25:00");
    });
  });

  describe("capitalizeWords", () => {
    it("should capitalize each word in a sentence", () => {
      expect(capitalizeWords("hello world")).toBe("Hello World");
    });

    it("should handle single words", () => {
      expect(capitalizeWords("test")).toBe("Test");
    });

    it("should handle empty strings", () => {
      expect(capitalizeWords("")).toBe("");
    });

    it("should preserve spacing around words", () => {
      expect(capitalizeWords("  hello  world  ")).toBe("  Hello  World  ");
    });

    it("should handle punctuation correctly", () => {
      expect(capitalizeWords("hello, world!")).toBe("Hello, World!");
    });
  });
});

import {
  bytesToBase64,
  formatTimeInput,
  formatFromTotalSeconds,
  convertToTotalSeconds,
  formatToHoursMinutes,
  capitalizeWords,
} from "@/utils/utility";

describe("Utility Functions", () => {
  describe("bytesToBase64", () => {
    const patterned = (length: number) => {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) bytes[i] = (i * 31 + 7) % 256;
      return bytes;
    };

    it.each([0, 1, 3, 32767, 32768, 32769, 1000000])(
      "matches a reference encoder for %i bytes",
      (length) => {
        const bytes = patterned(length);
        expect(bytesToBase64(bytes)).toBe(
          Buffer.from(bytes).toString("base64"),
        );
      },
    );

    it("accepts a plain number array", () => {
      expect(bytesToBase64([72, 101, 108, 108, 111])).toBe("SGVsbG8=");
    });

    it("handles byte values at extremes", () => {
      expect(bytesToBase64([0, 255])).toBe("AP8=");
    });

    // A Uint8Array that went through JSON (persisted store state) comes back
    // as an index-keyed object rather than an array.
    it("accepts an index-keyed object", () => {
      expect(bytesToBase64({ 0: 72, 1: 101, 2: 108, 3: 108, 4: 111 })).toBe(
        "SGVsbG8=",
      );
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
    it("should format 0 seconds as 0m", () => {
      expect(formatToHoursMinutes(0)).toBe("0m");
    });

    it("should format minutes only", () => {
      expect(formatToHoursMinutes(2700)).toBe("45m");
    });

    it("should format exactly 1 hour", () => {
      expect(formatToHoursMinutes(3600)).toBe("1h");
    });

    it("should format hours and minutes", () => {
      expect(formatToHoursMinutes(4800)).toBe("1h20m");
    });

    it("should format hours and minutes when seconds remain", () => {
      expect(formatToHoursMinutes(3665)).toBe("1h1m");
    });

    it("should format large numbers of seconds", () => {
      expect(formatToHoursMinutes(90000)).toBe("25h");
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

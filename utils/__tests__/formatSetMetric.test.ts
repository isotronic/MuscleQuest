import { formatSetMetric } from "../formatSetMetric";

describe("formatSetMetric", () => {
  describe('tracking_type: "weight" (default)', () => {
    it("formats weight and reps in kg", () => {
      expect(formatSetMetric({ weight: 100, reps: 8 }, "weight")).toBe(
        "100 kg × 8",
      );
    });

    it("formats weight and reps in lbs", () => {
      expect(formatSetMetric({ weight: 50, reps: 10 }, "weight", "lbs")).toBe(
        "50 lbs × 10",
      );
    });

    it("formats decimal weight with one decimal place", () => {
      expect(formatSetMetric({ weight: 22.5, reps: 6 }, "weight")).toBe(
        "22.5 kg × 6",
      );
    });

    it("strips trailing zero from weight decimal", () => {
      expect(formatSetMetric({ weight: 20.0, reps: 5 }, "weight")).toBe(
        "20 kg × 5",
      );
    });

    it("defaults weight and reps to 0 when null", () => {
      expect(formatSetMetric({ weight: null, reps: null }, "weight")).toBe(
        "0 kg × 0",
      );
    });

    it("defaults weight and reps to 0 when undefined", () => {
      expect(formatSetMetric({}, "weight")).toBe("0 kg × 0");
    });

    it("uses default tracking type when trackingType is null", () => {
      expect(formatSetMetric({ weight: 60, reps: 12 }, null)).toBe(
        "60 kg × 12",
      );
    });

    it("uses default tracking type for unknown trackingType", () => {
      expect(formatSetMetric({ weight: 60, reps: 12 }, "unknown")).toBe(
        "60 kg × 12",
      );
    });
  });

  describe('tracking_type: "reps"', () => {
    it("formats reps only", () => {
      expect(formatSetMetric({ reps: 15 }, "reps")).toBe("15 reps");
    });

    it("defaults reps to 0 when null", () => {
      expect(formatSetMetric({ reps: null }, "reps")).toBe("0 reps");
    });

    it("defaults reps to 0 when undefined", () => {
      expect(formatSetMetric({}, "reps")).toBe("0 reps");
    });
  });

  describe('tracking_type: "time"', () => {
    it("formats seconds under a minute", () => {
      expect(formatSetMetric({ time: 45 }, "time")).toBe("45s");
    });

    it("formats exactly one minute", () => {
      expect(formatSetMetric({ time: 60 }, "time")).toBe("1:00");
    });

    it("formats minutes and seconds", () => {
      expect(formatSetMetric({ time: 90 }, "time")).toBe("1:30");
    });

    it("pads single-digit seconds with leading zero", () => {
      expect(formatSetMetric({ time: 65 }, "time")).toBe("1:05");
    });

    it("formats zero seconds", () => {
      expect(formatSetMetric({ time: 0 }, "time")).toBe("0s");
    });

    it("defaults to 0s when time is null", () => {
      expect(formatSetMetric({ time: null }, "time")).toBe("0s");
    });
  });

  describe('tracking_type: "distance"', () => {
    it("formats distance in metres", () => {
      expect(formatSetMetric({ distance: 400 }, "distance")).toBe("400 m");
    });

    it("defaults distance to 0 when null", () => {
      expect(formatSetMetric({ distance: null }, "distance")).toBe("0 m");
    });

    it("defaults distance to 0 when undefined", () => {
      expect(formatSetMetric({}, "distance")).toBe("0 m");
    });
  });

  describe('tracking_type: "assisted"', () => {
    it("formats assist and resist in kg with reps", () => {
      // bodyWeight=80, weight=20 → assist=20, resist=60
      expect(
        formatSetMetric({ weight: 20, reps: 8 }, "assisted", "kg", 80),
      ).toBe("20 kg assist / 60 kg resist × 8");
    });

    it("formats assist and resist in lbs", () => {
      expect(
        formatSetMetric({ weight: 30, reps: 5 }, "assisted", "lbs", 100),
      ).toBe("30 lbs assist / 70 lbs resist × 5");
    });

    it("clamps resist to 0 when assist exceeds bodyWeight", () => {
      // weight=90 > bodyWeight=80 → resist=0
      expect(
        formatSetMetric({ weight: 90, reps: 10 }, "assisted", "kg", 80),
      ).toBe("90 kg assist / 0 kg resist × 10");
    });

    it("defaults weight and reps to 0 when null", () => {
      expect(
        formatSetMetric({ weight: null, reps: null }, "assisted", "kg", 70),
      ).toBe("0 kg assist / 70 kg resist × 0");
    });

    it("uses 0 bodyWeight by default", () => {
      expect(formatSetMetric({ weight: 20, reps: 5 }, "assisted")).toBe(
        "20 kg assist / 0 kg resist × 5",
      );
    });
  });
});

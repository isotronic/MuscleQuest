import { selectedSegmentBorders } from "../segmentBorders";

// Paper draws each shared edge once: every segment but the last has no end
// border, and the next segment's start border closes it. A selected segment
// with a coloured border must draw that edge itself.
describe("selectedSegmentBorders", () => {
  it("gives a selected first or middle segment its own end border", () => {
    expect(selectedSegmentBorders(0, 0, 3)).toEqual({ borderEndWidth: 1 });
    expect(selectedSegmentBorders(1, 1, 3)).toEqual({ borderEndWidth: 1 });
  });

  it("drops the start border of the segment after the selected one", () => {
    expect(selectedSegmentBorders(1, 0, 3)).toEqual({ borderStartWidth: 0 });
    expect(selectedSegmentBorders(2, 1, 3)).toEqual({ borderStartWidth: 0 });
  });

  it("leaves a selected last segment as Paper draws it", () => {
    expect(selectedSegmentBorders(2, 2, 3)).toBeUndefined();
  });

  it("leaves every other segment alone", () => {
    expect(selectedSegmentBorders(0, 1, 3)).toBeUndefined();
    expect(selectedSegmentBorders(2, 0, 3)).toBeUndefined();
    expect(selectedSegmentBorders(0, -1, 2)).toBeUndefined();
  });
});

import { selectedSegmentBorders } from "../segmentBorders";

// Paper draws each shared edge once: every segment but the last has no end
// border, and the next segment's start border closes it. A selected segment
// with a coloured border must draw that edge itself.
describe("selectedSegmentBorders", () => {
  it("gives a selected first or middle segment its own end border", () => {
    expect(selectedSegmentBorders(0, 0, 3)).toEqual({
      borderStartWidth: 1,
      borderEndWidth: 1,
    });
    expect(selectedSegmentBorders(1, 1, 3)).toEqual({
      borderStartWidth: 1,
      borderEndWidth: 1,
    });
  });

  it("drops the start border of the segment after the selected one", () => {
    expect(selectedSegmentBorders(1, 0, 3)).toEqual({
      borderStartWidth: 0,
      borderEndWidth: 0,
    });
    expect(selectedSegmentBorders(2, 1, 3)).toEqual({
      borderStartWidth: 0,
      borderEndWidth: 1,
    });
  });

  it("draws a selected last segment as Paper does", () => {
    expect(selectedSegmentBorders(1, 2, 3)).toEqual({
      borderStartWidth: 1,
      borderEndWidth: 0,
    });
    expect(selectedSegmentBorders(2, 2, 3)).toEqual({
      borderStartWidth: 1,
      borderEndWidth: 1,
    });
  });

  // Android keeps a border width a re-render stops setting, so a segment
  // that was once next to the selection would keep a missing edge.
  it("sets both widths on every segment for every selection", () => {
    for (let selected = -1; selected < 3; selected++) {
      for (let index = 0; index < 3; index++) {
        expect(
          Object.keys(selectedSegmentBorders(index, selected, 3)).sort(),
        ).toEqual(["borderEndWidth", "borderStartWidth"]);
      }
    }
  });

  it("draws Paper's edges when nothing is selected", () => {
    expect(selectedSegmentBorders(0, -1, 2)).toEqual({
      borderStartWidth: 1,
      borderEndWidth: 0,
    });
    expect(selectedSegmentBorders(1, -1, 2)).toEqual({
      borderStartWidth: 1,
      borderEndWidth: 1,
    });
  });
});

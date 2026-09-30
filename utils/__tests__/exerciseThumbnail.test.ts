import { exerciseThumbnailUri } from "@/utils/exerciseThumbnail";

describe("exerciseThumbnailUri", () => {
  it("prefers the file uri", () => {
    expect(
      exerciseThumbnailUri("file:///doc/exercise-images/1.webp", [1]),
    ).toBe("file:///doc/exercise-images/1.webp");
  });

  it("falls back to a data uri built from the stored bytes", () => {
    expect(exerciseThumbnailUri(null, [72, 101, 108, 108, 111])).toBe(
      "data:image/webp;base64,SGVsbG8=",
    );
  });

  it("accepts a Uint8Array", () => {
    expect(
      exerciseThumbnailUri(undefined, new Uint8Array([72, 101, 108, 108, 111])),
    ).toBe("data:image/webp;base64,SGVsbG8=");
  });

  it.each([
    [null, null],
    [undefined, undefined],
    ["", []],
    [null, new Uint8Array(0)],
  ])("returns undefined when there is no image (%p, %p)", (uri, image) => {
    expect(exerciseThumbnailUri(uri, image)).toBeUndefined();
  });
});

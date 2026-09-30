import { bytesToBase64 } from "@/utils/utility";

type ThumbnailBytes =
  | Uint8Array
  | ArrayLike<number>
  | Record<number, number>
  | null
  | undefined;

const byteLength = (image: NonNullable<ThumbnailBytes>) =>
  "length" in image ? image.length : Object.keys(image).length;

// The uri to render for an exercise thumbnail: the file on disk when there is
// one, otherwise a data uri built from the bytes still stored in SQLite (only
// until writeExerciseImageFiles has moved the image out).
export function exerciseThumbnailUri(
  imageUri: string | null | undefined,
  image: ThumbnailBytes,
): string | undefined {
  if (imageUri) return imageUri;
  if (image && byteLength(image) > 0) {
    return `data:image/webp;base64,${bytesToBase64(image)}`;
  }
  return undefined;
}

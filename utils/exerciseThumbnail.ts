import { bytesToBase64 } from "@/utils/utility";

type ThumbnailBytes = Uint8Array | ArrayLike<number> | null | undefined;

// The uri to render for an exercise thumbnail: the file on disk when there is
// one, otherwise a data uri built from the bytes still stored in SQLite (only
// until writeExerciseImageFiles has moved the image out).
export function exerciseThumbnailUri(
  imageUri: string | null | undefined,
  image: ThumbnailBytes,
): string | undefined {
  if (imageUri) return imageUri;
  if (image && image.length > 0) {
    return `data:image/webp;base64,${bytesToBase64(image)}`;
  }
  return undefined;
}

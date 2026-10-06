import { decodePng, encodePng, type Pixels } from '../model/pngCodec';

/** Browser decode for PNGs the codec rejects (16-bit, interlaced) and other image types. */
async function decodeWithCanvas(bytes: Uint8Array): Promise<Pixels> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const { width, height, data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { width, height, data };
}

/**
 * Decodes an image file to exact RGBA, using the PNG codec first and the browser as a fallback.
 * Throws "Not a valid image" when neither can read it.
 */
export async function decodeImageFile(
  bytes: Uint8Array,
  fallback: (bytes: Uint8Array) => Promise<Pixels> = decodeWithCanvas,
): Promise<Pixels> {
  try {
    return await decodePng(bytes);
  } catch {
    try {
      return await fallback(bytes);
    } catch {
      throw new Error('Not a valid image');
    }
  }
}

export const encodeImageFile = (px: Pixels): Promise<Uint8Array> => encodePng(px);

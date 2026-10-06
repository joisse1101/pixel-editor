import { dataUrlToBytes, decodePng, type Pixels } from '../model/pngCodec';
import type { Project } from '../model/types';

/** Exact pixels via the PNG decoder; unusual formats (16-bit, interlaced) fall back to the canvas. */
async function readPixels(dataUrl: string, bitmap: ImageBitmap): Promise<Pixels> {
  try {
    return await decodePng(dataUrlToBytes(dataUrl));
  } catch {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const { width, height, data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width, height, data };
  }
}

/** Decodes every sprite sheet PNG once and keeps the bitmap and exact pixels on the sheet. */
export async function decodeSheets(project: Project): Promise<void> {
  await Promise.all(
    project.sheets.map(async (sheet) => {
      if (!sheet.bitmap) {
        const blob = await (await fetch(sheet.dataUrl)).blob();
        sheet.bitmap = await createImageBitmap(blob);
      }
      if (!sheet.pixels) sheet.pixels = await readPixels(sheet.dataUrl, sheet.bitmap);
    }),
  );
}

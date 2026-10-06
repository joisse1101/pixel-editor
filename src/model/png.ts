/** Reads width/height from the IHDR chunk of a PNG data URL without decoding it. */
export function pngSizeFromDataUrl(dataUrl: string): { width: number; height: number } {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:image/png') || comma < 0) {
    throw new Error('Sprite sheet is not a PNG data URL');
  }
  const head = atob(dataUrl.slice(comma + 1, comma + 1 + 44));
  if (head.charCodeAt(1) !== 0x50 || head.charCodeAt(2) !== 0x4e || head.charCodeAt(3) !== 0x47) {
    throw new Error('Sprite sheet is not a valid PNG');
  }
  const u32 = (o: number) =>
    ((head.charCodeAt(o) << 24) | (head.charCodeAt(o + 1) << 16) | (head.charCodeAt(o + 2) << 8) | head.charCodeAt(o + 3)) >>> 0;
  return { width: u32(16), height: u32(20) };
}

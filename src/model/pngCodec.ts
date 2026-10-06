/** RGBA pixel data, row-major, 4 bytes per pixel. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // Not awaited: the writer only settles once the readable side is drained below.
  void writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => writer.close());
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

let crcTable: Uint32Array | undefined;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

/** Encodes 8-bit RGBA pixels as a PNG. */
export async function encodePng(px: Pixels): Promise<Uint8Array> {
  const stride = px.width * 4;
  const raw = new Uint8Array((stride + 1) * px.height);
  for (let y = 0; y < px.height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(px.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, px.width);
  v.setUint32(4, px.height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const idat = await pipe(raw, new CompressionStream('deflate'));
  const parts = [new Uint8Array(SIGNATURE), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function bytesToDataUrl(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(bin)}`;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decodes a non-interlaced 8-bit PNG (gray, gray+alpha, RGB, palette or RGBA) to RGBA. */
export async function decodePng(bytes: Uint8Array): Promise<Pixels> {
  if (SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error('Not a PNG file');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Uint8Array = new Uint8Array();
  let trns: Uint8Array = new Uint8Array();
  const idat: Uint8Array[] = [];
  for (let o = 8; o + 8 <= bytes.length; ) {
    const len = view.getUint32(o);
    const type = String.fromCharCode(...bytes.subarray(o + 4, o + 8));
    const body = bytes.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(o + 8);
      height = view.getUint32(o + 12);
      depth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (depth !== 8 || interlace !== 0 || !channels) throw new Error('Unsupported PNG format');

  const joined = new Uint8Array(idat.reduce((n, p) => n + p.length, 0));
  let jo = 0;
  for (const p of idat) {
    joined.set(p, jo);
    jo += p.length;
  }
  const raw = await pipe(joined, new DecompressionStream('deflate'));

  const stride = width * channels;
  const cur = new Uint8Array(stride);
  let prev = new Uint8Array(stride);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      const add = filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? paeth(a, b, c) : 0;
      cur[i] = (line[i] + add) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const d = (y * width + x) * 4;
      const s = x * channels;
      if (colorType === 6) data.set(cur.subarray(s, s + 4), d);
      else if (colorType === 2) data.set([cur[s], cur[s + 1], cur[s + 2], 255], d);
      else if (colorType === 0) data.set([cur[s], cur[s], cur[s], 255], d);
      else if (colorType === 4) data.set([cur[s], cur[s], cur[s], cur[s + 1]], d);
      else data.set([palette[cur[s] * 3], palette[cur[s] * 3 + 1], palette[cur[s] * 3 + 2], trns[cur[s]] ?? 255], d);
    }
    prev = Uint8Array.from(cur);
  }
  return { width, height, data };
}

/**
 * png-io.mjs — the THIN, dependency-free PNG codec for the visual comparator (#2670).
 *
 * WHY THIS EXISTS. The screenshot-vs-baseline comparator (`visual-comparator.mjs`) needs to turn a PNG on disk
 * into a plain `{ width, height, data }` pixel buffer (and, for tests + the capture harness, back again). The
 * comparator's DIFF logic must stay PURE — no I/O, no deps — so the jury adapter (#2671) can import it in any
 * context. This module is the deliberately-THIN I/O seam kept OUT of that pure core: all the byte-wrangling
 * (zlib inflate, PNG chunking, scanline unfiltering) lives here, isolated, so the diff engine never touches a
 * file or a Buffer.
 *
 * NO NEW DEPENDENCY. WE holds ZERO third-party impl by policy and the minimal repo carries no image library
 * (no `pngjs` / `pixelmatch` / `sharp`). PNG decompression is plain DEFLATE, which Node ships in `zlib` — so a
 * small, focused codec decodes/encodes PNG with only built-ins. Scope is intentionally narrow: 8-bit, colour
 * type 2 (RGB) or 6 (RGBA), non-interlaced — exactly what Playwright's screenshot encoder emits, and what our
 * baseline render produces. Anything outside that scope throws a loud, specific error rather than silently
 * mis-decoding (a mis-decode would surface as a phantom visual delta, the worst kind of false-fail).
 *
 * Pure-ish: `decodePng`/`encodePng` are pure Buffer↔object transforms; `readPng`/`writePng` are the only fs
 * touch-points. Unit-tested via round-trip in `scripts/lib/__tests__/visual-comparator.test.mjs`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

/** The 8-byte PNG signature every valid PNG starts with. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * A decoded image — the plain, library-free shape the pure diff engine consumes.
 * @typedef {{ width: number, height: number, data: Uint8Array }} DecodedImage
 * `data` is tightly-packed RGBA, 4 bytes per pixel, row-major (length === width * height * 4).
 */

/** Paeth predictor (PNG filter type 4) — the standard reference implementation. */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decode a PNG Buffer to a `{ width, height, data (RGBA) }` image. Handles 8-bit, colour type 2 (RGB) or 6
 * (RGBA), non-interlaced — the Playwright/baseline profile. Throws a specific error for anything else.
 * @param {Buffer|Uint8Array} buffer
 * @returns {DecodedImage}
 */
export function decodePng(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE))
    throw new Error('png-io: not a PNG (bad signature)');

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const dataStart = off + 8;
    if (type === 'IHDR') {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
      interlace = buf[dataStart + 12];
    } else if (type === 'IDAT') {
      idat.push(buf.subarray(dataStart, dataStart + len));
    } else if (type === 'IEND') {
      break;
    }
    off = dataStart + len + 4; // skip data + 4-byte CRC
  }

  if (bitDepth !== 8)
    throw new Error(`png-io: unsupported bit depth ${bitDepth} (only 8-bit supported)`);
  if (colorType !== 2 && colorType !== 6)
    throw new Error(`png-io: unsupported colour type ${colorType} (only 2=RGB / 6=RGBA supported)`);
  if (interlace !== 0) throw new Error('png-io: interlaced PNG not supported');
  if (idat.length === 0) throw new Error('png-io: no IDAT data');

  const channels = colorType === 6 ? 4 : 3; // stored channels
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels; // bytes per unfiltered scanline
  // Each scanline is a 1-byte filter code + `stride` bytes. A short stream means a truncated/corrupt PNG — fail
  // LOUDLY rather than reading past the end (undefined → NaN → silently-zeroed pixels, i.e. a phantom delta).
  if (raw.length < (stride + 1) * height)
    throw new Error(`png-io: truncated pixel stream (${raw.length} bytes < ${(stride + 1) * height} expected)`);
  const out = new Uint8Array(width * height * 4);

  // Unfilter each scanline in place into `line`, then expand to RGBA in `out`.
  const prev = new Uint8Array(stride);
  const line = new Uint8Array(stride);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[src + x];
      const a = x >= channels ? line[x - channels] : 0; // byte to the left
      const b = prev[x]; // byte above
      const c = x >= channels ? prev[x - channels] : 0; // byte upper-left
      let val;
      switch (filter) {
        case 0: val = rawByte; break; // None
        case 1: val = rawByte + a; break; // Sub
        case 2: val = rawByte + b; break; // Up
        case 3: val = rawByte + ((a + b) >> 1); break; // Average
        case 4: val = rawByte + paeth(a, b, c); break; // Paeth
        default: throw new Error(`png-io: bad filter type ${filter}`);
      }
      line[x] = val & 0xff;
    }
    src += stride;
    // Expand this scanline's channels to RGBA in the output.
    for (let x = 0; x < width; x++) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      out[d] = line[s];
      out[d + 1] = line[s + 1];
      out[d + 2] = line[s + 2];
      out[d + 3] = channels === 4 ? line[s + 3] : 255;
    }
    prev.set(line);
  }

  return { width, height, data: out };
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), out.length - 4);
  return out;
}

/**
 * Encode a `{ width, height, data (RGBA) }` image to a PNG Buffer (8-bit RGBA, filter type 0). Used by the
 * baseline capture harness and by the comparator's own tests to synthesise fixtures.
 * @param {DecodedImage} image
 * @returns {Buffer}
 */
export function encodePng({ width, height, data }) {
  if (!width || !height) throw new Error('png-io: cannot encode a zero-size image');
  if (data.length !== width * height * 4)
    throw new Error(`png-io: data length ${data.length} != ${width}*${height}*4`);

  // Raw scanlines, each prefixed with filter byte 0 (None).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Read + decode a PNG file. The only fs read in the codec. */
export function readPng(path) {
  return decodePng(readFileSync(path));
}

/** Encode + write a PNG file. The only fs write in the codec. */
export function writePng(path, image) {
  writeFileSync(path, encodePng(image));
}

// Perceptual image hashing for reused-photo detection.
//
// One drop-shipper behind many "independent" storefronts almost always reuses the same product
// photos. A perceptual hash (dHash) fingerprints an image by its low-frequency structure, so it
// stays the same across resize/re-compression/mild watermarking — letting us catch the same photo
// on two different vendors even when the file was re-saved. Runs offline in the collector (sharp
// is native and heavy), never at request time.

import sharp from "sharp";

/**
 * 64-bit difference hash as a 16-char hex string. Grayscale → 9×8 → for each row compare each
 * pixel to its right neighbor (8 rows × 8 comparisons = 64 bits). Null on any fetch/decode error.
 */
export async function dhash(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const px = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
    let bits = "";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) bits += px[r * 9 + c] < px[r * 9 + c + 1] ? "1" : "0";
    return BigInt("0b" + bits).toString(16).padStart(16, "0");
  } catch {
    return null;
  }
}

/**
 * Identify an uploaded image from its first bytes instead of trusting the
 * browser-supplied MIME type or file extension.
 *
 * Only PNG and JPEG are accepted for logos: they render in every browser
 * and are the two raster formats pdfkit can embed in invoice PDFs.
 */
export type LogoImageType = { mimeType: "image/png"; extension: "png" } | { mimeType: "image/jpeg"; extension: "jpg" };

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function detectLogoImageType(bytes: Uint8Array): LogoImageType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  return null;
}

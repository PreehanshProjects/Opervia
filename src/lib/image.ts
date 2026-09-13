/** Longest side of the stored logo, in pixels. Prints crisply at A4 header size. */
const MAX_EDGE = 420;
/** Hard ceiling on the stored data URI. Kept small: it lives in the business profile. */
const MAX_BYTES = 90_000;

export const LOGO_HINT =
  "PNG, JPEG or WebP. It is resized to 420px and stored with your business details.";

/**
 * Reads an image file and returns a resized data URI.
 *
 * The logo is stored inline on the business profile rather than in object
 * storage, so it has to stay small — an unbounded upload would sit in the
 * database and travel on every load. Transparency is preserved by keeping PNG
 * when it fits; otherwise the image is flattened onto white as JPEG, which is
 * what the printed sheet shows anyway.
 */
export async function readLogo(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("Choose an image file (PNG, JPEG or WebP).");
  if (file.size > 12_000_000)
    throw new Error("That image is very large. Choose one under 12 MB.");

  const bitmap = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process images.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Transparency first, because most logos need it.
  const png = canvas.toDataURL("image/png");
  if (png.length <= MAX_BYTES) return png;

  // Too heavy: flatten onto white, which matches the paper it prints on.
  const flat = document.createElement("canvas");
  flat.width = width;
  flat.height = height;
  const flatCtx = flat.getContext("2d");
  if (!flatCtx) throw new Error("This browser cannot process images.");
  flatCtx.fillStyle = "#ffffff";
  flatCtx.fillRect(0, 0, width, height);
  flatCtx.drawImage(canvas, 0, 0);

  for (const quality of [0.85, 0.7, 0.55]) {
    const jpeg = flat.toDataURL("image/jpeg", quality);
    if (jpeg.length <= MAX_BYTES) return jpeg;
  }
  throw new Error(
    "That image is too detailed to store. Try a simpler logo, or crop it tighter.",
  );
}

/**
 * Reads the chosen file into an <img>.
 *
 * Deliberately a data: URI rather than URL.createObjectURL: the app's
 * Content-Security-Policy is `img-src 'self' data:`, so a blob: URL is blocked
 * and the upload silently does nothing. Reading as data: needs no change to the
 * policy, and the resized logo is stored as a data URI anyway.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("That file could not be read from your device."));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("That file could not be read as an image."));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

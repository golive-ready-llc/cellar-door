/**
 * Label images are stored as data URLs. Embedding them in list responses made
 * every cellar and history load carry every image (tens of MB for a large
 * cellar). Lists now carry a short same-origin URL instead, and the image is
 * served, and cached by the browser, from /api/wine-image/[id].
 */
export type WineImageKind = "wine" | "history";

const ROUTE_PREFIX = "/api/wine-image/";
// Raster types only. SVG is never served from our origin (it can carry script).
const ROUTABLE = /^data:image\/(jpeg|jpg|png|webp|gif|avif);base64,/i;

export function isRoutableImage(value: string | null | undefined): value is string {
  return typeof value === "string" && ROUTABLE.test(value);
}

/**
 * Short fingerprint of a stored image, so a changed image gets a new URL (and
 * a fresh browser-cache entry). Samples the string rather than hashing every
 * character, which keeps large lists cheap to build.
 */
function fingerprint(stored: string): string {
  let hash = 0x811c9dc5;
  const step = Math.max(1, Math.floor(stored.length / 4096));
  for (let i = 0; i < stored.length; i += step) {
    hash ^= stored.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  for (let i = Math.max(0, stored.length - 64); i < stored.length; i++) {
    hash ^= stored.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${stored.length.toString(36)}-${hash.toString(36)}`;
}

export function wineImageUrl(kind: WineImageKind, id: string, stored: string): string {
  const kindParam = kind === "history" ? "&k=h" : "";
  return `${ROUTE_PREFIX}${encodeURIComponent(id)}?v=${fingerprint(stored)}${kindParam}`;
}

/** Image value for list responses: stored raster data URLs become a route URL; anything else is unchanged. */
export function listImageUrl(kind: WineImageKind, id: string, stored: string): string {
  return isRoutableImage(stored) ? wineImageUrl(kind, id, stored) : stored;
}

/** Recognise one of our image URLs (as sent back by an edit form or "duplicate"). */
export function parseWineImageRef(value: unknown): { kind: WineImageKind; id: string } | null {
  if (typeof value !== "string" || !value.startsWith(ROUTE_PREFIX)) return null;
  try {
    const url = new URL(value, "http://localhost");
    const id = decodeURIComponent(url.pathname.slice(ROUTE_PREFIX.length));
    if (!id || id.includes("/")) return null;
    return { kind: url.searchParams.get("k") === "h" ? "history" : "wine", id };
  } catch {
    return null;
  }
}

/** Decode a stored raster data URL into bytes for the image route. */
export function decodeImageDataUrl(value: string): { contentType: string; bytes: Uint8Array } | null {
  if (!isRoutableImage(value)) return null;
  const comma = value.indexOf(",");
  const type = value.slice(5, value.indexOf(";")).toLowerCase();
  const bytes: Uint8Array = Buffer.from(value.slice(comma + 1), "base64");
  return { contentType: type === "image/jpg" ? "image/jpeg" : type, bytes };
}

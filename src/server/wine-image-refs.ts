/**
 * Server-only helper (deliberately not a "use server" module).
 *
 * List responses reference images by /api/wine-image/... URL, so an edit form
 * or "duplicate" may send one of those URLs back. Resolve it to the stored
 * image it points at, but only when the caller owns that record. Anything
 * else (a new data URL, an https URL, an empty string) passes through.
 */
import { prisma } from "@/lib/db";
import { parseWineImageRef } from "@/lib/wine-image-ref";

export async function resolveImageRef(uid: string, value: string): Promise<string> {
  const ref = parseWineImageRef(value);
  if (!ref) return value;
  const row =
    ref.kind === "history"
      ? await prisma.wineHistory.findFirst({ where: { id: ref.id, userId: uid }, select: { imageUrl: true } })
      : await prisma.wine.findFirst({ where: { id: ref.id, userId: uid }, select: { imageUrl: true } });
  return row?.imageUrl ?? "";
}

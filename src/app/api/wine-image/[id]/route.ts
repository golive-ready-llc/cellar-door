import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId } from "@/server/auth-guard";
import { decodeImageDataUrl } from "@/lib/wine-image-ref";

/**
 * GET /api/wine-image/[id] — a stored label image, for its owner only.
 *
 * Cellar and history lists reference images by this URL instead of embedding
 * them. The URL carries a fingerprint of the image (?v=), so the response can
 * be cached for a year; a changed image gets a new URL. ?k=h selects a
 * history record instead of a wine. Only raster images are served.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const history = new URL(request.url).searchParams.get("k") === "h";
  const row = history
    ? await prisma.wineHistory.findFirst({ where: { id, userId }, select: { imageUrl: true } })
    : await prisma.wine.findFirst({ where: { id, userId }, select: { imageUrl: true } });

  const image = row ? decodeImageDataUrl(row.imageUrl) : null;
  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(image.bytes as BodyInit, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

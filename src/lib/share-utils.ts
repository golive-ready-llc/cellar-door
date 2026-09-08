/**
 * Share utilities — generate shareable image cards from wine/stats data
 */

import { isLightWineType } from "@/types/wine";

interface WineShareData {
  name: string;
  winery: string;
  vintage: number | null;
  type: string;
  region: string;
  country: string;
  userRating: number | null;
  description: string;
}

interface StatsShareData {
  totalBottles: number;
  totalValue: number;
  byType: Record<string, number>;
  topRegion: string;
  topGrape: string;
}

const WINE_TYPE_BG: Record<string, string> = {
  red: "#9B2335",
  white: "#F5E6CA",
  rosé: "#FFB6C1",
  sparkling: "#FFD700",
  dessert: "#DAA520",
  orange: "#FF8C00",
  fortified: "#722F37",
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function generateWineCard(wine: WineShareData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 600, 400);
  gradient.addColorStop(0, "#1a1a2e");
  gradient.addColorStop(1, "#16213e");
  ctx.fillStyle = gradient;
  drawRoundedRect(ctx, 0, 0, 600, 400, 16);
  ctx.fill();

  // Wine type accent bar
  const typeColor = WINE_TYPE_BG[wine.type] || "#666";
  ctx.fillStyle = typeColor;
  ctx.fillRect(0, 0, 6, 400);

  // Wine name
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px -apple-system, sans-serif";
  const nameLines = wrapText(ctx, wine.name, 520);
  nameLines.forEach((line, i) => {
    ctx.fillText(line, 30, 50 + i * 34);
  });

  // Winery + vintage
  const yAfterName = 50 + nameLines.length * 34 + 8;
  ctx.fillStyle = "#94a3b8";
  ctx.font = "18px -apple-system, sans-serif";
  ctx.fillText(`${wine.winery}${wine.vintage ? ` · ${wine.vintage}` : ""}`, 30, yAfterName);

  // Region
  if (wine.region || wine.country) {
    ctx.fillText(
      [wine.region, wine.country].filter(Boolean).join(", "),
      30,
      yAfterName + 28
    );
  }

  // Rating
  if (wine.userRating) {
    const ratingY = yAfterName + 70;
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 36px -apple-system, sans-serif";
    ctx.fillText(`${wine.userRating.toFixed(1)}`, 30, ratingY);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "18px -apple-system, sans-serif";
    ctx.fillText("/ 5", 90, ratingY);

    // Stars
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < Math.round(wine.userRating) ? "#fbbf24" : "#334155";
      ctx.font = "20px -apple-system, sans-serif";
      ctx.fillText("★", 130 + i * 24, ratingY);
    }
  }

  // Description (truncated)
  if (wine.description) {
    const descY = yAfterName + 110;
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "14px -apple-system, sans-serif";
    const descLines = wrapText(ctx, wine.description, 540).slice(0, 3);
    descLines.forEach((line, i) => {
      ctx.fillText(line, 30, descY + i * 20);
    });
  }

  // Type badge
  ctx.fillStyle = typeColor;
  drawRoundedRect(ctx, 30, 350, 80, 28, 14);
  ctx.fill();
  ctx.fillStyle = isLightWineType(wine.type) ? "#333" : "#fff";
  ctx.font = "bold 12px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(wine.type.charAt(0).toUpperCase() + wine.type.slice(1), 70, 369);
  ctx.textAlign = "left";

  // Branding
  ctx.fillStyle = "#475569";
  ctx.font = "12px -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("mycellardoor.app", 580, 385);
  ctx.textAlign = "left";

  return canvas;
}

export function generateStatsCard(stats: StatsShareData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 600, 400);
  gradient.addColorStop(0, "#1a1a2e");
  gradient.addColorStop(1, "#16213e");
  ctx.fillStyle = gradient;
  drawRoundedRect(ctx, 0, 0, 600, 400, 16);
  ctx.fill();

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px -apple-system, sans-serif";
  ctx.fillText("My Wine Collection", 30, 45);

  // Stats
  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px -apple-system, sans-serif";
  ctx.fillText("BOTTLES", 30, 85);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px -apple-system, sans-serif";
  ctx.fillText(stats.totalBottles.toString(), 30, 135);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px -apple-system, sans-serif";
  ctx.fillText("COLLECTION VALUE", 250, 85);
  ctx.fillStyle = "#22c55e";
  ctx.font = "bold 48px -apple-system, sans-serif";
  ctx.fillText(`$${stats.totalValue.toLocaleString()}`, 250, 135);

  // Type distribution
  let xPos = 30;
  const typeY = 180;
  ctx.font = "14px -apple-system, sans-serif";
  for (const [type, count] of Object.entries(stats.byType)) {
    if (count === 0) continue;
    const color = WINE_TYPE_BG[type] || "#666";
    ctx.fillStyle = color;
    drawRoundedRect(ctx, xPos, typeY, 90, 60, 8);
    ctx.fill();
    ctx.fillStyle = isLightWineType(type) ? "#333" : "#fff";
    ctx.font = "bold 22px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(count.toString(), xPos + 45, typeY + 28);
    ctx.font = "11px -apple-system, sans-serif";
    ctx.fillText(type.charAt(0).toUpperCase() + type.slice(1), xPos + 45, typeY + 48);
    ctx.textAlign = "left";
    xPos += 100;
  }

  // Top region & grape
  const infoY = 280;
  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px -apple-system, sans-serif";
  if (stats.topRegion) {
    ctx.fillText("TOP REGION", 30, infoY);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px -apple-system, sans-serif";
    ctx.fillText(stats.topRegion, 30, infoY + 24);
  }
  if (stats.topGrape) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px -apple-system, sans-serif";
    ctx.fillText("TOP GRAPE", 300, infoY);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px -apple-system, sans-serif";
    ctx.fillText(stats.topGrape, 300, infoY + 24);
  }

  // Branding
  ctx.fillStyle = "#475569";
  ctx.font = "12px -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("mycellardoor.app", 580, 385);
  ctx.textAlign = "left";

  return canvas;
}

export async function generateGalleryCard(
  wines: { name: string; winery: string; vintage: number | null; imageUrl: string; type: string }[]
): Promise<HTMLCanvasElement> {
  const cols = Math.min(wines.length, 4);
  const rows = Math.ceil(Math.min(wines.length, 12) / cols);
  const cellW = 200;
  const cellH = 260;
  const pad = 8;
  const headerH = 60;
  const footerH = 40;
  const canvasW = cols * (cellW + pad) + pad;
  const canvasH = headerH + rows * (cellH + pad) + pad + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d")!;

  // Background
  const gradient = ctx.createLinearGradient(0, 0, canvasW, canvasH);
  gradient.addColorStop(0, "#1a1a2e");
  gradient.addColorStop(1, "#16213e");
  ctx.fillStyle = gradient;
  drawRoundedRect(ctx, 0, 0, canvasW, canvasH, 16);
  ctx.fill();

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px -apple-system, sans-serif";
  ctx.fillText("My Wine Label Gallery", pad + 8, 38);

  // Load images and draw
  const display = wines.slice(0, cols * rows);
  const imagePromises = display.map(
    (w) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        if (!w.imageUrl) { resolve(null); return; }
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = w.imageUrl;
      })
  );

  const images = await Promise.all(imagePromises);

  display.forEach((wine, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = pad + col * (cellW + pad);
    const y = headerH + pad + row * (cellH + pad);

    // Cell background
    ctx.fillStyle = "#0f172a";
    drawRoundedRect(ctx, x, y, cellW, cellH, 10);
    ctx.fill();

    // Image
    const img = images[i];
    if (img) {
      ctx.save();
      drawRoundedRect(ctx, x, y, cellW, cellH, 10);
      ctx.clip();
      const scale = Math.max(cellW / img.width, cellH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, x + (cellW - dw) / 2, y + (cellH - dh) / 2, dw, dh);
      ctx.restore();
    }

    // Name overlay
    const overlayH = 50;
    const gy = y + cellH - overlayH;
    const grd = ctx.createLinearGradient(x, gy, x, y + cellH);
    grd.addColorStop(0, "rgba(0,0,0,0.8)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    drawRoundedRect(ctx, x, gy, cellW, overlayH, 0);
    ctx.clip();
    ctx.fillStyle = grd;
    ctx.fillRect(x, gy, cellW, overlayH);
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px -apple-system, sans-serif";
    const nameText = wine.name.length > 24 ? wine.name.slice(0, 22) + "\u2026" : wine.name;
    ctx.fillText(nameText, x + 8, y + cellH - 20);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px -apple-system, sans-serif";
    const sub = `${wine.winery}${wine.vintage ? ` \u00B7 ${wine.vintage}` : ""}`;
    const subText = sub.length > 28 ? sub.slice(0, 26) + "\u2026" : sub;
    ctx.fillText(subText, x + 8, y + cellH - 8);
  });

  // Branding
  ctx.fillStyle = "#475569";
  ctx.font = "12px -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("mycellardoor.app", canvasW - pad - 8, canvasH - 14);
  ctx.textAlign = "left";

  return canvas;
}

export async function shareCanvas(canvas: HTMLCanvasElement, title: string): Promise<void> {
  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) {
      console.error("[Share] Failed to create blob from canvas");
      return;
    }

    const file = new File([blob], "wine-card.png", { type: "image/png" });

    // Try native share (mobile)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return;
    }

    // Fallback: download — must append to DOM for some browsers
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cellar-door-share.png";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    // Clean up after a short delay
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  } catch (err) {
    console.error("[Share] Error:", err);
  }
}

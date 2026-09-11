import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { prisma } from "@/lib/db";
import { hasFeature } from "@/lib/tier";
import { getUserTier } from "@/server/tier-check";
import { decrypt } from "@/lib/encryption";
import { validateHaUrl } from "@/lib/ssrf-guard";

interface SensorValue {
  value: number;
  unit: string;
}

interface SensorResponse {
  temp: SensorValue | null;
  humidity: SensorValue | null;
  error?: string;
}

async function fetchHaEntity(
  haUrl: string,
  token: string,
  entityId: string
): Promise<SensorValue | null> {
  if (!entityId) return null;

  try {
    // SSRF guard: validate before each fetch (DNS-rebind-resistant per call).
    const base = await validateHaUrl(haUrl);
    const target = new URL(
      `/api/states/${encodeURIComponent(entityId)}`,
      base
    );

    const res = await fetch(target.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
      redirect: "manual",
    });

    // Reject redirects — they could point at internal hosts post-validation.
    if (res.status >= 300 && res.status < 400) return null;
    if (!res.ok) return null;

    const data = await res.json();
    const value = parseFloat(data.state);
    if (isNaN(value)) return null;

    return {
      value,
      unit: data.attributes?.unit_of_measurement || "",
    };
  } catch {
    // HA unreachable / slow / transient (timeout, DNS, connection refused, TLS).
    // Return null rather than throwing so the route responds 200 with a null
    // reading instead of a 500 — the user's logs were flooded with 500s every
    // minute when HA was offline. The chip already surfaces "Sensors offline".
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" } as SensorResponse, {
        status: 401,
      });
    }

    const idToken = authHeader.slice(7);
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json(
        { error: "Auth not configured" } as SensorResponse,
        { status: 500 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(idToken);

    // 2. Get user and verify tier
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true },
    });
    if (!user || !hasFeature(await getUserTier(user.id), "haSensors")) {
      return NextResponse.json(
        { error: "Cellar Pro required" } as SensorResponse,
        { status: 403 }
      );
    }

    // 3. Get wall config
    const wallId = request.nextUrl.searchParams.get("wallId");
    if (!wallId) {
      return NextResponse.json(
        { error: "wallId required" } as SensorResponse,
        { status: 400 }
      );
    }

    const wall = await prisma.wall.findFirst({
      where: { id: wallId, userId: user.id },
    });
    if (!wall) {
      return NextResponse.json(
        { error: "Wall not found" } as SensorResponse,
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (wall as any).haConfig as Record<string, string> | null;
    if (!config?.encryptedToken || !config?.haUrl) {
      return NextResponse.json(
        { error: "No sensor configured" } as SensorResponse,
        { status: 404 }
      );
    }

    // 4. Decrypt token and fetch both sensors in parallel
    const token = decrypt(config.encryptedToken);
    const haUrl = config.haUrl;

    // Validate URL upfront (cheap fail-fast before doing parallel work).
    try {
      await validateHaUrl(haUrl);
    } catch (e) {
      console.error("HA URL validation error:", e instanceof Error ? e.message : "rejected");
      return NextResponse.json(
        {
          temp: null,
          humidity: null,
          error: "Invalid Home Assistant URL",
        } as SensorResponse,
        { status: 400 }
      );
    }

    const [temp, humidity] = await Promise.all([
      fetchHaEntity(haUrl, token, config.tempEntityId),
      fetchHaEntity(haUrl, token, config.humidityEntityId),
    ]);

    const response: SensorResponse = {
      temp,
      humidity,
      ...((!temp && !humidity) ? { error: "Could not read sensors" } : {}),
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Sensor error:", msg);
    return NextResponse.json(
      { temp: null, humidity: null, error: "Sensor error" } as SensorResponse,
      { status: 500 }
    );
  }
}

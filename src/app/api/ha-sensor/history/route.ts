import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { prisma } from "@/lib/db";
import { hasFeature, type Tier } from "@/lib/tier";
import { decrypt } from "@/lib/encryption";
import { validateHaUrl } from "@/lib/ssrf-guard";

type Period = "24h" | "7d" | "30d";

const PERIOD_HOURS: Record<Period, number> = {
  "24h": 24,
  "7d": 7 * 24,
  "30d": 30 * 24,
};

const VALID_PERIODS = new Set<string>(Object.keys(PERIOD_HOURS));
const MAX_POINTS = 100;

interface DataPoint {
  time: string;
  value: number;
}

interface SeriesResponse {
  data: DataPoint[];
  unit: string;
}

interface HistoryResponse {
  temp: SeriesResponse | null;
  humidity: SeriesResponse | null;
  error?: string;
}

interface HaStateEntry {
  state: string;
  last_changed: string;
}

function downsample(points: DataPoint[], maxPoints: number): DataPoint[] {
  if (points.length <= maxPoints) return points;

  const bucketSize = points.length / maxPoints;
  const result: DataPoint[] = [];

  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    const bucket = points.slice(start, end);

    if (bucket.length === 0) continue;

    const avgValue =
      bucket.reduce((sum, p) => sum + p.value, 0) / bucket.length;
    // Use the midpoint timestamp of the bucket
    const midIndex = Math.floor(bucket.length / 2);
    result.push({
      time: bucket[midIndex].time,
      value: Math.round(avgValue * 100) / 100,
    });
  }

  return result;
}

async function fetchHaHistory(
  haUrl: string,
  token: string,
  entityId: string,
  startTime: string,
  endTime: string
): Promise<DataPoint[]> {
  if (!entityId) return [];

  // SSRF guard: revalidate before each fetch.
  const base = await validateHaUrl(haUrl);
  const url = new URL(
    `/api/history/period/${encodeURIComponent(startTime)}`,
    base
  );
  url.searchParams.set("filter_entity_id", entityId);
  url.searchParams.set("end_time", endTime);
  url.searchParams.set("minimal_response", "");
  url.searchParams.set("no_attributes", "");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
    redirect: "manual",
  });

  if (res.status >= 300 && res.status < 400) return [];
  if (!res.ok) return [];

  const data: HaStateEntry[][] = await res.json();
  if (!data.length || !data[0]) return [];

  const points: DataPoint[] = [];
  for (const entry of data[0]) {
    const value = parseFloat(entry.state);
    if (isNaN(value)) continue;
    points.push({ time: entry.last_changed, value });
  }

  return points;
}

async function fetchEntityUnit(
  haUrl: string,
  token: string,
  entityId: string
): Promise<string> {
  if (!entityId) return "";

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

  if (res.status >= 300 && res.status < 400) return "";
  if (!res.ok) return "";

  const data = await res.json();
  return data.attributes?.unit_of_measurement || "";
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { temp: null, humidity: null, error: "Unauthorized" } as HistoryResponse,
        { status: 401 }
      );
    }

    const idToken = authHeader.slice(7);
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json(
        { temp: null, humidity: null, error: "Auth not configured" } as HistoryResponse,
        { status: 500 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(idToken);

    // 2. Get user and verify tier
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true, tier: true },
    });
    if (!user || !hasFeature(user.tier as Tier, "haSensors")) {
      return NextResponse.json(
        { temp: null, humidity: null, error: "Cellar Pro required" } as HistoryResponse,
        { status: 403 }
      );
    }

    // 3. Get wall config
    const wallId = request.nextUrl.searchParams.get("wallId");
    if (!wallId) {
      return NextResponse.json(
        { temp: null, humidity: null, error: "wallId required" } as HistoryResponse,
        { status: 400 }
      );
    }

    const periodParam = request.nextUrl.searchParams.get("period") || "7d";
    if (!VALID_PERIODS.has(periodParam)) {
      return NextResponse.json(
        { temp: null, humidity: null, error: "Invalid period. Use 24h, 7d, or 30d" } as HistoryResponse,
        { status: 400 }
      );
    }
    const period = periodParam as Period;

    const wall = await prisma.wall.findFirst({
      where: { id: wallId, userId: user.id },
    });
    if (!wall) {
      return NextResponse.json(
        { temp: null, humidity: null, error: "Wall not found" } as HistoryResponse,
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (wall as any).haConfig as Record<string, string> | null;
    if (!config?.encryptedToken || !config?.haUrl) {
      return NextResponse.json(
        { temp: null, humidity: null, error: "No sensor configured" } as HistoryResponse,
        { status: 404 }
      );
    }

    // 4. Decrypt token and compute time range
    const token = decrypt(config.encryptedToken);
    const haUrl = config.haUrl;

    // Validate URL upfront (fail-fast before parallel fetches).
    try {
      await validateHaUrl(haUrl);
    } catch (e) {
      console.error("HA URL validation error:", e instanceof Error ? e.message : "rejected");
      return NextResponse.json(
        {
          temp: null,
          humidity: null,
          error: "Invalid Home Assistant URL",
        } as HistoryResponse,
        { status: 400 }
      );
    }

    const now = new Date();
    const startTime = new Date(
      now.getTime() - PERIOD_HOURS[period] * 60 * 60 * 1000
    );
    const startIso = startTime.toISOString();
    const endIso = now.toISOString();

    // 5. Fetch history and units in parallel
    const [tempHistory, humidityHistory, tempUnit, humidityUnit] =
      await Promise.all([
        fetchHaHistory(haUrl, token, config.tempEntityId, startIso, endIso),
        fetchHaHistory(
          haUrl,
          token,
          config.humidityEntityId,
          startIso,
          endIso
        ),
        fetchEntityUnit(haUrl, token, config.tempEntityId),
        fetchEntityUnit(haUrl, token, config.humidityEntityId),
      ]);

    // 6. Downsample and build response
    const temp: SeriesResponse | null = config.tempEntityId
      ? { data: downsample(tempHistory, MAX_POINTS), unit: tempUnit }
      : null;

    const humidity: SeriesResponse | null = config.humidityEntityId
      ? { data: downsample(humidityHistory, MAX_POINTS), unit: humidityUnit }
      : null;

    const response: HistoryResponse = {
      temp,
      humidity,
      ...(!temp && !humidity ? { error: "Could not read sensor history" } : {}),
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Sensor history error:", msg);
    return NextResponse.json(
      { temp: null, humidity: null, error: "Sensor error" } as HistoryResponse,
      { status: 500 }
    );
  }
}

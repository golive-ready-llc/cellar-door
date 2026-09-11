import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticateHaRequest, resolveHaWall } from "@/server/ha-access";
import { validateHaUrl } from "@/lib/ssrf-guard";
import type { DataPoint, HistoryResponse, SeriesResponse } from "@/types/ha";

type Period = "24h" | "7d" | "30d";

const PERIOD_HOURS: Record<Period, number> = {
  "24h": 24,
  "7d": 7 * 24,
  "30d": 30 * 24,
};

const VALID_PERIODS = new Set<string>(Object.keys(PERIOD_HOURS));
const MAX_POINTS = 100;

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
  entityId: string | undefined,
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
  entityId?: string
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

/** Both series null — the shape this route answers every failure with. */
function fail(message: string, status: number) {
  const body: HistoryResponse = { temp: null, humidity: null, error: message };
  return NextResponse.json(body, { status });
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate and confirm the caller's tier covers sensors
    const caller = await authenticateHaRequest(request);
    if (!caller.ok) return fail(caller.error, caller.status);

    // 2. Resolve the wall and the requested period
    const wallId = request.nextUrl.searchParams.get("wallId");
    if (!wallId) return fail("wallId required", 400);

    const periodParam = request.nextUrl.searchParams.get("period") || "7d";
    if (!VALID_PERIODS.has(periodParam)) {
      return fail("Invalid period. Use 24h, 7d, or 30d", 400);
    }
    const period = periodParam as Period;

    const access = await resolveHaWall(caller.userId, wallId);
    if (!access.ok) return fail(access.error, access.status);

    // 3. Compute the time range
    const now = new Date();
    const startTime = new Date(
      now.getTime() - PERIOD_HOURS[period] * 60 * 60 * 1000
    );
    const startIso = startTime.toISOString();
    const endIso = now.toISOString();

    // 4. Fetch history and units in parallel
    const [tempHistory, humidityHistory, tempUnit, humidityUnit] =
      await Promise.all([
        fetchHaHistory(
          access.haUrl,
          access.token,
          access.config.tempEntityId,
          startIso,
          endIso
        ),
        fetchHaHistory(
          access.haUrl,
          access.token,
          access.config.humidityEntityId,
          startIso,
          endIso
        ),
        fetchEntityUnit(access.haUrl, access.token, access.config.tempEntityId),
        fetchEntityUnit(
          access.haUrl,
          access.token,
          access.config.humidityEntityId
        ),
      ]);

    // 5. Downsample and build the response
    const temp: SeriesResponse | null = access.config.tempEntityId
      ? { data: downsample(tempHistory, MAX_POINTS), unit: tempUnit }
      : null;

    const humidity: SeriesResponse | null = access.config.humidityEntityId
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
    return fail("Sensor error", 500);
  }
}

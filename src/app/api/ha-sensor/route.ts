import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  authenticateHaRequest,
  resolveHaWall,
  type HaAccessFailure,
} from "@/server/ha-access";
import { validateHaUrl } from "@/lib/ssrf-guard";
import type { HaErrorResponse, SensorResponse, SensorValue } from "@/types/ha";

async function fetchHaEntity(
  haUrl: string,
  token: string,
  entityId?: string
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

/** An error with no readings to report. */
function error(message: string, status: number) {
  const body: HaErrorResponse = { error: message };
  return NextResponse.json(body, { status });
}

/** Both readings null — the shape a successful read has when HA answered
 *  nothing, and the shape an unusable wall URL answers with. */
function emptyReadings(message: string, status: number) {
  const body: SensorResponse = { temp: null, humidity: null, error: message };
  return NextResponse.json(body, { status });
}

function accessError(failure: HaAccessFailure) {
  return failure.reason === "url-rejected"
    ? emptyReadings(failure.error, failure.status)
    : error(failure.error, failure.status);
}

export async function GET(request: NextRequest) {
  try {
    const caller = await authenticateHaRequest(request);
    if (!caller.ok) return accessError(caller);

    const wallId = request.nextUrl.searchParams.get("wallId");
    if (!wallId) return error("wallId required", 400);

    const access = await resolveHaWall(caller.userId, wallId);
    if (!access.ok) return accessError(access);

    const [temp, humidity] = await Promise.all([
      fetchHaEntity(access.haUrl, access.token, access.config.tempEntityId),
      fetchHaEntity(access.haUrl, access.token, access.config.humidityEntityId),
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
    return emptyReadings("Sensor error", 500);
  }
}

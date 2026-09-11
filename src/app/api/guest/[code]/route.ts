import { NextResponse } from "next/server";
import { getGuestSession, voteForWine } from "@/server/actions/guest-sessions";

// Guest codes are 8 characters. 6-character codes issued before 2026-09-10
// stay valid until their sessions expire.
function isValidGuestCode(code: string | undefined): code is string {
  return !!code && /^[A-Z0-9]{6}(?:[A-Z0-9]{2})?$/i.test(code);
}

// GET /api/guest/[code] — public endpoint, returns cellar data for guest session
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!isValidGuestCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const session = await getGuestSession(code.toUpperCase());

  if (!session) {
    return NextResponse.json(
      { error: "Session not found or expired" },
      { status: 404 }
    );
  }

  return NextResponse.json(session);
}

// POST /api/guest/[code] — vote for a wine
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    let wineId: string;
    try {
      const body = await request.json();
      wineId = body.wineId;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!code || !wineId) {
      return NextResponse.json({ error: "Missing code or wineId" }, { status: 400 });
    }
    if (!isValidGuestCode(code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const votes = await voteForWine(code.toUpperCase(), wineId);

    if (!votes) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 }
      );
    }

    return NextResponse.json({ votes });
  } catch (err) {
    console.error("[guest POST]", err);
    return NextResponse.json(
      { error: "Failed to record vote" },
      { status: 500 }
    );
  }
}

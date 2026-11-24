import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, body } from "@/lib/api";
import { requestCreate } from "@/lib/validators";
import { createRequest } from "@/lib/services/request";
import { rateLimit } from "@/lib/ratelimit";
import { ApiError } from "@/lib/errors";

/** Unauthenticated citizen help request (rate-limited). Lands as PENDING until a coordinator verifies it. */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`public-req:${ip}`, 5, 10 * 60_000)) throw new ApiError(429, "Too many requests from this address. Please try again later.");
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))) throw new ApiError(403, "Cross-origin request blocked");
    const input = await body(req, requestCreate);
    const { incidentId: _i, force: _f, ...safe } = input; // citizens cannot link incidents or bypass duplicate detection
    const r = await createRequest(null, safe);
    return NextResponse.json({ id: r.id, status: r.status, message: "Request received. A coordinator will verify it shortly." }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

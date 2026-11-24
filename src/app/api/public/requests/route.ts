import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin, clientIp, errorResponse, body } from "@/lib/api";
import { requestCreate } from "@/lib/validators";
import { createRequest } from "@/lib/services/request";
import { rateLimit } from "@/lib/ratelimit";
import { ApiError } from "@/lib/errors";

/** Unauthenticated citizen help request (rate-limited). Lands as PENDING until a coordinator verifies it. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    if (!(await rateLimit(`public-req:${clientIp(req)}`, 5, 10 * 60_000))) throw new ApiError(429, "Too many requests from this address. Please try again later.");
    // Platform-wide ceiling: each request notifies every coordinator, so a distributed flood is capped as well.
    if (!(await rateLimit("public-req:all", 300, 60 * 60_000))) throw new ApiError(429, "We are receiving an unusually high number of requests. Please try again shortly or call your local emergency number.");
    const input = await body(req, requestCreate);
    const { incidentId: _i, force: _f, ...safe } = input; // citizens cannot link incidents or bypass duplicate detection
    const r = await createRequest(null, safe);
    return NextResponse.json({ id: r.id, status: r.status, message: "Request received. A coordinator will verify it shortly." }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { assertSameOrigin, clientIp, errorResponse, body } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { logActivity } from "@/lib/services/activity";
import { ApiError } from "@/lib/errors";

const DUMMY = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.lZ9Y4xYb3o5oQe5pS9cG0jXq1Z6e"; // constant-time-ish compare for unknown emails

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ip = clientIp(req);
    const { email, password } = await body(req, loginSchema);
    // Per network (slows credential stuffing across many accounts) and per network+account (slows password guessing).
    // Deliberately no per-account-only limit: that would let anyone lock a shared demo account out for everyone.
    if (!(await rateLimit(`login-ip:${ip}`, 30, 60_000)) || !(await rateLimit(`login:${ip}:${email}`, 8, 60_000)))
      throw new ApiError(429, "Too many attempts. Try again in a minute.");
    const user = await db.user.findUnique({ where: { email } });
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY);
    if (!user || !ok || !user.active) {
      await logActivity(db, { userId: user?.id, action: "LOGIN_FAILED", entityType: "User", entityId: user?.id, details: { email } });
      throw new ApiError(401, "Invalid email or password");
    }
    await createSession(user.id, user.sessionVersion);
    await logActivity(db, { userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });
    return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role } });
  } catch (e) {
    return errorResponse(e);
  }
}

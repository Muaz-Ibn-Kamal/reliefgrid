import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { registerSchema } from "@/lib/validators";
import { assertSameOrigin, errorResponse, body } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { ApiError } from "@/lib/errors";
import { logActivity } from "@/lib/services/activity";

/** Public self-registration creates VOLUNTEER accounts only. Privileged roles are provisioned by a System Admin. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`register:${ip}`, 5, 60_000)) throw new ApiError(429, "Too many attempts. Try again in a minute.");
    const d = await body(req, registerSchema);
    if (await db.user.findUnique({ where: { email: d.email } })) throw new ApiError(409, "An account with this email already exists");
    const user = await db.user.create({
      data: { email: d.email, name: d.name, phone: d.phone, role: "VOLUNTEER", passwordHash: await hashPassword(d.password), volunteer: { create: { skills: d.skills } } },
    });
    await logActivity(db, { userId: user.id, action: "VOLUNTEER_REGISTERED", entityType: "User", entityId: user.id });
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role } }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

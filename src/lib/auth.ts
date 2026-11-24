import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { hashPassword, verifyPassword } from "./password";
import { db } from "./db";
import { unauthorized, forbidden } from "./errors";
import type { Role } from "@/generated/prisma/client";

export const COOKIE = "rg_session";
const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(s);
};

export { hashPassword, verifyPassword };

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string | null;
};

/** Reads the cookie, verifies the JWT and re-loads the user so deactivation / role changes apply immediately. */
export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const u = await db.user.findUnique({
      where: { id: String(payload.sub) },
      select: { id: true, email: true, name: true, role: true, organizationId: true, active: true },
    });
    if (!u || !u.active) return null;
    const { active: _a, ...rest } = u;
    return rest;
  } catch {
    return null;
  }
}

export async function requireUser(roles?: readonly Role[]): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw unauthorized();
  if (roles && !roles.includes(u.role)) throw forbidden();
  return u;
}

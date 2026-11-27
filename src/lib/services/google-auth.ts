import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { hashPassword } from "../password";
import { ApiError } from "../errors";
import { DEMO_ACCOUNTS, demoMode } from "../demo";
import { logActivity } from "./activity";
import type { GoogleProfile } from "../google";

/**
 * Turns a verified Google identity into a ReliefGrid account.
 * - An existing, active account with the same (Google-verified) email signs in as itself.
 * - Otherwise a VOLUNTEER account is created, exactly like the public registration form. Privileged roles are still
 *   provisioned by a System Admin, so Google can never be used to gain a role.
 * Google accounts get a random password nobody knows, so they can only sign in through Google.
 */
export async function userFromGoogleProfile(p: GoogleProfile) {
  const email = p.email.trim().toLowerCase();
  if (demoMode() && DEMO_ACCOUNTS.includes(email)) throw new ApiError(403, "The shared demo accounts cannot use Google sign-in");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.active) throw new ApiError(403, "This account is disabled");
    await logActivity(db, { userId: existing.id, action: "LOGIN_GOOGLE", entityType: "User", entityId: existing.id });
    return { user: existing, created: false };
  }

  const local = email.split("@")[0];
  const name = (p.name?.trim() || local).slice(0, 100).padEnd(2, "_");
  try {
    const user = await db.user.create({
      data: { email, name, role: "VOLUNTEER", passwordHash: await hashPassword(randomBytes(32).toString("base64url")), volunteer: { create: { skills: [] } } },
    });
    await logActivity(db, { userId: user.id, action: "VOLUNTEER_REGISTERED", entityType: "User", entityId: user.id, details: { via: "google" } });
    return { user, created: true };
  } catch (e) {
    // Two first sign-ins racing each other: the second one just signs in as the account the first created.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      if (!user.active) throw new ApiError(403, "This account is disabled");
      return { user, created: false };
    }
    throw e;
  }
}

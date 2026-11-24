import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/client";
import { ApiError, forbidden, badRequest } from "./errors";
import { requireUser, type SessionUser } from "./auth";

type Ctx<P> = { user: SessionUser; req: NextRequest; params: P; sp: URLSearchParams };
type RouteCtx = { params: Promise<Record<string, string>> };

/** Wraps a route handler: auth + role gate + CSRF origin check + uniform JSON errors. */
export function route<P = Record<string, string>>(
  opts: { roles?: readonly Role[]; public?: boolean },
  handler: (c: Ctx<P> & { user: SessionUser }) => Promise<unknown>,
) {
  return async (req: NextRequest, rc: RouteCtx) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      const user = opts.public ? (null as unknown as SessionUser) : await requireUser(opts.roles);
      const params = (await rc.params) as P;
      const result = await handler({ user, req, params, sp: req.nextUrl.searchParams });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Rejects state-changing requests whose Origin header names another site (CSRF defence for cookie sessions). */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (new URL(origin).host !== host) throw forbidden("Cross-origin request blocked");
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
  if (e instanceof ZodError)
    return NextResponse.json(
      { error: "Validation failed", details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return NextResponse.json({ error: "A record with these values already exists" }, { status: 409 });
    if (e.code === "P2025") return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }
  unstable_rethrow(e); // let Next.js control-flow errors (prerender aborts, redirects) propagate instead of becoming 500s
  console.error("[api] unhandled", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function body<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(json);
}

export function page(sp: URLSearchParams) {
  const p = Math.max(1, Number(sp.get("page")) || 1);
  const size = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 20));
  return { page: p, pageSize: size, skip: (p - 1) * size, take: size };
}

export const paged = <T>(data: T[], total: number, pg: { page: number; pageSize: number }) => ({
  data,
  meta: { page: pg.page, pageSize: pg.pageSize, total, totalPages: Math.max(1, Math.ceil(total / pg.pageSize)) },
});

export const enumParam = <T extends string>(sp: URLSearchParams, key: string, allowed: readonly T[]): T | undefined => {
  const v = sp.get(key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
};

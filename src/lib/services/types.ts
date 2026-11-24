import type { Role } from "@/generated/prisma/client";
export type SessionUserLike = { id: string; role: Role; organizationId: string | null; name?: string };

import { db } from "../db";
import { ApiError } from "../errors";
import { rateLimit } from "../ratelimit";

/** Images live in Postgres, so storage is the scarce resource: cap the rate, each account's share and the total. */
export const UPLOAD_LIMITS = { perHour: 20, perUserBytes: 25 * 1024 * 1024, totalBytes: 200 * 1024 * 1024 } as const;

export async function assertUploadAllowed(userId: string, bytes: number) {
  if (!(await rateLimit(`upload:${userId}`, UPLOAD_LIMITS.perHour, 60 * 60_000)))
    throw new ApiError(429, `Upload limit reached (${UPLOAD_LIMITS.perHour} images per hour). Try again later.`);
  const [mine, all] = await Promise.all([
    db.upload.aggregate({ where: { uploadedById: userId }, _sum: { size: true } }),
    db.upload.aggregate({ _sum: { size: true } }),
  ]);
  if ((mine._sum.size ?? 0) + bytes > UPLOAD_LIMITS.perUserBytes) throw new ApiError(413, "You have used your 25 MB image allowance");
  if ((all._sum.size ?? 0) + bytes > UPLOAD_LIMITS.totalBytes) throw new ApiError(507, "Image storage is full. Ask an administrator to free space");
}

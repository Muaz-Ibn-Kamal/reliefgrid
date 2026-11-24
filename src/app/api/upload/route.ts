import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { ApiError, badRequest } from "@/lib/errors";
import { assertUploadAllowed } from "@/lib/services/upload";

const MAX_BYTES = 5 * 1024 * 1024;
/** Allowed image types with their file signatures; the declared MIME type alone is never trusted. */
const TYPES: Record<string, { magic: number[]; at8?: number[] }> = {
  "image/jpeg": { magic: [0xff, 0xd8, 0xff] },
  "image/png": { magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  "image/webp": { magic: [0x52, 0x49, 0x46, 0x46], at8: [0x57, 0x45, 0x42, 0x50] }, // "RIFF" .... "WEBP"
};

/**
 * Image upload: 5 MB cap, MIME allow-list AND magic-byte check. Bytes are stored in Postgres (works on serverless
 * hosts with read-only filesystems) and served only to signed-in users through GET /api/uploads/:id.
 */
export const POST = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "VOLUNTEER", "SHELTER_MANAGER"] }, async ({ user, req }) => {
  // Refuse oversized bodies before they are buffered (the multipart envelope adds a little over the file itself).
  const declared = Number(req.headers.get("content-length"));
  if (!declared) throw new ApiError(411, "Content-Length is required");
  if (declared > MAX_BYTES + 64 * 1024) throw new ApiError(413, "Image must be 5 MB or smaller");
  const form = await req.formData().catch(() => { throw badRequest("Expected multipart/form-data"); });
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("file is required");
  if (file.size === 0) throw badRequest("File is empty");
  if (file.size > MAX_BYTES) throw badRequest("Image must be 5 MB or smaller");
  const t = TYPES[file.type];
  if (!t) throw badRequest("Only JPEG, PNG or WebP images are allowed");
  const buf = Buffer.from(await file.arrayBuffer());
  const sigOk = t.magic.every((b, i) => buf[i] === b) && (!t.at8 || t.at8.every((b, i) => buf[8 + i] === b));
  if (!sigOk) throw badRequest("File content does not match its type");
  await assertUploadAllowed(user.id, buf.length);
  const up = await db.upload.create({ data: { contentType: file.type, size: buf.length, data: buf, uploadedById: user.id }, select: { id: true } });
  return { url: `/api/uploads/${up.id}` };
});

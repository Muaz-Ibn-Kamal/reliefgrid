import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";

/** Serves an uploaded image to any signed-in user. Images can show people in distress, so they are never public. */
export const GET = route<{ id: string }>({}, async ({ params }) => {
  if (!/^[a-z0-9]{20,40}$/.test(params.id)) throw notFound("Image not found");
  const up = await db.upload.findUnique({ where: { id: params.id }, select: { contentType: true, size: true, data: true } });
  if (!up) throw notFound("Image not found");
  return new Response(new Uint8Array(up.data), {
    headers: {
      "Content-Type": up.contentType,
      "Content-Length": String(up.size),
      "Cache-Control": "private, max-age=31536000, immutable", // content-addressed by id; never changes
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});

import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { ApiError } from "@/lib/errors";

const TICK_MS = 3000;
const MAX_STREAM_MS = 4 * 60_000; // end streams periodically (serverless-friendly); EventSource reconnects on its own

/**
 * Server-Sent Events: pushes `change` events naming the entity types that changed (from the activity log), so open
 * pages revalidate immediately instead of waiting for their polling interval. Carries no record data or ids:
 * clients refetch through the normal, permission-checked endpoints.
 */
export const GET = route({}, async ({ user, req }) => {
  // Each open stream holds a function instance; cap how often one account can (re)open them.
  if (!(await rateLimit(`sse:${user.id}`, 60, 10 * 60_000))) throw new ApiError(429, "Too many live-update connections; pages still refresh on their own");
  const enc = new TextEncoder();
  const started = Date.now();
  let last = new Date();
  let ticks = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = undefined;
        try { controller.close(); } catch { /* already closed */ }
      };
      const send = (chunk: string) => { try { controller.enqueue(enc.encode(chunk)); } catch { stop(); } };

      send("retry: 5000\nevent: ready\ndata: {}\n\n");
      req.signal.addEventListener("abort", stop);
      timer = setInterval(async () => {
        if (req.signal.aborted || Date.now() - started > MAX_STREAM_MS) return stop();
        try {
          const rows = await db.activityLog.findMany({
            where: { createdAt: { gt: last } }, orderBy: { createdAt: "asc" }, take: 200, select: { entityType: true, createdAt: true },
          });
          if (rows.length) {
            last = rows[rows.length - 1].createdAt;
            send(`event: change\ndata: ${JSON.stringify({ entities: [...new Set(rows.map((r) => r.entityType))] })}\n\n`);
          } else if (++ticks % 5 === 0) {
            send(": keep-alive\n\n");
          }
        } catch {
          /* transient DB error: retry on the next tick; polling on the client is the fallback */
        }
      }, TICK_MS);
    },
    cancel() { if (timer) clearInterval(timer); },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
});

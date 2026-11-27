import { Suspense, type ReactNode } from "react";
import { guardPage } from "@/lib/guard";
import { Spinner } from "./ui";

/** Shown while a page checks the session; it is the page's static shell, so navigation renders it instantly. */
export function PageLoading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner text="Loading…" />
    </div>
  );
}

async function Gate({ href, children }: { href: string; children: ReactNode }) {
  await guardPage(href);
  return children;
}

/**
 * Runs the page's role check behind its own Suspense boundary. With Cache Components and partial prefetching,
 * reading the session (cookie + database) outside a boundary would block every navigation into the page.
 */
export function Guarded({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Gate href={href}>{children}</Gate>
    </Suspense>
  );
}

import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import "./auth.css";

/**
 * Sends visitors who are already signed in on to the dashboard. It uses the full session check (signature, account,
 * session version), so a stale cookie leaves the visitor on the form instead of bouncing them back to the app.
 */
async function RedirectIfSignedIn() {
  if (await getUser()) redirect("/dashboard");
  return null;
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
    </>
  );
}

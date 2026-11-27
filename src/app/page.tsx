import { redirect } from "next/navigation";

/**
 * The proxy sends every visitor at "/" on before this renders: to /dashboard with a session cookie, to /login without.
 * This is only a fallback, so it reads no session; /dashboard re-checks the session and sends anyone invalid to /login.
 */
export default function Home() {
  redirect("/dashboard");
}

import { Suspense } from "react";
import { connection } from "next/server";
import { googleConfigured } from "@/lib/google";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

/** The Google button only appears when the server has Google credentials, so it is decided per request rather than baked in at build time. */
async function Login() {
  await connection();
  return <LoginForm google={googleConfigured()} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

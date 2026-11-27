import { Suspense } from "react";
import { connection } from "next/server";
import { googleConfigured } from "@/lib/google";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Volunteer registration" };

async function Register() {
  await connection();
  return <RegisterForm google={googleConfigured()} />;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <Register />
    </Suspense>
  );
}

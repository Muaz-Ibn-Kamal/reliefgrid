import type { Metadata } from "next";
import Link from "next/link";
import { HelpClient } from "./_client";

export const metadata: Metadata = { title: "Request emergency assistance", description: "Ask for food, water, medical supplies, shelter, rescue or transport." };

export default function HelpPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl p-4 sm:p-8">
      <header className="mb-5">
        <Link href="/login" className="text-sm text-orange-800 hover:underline dark:text-orange-400">← Staff sign in</Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Request emergency assistance</h1>
        <p className="mt-1 text-slate-700 dark:text-slate-300">Tell us what you need and where you are. A coordinator will verify and route your request to relief teams.</p>
        <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-900 dark:bg-red-950/40 dark:text-red-200">In immediate danger? Call your local emergency number first. This form is not monitored as a 24/7 hotline.</p>
      </header>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><HelpClient /></div>
    </main>
  );
}

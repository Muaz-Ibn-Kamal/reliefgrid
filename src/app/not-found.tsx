import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <p className="text-sm font-medium text-slate-500">404</p>
        <h1 className="mt-1 text-2xl font-bold">Page not found</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">The page you requested does not exist or has moved.</p>
        <div className="mt-4 flex justify-center gap-3 text-sm font-medium"><Link className="link" href="/dashboard">Go to dashboard</Link><Link className="link" href="/help">Request assistance</Link></div>
      </div>
    </main>
  );
}

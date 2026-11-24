"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, BarChart3, Boxes, ClipboardCheck, Home, LayoutDashboard, LifeBuoy, LogOut, Map, Menu, Moon, Shield, Siren, Sun, Truck, UserCog, Users, UsersRound, X } from "lucide-react";
import { api, ago, useApi } from "@/lib/client";
import { ROLE_LABEL, type RoleName } from "@/lib/constants";
import { cx } from "./ui";
import { LiveUpdates } from "./live-updates";

const ICONS = { LayoutDashboard, Siren, LifeBuoy, Boxes, Truck, Home, ClipboardCheck, Users, UsersRound, Map, BarChart3, Shield, UserCog } as const;
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };
type Notif = { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

function ThemeToggle() {
  // Icon swap is pure CSS (dark: variant) so there is no state to sync with the <html> class set by the inline theme script.
  return (
    <button aria-label="Toggle dark mode" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
      onClick={() => { const n = !document.documentElement.classList.contains("dark"); document.documentElement.classList.toggle("dark", n); try { localStorage.setItem("rg-theme", n ? "dark" : "light"); } catch {} }}>
      <Moon className="h-5 w-5 dark:hidden" /><Sun className="hidden h-5 w-5 dark:block" />
    </button>
  );
}

function Bell_() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data, mutate } = useApi<{ items: Notif[]; unread: number }>("/api/notifications", 15000);
  return (
    <div className="relative">
      <button aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ""}`} aria-expanded={open} className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setOpen((o) => !o)}>
        <Bell className="h-5 w-5" />
        {!!data?.unread && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <span className="text-sm font-semibold">Notifications</span>
            <button className="text-xs text-orange-700 hover:underline dark:text-orange-400" onClick={async () => { await api("/api/notifications", { method: "PATCH", json: {} }); mutate(); }}>Mark all read</button>
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {!data?.items.length && <li className="p-4 text-center text-sm text-slate-500">You&apos;re all caught up.</li>}
            {data?.items.map((n) => (
              <li key={n.id}>
                <button className={cx("w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800", !n.read && "bg-orange-50/60 dark:bg-orange-950/20")}
                  onClick={async () => { setOpen(false); if (!n.read) { await api("/api/notifications", { method: "PATCH", json: { ids: [n.id] } }); mutate(); } if (n.link) router.push(n.link); }}>
                  <div className="text-sm font-medium">{n.title}</div><div className="text-xs text-slate-600 dark:text-slate-400">{n.body}</div><div className="mt-0.5 text-[11px] text-slate-400">{ago(n.createdAt)}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Shell({ nav, user, children }: { nav: NavItem[]; user: { name: string; role: RoleName; org?: string | null }; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const links = (
    <nav aria-label="Main" className="space-y-0.5 p-3">
      {nav.map((n) => {
        const Icon = ICONS[n.icon]; const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link key={n.href} href={n.href} onClick={() => setMobile(false)} aria-current={active ? "page" : undefined}
            className={cx("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden />{n.label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:p-2">Skip to content</a>
      <aside className="hidden print:hidden w-60 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <Link href="/dashboard" className="flex items-center gap-2 px-5 py-4 text-lg font-extrabold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-700 text-white">R</span>ReliefGrid</Link>
          <div className="flex-1 overflow-y-auto">{links}</div>
        </div>
      </aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobile(false)} />
          <div className="relative h-full w-64 overflow-y-auto bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between px-5 py-4"><span className="text-lg font-extrabold">ReliefGrid</span><button aria-label="Close menu" onClick={() => setMobile(false)}><X className="h-5 w-5" /></button></div>{links}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 print:hidden flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" aria-label="Open menu" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></button>
          <div className="ml-auto flex items-center gap-1">
            <LiveUpdates />
            <div className="mr-2 hidden text-right sm:block"><div className="text-sm font-semibold leading-tight">{user.name}</div><div className="text-xs text-slate-500">{ROLE_LABEL[user.role]}{user.org ? ` · ${user.org}` : ""}</div></div>
            <Bell_ /><ThemeToggle />
            <button aria-label="Sign out" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={async () => { await api("/api/auth/logout", { method: "POST", json: {} }); router.replace("/login"); router.refresh(); }}><LogOut className="h-5 w-5" /></button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

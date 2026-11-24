"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, BarChart3, Boxes, ClipboardCheck, Home, LayoutDashboard, LifeBuoy, LogOut, Map, Menu, Moon, Shield, Siren, Sun, Truck, UserCog, Users, UsersRound, X } from "lucide-react";
import { api, ago, useApi } from "@/lib/client";
import { ROLE_LABEL, type RoleName } from "@/lib/constants";
import { Logo, cx } from "./ui";
import { LiveUpdates } from "./live-updates";

const ICONS = { LayoutDashboard, Siren, LifeBuoy, Boxes, Truck, Home, ClipboardCheck, Users, UsersRound, Map, BarChart3, Shield, UserCog } as const;
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };
type Notif = { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

const iconBtn = "rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white";

function ThemeToggle() {
  // Icon swap is pure CSS (dark: variant), so nothing has to sync with the class set by the inline theme script.
  return (
    <button aria-label="Toggle dark mode" className={iconBtn}
      onClick={() => { const n = !document.documentElement.classList.contains("dark"); document.documentElement.classList.toggle("dark", n); try { localStorage.setItem("rg-theme", n ? "dark" : "light"); } catch {} }}>
      <Moon className="h-[18px] w-[18px] dark:hidden" /><Sun className="hidden h-[18px] w-[18px] dark:block" />
    </button>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data, mutate } = useApi<{ items: Notif[]; unread: number }>("/api/notifications", 15000);
  return (
    <div className="relative">
      <button aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ""}`} aria-expanded={open} className={cx(iconBtn, "relative")} onClick={() => setOpen((o) => !o)}>
        <Bell className="h-[18px] w-[18px]" />
        {!!data?.unread && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-triage-critical px-1 text-[10px] font-semibold leading-none text-white">{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            <button className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={async () => { await api("/api/notifications", { method: "PATCH", json: {} }); mutate(); }}>Mark all read</button>
          </div>
          <ul className="max-h-96 overflow-y-auto border-t border-slate-100 dark:border-slate-800">
            {!data?.items.length && <li className="px-4 py-8 text-center text-sm text-slate-500">No notifications.</li>}
            {data?.items.map((n) => (
              <li key={n.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <button className="flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  onClick={async () => { setOpen(false); if (!n.read) { await api("/api/notifications", { method: "PATCH", json: { ids: [n.id] } }); mutate(); } if (n.link) router.push(n.link); }}>
                  <span aria-hidden className={cx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-signal-info")} />
                  <span className="min-w-0"><span className={cx("block text-sm", !n.read && "font-semibold")}>{n.title}</span><span className="block text-xs text-slate-600 dark:text-slate-400">{n.body}</span><span className="mt-0.5 block text-[11px] text-slate-400">{ago(n.createdAt)}</span></span>
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
  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
      <Logo className="text-slate-900 dark:text-white" />ReliefGrid
    </Link>
  );
  const links = (
    <nav aria-label="Main" className="space-y-px px-3 py-2">
      {nav.map((n) => {
        const Icon = ICONS[n.icon]; const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link key={n.href} href={n.href} onClick={() => setMobile(false)} aria-current={active ? "page" : undefined}
            className={cx("flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px]",
              active ? "bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white")}>
            <Icon className={cx("h-4 w-4 shrink-0", active ? "text-slate-900 dark:text-white" : "text-slate-400")} aria-hidden />{n.label}
          </Link>
        );
      })}
    </nav>
  );
  const account = (
    <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
      <div className="truncate text-sm font-medium">{user.name}</div>
      <div className="truncate text-xs text-slate-500 dark:text-slate-400">{ROLE_LABEL[user.role]}{user.org ? `, ${user.org}` : ""}</div>
    </div>
  );
  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-white focus:p-2">Skip to content</a>
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white print:hidden lg:block dark:border-slate-800 dark:bg-slate-900">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex h-14 items-center px-5">{brand}</div>
          <div className="flex-1 overflow-y-auto">{links}</div>
          {account}
        </div>
      </aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setMobile(false)} />
          <div className="relative flex h-full w-64 flex-col bg-white dark:bg-slate-900">
            <div className="flex h-14 items-center justify-between px-5">{brand}<button aria-label="Close menu" className={iconBtn} onClick={() => setMobile(false)}><X className="h-[18px] w-[18px]" /></button></div>
            <div className="flex-1 overflow-y-auto">{links}</div>
            {account}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-slate-50/85 px-4 backdrop-blur print:hidden sm:px-6 dark:border-slate-800 dark:bg-slate-950/85">
          <button className={cx(iconBtn, "lg:hidden")} aria-label="Open menu" onClick={() => setMobile(true)}><Menu className="h-[18px] w-[18px]" /></button>
          <div className="lg:hidden">{brand}</div>
          <div className="ml-auto flex items-center gap-1">
            <LiveUpdates />
            <Notifications /><ThemeToggle />
            <button aria-label="Sign out" className={iconBtn} onClick={async () => { await api("/api/auth/logout", { method: "POST", json: {} }); router.replace("/login"); router.refresh(); }}><LogOut className="h-[18px] w-[18px]" /></button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: { default: "ReliefGrid — Disaster Response Coordination", template: "%s · ReliefGrid" },
  description: "Coordinate incidents, emergency requests, relief resources, shelters and volunteers on one platform.",
};

const themeScript = `try{var t=localStorage.getItem('rg-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen"><ToastProvider><Suspense fallback={null}>{children}</Suspense></ToastProvider></body>
    </html>
  );
}

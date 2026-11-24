import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@fontsource-variable/public-sans";
import "./globals.css";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: { default: "ReliefGrid: disaster response coordination", template: "%s · ReliefGrid" },
  description: "Coordinate incidents, emergency requests, relief resources, shelters and volunteers on one platform.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1114" },
  ],
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

import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { RouteProgress } from "@/components/route-progress";
import { auth } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Roost — Household projects",
  description: "Plan and track every household project in one place.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Roost" },
};

export const viewport: Viewport = {
  themeColor: "#0f1626",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh">
        <RouteProgress />
        {session?.user ? (
          <>
            <Sidebar userName={session.user.name ?? session.user.email} />
            <main className="md:pl-64 pb-24 md:pb-10">
              <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">{children}</div>
            </main>
            <MobileNav />
          </>
        ) : (
          <main className="min-h-dvh">{children}</main>
        )}
      </body>
    </html>
  );
}

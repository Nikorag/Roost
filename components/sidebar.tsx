"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  Hammer,
  Home,
  ListTodo,
  PackageOpen,
  UsersRound,
  Wrench,
  ClipboardList,
  LogOut,
  UtensilsCrossed,
  Settings,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const links = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/projects", label: "Projects", icon: ClipboardList },
  { href: "/my/tasks", label: "My Tasks", icon: CheckSquare },
  { href: "/my/actions", label: "My Actions", icon: ListTodo },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/contractors", label: "Contractors", icon: Hammer },
  { href: "/personnel", label: "People", icon: UsersRound },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/materials", label: "Materials", icon: PackageOpen },
];

export function Sidebar({ userName }: { userName?: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 border-r bg-card/60">
      <div className="px-6 pt-6 pb-4">
        <Logo />
      </div>
      <nav className="flex-1 px-3 py-2 space-y-1">
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-pastel-mint/70 text-emerald-900 font-medium"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <Icon className="size-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-5 pt-3 border-t mx-3">
        <div className="px-2 py-2 text-xs text-muted-foreground truncate">{userName ?? "Signed in"}</div>
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-foreground/70 hover:bg-muted"
        >
          <Settings className="size-4" />
          Settings
        </Link>
        <Link
          href="/api/auth/signout"
          className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-foreground/70 hover:bg-muted"
        >
          <LogOut className="size-4" />
          Sign out
        </Link>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryHrefs = new Set(["/", "/projects", "/meals", "/settings"]);
  const primary = [
    links.find((l) => l.href === "/")!,
    links.find((l) => l.href === "/projects")!,
    links.find((l) => l.href === "/meals")!,
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  const overflow = links.filter((l) => !primaryHrefs.has(l.href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const overflowActive = overflow.some((l) => pathname.startsWith(l.href));

  return (
    <>
      {moreOpen ? (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/30"
          onClick={() => setMoreOpen(false)}
          aria-hidden
        />
      ) : null}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass border-t px-2 pb-[env(safe-area-inset-bottom)]">
        {moreOpen ? (
          <div className="border-b py-2 px-1 grid grid-cols-4 gap-1">
            {overflow.map((l) => {
              const active = pathname.startsWith(l.href);
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-2 py-2 rounded-2xl text-[11px]",
                    active ? "text-emerald-700" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  {l.label}
                </Link>
              );
            })}
            <Link
              href="/api/auth/signout"
              className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-2xl text-[11px] text-muted-foreground"
            >
              <LogOut className="size-5" />
              Sign out
            </Link>
          </div>
        ) : null}
        <div className="flex items-stretch justify-around py-1.5">
          {primary.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl text-[11px]",
                  active ? "text-emerald-700" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {l.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-label="More"
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl text-[11px]",
              moreOpen || overflowActive ? "text-emerald-700" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="size-5" />
            More
          </button>
        </div>
      </nav>
    </>
  );
}

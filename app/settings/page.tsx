import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, CalendarDays, ChevronRight, UsersRound } from "lucide-react";

const items = [
  {
    href: "/settings/household",
    title: "Household profile",
    description:
      "Tell the AI about your family so it interprets calendar events with the right tone.",
    icon: UsersRound,
  },
  {
    href: "/settings/calendars",
    title: "Calendars",
    description: "Connect a Google calendar (ICS) so the AI knows what's on your week.",
    icon: CalendarDays,
  },
  {
    href: "/settings/ai",
    title: "AI prompts",
    description: "Tune global and per-feature instructions for the AI.",
    icon: Sparkles,
  },
] as const;

export default function SettingsHome() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </header>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => {
          const Icon = i.icon;
          return (
            <Link key={i.href} href={i.href}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-pastel-sky/60 flex items-center justify-center">
                    <Icon className="size-5 text-blue-800" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{i.title}</div>
                    <div className="text-xs text-muted-foreground">{i.description}</div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

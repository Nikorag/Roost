import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackToMeals({ label = "Meals" }: { label?: string }) {
  return (
    <Link
      href="/meals"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" /> {label}
    </Link>
  );
}

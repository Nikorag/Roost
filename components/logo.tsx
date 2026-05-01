import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-9 shrink-0", className)}
      role="img"
      aria-label="Roost"
    >
      <rect width="64" height="64" rx="14" fill="#cdeedd" />
      <circle cx="44" cy="20" r="4" fill="#ffd1a8" />
      <path
        d="M14 32 L32 16 L50 32 L50 46 a4 4 0 0 1 -4 4 H18 a4 4 0 0 1 -4 -4 Z"
        fill="#1f9e84"
      />
      <rect x="28.5" y="36" width="7" height="14" rx="2" fill="#cdeedd" />
      <circle cx="22" cy="32" r="2.2" fill="#cdeedd" />
      <circle cx="42" cy="32" r="2.2" fill="#cdeedd" />
    </svg>
  );
}

export function Logo({
  subtitle = "Household projects",
  className,
}: {
  subtitle?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <div>
        <div className="font-semibold leading-none tracking-tight">Roost</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

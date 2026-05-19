import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents?: number | null) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "GBP" });
}

export function formatDate(d?: Date | string | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(d?: Date | string | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const PROJECT_STATUSES = [
  "idea",
  "planning",
  "in_progress",
  "blocked",
  "completed",
  "archived",
] as const;

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export const ACTION_STATUSES = ["open", "doing", "done", "cancelled"] as const;

export const STATUS_LABEL: Record<string, string> = {
  idea: "Idea",
  planning: "Planning",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
  todo: "To do",
  done: "Done",
  open: "Open",
  doing: "Doing",
  cancelled: "Cancelled",
};

/** Priority order when picking a single hero image for a project card. */
export const IMAGE_KIND_PRIORITY: Record<string, number> = {
  after: 0,
  before: 1,
  progress: 2,
  other: 3,
};

export const STATUS_TINT: Record<string, string> = {
  idea: "bg-pastel-lemon text-yellow-900",
  planning: "bg-pastel-sky text-sky-900",
  in_progress: "bg-pastel-sky text-blue-900",
  blocked: "bg-pastel-rose text-rose-900",
  completed: "bg-pastel-sage text-green-900",
  archived: "bg-muted text-muted-foreground",
  todo: "bg-pastel-sky text-sky-900",
  done: "bg-pastel-sky text-blue-900",
  open: "bg-pastel-peach text-orange-900",
  doing: "bg-pastel-lilac text-purple-900",
  cancelled: "bg-muted text-muted-foreground",
};

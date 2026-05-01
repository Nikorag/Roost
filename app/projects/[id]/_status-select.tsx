"use client";
import { useTransition } from "react";

export function ProjectStatusSelect({
  id,
  current,
  options,
  action,
}: {
  id: string;
  current: string;
  options: { value: string; label: string }[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={current}
        disabled={pending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("status", e.currentTarget.value);
          fd.set("id", id);
          start(() => action(fd));
        }}
        className="h-9 rounded-full border bg-background px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}

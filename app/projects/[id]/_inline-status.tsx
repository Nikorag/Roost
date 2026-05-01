"use client";
import { useTransition } from "react";

export function InlineStatusSelect({
  current,
  options,
  action,
}: {
  current: string;
  options: { value: string; label: string }[];
  action: (status: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={current}
      disabled={pending}
      onChange={(e) => {
        const v = e.currentTarget.value;
        start(() => action(v));
      }}
      className="text-xs rounded-full border bg-background px-2 py-1"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

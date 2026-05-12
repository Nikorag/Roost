"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);
  const lastPath = useRef<string | null>(null);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const start = () => {
    clearTimers();
    setVisible(true);
    setProgress(8);
    let p = 8;
    const tick = () => {
      p = Math.min(90, p + Math.max(0.4, (90 - p) * 0.08));
      setProgress(p);
      if (p < 90) {
        const t = window.setTimeout(tick, 140);
        timers.current.push(t);
      }
    };
    const t = window.setTimeout(tick, 80);
    timers.current.push(t);
  };

  const finish = () => {
    clearTimers();
    setProgress(100);
    const t1 = window.setTimeout(() => setVisible(false), 220);
    const t2 = window.setTimeout(() => setProgress(0), 460);
    timers.current.push(t1, t2);
  };

  useEffect(() => {
    if (lastPath.current !== null && lastPath.current !== pathname) {
      finish();
    }
    lastPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, []);

  return (
    <div
      aria-hidden={!visible}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="fixed top-0 inset-x-0 z-[100] h-0.5 pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 220ms ease-out" }}
    >
      <div
        className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.65)]"
        style={{ width: `${progress}%`, transition: "width 220ms ease-out" }}
      />
    </div>
  );
}

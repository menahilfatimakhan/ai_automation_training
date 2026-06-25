"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const EVENT = "app:toast";

/** Fire a toast from anywhere on the client. No-op during SSR. */
export function toast(message: string, type: ToastType = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, type } }));
}

/** Mounts once; renders the stacked toast notifications. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let counter = 0;
    function onToast(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string; type: ToastType };
      const id = ++counter;
      setItems((cur) => [...cur, { id, ...detail }]);
      setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 3500);
    }
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm shadow-pop ${
            t.type === "error"
              ? "border-accent-rose/40 bg-surface text-accent-rose"
              : "border-brand/40 bg-surface text-ink"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              t.type === "error" ? "bg-accent-rose" : "bg-brand"
            }`}
          />
          {t.message}
        </div>
      ))}
    </div>
  );
}

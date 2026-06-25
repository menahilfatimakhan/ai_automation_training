"use client";

import { useEffect, useRef, useState } from "react";
import { formatMetric } from "@/components/format-value";
import type { MetricFormat } from "@/lib/data/master";

/**
 * Counts up to `value` on mount for a subtle, polished reveal. Honors
 * prefers-reduced-motion (renders the final value immediately).
 */
export function AnimatedNumber({
  value,
  format,
  currency = "USD",
  duration = 700,
}: {
  value: number;
  format: MetricFormat;
  currency?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === 0) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return <>{formatMetric(display, format, currency)}</>;
}

import {
  formatMoney,
  formatMultiple,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { MetricFormat } from "@/lib/data/master";

/** Render a metric value according to its format. */
export function formatMetric(
  value: number,
  format: MetricFormat,
  currency = "USD",
): string {
  switch (format) {
    case "money":
      return formatMoney(value, currency);
    case "percent":
      return formatPercent(value);
    case "multiple":
      return formatMultiple(value);
    case "number":
      return formatNumber(value);
  }
}

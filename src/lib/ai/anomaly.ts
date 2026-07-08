import { getProviders } from "@/providers/registry";
import { bucketOf } from "@/domain/metrics";
import { loadAdMetrics, loadCalls, toCallRecords } from "@/lib/data/dashboards";
import { daysAgoIso, todayIso } from "@/lib/format";
import { checkSeries, type AnomalyResult } from "@/lib/ai/anomaly-core";

export type { AnomalyResult };

/**
 * Anomaly detection: compares today's daily value for a handful of key
 * metrics against the trailing 28-day average (the 28 days *before* today).
 * A drop of more than 20% below that average is a warning; more than 35% is
 * critical. Run every 4 hours by the scheduler (Step 8) — the comparator
 * itself (anomaly-core.ts) is pure; this module wires it to real data and
 * delivery.
 *
 * Metrics are computed here in TypeScript from raw rows, same as every other
 * KPI — the AI is never involved in detecting or scoring the anomaly itself.
 */

interface ClientInfo {
  id: string;
  name: string;
  currency: string;
}

/**
 * Computes daily values for the metrics we monitor, from `daysAgoIso(28)`
 * through today (29 data points: 28 history + today).
 */
async function dailyMetricSeries(client: ClientInfo) {
  const from = daysAgoIso(28);
  const today = todayIso();
  const fx = getProviders().fx;

  const [callRows, adRows] = await Promise.all([
    loadCalls(client.id, from, today),
    loadAdMetrics(client.id, from, today),
  ]);
  const callRecords = toCallRecords(callRows);

  const revByDate = new Map<string, number>();
  const closedByDate = new Map<string, number>();
  const shownByDate = new Map<string, number>();
  const noShowByDate = new Map<string, number>();
  const spendByDate = new Map<string, number>();

  for (const c of callRecords) {
    const bucket = bucketOf(c.outcome);
    if (bucket === "closed") {
      const rev = await fx.convert(c.revenue, c.currency, client.currency);
      revByDate.set(c.date, (revByDate.get(c.date) ?? 0) + rev);
      closedByDate.set(c.date, (closedByDate.get(c.date) ?? 0) + 1);
      shownByDate.set(c.date, (shownByDate.get(c.date) ?? 0) + 1);
    } else if (bucket === "showed_not_closed") {
      shownByDate.set(c.date, (shownByDate.get(c.date) ?? 0) + 1);
    } else if (bucket === "no_show") {
      noShowByDate.set(c.date, (noShowByDate.get(c.date) ?? 0) + 1);
    }
  }
  for (const r of adRows) {
    if (r.status === "archived" || r.status === "deleted") continue;
    const spend = await fx.convert(r.spend, r.currency, client.currency);
    spendByDate.set(r.date, (spendByDate.get(r.date) ?? 0) + spend);
  }

  const dates: string[] = [];
  for (let i = 28; i >= 0; i--) dates.push(daysAgoIso(i));

  const closeRateByDate = dates.map((d) => {
    const closed = closedByDate.get(d) ?? 0;
    const shown = shownByDate.get(d) ?? 0;
    return shown > 0 ? closed / shown : null;
  });
  const showUpRateByDate = dates.map((d) => {
    const shown = shownByDate.get(d) ?? 0;
    const noShow = noShowByDate.get(d) ?? 0;
    return shown + noShow > 0 ? shown / (shown + noShow) : null;
  });

  return {
    dates,
    revenue: dates.map((d) => revByDate.get(d) ?? 0),
    adSpend: dates.map((d) => spendByDate.get(d) ?? 0),
    closeRate: closeRateByDate,
    showUpRate: showUpRateByDate,
  };
}

/** Run the anomaly scan for one client. Returns every metric currently anomalous. */
export async function detectAnomalies(client: ClientInfo): Promise<AnomalyResult[]> {
  const series = await dailyMetricSeries(client);
  const results = [
    checkSeries("revenue", "Daily Revenue", series.revenue),
    checkSeries("ad_spend", "Daily Ad Spend", series.adSpend),
    checkSeries("close_rate", "Close Rate", series.closeRate),
    checkSeries("show_up_rate", "Show-Up Rate", series.showUpRate),
  ];
  return results.filter((r): r is AnomalyResult => r !== null);
}

/** Scan for anomalies and notify (in-app + Slack) for every one found. Best-effort per client. */
export async function runAnomalyScan(client: ClientInfo): Promise<AnomalyResult[]> {
  const anomalies = await detectAnomalies(client);
  if (anomalies.length === 0) return anomalies;

  const { notifier } = getProviders();
  for (const a of anomalies) {
    const pct = Math.round(a.dropPct * 100);
    await notifier.notify({
      clientId: client.id,
      kind: "anomaly_alert",
      title: `${a.severity === "critical" ? "Critical" : "Warning"}: ${a.label} down ${pct}%`,
      body: `${a.label} is ${pct}% below its 28-day average (today: ${a.today.toFixed(2)}, avg: ${a.avg28d.toFixed(2)}).`,
      meta: { ...a },
    });
  }
  return anomalies;
}

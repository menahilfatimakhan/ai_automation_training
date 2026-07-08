/** Semantic, color-coded badges for outcomes, campaign status, and lead status. */

const OUTCOME: Record<string, { label: string; cls: string }> = {
  paid_in_full: { label: "Paid in Full", cls: "bg-accent-green/15 text-accent-green" },
  split_pay: { label: "Split Pay", cls: "bg-accent-green/15 text-accent-green" },
  offer_declined: { label: "Offer Declined", cls: "bg-accent-rose/15 text-accent-rose" },
  not_a_fit: { label: "Not a Fit", cls: "bg-accent-rose/15 text-accent-rose" },
  deposit_only: { label: "Deposit Only", cls: "bg-accent-sky/15 text-accent-sky" },
  no_show: { label: "No-Show", cls: "bg-surface-raised text-ink-faint" },
  cancelled: { label: "Cancelled", cls: "bg-surface-raised text-ink-faint" },
  rescheduled: { label: "Rescheduled", cls: "bg-accent-amber/15 text-accent-amber" },
};

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const o = OUTCOME[outcome] ?? { label: outcome, cls: "bg-surface-raised text-ink-soft" };
  return <span className={`badge ${o.cls}`}>{o.label}</span>;
}

const CAMPAIGN_STATUS: Record<string, string> = {
  active: "bg-accent-green/15 text-accent-green",
  paused: "bg-accent-amber/15 text-accent-amber",
  archived: "bg-surface-raised text-ink-faint",
  deleted: "bg-accent-rose/15 text-accent-rose",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = CAMPAIGN_STATUS[status] ?? "bg-surface-raised text-ink-soft";
  return <span className={`badge ${cls}`}>{status}</span>;
}

const LEAD_STATUS: Record<string, string> = {
  new: "bg-accent-sky/15 text-accent-sky",
  working: "bg-accent-amber/15 text-accent-amber",
  won: "bg-accent-green/15 text-accent-green",
  lost: "bg-accent-rose/15 text-accent-rose",
};

export function LeadStatusBadge({ status }: { status: string }) {
  const cls = LEAD_STATUS[status] ?? "bg-surface-raised text-ink-soft";
  return <span className={`badge ${cls}`}>{status}</span>;
}

/** Color-coded summary strip of the outcome bucket mix + close rate. */
export function OutcomeMixStrip({ mix }: { mix: Record<string, number> }) {
  const shown = (mix["closed"] ?? 0) + (mix["showed_not_closed"] ?? 0);
  const closeRate = shown > 0 ? Math.round(((mix["closed"] ?? 0) / shown) * 100) : 0;
  const items = [
    { key: "closed", label: "Closed", cls: "text-accent-green" },
    { key: "showed_not_closed", label: "Showed, didn't close", cls: "text-accent-rose" },
    { key: "no_show", label: "No-show", cls: "text-ink-faint" },
    { key: "rescheduled", label: "Rescheduled", cls: "text-accent-amber" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => (
        <div key={it.key} className="card flex items-center gap-2 px-3 py-2">
          <span className={`text-lg font-semibold ${it.cls}`}>{mix[it.key] ?? 0}</span>
          <span className="text-xs text-ink-soft">{it.label}</span>
        </div>
      ))}
      <div className="card flex items-center gap-2 px-3 py-2">
        <span className="text-lg font-semibold text-brand">{closeRate}%</span>
        <span className="text-xs text-ink-soft">Close rate</span>
      </div>
    </div>
  );
}

/** Money styled green when positive, muted when zero. */
export function Money({ amount, formatted }: { amount: number; formatted: string }) {
  return (
    <span className={amount > 0 ? "font-medium text-accent-green" : "text-ink-faint"}>
      {amount > 0 ? formatted : "—"}
    </span>
  );
}

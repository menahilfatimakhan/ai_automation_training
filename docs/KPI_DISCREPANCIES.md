# KPI Discrepancies — Current Implementation vs. `Metrics/KPI_Calculations.md`

**Do not treat this document as already-fixed.** Per instruction, nothing
here has been changed — this is a listing of every mismatch found between
the client's official formulas (source of truth, `Metrics/KPI_Calculations.md`)
and what `src/lib/kpi/*` + `src/lib/data/master.ts` actually compute today.
Formula fixes happen in Step 3, after sign-off on this document.

Call graph traced: `master.ts` → `dashboards.ts` → `src/lib/kpi/engine.ts` →
`src/lib/kpi/core.ts`. This is the only KPI computation code in the app —
there is no second, richer implementation elsewhere.

---

## Root cause: a 4-value outcome enum standing in for 8 literal outcomes

The client's model (`Metrics/KPI_Calculations.md`, "The four call-outcome
buckets"):

| Bucket | Literal outcomes | Meaning |
|---|---|---|
| Closed | Paid in Full, Split Pay | Won deal |
| Showed but didn't close | Offer Declined, Not a Fit, Deposit Only | Attended, didn't buy |
| No-show | No-Show, Cancelled | Didn't attend |
| Rescheduled | Rescheduled | Excluded from every percentage |

Our schema (`src/db/schema.ts:36-41`):

```ts
export const callOutcome = pgEnum("call_outcome", [
  "closed",
  "rescheduled",
  "lost",
  "no_show",
]);
```

This is a straight 4-value enum with **no sub-distinction** inside "closed"
(Paid in Full vs. Split Pay) or inside "lost" (Offer Declined vs. Not a Fit
vs. Deposit Only), and no distinction between the two no-show reasons. There
is no literal-string storage anywhere of "Paid in Full", "Split Pay", "Offer
Declined", "Not a Fit", "Deposit Only", "No-Show", or "Cancelled" — those
strings exist only in the client's own spec doc. This single gap is the
direct cause of discrepancies #1, #2, and most of the "not implemented at
all" rows below (PIF %, Deposits, objection-type counters). **This needs
your explicit sign-off before touching schema/migrations — flagging, not
fixing.**

---

## Numbered discrepancies (formula mismatches where the KPI *is* implemented)

### 1. Total Revenue / Total Deals Won use `outcome === "closed"`, not `[Paid in Full, Split Pay]`
`src/lib/kpi/engine.ts:69`: `const closed = calls.filter((c) => c.outcome === "closed")`, then lines 71-75 sum `c.revenue` over that set.
Because there's no PIF/Split-Pay distinction in the schema, this is the closest possible match today — but it means there's no way to break Total Revenue down by payment type, and "Total Deals Won" (`counts.closed`, engine.ts:87) is a single count with no PIF/Split-Pay split.

### 2. Total Cash Collected sums ALL calls, not just Closed ones
`engine.ts:76-80`:
```ts
const cashCollected = await sumInCurrency(
  calls.map((c) => ({ amount: c.cashCollected, currency: c.currency })),
  targetCurrency,
  fx,
);
```
This iterates the full `calls` list regardless of outcome. Client formula: `sum(cash_collected) where outcome in [Paid in Full, Split Pay]`. `LogCallForm` lets a user enter `cashCollected` regardless of the selected outcome (no client-side gating), so a non-closed row with a nonzero cash value would silently inflate this total today.

### 3. Close Rate denominator excludes No-Show but NOT Rescheduled
`src/lib/kpi/core.ts:28-30`:
```ts
export function closeRate(c: OutcomeCounts): number {
  return safeDivide(c.closed, c.total - c.noShow);
}
```
Client formula: `Won / Calls Shown` where `Calls Shown = closed + showed-but-didn't-close`, i.e. the denominator should be `total - noShow - rescheduled`. The code's denominator (`total - noShow`) still includes rescheduled calls, understating close rate whenever any exist in the period. `tests/kpi/core.test.ts:23-28` currently pins this exact (incorrect-per-spec) behavior: `{total:10, closed:3, rescheduled:2, lost:3, noShow:2}` expects `3/8`, never subtracting the 2 rescheduled.

### 4. No "Calls Taken" concept — `totalCalls` includes Rescheduled, and it's mislabeled
`engine.ts:42` (`tallyOutcomes`) increments `counts.total` unconditionally for every row, and `engine.ts:86` exposes it as `totalCalls`. `master.ts:49` binds this to a card labeled **"Calls Booked"** — a third, different client concept ("Booked Calls = sum(calls_booked) from setter logs"). The code conflates three distinct client metrics (Calls Taken, Calls Booked-from-setters, raw call-row count) into one mislabeled field.

### 5. "Booked Calls" is computed correctly but discarded
`master.ts:89`: `const callsBooked = setterRows.reduce((s, r) => s + r.callsBooked, 0);` — this correctly sums setter `calls_booked`. But it's only used internally as the denominator for `computeAdKpis`'s `costPerCall` (`master.ts:92`); it is never surfaced as its own "Booked Calls" card. The card actually labeled "Calls Booked" is bound to the raw call-row count instead (see #4).

### 6. ROAS is one generic ratio; client wants ROAS Cash and ROAS Rev as two separate cards
`core.ts:43-45` / `engine.ts:125`: `roas: roas(opts.attributedRevenue, adSpend)` — a single function. Client spec has `ROAS Cash = cash/spend` and `ROAS Rev = revenue/spend` as two distinct metrics. There is no `roasCash` function or card at all.

### 7. Cost per Call uses the wrong denominator
`core.ts:48-50`: `costPerCall(adSpend, callsBooked)`; caller `master.ts:92`: `callsBooked: callsBooked || sales.totalCalls`. Client spec: `spend / calls taken` (calls taken = outcome != Rescheduled). The code's denominator is either the setter-logged booked-calls count, or — if that's zero — the raw unfiltered call-row count (including rescheduled and no-shows). Neither matches "calls taken."

### 8. Ad spend aggregation does not exclude archived campaigns
`engine.ts:108-119` (`computeAdKpis`) sums `spend` over every row passed in with no status filter; its caller `dashboards.ts:148-176` (`loadAdMetrics`) selects `ad_daily_metrics` filtered only by `client_id` and date range — `status` is fetched into the row object but never used in a filter, and `engine.ts` never inspects it either. Client spec: "excluding archived." Archived-campaign spend is currently included in Total Spend, ROAS, and Cost per Call/Customer.

### 9. "Call/Proposal %" has no corresponding function
Client's four setter ratios: `Lead/Response % = responses/new_convos`, `Proposal/Response % = proposals/responses`, `Call/Proposal % = calls_booked/proposals`, `Call/Lead % = calls_booked/new_convos`.

Code (`core.ts:62-74`):
```ts
export function replyRate(t: SetterTotals): number {      // matches Lead/Response %
  return safeDivide(t.replies, t.conversations);
}
export function proposalRate(t: SetterTotals): number {   // matches Proposal/Response %
  return safeDivide(t.proposals, t.replies);
}
export function bookingRate(t: SetterTotals): number {    // matches Call/Lead %
  return safeDivide(t.callsBooked, t.conversations);
}
```
`replyRate` and `proposalRate` numerically match two of the four client ratios (under different names). `bookingRate` matches Call/Lead %. **Call/Proposal % (`calls_booked/proposals`) has no function at all** — one of the four client setter ratios is simply missing.

---

## KPIs with NO implementation at all

Confirmed via full file reads plus targeted greps (`pacing`, `streak`,
`LEGENDARY`, `ON FIRE`, `objection`, `attribution`, `deposit`, `PIF`,
`cost_per_follower`, `cost_per_conversation`, `call_log_setters`,
`booked_by_setter_id`, ctr/cpm/cpc aggregation) — zero hits outside doc/schema
comments:

1. **Pacing** (`(value-to-date / days-elapsed) * days-in-month`, master or setter) — only a flat `effective/target` progress percent exists (`master.ts:161,167`), no days-elapsed projection.
2. **Deals Won/Lost split** — no `Won`/`Lost` pair as named outputs; "Lost" in the code's world is the whole `"lost"` enum bucket (conflating Offer Declined/Not a Fit/Deposit Only per the schema gap above), not derived via `Calls Taken − Won − NoShows`.
3. **Show-Up Rate** (`Calls Shown / (Calls Shown + No-shows)`) — not implemented; only `noShowRate = noShow/total` exists, a different ratio over a different denominator.
4. **Deposits** (count + estimated value = avg deal size × deposit count) — impossible under the current enum; "Deposit Only" isn't a distinct value.
5. **Revenue per Call / Cash per Call** (both use "Calls Shown" as denominator) — not implemented.
6. **Cash Upfront %** (`cash/revenue`) — not implemented.
7. **PIF %** (`count(Paid in Full)/count(closed deals)`) — not implemented; structurally impossible without the enum expansion.
8. **Average Cash** (`Cash/Deals Closed`) — no function exists. (`avgDealSize` = "Average Deal" does exist and is directionally correct, modulo #1's revenue-filter gap.)
9. **Objection counters** (Think About It/Money/Time/Partner/Fear/Value, counted on lost calls) — not implemented; `objectionReason` is free text with no controlled vocabulary and no aggregation function.
10. **Cost per Follower** (`spend / follower delta over a 90-day pre-window`) — not implemented; no follower-count field exists anywhere in the schema (the real Ads-tracker seed data does have this — see Step 2 seed-data findings).
11. **Cost per Conversation** (`spend/new_conversations`) — not implemented.
12. **Cost per Customer** (`spend/deals closed`) — not implemented.
13. **CTR/CPM/CPC as impression-weighted averages** — not implemented. `ad_daily_metrics.ctr`/`.impressions` are stored and loaded (`dashboards.ts:157,171`) but never aggregated by any function.
14. **Total Leads with spend/cost-per-result fallback when results=0** — `computeAdKpis` just does `results = rows.reduce((s,r)=>s+r.results,0)` (engine.ts:119), no fallback branch, and "Total Leads" isn't even a named output.
15. **Setter Streaks** (consecutive active days; LEGENDARY/ON FIRE/Hot/Warm tiers) — not implemented anywhere.
16. **Setter Attribution Panel** (per-setter calls-set/deals-closed/revenue/set→close rate) — not implemented; no `call_log_setters` junction table or `booked_by_setter_id` column exists; `calls` only has `closerUserId`.

---

## Override / AI-suggestion pattern — mechanism vs. coverage

The mechanism itself is sound and matches the required invariant:

- `resolveValue` (`src/lib/kpi/resolve.ts:38-52`) always takes a freshly computed number as input and returns it unchanged as `.computed` — the computed value is never mutated.
- `metric_overrides` (`schema.ts:370-394`) is append-only with `createdBy` (who), `createdAt` (when), `priorValue` (prior value) — a real audit record.
- `ai_suggestions.status` is exactly `pending|accepted|dismissed` (`schema.ts:397-422`), as required.
- `pickActiveOverride` (`resolve.ts:27-35`) picks the newest active override; inactive ones are ignored. Tested in `tests/kpi/resolve.test.ts`.

**Coverage is partial, not universal:**
- Only the 9 keys in `master.ts`'s `CARD_DEFS` go through override resolution at all. Three setter metric keys (`setterReplyRate`/`setterProposalRate`/`setterBookingRate`) are declared but hardcoded to `0` in `computedByKey` (`master.ts:106-108`) — never actually computed or wired to real data on the Master view.
- None of the 16 "not implemented at all" KPIs above have a `METRIC_KEYS` entry, so none of them are override-able or AI-suggestible even in principle — the pattern can't apply to a KPI that doesn't exist as a computed value.
- `kpi_values` (schema.ts:338-363, the "computed snapshot" table) is defined but **never read or written** by any TypeScript code (confirmed via grep across `src/`). KPIs are computed live per-request; there's no persisted history to audit overrides against over time.

---

## Summary table

| # | KPI | Client formula | Code today | File:line |
|---|---|---|---|---|
| 1 | Total Revenue / Deals Won | outcome in [Paid in Full, Split Pay] | `outcome === "closed"` (no PIF/Split-Pay distinction possible) | engine.ts:69-75; schema.ts:36-41 |
| 2 | Total Cash Collected | outcome in [Paid in Full, Split Pay] | ALL calls, no outcome filter | engine.ts:76-80 |
| 3 | Close Rate | Won/(Won+Lost); excludes No-show AND Rescheduled | `closed/(total-noShow)` — Rescheduled still in denominator | core.ts:28-30 |
| 4 | Calls Taken | count where outcome != Rescheduled | `counts.total` = every row incl. Rescheduled, mislabeled "Calls Booked" | engine.ts:42,86; master.ts:49 |
| 5 | Booked Calls | sum(calls_booked) from setter logs | computed correctly but never surfaced as its own card | master.ts:49,89 |
| 6 | ROAS Cash / ROAS Rev | two distinct ratios | one generic `roas()`, no cash variant | core.ts:43-45 |
| 7 | Cost per Call | spend/calls taken | spend/(setter calls_booked \|\| raw totalCalls) | core.ts:48-50; master.ts:92 |
| 8 | Ads Total Spend | excludes archived campaigns | sums all rows, no status filter | engine.ts:108-119; dashboards.ts:148-176 |
| 9 | Call/Proposal % | calls_booked/proposals | not implemented | absent from core.ts |
| 10 | Show-Up Rate, Deposits, PIF %, Cash Upfront %, Rev/Cash per Call, Average Cash, Objection Counters, Pacing, Cost per Follower/Conversation/Customer, CTR/CPM/CPC, Total Leads fallback, Setter Streaks, Setter Attribution Panel | — | not implemented at all | n/a |

**Waiting on your sign-off before Step 3 implements any of the fixes above.**

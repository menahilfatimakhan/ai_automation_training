# KPI Coverage Checklist — Screenshots × KPI_Calculations.md × Code

Every KPI card visible in the four dashboard screenshots (`Metrics/Master
KPIs.jpeg`, `Meta KPIs.jpeg`, `Sales & Closing KPIs.jpeg`, `DM Setting.jpeg`),
cross-referenced against its formula in `Metrics/KPI_Calculations.md` and its
implementation status (see `KPI_DISCREPANCIES.md` for the detailed
per-formula analysis; statuses here match that document).

Status legend: **DONE** (implemented, formula matches spec), **PARTIAL**
(implemented but formula/denominator diverges from spec, or computed-but-
not-displayed), **MISSING** (no implementation at all).

---

## Master KPIs (8 cards on screenshot)

| Card (as shown) | KPI_Calculations.md section | Status |
|---|---|---|
| Total Revenue | Total Revenue | PARTIAL — outcome filter can't distinguish PIF/Split-Pay (discrepancy #1) |
| Total Deals Won | Total Deals Won | PARTIAL — same root cause as above |
| Booked Calls | Booked Calls | PARTIAL — computed correctly but mislabeled/discarded (discrepancy #5); the card shown under this name is actually bound to raw call count |
| Pacing | Pacing | MISSING |
| Total Cash Collected | Total Cash Collected | PARTIAL — sums all calls, not just closed (discrepancy #2) |
| Ad Spend | Ad block: Spend | PARTIAL — doesn't exclude archived campaigns (discrepancy #8) |
| Calls Taken | Calls Taken | MISSING as a distinct concept — no `outcome != Rescheduled` filter exists (discrepancy #4) |
| ROAS | ROAS (Master) | PARTIAL — correct formula shape, but inherits Total Revenue's outcome-filter gap; no Cash/Rev split |

Also documented in `KPI_Calculations.md` for the Master dashboard but not
literally one of the 8 headline cards on the screenshot:
- **Monthly Goals** (progress bars) — PARTIAL (bars exist, no green/amber/red states — see `GAP_ANALYSIS.md` #2)
- **Closer Leaderboard** — MISSING (see `GAP_ANALYSIS.md` #4)
- **Appointment block** (New Convos/Responses/Offers Sent/Calls Booked/Show-Up %) — covered under Setter dashboard below
- **Ad block** (Cost-per-Follower/Cost-per-Call/Cost-per-Customer/ROAS Cash) — covered under Ads dashboard below

---

## Meta / Ads KPIs (8 cards on screenshot)

| Card (as shown) | KPI_Calculations.md section | Status |
|---|---|---|
| Total Spend | Total Spend | PARTIAL — archived campaigns not excluded |
| Total Followers | (not a named card in KPI_Calculations.md; implied by Cost per Follower's follower-delta calc) | MISSING — no follower-count field anywhere in the schema |
| Cost/Follower (tagged "AD LEVEL" on screenshot) | Cost per Follower | MISSING — no follower data field; formula needs a 90-day pre-window follower delta |
| Cost/Convo | Cost per Conversation | MISSING |
| ROAS Cash | ROAS Cash | MISSING — no cash-specific ROAS function exists |
| ROAS Rev | ROAS Rev | PARTIAL — served by the single generic `roas()`, inherits revenue's outcome-filter gap |
| Cost/Call | Cost per Call | PARTIAL — wrong denominator (discrepancy #7) |
| Cost/Customer | Cost per Customer | MISSING |

Also in `KPI_Calculations.md` for Ads but not on the headline screenshot
(described as per-ad table columns / rollups):
- **Total Leads** (with spend/cost-per-result fallback) — MISSING, no fallback logic and not a named output
- **CTR** (impression-weighted average) — MISSING, `ctr`/`impressions` stored but never aggregated
- **CPM** (impression-weighted average) — MISSING
- **CPC** (impression-weighted average) — MISSING
- **Per-Ad Table Columns** (Frequency, per-ad CPM/CTR/CPC/Cost-per-Result/Cost-per-Follower) — PARTIAL, table shows Spend/Impressions/Reach/Results/CTR/Status/Category only (see `GAP_ANALYSIS.md` #13)

---

## Sales & Closing KPIs (18 cards on screenshot, 3 rows)

| Card (as shown) | KPI_Calculations.md section | Status |
|---|---|---|
| Revenue | Revenue (= Total Revenue) | PARTIAL |
| Cash Collected | Cash Collected (= Total Cash Collected) | PARTIAL |
| Deals Won / Lost | Deals Won / Lost | MISSING as a split card — code has generic closed/lost counts, not the client's `Won` / `Lost = Taken−Won−NoShow` pairing |
| Close Rate | Close Rate | PARTIAL — wrong denominator (discrepancy #3) |
| Show Up | Show-Up Rate | MISSING — a different, non-matching `noShowRate` exists instead |
| Deposits | Deposits | MISSING — structurally blocked by the 4-value outcome enum |
| Rev/Call | Revenue per Call | MISSING |
| Cash/Call | Cash per Call | MISSING |
| Cash Upfront | Cash Upfront % | MISSING |
| PIF % | PIF % (Paid In Full Percentage) | MISSING — structurally blocked |
| Avg Deal | Average Deal | DONE (formula matches; inherits revenue's outcome-filter caveat) |
| Avg Cash | Average Cash | MISSING — no function exists |
| Think About It (objection) | Objection Counters | MISSING |
| Money (objection) | Objection Counters | MISSING |
| Time (objection) | Objection Counters | MISSING |
| Partner (objection) | Objection Counters | MISSING |
| Fear (objection) | Objection Counters | MISSING |
| Value (objection) | Objection Counters | MISSING |

All 6 objection counters share one root cause: `objectionReason` is free
text with no controlled vocabulary tying it to these six categories, and no
aggregation function counts them.

Also in `KPI_Calculations.md` for Sales but not on the headline screenshot:
- **Daily Revenue Trend Chart** — PARTIAL (chart exists but lives on Master, not Sales — see `GAP_ANALYSIS.md` #10)

---

## DM Setting / Setter KPIs (10 cards on screenshot)

| Card (as shown) | KPI_Calculations.md section | Status |
|---|---|---|
| Leads | Leads (New Conversations) | DONE — sum of `new_convos` |
| Responses | Responses | DONE — sum of `responses`, **but see seed-data caveat**: at least one real setter tracker (Karoline / Julie Bundgaard's setter) has no distinct "Responses" row in its raw data, only New Convos/Offers/Booked Calls/Follow-ups — real coverage may be incomplete per-client even though the formula and code are correct |
| Call Proposals | Call Proposals | DONE — sum of `proposals` |
| Calls Booked | Calls Booked | DONE |
| Follow-ups | Follow-ups | DONE as a computed value (`computeSetterKpis` returns it), but **not rendered as its own card** on the Setter dashboard UI (see `GAP_ANALYSIS.md` #21) — counts as coverage gap in the UI, not the formula |
| Pacing | Pacing (Setter) | MISSING |
| Lead/Response % | Lead/Response % | DONE — matches `replyRate` (named differently in code) |
| Proposal/Response % | Proposal/Response % | DONE — matches `proposalRate` |
| Call/Proposal % | Call/Proposal % | MISSING — no function exists (discrepancy #9) |
| Call/Lead % | Call/Lead % | DONE — matches `bookingRate` |

Also in `KPI_Calculations.md` for the Setter dashboard but not on the
headline screenshot:
- **Setter Streaks** (Current/Best Streak, Total Days, LEGENDARY/ON FIRE/Hot/Warm tiers) — MISSING, no schema or code support
- **Calls Booked Leaderboard** — MISSING
- **Lead/Call Rate Leaderboard** — MISSING
- **Setter Attribution Panel** (Calls Set / Deals Closed / Revenue from Sets / Set→Close Rate) — MISSING, no `call_log_setters` junction or `booked_by_setter_id` column exists

---

## Rollup

- **44 distinct KPI cards** enumerated across the 4 screenshots.
- **DONE:** 9 (Avg Deal; Leads; Responses*; Call Proposals; Calls Booked;
  Lead/Response %; Proposal/Response %; Call/Lead %; Follow-ups as a
  computed value)
- **PARTIAL:** 11 (Total Revenue; Total Deals Won; Booked Calls; Total Cash
  Collected; Ad Spend; ROAS (Master); Total Spend; ROAS Rev; Cost/Call;
  Revenue; Cash Collected; Close Rate — note some of these appear on
  multiple dashboards and are only counted once here)
- **MISSING:** the remaining ~24, concentrated in: Pacing (both dashboards),
  Show-Up Rate, Deposits, PIF %, Cash Upfront %, Rev/Cash per Call, Average
  Cash, all 6 objection counters, Total Followers, Cost/Follower, Cost/Convo,
  ROAS Cash, Cost/Customer, CTR/CPM/CPC, Total Leads fallback, Call/Proposal
  %, Setter Streaks, and the Setter Attribution Panel.

*Responses is DONE in code/formula but has a noted real-world data-
availability caveat for at least one client's raw tracker — to be confirmed
per-client during the Step 2 import.

No screenshot KPI was found to be silently "invented" by the code that isn't
in `KPI_Calculations.md` — every implemented metric traces back to a
documented client formula.

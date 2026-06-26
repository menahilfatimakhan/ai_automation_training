-- ════════════════════════════════════════════════════════════════════════════
-- Restrict COMPLETE/aggregate data to admin + client roles only.
--
-- Trainer feedback: closers and setters get their own operational view (their
-- own calls / their own activity — already enforced). Only admin and the
-- client-role viewer may see the complete picture: client-wide ad spend,
-- campaigns, connections, and KPI snapshots.
--
-- Closer/setter ownership policies on calls/setter_daily_activity are unchanged.
-- The service role still bypasses RLS for sync/seed.
-- ════════════════════════════════════════════════════════════════════════════

-- ad_connections: was (admin OR any member) → (admin OR client-role)
drop policy if exists ad_connections_select on public.ad_connections;
create policy ad_connections_select on public.ad_connections for select
  using (public.is_admin() or public.is_client_viewer(client_id));

-- ad_campaigns
drop policy if exists ad_campaigns_select on public.ad_campaigns;
create policy ad_campaigns_select on public.ad_campaigns for select
  using (public.is_admin() or public.is_client_viewer(client_id));

-- ad_daily_metrics (campaign spend/results)
drop policy if exists ad_metrics_select on public.ad_daily_metrics;
create policy ad_metrics_select on public.ad_daily_metrics for select
  using (public.is_admin() or public.is_client_viewer(client_id));

-- kpi_values snapshots (aggregate KPIs)
drop policy if exists kpi_values_select on public.kpi_values;
create policy kpi_values_select on public.kpi_values for select
  using (public.is_admin() or public.is_client_viewer(client_id));

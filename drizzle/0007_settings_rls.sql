-- RLS for the Step 5 settings tables — admin-only writes, admin/client-viewer
-- reads (matching the tightened aggregate-visibility pattern from
-- 0004_restrict_aggregate_rls.sql: closers/setters don't need these).
alter table public.client_settings   enable row level security;
alter table public.ai_personas       enable row level security;
alter table public.alert_thresholds  enable row level security;

create policy client_settings_select on public.client_settings for select
  using (public.is_admin() or public.is_client_viewer(client_id));
create policy client_settings_admin_write on public.client_settings for all
  using (public.is_admin()) with check (public.is_admin());

create policy ai_personas_select on public.ai_personas for select
  using (public.is_admin() or public.is_client_viewer(client_id));
create policy ai_personas_admin_write on public.ai_personas for all
  using (public.is_admin()) with check (public.is_admin());

create policy alert_thresholds_select on public.alert_thresholds for select
  using (public.is_admin() or public.is_client_viewer(client_id));
create policy alert_thresholds_admin_write on public.alert_thresholds for all
  using (public.is_admin()) with check (public.is_admin());

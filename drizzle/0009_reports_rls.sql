-- Reports are read by admin + client-viewers (matching the aggregate-data
-- visibility pattern), written only by admin/service (the scheduler and
-- "Generate Now" both run server-side with the service client).
alter table public.reports enable row level security;

create policy reports_select on public.reports for select
  using (public.is_admin() or public.is_client_viewer(client_id));
create policy reports_admin_write on public.reports for all
  using (public.is_admin()) with check (public.is_admin());

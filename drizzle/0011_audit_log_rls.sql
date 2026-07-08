-- Audit trail: admin + client-viewers can read (matching the aggregate-data
-- visibility pattern); writes happen via the service client from within an
-- already-authorized server action (the mutation on calls/leads itself is
-- what RLS gates — the audit row is a trusted side-effect of that), so no
-- authenticated-role write policy is granted here.
alter table public.audit_log enable row level security;

create policy audit_log_select on public.audit_log for select
  using (public.is_admin() or public.is_client_viewer(client_id));

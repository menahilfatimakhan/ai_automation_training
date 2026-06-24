-- ════════════════════════════════════════════════════════════════════════════
-- Row-Level Security — multi-tenant isolation (invariant #1)
--
-- Enforcement lives HERE, in the database, not in app code. Every domain table
-- has RLS enabled with policies keyed off the caller's identity (auth.uid()).
--
-- Rules:
--   Admin (users.is_admin)            -> sees/manages ALL clients.
--   Member of a client                -> scoped to that client_id.
--   Closer / Setter                   -> only their OWN rows on activity tables.
--   Client role                       -> READ-ONLY, all rows for its client_id.
--
-- The service-role key bypasses RLS (Postgres BYPASSRLS) and is used only by
-- trusted server tasks (seed, ad sync, KPI compute). User requests go through
-- the anon/authenticated role and are fully constrained by these policies.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Helper functions (SECURITY DEFINER to read users/memberships safely) ────
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select u.is_admin from public.users u where u.id = auth.uid()), false);
$$;

create or replace function public.is_member_of(target_client uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.client_id = target_client
  );
$$;

create or replace function public.has_client_role(target_client uuid, target_role public.membership_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.client_id = target_client
      and m.role = target_role
  );
$$;

-- A client-role member is read-only; closers/setters can write their own rows.
create or replace function public.is_client_viewer(target_client uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_client_role(target_client, 'client');
$$;

-- ─── Enable RLS on every domain table ────────────────────────────────────────
alter table public.clients               enable row level security;
alter table public.users                 enable row level security;
alter table public.memberships           enable row level security;
alter table public.calls                 enable row level security;
alter table public.leads                 enable row level security;
alter table public.follow_ups            enable row level security;
alter table public.setter_daily_activity enable row level security;
alter table public.goals                 enable row level security;
alter table public.ad_connections        enable row level security;
alter table public.ad_campaigns          enable row level security;
alter table public.ad_daily_metrics      enable row level security;
alter table public.kpi_values            enable row level security;
alter table public.metric_overrides      enable row level security;
alter table public.ai_suggestions        enable row level security;
alter table public.fx_rates              enable row level security;

-- ─── clients ─────────────────────────────────────────────────────────────────
create policy clients_select on public.clients for select
  using (public.is_admin() or public.is_member_of(id));
create policy clients_admin_write on public.clients for all
  using (public.is_admin()) with check (public.is_admin());

-- ─── users ───────────────────────────────────────────────────────────────────
-- See self, anyone in a shared client, or everyone if admin.
create policy users_select on public.users for select
  using (
    public.is_admin()
    or id = auth.uid()
    or exists (
      select 1 from public.memberships m1
      join public.memberships m2 on m1.client_id = m2.client_id
      where m1.user_id = auth.uid() and m2.user_id = public.users.id
    )
  );
create policy users_admin_write on public.users for all
  using (public.is_admin()) with check (public.is_admin());

-- ─── memberships ─────────────────────────────────────────────────────────────
create policy memberships_select on public.memberships for select
  using (public.is_admin() or user_id = auth.uid() or public.is_member_of(client_id));
create policy memberships_admin_write on public.memberships for all
  using (public.is_admin()) with check (public.is_admin());

-- ─── calls (closer owns; client read-only; admin all) ────────────────────────
create policy calls_select on public.calls for select
  using (
    public.is_admin()
    or (public.is_member_of(client_id)
        and (public.is_client_viewer(client_id) or closer_user_id = auth.uid()))
  );
create policy calls_write on public.calls for all
  using (
    public.is_admin()
    or (public.has_client_role(client_id, 'closer') and closer_user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or (public.has_client_role(client_id, 'closer') and closer_user_id = auth.uid())
  );

-- ─── setter_daily_activity (setter owns; client read-only; admin all) ────────
create policy setter_activity_select on public.setter_daily_activity for select
  using (
    public.is_admin()
    or (public.is_member_of(client_id)
        and (public.is_client_viewer(client_id) or setter_user_id = auth.uid()))
  );
create policy setter_activity_write on public.setter_daily_activity for all
  using (
    public.is_admin()
    or (public.has_client_role(client_id, 'setter') and setter_user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or (public.has_client_role(client_id, 'setter') and setter_user_id = auth.uid())
  );

-- ─── leads (owner sees own; client read-only; admin all + reassignment) ──────
create policy leads_select on public.leads for select
  using (
    public.is_admin()
    or (public.is_member_of(client_id)
        and (public.is_client_viewer(client_id) or owner_user_id = auth.uid()))
  );
create policy leads_write on public.leads for all
  using (
    public.is_admin()
    or (public.is_member_of(client_id)
        and not public.is_client_viewer(client_id)
        and owner_user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or (public.is_member_of(client_id)
        and not public.is_client_viewer(client_id)
        and owner_user_id = auth.uid())
  );

-- ─── follow_ups (same ownership model as leads) ──────────────────────────────
create policy follow_ups_select on public.follow_ups for select
  using (
    public.is_admin()
    or (public.is_member_of(client_id)
        and (public.is_client_viewer(client_id) or owner_user_id = auth.uid()))
  );
create policy follow_ups_write on public.follow_ups for all
  using (
    public.is_admin()
    or (public.is_member_of(client_id)
        and not public.is_client_viewer(client_id)
        and owner_user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or (public.is_member_of(client_id)
        and not public.is_client_viewer(client_id)
        and owner_user_id = auth.uid())
  );

-- ─── goals (all client members read; admin writes) ───────────────────────────
create policy goals_select on public.goals for select
  using (public.is_admin() or public.is_member_of(client_id));
create policy goals_admin_write on public.goals for all
  using (public.is_admin()) with check (public.is_admin());

-- ─── ad_* (all client members read; admin/service write) ─────────────────────
create policy ad_connections_select on public.ad_connections for select
  using (public.is_admin() or public.is_member_of(client_id));
create policy ad_connections_admin_write on public.ad_connections for all
  using (public.is_admin()) with check (public.is_admin());

create policy ad_campaigns_select on public.ad_campaigns for select
  using (public.is_admin() or public.is_member_of(client_id));
create policy ad_campaigns_admin_write on public.ad_campaigns for all
  using (public.is_admin()) with check (public.is_admin());

create policy ad_metrics_select on public.ad_daily_metrics for select
  using (public.is_admin() or public.is_member_of(client_id));
create policy ad_metrics_admin_write on public.ad_daily_metrics for all
  using (public.is_admin()) with check (public.is_admin());

-- ─── derived values: kpi_values / metric_overrides / ai_suggestions ──────────
create policy kpi_values_select on public.kpi_values for select
  using (public.is_admin() or public.is_member_of(client_id));
create policy kpi_values_admin_write on public.kpi_values for all
  using (public.is_admin()) with check (public.is_admin());

-- Overrides/suggestions: client-role is read-only; other members can act.
create policy metric_overrides_select on public.metric_overrides for select
  using (public.is_admin() or public.is_member_of(client_id));
create policy metric_overrides_write on public.metric_overrides for all
  using (public.is_admin() or (public.is_member_of(client_id) and not public.is_client_viewer(client_id)))
  with check (public.is_admin() or (public.is_member_of(client_id) and not public.is_client_viewer(client_id)));

create policy ai_suggestions_select on public.ai_suggestions for select
  using (public.is_admin() or public.is_member_of(client_id));
create policy ai_suggestions_write on public.ai_suggestions for all
  using (public.is_admin() or (public.is_member_of(client_id) and not public.is_client_viewer(client_id)))
  with check (public.is_admin() or (public.is_member_of(client_id) and not public.is_client_viewer(client_id)));

-- ─── fx_rates (global reference: any authenticated user may read) ────────────
create policy fx_rates_select on public.fx_rates for select
  using (auth.uid() is not null);
create policy fx_rates_admin_write on public.fx_rates for all
  using (public.is_admin()) with check (public.is_admin());
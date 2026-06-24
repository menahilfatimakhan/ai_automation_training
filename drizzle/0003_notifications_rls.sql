-- RLS for the notifications table (in-app delivery channel).
-- A member of the client can read its notifications; a user-targeted
-- notification is visible only to that user (or admins). Inserts are performed
-- by trusted server code via the service role (BYPASSRLS), so no insert policy
-- is granted to regular users; users may mark their own as read.

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications for select
  using (
    public.is_admin()
    or (
      public.is_member_of(client_id)
      and (user_id is null or user_id = auth.uid())
    )
  );

-- Allow a recipient to update (mark read) their own notifications.
create policy notifications_mark_read on public.notifications for update
  using (
    public.is_admin()
    or (public.is_member_of(client_id) and (user_id is null or user_id = auth.uid()))
  )
  with check (
    public.is_admin()
    or (public.is_member_of(client_id) and (user_id is null or user_id = auth.uid()))
  );

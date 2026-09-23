create or replace function public.support_unread_count()
returns integer
language sql
stable security definer
set search_path to 'public'
as $$
  select count(*)::int
  from public.support_messages m
  join public.support_tickets t on t.id = m.ticket_id
  where m.read_at is null
    and m.is_internal = false
    and m.sender_type = 'admin'
    and t.user_id = auth.uid();
$$;

create or replace function public.admin_support_unread_count()
returns integer
language sql
stable security definer
set search_path to 'public'
as $$
  select case when public.is_admin() then (
    select count(*)::int
    from public.support_messages m
    where m.read_at is null and m.is_internal = false and m.sender_type = 'user'
  ) else 0 end;
$$;

revoke all on function public.admin_support_unread_count() from public, anon;
grant execute on function public.admin_support_unread_count() to authenticated;
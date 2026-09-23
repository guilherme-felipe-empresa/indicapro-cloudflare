
create type public.support_category as enum ('commission','referral','withdrawal','product','account','technical','other');
create type public.support_status as enum ('open','in_progress','waiting_user','resolved','closed');
create type public.support_sender as enum ('user','admin');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  category public.support_category not null default 'other',
  subject text not null,
  status public.support_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);
create index support_tickets_user_idx on public.support_tickets(user_id, created_at desc);
create index support_tickets_status_idx on public.support_tickets(status);

grant select on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
alter table public.support_tickets enable row level security;
create policy support_tickets_select on public.support_tickets
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_type public.support_sender not null,
  message text not null,
  is_internal boolean not null default false,
  attachment_path text,
  attachment_name text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages(ticket_id, created_at);

grant select on public.support_messages to authenticated;
grant all on public.support_messages to service_role;
alter table public.support_messages enable row level security;
create policy support_messages_select on public.support_messages
  for select to authenticated using (
    public.is_admin()
    or (is_internal = false and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    ))
  );

create or replace function public.support_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.support_touch_updated_at();

create or replace function public.support_new_protocol()
returns text language plpgsql stable set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := 'SUP-';
    for i in 1..5 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.support_tickets where protocol = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.create_support_ticket(
  _category public.support_category,
  _subject text,
  _message text,
  _attachment_path text default null,
  _attachment_name text default null
) returns table(id uuid, protocol text)
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _ticket public.support_tickets%rowtype;
begin
  if _uid is null then raise exception 'Não autenticado'; end if;
  if coalesce(trim(_subject),'') = '' then raise exception 'Informe o assunto'; end if;
  if coalesce(trim(_message),'') = '' then raise exception 'Informe a mensagem'; end if;

  insert into public.support_tickets(protocol, user_id, category, subject)
  values (public.support_new_protocol(), _uid, _category, left(trim(_subject), 160))
  returning * into _ticket;

  insert into public.support_messages(ticket_id, sender_id, sender_type, message, attachment_path, attachment_name)
  values (_ticket.id, _uid, 'user', trim(_message), _attachment_path, _attachment_name);

  return query select _ticket.id, _ticket.protocol;
end;
$$;

create or replace function public.post_support_message(
  _ticket_id uuid,
  _message text,
  _is_internal boolean default false,
  _attachment_path text default null,
  _attachment_name text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _admin boolean := public.is_admin();
  _t public.support_tickets%rowtype;
  _id uuid;
begin
  if _uid is null then raise exception 'Não autenticado'; end if;
  if coalesce(trim(_message),'') = '' then raise exception 'Mensagem vazia'; end if;
  select * into _t from public.support_tickets where id = _ticket_id;
  if not found then raise exception 'Chamado não encontrado'; end if;
  if not _admin and _t.user_id <> _uid then raise exception 'Acesso negado'; end if;
  if not _admin and _t.status = 'closed' then raise exception 'Chamado encerrado'; end if;
  if _is_internal and not _admin then raise exception 'Acesso negado'; end if;

  insert into public.support_messages(ticket_id, sender_id, sender_type, message, is_internal, attachment_path, attachment_name)
  values (_ticket_id, _uid, case when _admin then 'admin' else 'user' end, trim(_message),
          coalesce(_is_internal,false) and _admin, _attachment_path, _attachment_name)
  returning id into _id;

  if not coalesce(_is_internal,false) then
    update public.support_tickets
      set status = case
            when _admin and status in ('open','in_progress') then 'waiting_user'::public.support_status
            when not _admin and status in ('waiting_user','resolved') then 'in_progress'::public.support_status
            else status end,
          updated_at = now()
      where id = _ticket_id;
  else
    update public.support_tickets set updated_at = now() where id = _ticket_id;
  end if;

  return _id;
end;
$$;

create or replace function public.mark_support_read(_ticket_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _admin boolean := public.is_admin();
  _t public.support_tickets%rowtype;
begin
  if _uid is null then raise exception 'Não autenticado'; end if;
  select * into _t from public.support_tickets where id = _ticket_id;
  if not found then raise exception 'Chamado não encontrado'; end if;
  if not _admin and _t.user_id <> _uid then raise exception 'Acesso negado'; end if;

  update public.support_messages
    set read_at = now()
    where ticket_id = _ticket_id
      and read_at is null
      and is_internal = false
      and sender_type = case when _admin then 'user'::public.support_sender else 'admin'::public.support_sender end;
end;
$$;

create or replace function public.support_unread_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.support_messages m
  join public.support_tickets t on t.id = m.ticket_id
  where m.read_at is null and m.is_internal = false
    and case when public.is_admin()
      then m.sender_type = 'user'
      else t.user_id = auth.uid() and m.sender_type = 'admin' end;
$$;

create or replace function public.admin_set_ticket_status(_ticket_id uuid, _status public.support_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  _t public.support_tickets%rowtype;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into _t from public.support_tickets where id = _ticket_id;
  if not found then raise exception 'Chamado não encontrado'; end if;

  update public.support_tickets
    set status = _status,
        resolved_at = case when _status = 'resolved' then now() when _status in ('open','in_progress','waiting_user') then null else resolved_at end,
        closed_at = case when _status = 'closed' then now() when _status in ('open','in_progress','waiting_user') then null else closed_at end,
        updated_at = now()
    where id = _ticket_id;

  perform public.log_audit('support_status_change', 'support_tickets', _ticket_id,
    jsonb_build_object('status', _t.status), jsonb_build_object('status', _status));
end;
$$;

create or replace function public.list_my_support_tickets()
returns table(
  id uuid, protocol text, category public.support_category, subject text,
  status public.support_status, created_at timestamptz, updated_at timestamptz,
  unread_count integer, last_message text
) language sql stable security definer set search_path = public as $$
  select t.id, t.protocol, t.category, t.subject, t.status, t.created_at, t.updated_at,
    (select count(*)::int from public.support_messages m
      where m.ticket_id = t.id and m.is_internal = false and m.sender_type = 'admin' and m.read_at is null),
    (select m.message from public.support_messages m
      where m.ticket_id = t.id and m.is_internal = false order by m.created_at desc limit 1)
  from public.support_tickets t
  where t.user_id = auth.uid()
  order by t.updated_at desc;
$$;

create or replace function public.admin_list_support_tickets()
returns table(
  id uuid, protocol text, category public.support_category, subject text,
  status public.support_status, created_at timestamptz, updated_at timestamptz,
  unread_count integer, user_id uuid, user_name text, user_email text, user_phone text
) language sql stable security definer set search_path = public as $$
  select t.id, t.protocol, t.category, t.subject, t.status, t.created_at, t.updated_at,
    (select count(*)::int from public.support_messages m
      where m.ticket_id = t.id and m.is_internal = false and m.sender_type = 'user' and m.read_at is null),
    t.user_id, p.name, p.email, p.phone
  from public.support_tickets t
  left join public.profiles p on p.id = t.user_id
  where public.is_admin()
  order by t.updated_at desc;
$$;

revoke all on function public.support_new_protocol() from public, anon;
revoke all on function public.create_support_ticket(public.support_category, text, text, text, text) from public, anon;
revoke all on function public.post_support_message(uuid, text, boolean, text, text) from public, anon;
revoke all on function public.mark_support_read(uuid) from public, anon;
revoke all on function public.support_unread_count() from public, anon;
revoke all on function public.admin_set_ticket_status(uuid, public.support_status) from public, anon;
revoke all on function public.list_my_support_tickets() from public, anon;
revoke all on function public.admin_list_support_tickets() from public, anon;

grant execute on function public.create_support_ticket(public.support_category, text, text, text, text) to authenticated;
grant execute on function public.post_support_message(uuid, text, boolean, text, text) to authenticated;
grant execute on function public.mark_support_read(uuid) to authenticated;
grant execute on function public.support_unread_count() to authenticated;
grant execute on function public.admin_set_ticket_status(uuid, public.support_status) to authenticated;
grant execute on function public.list_my_support_tickets() to authenticated;
grant execute on function public.admin_list_support_tickets() to authenticated;

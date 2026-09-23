
create or replace function public.admin_list_users()
returns table (
  id uuid,
  name text,
  email text,
  phone text,
  status text,
  role public.app_role,
  created_at timestamptz,
  balance_cents bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select p.id, p.name, p.email, p.phone, p.status,
      case when public.has_role(p.id, 'admin') then 'admin'::public.app_role else 'user'::public.app_role end,
      p.created_at,
      coalesce((select sum(wt.amount_cents) from public.wallet_transactions wt where wt.user_id = p.id), 0)::bigint
    from public.profiles p
    order by p.created_at desc;
end; $$;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_set_user_role(_user_id uuid, _role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
declare v_was public.app_role;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if _user_id = auth.uid() then raise exception 'voce nao pode alterar o seu proprio nivel de acesso'; end if;
  if not exists (select 1 from public.profiles where id = _user_id) then
    raise exception 'usuario nao encontrado';
  end if;

  v_was := case when public.has_role(_user_id, 'admin') then 'admin'::public.app_role else 'user'::public.app_role end;
  if v_was = _role then return; end if;

  if _role = 'admin' then
    insert into public.user_roles (user_id, role) values (_user_id, 'admin') on conflict do nothing;
  else
    delete from public.user_roles where user_id = _user_id and role = 'admin';
    insert into public.user_roles (user_id, role) values (_user_id, 'user') on conflict do nothing;
  end if;

  perform public.log_audit('user_role_change', 'user_roles', _user_id,
    jsonb_build_object('role', v_was), jsonb_build_object('role', _role));
end; $$;
revoke all on function public.admin_set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.admin_set_user_role(uuid, public.app_role) to authenticated;

create or replace function public.admin_set_user_status(_user_id uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if _status not in ('active','blocked') then raise exception 'status invalido'; end if;
  if _user_id = auth.uid() then raise exception 'voce nao pode alterar o status da sua propria conta'; end if;

  select status into v_old from public.profiles where id = _user_id;
  if v_old is null then raise exception 'usuario nao encontrado'; end if;
  if v_old = _status then return; end if;

  update public.profiles set status = _status, updated_at = now() where id = _user_id;

  perform public.log_audit('user_status_change', 'profiles', _user_id,
    jsonb_build_object('status', v_old), jsonb_build_object('status', _status));
end; $$;
revoke all on function public.admin_set_user_status(uuid, text) from public, anon;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

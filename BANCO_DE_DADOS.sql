-- INDICAPRO - BANCO COMPLETO (gerado das migracoes reais)
-- Rode inteiro no SQL Editor de um projeto Supabase NOVO.


-- ===== 20260921171347_29904c32-8e87-4055-9848-1110bc5186b9.sql =====

-- ROLES
create type public.app_role as enum ('user','admin');
create type public.pix_key_type as enum ('cpf','cnpj','email','phone','random');
create type public.commission_type as enum ('fixed','percentage');
create type public.intent_status as enum ('pending','approved','failed');
create type public.withdrawal_status as enum ('pending','paid','failed','rejected');
create type public.wallet_tx_type as enum ('commission_credit','withdrawal_debit','adjustment');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  phone text,
  pix_key text,
  pix_key_type public.pix_key_type,
  status text not null default 'active' check (status in ('active','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin');
$$;

create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "profiles_insert_self" on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "user_roles_select_own" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- PRODUCTS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  image_url text,
  price_cents bigint not null check (price_cents >= 0),
  commission_type public.commission_type not null default 'fixed',
  commission_value bigint not null check (commission_value >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.products to anon;
grant select, insert, update on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products_public_read_active" on public.products for select to anon using (active = true);
create policy "products_read" on public.products for select to authenticated using (active = true or public.is_admin());
create policy "products_admin_insert" on public.products for insert to authenticated with check (public.is_admin());
create policy "products_admin_update" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.commission_cents(_price bigint, _type public.commission_type, _value bigint)
returns bigint language sql immutable as $$
  select case when _type = 'fixed' then _value else floor(_price * _value / 10000.0)::bigint end;
$$;

-- REFERRAL LINKS
create table public.referral_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
grant select on public.referral_links to authenticated;
grant all on public.referral_links to service_role;
alter table public.referral_links enable row level security;
create policy "referral_links_own" on public.referral_links for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create index referral_links_token_idx on public.referral_links(token);

-- PURCHASE INTENTS
create table public.purchase_intents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  product_id uuid not null references public.products(id),
  referrer_id uuid references auth.users(id) on delete set null,
  referral_token text,
  product_name text not null,
  price_cents bigint not null,
  commission_cents bigint not null default 0 check (commission_cents >= 0),
  status public.intent_status not null default 'pending',
  approved_at timestamptz,
  approved_by uuid,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.purchase_intents to authenticated;
grant all on public.purchase_intents to service_role;
alter table public.purchase_intents enable row level security;
create policy "intents_select_own" on public.purchase_intents for select to authenticated
  using (referrer_id = auth.uid() or public.is_admin());
create index purchase_intents_referrer_idx on public.purchase_intents(referrer_id);
create index purchase_intents_status_idx on public.purchase_intents(status);

-- WALLET
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.wallet_tx_type not null,
  amount_cents bigint not null,
  purchase_intent_id uuid unique references public.purchase_intents(id) on delete set null,
  withdrawal_id uuid,
  description text,
  created_at timestamptz not null default now()
);
grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;
create policy "wallet_select_own" on public.wallet_transactions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create index wallet_tx_user_idx on public.wallet_transactions(user_id);

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  pix_key text not null,
  pix_key_type public.pix_key_type not null,
  status public.withdrawal_status not null default 'pending',
  note text,
  payment_reference text,
  paid_at timestamptz,
  admin_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.withdrawals to authenticated;
grant all on public.withdrawals to service_role;
alter table public.withdrawals enable row level security;
create policy "withdrawals_select_own" on public.withdrawals for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create index withdrawals_user_idx on public.withdrawals(user_id);

-- SETTINGS
create table public.app_settings (
  id boolean primary key default true check (id),
  app_name text not null default 'IndicaPro',
  whatsapp_number text not null default '5511999999999',
  min_withdrawal_cents bigint not null default 2000 check (min_withdrawal_cents >= 0),
  attribution_days int not null default 30 check (attribution_days > 0),
  allow_self_referral boolean not null default false,
  support_email text default '',
  support_phone text default '',
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to anon, authenticated;
grant update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "settings_read" on public.app_settings for select to anon, authenticated using (true);
create policy "settings_admin_update" on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
insert into public.app_settings (id) values (true);

-- AUDIT
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit_admin_read" on public.audit_logs for select to authenticated using (public.is_admin());

create or replace function public.log_audit(_action text, _entity text, _entity_id uuid, _old jsonb, _new jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (admin_id, action, entity, entity_id, old_value, new_value)
  values (auth.uid(), _action, _entity, _entity_id, _old, _new);
$$;

-- NEW USER TRIGGER
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''), coalesce(new.email,''), new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- BALANCE
create or replace function public.wallet_summary()
returns table (available_cents bigint, pending_cents bigint, total_received_cents bigint, withdrawing_cents bigint)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(amount_cents) from public.wallet_transactions where user_id = auth.uid()),0)::bigint,
    coalesce((select sum(commission_cents) from public.purchase_intents where referrer_id = auth.uid() and status = 'pending'),0)::bigint,
    coalesce((select sum(amount_cents) from public.wallet_transactions where user_id = auth.uid() and type = 'commission_credit'),0)::bigint,
    coalesce((select sum(amount_cents) from public.withdrawals where user_id = auth.uid() and status = 'pending'),0)::bigint;
$$;

-- REFERRAL LINK CREATION
create or replace function public.get_or_create_referral_link(_product_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select token into v_token from public.referral_links where user_id = auth.uid() and product_id = _product_id;
  if v_token is not null then return v_token; end if;
  v_token := replace(encode(gen_random_bytes(12),'base64'),'/','_');
  v_token := replace(replace(v_token,'+','-'),'=','');
  insert into public.referral_links (user_id, product_id, token) values (auth.uid(), _product_id, v_token)
    on conflict (user_id, product_id) do update set token = public.referral_links.token
    returning token into v_token;
  return v_token;
end; $$;

-- PURCHASE INTENT (public)
create or replace function public.create_purchase_intent(_slug text, _ref text default null)
returns table (code text, whatsapp_number text, product_name text)
language plpgsql security definer set search_path = public as $$
declare
  p public.products%rowtype;
  v_ref_user uuid;
  v_comm bigint := 0;
  v_code text;
  s public.app_settings%rowtype;
  v_token text;
begin
  select * into p from public.products where slug = _slug and active = true;
  if p.id is null then raise exception 'produto indisponivel'; end if;
  select * into s from public.app_settings where id;

  if _ref is not null and length(_ref) > 0 then
    select rl.user_id, rl.token into v_ref_user, v_token from public.referral_links rl
      where rl.token = _ref and rl.product_id = p.id
        and rl.created_at > now() - (s.attribution_days || ' days')::interval;
  end if;

  if v_ref_user is not null and auth.uid() is not null and v_ref_user = auth.uid() and s.allow_self_referral = false then
    v_ref_user := null; v_token := null;
  end if;

  if v_ref_user is not null then
    v_comm := public.commission_cents(p.price_cents, p.commission_type, p.commission_value);
  end if;

  v_code := 'IND-' || upper(substr(replace(encode(gen_random_bytes(8),'base64'),'/',''), 1, 6));

  insert into public.purchase_intents (code, product_id, referrer_id, referral_token, product_name, price_cents, commission_cents)
  values (v_code, p.id, v_ref_user, v_token, p.name, p.price_cents, v_comm);

  return query select v_code, s.whatsapp_number, p.name;
end; $$;
grant execute on function public.create_purchase_intent(text, text) to anon, authenticated;

-- APPROVE / FAIL (admin, idempotent)
create or replace function public.set_intent_status(_id uuid, _status public.intent_status, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare i public.purchase_intents%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into i from public.purchase_intents where id = _id for update;
  if i.id is null then raise exception 'indicacao nao encontrada'; end if;
  if i.status <> 'pending' then raise exception 'indicacao ja processada'; end if;

  update public.purchase_intents
    set status = _status, note = _note,
        approved_at = case when _status = 'approved' then now() else null end,
        approved_by = auth.uid()
    where id = _id;

  if _status = 'approved' and i.referrer_id is not null and i.commission_cents > 0 then
    insert into public.wallet_transactions (user_id, type, amount_cents, purchase_intent_id, description)
    values (i.referrer_id, 'commission_credit', i.commission_cents, i.id, 'Comissão ' || i.code)
    on conflict (purchase_intent_id) do nothing;
  end if;

  perform public.log_audit('intent_' || _status::text, 'purchase_intents', _id, jsonb_build_object('status', i.status), jsonb_build_object('status', _status, 'note', _note));
end; $$;

-- WITHDRAWAL REQUEST
create or replace function public.request_withdrawal(_amount_cents bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pr public.profiles%rowtype;
  s public.app_settings%rowtype;
  v_balance bigint;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select * into pr from public.profiles where id = auth.uid();
  if pr.status <> 'active' then raise exception 'conta inativa'; end if;
  if pr.pix_key is null or length(trim(pr.pix_key)) = 0 or pr.pix_key_type is null then
    raise exception 'cadastre uma chave PIX antes de sacar';
  end if;
  select * into s from public.app_settings where id;
  if _amount_cents < s.min_withdrawal_cents then raise exception 'valor abaixo do minimo permitido'; end if;
  select coalesce(sum(amount_cents),0) into v_balance from public.wallet_transactions where user_id = auth.uid();
  if _amount_cents > v_balance then raise exception 'saldo insuficiente'; end if;

  insert into public.withdrawals (user_id, amount_cents, pix_key, pix_key_type)
  values (auth.uid(), _amount_cents, pr.pix_key, pr.pix_key_type) returning id into v_id;

  insert into public.wallet_transactions (user_id, type, amount_cents, withdrawal_id, description)
  values (auth.uid(), 'withdrawal_debit', -_amount_cents, v_id, 'Saque solicitado');

  return v_id;
end; $$;

-- WITHDRAWAL STATUS (admin)
create or replace function public.set_withdrawal_status(_id uuid, _status public.withdrawal_status, _note text default null, _reference text default null)
returns void language plpgsql security definer set search_path = public as $$
declare w public.withdrawals%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into w from public.withdrawals where id = _id for update;
  if w.id is null then raise exception 'saque nao encontrado'; end if;
  if w.status <> 'pending' then raise exception 'saque ja processado'; end if;

  update public.withdrawals set status = _status, note = _note, payment_reference = _reference,
    admin_id = auth.uid(), paid_at = case when _status = 'paid' then now() else null end
   where id = _id;

  if _status in ('failed','rejected') then
    insert into public.wallet_transactions (user_id, type, amount_cents, withdrawal_id, description)
    values (w.user_id, 'adjustment', w.amount_cents, w.id, 'Estorno de saque');
  end if;

  perform public.log_audit('withdrawal_' || _status::text, 'withdrawals', _id, jsonb_build_object('status', w.status), jsonb_build_object('status', _status, 'note', _note));
end; $$;

-- ADMIN STATS
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'active_products', (select count(*) from public.products where active),
    'pending_intents', (select count(*) from public.purchase_intents where status = 'pending'),
    'approved_commissions_cents', (select coalesce(sum(commission_cents),0) from public.purchase_intents where status = 'approved'),
    'pending_withdrawals', (select count(*) from public.withdrawals where status = 'pending'),
    'total_commissions_cents', (select coalesce(sum(commission_cents),0) from public.purchase_intents),
    'total_paid_cents', (select coalesce(sum(amount_cents),0) from public.withdrawals where status = 'paid')
  );
end; $$;

-- product audit trigger
create or replace function public.audit_product_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if (old.commission_type, old.commission_value, old.price_cents, old.active) is distinct from (new.commission_type, new.commission_value, new.price_cents, new.active) then
    perform public.log_audit('product_update','products', new.id,
      jsonb_build_object('price_cents', old.price_cents, 'commission_type', old.commission_type, 'commission_value', old.commission_value, 'active', old.active),
      jsonb_build_object('price_cents', new.price_cents, 'commission_type', new.commission_type, 'commission_value', new.commission_value, 'active', new.active));
  end if;
  return new;
end; $$;
create trigger products_audit before update on public.products for each row execute function public.audit_product_change();


-- ===== 20260921171408_011fec4a-7eb1-41cb-a91d-0dfd13c950a8.sql =====

alter function public.commission_cents(bigint, public.commission_type, bigint) set search_path = public;

revoke all on function public.log_audit(text,text,uuid,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.audit_product_change() from public, anon, authenticated;
revoke all on function public.commission_cents(bigint, public.commission_type, bigint) from public, anon;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.wallet_summary() from public, anon;
revoke all on function public.get_or_create_referral_link(uuid) from public, anon;
revoke all on function public.request_withdrawal(bigint) from public, anon;
revoke all on function public.set_intent_status(uuid, public.intent_status, text) from public, anon;
revoke all on function public.set_withdrawal_status(uuid, public.withdrawal_status, text, text) from public, anon;
revoke all on function public.admin_stats() from public, anon;
revoke all on function public.create_purchase_intent(text, text) from public;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.commission_cents(bigint, public.commission_type, bigint) to authenticated;
grant execute on function public.wallet_summary() to authenticated;
grant execute on function public.get_or_create_referral_link(uuid) to authenticated;
grant execute on function public.request_withdrawal(bigint) to authenticated;
grant execute on function public.set_intent_status(uuid, public.intent_status, text) to authenticated;
grant execute on function public.set_withdrawal_status(uuid, public.withdrawal_status, text, text) to authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.create_purchase_intent(text, text) to anon, authenticated;


-- ===== 20260921172426_82695c12-36b3-4305-aad0-b8573f1f668c.sql =====

create or replace function public.get_or_create_referral_link(_product_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select token into v_token from public.referral_links where user_id = auth.uid() and product_id = _product_id;
  if v_token is not null then return v_token; end if;
  v_token := substr(replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''), 1, 22);
  insert into public.referral_links (user_id, product_id, token) values (auth.uid(), _product_id, v_token)
    on conflict (user_id, product_id) do update set token = public.referral_links.token
    returning token into v_token;
  return v_token;
end; $$;
revoke all on function public.get_or_create_referral_link(uuid) from public, anon;
grant execute on function public.get_or_create_referral_link(uuid) to authenticated;

create or replace function public.create_purchase_intent(_slug text, _ref text default null)
returns table (code text, whatsapp_number text, product_name text)
language plpgsql security definer set search_path = public as $$
declare
  p public.products%rowtype;
  v_ref_user uuid;
  v_comm bigint := 0;
  v_code text;
  s public.app_settings%rowtype;
  v_token text;
begin
  select * into p from public.products where slug = _slug and active = true;
  if p.id is null then raise exception 'produto indisponivel'; end if;
  select * into s from public.app_settings where id;

  if _ref is not null and length(_ref) > 0 then
    select rl.user_id, rl.token into v_ref_user, v_token from public.referral_links rl
      where rl.token = _ref and rl.product_id = p.id
        and rl.created_at > now() - (s.attribution_days || ' days')::interval;
  end if;

  if v_ref_user is not null and auth.uid() is not null and v_ref_user = auth.uid() and s.allow_self_referral = false then
    v_ref_user := null; v_token := null;
  end if;

  if v_ref_user is not null then
    v_comm := public.commission_cents(p.price_cents, p.commission_type, p.commission_value);
  end if;

  v_code := 'IND-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));

  insert into public.purchase_intents (code, product_id, referrer_id, referral_token, product_name, price_cents, commission_cents)
  values (v_code, p.id, v_ref_user, v_token, p.name, p.price_cents, v_comm);

  return query select v_code, s.whatsapp_number, p.name;
end; $$;
revoke all on function public.create_purchase_intent(text, text) from public;
grant execute on function public.create_purchase_intent(text, text) to anon, authenticated;


-- ===== 20260921180249_18b5b988-f1d3-47b5-8f28-f01fc60c08e1.sql =====

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


-- ===== 20260921194513_c55ee1c7-3347-4558-8e21-75656297bdd8.sql =====

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


-- ===== 20260921194533_225b105b-188e-4816-9c78-7a098c3ac6a8.sql =====

create policy "support_attach_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "support_attach_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'support-attachments'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));


-- ===== 20260921195029_5413ea04-dcb0-488f-982a-2f93d9c10141.sql =====
CREATE OR REPLACE FUNCTION public.post_support_message(_ticket_id uuid, _message text, _is_internal boolean DEFAULT false, _attachment_path text DEFAULT NULL::text, _attachment_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  values (_ticket_id, _uid,
          (case when _admin then 'admin' else 'user' end)::public.support_sender,
          trim(_message),
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
$function$;

-- ===== 20260921202654_66cb6105-9dd0-4e44-adc7-f4e19c22fc67.sql =====
CREATE POLICY "product_images_admin_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
CREATE POLICY "product_images_admin_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND public.is_admin()) WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
CREATE POLICY "product_images_admin_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images' AND public.is_admin());
CREATE POLICY "product_images_admin_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND public.is_admin());

-- ===== 20260921205040_bcd89a72-6624-4172-a491-668bf925051f.sql =====
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

-- ===== 20260921212251_28b30d7e-b2c6-4839-b8bb-7194b888d271.sql =====
CREATE OR REPLACE FUNCTION public.admin_delete_product(_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.products%ROWTYPE;
  _uses int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO _p FROM public.products WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'produto não encontrado';
  END IF;

  SELECT
    (SELECT count(*) FROM public.purchase_intents WHERE product_id = _id)
    + (SELECT count(*) FROM public.referral_links WHERE product_id = _id)
  INTO _uses;

  IF _uses > 0 THEN
    UPDATE public.products SET active = false, updated_at = now() WHERE id = _id;
    PERFORM public.log_audit('product_delete_blocked', 'products', _id,
      to_jsonb(_p), jsonb_build_object('active', false, 'reason', 'has_history'));
    RAISE EXCEPTION 'produto possui histórico';
  END IF;

  DELETE FROM public.products WHERE id = _id;
  PERFORM public.log_audit('product_deleted', 'products', _id, to_jsonb(_p), NULL);
  RETURN _p.image_url;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_product(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_product(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_ticket(_ticket_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t public.support_tickets%ROWTYPE;
  _paths text[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO _t FROM public.support_tickets WHERE id = _ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'chamado não encontrado';
  END IF;

  IF _t.status NOT IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'chamado não finalizado';
  END IF;

  SELECT coalesce(array_agg(attachment_path), '{}')
    INTO _paths
    FROM public.support_messages
   WHERE ticket_id = _ticket_id AND attachment_path IS NOT NULL;

  DELETE FROM public.support_messages WHERE ticket_id = _ticket_id;
  DELETE FROM public.support_tickets WHERE id = _ticket_id;

  PERFORM public.log_audit('support_ticket_deleted', 'support_tickets', _ticket_id,
    to_jsonb(_t), NULL);

  RETURN _paths;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_ticket(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_ticket(uuid) TO authenticated;

-- ===== 20260921215554_b5df3be6-333b-4b75-b421-601a91170584.sql =====

alter table public.purchase_intents
  add column if not exists proof_path text,
  add column if not exists proof_name text,
  add column if not exists proof_ref text;

create or replace function public.create_purchase_intent(_slug text, _ref text default null::text)
 returns table(code text, whatsapp_number text, product_name text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  p public.products%rowtype;
  v_ref_user uuid;
  v_comm bigint := 0;
  v_code text;
  s public.app_settings%rowtype;
  v_token text;
begin
  select * into p from public.products where slug = _slug and active = true;
  if p.id is null then raise exception 'produto indisponivel'; end if;
  select * into s from public.app_settings where id;

  if _ref is not null and length(_ref) > 0 then
    select rl.user_id, rl.token into v_ref_user, v_token from public.referral_links rl
      where rl.token = _ref and rl.product_id = p.id
        and rl.created_at > now() - (s.attribution_days || ' days')::interval;
  end if;

  if v_ref_user is not null and auth.uid() is not null and v_ref_user = auth.uid() and s.allow_self_referral = false then
    v_ref_user := null; v_token := null;
  end if;

  if v_ref_user is not null then
    v_comm := public.commission_cents(p.price_cents, p.commission_type, p.commission_value);
  end if;

  v_code := 'IND-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));

  if v_ref_user is null then
    insert into public.purchase_intents (code, product_id, referrer_id, referral_token, product_name, price_cents, commission_cents, status, approved_at, note)
    values (v_code, p.id, null, null, p.name, p.price_cents, 0, 'approved', now(), 'Compra direta sem indicacao');
  else
    insert into public.purchase_intents (code, product_id, referrer_id, referral_token, product_name, price_cents, commission_cents)
    values (v_code, p.id, v_ref_user, v_token, p.name, p.price_cents, v_comm);
  end if;

  return query select v_code, s.whatsapp_number, p.name;
end; $function$;

drop function if exists public.set_intent_status(uuid, intent_status, text);

create or replace function public.set_intent_status(
  _id uuid,
  _status intent_status,
  _note text default null::text,
  _proof_path text default null::text,
  _proof_name text default null::text,
  _proof_ref text default null::text
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare i public.purchase_intents%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into i from public.purchase_intents where id = _id for update;
  if i.id is null then raise exception 'indicacao nao encontrada'; end if;
  if i.status <> 'pending' then raise exception 'indicacao ja processada'; end if;

  if _status = 'approved' and i.referrer_id is not null
     and coalesce(nullif(trim(_proof_path), ''), nullif(trim(_proof_ref), '')) is null then
    raise exception 'comprovante obrigatorio';
  end if;

  update public.purchase_intents
    set status = _status,
        note = _note,
        proof_path = nullif(trim(coalesce(_proof_path, '')), ''),
        proof_name = nullif(trim(coalesce(_proof_name, '')), ''),
        proof_ref = nullif(trim(coalesce(_proof_ref, '')), ''),
        approved_at = case when _status = 'approved' then now() else null end,
        approved_by = auth.uid()
    where id = _id;

  if _status = 'approved' and i.referrer_id is not null and i.commission_cents > 0 then
    insert into public.wallet_transactions (user_id, type, amount_cents, purchase_intent_id, description)
    values (i.referrer_id, 'commission_credit', i.commission_cents, i.id, 'Comissão ' || i.code)
    on conflict (purchase_intent_id) do nothing;
  end if;

  perform public.log_audit('intent_' || _status::text, 'purchase_intents', _id,
    jsonb_build_object('status', i.status),
    jsonb_build_object('status', _status, 'note', _note, 'proof_path', _proof_path, 'proof_ref', _proof_ref));
end; $function$;

create policy "intent_proofs_admin_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'intent-proofs' and public.is_admin());

create policy "intent_proofs_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'intent-proofs' and public.is_admin());

create policy "intent_proofs_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'intent-proofs' and public.is_admin());


-- ===== 20260921235041_86990285-d3e4-4efe-af8e-a28556798db5.sql =====
CREATE OR REPLACE FUNCTION public.post_support_message(_ticket_id uuid, _message text, _is_internal boolean DEFAULT false, _attachment_path text DEFAULT NULL::text, _attachment_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _uid uuid := auth.uid();
  _admin boolean := public.is_admin();
  _t public.support_tickets%rowtype;
  _id uuid;
  _txt text := coalesce(trim(_message), '');
begin
  if _uid is null then raise exception 'Não autenticado'; end if;
  if _txt = '' and coalesce(_attachment_path,'') = '' then raise exception 'Mensagem vazia'; end if;
  if _txt = '' then _txt := coalesce(_attachment_name, 'Anexo enviado'); end if;
  select * into _t from public.support_tickets where id = _ticket_id;
  if not found then raise exception 'Chamado não encontrado'; end if;
  if not _admin and _t.user_id <> _uid then raise exception 'Acesso negado'; end if;
  if not _admin and _t.status = 'closed' then raise exception 'Chamado encerrado'; end if;
  if _is_internal and not _admin then raise exception 'Acesso negado'; end if;

  insert into public.support_messages(ticket_id, sender_id, sender_type, message, is_internal, attachment_path, attachment_name)
  values (_ticket_id, _uid,
          (case when _admin then 'admin' else 'user' end)::public.support_sender,
          _txt,
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
$function$;

-- ===== 20260922021936_6dffa5ee-5450-452e-9e3c-0c2bce83564c.sql =====
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS direct_sales_admin_id uuid REFERENCES auth.users(id);

UPDATE public.app_settings SET direct_sales_admin_id = (
  SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.created_at LIMIT 1
) WHERE direct_sales_admin_id IS NULL;

CREATE OR REPLACE FUNCTION public.create_purchase_intent(_slug text, _ref text DEFAULT NULL::text)
 RETURNS TABLE(code text, whatsapp_number text, product_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p public.products%rowtype;
  v_ref_user uuid;
  v_comm bigint := 0;
  v_code text;
  s public.app_settings%rowtype;
  v_token text;
begin
  select * into p from public.products where slug = _slug and active = true;
  if p.id is null then raise exception 'produto indisponivel'; end if;
  select * into s from public.app_settings where id;

  if _ref is not null and length(_ref) > 0 then
    select rl.user_id, rl.token into v_ref_user, v_token from public.referral_links rl
      where rl.token = _ref and rl.product_id = p.id
        and rl.created_at > now() - (s.attribution_days || ' days')::interval;
  end if;

  if v_ref_user is not null and auth.uid() is not null and v_ref_user = auth.uid() and s.allow_self_referral = false then
    v_ref_user := null; v_token := null;
  end if;

  if v_ref_user is not null then
    v_comm := public.commission_cents(p.price_cents, p.commission_type, p.commission_value);
  end if;

  v_code := 'IND-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));

  insert into public.purchase_intents (code, product_id, referrer_id, referral_token, product_name, price_cents, commission_cents, note)
  values (v_code, p.id, v_ref_user, v_token, p.name, p.price_cents, v_comm,
          case when v_ref_user is null then 'Compra direta sem indicacao' else null end);

  return query select v_code, s.whatsapp_number, p.name;
end; $function$;

CREATE OR REPLACE FUNCTION public.set_intent_status(_id uuid, _status intent_status, _note text DEFAULT NULL::text, _proof_path text DEFAULT NULL::text, _proof_name text DEFAULT NULL::text, _proof_ref text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  i public.purchase_intents%rowtype;
  s public.app_settings%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into i from public.purchase_intents where id = _id for update;
  if i.id is null then raise exception 'indicacao nao encontrada'; end if;
  if i.status <> 'pending' then raise exception 'indicacao ja processada'; end if;
  select * into s from public.app_settings where id;

  if _status = 'approved'
     and coalesce(nullif(trim(_proof_path), ''), nullif(trim(_proof_ref), '')) is null then
    raise exception 'comprovante obrigatorio';
  end if;

  if _status = 'approved' and i.referrer_id is null and s.direct_sales_admin_id is null then
    raise exception 'conta de recebimento nao configurada';
  end if;

  update public.purchase_intents
    set status = _status,
        note = coalesce(_note, note),
        proof_path = nullif(trim(coalesce(_proof_path, '')), ''),
        proof_name = nullif(trim(coalesce(_proof_name, '')), ''),
        proof_ref = nullif(trim(coalesce(_proof_ref, '')), ''),
        approved_at = case when _status = 'approved' then now() else null end,
        approved_by = auth.uid()
    where id = _id;

  if _status = 'approved' then
    if i.referrer_id is not null and i.commission_cents > 0 then
      insert into public.wallet_transactions (user_id, type, amount_cents, purchase_intent_id, description)
      values (i.referrer_id, 'commission_credit', i.commission_cents, i.id, 'Comissão ' || i.code)
      on conflict (purchase_intent_id) do nothing;
    elsif i.referrer_id is null and i.price_cents > 0 then
      insert into public.wallet_transactions (user_id, type, amount_cents, purchase_intent_id, description)
      values (s.direct_sales_admin_id, 'commission_credit', i.price_cents, i.id, 'Venda direta ' || i.code)
      on conflict (purchase_intent_id) do nothing;
    end if;
  end if;

  perform public.log_audit('intent_' || _status::text, 'purchase_intents', _id,
    jsonb_build_object('status', i.status),
    jsonb_build_object('status', _status, 'note', _note, 'proof_path', _proof_path, 'proof_ref', _proof_ref));
end; $function$;

-- ===== 20260922191318_7638e799-3162-416c-9504-3fceabe6275e.sql =====
alter table public.products add column if not exists category text not null default 'Geral';
create index if not exists products_category_idx on public.products (category);

-- ===== PASTAS DE ARQUIVOS (STORAGE) =====
insert into storage.buckets (id, name, public) values
  ('product-images','product-images', false),
  ('intent-proofs','intent-proofs', false),
  ('support-attachments','support-attachments', false)
on conflict (id) do nothing;
insert into public.app_settings (id) values (true) on conflict (id) do nothing;

-- Ajustes de permissoes da versao independente
-- Permitir edicao apenas dos campos do formulario de perfil.
revoke insert, update on public.profiles from public, anon, authenticated;
grant update (name, phone, pix_key, pix_key_type, updated_at) on public.profiles to authenticated;
-- A aprovacao exige usuario autenticado e verifica is_admin no corpo.
revoke all on function public.set_intent_status(uuid, public.intent_status, text, text, text, text) from public, anon;
grant execute on function public.set_intent_status(uuid, public.intent_status, text, text, text, text) to authenticated;
alter function public.commission_cents(bigint, public.commission_type, bigint) set search_path = public;
alter function public.support_new_protocol() volatile;

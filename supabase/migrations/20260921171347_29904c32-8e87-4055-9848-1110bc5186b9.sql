
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

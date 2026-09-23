
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

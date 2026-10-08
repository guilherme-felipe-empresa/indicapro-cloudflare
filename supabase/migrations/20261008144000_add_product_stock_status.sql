ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT true;

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
  if not p.in_stock then raise exception 'produto esgotado'; end if;
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

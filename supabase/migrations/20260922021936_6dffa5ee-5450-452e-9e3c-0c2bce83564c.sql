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
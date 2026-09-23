
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

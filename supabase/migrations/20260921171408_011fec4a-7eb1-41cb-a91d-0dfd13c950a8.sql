
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

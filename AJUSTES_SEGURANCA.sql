-- Permitir edicao apenas dos campos do formulario de perfil.
revoke insert, update on public.profiles from public, anon, authenticated;
grant update (name, phone, pix_key, pix_key_type, updated_at) on public.profiles to authenticated;
-- A aprovacao exige usuario autenticado e verifica is_admin no corpo.
revoke all on function public.set_intent_status(uuid, public.intent_status, text, text, text, text) from public, anon;
grant execute on function public.set_intent_status(uuid, public.intent_status, text, text, text, text) to authenticated;
alter function public.commission_cents(bigint, public.commission_type, bigint) set search_path = public;
alter function public.support_new_protocol() volatile;

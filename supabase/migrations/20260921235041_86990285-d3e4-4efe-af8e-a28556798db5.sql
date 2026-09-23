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
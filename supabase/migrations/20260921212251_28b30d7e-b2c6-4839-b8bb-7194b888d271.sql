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
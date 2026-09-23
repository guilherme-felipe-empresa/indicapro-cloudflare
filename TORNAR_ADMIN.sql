-- Rode DEPOIS de criar sua conta no app. Troque o e-mail abaixo.
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'SEU_EMAIL@exemplo.com'
on conflict do nothing;
update public.app_settings set direct_sales_admin_id =
  (select id from auth.users where email = 'SEU_EMAIL@exemplo.com') where id;

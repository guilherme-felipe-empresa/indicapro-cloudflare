
create policy "support_attach_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "support_attach_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'support-attachments'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

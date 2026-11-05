-- Monthly review PDFs (plan Day 24). Private bucket; path = <tenant_id>/<brand_id>/<yyyy-mm>-monthly.pdf.
-- Written by the service role; a signed-in user may read only files under their own tenant's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create policy reports_pdf_read on storage.objects for select to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] in (select private.user_tenant_ids()));

-- 3 Nov 2026: re-submitting the setup wizard deleted prompts, and ON DELETE CASCADE deleted every answer (and citation) to them.
-- History is the product: a prompt that has answers can no longer be deleted — retire it instead.
-- NO ACTION (checked at end of statement) still lets a whole brand be deleted, since its answers go in the same statement.
alter table public.answers drop constraint answers_prompt_id_tenant_id_fkey;
alter table public.answers add constraint answers_prompt_id_tenant_id_fkey
  foreign key (prompt_id, tenant_id) references public.prompts(id, tenant_id) on update cascade on delete no action;
comment on constraint answers_prompt_id_tenant_id_fkey on public.answers is 'Prompts with answers are retired, never deleted (3 Nov 2026 data-loss fix).';

-- RLS smoke test — ran green against project rmrauejublipukulnjou on 30 Oct 2026 (17/17 PASS).
-- Paste into Supabase SQL editor (or execute_sql). It always ends by raising an exception, so the
-- transaction rolls back and nothing (test users, tenants, brands) is kept. Read the result from the error text.
begin;
insert into auth.users (id, instance_id, aud, role, email) values
 ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid'),
 ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid');

do $$
declare ta text; tb text; ba uuid; n int; r text := '';
begin
  perform set_config('role', 'anon', true);
  select count(*) into n from public.prospects;  r := r || E'\n' || case when n = 0 then 'PASS' else 'FAIL' end || ' anon prospects visible=' || n;
  begin perform public.tv_bootstrap_tenant('x'); r := r || E'\nFAIL anon could bootstrap'; exception when others then r := r || E'\nPASS anon cannot bootstrap'; end;
  reset role;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  ta := public.tv_bootstrap_tenant('Alpha Coaching');
  r := r || E'\n' || case when public.tv_bootstrap_tenant('again') = ta then 'PASS' else 'FAIL' end || ' bootstrap idempotent';
  select count(*) into n from public.subscriptions where plan='trial' and trial_ends_at > now() + interval '13 days';
  r := r || E'\n' || case when n = 1 then 'PASS' else 'FAIL' end || ' trial subscription created (' || n || ')';
  select count(*) into n from public.prospects; r := r || E'\n' || case when n = 0 then 'PASS' else 'FAIL' end || ' new tenant sees TGL prospects=' || n;
  insert into public.brands (tenant_id, name, primary_domain, site_platform) values (ta, 'Alpha', 'alpha.example', 'wordpress') returning id into ba;
  begin insert into public.brands (tenant_id, name) values (ta, 'Second'); r := r || E'\nFAIL second brand allowed';
  exception when others then r := r || E'\nPASS second brand blocked: ' || sqlerrm; end;
  for i in 1..10 loop
    insert into public.prompts (tenant_id, brand_id, text, journey_phase) values (ta, ba, 'best coaching prompt number ' || i, 'consideration');
  end loop;
  begin insert into public.prompts (tenant_id, brand_id, text, journey_phase) values (ta, ba, 'eleventh prompt over limit', 'decision');
    r := r || E'\nFAIL 11th prompt allowed';
  exception when others then r := r || E'\nPASS 11th prompt blocked: ' || sqlerrm; end;
  begin insert into public.runs (tenant_id, brand_id, engine) values (ta, ba, 'chatgpt'); r := r || E'\nFAIL client wrote a run';
  exception when others then r := r || E'\nPASS client cannot write runs'; end;
  begin insert into public.tenants (id, name) values ('evil', 'x'); r := r || E'\nFAIL client created tenant';
  exception when others then r := r || E'\nPASS client cannot create tenants directly'; end;
  reset role;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  tb := public.tv_bootstrap_tenant('Beta Realty');
  select count(*) into n from public.brands;  r := r || E'\n' || case when n = 0 then 'PASS' else 'FAIL' end || ' B sees A brands=' || n;
  select count(*) into n from public.prompts; r := r || E'\n' || case when n = 0 then 'PASS' else 'FAIL' end || ' B sees A prompts=' || n;
  select count(*) into n from public.tenants; r := r || E'\n' || case when n = 1 then 'PASS' else 'FAIL' end || ' B sees tenants=' || n;
  select count(*) into n from public.subscriptions; r := r || E'\n' || case when n = 1 then 'PASS' else 'FAIL' end || ' B sees subscriptions=' || n;
  select count(*) into n from public.usage_costs; r := r || E'\n' || case when n = 0 then 'PASS' else 'FAIL' end || ' usage_costs hidden';
  begin insert into public.brands (tenant_id, name) values (ta, 'Hijack'); r := r || E'\nFAIL B inserted brand into A';
  exception when others then r := r || E'\nPASS B cannot insert into A'; end;
  begin insert into public.prompts (tenant_id, brand_id, text, journey_phase) values (tb, ba, 'cross tenant pointer', 'decision');
    r := r || E'\nFAIL B pointed a prompt at A brand';
  exception when others then r := r || E'\nPASS composite FK blocks cross-tenant prompt'; end;
  update public.brands set name = 'pwned' where id = ba; get diagnostics n = row_count;
  r := r || E'\n' || case when n = 0 then 'PASS' else 'FAIL' end || ' B updates A brand rows=' || n;
  reset role;
  raise exception 'RLS SMOKE RESULTS (rolled back):%', r;
end $$;

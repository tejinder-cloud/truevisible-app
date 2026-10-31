-- Make every composite (x_id, tenant_id) foreign key ON UPDATE CASCADE, so a brand can change tenant in one
-- statement (SPEC §9: a brand leaving an agency opens a direct account and keeps its data; also used to move
-- the Architect's first brand into tenant zero 'tgl'). Delete behaviour is unchanged.
do $$
declare r record; def text;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, pg_get_constraintdef(c.oid) as def
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
     where n.nspname = 'public' and c.contype = 'f' and array_length(c.conkey, 1) = 2
       and pg_get_constraintdef(c.oid) like '%tenant_id)%' and pg_get_constraintdef(c.oid) not like '%ON UPDATE%'
  loop
    def := r.def || ' ON UPDATE CASCADE';
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname, def);
  end loop;
end $$;

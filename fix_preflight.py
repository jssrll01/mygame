import re
p = "supabase/migrations/20261110000010_justice_intelligence.sql"
s = open(p).read()
start = s.index("  if to_regclass('public.investigations') is not null")
end = s.index("end $$;", start)
new = """  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='investigations')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='investigations' and column_name='case_number') then
    raise exception 'Preflight: an older public.investigations table with a different shape exists. Rename or drop it, then re-run.';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='evidence')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='evidence' and column_name='lawfully_obtained') then
    raise exception 'Preflight: an older public.evidence table with a different shape exists. Rename or drop it, then re-run.';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='court_cases')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='court_cases' and column_name='case_number') then
    raise exception 'Preflight: an older public.court_cases table with a different shape exists. Rename or drop it, then re-run.';
  end if;
"""
s = s[:start] + new + s[end:]
open(p, "w").write(s)
print("patched")

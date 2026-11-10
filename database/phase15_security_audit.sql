-- Read-only. Run each block in the Supabase SQL editor.
-- 1. Tables WITHOUT row level security (should be empty)
select c.relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 2. Write policies open to everyone (should be empty)
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and cmd in ('INSERT','UPDATE','DELETE','ALL')
  and (qual = 'true' or with_check = 'true' or 'anon'::name = any(roles) or 'public'::name = any(roles));

-- 3. SECURITY DEFINER functions without a fixed search_path (should be empty)
select p.oid::regprocedure as function_missing_search_path
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));

-- 4. SECURITY DEFINER functions callable by anon (review each)
select p.oid::regprocedure as definer_function_callable_by_anon
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');

-- 5. Float columns that look like money (must be numeric)
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and data_type in ('double precision','real')
  and column_name ~* '(balance|amount|price|cost|salary|fee|value|treasury|reserve|supply|wage|budget)';

-- 6. Unbounded numeric money columns (should have precision)
select table_name, column_name
from information_schema.columns
where table_schema = 'public' and data_type = 'numeric' and numeric_precision is null
  and column_name ~* '(balance|amount|price|cost|salary|fee|value|treasury|reserve|supply|wage|budget)';

-- 7. Direct write grants to anon (RLS is the only guard; revoke them)
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
  and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
-- Fix: revoke insert, update, delete, truncate on all tables in schema public from anon;

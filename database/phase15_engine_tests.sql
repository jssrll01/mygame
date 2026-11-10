-- Rolls back at the end. Final SELECT shows PASS/FAIL per test.
begin;
create temp table test_results (name text, passed boolean);

do $$
declare a text; b text; neg integer; res jsonb := '[]'::jsonb; ok boolean;
begin
  -- T1 idempotency: second run in same bucket must be skipped
  a := public.engine_run_job('market_prices', false);
  b := public.engine_run_job('market_prices', false);
  res := res || jsonb_build_object('n','idempotent job run','p', b = 'skipped');

  -- T2 prices stay positive and within bounds
  select count(*) into neg from public.engine_price_state where price <= 0 or price < anchor_price*0.2 or price > anchor_price*5;
  res := res || jsonb_build_object('n','prices within bounds','p', neg = 0);

  -- T3 manual run works and records history
  a := public.engine_run_job('market_prices', true);
  res := res || jsonb_build_object('n','manual run ok','p', a = 'ok');

  -- Switch to a normal logged-in non-admin user
  perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-000000000001','role','authenticated')::text, true);
  execute 'set local role authenticated';

  ok := false; begin insert into public.engine_price_state(symbol,asset_class,price,anchor_price) values ('HACK','commodity',1,1); exception when others then ok := true; end;
  res := res || jsonb_build_object('n','player cannot insert prices','p', ok);

  ok := false; begin update public.engine_price_state set price = 999999; exception when others then ok := true; end;
  res := res || jsonb_build_object('n','player cannot update prices','p', ok);

  ok := false; begin delete from public.engine_world_events; exception when others then ok := true; end;
  res := res || jsonb_build_object('n','player cannot delete events','p', ok);

  ok := false; begin perform public.engine_run_job('market_prices', true); exception when others then ok := true; end;
  res := res || jsonb_build_object('n','player cannot call runner','p', ok);

  ok := false; begin perform public.engine_admin_run('market_prices'); exception when others then ok := true; end;
  res := res || jsonb_build_object('n','non-admin cannot admin-run','p', ok);

  ok := (select count(*) from public.engine_jobs) = 0;
  res := res || jsonb_build_object('n','non-admin sees no job table','p', ok);

  ok := (select count(*) from public.engine_price_state) > 0;
  res := res || jsonb_build_object('n','player can read prices','p', ok);

  execute 'reset role';
  insert into test_results select e->>'n', (e->>'p')::boolean from jsonb_array_elements(res) e;
end $$;

select name, case when passed then 'PASS' else 'FAIL' end as result from test_results;
rollback;

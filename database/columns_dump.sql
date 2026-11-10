select table_name, string_agg(column_name||':'||data_type, ', ' order by ordinal_position) as cols
from information_schema.columns
where table_schema='public'
  and table_name in ('wallets','bank_accounts','transactions','businesses','employees','research_projects','countries','notifications','audit_logs','world_events')
group by table_name order by table_name;

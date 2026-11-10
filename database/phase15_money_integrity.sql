-- 1. Negative balances
select 'wallet' as src, id::text, balance from public.wallets where balance < 0
union all select 'bank_account', id::text, balance from public.bank_accounts where balance < 0
union all select 'business', id::text, treasury from public.businesses where treasury < 0
union all select 'country', id::text, treasury from public.countries where treasury < 0;

-- 2. Bank balance vs last ledger entry
select b.id, b.balance as account_balance, t.balance_after as ledger_balance
from public.bank_accounts b
join lateral (select balance_after from public.transactions where account_id = b.id order by id desc limit 1) t on true
where t.balance_after <> b.balance;

-- 3. Business treasury vs last business_ledger entry
select b.id, b.treasury, t.balance_after
from public.businesses b
join lateral (select balance_after from public.business_ledger where business_id = b.id order by id desc limit 1) t on true
where t.balance_after <> b.treasury;

-- 4. Country treasury vs last treasury_ledger entry
select c.id, c.treasury, t.balance_after
from public.countries c
join lateral (select balance_after from public.treasury_ledger where country_id = c.id order by id desc limit 1) t on true
where t.balance_after <> c.treasury;

-- 5. Duplicate idempotency keys
select 'transactions' as src, idempotency_key, count(*) from public.transactions
where idempotency_key is not null group by idempotency_key having count(*) > 1
union all
select 'business_ledger', idempotency_key, count(*) from public.business_ledger
where idempotency_key is not null group by idempotency_key having count(*) > 1;

-- 6. Wallets or accounts in an unknown currency
select 'wallet' as src, w.id::text, w.currency_code from public.wallets w
left join public.currencies c on c.code = w.currency_code where c.code is null
union all
select 'bank_account', a.id::text, a.currency_code from public.bank_accounts a
left join public.currencies c on c.code = a.currency_code where c.code is null;

-- 7. INFO ONLY: where money enters or leaves the ledger
select kind, direction, count(*), sum(amount) from public.transactions group by 1, 2 order by 1, 2;

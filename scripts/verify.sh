#!/bin/sh
fail=0
echo "== 1. service-role key must never appear in client code"
if grep -rniE "service_role|SERVICE_ROLE|SUPABASE_SERVICE" src index.html public 2>/dev/null; then echo "FAIL"; fail=1; else echo "PASS"; fi
echo "== 2. .env must be git-ignored"
if [ -f .gitignore ] && grep -qE "^\.env" .gitignore; then echo "PASS"; else echo "FAIL: add .env to .gitignore"; fail=1; fi
echo "== 3. client references to money tables (review: reads OK, writes NOT OK)"
grep -rnE "from\(['\"](wallets|bank_accounts|transactions|ledger|market_orders|market_trades|assets|gemstones|precious_metals)['\"]\)\s*(\.|$)" src
grep -rnE "\.(insert|update|upsert|delete)\(" src | grep -iE "wallet|bank|transaction|ledger|market_|asset|gem|metal" && echo "REVIEW above: client must not write money tables" || echo "PASS: no obvious client-side money writes"
echo "== 4. dependencies"
npm ls --depth=0 2>&1 | tail -20
echo "== 5. production build"
if npm run build; then echo "PASS"; else echo "FAIL"; fail=1; fi
echo "== 6. built bundle must not contain service key"
if [ -d dist ] && grep -rlE "service_role" dist; then echo "FAIL"; fail=1; else echo "PASS"; fi
[ $fail -eq 0 ] && echo "ALL AUTOMATED CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $fail

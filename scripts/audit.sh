#!/bin/sh
echo "== package.json deps"; grep -A30 '"dependencies"' package.json
echo "== migrations"; ls supabase/migrations 2>/dev/null
echo "== edge functions"; ls supabase/functions 2>/dev/null
echo "== tables used by client"; grep -rhoE "from\(['\"][a-z_]+['\"]\)" src | sort -u
echo "== RPCs used by client"; grep -rhoE "rpc\(['\"][a-z_]+['\"]" src | sort -u
echo "== env present?"; ls -a | grep -E "^\.env" ; grep -c SUPABASE .env 2>/dev/null

#!/bin/bash
# usage: t.sh "name" uid "sql" expect(ok|err:substr)
export PGPASSWORD=postgres
name="$1"; uid="$2"; sql="$3"; exp="$4"
if [ "$uid" != "-" ]; then urole=$(psql -h 127.0.0.1 -p 55432 -U postgres -d postgres -tAc "select role from profiles where id='$uid'"); fi
if [ "$uid" = "-" ]; then pre=""; else pre="set local role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$uid\",\"role\":\"authenticated\",\"app_metadata\":{\"role\":\"$urole\"}}', true);  select set_config('request.jwt.claim.sub', '$uid', true);"; fi
out=$(psql -h 127.0.0.1 -p 55432 -U postgres -d postgres -tAq -v ON_ERROR_STOP=1 <<SQL 2>&1
begin;
$pre
$sql
commit;
SQL
)
rc=$?
if [ "$exp" = ok ]; then [ $rc -eq 0 ] && echo "PASS  $name" || echo "FAIL  $name :: $(echo "$out"|grep -m1 ERROR)";
else s=${exp#err:}; if [ $rc -ne 0 ] && echo "$out" | grep -q "$s"; then echo "PASS  $name (отказ: $s)"; else echo "FAIL  $name :: rc=$rc $(echo "$out"|grep -v WARNING|tail -2)"; fi; fi
[ -n "$SHOW" ] && echo "$out" | grep -v "WARNING\|^$\|set_config\|^SET" | sed 's/^/      /'

#!/bin/bash
# usage: as.sh <uuid> "<sql>"  — выполняет SQL как authenticated с auth.uid()=uuid, в транзакции (rollback, если 3-й аргумент не commit)
export PGPASSWORD=postgres
END=${3:-rollback}
psql -h 127.0.0.1 -p 55432 -d postgres -U postgres -q -At -v ON_ERROR_STOP=1 <<SQL
begin;
select set_config('request.jwt.claims', '{"sub":"$1","role":"authenticated"}', true), set_config('request.jwt.claim.sub', '$1', true), set_config('request.jwt.claim.role', 'authenticated', true) \gset
set local role authenticated;
$2
$END;
SQL

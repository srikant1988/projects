-- Non-superuser application role. RLS is enforced only for non-superuser,
-- non-table-owner connections, so the app must never connect as `postgres`.
CREATE ROLE app_role LOGIN PASSWORD 'app_role';
GRANT CONNECT ON DATABASE mmm TO app_role;

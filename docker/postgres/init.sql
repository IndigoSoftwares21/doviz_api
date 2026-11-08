-- docker/postgres/init.sql
-- Runs once, on the first start of an empty volume. The `doviz_api` database
-- itself is created by POSTGRES_DB in docker-compose.yml — don't create it
-- here. Schema changes belong in migrations, not this file.
--
-- Any error here aborts the container's first start, so keep it minimal.
SELECT 1;

-- SOLO DESARROLLO LOCAL. NO ejecutar contra el proyecto real de Supabase.
--
-- El Supabase real ya provisiona sus propios roles `anon` / `authenticated` /
-- `service_role` / `authenticator` con sus grants correspondientes — este
-- script solo existe para recrear el mínimo necesario en un Postgres nativo
-- levantado a mano (sin Supabase CLI/Docker), de forma que PostgREST pueda
-- servir el esquema `bem` en local exactamente como lo haría Supabase en
-- producción una vez existan credenciales reales.
--
-- Convención que imita a Supabase: PostgREST se conecta como `authenticator`
-- (NOLOGIN normalmente, pero aquí con password para conexión directa) y hace
-- SET ROLE al rol indicado por el claim `role` del JWT recibido (anon /
-- service_role). `service_role` tiene BYPASSRLS, igual que en Supabase real,
-- porque eventService.ts siempre opera con esa clave (acceso de backend, no
-- de cliente anónimo).

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'eventgage_dev_local_only';
    END IF;
END
$$;

GRANT anon TO authenticator;
GRANT service_role TO authenticator;

-- anon sin acceso al esquema bem (mismo comportamiento restrictivo que
-- confirmamos en el proyecto real: "permission denied for schema bem").
-- service_role sí lo necesita: es lo único que usa supabaseServer.
GRANT USAGE ON SCHEMA bem TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA bem TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA bem TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA bem GRANT ALL ON TABLES TO service_role;

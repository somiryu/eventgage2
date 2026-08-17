-- Eventgage: retira las políticas "allow_all_*" que quedaron activas en
-- producción sobre bem.eventgage_* (creadas fuera del historial de
-- migraciones — no existían en el repo). Cada una era PERMISSIVE, roles
-- {public}, cmd ALL, USING true, WITH CHECK true: con RLS habilitado pero
-- esa política, el efecto práctico era el mismo que no tener RLS.
--
-- Todo el acceso real de la app pasa por supabaseServer (ver
-- src/lib/server/supabaseClient.ts), que en producción usa
-- SUPABASE_SERVICE_ROLE_KEY — un rol que ignora RLS por completo. Ningún
-- código de cliente/browser consulta el schema `bem` directamente. Al
-- quitar estas políticas sin reemplazo, `anon`/`authenticated` quedan sin
-- acceso (deny-by-default, que es lo que ya buscaba el comentario "RLS
-- estricto" de la migración inicial) y el servidor sigue funcionando igual.

DROP POLICY IF EXISTS allow_all_bem_user ON bem.eventgage_user;
DROP POLICY IF EXISTS allow_all_events ON bem.eventgage_events;
DROP POLICY IF EXISTS allow_all_factions ON bem.eventgage_event_factions;
DROP POLICY IF EXISTS allow_all_avatars ON bem.eventgage_event_avatars;
DROP POLICY IF EXISTS allow_all_event_avatar ON bem.eventgage_event_avatar;
DROP POLICY IF EXISTS allow_all_missions ON bem.eventgage_event_missions;
DROP POLICY IF EXISTS allow_all_codes ON bem.eventgage_event_codes;
DROP POLICY IF EXISTS allow_all_items ON bem.eventgage_event_items;
DROP POLICY IF EXISTS allow_all_maps ON bem.eventgage_event_maps;
DROP POLICY IF EXISTS allow_all_alerts ON bem.eventgage_event_alerts;
DROP POLICY IF EXISTS allow_all_characters ON bem.eventgage_event_characters;
DROP POLICY IF EXISTS allow_all_dialogues ON bem.eventgage_event_dialogues;
DROP POLICY IF EXISTS allow_all_points ON bem.eventgage_event_points;
DROP POLICY IF EXISTS allow_all_levels ON bem.eventgage_event_levels;

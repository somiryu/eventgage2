-- Feed de actividad persistente del evento (docs/system_capabilities_and_mechanics.md
-- sección 2.16). Hasta ahora el canal de Realtime Broadcast (broadcastEventActivity)
-- era puramente efímero — sin esta tabla, quien no estuviera conectado en el
-- instante exacto del evento se lo perdía para siempre. Misma llave `type` +
-- `payload` jsonb que ya usa el broadcast, para no duplicar la forma del dato.
CREATE TABLE IF NOT EXISTS bem.eventgage_event_activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventgage_event_activity_feed_event_id
    ON bem.eventgage_event_activity_feed(event_id, created_at DESC);

-- Mismo modelo deny-by-default que el resto de bem.* (ver
-- 20260817000100_lock_down_eventgage_rls.sql): todo el acceso real pasa por
-- supabaseServer con SUPABASE_SERVICE_ROLE_KEY, que ignora RLS.
ALTER TABLE bem.eventgage_event_activity_feed ENABLE ROW LEVEL SECURITY;

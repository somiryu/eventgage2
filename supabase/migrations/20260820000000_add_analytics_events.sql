-- Tabla de registro de analíticas y eventos de comportamiento de Eventgage
-- (docs/system_capabilities_and_mechanics.md - Sistema de Analíticas y Reportes)
CREATE TABLE IF NOT EXISTS bem.eventgage_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES bem.eventgage_user(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    category TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para agregaciones temporales de alta velocidad y filtrado por tipo/categoría
CREATE INDEX IF NOT EXISTS idx_eventgage_analytics_event_id_created_at
    ON bem.eventgage_analytics_events(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eventgage_analytics_event_name
    ON bem.eventgage_analytics_events(event_id, event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eventgage_analytics_category
    ON bem.eventgage_analytics_events(event_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eventgage_analytics_user_id
    ON bem.eventgage_analytics_events(event_id, user_id);

-- RLS con modelo deny-by-default (el backend accede mediante SUPABASE_SERVICE_ROLE_KEY)
ALTER TABLE bem.eventgage_analytics_events ENABLE ROW LEVEL SECURITY;

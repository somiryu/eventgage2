-- Eventgage Supabase Migration - Catálogo de Recompensas (Bóveda de Inteligencia)
--
-- Añade únicamente la tabla de CATÁLOGO de recompensas canjeables por Ludens (💠).
-- No incluye la lógica transaccional de compra (bloqueo de fila, validación de
-- puntos, prevención de duplicados, token PRIME-VIP) — eso corresponde a la
-- Fase 4.4 del plan de implementación (docs/plans/gamescon-implementacion.md),
-- que añadirá el endpoint `action: 'purchase'` sobre esta misma tabla.

CREATE TABLE IF NOT EXISTS bem.eventgage_event_rewards (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'game_aid', 'b2b_tool', 'vip_lead'
    cost INT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, event_id)
);

ALTER TABLE bem.eventgage_event_rewards ENABLE ROW LEVEL SECURITY;

-- Migración para añadir campos de catálogo extendido
-- 1. Soporte de variantes de género en avatares
ALTER TABLE bem.eventgage_event_avatars
ADD COLUMN IF NOT EXISTS image_url_m TEXT,
ADD COLUMN IF NOT EXISTS image_url_f TEXT;

-- 2. Soporte de nivel mínimo requerido para compra en la Bóveda de Inteligencia
CREATE TABLE IF NOT EXISTS bem.eventgage_event_rewards (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    cost INT NOT NULL,
    description TEXT,
    min_level INT DEFAULT 1,
    PRIMARY KEY (id, event_id)
);

ALTER TABLE bem.eventgage_event_rewards
ADD COLUMN IF NOT EXISTS min_level INT DEFAULT 1;

ALTER TABLE bem.eventgage_event_rewards ENABLE ROW LEVEL SECURITY;

-- Eventgage Supabase Migration - Nivel Mínimo en Recompensas (Bóveda de Inteligencia)
--
-- Añade la columna `min_level` a `bem.eventgage_event_rewards` para soportar
-- items de la Bóveda restringidos por nivel (ej. Pase de Consulta VIP para Nivel >= 4).

ALTER TABLE bem.eventgage_event_rewards ADD COLUMN IF NOT EXISTS min_level INT DEFAULT 1;

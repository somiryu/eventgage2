-- Migración para el fix del bug is_public: un ítem público debe arrancar
-- bloqueado para todos y desbloquearse globalmente recién cuando algún
-- jugador lo descubre por primera vez (código o misión), no de entrada.
ALTER TABLE bem.eventgage_events
ADD COLUMN IF NOT EXISTS global_unlocked_items TEXT[] DEFAULT '{}';

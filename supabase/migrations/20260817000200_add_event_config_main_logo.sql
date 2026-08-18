-- Config JSONB genérico por evento (HUD): primer uso es `main_logo`, la URL
-- del logo a mostrar sobre la Misión Destacada del HUD, o null si el evento
-- no tiene uno. Queda como columna JSONB (no una columna dedicada) para que
-- futuras banderas de HUD por evento no requieran una migración cada vez.
ALTER TABLE bem.eventgage_events
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

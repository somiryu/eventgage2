-- Eventgage Supabase Migration - Campos para Consola de Game Masters & Storage
--
-- Añade campos de categorización e identificación táctica a los códigos,
-- soporte para emisor de personajes en alertas, archivo adjunto en recompensas
-- y el bucket público de assets.

-- 1. Campos adicionales en bem.eventgage_event_codes
ALTER TABLE bem.eventgage_event_codes ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'recinto';
ALTER TABLE bem.eventgage_event_codes ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE bem.eventgage_event_codes ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Campos adicionales en bem.eventgage_event_alerts
ALTER TABLE bem.eventgage_event_alerts ADD COLUMN IF NOT EXISTS character_id TEXT;
ALTER TABLE bem.eventgage_event_alerts ADD COLUMN IF NOT EXISTS title TEXT;

-- 3. Campos adicionales en bem.eventgage_event_characters
ALTER TABLE bem.eventgage_event_characters ADD COLUMN IF NOT EXISTS role TEXT;

-- 4. Campo de archivo/recurso en bem.eventgage_event_rewards
ALTER TABLE bem.eventgage_event_rewards ADD COLUMN IF NOT EXISTS file_url TEXT;

-- 5. Bucket público de Storage para Eventgage (mapas, avatares, fotos, PDFs)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('eventgage-assets', 'eventgage-assets', true)
        ON CONFLICT (id) DO UPDATE SET public = true;
    END IF;
END $$;

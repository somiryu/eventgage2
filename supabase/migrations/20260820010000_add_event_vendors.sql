-- ==============================================================================
-- MIGRACIÓN: Tabla bem.eventgage_event_vendors (Directorio de Sponsors / Aliados)
-- FECHA: 2026-08-20
-- ==============================================================================

CREATE TABLE IF NOT EXISTS bem.eventgage_event_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tagline TEXT,
    description TEXT,
    contact_name TEXT,
    linkedin_url TEXT,
    phone TEXT,
    website_url TEXT,
    logo_url TEXT,
    tier TEXT DEFAULT 'partner', -- 'organizer', 'sponsor', 'partner'
    order_index INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_eventgage_event_vendors_event_name UNIQUE (event_id, name)
);

CREATE INDEX IF NOT EXISTS idx_eventgage_event_vendors_event_id 
    ON bem.eventgage_event_vendors (event_id);

CREATE INDEX IF NOT EXISTS idx_eventgage_event_vendors_order 
    ON bem.eventgage_event_vendors (event_id, order_index ASC);

-- RLS deny-by-default asegurado con proxy backend
ALTER TABLE bem.eventgage_event_vendors ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'bem' 
          AND tablename = 'eventgage_event_vendors' 
          AND policyname = 'Allow service_role full access on eventgage_event_vendors'
    ) THEN
        CREATE POLICY "Allow service_role full access on eventgage_event_vendors"
            ON bem.eventgage_event_vendors
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Seed inicial de los 4 vendors oficiales para Gamescon
DO $$
DECLARE
    gamescon_id UUID;
BEGIN
    SELECT id INTO gamescon_id FROM bem.eventgage_events WHERE slug = 'gamescon' LIMIT 1;
    
    IF gamescon_id IS NOT NULL THEN
        -- 1. Free to Play
        INSERT INTO bem.eventgage_event_vendors (
            event_id, name, tagline, description, contact_name, linkedin_url, logo_url, tier, order_index
        ) VALUES (
            gamescon_id,
            'Free to Play',
            'Especialistas en Gamificación para Aprendizaje',
            'Consultoría estratégica y diseño de experiencias lúdicas formativas de alto impacto.',
            'Javier Velásquez',
            'https://www.linkedin.com/in/javier-velasquez-game/',
            '/images/gamescon/banners/f2p.png',
            'organizer',
            1
        ) ON CONFLICT DO NOTHING;

        -- 2. Prime Business School
        INSERT INTO bem.eventgage_event_vendors (
            event_id, name, tagline, description, contact_name, linkedin_url, logo_url, tier, order_index
        ) VALUES (
            gamescon_id,
            'Prime Business School',
            'Escuela de negocios con programas de gamificación',
            'Formación ejecutiva y programas avanzados en metodologías de innovación y lúdica corporativa.',
            'Eduardo Guacaneme',
            'https://www.linkedin.com/in/ramon-guacaneme/',
            '/images/gamescon/banners/logoPrime.jpg',
            'partner',
            2
        ) ON CONFLICT DO NOTHING;

        -- 3. Play4Agilie
        INSERT INTO bem.eventgage_event_vendors (
            event_id, name, tagline, description, contact_name, linkedin_url, logo_url, tier, order_index
        ) VALUES (
            gamescon_id,
            'Play4Agilie',
            'Unimos Agilismo con juego en organizaciones',
            'Transformación cultural, marcos ágiles y dinámicas de gamificación para equipos de alto desempeño.',
            'Fabián Dulcé',
            'https://www.linkedin.com/in/fabiandulce/',
            '/images/gamescon/banners/play4agile.jpeg',
            'partner',
            3
        ) ON CONFLICT DO NOTHING;

        -- 4. WakeUpBrain
        INSERT INTO bem.eventgage_event_vendors (
            event_id, name, tagline, description, contact_name, linkedin_url, logo_url, tier, order_index
        ) VALUES (
            gamescon_id,
            'WakeUpBrain',
            'Unimos Innovación y Sostenibilidad con Lúdica',
            'Metodología y juegos de aceleración para la resolución creativa de problemas e innovación sostenible.',
            'Guillermo Solano',
            'https://www.linkedin.com/in/solanobrainer/',
            '/images/gamescon/banners/wakeupbrain.png',
            'partner',
            4
        ) ON CONFLICT DO NOTHING;
    END IF;
END $$;

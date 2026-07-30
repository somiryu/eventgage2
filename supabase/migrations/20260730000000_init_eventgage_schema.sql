-- Eventgage Supabase Migration - Schema `bem`

CREATE SCHEMA IF NOT EXISTS bem;

-- 1. Usuario Global (bem.eventgage_user)
CREATE TABLE IF NOT EXISTS bem.eventgage_user (
    id UUID PRIMARY KEY, -- Id coincidente con auth.users
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Eventos (bem.eventgage_events)
CREATE TABLE IF NOT EXISTS bem.eventgage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    current_chapter INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Facciones del Evento (bem.eventgage_event_factions)
CREATE TABLE IF NOT EXISTS bem.eventgage_event_factions (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    faction_points INT DEFAULT 0,
    icon_url TEXT,
    PRIMARY KEY (id, event_id)
);

-- 4. Catálogo de Avatares por Evento (bem.eventgage_event_avatars)
CREATE TABLE IF NOT EXISTS bem.eventgage_event_avatars (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    gender TEXT,
    image_url TEXT,
    default_sp JSONB DEFAULT '{}'::jsonb,
    default_cp JSONB DEFAULT '{}'::jsonb,
    default_dp JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (id, event_id)
);

-- 5. Jugador en Evento Particular (bem.eventgage_event_avatar)
CREATE TABLE IF NOT EXISTS bem.eventgage_event_avatar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES bem.eventgage_user(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    avatar JSONB DEFAULT '{}'::jsonb,
    game_status JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{"sound": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- 6. Misiones (bem.eventgage_event_missions)
CREATE TABLE IF NOT EXISTS bem.eventgage_event_missions (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    preview TEXT,
    description TEXT,
    image TEXT,
    background TEXT,
    mission_type TEXT NOT NULL, -- 'code', 'time_bomb', 'collective_vote', 'dice_check', 'puzzle_pieces'
    unlocks_mission TEXT,
    public BOOLEAN DEFAULT true,
    chapter INT,
    time_limit_seconds INT,
    cp_cost INT,
    cp_bet INT,
    mechanic JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, event_id)
);

-- 7. Códigos Secretos (bem.eventgage_event_codes)
CREATE TABLE IF NOT EXISTS bem.eventgage_event_codes (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    unlocks_item TEXT,
    unlocks_mission TEXT,
    rewards JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (id, event_id)
);

-- 8. Items Coleccionables (bem.eventgage_event_items)
CREATE TABLE IF NOT EXISTS bem.eventgage_event_items (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    media_type TEXT, -- 'image', 'audio', 'video'
    media_url TEXT,
    is_public BOOLEAN DEFAULT false,
    PRIMARY KEY (id, event_id)
);

-- 9. Mapas e Hotspots (bem.eventgage_event_maps)
CREATE TABLE IF NOT EXISTS bem.eventgage_event_maps (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    hotspots JSONB DEFAULT '[]'::jsonb,
    PRIMARY KEY (id, event_id)
);

-- 10. Alertas del GM (bem.eventgage_event_alerts)
CREATE TABLE IF NOT EXISTS bem.eventgage_event_alerts (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    expiration_seconds INT DEFAULT 30,
    media_type TEXT,
    media_url TEXT,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, event_id)
);

-- 11. Personajes y Diálogos (bem.eventgage_event_characters & dialogues)
CREATE TABLE IF NOT EXISTS bem.eventgage_event_characters (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    portrait_url TEXT,
    PRIMARY KEY (id, event_id)
);

CREATE TABLE IF NOT EXISTS bem.eventgage_event_dialogues (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL,
    title TEXT,
    lines JSONB DEFAULT '[]'::jsonb,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, event_id)
);

-- 12. Puntos Mundiales del Evento (bem.eventgage_event_points)
CREATE TABLE IF NOT EXISTS bem.eventgage_event_points (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    point_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    current_points INT DEFAULT 0,
    max_points INT DEFAULT 500,
    rules JSONB DEFAULT '[]'::jsonb,
    PRIMARY KEY (id, event_id)
);

-- 13. Niveles y Rangos (bem.eventgage_event_levels)
CREATE TABLE IF NOT EXISTS bem.eventgage_event_levels (
    id TEXT NOT NULL,
    event_id UUID NOT NULL REFERENCES bem.eventgage_events(id) ON DELETE CASCADE,
    level INT NOT NULL,
    xp_required INT NOT NULL,
    title TEXT NOT NULL,
    unlocks JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (id, event_id)
);

-- Habilitar RLS estricto en todas las tablas
ALTER TABLE bem.eventgage_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_avatar ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_dialogues ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE bem.eventgage_event_levels ENABLE ROW LEVEL SECURITY;

-- Eventgage: índices de cobertura para las FK `event_id` de las tablas hijas
-- de `bem.eventgage_events`. Sin esto, cualquier lookup por evento (que es el
-- patrón de acceso dominante de eventService.ts) hace un seq scan sobre cada
-- tabla hija a medida que crecen los eventos con jugadores reales.

CREATE INDEX IF NOT EXISTS idx_eventgage_event_factions_event_id ON bem.eventgage_event_factions(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_avatars_event_id ON bem.eventgage_event_avatars(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_avatar_event_id ON bem.eventgage_event_avatar(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_missions_event_id ON bem.eventgage_event_missions(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_codes_event_id ON bem.eventgage_event_codes(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_items_event_id ON bem.eventgage_event_items(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_maps_event_id ON bem.eventgage_event_maps(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_alerts_event_id ON bem.eventgage_event_alerts(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_characters_event_id ON bem.eventgage_event_characters(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_dialogues_event_id ON bem.eventgage_event_dialogues(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_points_event_id ON bem.eventgage_event_points(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_levels_event_id ON bem.eventgage_event_levels(event_id);
CREATE INDEX IF NOT EXISTS idx_eventgage_event_rewards_event_id ON bem.eventgage_event_rewards(event_id);

-- Seed Script: Evento Demo "CyberCon 2026 Demo" (slug: "demo")

DO $$
DECLARE
    v_event_id UUID;
BEGIN
    -- 1. Insertar o recuperar el Evento Demo
    INSERT INTO bem.eventgage_events (slug, title, description, current_chapter)
    VALUES ('demo', 'CyberCon 2026 Demo', 'Evento interactivo de prueba para demostrar las mecánicas de Eventgage.', 1)
    ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
    RETURNING id INTO v_event_id;

    -- 2. Insertar Facciones
    INSERT INTO bem.eventgage_event_factions (id, event_id, name, description, faction_points, icon_url)
    VALUES
    ('faction_hackers', v_event_id, 'Colectivo Hacker', 'Especialistas en filtración de datos, descifrado y operaciones digitales.', 1250, 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=100&auto=format&fit=crop&q=80'),
    ('faction_resistencia', v_event_id, 'División Resistencia', 'Agentes de campo enfocados en exploración táctica y misiones físicas.', 980, 'https://images.unsplash.com/photo-1563089145-599997674d42?w=100&auto=format&fit=crop&q=80')
    ON CONFLICT (id, event_id) DO NOTHING;

    -- 3. Catálogo de Avatares
    INSERT INTO bem.eventgage_event_avatars (id, event_id, name, description, gender, image_url, default_sp, default_cp, default_dp)
    VALUES
    ('avatar_cipher_m', v_event_id, 'Cipher (Masculino)', 'Analista táctico con alta percepción de patrones.', 'male', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80', '{"hackeo": 12, "percepcion": 15, "sigilo": 8}'::jsonb, '{"points": 100, "icon": "⚡"}'::jsonb, '{"misiones_resueltas": 0}'::jsonb),
    ('avatar_cipher_f', v_event_id, 'Valkyrie (Femenino)', 'Especialista en infiltración cibernética y combate digital.', 'female', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80', '{"hackeo": 15, "percepcion": 10, "sigilo": 12}'::jsonb, '{"points": 100, "icon": "⚡"}'::jsonb, '{"misiones_resueltas": 0}'::jsonb)
    ON CONFLICT (id, event_id) DO NOTHING;

    -- 4. Puntos Mundiales del Evento (event_points)
    INSERT INTO bem.eventgage_event_points (id, event_id, point_key, display_name, current_points, max_points, rules)
    VALUES
    ('pt_opponent', v_event_id, 'opponent_points', 'Nivel de Amenaza IA', 140, 500, '[{"threshold": 300, "action": "trigger_alert", "message": "¡Alerta! La IA ha tomado control del sector 4."}]'::jsonb)
    ON CONFLICT (id, event_id) DO NOTHING;

    -- 5. Items Coleccionables
    INSERT INTO bem.eventgage_event_items (id, event_id, name, description, image_url, media_type, media_url, is_public)
    VALUES
    ('item_relic_alpha', v_event_id, 'Chip de Memoria Alpha', 'Objeto único descubierto por la comunidad en la Convención.', 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&auto=format&fit=crop&q=80', 'image', NULL, true),
    ('item_audio_log_1', v_event_id, 'Registro de Transmisión 01', 'Audio interceptado en las inmediaciones del Stand 7.', 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&auto=format&fit=crop&q=80', 'audio', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', false)
    ON CONFLICT (id, event_id) DO NOTHING;

    -- 6. Misiones Demo
    INSERT INTO bem.eventgage_event_missions (id, event_id, title, preview, description, image, background, mission_type, unlocks_mission, public, chapter, time_limit_seconds, cp_cost, cp_bet, mechanic)
    VALUES
    ('m_code_01', v_event_id, 'El Código de la Red', 'Descifra el código oculto en la pantalla de bienvenida.', 'Encuentra el código impreso en la señalización del evento para ganar tus primeros puntos de experiencia.', 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&auto=format&fit=crop&q=80', NULL, 'code', 'm_time_bomb_01', true, 1, NULL, 0, 0, '{"valid_codes": ["DEMO2026", "CYBER_DEMO"], "rewards": {"xp": 150, "cp": 50, "sp": {"hackeo": 2}, "items": ["item_audio_log_1"], "journal_entry": {"title": "Bitácora 01: El Inicio", "content_html": "<p>Has ingresado al sistema principal. Los datos muestran una interferencia inusual en el recinto.</p>"}}}'::jsonb),
    
    ('m_time_bomb_01', v_event_id, 'Desactivación Contrarreloj', '¡Alerta Time-Bomb! Desactiva el nodo antes de que caduque el tiempo.', 'La IA enemiga está sobrecargando el servidor local. Ingresa la clave de desactivación antes de que el reloj llegue a cero.', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80', NULL, 'time_bomb', 'm_vote_01', false, 1, 600, 10, 0, '{"target_code": "DISABLE_99", "on_expiration_penalty": {"increase_event_point": 50}, "success_rewards": {"xp": 250, "cp": 100, "add_faction_points": 150, "journal_entry": {"title": "Bitácora 02: Amenaza Neutralizada", "content_html": "<p>La bomba de datos fue contenida a tiempo. La facción ha ganado terreno táctico.</p>"}}}'::jsonb),
    
    ('m_vote_01', v_event_id, 'Votación Táctica: Capítulo II', 'Determina el siguiente movimiento de la facción en el evento.', 'Decide qué sector del reciento debe ser investigado prioritariamente por los agentes.', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&auto=format&fit=crop&q=80', NULL, 'collective_vote', NULL, true, 1, NULL, 0, 0, '{"question": "¿Qué sector debemos inspeccionar?", "options": [{"id": "sec_a", "text": "Zona A: Stand de Robótica"}, {"id": "sec_b", "text": "Zona B: Escenario Principal"}]}'::jsonb)
    ON CONFLICT (id, event_id) DO NOTHING;

    -- 7. Códigos Secretos
    INSERT INTO bem.eventgage_event_codes (id, event_id, code, unlocks_item, unlocks_mission, rewards)
    VALUES
    ('code_demo_2026', v_event_id, 'DEMO2026', 'item_audio_log_1', 'm_time_bomb_01', '{"xp": 150, "cp": 50}'::jsonb)
    ON CONFLICT (id, event_id) DO NOTHING;

    -- 8. Mapas e Hotspots
    INSERT INTO bem.eventgage_event_maps (id, event_id, name, image_url, hotspots)
    VALUES
    ('map_main_hall', v_event_id, 'Hall Principal CyberCon', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80', '[{"id": "hs_1", "x": 35.0, "y": 45.0, "title": "Terminal de Entrada", "description": "Punto de acceso principal. Busca el código impreso cerca del Stand 1.", "unlocks_mission": "m_code_01"}, {"id": "hs_2", "x": 70.0, "y": 65.0, "title": "Zona de Hackeo Físico", "description": "Nodo táctico para misiones contrarreloj.", "unlocks_mission": "m_time_bomb_01"}]'::jsonb)
    ON CONFLICT (id, event_id) DO NOTHING;

    -- 9. Alertas Demo
    INSERT INTO bem.eventgage_event_alerts (id, event_id, message, type, expiration_seconds, media_type, media_url, scheduled_at)
    VALUES
    ('alert_1', v_event_id, '¡Bienvenido a CyberCon 2026 Demo! Explora el mapa y desbloquea tus primeras misiones.', 'info', 45, NULL, NULL, NOW())
    ON CONFLICT (id, event_id) DO NOTHING;

    -- 10. Personajes y Diálogos
    INSERT INTO bem.eventgage_event_characters (id, event_id, name, portrait_url)
    VALUES
    ('char_gm', v_event_id, 'Game Master Zero', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')
    ON CONFLICT (id, event_id) DO NOTHING;

    INSERT INTO bem.eventgage_event_dialogues (id, event_id, character_id, title, lines, scheduled_at)
    VALUES
    ('dialogue_welcome', v_event_id, 'char_gm', 'Transmisión Inicial', '[{"speaker_name": "Game Master Zero", "text": "Atención agente. Has ingresado con éxito al sistema CyberCon. Comienza explorando la pestaña de Misiones o revisa el Mapa."}]'::jsonb, NOW())
    ON CONFLICT (id, event_id) DO NOTHING;

    -- 11. Niveles
    INSERT INTO bem.eventgage_event_levels (id, event_id, level, xp_required, title, unlocks)
    VALUES
    ('lvl_1', v_event_id, 1, 0, 'Recluta Digital', '{}'::jsonb),
    ('lvl_2', v_event_id, 2, 200, 'Agente de Campo', '{"items": ["item_relic_alpha"]}'::jsonb)
    ON CONFLICT (id, event_id) DO NOTHING;

END $$;

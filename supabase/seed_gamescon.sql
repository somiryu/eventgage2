-- Seed Script: Evento "Gamescon" (slug: "gamescon")
--
-- Transcripción fiel del contenido narrativo definido en docs/designs/gamescon.md.
-- Idempotente (ON CONFLICT DO NOTHING) — seguro de correr varias veces.
--
-- ALCANCE DE ESTE SEED: facciones, avatares, las 29+1 misiones, ítems
-- coleccionables y catálogo de recompensas de la Bóveda. NO incluye:
--   - Diálogos/narrativa de onboarding (4 actos) ni personajes (Dra. Huizinga,
--     Cipher): el frontend todavía no tiene la lógica condicional por
--     avatar/facción para renderizarlos (ver Fase 1.2 del plan). Sembrarlos
--     ahora dejaría filas huérfanas sin código que las use.
--   - bem.eventgage_event_points (Inercia Global) SÍ se siembra, pero con un
--     cambio de decisión respecto a la nota anterior de este archivo: el
--     diseño (sección 1.3.3) pide un valor inicial dinámico calculado como
--     Registrados × 3, con congelamiento al cierre del Día 1. Javier decidió
--     (2026-08-17) NO implementar esa fórmula en el motor de juego: contar
--     inscritos y congelar un valor en un momento específico del evento es
--     lógica demasiado específica de Gamescon para vivir en el motor
--     genérico de Eventgage (que sirve múltiples eventos con reglas propias
--     distintas). En su lugar, `current_points`/`max_points` quedan como lo
--     que ya son en el modelo de datos: un valor fijo configurable por
--     evento en el seed, igual que display_name — sin lógica dinámica
--     agregada al backend. Se siembra en 250/250 (ver INSERT más abajo); el
--     dato real de "Registrados × 3" para el día del evento, si Javier lo
--     quiere después, se vuelve a sembrar a mano actualizando esta fila, no
--     agregando una fórmula al motor.
--   - bem.eventgage_event_levels: el sistema de 7 Niveles de XP (sección 1.3.4)
--     se siembra con los umbrales de XP, títulos canónicos y desbloqueos correspondientes.
--
-- NOTA SOBRE CONTENIDO PENDIENTE: de las 29 misiones del pool, solo la
-- Misión 01 (m01_giocchi_calibration) tiene el texto modular completo
-- (general + 3 variantes de facción + 4 variantes de avatar) definido en el
-- diseño (sección 8). Las otras 29 solo tienen una línea de "Tema Central"
-- por misión (secciones 10.2/10.3) — ese copy completo en cascada por
-- facción/avatar sigue pendiente de redacción y se marca `pending_content:
-- true` en el JSONB `mechanic` en vez de inventarlo. No bloquea que la
-- misión sea RESOLUBLE: en modo ai_prompt_challenge (fallback, Fase 2) solo
-- se usa la `description` general, que sí existe para las 29.
--
-- Las 7 misiones `trivia_quiz` SÍ llevan pregunta + 3 opciones reales
-- (`draft_content: true`) para que la mecánica sea jugable de punta a
-- punta — son un borrador escrito para QA a partir del Tema Central real de
-- cada misión, pendiente de que Javier apruebe el copy final (sección 10.4).
--
-- NOTA SOBRE CONTEO: el diseño (sección 6, punto 4) dice "4 misiones
-- dependen de dice_check", pero las tablas de las secciones 10.2/10.3 (la
-- fuente de verdad transcrita aquí) listan 7 (2 en Recinto + 5 en Game
-- Master). Se transcribe fielmente lo que dicen las tablas, no el resumen.
--
-- Assets de imagen: el diseño (sección 9.1) define un estilo de arte para
-- generar los 15 ítems coleccionables, pero no hay imágenes reales
-- producidas todavía. Se deja image_url/media_url en NULL en vez de usar
-- fotos de stock que aparenten ser arte real del universo Gamescon — ese
-- fue exactamente el problema de "lore falso" que se corrigió en la Fase 0.

DO $$
DECLARE
    v_event_id UUID;
BEGIN
    -- 1. Evento con Configuración de Hitos y Narrativas
    INSERT INTO bem.eventgage_events (slug, title, description, current_chapter, config)
    VALUES (
        'gamescon',
        'Gamescon — Agencia Antropológica Huizinga',
        'Posicionar a Prime Business School y a Free to Play como los referentes y aliados estratégicos líderes en gamificación educativa, experiencial y corporativa ante decanos, directores de programa, vicerrectores y líderes ejecutivos asistentes a la convención internacional de EQUAA, mediante un metajuego asíncrono en pasillos y soporte digital complementario durante la plenaria.',
        1,
        '{
            "main_logo": "/images/gamescon/banners/logoPrime.jpg",
            "milestones": [
                {
                    "count": 3,
                    "xp": 100,
                    "cp": 1,
                    "spBonus": 2,
                    "rank": 2,
                    "rankTitle": "Agente de Campo",
                    "unlockItem": null,
                    "lore": "Acceso prioritario a la Bóveda de Inteligencia.",
                    "narrative": {
                        "title": "Informe Táctico: Primeros Movimientos de la Inercia",
                        "speaker_id": "char_huizinga",
                        "speaker_name": "Dra. Elena Huizinga",
                        "speaker_role": "Directora de la Agencia Antropológica Huizinga",
                        "portrait_url": "/images/gamescon/characters/char_huizinga.jpg",
                        "badge": "HITO 1 DESCLASIFICADO",
                        "pages": [
                            {
                                "tag": "MOVIMIENTO DEL ADVERSARIO",
                                "content_html": "<p>El Sindicato de la Inercia ha detectado la sincronización masiva de nuestras terminales en EQUAA y ha intentado etiquetar nuestras dinámicas como <em>«simples juegos recreativos sin rigor académico»</em>.</p>"
                            },
                            {
                                "tag": "LOGRO DE LA AGENCIA",
                                "content_html": "<p>Gracias a tus primeras 3 misiones, establecimos un perímetro seguro de datos y recuperamos los primeros registros de validación conductual. La terminal te asciende formalmente a <strong>Agente de Campo</strong>.</p>"
                            },
                            {
                                "tag": "TIP METODOLÓGICO · EDUCACIÓN SUPERIOR",
                                "content_html": "<div class=\"tip-box\">💡 <strong>Tip de Gamificación en Educación Superior:</strong> En programas universitarios y de posgrado, el engagement temprano depende de validar el rigor del proceso antes que premiar el resultado. Diseña las primeras 3 interacciones para que el estudiante experimente autonomía y competencia inmediata, eliminando la fricción de entrada sin infantilizar el contenido académico.</div>"
                            }
                        ],
                        "content_html": "<p><strong>Movimiento del Adversario:</strong> El Sindicato de la Inercia ha detectado la sincronización masiva de nuestras terminales en EQUAA y ha intentado etiquetar nuestras dinámicas como simples juegos sin rigor académico.</p><p><strong>Logro de la Agencia:</strong> Gracias a tus primeras 3 misiones, establecimos un perímetro seguro de datos y recuperamos los primeros registros de validación conductual. La terminal te asciende a <strong>Agente de Campo</strong>.</p><div class=\"tip-box\">💡 <strong>Tip de Gamificación en Educación Superior:</strong> En programas universitarios y de posgrado, el engagement temprano depende de validar el rigor del proceso antes que premiar el resultado. Diseña las primeras 3 interacciones para que el estudiante experimente autonomía y competencia inmediata, eliminando la fricción de entrada sin infantilizar el contenido académico.</div>"
                    }
                },
                {
                    "count": 6,
                    "xp": 120,
                    "cp": 2,
                    "spBonus": 2,
                    "rank": 3,
                    "rankTitle": "Especialista Táctico",
                    "unlockItem": "item_llave_boveda_prime",
                    "lore": "Obtuviste la Llave Criptográfica PRIME.",
                    "narrative": {
                        "title": "Informe Táctico: Infiltración en el Círculo Mágico",
                        "speaker_id": "char_marcus",
                        "speaker_name": "Comandante Marcus Vance",
                        "speaker_role": "Jefe de Operaciones Tácticas & Contramedidas",
                        "portrait_url": "/images/gamescon/characters/char_marcus.jpg",
                        "badge": "HITO 2 DESCLASIFICADO",
                        "pages": [
                            {
                                "tag": "MOVIMIENTO DEL ADVERSARIO",
                                "content_html": "<p>Los comités burocráticos del Sindicato han intentado imponer evaluaciones estandarizadas de satisfacción superficial para asfixiar la experimentación lúdica en las aulas y talleres.</p>"
                            },
                            {
                                "tag": "LOGRO DE LA AGENCIA",
                                "content_html": "<p>Con 6 misiones completadas, has desbloqueado la <em>Llave Criptográfica PRIME</em> y consolidado tu estatus como <strong>Especialista Táctico</strong>. Has demostrado que el diseño de reglas claras protege la seguridad psicológica de los equipos.</p>"
                            },
                            {
                                "tag": "TIP METODOLÓGICO · EDUCACIÓN SUPERIOR",
                                "content_html": "<div class=\"tip-box\">💡 <strong>Tip de Gamificación en Educación Superior:</strong> El «Círculo Mágico» en la academia no es una metáfora; es un contrato explícito donde el error deja de ser una penalización y se convierte en dato de aprendizaje (Fail Smart). Si un simulador o dinámica no permite fallar sin consecuencias punitivas sobre la calificación final, no hay juego real, solo un examen disfrazado.</div>"
                            }
                        ],
                        "content_html": "<p><strong>Movimiento del Adversario:</strong> Los comités burocráticos del Sindicato han intentado imponer evaluaciones estandarizadas de satisfacción superficial para asfixiar la experimentación lúdica en las aulas y talleres.</p><p><strong>Logro de la Agencia:</strong> Con 6 misiones completadas, has desbloqueado la <em>Llave Criptográfica PRIME</em> y consolidado tu estatus como <strong>Especialista Táctico</strong>. Has demostrado que el diseño de reglas claras protege la seguridad psicológica de los equipos.</p><div class=\"tip-box\">💡 <strong>Tip de Gamificación en Educación Superior:</strong> El \"Círculo Mágico\" en la academia no es una metáfora; es un contrato explícito donde el error deja de ser una penalización y se convierte en dato de aprendizaje (Fail Smart). Si un simulador o dinámica no permite fallar sin consecuencias punitivas sobre la calificación final, no hay juego real, solo un examen disfrazado.</div>"
                    }
                },
                {
                    "count": 9,
                    "xp": 140,
                    "cp": 2,
                    "spBonus": 2,
                    "rank": 4,
                    "rankTitle": "Estratega de Enlace",
                    "unlockItem": null,
                    "lore": "Se desclasifican las cláusulas del Tratado Huizinga.",
                    "narrative": {
                        "title": "Informe Táctico: Desarticulación de la Medalla Vacía",
                        "speaker_id": "char_siobhan",
                        "speaker_name": "Dra. Siobhan Reed",
                        "speaker_role": "Antropóloga Conductual Senior & Jefa de Modelado BEM",
                        "portrait_url": "/images/gamescon/characters/char_siobhan.jpg",
                        "badge": "HITO 3 DESCLASIFICADO",
                        "pages": [
                            {
                                "tag": "MOVIMIENTO DEL ADVERSARIO",
                                "content_html": "<p>Desesperado ante el avance de nuestras divisiones, el Sindicato intentó sobornar a los participantes con insignias decorativas y puntos superficiales sin feedback significativo.</p>"
                            },
                            {
                                "tag": "LOGRO DE LA AGENCIA",
                                "content_html": "<p>Tus 9 intervenciones han desclasificado las cláusulas del Tratado Huizinga, probando que los 7 Drivers BEM (Propósito, Dominio, Autonomía) superan por mucho al condicionamiento extrínseco. Has ascendido a <strong>Estratega de Enlace</strong>.</p>"
                            },
                            {
                                "tag": "TIP METODOLÓGICO · EDUCACIÓN SUPERIOR",
                                "content_html": "<div class=\"tip-box\">💡 <strong>Tip de Gamificación en Educación Superior:</strong> Las insignias y tablas de líderes (PBL) son solo cosmética si no responden a un loop de progreso intrínseco. En educación ejecutiva, la motivación más potente es la visibilidad del dominio profesional y la capacidad de transferir decisiones simuladas a problemas reales de negocio.</div>"
                            }
                        ],
                        "content_html": "<p><strong>Movimiento del Adversario:</strong> Desesperado ante el avance de nuestras divisiones, el Sindicato intentó sobornar a los participantes con insignias decorativas y puntos superficiales sin feedback significativo.</p><p><strong>Logro de la Agencia:</strong> Tus 9 intervenciones han desclasificado las cláusulas del Tratado Huizinga, probando que los 7 Drivers BEM (Propósito, Dominio, Autonomía) superan por mucho al condicionamiento extrínseco. Has ascendido a <strong>Estratega de Enlace</strong>.</p><div class=\"tip-box\">💡 <strong>Tip de Gamificación en Educación Superior:</strong> Las insignias y tablas de líderes (PBL) son solo cosmética si no responden a un loop de progreso intrínseco. En educación ejecutiva, la motivación más potente es la visibilidad del dominio profesional y la capacidad de transferir decisiones simuladas a problemas reales de negocio.</div>"
                    }
                },
                {
                    "count": 12,
                    "xp": 150,
                    "cp": 0,
                    "spBonus": 0,
                    "rank": 5,
                    "rankTitle": "Agente Master Huizinga",
                    "unlockItem": null,
                    "lore": "Consagración de honor al cierre del evento.",
                    "narrative": {
                        "title": "Informe Táctico Final: La Nueva Era del Aprendizaje Lúdico",
                        "speaker_id": "char_huizinga",
                        "speaker_name": "Dra. Elena Huizinga",
                        "speaker_role": "Directora de la Agencia Antropológica Huizinga",
                        "portrait_url": "/images/gamescon/characters/char_huizinga.jpg",
                        "badge": "HITO CUMBRE ALCANZADO",
                        "pages": [
                            {
                                "tag": "MOVIMIENTO DEL ADVERSARIO",
                                "content_html": "<p>La Inercia Corporativa ha sido quebrada en todos los frentes de EQUAA. Los rectores y decanos han presenciado cómo la ciencia del comportamiento y la gamificación estructurada transforman el compromiso institucional.</p>"
                            },
                            {
                                "tag": "LOGRO DE LA AGENCIA",
                                "content_html": "<p>Has alcanzado el rango máximo: <strong>Agente Master Huizinga</strong>. Tu expediente se incorpora a la memoria histórica de PRIME Business School y Free to Play como testimonio de excelencia táctica.</p>"
                            },
                            {
                                "tag": "TIP METODOLÓGICO · EDUCACIÓN SUPERIOR",
                                "content_html": "<div class=\"tip-box\">💡 <strong>Tip de Gamificación en Educación Superior:</strong> La verdadera gamificación no termina en el aula: rediseña la cultura institucional. Al alinear los incentivos docentes, los métodos de evaluación formativa y las narrativas de cohorte, las universidades crean comunidades de práctica autorreguladas y de alto rendimiento.</div>"
                            }
                        ],
                        "content_html": "<p><strong>Movimiento del Adversario:</strong> La Inercia Corporativa ha sido quebrada en todos los frentes de EQUAA. Los rectores y decanos han presenciado cómo la ciencia del comportamiento y la gamificación estructurada transforman el compromiso institucional.</p><p><strong>Logro de la Agencia:</strong> Has alcanzado el rango máximo: <strong>Agente Master Huizinga</strong>. Tu expediente se incorpora a la memoria histórica de PRIME Business School y Free to Play como testimonio de excelencia táctica.</p><div class=\"tip-box\">💡 <strong>Tip de Gamificación en Educación Superior:</strong> La verdadera gamificación no termina en el aula: rediseña la cultura institucional. Al alinear los incentivos docentes, los métodos de evaluación formativa y las narrativas de cohorte, las universidades crean comunidades de práctica autorreguladas y de alto rendimiento.</div>"
                    }
                }
            ]
        }'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        config = EXCLUDED.config
    RETURNING id INTO v_event_id;

    -- 2. Facciones Narrativas (sección 3)
    INSERT INTO bem.eventgage_event_factions (id, event_id, name, description, faction_points, icon_url)
    VALUES
    (
        'fac_aprendizaje_activo', v_event_id,
        'División de Aprendizaje Activo',
        'Foco: Aprendizaje Organizacional, Formación Ejecutiva y Retención de Conocimiento. "El conocimiento sin acción es burocracia. Nuestra misión es transformar cada programa en una conversación interactiva de alto impacto."',
        0, '/images/gamescon/factions/fac_aprendizaje_activo.jpg'
    ),
    (
        'fac_impacto_valor', v_event_id,
        'División de Impacto & Valor',
        'Foco: Posicionamiento, Branding y Lealtad B2B. "El engagement no se compra con puntos vacíos. Diseñamos experiencias memorables que generan lealtad y autoridad de marca."',
        0, '/images/gamescon/factions/fac_impacto_valor.jpg'
    ),
    (
        'fac_agilidad_autonomia', v_event_id,
        'División de Agilidad & Autonomía',
        'Foco: Transformación Organizacional, Agilidad y Desarrollo de Producto/Procesos. "La innovación no se aprueba por decreto. Le devolvemos el control a los equipos para prototipar, probar y transformar la organización desde adentro."',
        0, '/images/gamescon/factions/fac_agilidad_autonomia.jpg'
    )
    ON CONFLICT (id, event_id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        icon_url = EXCLUDED.icon_url;

    -- 3. Perfiles de Avatar / Clases de Agente (sección 4)
    -- Catálogo Canónico de Habilidades (Skill Points - SP):
    --   - ANA: "Análisis & Métricas" — Capacidad analítica para descifrar datos conductuales, auditar sesgos y optimizar mecánicas objetivas.
    --   - DIS: "Diseño & Creatividad" — Habilidad para concebir narrativas inmersivas, experiencias sensoriales y prototipos lúdicos memorables.
    --   - EST: "Estrategia & Negocio" — Visión estratégica para alinear mecánicas lúdicas con el ROI, la gobernanza institucional y los objetivos de negocio.
    --   - FAC: "Facilitación & Conexión Humana" — Liderazgo empático para gestionar la dinámica grupal, fomentar seguridad psicológica y activar el cambio cultural.
    -- default_cp.points = 0: el diseño no define un saldo inicial de Ludens
    -- distinto de 0; toda misión resuelta otorga exactamente 1💠 (sección 1.3.2).
    INSERT INTO bem.eventgage_event_avatars (id, event_id, name, description, gender, image_url, image_url_m, image_url_f, default_sp, default_cp, default_dp)
    VALUES
    (
        'avatar_disenador_conductual', v_event_id,
        'El Diseñador Conductual (Behavioral Designer)',
        'Orientado a la ciencia del comportamiento, análisis de datos y medición de engagement.',
        NULL, '/images/gamescon/avatars/avatar_disenador_m.jpg',
        '/images/gamescon/avatars/avatar_disenador_m.jpg',
        '/images/gamescon/avatars/avatar_disenador_f.jpg',
        '{"ANA": 18, "EST": 14, "DIS": 10, "FAC": 9}'::jsonb,
        '{"points": 0, "icon": "💠"}'::jsonb,
        '{"misiones_resueltas": 0}'::jsonb
    ),
    (
        'avatar_arquitecto_experiencias', v_event_id,
        'El Arquitecto de Experiencias (Experience Architect)',
        'Enfocado en narrativa, creatividad lúdica y diseño de interfaces de aprendizaje.',
        NULL, '/images/gamescon/avatars/avatar_arquitecto_m.jpg',
        '/images/gamescon/avatars/avatar_arquitecto_m.jpg',
        '/images/gamescon/avatars/avatar_arquitecto_f.jpg',
        '{"DIS": 18, "ANA": 13, "EST": 11, "FAC": 9}'::jsonb,
        '{"points": 0, "icon": "💠"}'::jsonb,
        '{"misiones_resueltas": 0}'::jsonb
    ),
    (
        'avatar_facilitador_sistemico', v_event_id,
        'El Facilitador Sistémico (Systemic Facilitator)',
        'Centrado en gestión del cambio humano, dinamización de equipos y networking.',
        NULL, '/images/gamescon/avatars/avatar_facilitador_m.jpg',
        '/images/gamescon/avatars/avatar_facilitador_m.jpg',
        '/images/gamescon/avatars/avatar_facilitador_f.jpg',
        '{"FAC": 18, "EST": 14, "DIS": 11, "ANA": 8}'::jsonb,
        '{"points": 0, "icon": "💠"}'::jsonb,
        '{"misiones_resueltas": 0}'::jsonb
    ),
    (
        'avatar_director_estrategico', v_event_id,
        'El Director Estratégico (Strategic Director)',
        'Enfocado en ROI, alineación con objetivos del negocio/universidad y visión global.',
        NULL, '/images/gamescon/avatars/avatar_director_m.jpg',
        '/images/gamescon/avatars/avatar_director_m.jpg',
        '/images/gamescon/avatars/avatar_director_f.jpg',
        '{"EST": 18, "ANA": 15, "DIS": 10, "FAC": 8}'::jsonb,
        '{"points": 0, "icon": "💠"}'::jsonb,
        '{"misiones_resueltas": 0}'::jsonb
    )
    ON CONFLICT (id, event_id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        image_url_m = EXCLUDED.image_url_m,
        image_url_f = EXCLUDED.image_url_f,
        default_sp = EXCLUDED.default_sp;

    -- 4. Ítems Coleccionables (sección 9.2 — contenido completo, las 15 fichas)
    -- description compone Lección Teórica BEM + Tip Práctico (o Función en el
    -- Juego para la Llave PRIME). Libretos completos incluidos para los audios.
    INSERT INTO bem.eventgage_event_items (id, event_id, name, description, image_url, media_type, media_url, is_public)
    VALUES
    (
        'item_dado_poder', v_event_id,
        'El Dado de la Volatilidad (D20)',
        E'Driver BEM: Empowerment & Control.\n\nLección Teórica: El azar genera volatilidad si el jugador no tiene herramientas de mitigación. La aleatoriedad sin agencia humana destruye la maestría y conduce a la indefensión aprendida.\n\nTip práctico: Introduce dados o elementos aleatorios solo en el input (ej. asignar un caso imprevisto), nunca en el output (ej. calificar según la suerte). La maestría ocurre cuando el estudiante decide cómo reaccionar ante la incertidumbre.',
        '/images/gamescon/items/item_dado_poder.jpg', 'image', NULL, false
    ),
    (
        'item_audio_sindicato_01', v_event_id,
        'Filtro de Audio: La Reunión de los Formatos',
        E'Driver BEM: Mastery (Antagonista).\n\nLibreto completo:\n(Sonido de interferencia estática, murmullo de oficina y carraspeo burocrático)\nVoz Burócrata 1: "Bien, equipo. Para la capacitación semestral de 4 horas tenemos 140 diapositivas. Asegúrense de que nadie se retire antes de firmar la lista de asistencia."\nVoz Burócrata 2: "¿Y si agregamos una trivia al final con puntos para que sea interactivo?"\nVoz Burócrata 1: "No compliquemos el formato. Si leen las diapositivas y llenan el formulario de satisfacción, la meta de capacitación está cumplida para auditoría."\n(Sonido de pitido de corte de transmisión y estática)\n\nTip práctico: Asistencia no es aprendizaje. Sustituye la memorización pasiva por retos donde el participante deba aplicar el concepto para resolver un dilema en los primeros 15 minutos.',
        '/images/gamescon/items/item_audio_sindicato_01.jpg', 'audio', '/audio/gamescon/audio_sindicato_01.m4a', true
    ),
    (
        'item_medalla_plomo', v_event_id,
        'La Medalla de Plomo del Sindicato',
        E'Driver BEM: Hedonism (Antipatrón de Recompensa).\n\nLección Teórica: Una insignia pesada y vacía. Premiar tareas triviales sin esfuerzo cognitivo real activa el ''efecto de sobrejustificación'' y extingue la motivación intrínseca previa del usuario.\n\nTip práctico: Las insignias y puntos deben celebrar hitos de maestría o descubrimientos difíciles, nunca el simple cumplimiento de tareas higiénicas u obligatorias.',
        '/images/gamescon/items/item_medalla_plomo.jpg', 'image', NULL, false
    ),
    (
        'item_infografia_loop_gfr', v_event_id,
        'Esquema Táctico: La Tríada GFR',
        E'Driver BEM: Efficiency & Mastery.\n\nLección Teórica: Todo bucle de engagement efectivo requiere tres componentes indivisibles: una Meta (Goal) clara, una Fricción Cognitiva (Friction) calibrada al nivel del usuario y una Retroalimentación Inmediata (Feedback) no ambigua.\n\nTip práctico: Si tus estudiantes se desconectan de una actividad, audita la tríada: o la meta es difusa, o el reto es demasiado fácil/difícil, o el feedback tarda días en llegar.',
        '/images/gamescon/items/item_infografia_loop_gfr.jpg', 'image', NULL, false
    ),
    (
        'item_audio_huizinga_revelacion', v_event_id,
        'Registro Clasificado: Dra. Huizinga',
        E'Driver BEM: Epic Identity & Purpose.\n\nLibreto completo:\n(Tono de voz pausado, reflexivo, con eco sutil de biblioteca ejecutiva)\nDra. Valeria Huizinga: "Johan Huizinga lo advirtió en 1938: la cultura y el pensamiento complejo nacieron en el juego, no en el trabajo mecánico. Cuando una organización teme jugar, en realidad teme pensar. El ''Círculo Mágico'' no es un escape infantil de la realidad; es el único espacio seguro donde los líderes pueden equivocarse, aprender y reinventar su estrategia sin destruir la empresa en el intento."\n\nTip práctico: Crea "círculos mágicos" explícitos en tus clases o talleres: declara momentos donde el error tenga costo cero y donde la experimentación arriesgada sea la única forma de avanzar.',
        '/images/gamescon/items/item_audio_huizinga_revelacion.jpg', 'audio', '/audio/gamescon/audio_huizinga_revelacion.m4a', false
    ),
    (
        'item_infografia_fail_smart', v_event_id,
        'Manifiesto: Principios de Fail Smart',
        E'Driver BEM: Empowerment & Resilience.\n\nLección Teórica: En los juegos bien diseñados, a mayor dificultad del reto, menor debe ser la penalización. El fracaso no supervisado no enseña; el fracaso andamiado funciona como un checkpoint de maestría.\n\nTip práctico: Reemplaza exámenes punitivos terminales por entregables iterativos donde el estudiante pueda reintentar y refactorizar su trabajo tras recibir feedback inmediato.',
        '/images/gamescon/items/item_infografia_fail_smart.jpg', 'image', NULL, true
    ),
    (
        'item_cronometro_tension', v_event_id,
        'El Cronómetro de Fricción Calibrada',
        E'Driver BEM: Mastery & Flow.\n\nLección Teórica: El tiempo es el recurso más escaso. Un límite artificial bien calibrado induce Estado de Flujo (Flow); una presión temporal mal calibrada o excesiva detona pánico cognitivo y bloqueo.\n\nTip práctico: Utiliza timers cortos (3 a 5 minutos) para dinámicas de ideación o toma de postura en parejas. La escasez temporal rompe el perfeccionismo paralizante.',
        '/images/gamescon/items/item_cronometro_tension.jpg', 'image', NULL, false
    ),
    (
        'item_audio_inercia_02', v_event_id,
        'Interceptación: El Miedo a la Experimentación',
        E'Driver BEM: Discovery (Antagonista).\n\nLibreto completo:\n(Sonido de llamada telefónica encriptada)\nEjecutivo Inercial: "El equipo de innovación quiere implementar simulaciones lúdicas en los programas ejecutivos. Dicen que mejora la transferencia de conocimiento en un 60%."\nDirector Inercial: "¿Y si a los decanos les parece informal? Es demasiado riesgoso cambiar el programa tradicional. Mantengamos las clases magistrales de siempre; nadie nos puede despedir por usar diapositivas."\n\nTip práctico: Para vencer la resistencia de comités directivos, no hables de "juegos": presenta la gamificación como simulación conductual, medición de competencias y entorno de toma de decisiones bajo incertidumbre.',
        '/images/gamescon/items/item_audio_inercia_02.jpg', 'audio', '/audio/gamescon/audio_inercia_02.m4a', false
    ),
    (
        'item_infografia_5es', v_event_id,
        'Cartografía: Las 5 Dimensiones (5Es)',
        E'Driver BEM: Relatedness & Discovery.\n\nLección Teórica: Una experiencia formativa no inicia cuando el facilitador habla ni termina cuando se apaga el proyector. El diseño debe abarcar la Expectativa previa (Expectation), la Salida inicial (Excitement), la Interacción central (Engagement), el Cierre solemne (Exit) y la Retención post-evento (Extension).\n\nTip práctico: Envía un micro-desafío o enigma 48 horas antes de una clase importante. Romper la rutina antes de llegar al aula triplica el compromiso inicial.',
        '/images/gamescon/items/item_infografia_5es.jpg', 'image', NULL, true
    ),
    (
        'item_brujula_drivers', v_event_id,
        'La Brújula de los 7 Drivers Intrínsecos',
        E'Driver BEM: Discovery & Mastery.\n\nLección Teórica: Las personas no se motivan por una sola palanca. Un diseño robusto balancea motivación de Maestría, Relacionamiento, Eficiencia, Descubrimiento, Empoderamiento, Estética e Identidad Épica.\n\nTip práctico: Cuando diseñes un trabajo grupal, asigna roles que apelen a distintos drivers: un rol enfocado en análisis (Maestría), otro en mediación (Relacionamiento) y otro en visión estratégica (Empoderamiento).',
        '/images/gamescon/items/item_brujula_drivers.jpg', 'image', NULL, false
    ),
    (
        'item_audio_sindicato_03', v_event_id,
        'Filtro de Audio: La Trampa de los Puntos',
        E'Driver BEM: Efficiency (Antagonista).\n\nLibreto completo:\n(Sonido de tecleo acelerado)\nAgente Infiltrado: "Informe de campo: El Sindicato lanzó una plataforma donde los usuarios ganan 10 puntos por cada clic en su intranet. Los empleados crearon un script automatizado para ganar 50,000 puntos al día sin leer una sola línea. La gerencia celebra ''récords históricos de engagement'', pero nadie ha aprendido nada."\n\nTip práctico: Ley de Goodhart: cuando una métrica se convierte en el único objetivo de un incentivo, deja de ser una buena métrica. Nunca premies volumen de clics; premia resolución de problemas complejos.',
        '/images/gamescon/items/item_audio_sindicato_03.jpg', 'audio', '/audio/gamescon/audio_sindicato_03.m4a', false
    ),
    (
        'item_matriz_mcpft', v_event_id,
        'Decodificador de Actividades MCPFT',
        E'Driver BEM: Efficiency & Purpose.\n\nLección Teórica: Clasifica las actividades según la percepción del usuario. Demasiadas Tareas (Tasks) causan aversión; exceso de Farming genera fatiga. El objetivo del diseñador es transformar Tareas en Misiones (M) y Retos (C).\n\nTip práctico: Si tus estudiantes perciben una lectura como una "tarea obligatoria", dale formato de informe clasificado con una misión: "Encuentra en el texto las 3 fallas estratégicas que llevaron a la quiebra a esta empresa".',
        '/images/gamescon/items/item_matriz_mcpft.jpg', 'image', NULL, false
    ),
    (
        'item_llave_boveda_prime', v_event_id,
        'Llave Criptográfica PRIME',
        E'Driver BEM: Epic Identity (Clímax de Plenaria).\n\nLección Teórica: Representa la soberanía del conocimiento y el compromiso de los líderes educativos por transformar la pedagogía mediante rigor científico y diseño lúdico.\n\nFunción en el Juego: Ítem clave recolectado durante las misiones de pasillo que habilita el acceso prioritario al desbloqueo colectivo del Tratado Huizinga en la sesión plenaria de cierre.',
        '/images/gamescon/items/item_llave_boveda_prime.jpg', 'image', NULL, false
    ),
    (
        'item_infografia_antagonista', v_event_id,
        'Expediente: Los 3 Sabotajes de la Inercia',
        E'Driver BEM: Epic Identity & Relatedness.\n\nLección Teórica: El diseño de antagonistas abstractos (el Formulario Invisible, la Medalla Vacía y la Parálisis Creativa) une a las personas contra problemas comunes en lugar de generar rivalidades tóxicas interpersonales.\n\nTip práctico: En dinámicas de empresa, no pongas a competir al departamento de Ventas contra Marketing. Pon a ambos departamentos a cooperar para vencer un enemigo sistémico común (la pérdida de tiempo en reuniones inútiles).',
        '/images/gamescon/items/item_infografia_antagonista.jpg', 'image', NULL, true
    ),
    (
        'item_dossier_roi', v_event_id,
        'Expediente: La Calculadora de Impacto & ROI Lúdico',
        E'Driver BEM: Efficiency & Empowerment.\n\nLección Teórica: El retorno de inversión en proyectos lúdicos no se mide en clics de marketing ni en ''horas de diversión'', sino en tres meta-métricas auditables: Arousal (activación emocional), Persistencia (resiliencia ante el error) y Dirección (transferencia de conductas al puesto de trabajo).\n\nTip práctico: Al sustentar un proyecto de gamificación ante comités de finanzas o decanatos, presenta la matriz de meta-métricas BEM: demuestra cómo el aprendizaje activo reduce en un 40% el tiempo de onboarding y triplica la retención conceptual a 6 meses.',
        '/images/gamescon/items/item_dossier_roi.jpg', 'image', NULL, false
    )
    ON CONFLICT (id, event_id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        media_type = EXCLUDED.media_type,
        media_url = EXCLUDED.media_url,
        is_public = EXCLUDED.is_public;

    -- 5. Catálogo de Recompensas — Bóveda de Inteligencia (sección 9.3)
    -- Solo catálogo: la lógica transaccional de compra es Fase 4.4 (pendiente).
    INSERT INTO bem.eventgage_event_rewards (id, event_id, name, category, cost, description, min_level)
    VALUES
    ('rew_item_reintento', v_event_id, 'Ficha de Reintento Inmediato', 'game_aid', 2, 'Permite repetir un Chequeo de Habilidad (dice_check) fallido para intentar sumar el punto de Facción y reducir la Inercia.', 1),
    ('rew_pista_cipher', v_event_id, 'Radar de Cipher', 'game_aid', 2, 'Despliega en el HUD una pista dinámica con la ubicación aproximada de un código de recinto no decodificado.', 1),
    ('rew_boost_sp', v_event_id, 'Sobrecarga de Atributo', 'game_aid', 3, 'Otorga un bono temporal de +2 a cualquier tirada de atributo SP durante el siguiente reto.', 1),
    ('rew_bem_executive_deck', v_event_id, 'Kit Ejecutivo: Framework BEM en 1 Página', 'b2b_tool', 2, 'Resumen ejecutivo en PDF para justificar proyectos ante decanatos y juntas.', 1),
    ('rew_quiz_drivers_tool', v_event_id, 'Plantilla de Quiz de Diagnóstico de Drivers', 'b2b_tool', 2, 'Cuestionario editable de 12 preguntas para perfilar motivadores en alumnos.', 1),
    ('rew_canvas_gdd_template', v_event_id, 'Lienzo Canvas GDD de Co-creación', 'b2b_tool', 3, 'Plantilla de diseño de eventos gamificados (Coca-Cola / Prime).', 1),
    ('rew_rubrica_feedback_inmediato', v_event_id, 'Matriz de Diseño de Feedback Instruccional', 'b2b_tool', 3, 'Guía de retroalimentación inmediata para reducir carga cognitiva.', 1),
    ('rew_mcpft_diagnostic_tool', v_event_id, 'Herramienta de Diagnóstico: Matriz MCPFT', 'b2b_tool', 4, 'Auditoría para transformar Tareas en Misiones y Retos.', 1),
    ('rew_antipatrones_guia', v_event_id, 'Manual de Antipatrones en Gamificación', 'b2b_tool', 4, 'Casos documentados de fallas críticas (Disney, Uber, tablas tóxicas).', 1),
    ('rew_compendio_25_mecanicas', v_event_id, 'Compendio Táctico: 25 Mecánicas No Convencionales', 'b2b_tool', 5, 'Catálogo de mecánicas más allá de puntos y medallas.', 1),
    ('rew_fail_smart_rubric', v_event_id, 'Rúbrica Fail Smart', 'b2b_tool', 5, 'Diseño de experiencias donde el error es un checkpoint de maestría.', 1),
    ('rew_matriz_metricas_bem', v_event_id, 'Matriz de Meta-Métricas BEM', 'b2b_tool', 5, 'Medición de Arousal, Persistencia y Dirección más allá de clics de marketing.', 1),
    ('rew_prime_vip_consultancy', v_event_id, 'Pase de Consulta VIP con Expertos PRIME & F2P', 'vip_lead', 2, 'Enlace prioritario y token criptográfico para sesión 1-a-1 de consultoría post-evento.', 4)
    ON CONFLICT (id, event_id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        cost = EXCLUDED.cost,
        description = EXCLUDED.description,
        min_level = EXCLUDED.min_level;

    -- 6. Misión 01: Calibración Conceptual con GIOCCHI (sección 8 — texto modular COMPLETO)
    -- Las variantes por facción/avatar viajan en mechanic.faction_variants /
    -- mechanic.avatar_variants hasta que exista la columna dedicada (Fase 4.5);
    -- así el contenido queda capturado sin tener que redactarlo dos veces.
    -- ai_prompt_challenge no tiene integración real de IA todavía (Fase 5): el
    -- backend debe resolverla con la ruta de fallback (25 XP fijos + feedback
    -- pregenerado) descrita en la sección 6, punto 3 del diseño, hasta que se
    -- conecte GIOCCHI de verdad.
    INSERT INTO bem.eventgage_event_missions (id, event_id, title, preview, description, image, background, mission_type, unlocks_mission, public, chapter, time_limit_seconds, cp_cost, cp_bet, mechanic)
    VALUES
    (
        'm01_giocchi_calibration', v_event_id,
        'Calibración Conceptual con GIOCCHI',
        'GIOCCHI, nuestra IA táctica, evaluará tu perspectiva crítica sobre la gamificación.',
        'La gamificación está plagada de mitos falsos y malas prácticas en Internet promovidos por la inercia institucional. Para calibrar tus sensores, GIOCCHI (nuestra IA táctica basada en el framework BEM) evaluará tu perspectiva crítica sobre esta disciplina.',
        NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0,
        '{
            "driver": "BEM Core & Desmitificación",
            "faction_variants": {
                "fac_aprendizaje_activo": "Plantea una razón o mito común que hayas escuchado para descartar la gamificación en entornos de formación o capacitación.",
                "fac_impacto_valor": "Plantea una razón o mito común que hayas escuchado sobre por qué los programas de lealtad y puntos fallan al conectar con los usuarios.",
                "fac_agilidad_autonomia": "Plantea una objeción o mito común que suelan esgrimir las organizaciones para frenar la experimentación y el juego en sus procesos."
            },
            "avatar_variants": {
                "avatar_disenador_conductual": "Enfoca tu respuesta en cómo ese mito ignora los motivadores psicológicos reales o la medición objetiva del comportamiento.",
                "avatar_arquitecto_experiencias": "Enfoca tu respuesta en cómo ese mito degrada la narrativa, la inmersión o el diseño de la experiencia para el usuario.",
                "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo ese mito rompe la confianza humana, el clima de equipo o la adopción cultural.",
                "avatar_director_estrategico": "Enfoca tu respuesta en cómo ese mito distorsiona el retorno de inversión (ROI) o el impacto estratégico para la institución."
            },
            "ai_input_min_chars": 20,
            "ai_input_max_chars": 300,
            "fallback_feedback": "La inercia institucional ha propagado una versión adulterada del diseño lúdico: un barniz cosmético de puntos y medallas que no transforma conductas y extingue la motivación intrínseca. Reducir la disciplina a mecánicas superficiales es la razón principal por la que tantos programas formativos fracasan tras el entusiasmo inicial.\n\nLa arquitectura BEM opera a nivel estructural: el juego funciona como una tecnología de modelado conductual basada en metas claras, fricción cognitiva significativa y retroalimentación emocional. El compromiso auténtico no se impone mediante incentivos externos; emerge cuando el entorno valida la autonomía y andamia la maestría progresiva.\n\nEntrada de calibración inicial asegurada en tu Bitácora. Principio rector BEM: Antes de añadir cualquier mecánica, audita si estás resolviendo un dilema conductual real o simplemente decorando una obligación burocrática.",
            "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1},
            "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}
        }'::jsonb
    )
    ON CONFLICT (id, event_id) DO UPDATE SET mechanic = EXCLUDED.mechanic, title = EXCLUDED.title, preview = EXCLUDED.preview, description = EXCLUDED.description;

    -- 7. Código de inicialización LUDENS (sección 7.4): desbloquea Misión 01 + módulos del HUD
    INSERT INTO bem.eventgage_event_codes (id, event_id, code, unlocks_item, unlocks_mission, rewards, category, display_id, description)
    VALUES
    ('code_ludens_init', v_event_id, 'LUDENS', NULL, 'm01_giocchi_calibration', '{"xp": 100, "cp": 1}'::jsonb, 'inicial', 'INIT-01', 'Código maestro de inducción y activación del sistema Gamescon')
    ON CONFLICT (id, event_id) DO UPDATE SET
        code = EXCLUDED.code,
        unlocks_mission = EXCLUDED.unlocks_mission,
        rewards = EXCLUDED.rewards,
        category = EXCLUDED.category,
        display_id = EXCLUDED.display_id,
        description = EXCLUDED.description;

    -- 8. Pool de Misiones de Recinto (14 — sección 10.2)
    -- Cada código de recinto DESBLOQUEA la misión (no la completa); resolverla
    -- requiere la mecánica de su `mission_type` (dice_check/trivia_quiz/
    -- ai_prompt_challenge), aún pendiente de construir (Fase 2 del plan).
    INSERT INTO bem.eventgage_event_missions (id, event_id, title, preview, description, image, background, mission_type, unlocks_mission, public, chapter, time_limit_seconds, cp_cost, cp_bet, mechanic)
    VALUES
    ('rec_calibracion', v_event_id, 'Onboarding & Primera Victoria', 'Cómo estructurar el inicio de una experiencia para generar confianza.', 'Cómo estructurar el inicio de una experiencia para generar confianza.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Mastery & Progress", "fallback_feedback": "El error más frecuente al arrancar un programa formativo es abrumar al participante con normativas, manuales y marcos teóricos densos antes de permitirle ejecutar una sola acción con sentido. Esta sobrecarga inicial agota la memoria de trabajo y detona resistencia pasiva.\n\nEn las ciencias del comportamiento de BEM, la autoeficacia se consolida mediante una Primera Victoria Rápida (FTUE): un reto inicial accesible que permita al usuario experimentar competencia inmediata y active un bucle de retroalimentación claro. Esta conquista temprana disuelve la incertidumbre y crea el andamiaje psicológico necesario para asumir dilemas de alta complejidad.\n\nRegistro táctico indexado en tu Bitácora. Principio rector BEM: En los primeros cinco minutos de cualquier experiencia, prioriza la confirmación de autoeficacia sobre la transmisión masiva de información.", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "journal_reflection": true}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    ('rec_feedback_loop', v_event_id, 'Feedback Inmediato', 'Cómo la retroalimentación rápida acelera la maestría.', 'Cómo la retroalimentación rápida acelera la maestría.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Efficiency & Mastery", "fallback_feedback": "Cuando la evaluación de un desempeño se entrega días o semanas después de la acción, el cerebro ya ha consolidado el error o descartado el contexto emocional del reto. La retroalimentación tardía convierte el aprendizaje en un trámite administrativo estéril.\n\nEl modelo GFR de BEM (Goals, Feedback, Reward) demuestra que el aprendizaje dinámico exige un ciclo cerrado: Metas (Goals) que orientan la atención y generan tensión dopaminérgica, Retroalimentación (Feedback) inmediata que comunica el cambio de estado del sistema, y Respuesta Neurológica (Reward) interna que recalibra la autoeficacia. Si el feedback se demora, el bucle se rompe y la maestría se detiene.\n\nProtocolo de flujo archivado en tu Bitácora. Principio rector BEM: La efectividad de una señal de retroalimentación decrece exponencialmente con cada minuto de retraso entre la acción y el retorno.", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "items": ["item_infografia_loop_gfr"]}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    ('rec_fail_smart', v_event_id, 'Filosofía Fail Smart', 'El error como checkpoint y no como castigo terminal.', 'El error como checkpoint y no como castigo terminal.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Empowerment & Resilience", "fallback_feedback": "Penalizar el error mediante calificaciones terminales o señalamientos es la vía más rápida para inducir indefensión aprendida y aversión al riesgo en cualquier organización o aula. Quien teme equivocarse opta invariablemente por la pasividad y el cumplimiento mínimo.\n\nEl subframework Fail Smart de BEM traslada la responsabilidad del fallo del usuario hacia el diseño del sistema. Su regla fundamental establece que a mayor dificultad del reto, menor debe ser la penalización. En un entorno lúdico bien calibrado, perder no es una condena sino un checkpoint diagnóstico que entrega información precisa para refactorizar la estrategia e iterar de inmediato.\n\nManifiesto de resiliencia sellado en tu Bitácora. Principio rector BEM: El error no supervisado no enseña; el error andamiado con bajo costo de fallo es el motor fundamental de la innovación.", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "items": ["item_infografia_fail_smart"]}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    ('rec_task_shift', v_event_id, 'Espectro MCPFT', 'Transformar obligaciones en retos con propósito.', 'Transformar obligaciones en retos con propósito.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Efficiency & Purpose", "fallback_feedback": "Tratar todas las actividades como tareas obligatorias satura a los participantes de fricción negativa. Cuando una persona percibe que su jornada consiste únicamente en cumplir asignaciones impuestas, la calidad de su esfuerzo se degrada hacia el mínimo esfuerzo admisible.\n\nLa matriz MCPFT de BEM permite categorizar y desplazar las actividades a lo largo del gradiente de obligatoriedad: transformar Tareas (Tasks) rutinarias en Misiones (Missions) y Retos (Challenges) dotándolos de narrativa contextual, límites claros y un propósito visible. Al alterar el encuadre cognitivo y otorgar sentido a la acción, la fricción deja de vivirse como tedio y se experimenta como agencia.\n\nEsquema de transformación registrado en tu Bitácora. Principio rector BEM: No cambies necesariamente la tarea; cambia su encuadre estructural dotándola de autonomía, contexto y relevancia.", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "items": ["item_matriz_mcpft"]}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    ('rec_expectation', v_event_id, 'Las 5Es (Expectation)', 'Construir intriga previa antes del inicio de una sesión.', 'Construir intriga previa antes del inicio de una sesión.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Relatedness & Discovery", "fallback_feedback": "Asumir que una experiencia formativa inicia cuando el orador saluda o se proyecta la primera diapositiva es un error crítico de diseño. Llegar en frío a un espacio de capacitación obliga al participante a cruzar una barrera alta de inercia y escepticismo.\n\nLa metodología de las 5Es de BEM sitúa la fase de Expectativa (Expectation) hasta 48 horas antes del evento. Mediante enigmas previos, artefactos clasificados o micro-dilemas, se activa la anticipación dopaminérgica y se quiebra la rutina cotidiana. Un participante que ingresa a la sala buscando responder una intriga previa ya tiene activado su foco de atención.\n\nEstrategia de enganche previo desclasificada en tu Bitácora. Principio rector BEM: El viaje formativo comienza en el instante en que se altera la anticipación mental del usuario, nunca al iniciar la sesión formal.", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "items": ["item_infografia_5es"]}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    ('rec_agency_sp', v_event_id, 'Azar vs Agencia', 'Justificar por qué el juego estructurado no genera descontrol.', 'Justificar por qué el juego estructurado no genera descontrol.', NULL, NULL, 'dice_check', NULL, false, 1, NULL, 0, 0, '{"attribute": "EST", "rewards": {"xp": 50, "cp": 1, "items": ["item_dado_poder"]}, "faction_impact": {"success": 1, "fail": 0}}'::jsonb),
    ('rec_overjust', v_event_id, 'Sobrejustificación', 'Cuándo premiar con incentivos extrínsecos destruye la pasión.', 'Cuándo premiar con incentivos extrínsecos destruye la pasión.', NULL, NULL, 'trivia_quiz', NULL, false, 1, NULL, 0, 0, '{"draft_content": true, "note": "Borrador de QA para probar el mecanismo — pendiente de aprobación final del copy (sección 10.4).", "question": "Un equipo docente motivado voluntariamente por mejorar sus clases empieza a recibir un bono en efectivo por cada actividad gamificada que implementa. Según el efecto de sobrejustificación, ¿qué es lo más probable que ocurra a mediano plazo?", "options": [{"id": "a", "text": "Su motivación intrínseca original disminuye: empiezan a percibir la actividad como un trabajo pagado, no como una pasión propia.", "correct": true}, {"id": "b", "text": "Su motivación se mantiene exactamente igual, porque el dinero y la pasión son independientes.", "correct": false}, {"id": "c", "text": "Su motivación aumenta indefinidamente mientras el bono siga existiendo, sin ningún riesgo a futuro.", "correct": false}], "rewards": {"xp": 50, "cp": 1, "items": ["item_medalla_plomo"]}}'::jsonb),
    ('rec_flow_state', v_event_id, 'Canal de Flujo', 'Calibrar reto vs habilidad para evitar aburrimiento o parálisis.', 'Calibrar reto vs habilidad para evitar aburrimiento o parálisis.', NULL, NULL, 'trivia_quiz', NULL, false, 1, NULL, 0, 0, '{"draft_content": true, "note": "Borrador de QA para probar el mecanismo — pendiente de aprobación final del copy (sección 10.4).", "question": "Un curso online mantiene el mismo nivel de dificultad en todos sus módulos, sin importar que el estudiante ya domine el tema. Según el modelo del Canal de Flujo, ¿qué estado emocional es más probable que produzca esto en un estudiante avanzado?", "options": [{"id": "a", "text": "Pánico, por exceso de reto frente a su habilidad.", "correct": false}, {"id": "b", "text": "Aburrimiento, porque su habilidad supera ampliamente el reto que se le exige.", "correct": true}, {"id": "c", "text": "Flow inmediato, porque la repetición siempre genera dominio.", "correct": false}], "rewards": {"xp": 50, "cp": 1, "items": ["item_cronometro_tension"]}}'::jsonb),
    ('rec_lean_story', v_event_id, 'Economía Narrativa', 'La historia como marco de toma de decisiones sin adornos vacíos.', 'La historia como marco de toma de decisiones sin adornos vacíos.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Epic Identity & Purpose", "fallback_feedback": "Sobrecargar una experiencia con relatos fantásticos o metáforas complejas desconectadas de las decisiones del usuario produce chocolate-covered broccoli: una capa cosmética que genera cinismo en audiencias ejecutivas y distrae de los objetivos de aprendizaje.\n\nEl principio de economía narrativa en BEM, inspirado en el Arma de Chéjov, exige que todo elemento de ficción cumpla una función estructural: debe justificar la fricción del desafío, visibilizar las consecuencias éticas o técnicas y delimitar la identidad del rol. La narrativa no es un adorno para entretener; es una lente de toma de decisiones.\n\nDirectriz de sobriedad archivada en tu Bitácora. Principio rector BEM: Si un elemento narrativo no altera la forma en que el participante evalúa sus opciones y toma decisiones, debe ser eliminado del diseño.", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "journal_reflection": true}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    ('rec_sugarcoat', v_event_id, 'Maquillaje Lúdico', 'Por qué una ruleta digital no salva una mala clase.', 'Por qué una ruleta digital no salva una mala clase.', NULL, NULL, 'trivia_quiz', NULL, false, 1, NULL, 0, 0, '{"draft_content": true, "note": "Borrador de QA para probar el mecanismo — pendiente de aprobación final del copy (sección 10.4).", "question": "Un facilitador añade una ruleta de premios al final de una clase magistral de 2 horas, sin ninguna otra interacción. ¿Por qué esto es un caso típico de \"maquillaje lúdico\" (chocolate-covered broccoli)?", "options": [{"id": "a", "text": "Porque decora la superficie con un elemento lúdico sin rediseñar la estructura pasiva de la experiencia central.", "correct": true}, {"id": "b", "text": "Porque las ruletas nunca deben usarse en ningún contexto educativo.", "correct": false}, {"id": "c", "text": "Porque genera más Ludens que XP, rompiendo el balance económico del sistema.", "correct": false}], "rewards": {"xp": 50, "cp": 1, "journal_reflection": true}}'::jsonb),
    ('rec_dark_pattern', v_event_id, 'Diseño Ético', 'Detectar la diferencia entre potenciar la autonomía y manipular con trampas analíticas.', 'Detectar la diferencia entre potenciar la autonomía y manipular con trampas analíticas.', NULL, NULL, 'dice_check', NULL, false, 1, NULL, 0, 0, '{"attribute": "ANA", "rewards": {"xp": 50, "cp": 1, "journal_reflection": true}, "faction_impact": {"success": 1, "fail": 0}}'::jsonb),
    ('rec_antagonistas', v_event_id, 'Antagonistas Sistémicos', 'Unir al grupo contra un obstáculo abstracto común.', 'Unir al grupo contra un obstáculo abstracto común.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Epic Identity & Relatedness", "fallback_feedback": "Enfrentar directamente a departamentos, colegas o estudiantes en competencias de suma cero suele generar silos de desconfianza, acaparamiento de información y sabotaje encubierto. La rivalidad interpersonal erosiona el tejido cultural.\n\nEl marco BEM canaliza la tensión competitiva hacia Antagonistas Sistémicos: la personificación de problemas abstractos comunes como la inercia burocrática, el retrabajo o la parálisis por análisis. Al combatir juntos a un enemigo común del ecosistema, los equipos se alinean en colaboración auténtica y sentido de interdependencia.\n\nTáctica de cohesión grupal guardada en tu Bitácora. Principio rector BEM: En entornos corporativos y educativos, nunca pongas a competir a los talentos entre sí; únelos contra las fallas del sistema.", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "items": ["item_infografia_antagonista"]}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    ('rec_feedback_cad', v_event_id, 'Cadencia Temporal', 'La degradación del aprendizaje cuando el feedback se posterga.', 'La degradación del aprendizaje cuando el feedback se posterga.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Efficiency & Mastery", "fallback_feedback": "La mente humana opera bajo descuento hiperbólico: la relevancia de una señal evaluativa decae de forma drástica a medida que aumenta la distancia temporal respecto al momento de la conducta. Postergar la devolución destruye la plasticidad del aprendizaje.\n\nLa ciencia del comportamiento en BEM demuestra que la retroalimentación inmediata permite reajustar los esquemas mentales mientras el problema sigue procesándose en la memoria de trabajo. Cuando la respuesta tarda días, el cerebro asume que el ciclo terminó y ya no integra la corrección a su modelo operativo.\n\nTelemetría de cadencia asegurada en tu Bitácora. Principio rector BEM: Un retorno simple y en tiempo real tiene un impacto pedagógico diez veces superior al informe más sofisticado entregado dos semanas después.", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "journal_reflection": true}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    ('rec_friccion_cog', v_event_id, 'Fricción Significativa', 'La buena fricción proviene del dilema, no de la mala interfaz.', 'La buena fricción proviene del dilema, no de la mala interfaz.', NULL, NULL, 'trivia_quiz', NULL, false, 1, NULL, 0, 0, '{"draft_content": true, "note": "Borrador de QA para probar el mecanismo — pendiente de aprobación final del copy (sección 10.4).", "question": "Un formulario de inscripción tarda 8 minutos en completarse por errores de diseño (campos duplicados, mensajes de error confusos). ¿Este tipo de fricción es deseable según el principio de Fricción Significativa?", "options": [{"id": "a", "text": "Sí, cualquier fricción entrena la paciencia del usuario y mejora su tolerancia.", "correct": false}, {"id": "b", "text": "No: la fricción significativa nace de un dilema cognitivo real (una decisión que importa), no de una mala interfaz que solo genera frustración.", "correct": true}, {"id": "c", "text": "Sí, porque más tiempo invertido siempre se traduce en mayor compromiso emocional.", "correct": false}], "rewards": {"xp": 50, "cp": 1, "journal_reflection": true}}'::jsonb)
    ON CONFLICT (id, event_id) DO UPDATE SET mechanic = EXCLUDED.mechanic, title = EXCLUDED.title, preview = EXCLUDED.preview, description = EXCLUDED.description;

    -- 9. Códigos físicos del Pool de Recinto (activan cada misión de arriba)
    INSERT INTO bem.eventgage_event_codes (id, event_id, code, unlocks_item, unlocks_mission, rewards, category, display_id, description)
    VALUES
    ('code_rec_calibracion', v_event_id, 'K7X2', NULL, 'rec_calibracion', '{}'::jsonb, 'recinto', 'REC-01', 'Onboarding & Primera Victoria'),
    ('code_rec_feedback_loop', v_event_id, 'M4QD', NULL, 'rec_feedback_loop', '{}'::jsonb, 'recinto', 'REC-02', 'Feedback Inmediato (Tríada GFR)'),
    ('code_rec_fail_smart', v_event_id, 'N8PL', NULL, 'rec_fail_smart', '{}'::jsonb, 'recinto', 'REC-03', 'Filosofía Fail Smart'),
    ('code_rec_task_shift', v_event_id, 'B3TF', NULL, 'rec_task_shift', '{}'::jsonb, 'recinto', 'REC-04', 'Espectro MCPFT (Task to Challenge)'),
    ('code_rec_expectation', v_event_id, 'V9CK', NULL, 'rec_expectation', '{}'::jsonb, 'recinto', 'REC-05', 'Las 5Es: Expectation'),
    ('code_rec_agency_sp', v_event_id, 'Z6HY', NULL, 'rec_agency_sp', '{}'::jsonb, 'recinto', 'REC-06', 'Azar vs Agencia'),
    ('code_rec_overjust', v_event_id, 'R2WM', NULL, 'rec_overjust', '{}'::jsonb, 'recinto', 'REC-07', 'Sobrejustificación Extrínseca'),
    ('code_rec_flow_state', v_event_id, 'W5LN', NULL, 'rec_flow_state', '{}'::jsonb, 'recinto', 'REC-08', 'Canal de Flujo (Reto vs Habilidad)'),
    ('code_rec_lean_story', v_event_id, 'T7VJ', NULL, 'rec_lean_story', '{}'::jsonb, 'recinto', 'REC-09', 'Economía Narrativa & Arma de Chéjov'),
    ('code_rec_sugarcoat', v_event_id, 'F1GS', NULL, 'rec_sugarcoat', '{}'::jsonb, 'recinto', 'REC-10', 'Maquillaje Lúdico (Chocolate Broccoli)'),
    ('code_rec_dark_pattern', v_event_id, 'X4KB', NULL, 'rec_dark_pattern', '{}'::jsonb, 'recinto', 'REC-11', 'Diseño Ético vs Dark Patterns'),
    ('code_rec_antagonistas', v_event_id, 'L9CP', NULL, 'rec_antagonistas', '{}'::jsonb, 'recinto', 'REC-12', 'Antagonistas Sistémicos'),
    ('code_rec_feedback_cad', v_event_id, 'D8MR', NULL, 'rec_feedback_cad', '{}'::jsonb, 'recinto', 'REC-13', 'Cadencia Temporal del Feedback'),
    ('code_rec_friccion_cog', v_event_id, 'J3NZ', NULL, 'rec_friccion_cog', '{}'::jsonb, 'recinto', 'REC-14', 'Fricción Cognitiva Significativa')
    ON CONFLICT (id, event_id) DO UPDATE SET
        code = EXCLUDED.code,
        unlocks_mission = EXCLUDED.unlocks_mission,
        category = EXCLUDED.category,
        display_id = EXCLUDED.display_id,
        description = EXCLUDED.description;

    -- 10. Pool de Misiones de Game Master (15 — sección 10.3, 5 GMs × 3)
    INSERT INTO bem.eventgage_event_missions (id, event_id, title, preview, description, image, background, mission_type, unlocks_mission, public, chapter, time_limit_seconds, cp_cost, cp_bet, mechanic)
    VALUES
    -- GM 1 (Fundamentos)
    ('gm_pbl_trap', v_event_id, 'La Trampa de los Puntos', 'Por qué puntos y tablas sin reto causan fatiga rápida.', 'Por qué puntos y tablas sin reto causan fatiga rápida.', NULL, NULL, 'trivia_quiz', NULL, false, 1, NULL, 0, 0, '{"draft_content": true, "note": "Borrador de QA para probar el mecanismo — pendiente de aprobación final del copy (sección 10.4).", "question": "Una intranet corporativa otorga puntos por cada clic, sin ningún reto de por medio, y los muestra en una tabla de posiciones pública. ¿Cuál es el riesgo más citado de este diseño a mediano plazo?", "options": [{"id": "a", "text": "Fatiga y desconexión rápida: sin reto real detrás de los puntos, el sistema pierde significado y los usuarios lo abandonan o lo explotan.", "correct": true}, {"id": "b", "text": "Ningún riesgo: los puntos y las tablas siempre sostienen el compromiso a largo plazo por sí solos.", "correct": false}, {"id": "c", "text": "El único riesgo es estético, nunca afecta la motivación real de los usuarios.", "correct": false}], "gm_group": "GM 1 (Fundamentos)", "rewards": {"xp": 50, "cp": 1, "journal_reflection": true}}'::jsonb),
    ('gm_timebomb_01', v_event_id, 'Alerta de Sabotaje', 'Contención de pasividad temporal en los primeros 15 minutos.', 'Contención de pasividad temporal en los primeros 15 minutos.', NULL, NULL, 'time_bomb', NULL, false, 1, 1800, 0, 0, '{"target_code": "G1TB", "gm_group": "GM 1 (Fundamentos)", "rewards": {"xp": 50, "cp": 1, "items": ["item_audio_sindicato_01"]}, "faction_impact": {"on_time": 1, "expired": 0}}'::jsonb),
    ('gm_goodhart', v_event_id, 'Ley de Goodhart', 'Trampas al convertir métricas de vanidad en incentivos.', 'Trampas al convertir métricas de vanidad en incentivos.', NULL, NULL, 'trivia_quiz', NULL, false, 1, NULL, 0, 0, '{"draft_content": true, "note": "Borrador de QA para probar el mecanismo — pendiente de aprobación final del copy (sección 10.4).", "question": "Una empresa premia al equipo de soporte que cierre más tickets por hora. Los agentes empiezan a cerrar tickets sin resolverlos realmente para subir su conteo. ¿Qué principio describe mejor esta situación?", "options": [{"id": "a", "text": "Ley de Goodhart: cuando una métrica se convierte en el objetivo del incentivo, deja de medir fielmente lo que se quería medir.", "correct": true}, {"id": "b", "text": "Efecto de Sobrejustificación: el bono destruyó una motivación intrínseca que nunca existió en primer lugar.", "correct": false}, {"id": "c", "text": "Canal de Flujo: los agentes alcanzaron un estado óptimo de reto-habilidad.", "correct": false}], "gm_group": "GM 1 (Fundamentos)", "rewards": {"xp": 50, "cp": 1, "items": ["item_audio_sindicato_03"]}}'::jsonb),
    -- GM 2 (Métricas)
    ('gm_sp_metrics', v_event_id, 'Auditoría de Métricas', 'Detectar inconsistencias entre clics superficiales y maestría.', 'Detectar inconsistencias entre clics superficiales y maestría.', NULL, NULL, 'dice_check', NULL, false, 1, NULL, 0, 0, '{"attribute": "ANA", "gm_group": "GM 2 (Métricas)", "rewards": {"xp": 50, "cp": 1, "journal_reflection": true}, "faction_impact": {"success": 1, "fail": 0}}'::jsonb),
    ('gm_diff_curve', v_event_id, 'Curva de Aprendizaje', 'Rediseño empático del andamiaje cuando una prueba frustra al grupo.', 'Rediseño empático del andamiaje cuando una prueba frustra al grupo.', NULL, NULL, 'dice_check', NULL, false, 1, NULL, 0, 0, '{"attribute": "FAC", "gm_group": "GM 2 (Métricas)", "rewards": {"xp": 50, "cp": 1, "journal_reflection": true}, "faction_impact": {"success": 1, "fail": 0}}'::jsonb),
    ('gm_hygiene_base', v_event_id, 'Factores Higiénicos', 'La usabilidad evita el dolor; el significado genera motivación.', 'La usabilidad evita el dolor; el significado genera motivación.', NULL, NULL, 'trivia_quiz', NULL, false, 1, NULL, 0, 0, '{"draft_content": true, "note": "Borrador de QA para probar el mecanismo — pendiente de aprobación final del copy (sección 10.4).", "question": "Una app de e-learning arregla todos sus bugs y mejora su velocidad de carga, pero los usuarios siguen sin sentirse motivados a usarla. Según la teoría de factores higiénicos, ¿por qué ocurre esto?", "options": [{"id": "a", "text": "Porque los factores higiénicos (usabilidad, velocidad) solo evitan la insatisfacción; no generan motivación positiva por sí mismos, eso requiere significado y reto.", "correct": true}, {"id": "b", "text": "Porque arreglar bugs siempre genera un aumento automático de la motivación intrínseca.", "correct": false}, {"id": "c", "text": "Porque la velocidad de carga es el principal driver motivacional según el framework BEM.", "correct": false}], "gm_group": "GM 2 (Métricas)", "rewards": {"xp": 50, "cp": 1, "journal_reflection": true}}'::jsonb),
    -- GM 3 (Creatividad)
    ('gm_sp_mechanic', v_event_id, 'Prototipado Lúdico', 'Diseñar una dinámica de cartas para reemplazar diapositivas.', 'Diseñar una dinámica de cartas para reemplazar diapositivas.', NULL, NULL, 'dice_check', NULL, false, 1, NULL, 0, 0, '{"attribute": "DIS", "gm_group": "GM 3 (Creatividad)", "rewards": {"xp": 50, "cp": 1, "journal_reflection": true}, "faction_impact": {"success": 1, "fail": 0}}'::jsonb),
    ('gm_autonomy_sdt', v_event_id, 'Autonomía (SDT)', 'Cómo dar opciones de elección real para consolidar el compromiso.', 'Cómo dar opciones de elección real para consolidar el compromiso.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Empowerment & Control", "fallback_feedback": "Presentar falsas alternativas donde todos los caminos conducen al mismo resultado idéntico es detectado de inmediato como manipulación, deteriorando la confianza del usuario y detonando reactancia psicológica.\n\nLa Teoría de la Autodeterminación (SDT) en BEM establece que la motivación intrínseca requiere autonomía estructurada: libertad de elección real en el orden de abordaje, la estrategia táctica o la asignación de recursos, siempre dentro de reglas claras y con consecuencias tangibles. La agencia humana florece cuando el usuario es el autor visible de su trayectoria.\n\nRegistro de gobernanza conductual consolidado en tu Bitácora. Principio rector BEM: Diseñar autonomía no es eliminar las reglas; es ofrecer caminos múltiples y consecuencias genuinas dentro de un marco claro.", "gm_group": "GM 3 (Creatividad)", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "journal_reflection": true}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    ('gm_7drivers_bem', v_event_id, 'Los 7 Drivers', 'Diseñar retos que apelen a maestría, relación y propósito.', 'Diseñar retos que apelen a maestría, relación y propósito.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Discovery & Mastery", "fallback_feedback": "La mayoría de los sistemas fallidos sufren de monocultivo motivacional: apelan únicamente a la competencia numérica o a la acumulación de incentivos transaccionales, dejando desatendidos los resortes psicológicos más profundos de la audiencia.\n\nLa Brújula de los 7 Drivers de BEM exige un balance multidimensional que active Maestría, Relacionamiento, Eficiencia, Descubrimiento, Empoderamiento, Estética e Identidad Épica. Un diseño resiliente no asume un usuario homogéneo; ofrece diversas vías de significado para que cada perfil conecte desde sus propias fortalezas intrínsecas.\n\nMatriz de balance motivacional integrada en tu Bitácora. Principio rector BEM: Si tu sistema solo se sostiene mediante puntos y tablas, no tienes un diseño gamificado; tienes una transacción precaria.", "gm_group": "GM 3 (Creatividad)", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "items": ["item_brujula_drivers"]}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    -- GM 4 (Facilitación)
    ('gm_timebomb_02', v_event_id, 'Blindaje Metodológico', 'Defender la rigurosidad lúdica ante directivos escépticos.', 'Defender la rigurosidad lúdica ante directivos escépticos.', NULL, NULL, 'time_bomb', NULL, false, 1, 1800, 0, 0, '{"target_code": "G4TB", "gm_group": "GM 4 (Facilitación)", "rewards": {"xp": 50, "cp": 1, "items": ["item_audio_inercia_02"]}, "faction_impact": {"on_time": 1, "expired": 0}}'::jsonb),
    ('gm_sp_facilitate', v_event_id, 'Liderazgo Empático', 'Integrar a participantes resistentes sin forzarlos ni ridiculizarlos.', 'Integrar a participantes resistentes sin forzarlos ni ridiculizarlos.', NULL, NULL, 'dice_check', NULL, false, 1, NULL, 0, 0, '{"attribute": "FAC", "gm_group": "GM 4 (Facilitación)", "rewards": {"xp": 50, "cp": 1, "journal_reflection": true}, "faction_impact": {"success": 1, "fail": 0}}'::jsonb),
    ('gm_circle_magic', v_event_id, 'El Círculo Mágico', 'Crear un espacio seguro donde ensayar el futuro organizacional.', 'Crear un espacio seguro donde ensayar el futuro organizacional.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Epic Identity & Purpose", "fallback_feedback": "Las organizaciones tradicionales temen al juego porque confunden ligereza con falta de rigor. Sin embargo, cuando una institución no cuenta con espacios de experimentación lúdica, sus líderes terminan ensayando estrategias arriesgadas directamente en el mercado con costos millonarios.\n\nEl Círculo Mágico de Johan Huizinga, adaptado por BEM, delimita un espacio formal de seguridad psicológica donde las jerarquías se suspenden y se simulan futuros posibles. Permite testear hipótesis radicales, experimentar con el fracaso y recalibrar modelos de negocio sin poner en riesgo la viabilidad de la organización.\n\nArchivo de seguridad experimental sellado en tu Bitácora. Principio rector BEM: El Círculo Mágico no es un escape infantil de la realidad; es el laboratorio más riguroso y seguro para ensayar el futuro.", "gm_group": "GM 4 (Facilitación)", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "items": ["item_audio_huizinga_revelacion"]}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    -- GM 5 (Estrategia)
    ('gm_sp_strategy', v_event_id, 'Defensa del ROI', 'Justificar el impacto y transferencia laboral ante comités financieros.', 'Justificar el impacto y transferencia laboral ante comités financieros.', NULL, NULL, 'dice_check', NULL, false, 1, NULL, 0, 0, '{"attribute": "EST", "gm_group": "GM 5 (Estrategia)", "rewards": {"xp": 50, "cp": 1, "journal_reflection": true}, "faction_impact": {"success": 1, "fail": 0}}'::jsonb),
    ('gm_role_identity', v_event_id, 'Identidad de Rol', 'Distribución de responsabilidades para que cada talento brille.', 'Distribución de responsabilidades para que cada talento brille.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Relatedness & Empowerment", "fallback_feedback": "Forzar a todos los integrantes de un equipo a participar bajo el mismo molde comunicativo y analítico genera frustración y desperdicia la diversidad de talentos. La homogeneidad impuesta es la enemiga del alto desempeño.\n\nEl diseño de roles en BEM estructura identidades complementarias (diseñadores conductuales, arquitectos de experiencias, facilitadores sistémicos y directores estratégicos) que generan interdependencia positiva. Cuando cada agente aporta una perspectiva especializada y necesaria para el éxito colectivo, la colaboración deja de ser forzada y se vuelve orgánica.\n\nDespliegue de sinergia de roles registrado en tu Bitácora. Principio rector BEM: La verdadera colaboración no nace de la uniformidad, sino de la interdependencia entre roles especializados y necesarios.", "gm_group": "GM 5 (Estrategia)", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "journal_reflection": true}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb),
    ('gm_dossier_impact', v_event_id, 'Meta-Métricas BEM', 'Medición rigurosa de Arousal, Persistencia y Dirección.', 'Medición rigurosa de Arousal, Persistencia y Dirección.', NULL, NULL, 'ai_prompt_challenge', NULL, false, 1, NULL, 0, 0, '{"driver": "Efficiency & Empowerment", "fallback_feedback": "Defender proyectos de gamificación ante juntas directivas basándose en asistencia o satisfacción de los participantes es insostenible. Las métricas de vanidad capturan exposición cosmética, jamás transformación de hábitos ni retorno de inversión.\n\nLa ciencia del comportamiento en BEM audita el impacto mediante tres meta-métricas objetivas: Arousal (nivel de energía, foco y calidad del esfuerzo invertido), Persistencia (tiempo antes de la extinción conductual y resiliencia ante la fricción) y Dirección (verificar si la meta genera conductas de aproximación/ganancia, evasión defensiva o apatía). Esta tríada convierte la motivación en una variable auditable y predecible.\n\nDossier de auditoría ejecutiva sellado en tu Bitácora. Principio rector BEM: Mide la energía invertida (Arousal), el sostenimiento del esfuerzo (Persistencia) y la orientación de la conducta (Dirección); todo lo demás es ruido de marketing.", "gm_group": "GM 5 (Estrategia)", "rewards": {"xp_base": 30, "xp_ai_range": [10, 40], "cp": 1, "items": ["item_dossier_roi"]}, "faction_impact": {"ai_score_ge_25": 1, "ai_score_lt_25": 0}}'::jsonb)
    ON CONFLICT (id, event_id) DO UPDATE SET mechanic = EXCLUDED.mechanic, title = EXCLUDED.title, preview = EXCLUDED.preview, description = EXCLUDED.description;

    -- 11. Códigos entregados en mano por los Game Masters (15 códigos: 5 GMs × 3 códigos, IDs numéricos 1..15)
    INSERT INTO bem.eventgage_event_codes (id, event_id, code, unlocks_item, unlocks_mission, rewards, category, display_id, description)
    VALUES
    -- GM 1 (Fundamentos) -> IDs 1, 2, 3
    ('code_gm_pbl_trap', v_event_id, 'G1P8', NULL, 'gm_pbl_trap', '{}'::jsonb, 'game_master', 'GM-01', 'GM 1 (Fundamentos) - La Trampa de los Puntos'),
    ('code_gm_timebomb_01', v_event_id, 'G1TB', NULL, 'gm_timebomb_01', '{}'::jsonb, 'game_master', 'GM-02', 'GM 1 (Fundamentos) - Alerta de Sabotaje (Time-Bomb)'),
    ('code_gm_goodhart', v_event_id, 'G1GH', NULL, 'gm_goodhart', '{}'::jsonb, 'game_master', 'GM-03', 'GM 1 (Fundamentos) - Ley de Goodhart'),
    -- GM 2 (Métricas) -> IDs 4, 5, 6
    ('code_gm_sp_metrics', v_event_id, 'G2MT', NULL, 'gm_sp_metrics', '{}'::jsonb, 'game_master', 'GM-04', 'GM 2 (Métricas) - Auditoría de Métricas (Skill Check)'),
    ('code_gm_diff_curve', v_event_id, 'G2DC', NULL, 'gm_diff_curve', '{}'::jsonb, 'game_master', 'GM-05', 'GM 2 (Métricas) - Curva de Aprendizaje (Skill Check)'),
    ('code_gm_hygiene_base', v_event_id, 'G2HB', NULL, 'gm_hygiene_base', '{}'::jsonb, 'game_master', 'GM-06', 'GM 2 (Métricas) - Factores Higiénicos vs Motivacionales'),
    -- GM 3 (Creatividad) -> IDs 7, 8, 9
    ('code_gm_sp_mechanic', v_event_id, 'G3MC', NULL, 'gm_sp_mechanic', '{}'::jsonb, 'game_master', 'GM-07', 'GM 3 (Creatividad) - Prototipado Lúdico (Skill Check)'),
    ('code_gm_autonomy_sdt', v_event_id, 'G3AU', NULL, 'gm_autonomy_sdt', '{}'::jsonb, 'game_master', 'GM-08', 'GM 3 (Creatividad) - Autonomía (SDT)'),
    ('code_gm_7drivers_bem', v_event_id, 'G3DR', NULL, 'gm_7drivers_bem', '{}'::jsonb, 'game_master', 'GM-09', 'GM 3 (Creatividad) - Los 7 Drivers de BEM'),
    -- GM 4 (Facilitación) -> IDs 10, 11, 12
    ('code_gm_timebomb_02', v_event_id, 'G4TB', NULL, 'gm_timebomb_02', '{}'::jsonb, 'game_master', 'GM-10', 'GM 4 (Facilitación) - Blindaje Metodológico (Time-Bomb)'),
    ('code_gm_sp_facilitate', v_event_id, 'G4FC', NULL, 'gm_sp_facilitate', '{}'::jsonb, 'game_master', 'GM-11', 'GM 4 (Facilitación) - Liderazgo Empático (Skill Check)'),
    ('code_gm_circle_magic', v_event_id, 'G4CM', NULL, 'gm_circle_magic', '{}'::jsonb, 'game_master', 'GM-12', 'GM 4 (Facilitación) - El Círculo Mágico de Huizinga'),
    -- GM 5 (Estrategia) -> IDs 13, 14, 15
    ('code_gm_sp_strategy', v_event_id, 'G5ST', NULL, 'gm_sp_strategy', '{}'::jsonb, 'game_master', 'GM-13', 'GM 5 (Estrategia) - Defensa del ROI (Skill Check)'),
    ('code_gm_role_identity', v_event_id, 'G5ID', NULL, 'gm_role_identity', '{}'::jsonb, 'game_master', 'GM-14', 'GM 5 (Estrategia) - Identidad de Rol e Interdependencia'),
    ('code_gm_dossier_impact', v_event_id, 'G5DS', NULL, 'gm_dossier_impact', '{}'::jsonb, 'game_master', 'GM-15', 'GM 5 (Estrategia) - Meta-Métricas: Arousal, Persistencia y Dirección')
    ON CONFLICT (id, event_id) DO UPDATE SET
        code = EXCLUDED.code,
        unlocks_mission = EXCLUDED.unlocks_mission,
        category = EXCLUDED.category,
        display_id = EXCLUDED.display_id,
        description = EXCLUDED.description;

    -- 10.5. Cascada de texto por Facción/Avatar (sección 10.4) sobre las
    -- misiones ai_prompt_challenge del pool (13 en total: 8 de recinto + 5 de
    -- GM). Mismo patrón ya establecido en m01_giocchi_calibration (sección 6
    -- arriba): mechanic.faction_variants / mechanic.avatar_variants, jsonb
    -- merge sobre el `mechanic` existente en vez de reescribirlo entero. No
    -- todas las misiones del pool reciben esta cascada — solo las de
    -- ai_prompt_challenge, que son las que tienen un prompt abierto real que
    -- reencuadrar por perspectiva; dice_check/trivia_quiz/time_bomb resuelven
    -- una mecánica fija y no tienen un "prompt" que variar (decisión de
    -- Javier: "no todas van a tener variantes... sólo las que apliquen").
    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Describe cómo estructurarías los primeros cinco minutos de una clase o taller para generar una victoria temprana, sin saturar con teoría.",
            "fac_impacto_valor": "Describe cómo diseñarías el primer contacto de un usuario o cliente con tu marca para generar una victoria temprana, sin abrumarlo con información.",
            "fac_agilidad_autonomia": "Describe cómo estructurarías el arranque de un sprint o proceso de innovación para que el equipo tenga una victoria temprana, sin parálisis por análisis inicial."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en qué métrica objetiva usarías para confirmar que esa primera victoria realmente ocurrió.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en cómo se sentiría esa primera victoria desde la experiencia sensorial e inmersiva del usuario.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo esa primera victoria genera confianza y seguridad psicológica en el grupo.",
            "avatar_director_estrategico": "Enfoca tu respuesta en por qué esa primera victoria temprana reduce el riesgo de abandono y protege la inversión del programa."
        }
    }'::jsonb WHERE id = 'rec_calibracion' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Plantea un ejemplo de evaluación tardía (semanas después) en un aula o capacitación que haya matado el aprendizaje real.",
            "fac_impacto_valor": "Plantea un ejemplo de una marca que tardó demasiado en responder a sus usuarios y perdió su lealtad por eso.",
            "fac_agilidad_autonomia": "Plantea un ejemplo de un equipo de producto que recibió feedback de usuarios demasiado tarde para poder actuar sobre él."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en cómo medirías el tiempo exacto entre la acción y la señal de retorno.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en cómo diseñarías la señal de retorno para que se sienta inmediata y satisfactoria.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo el feedback tardío erosiona la confianza entre las personas involucradas.",
            "avatar_director_estrategico": "Enfoca tu respuesta en el costo de oportunidad de retrasar la retroalimentación en un proceso crítico del negocio."
        }
    }'::jsonb WHERE id = 'rec_feedback_loop' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Describe cómo tratarías el error de un estudiante para que se sienta un checkpoint de aprendizaje y no un castigo terminal.",
            "fac_impacto_valor": "Describe cómo manejarías una campaña de marketing fallida frente al equipo sin que se perciba como un fracaso terminal.",
            "fac_agilidad_autonomia": "Describe cómo tratarías un prototipo fallido en un sprint para que el equipo itere en vez de paralizarse."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en cómo calibrarías la penalización según la dificultad real del reto.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en cómo diseñarías la experiencia del fallo para que se sienta segura de explorar.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo evitarías que el grupo señale o ridiculice a quien falló.",
            "avatar_director_estrategico": "Enfoca tu respuesta en por qué una cultura de bajo costo de fallo protege la innovación a largo plazo."
        }
    }'::jsonb WHERE id = 'rec_fail_smart' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Plantea una tarea académica obligatoria que podrías transformar en un reto con propósito visible para el estudiante.",
            "fac_impacto_valor": "Plantea una tarea rutinaria de atención al cliente que podrías transformar en un reto con propósito visible para el usuario.",
            "fac_agilidad_autonomia": "Plantea una tarea administrativa obligatoria de tu equipo que podrías transformar en un reto con propósito visible."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en qué mecánica de estímulo-respuesta usarías para ese cambio de encuadre.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en qué narrativa o contexto le darías a esa tarea para que se sienta un reto, no una obligación.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo ese cambio de encuadre afecta el clima y la disposición del equipo.",
            "avatar_director_estrategico": "Enfoca tu respuesta en cómo justificarías ante liderazgo que ese rediseño vale la inversión de tiempo."
        }
    }'::jsonb WHERE id = 'rec_task_shift' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Describe un enigma o pista previa que enviarías 48 horas antes de una clase para generar intriga.",
            "fac_impacto_valor": "Describe una pieza de intriga previa que enviarías antes de un lanzamiento de producto para generar expectativa.",
            "fac_agilidad_autonomia": "Describe una pista o desafío previo que compartirías con el equipo antes de arrancar un sprint para generar enganche."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en qué gatillo psicológico específico activa esa expectativa previa.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en el formato sensorial o estético de esa pieza de intriga previa.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo esa expectativa previa genera conexión entre los participantes antes de reunirse.",
            "avatar_director_estrategico": "Enfoca tu respuesta en cómo esa fase de expectativa mejora el KPI de adopción inicial del programa."
        }
    }'::jsonb WHERE id = 'rec_expectation' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Plantea un ejemplo de una metáfora o historia usada en el aula que distraía más de lo que ayudaba a decidir.",
            "fac_impacto_valor": "Plantea un ejemplo de una campaña con storytelling elaborado que no cambió ninguna decisión real del usuario.",
            "fac_agilidad_autonomia": "Plantea un ejemplo de una narrativa de producto que sonaba bien pero no orientaba ninguna decisión del equipo."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en qué decisión concreta debería cambiar gracias a ese elemento narrativo.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en cómo simplificarías esa narrativa sin perder su función estructural.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo esa narrativa ayuda o estorba a la cohesión del grupo.",
            "avatar_director_estrategico": "Enfoca tu respuesta en por qué el cinismo ejecutivo aumenta cuando la narrativa es puro adorno."
        }
    }'::jsonb WHERE id = 'rec_lean_story' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Plantea un problema abstracto común (no una persona) contra el cual podrías unir a un grupo de estudiantes.",
            "fac_impacto_valor": "Plantea un problema abstracto común contra el cual podrías unir a un equipo de mercadeo, en vez de hacerlos competir entre sí.",
            "fac_agilidad_autonomia": "Plantea un problema abstracto común (como la burocracia o el retrabajo) contra el cual podrías unir a un equipo de producto."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en qué comportamiento medible cambiaría si el grupo combate ese antagonista en vez de competir entre sí.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en cómo personificarías ese antagonista para que se sienta un enemigo real y memorable.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo ese antagonista común mejora la interdependencia y confianza del grupo.",
            "avatar_director_estrategico": "Enfoca tu respuesta en el riesgo organizacional de dejar que los talentos compitan entre sí en vez de colaborar."
        }
    }'::jsonb WHERE id = 'rec_antagonistas' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Plantea un ejemplo de retroalimentación académica que llegó tan tarde que ya no sirvió para corregir nada.",
            "fac_impacto_valor": "Plantea un ejemplo de una encuesta de satisfacción cuyos resultados se entregaron tan tarde que ya no eran accionables.",
            "fac_agilidad_autonomia": "Plantea un ejemplo de una revisión de producto que llegó tan tarde que el equipo ya había seguido por el camino equivocado."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en cuánto tiempo máximo debería pasar entre la acción y la señal de retorno para que siga siendo útil.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en cómo diseñarías un canal de retorno que se sienta inmediato aunque el análisis tome tiempo.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo la demora en el feedback afecta la confianza entre quien evalúa y quien es evaluado.",
            "avatar_director_estrategico": "Enfoca tu respuesta en el costo de oportunidad de mantener ciclos de revisión lentos en tu organización."
        }
    }'::jsonb WHERE id = 'rec_feedback_cad' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Describe una decisión real que podrías dejar en manos del estudiante en vez de imponerla, sin perder el rigor del curso.",
            "fac_impacto_valor": "Describe una decisión real que podrías dejar en manos del usuario en vez de imponerla, sin perder el control de marca.",
            "fac_agilidad_autonomia": "Describe una decisión real que podrías dejar en manos del equipo en vez de imponerla desde arriba, sin perder el rumbo del proyecto."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en cómo medirías si esa autonomía realmente aumentó el compromiso, no solo la percepción de libertad.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en cómo se sentiría esa elección real desde la experiencia del usuario en el momento de decidir.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo esa autonomía real afecta la confianza del grupo hacia quien facilita.",
            "avatar_director_estrategico": "Enfoca tu respuesta en qué reglas claras necesitarías mantener para que esa autonomía no se vuelva descontrol."
        }
    }'::jsonb WHERE id = 'gm_autonomy_sdt' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Plantea un curso o programa que solo apele a la competencia numérica (puntos, ranking) y describe qué otro driver le agregarías.",
            "fac_impacto_valor": "Plantea una campaña que solo apele a la acumulación de puntos o premios y describe qué otro driver le agregarías.",
            "fac_agilidad_autonomia": "Plantea una dinámica de equipo que solo apele a métricas de productividad y describe qué otro driver le agregarías."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en qué driver es más fácil de medir objetivamente y cuál es el más difícil.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en cómo ese driver adicional cambiaría la estética o inmersión de la experiencia.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo ese driver adicional fortalece la relación entre los participantes.",
            "avatar_director_estrategico": "Enfoca tu respuesta en por qué depender de un solo driver motivacional es un riesgo para la sostenibilidad del programa."
        }
    }'::jsonb WHERE id = 'gm_7drivers_bem' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Describe un espacio seguro que crearías en un aula para que los estudiantes ensayen decisiones sin miedo a la nota.",
            "fac_impacto_valor": "Describe un espacio seguro que crearías para que un equipo de marketing ensaye campañas arriesgadas sin miedo a fallar en público.",
            "fac_agilidad_autonomia": "Describe un espacio seguro que crearías para que un equipo de producto pruebe hipótesis radicales sin arriesgar el negocio real."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en qué reglas objetivas delimitarían ese espacio seguro para que siga siendo riguroso, no caótico.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en cómo señalizarías visual o narrativamente que ese espacio está fuera de las jerarquías normales.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo protegerías la seguridad psicológica de quienes participan en ese espacio.",
            "avatar_director_estrategico": "Enfoca tu respuesta en cómo justificarías ante la organización el valor de invertir tiempo en ese espacio de ensayo."
        }
    }'::jsonb WHERE id = 'gm_circle_magic' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Plantea un proyecto grupal donde forzar el mismo rol a todos los estudiantes desperdició talentos distintos.",
            "fac_impacto_valor": "Plantea una campaña donde forzar el mismo rol a todo el equipo desperdició talentos distintos (analítico, creativo, relacional).",
            "fac_agilidad_autonomia": "Plantea un sprint donde forzar el mismo rol a todo el equipo desperdició talentos distintos."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en qué rol tomarías tú mismo dentro de esa distribución y por qué.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en cómo harías visible la identidad de cada rol para que el equipo la reconozca.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo esa distribución de roles genera interdependencia positiva en vez de rivalidad.",
            "avatar_director_estrategico": "Enfoca tu respuesta en cómo esa distribución de roles mejora el desempeño colectivo medible del equipo."
        }
    }'::jsonb WHERE id = 'gm_role_identity' AND event_id = v_event_id;

    UPDATE bem.eventgage_event_missions SET mechanic = mechanic || '{
        "faction_variants": {
            "fac_aprendizaje_activo": "Plantea qué medirías (más allá de la asistencia) para demostrar que un programa formativo realmente cambió comportamientos.",
            "fac_impacto_valor": "Plantea qué medirías (más allá de likes o alcance) para demostrar que una campaña realmente generó lealtad.",
            "fac_agilidad_autonomia": "Plantea qué medirías (más allá de velocidad de entrega) para demostrar que un proceso ágil realmente mejoró el desempeño del equipo."
        },
        "avatar_variants": {
            "avatar_disenador_conductual": "Enfoca tu respuesta en cómo operacionalizarías Arousal, Persistencia y Dirección en datos concretos y medibles.",
            "avatar_arquitecto_experiencias": "Enfoca tu respuesta en qué señales de experiencia (no solo datos duros) delatan un cambio real de comportamiento.",
            "avatar_facilitador_sistemico": "Enfoca tu respuesta en cómo medirías el cambio en el clima o la cohesión del equipo, no solo en el individuo.",
            "avatar_director_estrategico": "Enfoca tu respuesta en cómo presentarías esas tres meta-métricas ante una junta directiva escéptica."
        }
    }'::jsonb WHERE id = 'gm_dossier_impact' AND event_id = v_event_id;

    -- 11.5. Misiones de Votación Colectiva (sección 11.1, punto 2 — Consola de
    -- Votación en Vivo). No estaban en el catálogo original (el backend y el
    -- frontend de "Canal" ya existían, pero sin contenido real de Gamescon
    -- sembrado). Sin código físico ni GM asignado: `public = true`, visibles
    -- desde el inicio, pensadas para el pulso de opinión durante la sesión
    -- plenaria. Sin `faction_impact`: son encuestas de postura, no aciertos.
    INSERT INTO bem.eventgage_event_missions (id, event_id, title, preview, description, image, background, mission_type, unlocks_mission, public, chapter, time_limit_seconds, cp_cost, cp_bet, mechanic)
    VALUES
    ('vote_fail_smart_path', v_event_id, 'Votación: El Camino del Fail Smart', 'Un equipo comete un error grande en un piloto de gamificación. ¿Qué camino fortalece más la cultura de Fail Smart a largo plazo?', 'Un equipo comete un error grande en un piloto de gamificación. ¿Qué camino fortalece más la cultura de Fail Smart a largo plazo?', NULL, NULL, 'collective_vote', NULL, true, 1, NULL, 0, 0, '{"question": "Un equipo comete un error grande en un piloto de gamificación. ¿Qué camino fortalece más la cultura de Fail Smart a largo plazo?", "options": [{"id": "a", "text": "Documentarlo abiertamente como caso de aprendizaje en el próximo retro"}, {"id": "b", "text": "Resolverlo en privado entre el líder y quien lo cometió"}, {"id": "c", "text": "Ajustar las métricas para que ese error no vuelva a registrarse como \"fallo\""}]}'::jsonb),
    ('vote_incentivo_autentico', v_event_id, 'Votación: Diseño de Incentivos', 'Al diseñar incentivos para adoptar una herramienta nueva, ¿qué enfoque priorizarías primero?', 'Al diseñar incentivos para adoptar una herramienta nueva, ¿qué enfoque priorizarías primero?', NULL, NULL, 'collective_vote', NULL, true, 1, NULL, 0, 0, '{"question": "Al diseñar incentivos para adoptar una herramienta nueva, ¿qué enfoque priorizarías primero?", "options": [{"id": "a", "text": "Recompensas tangibles inmediatas"}, {"id": "b", "text": "Autonomía real para elegir cómo y cuándo adoptarla"}, {"id": "c", "text": "Propósito compartido con una meta colectiva"}]}'::jsonb),
    ('vote_feedback_cadencia', v_event_id, 'Votación: Cadencia de Feedback', 'Para sostener el compromiso en una capacitación de varios meses, ¿qué cadencia de feedback priorizarías?', 'Para sostener el compromiso en una capacitación de varios meses, ¿qué cadencia de feedback priorizarías?', NULL, NULL, 'collective_vote', NULL, true, 1, NULL, 0, 0, '{"question": "Para sostener el compromiso en una capacitación de varios meses, ¿qué cadencia de feedback priorizarías?", "options": [{"id": "a", "text": "Feedback inmediato tras cada micro-actividad"}, {"id": "b", "text": "Revisiones profundas espaciadas"}, {"id": "c", "text": "Un híbrido de ambas"}]}'::jsonb),
    ('vote_dificultad_flow', v_event_id, 'Votación: Calibrar el Reto', 'Un reto gamificado genera abandono: la mitad dice que es muy fácil, la otra mitad que muy difícil. ¿Qué camino tomarías primero?', 'Un reto gamificado genera abandono: la mitad dice que es muy fácil, la otra mitad que muy difícil. ¿Qué camino tomarías primero?', NULL, NULL, 'collective_vote', NULL, true, 1, NULL, 0, 0, '{"question": "Un reto gamificado genera abandono: la mitad dice que es muy fácil, la otra mitad que muy difícil. ¿Qué camino tomarías primero?", "options": [{"id": "a", "text": "Rutas de dificultad adaptable según el desempeño de cada participante"}, {"id": "b", "text": "Un único nivel intermedio para todos"}, {"id": "c", "text": "Que cada participante elija su nivel de reto al inicio"}]}'::jsonb),
    ('vote_metrica_vanidad', v_event_id, 'Votación: La Métrica que Defenderías', 'Debés defender ante la dirección qué métrica reportar como éxito de un programa de gamificación. ¿Cuál defenderías con más fuerza?', 'Debés defender ante la dirección qué métrica reportar como éxito de un programa de gamificación. ¿Cuál defenderías con más fuerza?', NULL, NULL, 'collective_vote', NULL, true, 1, NULL, 0, 0, '{"question": "Debés defender ante la dirección qué métrica reportar como éxito de un programa de gamificación. ¿Cuál defenderías con más fuerza?", "options": [{"id": "a", "text": "Número de interacciones/clics generados"}, {"id": "b", "text": "Cambio real medible en el desempeño o comportamiento del participante"}, {"id": "c", "text": "Nivel de satisfacción declarado en una encuesta de salida"}]}'::jsonb)
    ON CONFLICT (id, event_id) DO UPDATE SET mechanic = EXCLUDED.mechanic, title = EXCLUDED.title, preview = EXCLUDED.preview, description = EXCLUDED.description;

    -- 12. Inercia Global (puntaje mundial, sección 1.3.3): valor fijo
    -- configurable por evento, no calculado por el motor — ver la nota al
    -- inicio de este archivo sobre por qué se dejó de lado la fórmula
    -- dinámica (Registrados × 3) del diseño original.
    INSERT INTO bem.eventgage_event_points (id, event_id, point_key, display_name, current_points, max_points, rules)
    VALUES
    ('pt_inercia_global', v_event_id, 'inercia_global', 'Inercia Global', 250, 250, '[]'::jsonb)
    ON CONFLICT (id, event_id) DO UPDATE SET display_name = EXCLUDED.display_name;

    -- 13. Personajes Oficiales de Gamescon (sección 5 y directivas de evento)
    INSERT INTO bem.eventgage_event_characters (id, event_id, name, portrait_url, role)
    VALUES
    (
        'char_huizinga', v_event_id,
        'Dra. Elena Huizinga',
        '/images/gamescon/characters/char_huizinga.jpg',
        'Directora de la Agencia Antropológica Huizinga'
    ),
    (
        'char_cipher', v_event_id,
        'Operador Cipher',
        '/images/gamescon/characters/char_cipher.jpg',
        'Soporte Táctico y Telecomunicaciones de la Red'
    ),
    (
        'char_giocchi', v_event_id,
        'GIOCCHI IA',
        '/images/gamescon/characters/char_giocchi.jpg',
        'Núcleo de Inteligencia Artificial & Calibración Conceptual'
    ),
    (
        'char_marcus', v_event_id,
        'Comandante Marcus Vance',
        '/images/gamescon/characters/char_marcus.jpg',
        'Jefe de Operaciones Tácticas & Contramedidas de Inercia'
    ),
    (
        'char_siobhan', v_event_id,
        'Dra. Siobhan Reed',
        '/images/gamescon/characters/char_siobhan.jpg',
        'Antropóloga Conductual Senior & Jefa de Modelado BEM'
    ),
    (
        'char_kaelen', v_event_id,
        'Agente Kaelen Novak',
        '/images/gamescon/characters/char_kaelen.jpg',
        'Especialista en Infiltración & Auditoría de Métricas Ocultas'
    )
    ON CONFLICT (id, event_id) DO UPDATE SET
        name = EXCLUDED.name,
        portrait_url = EXCLUDED.portrait_url,
        role = EXCLUDED.role;

    -- 14. Diálogos Iniciales de Historia
    INSERT INTO bem.eventgage_event_dialogues (id, event_id, character_id, title, lines, scheduled_at)
    VALUES
    (
        'diag_huizinga_apertura', v_event_id,
        'char_huizinga',
        'TRANSMISIÓN DE APERTURA',
        '[{"speaker_name": "Dra. Elena Huizinga", "text": "Agentes, la Inercia Corporativa está ganando terreno en el congreso. Sincronicen sus terminales y acérquense a las divisiones de campo de inmediato."}]'::jsonb,
        NOW()
    )
    ON CONFLICT (id, event_id) DO UPDATE SET
        character_id = EXCLUDED.character_id,
        title = EXCLUDED.title,
        lines = EXCLUDED.lines;

    -- 15. Niveles de Progresión XP (sección 1.3.4 del diseño)
    INSERT INTO bem.eventgage_event_levels (id, event_id, level, xp_required, title, unlocks)
    VALUES
    ('lvl_1', v_event_id, 1, 0, 'Recluta Inicial', '{}'::jsonb),
    ('lvl_2', v_event_id, 2, 200, 'Agente Calibrado', '{}'::jsonb),
    ('lvl_3', v_event_id, 3, 500, 'Agente Activo', '{}'::jsonb),
    ('lvl_4', v_event_id, 4, 900, 'Agente Veterano', '{"min_level_rewards": ["rew_prime_vip_consultancy"]}'::jsonb),
    ('lvl_5', v_event_id, 5, 1400, 'Especialista de Élite', '{}'::jsonb),
    ('lvl_6', v_event_id, 6, 2000, 'Estratega Mayor', '{}'::jsonb),
    ('lvl_7', v_event_id, 7, 2600, 'Maestro Huizinga', '{}'::jsonb)
    ON CONFLICT (id, event_id) DO UPDATE SET
        level = EXCLUDED.level,
        xp_required = EXCLUDED.xp_required,
        title = EXCLUDED.title,
        unlocks = EXCLUDED.unlocks;

    -- 16. Alertas Iniciales del Sistema / Transmisiones Oficiales
    INSERT INTO bem.eventgage_event_alerts (id, event_id, title, message, type, expiration_seconds, scheduled_at)
    VALUES
    (
        'alert_init_01', v_event_id,
        'DESPLIEGUE TÁCTICO INICIADO',
        'Atención Agentes PRIME: Todas las terminales de Gamescon han sido sincronizadas.',
        'warning',
        60,
        NOW()
    )
    ON CONFLICT (id, event_id) DO UPDATE SET
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        type = EXCLUDED.type,
        expiration_seconds = EXCLUDED.expiration_seconds;

END $$;


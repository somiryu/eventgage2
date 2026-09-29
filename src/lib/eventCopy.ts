// Copy narrativo por evento (lexicón, onboarding, guía, personajes, hitos de
// reserva). Antes todo esto vivía escrito a mano en [event_slug]/+page.svelte
// y eventService.ts con el lore de Gamescon — cualquier evento nuevo heredaba
// a la Dra. Huizinga y a Cipher. Ahora:
//
//   1. Cada evento arranca de un PRESET: `config.copy_preset` si existe, si
//      no el slug del evento, y si ninguno coincide, NEUTRAL_COPY.
//   2. `config.copy` (JSONB en bem.eventgage_events) se mezcla encima del
//      preset — un evento nuevo define su lore en la base, no en el código.
//
// GAMESCON_COPY es la transcripción literal del canon que ya estaba en el
// código (docs/designs/gamescon.md) para que Gamescon siga idéntico sin
// tener que migrar su fila en producción.

export interface CopySpeaker {
	name: string;
	role: string;
	portrait_url: string | null;
}

export interface NarrativeAct {
	label: string;
	text: string;
	// Variantes condicionales: si el avatar/facción del jugador tiene
	// entrada propia, reemplaza a `text`.
	by_avatar?: Record<string, string>;
	by_faction?: Record<string, string>;
}

export interface GuideDirective {
	if_completed_mission?: string;
	if_redeemed_code?: string;
	// Progreso acumulado: misiones completadas >= N (p.ej. escamas de una ruta).
	if_completed_count_gte?: number;
	text: string;
}

export interface MilestoneDef {
	count: number;
	xp: number;
	cp: number;
	spBonus: number;
	rank: number;
	rankTitle: string;
	lore: string;
	unlockItem?: string;
	narrative?: any;
}

export interface EventCopy {
	player_noun: string;
	player_noun_indef: string;
	player_noun_plural: string;
	// Unidad de progreso de los hitos ("misiones", "escamas", "sellos"...).
	progress_unit_plural: string;
	currency_name: string;
	currency_icon: string;
	vault_name: string;
	vault_hint: string;
	rank_default: string;
	profile_title: string;
	system_error: string;
	empty_featured_mission: string;
	empty_map: string;
	feed_treaty_signed: string;
	organization_name: string;
	factions_label: string;
	labels: {
		unlocked_mission: string;
		go_to_mission: string;
		stay: string;
		// Nombre visible de cada mission_type (en vez del id técnico).
		mission_types: Record<string, string>;
	};
	// Pantalla pública proyectable (/[slug]/public-dashboard).
	public_dashboard: {
		subtitle: string;
		hof_title: string;
		hof_empty: string;
		// Insignia del Hall según rango: gana la primera cuyo min_rank se cumple.
		honor_badges: Array<{ min_rank: number; label: string }>;
		factions_title: string;
		feed_title: string;
		// Gamescon: firma del Tratado (QR + firmantes). Otros eventos: QR de ingreso.
		treaty_enabled: boolean;
		join_title: string;
		join_hint: string;
	};
	// Asistente de ingreso (elección de facción y avatar).
	wizard: {
		faction_prompt: string;
		faction_title: string;
		next_to_avatar: string;
		avatar_prompt: string;
		back_to_factions: string;
	};
	onboarding: { speaker: CopySpeaker; acts: NarrativeAct[]; skip_label: string; finish_label: string } | null;
	welcome_modal: { speaker: CopySpeaker; badge: string; paragraphs_html: string[] } | null;
	guide: {
		character_id: string;
		name: string;
		role: string;
		bio: string;
		portrait_url: string | null;
		directives: GuideDirective[];
		fallback_text: string;
	} | null;
	story_speaker: CopySpeaker;
	character_bios: Record<string, { role: string; bio: string }>;
	levels_fallback: Array<{ id: string; level: number; xp_required: number; title: string }>;
	milestones_fallback: MilestoneDef[];
	// Cómo reacciona el medidor mundial (eventgage_event_points) al resultado
	// de una misión. Gamescon: la Inercia BAJA con cada éxito (-1) y sube con
	// cada fallo (+1). Otros eventos pueden invertirlo (p.ej. un medidor que
	// sube con cada logro de la comunidad).
	world_meter: { on_success: number; on_fail: number; description: string };
	messages: {
		duplicate_code: string;
		trivia_correct: string;
		trivia_wrong: string;
		dice_success: string;
		dice_fail: string;
		dice_retry_success: string;
	};
}

const GAMESCON_MILESTONES: MilestoneDef[] = [
	{ count: 3, xp: 100, cp: 1, spBonus: 2, rank: 2, rankTitle: 'Agente de Campo', lore: 'Acceso prioritario a la Bóveda de Inteligencia.' },
	{ count: 6, xp: 120, cp: 2, spBonus: 2, rank: 3, rankTitle: 'Especialista Táctico', unlockItem: 'item_llave_boveda_prime', lore: 'Obtuviste la Llave Criptográfica PRIME.' },
	{ count: 9, xp: 140, cp: 2, spBonus: 2, rank: 4, rankTitle: 'Estratega de Enlace', lore: 'Se desclasifican las cláusulas del Tratado Huizinga.' },
	{ count: 12, xp: 150, cp: 0, spBonus: 0, rank: 5, rankTitle: 'Agente Master Huizinga', lore: 'Consagración de honor al cierre del evento.' }
];

const CIPHER_ROLE = 'Soporte Táctico y Telecomunicaciones de la Red';
const CIPHER_BIO =
	'Enlace principal de campo en EQUAA. Administra las frecuencias seguras, la telemetría de las terminales y guía a los agentes en la decodificación de pistas físicas y enlace con los Game Masters.';

export const GAMESCON_COPY: EventCopy = {
	player_noun: 'Agente',
	player_noun_indef: 'Un agente',
	player_noun_plural: 'agentes',
	progress_unit_plural: 'misiones',
	currency_name: 'Ludens',
	currency_icon: '💠',
	vault_name: 'Bóveda de Inteligencia',
	vault_hint: 'Invertí tus Ludens en ayudas tácticas y herramientas de transferencia metodológica.',
	rank_default: 'Recluta de la Red',
	profile_title: 'Expediente del Agente',
	system_error:
		'Cipher perdió la señal con el sistema central. No es tu código ni tu respuesta — reintenta en unos segundos.',
	empty_featured_mission:
		'Sin transmisiones activas. Localiza a un Operador de campo o una terminal física para recibir tu próximo código, Agente.',
	empty_map: 'Mapa del recinto pendiente de cargar — vuelve a intentarlo más tarde, Agente.',
	feed_treaty_signed: '🏛️ {name} firmó el Tratado Huizinga.',
	organization_name: 'Agencia Antropológica Huizinga',
	factions_label: 'Gremios',
	public_dashboard: {
		subtitle: 'Tablero de Estado Global — Transmisión en Vivo',
		hof_title: 'Hall de la Fama — Precedencia de Honor',
		hof_empty: 'Todavía nadie alcanzó la Llave PRIME o el Rango Master.',
		honor_badges: [
			{ min_rank: 5, label: 'Agente Master Huizinga' },
			{ min_rank: 0, label: 'Llave PRIME' }
		],
		factions_title: 'Ranking de Facciones',
		feed_title: 'Transmisiones Recientes',
		treaty_enabled: true,
		join_title: 'Únete a la Agencia',
		join_hint: 'Escanea con tu móvil para registrarte.'
	},
	labels: {
		unlocked_mission: 'NUEVA DIRECTIVA DESBLOQUEADA',
		go_to_mission: 'Ir a Misión Desbloqueada ➔',
		stay: 'Permanecer en la Terminal',
		mission_types: {}
	},
	wizard: {
		faction_prompt: 'Elige la facción a la que pertenecerá tu agente durante el evento.',
		faction_title: 'Selecciona tu Facción',
		next_to_avatar: 'Siguiente: Elegir Avatar (Clase) ➔',
		avatar_prompt: 'Selecciona la Clase de tu avatar y ajusta la versión visual.',
		back_to_factions: '⬅ Volver a Facciones'
	},
	onboarding: {
		speaker: {
			name: 'Dra. Elena Huizinga',
			role: 'Directora de la Agencia Antropológica Huizinga',
			portrait_url: '/images/gamescon/characters/char_huizinga.jpg'
		},
		skip_label: 'Omitir informe e ir a la terminal',
		finish_label: 'Acceder al HUD ⚡',
		acts: [
			{
				label: 'Bienvenida a la Red Huizinga',
				text: '"Identidad confirmada, Agente. Si estás leyendo esta transmisión, tu credencial ha sido validada dentro de la Agencia Antropológica Huizinga. Durante años hemos operado en las sombras, analizando cómo el diseño lúdico y la ciencia del comportamiento pueden transformar organizaciones enteras, mientras el mundo exterior sigue creyendo que la gamificación es solo acumular puntos sin sentido."'
			},
			{
				label: 'La Amenaza & La Sesión de Cierre',
				text: '"El Sindicato de la Inercia ha infectado nuestras instituciones con burocracia, capacitaciones invisibles y fórmulas vacías. Durante este congreso, tu misión es infiltrarte en los pasillos, recuperar fragmentos de datos (Databits) y derribar mitos en tiempo real. Todo lo que recolectes nos preparará para el despliegue decisivo: al cierre del congreso, donde ejecutaremos la intervención central y definiremos el nuevo estándar del aprendizaje interactivo."'
			},
			{
				label: 'Directiva del Rol',
				text: '"Tu mente analítica es nuestra mayor ventaja, Agente. Tu objetivo es desmantelar las trampas de sesgo y demostrar con métricas y ciencia del comportamiento que el compromiso humano no es un accidente, sino un sistema predecible y medible. Vigila los datos y optimiza cada decisión."',
				by_avatar: {
					avatar_disenador_conductual:
						'"Tu mente analítica es nuestra mayor ventaja, Agente. Tu objetivo es desmantelar las trampas de sesgo y demostrar con métricas y ciencia del comportamiento que el compromiso humano no es un accidente, sino un sistema predecible y medible. Vigila los datos y optimiza cada decisión."',
					avatar_arquitecto_experiencias:
						'"Necesitamos tu visión estética y espacial, Agente. Tu objetivo es transformar dinámicas aburridas en viajes memorables. Diseña las narrativas, tensiona las interfaces y asegúrate de que cada punto de contacto despierte curiosidad genuina en lugar de apatía."',
					avatar_facilitador_sistemico:
						'"Las personas son el núcleo de esta red, Agente. Tu objetivo es tender puentes entre las facciones, activar el cambio cultural y romper la resistencia humana ante nuevas formas de aprender y colaborar. La cohesión del equipo descansa en tu liderazgo."',
					avatar_director_estrategico:
						'"Tú ves el panorama completo y el valor real del negocio, Agente. Tu objetivo es alinear cada mecánica con los objetivos institucionales de alto nivel, blindando el retorno de inversión y asegurando que nuestras soluciones tengan impacto ejecutivo sostenible."'
				}
			},
			{
				label: 'Directiva de Frente de Batalla',
				text: '"Has sido asignado a la División de Aprendizaje Activo. Tu frente de batalla es el aula, el taller y el auditorio. Tu objetivo prioritario es erradicar el \'Sabotaje del Formulario Invisible\': transformar la capacitación pasiva en dominio real. Haz que cada concepto sea vivido y dominado."',
				by_faction: {
					fac_aprendizaje_activo:
						'"Has sido asignado a la División de Aprendizaje Activo. Tu frente de batalla es el aula, el taller y el auditorio. Tu objetivo prioritario es erradicar el \'Sabotaje del Formulario Invisible\': transformar la capacitación pasiva en dominio real. Haz que cada concepto sea vivido y dominado."',
					fac_impacto_valor:
						'"Te has integrado a la División de Impacto & Valor. Tu frente de batalla es la percepción, la lealtad y el posicionamiento. Tu misión prioritaria es derribar el \'Sabotaje de la Medalla Vacía\': demostrar que el engagement no se regala ni se compra, se conquista con experiencias memorables y auténticas."',
					fac_agilidad_autonomia:
						'"Operas ahora bajo la División de Agilidad & Autonomía. Tu frente de batalla son los procesos, la experimentación y el producto. Tu misión prioritaria es quebrar el \'Sabotaje de la Parálisis Creativa\': empoderar a los equipos para prototipar rápido, aprender del error y desatar la innovación sin pedir permiso a la burocracia."'
				}
			}
		]
	},
	welcome_modal: {
		speaker: {
			name: 'Operador Cipher',
			role: 'Soporte Táctico y Telecomunicaciones',
			portrait_url: '/images/gamescon/characters/char_cipher.jpg'
		},
		badge: 'TRANSMISIÓN DIRECTA',
		paragraphs_html: [
			'¡Enlace establecido, colega! Soy Cipher, tu soporte táctico durante el congreso. La Dra. Huizinga ya te dio el panorama general, pero aquí en el terreno vamos paso a paso.',
			'Para inicializar tu terminal, habilitar el sistema de seguridad y desbloquear tus herramientas de campo, necesitamos confirmar que tu conexión no está intervenida por el Sindicato.',
			'Introduce la clave de acceso <strong>LUDENS</strong> en el Panel de Códigos de tu HUD.'
		]
	},
	guide: {
		character_id: 'char_cipher',
		name: 'Operador Cipher',
		role: CIPHER_ROLE,
		bio: CIPHER_BIO,
		portrait_url: '/images/gamescon/characters/char_cipher.jpg',
		directives: [
			{
				if_completed_mission: 'm01_giocchi_calibration',
				text: '¡Excelente calibración! El análisis de GIOCCHI ya está guardado en tu Bitácora. Ahora es momento de entrar en acción: acércate a uno de los Game Masters PRIME en los pasillos para recibir códigos de misión, o encuentra pistas físicas en el recinto para continuar desclasificando el sistema.'
			},
			{
				if_redeemed_code: 'LUDENS',
				text: '¡Terminal sincronizada! Revisa tu pestaña de Misiones: GIOCCHI, nuestra IA de inteligencia táctica, te espera para calibrar tus sensores.'
			}
		],
		fallback_text: 'Usa el código LUDENS en el panel de códigos para activar el sistema y desbloquear la Misión 1.'
	},
	story_speaker: {
		name: 'Dra. Elena Huizinga',
		role: 'Transmisión Oficial',
		portrait_url: '/images/gamescon/characters/char_huizinga.jpg'
	},
	character_bios: {
		char_cipher: { role: CIPHER_ROLE, bio: CIPHER_BIO },
		char_huizinga: {
			role: 'Directora de la Agencia Antropológica Huizinga',
			bio: 'Líder visionaria de la Agencia. Especialista en la teoría del Círculo Mágico y el diseño de entornos seguros de aprendizaje donde el error es un checkpoint de maestría (Fail Smart).'
		},
		char_siobhan: {
			role: 'Antropóloga Conductual Senior & Jefa de Modelado BEM',
			bio: 'Pionera en la arquitectura de incentivos formativos y bucles de retroalimentación inmediata (Loop GFR). Diseña sistemas para potenciar la motivación intrínseca y evitar la fatiga cognitiva.'
		},
		char_marcus: {
			role: 'Jefe de Operaciones Tácticas & Contramedidas de Inercia',
			bio: 'Auditor implacable de sistemas. Especialista en desarticular la Inercia Corporativa, patrones oscuros de manipulación y tablas de líderes tóxicas que destruyen el clima colaborativo.'
		},
		char_kaelen: {
			role: 'Especialista en Infiltración & Auditoría de Métricas Ocultas',
			bio: 'Estratega de operaciones de campo. Experto en economía narrativa, alineación de facciones y dinámicas de interdependencia positiva donde cada rol del equipo es indispensable.'
		},
		char_giocchi: {
			role: 'Núcleo de Inteligencia Artificial & Calibración Conceptual',
			bio: 'Inteligencia Artificial táctica entrenada en los principios de la metodología BEM. Evalúa las reflexiones de los agentes en tiempo real y calibra su perspectiva crítica.'
		}
	},
	levels_fallback: [
		{ id: 'lvl_1', level: 1, xp_required: 0, title: 'Recluta Inicial' },
		{ id: 'lvl_2', level: 2, xp_required: 200, title: 'Agente Calibrado' },
		{ id: 'lvl_3', level: 3, xp_required: 500, title: 'Agente Activo' },
		{ id: 'lvl_4', level: 4, xp_required: 900, title: 'Agente Veterano' },
		{ id: 'lvl_5', level: 5, xp_required: 1400, title: 'Especialista de Élite' },
		{ id: 'lvl_6', level: 6, xp_required: 2000, title: 'Estratega Mayor' },
		{ id: 'lvl_7', level: 7, xp_required: 2600, title: 'Maestro Huizinga' }
	],
	milestones_fallback: GAMESCON_MILESTONES,
	world_meter: {
		on_success: -1,
		on_fail: 1,
		description: 'Cada misión superada y código validado por cualquier agente en la convención empuja este indicador en tiempo real.'
	},
	messages: {
		duplicate_code: 'Cipher ya tiene registrado ese código en tu expediente, Agente — no hace falta canjearlo dos veces.',
		trivia_correct: '¡Correcto! Desmontaste el mito.',
		trivia_wrong: 'No era esa — pero el intento también cuenta.',
		dice_success: '¡Éxito! Tu facción avanza.',
		dice_fail: 'Fallo — la Inercia se resiste, pero el intento cuenta.',
		dice_retry_success: 'Tu facción avanza y la Inercia retrocede.'
	}
};

// Preset genérico: sin personajes, sin onboarding narrativo, vocabulario
// neutro. Es el punto de partida de cualquier evento que no sea Gamescon.
export const NEUTRAL_COPY: EventCopy = {
	player_noun: 'Jugador',
	player_noun_indef: 'Un jugador',
	player_noun_plural: 'jugadores',
	progress_unit_plural: 'misiones',
	currency_name: 'Monedas',
	currency_icon: '🪙',
	vault_name: 'Tienda',
	vault_hint: 'Canjea tus monedas por premios del evento.',
	rank_default: 'Novato',
	profile_title: 'Mi Perfil',
	system_error: 'Se perdió la conexión con el servidor. No es tu código ni tu respuesta — reintenta en unos segundos.',
	empty_featured_mission: 'No tienes misiones activas. Busca códigos en el evento para desbloquear la siguiente.',
	empty_map: 'El mapa del evento aún no está disponible — vuelve a intentarlo más tarde.',
	feed_treaty_signed: '✍️ {name} firmó el libro del evento.',
	organization_name: 'Organización del evento',
	factions_label: 'Facciones',
	public_dashboard: {
		subtitle: 'Estado del evento — en vivo',
		hof_title: 'Salón de la fama',
		hof_empty: 'Todavía nadie alcanza los rangos más altos.',
		honor_badges: [{ min_rank: 0, label: 'Destacado' }],
		factions_title: 'Ranking de equipos',
		feed_title: 'Actividad reciente',
		treaty_enabled: false,
		join_title: 'Únete al juego',
		join_hint: 'Escanea con tu móvil para registrarte y empezar a jugar.'
	},
	labels: {
		unlocked_mission: 'NUEVA MISIÓN DESBLOQUEADA',
		go_to_mission: 'Ir a la misión ➔',
		stay: 'Seguir aquí',
		mission_types: {}
	},
	wizard: {
		faction_prompt: 'Elige el equipo con el que jugarás durante el evento.',
		faction_title: 'Selecciona tu equipo',
		next_to_avatar: 'Siguiente: elegir personaje ➔',
		avatar_prompt: 'Elige tu personaje.',
		back_to_factions: '⬅ Volver'
	},
	onboarding: null,
	welcome_modal: null,
	guide: null,
	story_speaker: { name: 'Organización', role: 'Transmisión oficial', portrait_url: null },
	character_bios: {},
	levels_fallback: [
		{ id: 'lvl_1', level: 1, xp_required: 0, title: 'Novato' },
		{ id: 'lvl_2', level: 2, xp_required: 200, title: 'Aprendiz' },
		{ id: 'lvl_3', level: 3, xp_required: 500, title: 'Veterano' },
		{ id: 'lvl_4', level: 4, xp_required: 900, title: 'Experto' },
		{ id: 'lvl_5', level: 5, xp_required: 1400, title: 'Maestro' }
	],
	milestones_fallback: [
		{ count: 3, xp: 100, cp: 1, spBonus: 0, rank: 2, rankTitle: 'Explorador', lore: 'Completaste tus primeras 3 misiones.' },
		{ count: 6, xp: 120, cp: 2, spBonus: 0, rank: 3, rankTitle: 'Veterano', lore: 'Completaste 6 misiones.' },
		{ count: 9, xp: 140, cp: 2, spBonus: 0, rank: 4, rankTitle: 'Leyenda', lore: 'Completaste 9 misiones.' }
	],
	world_meter: {
		on_success: 1,
		on_fail: 0,
		description: 'Cada misión superada por cualquier jugador empuja este indicador en tiempo real.'
	},
	messages: {
		duplicate_code: 'Ya canjeaste ese código — no hace falta canjearlo dos veces.',
		trivia_correct: '¡Correcto!',
		trivia_wrong: 'No era esa — pero el intento también cuenta.',
		dice_success: '¡Éxito! Tu facción avanza.',
		dice_fail: 'Fallo — pero el intento cuenta.',
		dice_retry_success: 'Tu facción avanza.'
	}
};

const PRESETS: Record<string, EventCopy> = {
	gamescon: GAMESCON_COPY,
	neutral: NEUTRAL_COPY
};

function isPlainObject(v: unknown): v is Record<string, any> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Mezcla profunda solo de objetos planos: arrays y primitivos del override
// reemplazan por completo (una lista de actos o hitos no se "fusiona" ítem a
// ítem). `null` explícito en el override apaga una sección del preset (p.ej.
// `onboarding: null`).
function deepMerge<T>(base: T, override: any): T {
	if (!isPlainObject(override)) return base;
	const out: any = isPlainObject(base) ? { ...base } : {};
	for (const [k, v] of Object.entries(override)) {
		const b = (base as any)?.[k];
		out[k] = isPlainObject(v) && isPlainObject(b) ? deepMerge(b, v) : v;
	}
	return out;
}

export function resolveEventCopy(event: { slug?: string; config?: any } | null | undefined): EventCopy {
	const presetKey = event?.config?.copy_preset || event?.slug || 'neutral';
	const base = PRESETS[presetKey] || NEUTRAL_COPY;
	return deepMerge(base, event?.config?.copy);
}

const DEFAULT_MISSION_TYPE_LABELS: Record<string, string> = {
	code: 'CÓDIGO',
	trivia_quiz: 'TRIVIA',
	dice_check: 'TIRADA',
	ai_prompt_challenge: 'RETO IA',
	collective_vote: 'VOTACIÓN',
	time_bomb: 'CONTRARRELOJ',
	puzzle_pieces: 'PUZZLE',
	hotspot_scan: 'EXPLORACIÓN'
};

export function missionTypeLabel(copy: EventCopy, type: string | null | undefined): string {
	if (!type) return 'MISIÓN';
	return copy.labels.mission_types[type] || DEFAULT_MISSION_TYPE_LABELS[type] || type.toUpperCase();
}

// Reemplaza `{name}` y similares en plantillas cortas del lexicón.
export function fillTemplate(template: string, vars: Record<string, string | number | undefined>): string {
	return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

// Tema visual por evento (`config.theme`): variables CSS que la pantalla del
// jugador ya consume con su valor por defecto (--accent, --panel-rgb,
// --bg-app, ...) y una fuente opcional de Google Fonts para los títulos.
// Sin `config.theme`, la pantalla se ve exactamente como siempre.
//
//   "theme": {
//     "vars": { "--accent": "#f59e0b", "--accent-rgb": "245, 158, 11" },
//     "google_font": "Cinzel:wght@600;800",
//     "font_display": "'Cinzel', serif"
//   }
const CSS_VAR_NAME = /^--[a-z0-9-]+$/;
const UNSAFE_CSS_VALUE = /[<>{};]/;

export function resolveEventTheme(event: { config?: any } | null | undefined): {
	css: string;
	fontHref: string | null;
} {
	const theme = event?.config?.theme;
	if (!theme || typeof theme !== 'object') return { css: '', fontHref: null };

	const declarations: string[] = [];
	for (const [name, value] of Object.entries(theme.vars || {})) {
		if (typeof value !== 'string' || !CSS_VAR_NAME.test(name) || UNSAFE_CSS_VALUE.test(value)) continue;
		declarations.push(`${name}: ${value};`);
	}
	if (typeof theme.font_display === 'string' && !UNSAFE_CSS_VALUE.test(theme.font_display)) {
		declarations.push(`--font-display: ${theme.font_display};`);
	}

	const family = typeof theme.google_font === 'string' ? theme.google_font.trim() : '';
	const fontHref = family && /^[A-Za-z0-9 :;@,.+]+$/.test(family)
		? `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}&display=swap`
		: null;

	return { css: declarations.length ? `:root { ${declarations.join(' ')} }` : '', fontHref };
}

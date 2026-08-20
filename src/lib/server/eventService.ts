import { supabaseServer, supabaseRealtime } from './supabaseClient';
import { dev } from '$app/environment';
import { evaluateAiPromptChallenge, AI_PROMPT_FALLBACK_FEEDBACK, AI_PROMPT_FALLBACK_XP } from './giocchiService';
import { trackAnalyticsEvent } from './analyticsService';

/**
 * Sirve contenido de ejemplo SOLO en desarrollo local cuando Supabase no responde
 * o no tiene datos para el evento consultado. En producción nunca se sustituye
 * contenido real por lore de otro evento: se registra un error visible y se
 * devuelve un valor vacío/neutral para que el fallo sea detectable en vez de
 * quedar enmascarado por datos falsos.
 */
function fallbackContent<T>(context: string, mockValue: T, emptyValue: T): T {
	if (dev) {
		console.warn(`[eventService] (dev) Sin datos reales de Supabase para "${context}"; usando contenido de ejemplo.`);
		return mockValue;
	}
	console.error(`[eventService] Supabase no devolvió datos reales para "${context}" en producción. No se sirve contenido de ejemplo.`);
	return emptyValue;
}

// Elimina el flag `correct` de las opciones de trivia_quiz antes de exponerlas
// al cliente (SSR + fetch); el resto de tipos de misión viaja sin cambios.
function sanitizeMechanicForClient(missionType: string, mechanic: any): any {
	const mech = mechanic || {};
	if (missionType === 'trivia_quiz' && Array.isArray(mech.options)) {
		return {
			...mech,
			options: mech.options.map((o: any) => ({ id: o.id, text: o.text }))
		};
	}
	return mech;
}

// Fallo de INFRAESTRUCTURA (Supabase/red inalcanzable), distinto de un fallo
// de VALIDACIÓN (código inválido, misión ya completada, etc.). Los endpoints
// atrapan este tipo específico para responder con un mensaje honesto en vez
// de dejar que el jugador crea que el error es suyo — ver docs/audits.
export class SystemUnavailableError extends Error {
	constructor(message = 'El sistema central no está disponible en este momento.') {
		super(message);
		this.name = 'SystemUnavailableError';
	}
}

// Mensaje único y honesto para cualquier fallo de infraestructura durante una
// acción del jugador (canjear código, resolver misión, votar, unirse). Nunca
// debe reemplazarse por un mensaje de validación ("código incorrecto", etc.)
// — esa es precisamente la confusión que este mensaje existe para evitar.
export const SYSTEM_ERROR_MESSAGE =
	'Cipher perdió la señal con el sistema central por un instante — no es tu código ni tu respuesta, es la conexión. Espera unos segundos y vuelve a intentarlo; tu progreso está a salvo.';

// Escapa HTML antes de guardar texto libre del jugador en el Journal, que se
// renderiza con {@html ...} en el frontend — sin esto, un jugador podría
// inyectar markup/scripts en su propia Bitácora (Fase 2, ai_prompt_challenge).
function escapeHtml(input: string): string {
	return input
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

// Memoria volátil para desarrollo local si Supabase no está conectado
const memoryStore = {
	users: new Map<string, { id: string; email: string; full_name?: string }>(),
	eventAvatars: new Map<string, any>(),
	demoEventPoints: 140,
	factionPoints: {
		faction_hackers: 1250,
		faction_resistencia: 980,
		fac_aprendizaje_activo: 13,
		fac_impacto_valor: 0,
		fac_agilidad_autonomia: 0
	} as Record<string, number>,
	// Última facción #1 conocida por evento, para detectar cambios de
	// delantera (ver checkFactionLeadChange) — se resetea en cada reinicio
	// del servidor, mismo nivel de riesgo aceptado que el resto de
	// memoryStore; en el peor caso, un cambio de líder no se anuncia una vez
	// tras un reinicio, nunca se anuncia uno falso.
	factionLeaders: new Map<string, string>()
};

export async function getEventBySlug(slug: string) {
	let queryFailed = false;
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_events')
			.select('*')
			.eq('slug', slug)
			.maybeSingle();

		if (data) return data;
		if (error) {
			console.error(`[eventService] Error consultando Supabase en getEventBySlug("${slug}"):`, error);
			queryFailed = true;
		}
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getEventBySlug("${slug}"):`, e);
		queryFailed = true;
	}

	// Un jugador ya está DENTRO de la app cuando dispara una acción sobre este
	// evento — si la consulta falló de verdad (no "no existe", sino "no se
	// pudo preguntar"), es un problema de infraestructura, no de que el
	// evento haya dejado de existir a mitad de la sesión. Esto es honesto en
	// CUALQUIER entorno (no solo producción) — el único caso donde seguimos
	// sirviendo contenido de ejemplo en vez de fallar es el evento demo en
	// desarrollo local, por conveniencia, y solo para ESE slug específico.
	if (queryFailed && !(dev && slug === 'demo')) {
		throw new SystemUnavailableError();
	}

	if (slug === 'demo') {
		return fallbackContent(
			`getEventBySlug("${slug}")`,
			{
				id: '00000000-0000-0000-0000-000000000001',
				slug: 'demo',
				title: 'CyberCon 2026 Demo',
				description: 'Evento interactivo de prueba para demostrar las mecánicas de Eventgage.',
				current_chapter: 1,
				config: {}
			},
			null
		);
	}
	return null;
}

export async function getEventFactionsAndAvatars(eventId: string) {
	try {
		const [factionsRes, avatarsRes] = await Promise.all([
			supabaseServer.from('eventgage_event_factions').select('*').eq('event_id', eventId),
			supabaseServer.from('eventgage_event_avatars').select('*').eq('event_id', eventId)
		]);

		if (factionsRes.data?.length && avatarsRes.data?.length) {
			return {
				factions: factionsRes.data,
				avatars: avatarsRes.data
			};
		}
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getEventFactionsAndAvatars("${eventId}"):`, e);
	}

	// Mock Fallback con Clases de Juego y variantes de género (Gamescon / desarrollo local)
	return fallbackContent(
		`getEventFactionsAndAvatars("${eventId}")`,
		{
		factions: [
			{
				id: 'fac_aprendizaje_activo',
				name: 'División de Aprendizaje Activo',
				description: 'Foco: Aprendizaje Organizacional, Formación Ejecutiva y Retención de Conocimiento. Antagonista: El Sabotaje del Formulario Invisible.',
				faction_points: memoryStore.factionPoints.fac_aprendizaje_activo ?? 15,
				icon_url: '/images/gamescon/factions/fac_aprendizaje_activo.jpg'
			},
			{
				id: 'fac_impacto_valor',
				name: 'División de Impacto & Valor',
				description: 'Foco: Posicionamiento, Branding y Lealtad B2B. Antagonista: El Sabotaje de la Medalla Vacía.',
				faction_points: memoryStore.factionPoints.fac_impacto_valor ?? 0,
				icon_url: '/images/gamescon/factions/fac_impacto_valor.jpg'
			},
			{
				id: 'fac_agilidad_autonomia',
				name: 'División de Agilidad & Autonomía',
				description: 'Foco: Transformación Organizacional, Agilidad y Desarrollo de Producto/Procesos. Antagonista: El Sabotaje de la Parálisis Creativa.',
				faction_points: memoryStore.factionPoints.fac_agilidad_autonomia ?? 0,
				icon_url: '/images/gamescon/factions/fac_agilidad_autonomia.jpg'
			}
		],
		avatars: [
			{
				id: 'avatar_disenador_conductual',
				name: 'El Diseñador Conductual (Behavioral Designer)',
				description: 'Orientado a la ciencia del comportamiento, análisis de datos y medición de engagement.',
				image_url: '/images/gamescon/avatars/avatar_disenador_m.jpg',
				image_url_m: '/images/gamescon/avatars/avatar_disenador_m.jpg',
				image_url_f: '/images/gamescon/avatars/avatar_disenador_f.jpg',
				default_sp: { ANA: 18, EST: 14, DIS: 10, FAC: 9 },
				default_cp: { points: 0, icon: '💠' },
				default_dp: { misiones_resueltas: 0 }
			},
			{
				id: 'avatar_arquitecto_experiencias',
				name: 'El Arquitecto de Experiencias (Experience Architect)',
				description: 'Enfocado en narrativa, creatividad lúdica y diseño de interfaces de aprendizaje.',
				image_url: '/images/gamescon/avatars/avatar_arquitecto_m.jpg',
				image_url_m: '/images/gamescon/avatars/avatar_arquitecto_m.jpg',
				image_url_f: '/images/gamescon/avatars/avatar_arquitecto_f.jpg',
				default_sp: { DIS: 18, ANA: 13, EST: 11, FAC: 9 },
				default_cp: { points: 0, icon: '💠' },
				default_dp: { misiones_resueltas: 0 }
			},
			{
				id: 'avatar_facilitador_sistemico',
				name: 'El Facilitador Sistémico (Systemic Facilitator)',
				description: 'Centrado en gestión del cambio humano, dinamización de equipos y networking.',
				image_url: '/images/gamescon/avatars/avatar_facilitador_m.jpg',
				image_url_m: '/images/gamescon/avatars/avatar_facilitador_m.jpg',
				image_url_f: '/images/gamescon/avatars/avatar_facilitador_f.jpg',
				default_sp: { FAC: 18, EST: 14, DIS: 11, ANA: 8 },
				default_cp: { points: 0, icon: '💠' },
				default_dp: { misiones_resueltas: 0 }
			},
			{
				id: 'avatar_director_estrategico',
				name: 'El Director Estratégico (Strategic Director)',
				description: 'Enfocado en ROI, alineación con objetivos del negocio/universidad y visión global.',
				image_url: '/images/gamescon/avatars/avatar_director_m.jpg',
				image_url_m: '/images/gamescon/avatars/avatar_director_m.jpg',
				image_url_f: '/images/gamescon/avatars/avatar_director_f.jpg',
				default_sp: { EST: 18, ANA: 15, DIS: 10, FAC: 8 },
				default_cp: { points: 0, icon: '💠' },
				default_dp: { misiones_resueltas: 0 }
			}
		]
		},
		{ factions: [], avatars: [] }
	);
}

export async function getEventMissions(eventId: string) {
	try {
		const { data } = await supabaseServer
			.from('eventgage_event_missions')
			.select('*')
			.eq('event_id', eventId)
			.order('chapter', { ascending: true })
			.order('created_at', { ascending: true });

		if (data && data.length > 0) {
			return data.map((m: any) => ({
				id: m.id,
				title: m.title,
				type: m.mission_type,
				preview: m.preview || m.description,
				description: m.description,
				image: m.image,
				background: m.background,
				chapter: m.chapter || 1,
				public: m.public !== false,
				unlocks_mission: m.unlocks_mission,
				time_limit_seconds: m.time_limit_seconds,
				cp_cost: m.cp_cost || 0,
				cp_bet: m.cp_bet || 0,
				// Para trivia_quiz se elimina el flag `correct` de cada opción antes de
				// mandarla al cliente: esta lista viaja al navegador (SSR + fetch), así
				// que dejar la respuesta correcta ahí sería un cheat trivial vía devtools.
				mechanic: sanitizeMechanicForClient(m.mission_type, m.mechanic),
				xp: m.mechanic?.rewards?.xp || m.mechanic?.success_rewards?.xp || 150,
				cp: m.mechanic?.rewards?.cp || m.mechanic?.success_rewards?.cp || 50,
				options: sanitizeMechanicForClient(m.mission_type, m.mechanic)?.options || []
			}));
		}
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getEventMissions("${eventId}"):`, e);
	}

	return fallbackContent(
		`getEventMissions("${eventId}")`,
		[
		{
			id: 'm_code_01',
			title: 'El Código de la Red',
			type: 'code',
			preview: 'Descifra el código oculto impreso en el mapa o señalización del evento.',
			description: 'Encuentra el código impreso en el mapa táctico o en los banners del evento. Código de prueba disponible: DEMO2026',
			chapter: 1,
			public: true,
			unlocks_mission: 'm_time_bomb_01',
			xp: 150,
			cp: 50,
			mechanic: { valid_codes: ['DEMO2026', 'CYBER_DEMO'] }
		},
		{
			id: 'm_time_bomb_01',
			title: 'Desactivación Contrarreloj (Time-Bomb)',
			type: 'time_bomb',
			preview: '¡Alerta! Neutraliza la bomba de datos antes de que expire el temporizador.',
			description: 'La IA enemiga está infectando el servidor. Introduce la clave DISABLE_99 antes de que expire el tiempo.',
			chapter: 1,
			public: false,
			time_limit_seconds: 600,
			xp: 250,
			cp: 100,
			mechanic: { target_code: 'DISABLE_99' }
		},
		{
			id: 'm_vote_01',
			title: 'Votación Táctica: Estrategia de Facción',
			type: 'collective_vote',
			preview: 'Elige el siguiente sector a inspeccionar por tu facción.',
			description: 'Tus votos guiarán el avance de tu bando y la apertura del siguiente capítulo.',
			chapter: 1,
			public: true,
			xp: 100,
			cp: 30,
			options: [
				{ id: 'sec_a', text: 'Zona A: Stand de Robótica' },
				{ id: 'sec_b', text: 'Zona B: Escenario Principal' }
			],
			mechanic: { options: [{ id: 'sec_a', text: 'Zona A: Stand de Robótica' }, { id: 'sec_b', text: 'Zona B: Escenario Principal' }] }
		}
		],
		[]
	);
}

export async function getEventItems(eventId: string) {
	try {
		const { data } = await supabaseServer
			.from('eventgage_event_items')
			.select('*')
			.eq('event_id', eventId);

		if (data && data.length > 0) return data;
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getEventItems("${eventId}"):`, e);
	}

	return fallbackContent(
		`getEventItems("${eventId}")`,
		[
		{
			id: 'item_audio_log_1',
			name: 'Registro de Transmisión 01',
			description: 'Audio interceptado en las inmediaciones del Stand 7.',
			image_url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=400&auto=format&fit=crop&q=80',
			media_type: 'audio',
			media_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
			is_public: false
		},
		{
			id: 'item_relic_alpha',
			name: 'Chip de Memoria Alpha',
			description: 'Objeto único con esquemas tácticos filtrados durante la Convención CyberCon.',
			image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&auto=format&fit=crop&q=80',
			media_type: 'image',
			media_url: null,
			is_public: true
		}
		],
		[]
	);
}

// Sin fallback de ejemplo (3.10 del informe UX): a diferencia del resto de
// getEvent*, un mapa o una alerta de OTRO evento (CyberCon) no es un dato de
// ejemplo neutral — es lore concreto y visible de una convención que no es
// esta, y no hay forma de generarlo "genérico". Si Supabase no tiene datos
// reales, la respuesta es la misma en cualquier entorno: lista vacía: el
// cliente ya sabe mostrar un estado honesto de "sin mapa"/"sin alertas" en
// vez de inventar contenido.
export async function getEventMaps(eventId: string) {
	try {
		const { data } = await supabaseServer
			.from('eventgage_event_maps')
			.select('*')
			.eq('event_id', eventId);

		if (data && data.length > 0) return data;
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getEventMaps("${eventId}"):`, e);
	}

	return [];
}

export async function getEventAlerts(eventId: string) {
	try {
		const { data } = await supabaseServer
			.from('eventgage_event_alerts')
			.select('*')
			.eq('event_id', eventId)
			.order('scheduled_at', { ascending: false });

		if (data && data.length > 0) {
			const { data: chars } = await supabaseServer
				.from('eventgage_event_characters')
				.select('*')
				.eq('event_id', eventId);
			const charMap = new Map((chars || []).map((c: any) => [c.id, c]));

			return data.map((a: any) => {
				const char = a.character_id ? charMap.get(a.character_id) : null;
				return {
					...a,
					speaker_name: char?.name || a.title || 'Game Master',
					portrait_url: char?.portrait_url || a.media_url || null
				};
			});
		}
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getEventAlerts("${eventId}"):`, e);
	}

	return [];
}

// Catálogo de la Bóveda de Inteligencia (sección 9.3 del GDD). Sin fallback
// de ejemplo, mismo criterio que getEventMaps/getEventAlerts: si Supabase no
// tiene filas reales, lista vacía en cualquier entorno.
//
// `rew_pista_cipher` ("Radar de Cipher") se excluye a propósito (decisión de
// Javier, 2026-08-17): promete una "pista de ubicación de código", pero no
// existe ningún dato real de ubicación física en el modelo — ni por misión,
// ni por código, y el mapa real de Gamescon tampoco existe todavía (3.10 del
// informe UX). No hay nada honesto que ese ítem pudiera revelar hoy, así que
// se saca del catálogo activo en vez de venderlo sin efecto o inventar una
// "pista" falsa.
export async function getEventRewards(eventId: string) {
	try {
		const { data } = await supabaseServer
			.from('eventgage_event_rewards')
			.select('*')
			.eq('event_id', eventId);

		if (data && data.length > 0) {
			return data
				.filter((r: any) => r.id !== 'rew_pista_cipher')
				.map((r: any) => ({
					...r,
					min_level: r.min_level ?? (r.id === 'rew_prime_vip_consultancy' ? 4 : 1)
				}));
		}
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getEventRewards("${eventId}"):`, e);
	}

	return [];
}

export interface EventVendor {
	id: string;
	event_id: string;
	name: string;
	tagline?: string;
	description?: string;
	contact_name: string;
	linkedin_url?: string;
	phone?: string;
	website_url?: string;
	logo_url: string;
	tier?: 'organizer' | 'sponsor' | 'partner' | string;
	order_index: number;
	is_active?: boolean;
}

const defaultGamesconVendors: EventVendor[] = [
	{
		id: 'vendor_f2p',
		event_id: 'b8ea6358-ab3c-40c8-baef-0f7107716460',
		name: 'Free to Play',
		tagline: 'Especialistas en Gamificación para Aprendizaje',
		description: 'Consultoría estratégica y diseño de experiencias lúdicas formativas de alto impacto.',
		contact_name: 'Javier Velásquez',
		linkedin_url: 'https://www.linkedin.com/in/javier-velasquez-game/',
		logo_url: '/images/gamescon/banners/f2p.png',
		tier: 'organizer',
		order_index: 1,
		is_active: true
	},
	{
		id: 'vendor_prime',
		event_id: 'b8ea6358-ab3c-40c8-baef-0f7107716460',
		name: 'Prime Business School',
		tagline: 'Escuela de negocios con programas de gamificación',
		description: 'Formación ejecutiva y programas avanzados en metodologías de innovación y lúdica corporativa.',
		contact_name: 'Eduardo Guacaneme',
		linkedin_url: 'https://www.linkedin.com/in/ramon-guacaneme/',
		logo_url: '/images/gamescon/banners/logoPrime.jpg',
		tier: 'partner',
		order_index: 2,
		is_active: true
	},
	{
		id: 'vendor_play4agile',
		event_id: 'b8ea6358-ab3c-40c8-baef-0f7107716460',
		name: 'Play4Agilie',
		tagline: 'Unimos Agilismo con juego en organizaciones',
		description: 'Transformación cultural, marcos ágiles y dinámicas de gamificación para equipos de alto desempeño.',
		contact_name: 'Fabián Dulcé',
		linkedin_url: 'https://www.linkedin.com/in/fabiandulce/',
		logo_url: '/images/gamescon/banners/play4agile.jpeg',
		tier: 'partner',
		order_index: 3,
		is_active: true
	},
	{
		id: 'vendor_wakeupbrain',
		event_id: 'b8ea6358-ab3c-40c8-baef-0f7107716460',
		name: 'WakeUpBrain',
		tagline: 'Unimos Innovación y Sostenibilidad con Lúdica',
		description: 'Metodología y juegos de aceleración para la resolución creativa de problemas e innovación sostenible.',
		contact_name: 'Guillermo Solano',
		linkedin_url: 'https://www.linkedin.com/in/solanobrainer/',
		logo_url: '/images/gamescon/banners/wakeupbrain.png',
		tier: 'partner',
		order_index: 4,
		is_active: true
	}
];

export async function getEventVendors(eventId: string): Promise<EventVendor[]> {
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_event_vendors')
			.select('*')
			.eq('event_id', eventId)
			.eq('is_active', true)
			.order('order_index', { ascending: true })
			.order('created_at', { ascending: true });

		if (!error && data && data.length > 0) {
			return data as EventVendor[];
		}
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getEventVendors("${eventId}"):`, e);
	}

	// Fallback local con los 4 sponsors ordenados
	return defaultGamesconVendors.map(v => ({ ...v, event_id: eventId }));
}

export interface EventLevel {
	id: string;
	event_id: string;
	level: number;
	xp_required: number;
	title: string;
	unlocks?: Record<string, any>;
}

export async function getEventLevels(eventId: string): Promise<EventLevel[]> {
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_event_levels')
			.select('*')
			.eq('event_id', eventId)
			.order('level', { ascending: true });

		if (error) {
			console.error(`[eventService] Error consultando Supabase en getEventLevels("${eventId}"):`, error);
			return [];
		}

		if (data && data.length > 0) {
			return data;
		}
	} catch (e) {
		console.error(`[eventService] Excepción en getEventLevels("${eventId}"):`, e);
	}

	return [];
}

export async function getEventDialogues(eventId: string) {
	try {
		const { data } = await supabaseServer
			.from('eventgage_event_dialogues')
			.select('*')
			.eq('event_id', eventId)
			.order('scheduled_at', { ascending: false });

		if (data && data.length > 0) {
			const { data: chars } = await supabaseServer
				.from('eventgage_event_characters')
				.select('*')
				.eq('event_id', eventId);
			const charMap = new Map((chars || []).map((c: any) => [c.id, c]));

			return data.map((d: any) => {
				const char = d.character_id ? charMap.get(d.character_id) : null;
				const firstLine = Array.isArray(d.lines) ? d.lines[0] : d.lines;
				const lineText = typeof firstLine === 'object' ? firstLine?.text : firstLine;
				const lineSpeaker = typeof firstLine === 'object' ? firstLine?.speaker_name : null;

				return {
					id: d.id,
					title: d.title,
					speaker_name: char?.name || lineSpeaker || 'Enlace de Red',
					portrait_url: char?.portrait_url || null,
					text: lineText || 'Sin mensaje disponible.'
				};
			});
		}
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getEventDialogues("${eventId}"):`, e);
	}

	return [];
}

// Sin fallback de ejemplo (mismo criterio que 3.10 del informe UX en
// getEventMaps/getEventAlerts): "AMENAZA IA (GLOBAL)" nunca fue un nombre del
// GDD, era lore de la demo de CyberCon filtrándose a cualquier evento sin fila
// propia en `eventgage_event_points` — el GDD de Gamescon llama a este
// puntaje "Inercia Global" (sección 1.3.3 de gamescon.md). Gamescon no tiene
// fila sembrada a propósito: el valor inicial depende de una fórmula dinámica
// (Registrados × 3) que todavía no existe en el backend (ver el seed). Sin
// fallback, el cliente cae en su propio estado "Sin datos" ya construido, en
// vez de mostrar un número y un nombre inventados como si fueran reales.
export async function getEventPoints(eventId: string) {
	try {
		const { data } = await supabaseServer
			.from('eventgage_event_points')
			.select('*')
			.eq('event_id', eventId);

		if (data && data.length > 0) return data[0];
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getEventPoints("${eventId}"):`, e);
	}

	return null;
}

// Facciones + puntaje mundial (Inercia Global), la pareja de datos que
// cambia con cualquier acción del jugador y que el HUD necesita mantener al
// día — usado tanto para adjuntar estado fresco tras una acción (1.3 del
// informe UX) como para el botón de refresh manual del panel de Gremios.
export async function getWorldState(eventId: string) {
	const [factionsRes, eventPoints] = await Promise.all([
		supabaseServer.from('eventgage_event_factions').select('*').eq('event_id', eventId),
		getEventPoints(eventId)
	]);
	return {
		factions: factionsRes.data?.length ? factionsRes.data : null,
		eventPoints: eventPoints || null
	};
}

// Adjunta el estado mundial fresco a la respuesta de una acción de jugador
// exitosa, para que el HUD se actualice de inmediato sin esperar una recarga
// de página ni un segundo round-trip al servidor — hallazgo 1.3 del informe
// UX. Best-effort: si falla, la acción ya se persistió igual, así que no se
// descarta la respuesta por esto.
async function attachWorldState(eventId: string, result: any) {
	if (!result?.success) return result;
	try {
		const { factions, eventPoints } = await getWorldState(eventId);
		if (factions) result.factions = factions;
		if (eventPoints) result.eventPoints = eventPoints;
	} catch (e) {
		console.warn(`[eventService] No se pudo adjuntar estado mundial fresco tras la acción en "${eventId}":`, e);
	}
	return result;
}

export async function getPlayerAvatar(userId: string, eventId: string) {
	let queryFailed = false;
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_event_avatar')
			.select('*')
			.eq('user_id', userId)
			.eq('event_id', eventId)
			.maybeSingle();

		if (data) return data;
		if (error) {
			console.error(`[eventService] Error consultando Supabase en getPlayerAvatar("${userId}","${eventId}"):`, error);
			queryFailed = true;
		}
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getPlayerAvatar("${userId}","${eventId}"):`, e);
		queryFailed = true;
	}

	// Si hay un registro real cacheado de una escritura previa, es válido
	// servirlo en cualquier entorno (es dato real del jugador, no relleno).
	const key = `${userId}_${eventId}`;
	let cached = memoryStore.eventAvatars.get(key);
	if (cached) {
		// Si el avatar tiene una imagen vieja de Unsplash o ruta rota, auto-sincronizarla
		if (cached.avatar?.image_url && (cached.avatar.image_url.includes('unsplash.com') || !cached.avatar.image_url.startsWith('/images/'))) {
			const isFemale = cached.avatar.gender === 'female';
			cached.avatar.image_url = isFemale
				? '/images/gamescon/avatars/avatar_disenador_f.jpg'
				: '/images/gamescon/avatars/avatar_disenador_m.jpg';
		}
		return cached;
	}

	// Sin caché y la consulta falló de verdad: no fingimos "no tienes avatar
	// todavía" (eso dispara mensajes como "Debes unirte al evento..." que
	// culpan al jugador por un problema que es de infraestructura), en
	// ningún entorno — esto es sobre honestidad del mensaje, no sobre lore.
	if (queryFailed) {
		throw new SystemUnavailableError();
	}

	return null;
}

// Roster de un gremio para la pantalla de detalle (click en el nombre de
// facción en el HUD). Se trae a todos los avatares del evento y se filtra en
// JS por `faction_id` (vive dentro del jsonb `avatar`, no es una columna) —
// el volumen esperado (decenas de jugadores por evento) no justifica un
// operador jsonb de PostgREST solo para esta pantalla.
export async function getFactionMembers(eventId: string, factionId: string) {
	try {
		const [membersRes, eventLevels] = await Promise.all([
			supabaseServer.from('eventgage_event_avatar').select('avatar').eq('event_id', eventId),
			getEventLevels(eventId)
		]);

		if (membersRes.error) {
			console.error(`[eventService] Error consultando Supabase en getFactionMembers("${eventId}","${factionId}"):`, membersRes.error);
			return [];
		}

		return (membersRes.data || [])
			.map((row: any) => row.avatar || {})
			.filter((a: any) => a.faction_id === factionId)
			.map((a: any) => ({
				name: a.name || 'Agente',
				image_url: a.image_url || null,
				level: a.xp?.level ?? calculateLevel(a.xp?.points ?? 0, eventLevels),
				xp: a.xp?.points ?? 0,
				rank_title: a.rank_title || null
			}))
			.sort((a: any, b: any) => b.xp - a.xp);
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getFactionMembers("${eventId}","${factionId}"):`, e);
		return [];
	}
}

// "Precedencia de honor" (GDD sección 11.1, punto 3 — Firma del Tratado
// Huizinga): los agentes que obtuvieron la Llave PRIME (Hito 6, Rango 3) o
// el Rango Master (Hito 12, Rango 5) se despliegan en el bloque superior de
// la pantalla gigante. La Llave PRIME es un ítem permanente (nunca se
// retira al subir de rango), así que Rango 3, 4 y 5 califican por igual —
// basta con `rank >= 3`, no hace falta distinguir el ítem del rango actual.
export async function getHighRankPlayers(eventId: string) {
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_event_avatar')
			.select('avatar')
			.eq('event_id', eventId);

		if (error) {
			console.error(`[eventService] Error consultando Supabase en getHighRankPlayers("${eventId}"):`, error);
			return [];
		}

		return (data || [])
			.map((row: any) => row.avatar || {})
			.filter((a: any) => typeof a.rank === 'number' && (a.rank >= 3))
			.map((a: any) => ({
				name: a.name || 'Agente',
				faction_id: a.faction_id,
				rank: a.rank,
				rank_title: a.rank_title || null,
				xp: a.xp?.points ?? 0
			}))
			.sort((a: any, b: any) => (b.rank - a.rank) || (b.xp - a.xp));
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getHighRankPlayers("${eventId}"):`, e);
		return [];
	}
}

// Firma del Tratado Huizinga (GDD 11.1, punto 3). Requiere avatar/jugador ya
// registrado — el mismo requisito narrativo que el resto de mecánicas
// (`submitCodeForPlayer` etc.). Idempotente: firmar dos veces no es un error,
// solo confirma que ya estaba firmado (misma convención que redeemed_codes).
export async function signTreaty(userId: string, eventId: string) {
	try {
		const player = await getPlayerAvatar(userId, eventId);
		if (!player) {
			return { success: false, message: 'Debes registrar tu avatar en la Agencia antes de firmar el Tratado, Agente.' };
		}

		const { data: existing } = await supabaseServer
			.from('eventgage_event_signatures')
			.select('id')
			.eq('event_id', eventId)
			.eq('user_id', userId)
			.maybeSingle();

		if (existing) {
			return { success: true, alreadySigned: true };
		}

		const { error } = await supabaseServer
			.from('eventgage_event_signatures')
			.insert({ event_id: eventId, user_id: userId });

		if (error) {
			console.error('[eventService] Error guardando firma del Tratado:', error);
			return { success: false, message: 'La Agencia no pudo registrar tu firma en este intento. Vuelve a intentarlo.' };
		}

		await broadcastEventActivity(eventId, 'treaty_signed', {
			playerName: player.avatar?.name || 'Un agente'
		});

		trackAnalyticsEvent(eventId, userId, 'treaty_signed', 'social', {
			faction_id: player.avatar?.faction_id,
			rank: player.avatar?.rank || 1
		});

		return { success: true, alreadySigned: false };
	} catch (e) {
		console.error('[eventService] Error crítico en signTreaty:', e);
		return { success: false, message: 'La Agencia no pudo registrar tu firma en este intento. Vuelve a intentarlo.' };
	}
}

export async function hasSignedTreaty(userId: string, eventId: string): Promise<boolean> {
	const { data } = await supabaseServer
		.from('eventgage_event_signatures')
		.select('id')
		.eq('event_id', eventId)
		.eq('user_id', userId)
		.maybeSingle();
	return !!data;
}

// Lista de firmantes para el tablero de pantalla gigante, con precedencia de
// honor: Llave PRIME (rank >= 3) o Rango Master primero, luego orden
// cronológico de firma — mismo criterio de precedencia que getHighRankPlayers.
export async function getTreatySignatures(eventId: string) {
	try {
		const [signaturesRes, avatarsRes] = await Promise.all([
			supabaseServer
				.from('eventgage_event_signatures')
				.select('user_id, signed_at')
				.eq('event_id', eventId)
				.order('signed_at', { ascending: true }),
			supabaseServer.from('eventgage_event_avatar').select('user_id, avatar').eq('event_id', eventId)
		]);

		if (signaturesRes.error) {
			console.error('[eventService] Error consultando getTreatySignatures:', signaturesRes.error);
			return { count: 0, signatures: [] };
		}

		const avatarByUser = new Map(
			(avatarsRes.data || []).map((row: any) => [row.user_id, row.avatar || {}])
		);

		const signatures = (signaturesRes.data || []).map((sig: any) => {
			const a: any = avatarByUser.get(sig.user_id) || {};
			return {
				name: a.name || 'Agente',
				faction_id: a.faction_id || null,
				rank: a.rank ?? 0,
				signed_at: sig.signed_at
			};
		});

		signatures.sort((a: any, b: any) => {
			const aPrecedence = a.rank >= 3 ? 1 : 0;
			const bPrecedence = b.rank >= 3 ? 1 : 0;
			if (aPrecedence !== bPrecedence) return bPrecedence - aPrecedence;
			return new Date(a.signed_at).getTime() - new Date(b.signed_at).getTime();
		});

		return { count: signatures.length, signatures };
	} catch (e) {
		console.error('[eventService] Error crítico en getTreatySignatures:', e);
		return { count: 0, signatures: [] };
	}
}

export async function createPlayerAvatar(
	userId: string,
	eventId: string,
	avatarChoiceId: string,
	factionId: string,
	gender: 'male' | 'female' = 'male',
	userName: string = 'Agente'
) {
	const { avatars } = await getEventFactionsAndAvatars(eventId);
	const selectedTemplate = avatars.find((a: any) => a.id === avatarChoiceId) || avatars[0];

	const selectedImageUrl = gender === 'female'
		? (selectedTemplate.image_url_f || selectedTemplate.image_url)
		: (selectedTemplate.image_url_m || selectedTemplate.image_url);

	const initialAvatarObj = {
		avatar_id: selectedTemplate.id,
		class_name: selectedTemplate.name,
		faction_id: factionId,
		name: userName, // El jugador conserva el nombre introducido en su registro/login
		gender: gender,
		image_url: selectedImageUrl,
		xp: { points: 0, level: 1 },
		sp: selectedTemplate.default_sp || { hackeo: 10, percepcion: 10, sigilo: 10 },
		cp: selectedTemplate.default_cp || { points: 100, icon: '⚡' },
		dp: selectedTemplate.default_dp || { misiones_resueltas: 0 },
		// Rango 1 (Recluta de la Red) por defecto — ver sección 1.3.4 del diseño.
		rank: 1,
		rank_title: 'Recluta de la Red'
	};

	const initialStatusObj = {
		viewed_dialogues: [],
		journal: [],
		unlocked_items: [],
		unlocked_missions: ['m_code_01'],
		completed_missions: [],
		current_mission_id: 'm_code_01',
		redeemed_codes: [],
		milestones_claimed: [],
		narrative_seen: false
	};

	let dbData: any = null;
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_event_avatar')
			.upsert(
				{
					user_id: userId,
					event_id: eventId,
					avatar: initialAvatarObj,
					game_status: initialStatusObj,
					settings: { sound: true }
				},
				{ onConflict: 'user_id,event_id' }
			)
			.select()
			.single();

		if (data) dbData = data;
		if (error) console.error('Error al insertar eventgage_event_avatar:', error);
	} catch (e) {
		console.warn('Fallback saving avatar memory:', e);
	}

	trackAnalyticsEvent(eventId, userId, 'player_joined', 'onboarding', {
		avatar_id: selectedTemplate.id,
		class_name: selectedTemplate.name,
		faction_id: factionId,
		gender: gender,
		agent_name: userName
	});

	const key = `${userId}_${eventId}`;
	const record = {
		id: crypto.randomUUID(),
		user_id: userId,
		event_id: eventId,
		avatar: initialAvatarObj,
		game_status: initialStatusObj,
		settings: { sound: true }
	};
	memoryStore.eventAvatars.set(key, record);
	return dbData || record;
}

export async function submitCodeForPlayer(userId: string, eventId: string, codeStr: string) {
	// Juego de Contactos (sección 2.18): un código con prefijo '@' es el
	// código personal de otro jugador, no un código de recinto/misión —
	// se enruta por completo a otra función, mismo campo de entrada.
	if (codeStr.trim().startsWith('@')) {
		return redeemContactCode(userId, eventId, codeStr);
	}

	const player = await getPlayerAvatar(userId, eventId);
	if (!player) {
		return { success: false, message: 'Debes unirte al evento y seleccionar un avatar antes de canjear códigos.' };
	}

	// Sincroniza expiraciones de time_bomb antes de validar el código — un
	// canje después de que el reloj llegó a 0 debe rechazarse aunque el
	// código sea correcto (ver checkExpiredTimeBombs).
	await checkExpiredTimeBombs(eventId, player);

	const cleanCode = codeStr.trim().toUpperCase();

	const updatedAvatar = { ...player.avatar };
	const updatedStatus = {
		viewed_dialogues: [],
		journal: [],
		unlocked_items: [],
		unlocked_missions: ['m_code_01'],
		completed_missions: [],
		current_mission_id: 'm_code_01',
		redeemed_codes: [],
		mission_timers: {},
		expired_missions: [],
		...(player.game_status || {})
	};

	if (!updatedStatus.journal) updatedStatus.journal = [];
	if (!updatedStatus.unlocked_items) updatedStatus.unlocked_items = [];
	if (!updatedStatus.unlocked_missions) updatedStatus.unlocked_missions = [];
	if (!updatedStatus.completed_missions) updatedStatus.completed_missions = [];
	if (!updatedStatus.redeemed_codes) updatedStatus.redeemed_codes = [];

	if (updatedStatus.redeemed_codes.includes(cleanCode)) {
		return { success: false, message: 'Cipher ya tiene registrado ese código en tu expediente, Agente — no hace falta canjearlo dos veces.' };
	}

	// 1. Intentar validar código en la tabla eventgage_event_codes de Supabase
	let matchedCodeRecord: any = null;
	try {
		const { data: codeData, error } = await supabaseServer
			.from('eventgage_event_codes')
			.select('*')
			.eq('event_id', eventId);

		if (codeData && codeData.length > 0) {
			matchedCodeRecord = codeData.find((c: any) => c.code.trim().toUpperCase() === cleanCode);
		}
		if (error) {
			console.error('[eventService] Error consultando eventgage_event_codes:', error);
			// Si no pudimos ni siquiera consultar los códigos, no podemos saber si
			// el código es válido — no es lo mismo que "código inválido".
			throw new SystemUnavailableError();
		}
	} catch (e) {
		if (e instanceof SystemUnavailableError) throw e;
		console.error('[eventService] Error consultando eventgage_event_codes:', e);
		throw new SystemUnavailableError();
	}

	// 2. Intentar validar código en las misiones (mechanic.valid_codes o mechanic.target_code)
	let matchedMissionRecord: any = null;
	const missions = await getEventMissions(eventId);
	for (const m of missions) {
		const mech = m.mechanic || {};
		if (mech.target_code && mech.target_code.trim().toUpperCase() === cleanCode) {
			matchedMissionRecord = m;
			break;
		}
		if (Array.isArray(mech.valid_codes)) {
			if (mech.valid_codes.some((vc: string) => vc.trim().toUpperCase() === cleanCode)) {
				matchedMissionRecord = m;
				break;
			}
		}
	}

	// Fallback para códigos demo si la BD no los devuelve — solo en desarrollo local.
	// En producción, un código sin respaldo real en Supabase se rechaza como inválido
	// en vez de inyectar contenido narrativo genérico ("CyberCon") en el Journal real
	// del jugador, sin importar a qué evento pertenezca.
	const isDemoFallbackCode =
		dev && (cleanCode === 'DEMO2026' || cleanCode === 'CYBER_DEMO' || cleanCode === 'DISABLE_99');

	if (!matchedCodeRecord && !matchedMissionRecord && !isDemoFallbackCode) {
		trackAnalyticsEvent(eventId, userId, 'code_failed', 'progression', {
			code: cleanCode,
			reason: 'invalid_or_expired'
		});
		return { success: false, message: 'Código inválido o expirado' };
	}

	if (matchedMissionRecord?.type === 'time_bomb' && updatedStatus.expired_missions.includes(matchedMissionRecord.id)) {
		return { success: false, message: 'El tiempo para desactivar esta misión ya expiró — la Agencia registró la falla.' };
	}

	updatedStatus.redeemed_codes.push(cleanCode);

	// Auto-limpieza: remueve directivas de campo cuyo remove_on_code coincide con el código canjeado
	if (Array.isArray(updatedStatus.unlocked_communications)) {
		updatedStatus.unlocked_communications = updatedStatus.unlocked_communications.filter(
			(comm: any) => !comm.remove_on_code || comm.remove_on_code.trim().toUpperCase() !== cleanCode
		);
	}

	// Procesar recompensas dinámicas
	let xpReward = 150;
	let cpReward = 50;
	let rewardMsg = '';
	// Ítems desbloqueados en ESTE canje — alimenta markItemsGloballyUnlocked
	// al final (fix del bug is_public, ver esa función).
	const newlyUnlockedItemIds: string[] = [];
	const newlyUnlockedMissionIds: string[] = [];

	if (matchedCodeRecord) {
		if (matchedCodeRecord.rewards?.xp) xpReward = matchedCodeRecord.rewards.xp;
		if (matchedCodeRecord.rewards?.cp) cpReward = matchedCodeRecord.rewards.cp;
		if (matchedCodeRecord.unlocks_item && !updatedStatus.unlocked_items.includes(matchedCodeRecord.unlocks_item)) {
			updatedStatus.unlocked_items.unshift(matchedCodeRecord.unlocks_item);
			newlyUnlockedItemIds.push(matchedCodeRecord.unlocks_item);
		}
		if (matchedCodeRecord.unlocks_mission && !updatedStatus.unlocked_missions.includes(matchedCodeRecord.unlocks_mission)) {
			updatedStatus.unlocked_missions.unshift(matchedCodeRecord.unlocks_mission);
			newlyUnlockedMissionIds.push(matchedCodeRecord.unlocks_mission);
		}
		rewardMsg = `¡Código ${cleanCode} canjeado con éxito! +${xpReward} XP, +${cpReward} CP.`;
	}

	if (matchedMissionRecord) {
		const mech = matchedMissionRecord.mechanic || {};
		const rewards = mech.rewards || mech.success_rewards || {};
		if (rewards.xp) xpReward = rewards.xp;
		if (rewards.cp) cpReward = rewards.cp;

		if (!updatedStatus.completed_missions.includes(matchedMissionRecord.id)) {
			updatedStatus.completed_missions.push(matchedMissionRecord.id);
		}

		if (matchedMissionRecord.unlocks_mission && !updatedStatus.unlocked_missions.includes(matchedMissionRecord.unlocks_mission)) {
			updatedStatus.unlocked_missions.unshift(matchedMissionRecord.unlocks_mission);
			newlyUnlockedMissionIds.push(matchedMissionRecord.unlocks_mission);
		}

		if (rewards.items && Array.isArray(rewards.items)) {
			for (const itemKey of rewards.items) {
				if (!updatedStatus.unlocked_items.includes(itemKey)) {
					updatedStatus.unlocked_items.unshift(itemKey);
					newlyUnlockedItemIds.push(itemKey);
				}
			}
		}

		if (rewards.journal_entry) {
			const j = rewards.journal_entry;
			const entryId = j.id || `entry_${cleanCode}`;
			if (!updatedStatus.journal.some((item: any) => item.id === entryId)) {
				updatedStatus.journal.unshift({
					id: entryId,
					title: j.title || 'Bitácora Desbloqueada',
					content_html: j.content_html || '<p>Registro clasificado interceptado.</p>'
				});
			}
		}

		rewardMsg = `¡Código de misión validado (${cleanCode})! +${xpReward} XP, +${cpReward} CP y misión "${matchedMissionRecord.title}" completada.`;
	}

	// Fallback por si era demo puro (solo en desarrollo local, ver isDemoFallbackCode arriba)
	if (dev && !rewardMsg) {
		if (cleanCode === 'DEMO2026' || cleanCode === 'CYBER_DEMO') {
			xpReward = 150;
			cpReward = 50;
			if (!updatedStatus.completed_missions.includes('m_code_01')) updatedStatus.completed_missions.push('m_code_01');
			if (!updatedStatus.unlocked_items.includes('item_audio_log_1')) updatedStatus.unlocked_items.unshift('item_audio_log_1');
			if (!updatedStatus.unlocked_missions.includes('m_time_bomb_01')) updatedStatus.unlocked_missions.unshift('m_time_bomb_01');
			if (!updatedStatus.journal.some((j: any) => j.id === 'entry_1')) {
				updatedStatus.journal.unshift({
					id: 'entry_1',
					title: 'Bitácora 01: El Inicio',
					content_html: '<p>Has ingresado al sistema principal de CyberCon. Los registros confirman la firma digital del Colectivo.</p>'
				});
			}
			rewardMsg = '¡Código DEMO2026 canjeado! +150 XP, +50 CP, Pista de Audio desbloqueada y Misión de Código completada.';
		} else if (cleanCode === 'DISABLE_99') {
			xpReward = 250;
			cpReward = 100;
			if (!updatedStatus.completed_missions.includes('m_time_bomb_01')) updatedStatus.completed_missions.push('m_time_bomb_01');
			if (!updatedStatus.journal.some((j: any) => j.id === 'entry_2')) {
				updatedStatus.journal.unshift({
					id: 'entry_2',
					title: 'Bitácora 02: Amenaza Neutralizada',
					content_html: '<p>La bomba de datos fue desactivada con éxito. El servidor local vuelve a operar de manera segura.</p>'
				});
			}
			rewardMsg = '¡Bomba de datos neutralizada (DISABLE_99)! +250 XP, +100 CP, Bitácora actualizada y Misión Contrarreloj completada.';
		}
	}

	// Sumar XP y CP
	updatedAvatar.xp = updatedAvatar.xp || { points: 0, level: 1 };
	updatedAvatar.cp = updatedAvatar.cp || { points: 100, icon: '⚡' };
	updatedAvatar.xp.points += xpReward;
	updatedAvatar.cp.points += cpReward;

	// Fase 3: Hitos por conteo total de misiones (solo si esta misión quedó
	// completada — matchedMissionRecord cubre code/time_bomb; las demás
	// mecánicas se completan y chequean hitos en applyMissionCompletion).
	let milestonesReached: any[] = [];
	if (matchedMissionRecord) {
		const milestoneList = await getEventMilestones(eventId);
		milestonesReached = checkAndApplyMilestones(updatedAvatar, updatedStatus, milestoneList);
		if (milestonesReached.length) rewardMsg = `${rewardMsg} ${formatMilestoneMessages(milestonesReached)}`;
	}

	const eventLevels = await getEventLevels(eventId);
	updatedAvatar.xp.level = calculateLevel(updatedAvatar.xp.points, eventLevels);

	// Persistir
	player.avatar = updatedAvatar;
	player.game_status = updatedStatus;

	try {
		await supabaseServer
			.from('eventgage_event_avatar')
			.update({ avatar: updatedAvatar, game_status: updatedStatus, updated_at: new Date().toISOString() })
			.eq('user_id', userId)
			.eq('event_id', eventId);
		if (newlyUnlockedItemIds.length > 0) {
			await markItemsGloballyUnlocked(eventId, newlyUnlockedItemIds);
		}
		if (milestonesReached.length > 0) {
			await broadcastMilestoneReached(eventId, updatedAvatar.name, milestonesReached);
		}
	} catch (e) {
		console.warn('Updated player in memory:', e);
	}

	trackAnalyticsEvent(eventId, userId, 'code_redeemed', 'progression', {
		code: cleanCode,
		category: matchedCodeRecord?.category || (matchedMissionRecord ? 'mission' : 'demo'),
		display_id: matchedCodeRecord?.display_id || matchedMissionRecord?.id,
		xp_awarded: xpReward,
		cp_awarded: cpReward,
		newly_unlocked_missions: newlyUnlockedMissionIds,
		newly_unlocked_items: newlyUnlockedItemIds
	});

	if (matchedMissionRecord) {
		trackAnalyticsEvent(eventId, userId, 'mission_completed', 'progression', {
			mission_id: matchedMissionRecord.id,
			mission_type: matchedMissionRecord.mission_type || matchedMissionRecord.type || 'code',
			xp_awarded: xpReward,
			cp_awarded: cpReward
		});
	}

	if (milestonesReached.length > 0) {
		for (const m of milestonesReached) {
			trackAnalyticsEvent(eventId, userId, 'milestone_reached', 'progression', {
				count: m.count,
				rank: m.rank,
				rank_title: m.rankTitle,
				sp_bonus: m.spBonus
			});
		}
	}

	const key = `${userId}_${eventId}`;
	memoryStore.eventAvatars.set(key, player);

	let newlyUnlockedMissionsData: any[] = [];
	if (newlyUnlockedMissionIds.length > 0) {
		const allMissions = await getEventMissions(eventId);
		newlyUnlockedMissionsData = allMissions.filter((m: any) => newlyUnlockedMissionIds.includes(m.id));
	}

	// milestonesReached se devuelve aparte del mensaje de texto para que el
	// cliente pueda mostrar un momento ceremonial propio (overlay de Hito),
	// separado del feedback rutinario — hallazgo 1.5 del informe UX.
	return attachWorldState(eventId, {
		milestonesReached,
		success: true,
		message: rewardMsg,
		playerState: player,
		xpReward,
		cpReward,
		newlyUnlockedMissions: newlyUnlockedMissionsData,
		newlyUnlockedItemIds
	});
}

// Compra en la Bóveda de Inteligencia (Fase 4.4, sección 9.3 del GDD).
// Best-effort (leer → validar → escribir), mismo patrón que el resto de este
// archivo (ver el comentario de incrementFactionPoints) — sin bloqueo de fila
// ni función SQL dedicada. Riesgo aceptado a escala de un evento presencial;
// decisión explícita de Javier (2026-08-17), no un descuido.
export async function purchaseReward(userId: string, eventId: string, rewardId: string) {
	const player = await getPlayerAvatar(userId, eventId);
	if (!player) {
		return { success: false, message: 'Debes unirte al evento y seleccionar un avatar antes de comprar en la Bóveda.' };
	}

	const catalog = await getEventRewards(eventId);
	const reward = catalog.find((r: any) => r.id === rewardId);
	if (!reward) {
		return { success: false, message: 'Esa recompensa no está disponible en la Bóveda.' };
	}

	const status = normalizeGameStatus(player.game_status);
	if (status.unlocked_rewards.includes(rewardId)) {
		return { success: false, message: 'Ya adquiriste esta recompensa — no hace falta comprarla dos veces.' };
	}

	const avatar = { ...player.avatar };
	avatar.cp = avatar.cp || { points: 0, icon: '💠' };
	const eventLevels = await getEventLevels(eventId);
	const requiredLevel = reward.min_level ?? (reward.id === 'rew_prime_vip_consultancy' ? 4 : 1);
	const playerLevel = avatar.xp?.level ?? calculateLevel(avatar.xp?.points ?? 0, eventLevels);
	if (playerLevel < requiredLevel) {
		return {
			success: false,
			message: `Debes estar en nivel ${requiredLevel} para adquirir esta recompensa. Tu nivel actual es ${playerLevel}.`
		};
	}

	if (avatar.cp.points < reward.cost) {
		return { success: false, message: `Te faltan Ludens para esta recompensa (necesitás ${reward.cost} 💠, tenés ${avatar.cp.points}).` };
	}

	avatar.cp.points -= reward.cost;
	status.unlocked_rewards = [...status.unlocked_rewards, rewardId];

	let vipTokenMsg = '';
	if (reward.category === 'vip_lead' && !status.vip_token) {
		status.vip_token = `PRIME-VIP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
		vipTokenMsg = ` Tu token de Consulta VIP: ${status.vip_token}.`;
	}

	player.avatar = avatar;
	player.game_status = status;
	await persistPlayerState(userId, eventId, player);

	trackAnalyticsEvent(eventId, userId, 'reward_purchased', 'economy', {
		reward_id: reward.id,
		reward_name: reward.name,
		category: reward.category,
		cost_cp: reward.cost,
		token_generated: status.vip_token || null,
		min_level: requiredLevel
	});

	return attachWorldState(eventId, {
		success: true,
		message: `Canjeaste "${reward.name}" por ${reward.cost} 💠.${vipTokenMsg}`,
		playerState: player
	});
}

// Deriva el conteo real de votos escaneando game_status.votes de todos los
// jugadores del evento — mismo patrón que getFactionMembers (línea ~568):
// sin operador jsonb dedicado en PostgREST, agregación en JS, volumen de un
// evento presencial no lo justifica. Reemplaza al `Map` en memoria que
// existía antes (con una línea base falsa hardcodeada de paso) — esa
// implementación perdía los conteos por completo si el servidor se
// reiniciaba durante la plenaria, y el marcador en pantalla gigante depende
// de esta función. La base de datos es ahora la única fuente de verdad.
export async function getVotingResults(eventId: string) {
	const missions = await getEventMissions(eventId);
	const votingMissions = missions.filter((m: any) => m.type === 'collective_vote' || m.mission_type === 'collective_vote');

	const results: Record<string, {
		missionId: string;
		title: string;
		question: string;
		totalVotes: number;
		options: Array<{ id: string; text: string; count: number; percentage: number }>;
	}> = {};

	if (votingMissions.length === 0) return results;

	let allVotes: any[] = [];
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_event_avatar')
			.select('game_status')
			.eq('event_id', eventId);
		if (error) {
			console.error(`[eventService] Error consultando Supabase en getVotingResults("${eventId}"):`, error);
		} else {
			allVotes = (data || []).map((row: any) => row.game_status?.votes || {});
		}
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getVotingResults("${eventId}"):`, e);
	}

	// Integrar avatares en memoryStore para asegurar sincronía inmediata en tiempo real
	for (const avatar of memoryStore.eventAvatars.values()) {
		if ((avatar.event_id === eventId || avatar.event_id === eventId.toString()) && avatar.game_status?.votes) {
			allVotes.push(avatar.game_status.votes);
		}
	}

	for (const m of votingMissions) {
		const mId = m.id;
		const mOptions: Array<{ id: string; text: string }> = m.options || m.mechanic?.options || [];

		const voteCounts: Record<string, number> = {};
		for (const votes of allVotes) {
			const optionId = votes?.[mId]?.option_id;
			if (optionId) voteCounts[optionId] = (voteCounts[optionId] || 0) + 1;
		}

		let total = 0;
		for (const opt of mOptions) {
			total += (voteCounts[opt.id] || 0);
		}

		const formattedOptions = mOptions.map((opt) => {
			const count = voteCounts[opt.id] || 0;
			const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
			return {
				id: opt.id,
				text: opt.text,
				count,
				percentage
			};
		});

		results[mId] = {
			missionId: mId,
			title: m.title,
			question: m.mechanic?.question || m.description || '',
			totalVotes: total,
			options: formattedOptions
		};
	}

	return results;
}

export async function submitVoteForPlayer(userId: string, eventId: string, missionId: string, optionId: string) {
	const player = await getPlayerAvatar(userId, eventId);
	if (!player) {
		return { success: false, message: 'Jugador no encontrado.' };
	}

	const updatedAvatar = { ...player.avatar };
	const updatedStatus = {
		viewed_dialogues: [],
		journal: [],
		unlocked_items: [],
		unlocked_missions: ['m_code_01'],
		completed_missions: [],
		current_mission_id: 'm_code_01',
		redeemed_codes: [],
		votes: {},
		...(player.game_status || {})
	};

	if (!updatedStatus.completed_missions) updatedStatus.completed_missions = [];
	if (!updatedStatus.votes) updatedStatus.votes = {};

	const previousVote = updatedStatus.votes[missionId];
	const isFirstVote = !previousVote;

	// Recompensa en XP y CP la primera vez que vota
	let xpReward = 0;
	let cpReward = 0;
	if (isFirstVote) {
		xpReward = 100;
		cpReward = 30;
		updatedAvatar.xp = updatedAvatar.xp || { points: 0, level: 1 };
		updatedAvatar.cp = updatedAvatar.cp || { points: 100, icon: '⚡' };
		updatedAvatar.xp.points += xpReward;
		updatedAvatar.cp.points += cpReward;
	}

	// Registrar voto del jugador
	updatedStatus.votes[missionId] = {
		option_id: optionId,
		voted_at: new Date().toISOString()
	};

	if (!updatedStatus.completed_missions.includes(missionId)) {
		updatedStatus.completed_missions.push(missionId);
	}

	const [milestonesReached, eventLevels] = await Promise.all([
		Promise.resolve(checkAndApplyMilestones(updatedAvatar, updatedStatus)),
		getEventLevels(eventId)
	]);
	updatedAvatar.xp.level = calculateLevel(updatedAvatar.xp.points, eventLevels);

	// Persistir
	player.avatar = updatedAvatar;
	player.game_status = updatedStatus;

	try {
		await supabaseServer
			.from('eventgage_event_avatar')
			.update({ avatar: updatedAvatar, game_status: updatedStatus, updated_at: new Date().toISOString() })
			.eq('user_id', userId)
			.eq('event_id', eventId);
		if (milestonesReached.length > 0) {
			await broadcastMilestoneReached(eventId, updatedAvatar.name, milestonesReached);
		}
	} catch (e) {
		console.warn('Updated vote status in memory:', e);
	}

	trackAnalyticsEvent(eventId, userId, 'vote_submitted', 'social', {
		mission_id: missionId,
		option_id: optionId,
		faction_id: updatedAvatar.faction_id,
		is_first_vote: isFirstVote
	});

	if (isFirstVote) {
		trackAnalyticsEvent(eventId, userId, 'mission_completed', 'progression', {
			mission_id: missionId,
			mission_type: 'collective_vote',
			xp_awarded: xpReward,
			cp_awarded: cpReward
		});
	}

	const key = `${userId}_${eventId}`;
	memoryStore.eventAvatars.set(key, player);

	const votingResults = await getVotingResults(eventId);

	return attachWorldState(eventId, {
		success: true,
		message: isFirstVote
			? `¡Voto registrado con éxito! +${xpReward} XP, +${cpReward} CP.`
			: `Voto actualizado a la opción seleccionada.`,
		playerState: player,
		votingResults
	});
}

// --- Fase 2: dice_check, trivia_quiz y ai_prompt_challenge (modo fallback) ---

function normalizeGameStatus(gameStatus: any) {
	const status = {
		viewed_dialogues: [],
		journal: [],
		unlocked_items: [],
		unlocked_missions: [],
		completed_missions: [],
		current_mission_id: null,
		redeemed_codes: [],
		votes: {},
		// Bóveda de Inteligencia (Fase 4.4): compras, tirada de reintento y
		// cargos de boost de SP viven acá, mismo patrón jsonb que el resto de
		// game_status — sin tabla ni migración nueva.
		unlocked_rewards: [],
		vip_token: null,
		dice_check_outcomes: {},
		reintento_used: false,
		sp_boost_charges: 0,
		// time_bomb (sección 1.3/10.3): `mission_timers` sella la primera vez
		// que se observa la misión desbloqueada (sello perezoso — evita tocar
		// los múltiples puntos donde ya se hace `unlocked_missions.unshift`),
		// `expired_missions` es la bandera de idempotencia para no penalizar
		// dos veces la misma expiración. Ver checkExpiredTimeBombs.
		mission_timers: {},
		expired_missions: [],
		// Juego de Contactos (sección 2.18): libreta de contactos cruzados.
		saved_contacts: [],
		// Comunicaciones desbloqueables por misión (unlock_communication):
		unlocked_communications: [],
		...(gameStatus || {})
	};
	if (!status.journal) status.journal = [];
	if (!status.unlocked_items) status.unlocked_items = [];
	if (!status.unlocked_missions) status.unlocked_missions = [];
	if (!status.completed_missions) status.completed_missions = [];
	if (!status.redeemed_codes) status.redeemed_codes = [];
	if (!status.votes) status.votes = {};
	if (!status.unlocked_rewards) status.unlocked_rewards = [];
	if (!status.dice_check_outcomes) status.dice_check_outcomes = {};
	if (typeof status.sp_boost_charges !== 'number') status.sp_boost_charges = 0;
	if (!status.mission_timers) status.mission_timers = {};
	if (!status.expired_missions) status.expired_missions = [];
	if (!status.saved_contacts) status.saved_contacts = [];
	if (!status.unlocked_communications) status.unlocked_communications = [];
	return status;
}

// Aplica el límite de tiempo real de las misiones `time_bomb` (sección 10.3):
// hasta ahora el conteo regresivo era 100% cosmético en el frontend (siempre
// arrancaba en 600, ni siquiera leía `time_limit_seconds`), sin ningún efecto
// en el servidor. Best-effort y perezoso, sin cron: se llama al cargar la
// página y al intentar canjear un código, igual que el resto de chequeos de
// este archivo. Si el tiempo expiró sin completar, la misión queda marcada
// como no-canjeable (`expired_missions`) y la Inercia Global sube +2 — a
// diferencia del ±1 del resto de mecánicas, pedido explícito de Javier: el
// costo de dejar correr el reloj sin actuar es mayor que fallar un intento.
export async function checkExpiredTimeBombs(eventId: string, player: any): Promise<boolean> {
	const status = normalizeGameStatus(player.game_status);
	player.game_status = status;

	const missions = await getEventMissions(eventId);
	const timeBombMissions = missions.filter((m: any) => m.type === 'time_bomb');
	if (timeBombMissions.length === 0) return false;

	let changed = false;
	const now = Date.now();

	for (const mission of timeBombMissions) {
		const id = mission.id;
		if (status.completed_missions.includes(id)) continue;
		if (status.expired_missions.includes(id)) continue;
		if (!status.unlocked_missions.includes(id)) continue;

		const sealedAt = status.mission_timers[id];
		if (!sealedAt) {
			status.mission_timers[id] = new Date().toISOString();
			changed = true;
			continue;
		}

		const limitSeconds = mission.time_limit_seconds;
		if (!limitSeconds) continue;
		const elapsedMs = now - new Date(sealedAt).getTime();
		if (elapsedMs > limitSeconds * 1000) {
			status.expired_missions.push(id);
			await adjustWorldPoints(eventId, 2);
			changed = true;
			trackAnalyticsEvent(eventId, player.user_id, 'time_bomb_expired', 'mechanic', {
				mission_id: id,
				penalty_points: 2
			});
		}
	}

	if (changed) {
		await persistPlayerState(player.user_id, eventId, player);
	}
	return changed;
}

async function persistPlayerState(userId: string, eventId: string, player: any) {
	try {
		await supabaseServer
			.from('eventgage_event_avatar')
			.update({ avatar: player.avatar, game_status: player.game_status, updated_at: new Date().toISOString() })
			.eq('user_id', userId)
			.eq('event_id', eventId);
	} catch (e) {
		console.warn('Error al persistir estado del jugador:', e);
	}
	const key = `${userId}_${eventId}`;
	memoryStore.eventAvatars.set(key, player);
}

// Best-effort, no atómico (lectura + escritura): consistente con el resto del
// archivo (ver submitVoteForPlayer), suficiente para el volumen de un evento
// presencial. Una versión atómica requeriría una función SQL dedicada.
async function incrementFactionPoints(eventId: string, factionId: string | undefined, delta: number) {
	if (!factionId || !delta) return;
	try {
		const { data } = await supabaseServer
			.from('eventgage_event_factions')
			.select('faction_points')
			.eq('id', factionId)
			.eq('event_id', eventId)
			.maybeSingle();
		const current = typeof data?.faction_points === 'number' ? data.faction_points : 0;
		await supabaseServer
			.from('eventgage_event_factions')
			.update({ faction_points: current + delta })
			.eq('id', factionId)
			.eq('event_id', eventId);
		await checkFactionLeadChange(eventId);
	} catch (e) {
		console.warn(`No se pudo actualizar faction_points para "${factionId}":`, e);
	}
}

// Complementa el Feed Comunitario (ver broadcastMilestoneReached más abajo
// para el resto del contexto de esta decisión): anuncia solo cuando el
// primer puesto CAMBIA de facción, no cada vez que suben los puntos. Un
// empate en el primer puesto no cuenta como "delantera clara" — no se
// anuncia nada hasta que alguien la rompa.
async function checkFactionLeadChange(eventId: string) {
	try {
		const { data } = await supabaseServer
			.from('eventgage_event_factions')
			.select('id, name, faction_points')
			.eq('event_id', eventId);
		if (!data || data.length < 2) return;

		const sorted = [...data].sort((a: any, b: any) => (b.faction_points || 0) - (a.faction_points || 0));
		const leader = sorted[0];
		if (sorted[1].faction_points === leader.faction_points) return;

		const key = `leader_${eventId}`;
		const prevLeaderId = memoryStore.factionLeaders.get(key);
		if (prevLeaderId && prevLeaderId !== leader.id) {
			await broadcastEventActivity(eventId, 'faction_lead_change', {
				factionId: leader.id,
				factionName: leader.name
			});
		}
		memoryStore.factionLeaders.set(key, leader.id);
	} catch (e) {
		console.warn(`No se pudo evaluar cambio de facción líder para "${eventId}":`, e);
	}
}

// Ajuste del puntaje mundial (Inercia Global en Gamescon) — mecánica de
// "suma cero ±1" del GDD (sección 1.3.3): el mismo delta que sube a la
// facción baja a la Inercia, y viceversa. No existía ningún código que
// escribiera `eventgage_event_points.current_points` hasta ahora — el
// marcador quedaba fijo en su valor sembrado sin importar cuántas misiones
// se resolvieran. Mismo patrón best-effort que incrementFactionPoints, sin
// bloqueo de fila. Clampeado entre 0 y max_points: la Inercia no puede
// "sobrepasar" el máximo del termómetro ni bajar de la Victoria Total (0).
async function adjustWorldPoints(eventId: string, delta: number) {
	if (!delta) return;
	try {
		const { data } = await supabaseServer
			.from('eventgage_event_points')
			.select('id, current_points, max_points')
			.eq('event_id', eventId);
		const row = data?.[0];
		if (!row) return;
		const current = typeof row.current_points === 'number' ? row.current_points : 0;
		const max = typeof row.max_points === 'number' ? row.max_points : current;
		const next = Math.max(0, Math.min(max, current + delta));
		await supabaseServer
			.from('eventgage_event_points')
			.update({ current_points: next })
			.eq('id', row.id)
			.eq('event_id', eventId);
	} catch (e) {
		console.warn(`No se pudo actualizar eventgage_event_points para "${eventId}":`, e);
	}
}

// Emite un evento efímero de Supabase Realtime Broadcast en el canal
// compartido del evento (`event:{eventId}:activity`). Best-effort puro: si
// Realtime no está disponible (p.ej. Postgres+PostgREST local de dev, que no
// tiene servidor Realtime) o el envío falla, se registra un warning y se
// sigue — nunca bloquea la acción del jugador que lo disparó. No persiste
// nada; quien no esté conectado en ese instante simplemente no lo recibe (el
// feed histórico persistente es una pieza aparte, fuera de alcance de este
// lote). Payload discriminado por `type` (`item_unlocked_globally`,
// `contact_scanned`) — un solo canal por evento en vez de uno por jugador,
// suficiente a la escala de un evento presencial (80-100 asistentes).
async function broadcastEventActivity(eventId: string, type: string, payload: Record<string, any>) {
	try {
		const channel = supabaseRealtime.channel(`event:${eventId}:activity`, {
			config: { broadcast: { self: false } }
		});
		await new Promise<void>((resolve) => {
			const timeout = setTimeout(() => resolve(), 3000);
			channel.subscribe(async (status) => {
				if (status === 'SUBSCRIBED') {
					await channel.send({ type: 'broadcast', event: 'activity', payload: { type, ...payload } });
					clearTimeout(timeout);
					resolve();
				}
			});
		});
		await supabaseRealtime.removeChannel(channel);
	} catch (e) {
		console.warn(`[eventService] No se pudo emitir broadcast "${type}" para "${eventId}":`, e);
	}

	// Persistencia en `eventgage_event_activity_feed` (docs/system_capabilities_and_mechanics.md
	// sección 2.16) — antes el broadcast era puramente efímero; quien no
	// estuviera conectado en el instante exacto se lo perdía para siempre.
	// Best-effort, independiente del broadcast en vivo (uno puede fallar sin
	// afectar al otro). Usa supabaseServer (no supabaseRealtime): la fuente
	// de verdad del feed es la misma base de datos del resto del juego —
	// local en dev, remota en producción.
	try {
		await supabaseServer.from('eventgage_event_activity_feed').insert({ event_id: eventId, type, payload });
	} catch (e) {
		console.warn(`[eventService] No se pudo persistir actividad "${type}" en el feed para "${eventId}":`, e);
	}
}

// Últimas entradas del feed de actividad persistente, más reciente primero.
export async function getEventActivityFeed(eventId: string, limit: number = 20) {
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_event_activity_feed')
			.select('*')
			.eq('event_id', eventId)
			.order('created_at', { ascending: false })
			.limit(limit);
		if (error) {
			console.error(`[eventService] Error consultando Supabase en getEventActivityFeed("${eventId}"):`, error);
			return [];
		}
		return data || [];
	} catch (e) {
		console.error(`[eventService] Error consultando Supabase en getEventActivityFeed("${eventId}"):`, e);
		return [];
	}
}

// Fix del bug is_public (docs/system_capabilities_and_mechanics.md, sección
// 2.13): un ítem marcado is_public en el catálogo debe arrancar BLOQUEADO
// para todos y desbloquearse globalmente recién cuando algún jugador lo
// descubre por primera vez (código o misión) — antes se evaluaba
// `item.is_public` directo en el cliente, lo que lo mostraba desbloqueado
// para todo el mundo desde el segundo 1. Se llama desde los mismos puntos
// donde ya se hace `unlocked_items.unshift(...)` (submitCodeForPlayer,
// applyMissionCompletion) — nunca desde purchaseReward (comprar en la
// Bóveda no es "descubrir", no debería desbloquear nada globalmente).
async function markItemsGloballyUnlocked(eventId: string, itemIds: string[]) {
	if (!itemIds || itemIds.length === 0) return;
	try {
		const items = await getEventItems(eventId);
		const publicIds = itemIds.filter((id) => items.find((i: any) => i.id === id)?.is_public);
		if (publicIds.length === 0) return;

		const { data } = await supabaseServer
			.from('eventgage_events')
			.select('id, global_unlocked_items')
			.eq('id', eventId)
			.maybeSingle();
		if (!data) return;

		const current: string[] = data.global_unlocked_items || [];
		const newIds = publicIds.filter((id) => !current.includes(id));
		if (newIds.length === 0) return;

		const next = [...current, ...newIds];
		await supabaseServer
			.from('eventgage_events')
			.update({ global_unlocked_items: next })
			.eq('id', eventId);

		for (const id of newIds) {
			const item = items.find((i: any) => i.id === id);
			await broadcastEventActivity(eventId, 'item_unlocked_globally', {
				itemId: id,
				itemName: item?.name || id
			});
		}
	} catch (e) {
		console.warn(`No se pudo actualizar global_unlocked_items para "${eventId}":`, e);
	}
}

// Complementa el Feed Comunitario (docs/system_capabilities_and_mechanics.md
// 2.16) con "logros" reales, no cada acción rutinaria — decisión de Javier
// (2026-08-17): sumar cada misión/voto/tirada individual inundaría el feed
// con cientos de entradas a escala de evento (80-100 asistentes). Solo 3
// tipos califican: Hito/Rango (acá), cambio de facción líder
// (ver checkFactionLeadChange) y evaluaciones destacadas de GIOCCHI
// (ver resolveAiPromptChallenge).
async function broadcastMilestoneReached(eventId: string, playerName: string, milestones: any[]) {
	if (!milestones || milestones.length === 0) return;
	const top = milestones[milestones.length - 1];
	await broadcastEventActivity(eventId, 'milestone_reached', {
		playerName,
		rank: top.rank,
		rankTitle: top.rankTitle,
		milestoneCount: top.count
	});
}

// A diferencia de getEventMissions, esta consulta NO sanitiza el mechanic —
// necesita el flag `correct` de las opciones de trivia para poder calificar
// la respuesta. Es de uso exclusivamente interno/servidor, nunca se expone.
async function getRawMissionById(eventId: string, missionId: string): Promise<any | null> {
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_event_missions')
			.select('*')
			.eq('event_id', eventId)
			.eq('id', missionId)
			.maybeSingle();
		if (data) return data;
		if (error) {
			console.error(`[eventService] Error consultando misión "${missionId}" para resolución:`, error);
			throw new SystemUnavailableError();
		}
	} catch (e) {
		if (e instanceof SystemUnavailableError) throw e;
		console.error(`[eventService] Error consultando misión "${missionId}" para resolución:`, e);
		throw new SystemUnavailableError();
	}
	return null;
}

// --- Fase 3: Sistema de Hitos simplificado (sección 10.1 del diseño) ---
// Simplificado: dispara por CONTEO TOTAL de misiones completadas, sin la
// cuota mínima de Game Master (eso requiere distinguir origen recinto/GM en
// el modelo de datos — Fase 4.2 del plan). Los +2 SP "a asignar libremente"
// se auto-asignan al atributo más alto del avatar (respetando el tope de 20,
// sección 1.3.5) en vez de pedir una elección manual — no bloquea el MVP.
const SP_CAP = 20;

export const LEVEL_TIERS = [
	{ level: 1, minXp: 0, nextXp: 200 },
	{ level: 2, minXp: 200, nextXp: 500 },
	{ level: 3, minXp: 500, nextXp: 900 },
	{ level: 4, minXp: 900, nextXp: 1400 },
	{ level: 5, minXp: 1400, nextXp: 2000 },
	{ level: 6, minXp: 2000, nextXp: 2600 },
	{ level: 7, minXp: 2600, nextXp: 2600 }
];

export function calculateLevel(
	xpPoints: number,
	levels?: Array<{ level: number; xp_required: number }>
): number {
	const xp = typeof xpPoints === 'number' && !isNaN(xpPoints) ? Math.max(0, xpPoints) : 0;
	if (levels && levels.length > 0) {
		const sorted = [...levels].sort((a, b) => b.level - a.level);
		for (const tier of sorted) {
			if (xp >= tier.xp_required) {
				return tier.level;
			}
		}
		return sorted[sorted.length - 1]?.level || 1;
	}
	if (xp >= 2600) return 7;
	if (xp >= 2000) return 6;
	if (xp >= 1400) return 5;
	if (xp >= 900) return 4;
	if (xp >= 500) return 3;
	if (xp >= 200) return 2;
	return 1;
}

const DEFAULT_MILESTONES: Array<{
	count: number;
	xp: number;
	cp: number;
	spBonus: number;
	rank: number;
	rankTitle: string;
	unlockItem?: string;
	lore: string;
	narrative?: {
		title: string;
		speaker_id?: string;
		speaker_name: string;
		speaker_role?: string;
		portrait_url?: string;
		badge?: string;
		content_html: string;
	};
}> = [
	{ count: 3, xp: 100, cp: 1, spBonus: 2, rank: 2, rankTitle: 'Agente de Campo', lore: 'Acceso prioritario a la Bóveda de Inteligencia.' },
	{ count: 6, xp: 120, cp: 2, spBonus: 2, rank: 3, rankTitle: 'Especialista Táctico', unlockItem: 'item_llave_boveda_prime', lore: 'Obtuviste la Llave Criptográfica PRIME.' },
	{ count: 9, xp: 140, cp: 2, spBonus: 2, rank: 4, rankTitle: 'Estratega de Enlace', lore: 'Se desclasifican las cláusulas del Tratado Huizinga.' },
	{ count: 12, xp: 150, cp: 0, spBonus: 0, rank: 5, rankTitle: 'Agente Master Huizinga', lore: 'Consagración de honor al cierre del evento.' }
];

export async function getEventMilestones(eventId: string): Promise<any[]> {
	try {
		const { data } = await supabaseServer
			.from('eventgage_events')
			.select('config')
			.eq('id', eventId)
			.maybeSingle();

		if (Array.isArray(data?.config?.milestones) && data.config.milestones.length > 0) {
			return data.config.milestones;
		}
	} catch (e) {
		console.error(`[eventService] Error obteniendo hitos para evento "${eventId}":`, e);
	}
	return DEFAULT_MILESTONES;
}

function applySpBonus(sp: Record<string, number>, bonus: number) {
	if (!bonus || !sp) return;
	const attrs = Object.keys(sp);
	if (!attrs.length) return;
	let remaining = bonus;
	while (remaining > 0) {
		const sorted = [...attrs].sort((a, b) => (sp[b] || 0) - (sp[a] || 0));
		const target = sorted.find((a) => (sp[a] || 0) < SP_CAP);
		if (!target) break; // los 4 atributos ya están en el tope
		sp[target] = (sp[target] || 0) + 1;
		remaining--;
	}
}

function checkAndApplyMilestones(avatar: any, status: any, milestoneList: any[] = DEFAULT_MILESTONES): any[] {
	if (!Array.isArray(status.milestones_claimed)) status.milestones_claimed = [];
	if (!Array.isArray(status.journal)) status.journal = [];
	const completedCount = status.completed_missions.length;
	const reached: any[] = [];
	for (const m of milestoneList) {
		if (completedCount >= m.count && !status.milestones_claimed.includes(m.count)) {
			status.milestones_claimed.push(m.count);
			avatar.xp.points += m.xp || 0;
			avatar.cp.points += m.cp || 0;
			applySpBonus(avatar.sp, m.spBonus || 0);
			avatar.rank = m.rank || 1;
			avatar.rank_title = m.rankTitle;
			if (m.unlockItem && !status.unlocked_items.includes(m.unlockItem)) {
				status.unlocked_items.unshift(m.unlockItem);
			}
			if (m.narrative) {
				const mJournalId = `journal_milestone_${m.count}`;
				if (!status.journal.some((j: any) => j.id === mJournalId)) {
					status.journal.unshift({
						id: mJournalId,
						title: `🏆 ${m.narrative.title || `Hito ${m.count}: ${m.rankTitle}`}`,
						content_html: m.narrative.content_html
					});
				}
			}
			reached.push(m);
		}
	}
	return reached;
}

function formatMilestoneMessages(milestones: any[]): string {
	return milestones
		.map((m) => `🏆 ¡Hito ${m.count} alcanzado! Rango: ${m.rankTitle}. +${m.xp} XP${m.cp ? `, +${m.cp} 💠` : ''}${m.spBonus ? `, +${m.spBonus} SP` : ''}. ${m.lore}`)
		.join(' ');
}

async function applyMissionCompletion(
	userId: string,
	eventId: string,
	player: any,
	status: any,
	mission: any,
	xpReward: number,
	cpReward: number,
	journalEntry?: { title: string; content_html: string }
) {
	const avatar = { ...player.avatar };
	avatar.xp = avatar.xp || { points: 0, level: 1 };
	avatar.cp = avatar.cp || { points: 0, icon: '💠' };
	avatar.xp.points += xpReward;
	avatar.cp.points += cpReward;

	status.completed_missions.push(mission.id);

	const rewards = mission.mechanic?.rewards || {};
	const newlyUnlockedItemIds: string[] = [];
	if (Array.isArray(rewards.items)) {
		for (const itemKey of rewards.items) {
			if (!status.unlocked_items.includes(itemKey)) {
				status.unlocked_items.unshift(itemKey);
				newlyUnlockedItemIds.push(itemKey);
			}
		}
	}
	if (journalEntry) {
		const entryId = `entry_${mission.id}`;
		if (!status.journal.some((j: any) => j.id === entryId)) {
			status.journal.unshift({ id: entryId, title: journalEntry.title, content_html: journalEntry.content_html });
		}
	}

	if (mission.mechanic?.unlock_communication) {
		const uComm = mission.mechanic.unlock_communication;
		const commId = uComm.id || `comm_${mission.id}`;
		if (!Array.isArray(status.unlocked_communications)) {
			status.unlocked_communications = [];
		}
		if (!status.unlocked_communications.some((c: any) => c.id === commId)) {
			status.unlocked_communications.unshift({
				id: commId,
				character_id: uComm.character_id || 'char_cipher',
				badge: uComm.badge || 'DIRECTIVA DE CAMPO',
				badge_type: uComm.badge_type || 'tactical',
				text: uComm.text || '',
				remove_on_code: uComm.remove_on_code || null,
				unlocked_at: new Date().toISOString()
			});
		}
	}

	const [milestoneList, eventLevels] = await Promise.all([
		getEventMilestones(eventId),
		getEventLevels(eventId)
	]);
	const milestonesReached = checkAndApplyMilestones(avatar, status, milestoneList);
	const oldLevel = player.avatar?.xp?.level || 1;
	const newLevel = calculateLevel(avatar.xp.points, eventLevels);
	avatar.xp.level = newLevel;

	player.avatar = avatar;
	player.game_status = status;
	await persistPlayerState(userId, eventId, player);
	if (newlyUnlockedItemIds.length > 0) {
		await markItemsGloballyUnlocked(eventId, newlyUnlockedItemIds);
	}
	if (milestonesReached.length > 0) {
		await broadcastMilestoneReached(eventId, avatar.name, milestonesReached);
		for (const m of milestonesReached) {
			trackAnalyticsEvent(eventId, userId, 'milestone_reached', 'progression', {
				count: m.count,
				rank: m.rank,
				rank_title: m.rankTitle,
				sp_bonus: m.spBonus
			});
		}
	}

	if (newLevel !== oldLevel) {
		trackAnalyticsEvent(eventId, userId, 'level_up', 'progression', {
			old_level: oldLevel,
			new_level: newLevel,
			total_xp: avatar.xp.points
		});
	}

	trackAnalyticsEvent(eventId, userId, 'mission_completed', 'progression', {
		mission_id: mission.id,
		mission_type: mission.mission_type,
		xp_awarded: xpReward,
		cp_awarded: cpReward
	});

	return milestonesReached;
}

// Fórmula de tirada de dice_check, compartida entre el primer intento
// (resolveDiceCheck) y el reintento pagado con la Ficha de Reintento
// (retryDiceCheck) — una sola fórmula, no dos copias. También aplica y
// consume el boost de Sobrecarga de Atributo si hay cargos activos
// (rew_boost_sp, vale por 3 tiradas — decisión de Javier, 2026-08-17):
// muta `status.sp_boost_charges` in-place, el llamador es responsable de
// persistir `status` después.
function rollDiceCheck(player: any, status: any, mission: any) {
	const attribute = mission.mechanic?.attribute || 'EST';
	const sp = player.avatar?.sp?.[attribute];
	let spValue = typeof sp === 'number' ? sp : 10;
	const spBoostApplied = status.sp_boost_charges > 0;
	if (spBoostApplied) {
		spValue += 2;
		status.sp_boost_charges -= 1;
	}
	const modifier = Math.floor(spValue / 2);
	const roll = 1 + Math.floor(Math.random() * 20);
	const total = roll + modifier;
	// DC = 12 + ⌊misiones_resueltas / 3⌋ (sección 1.3.5 / 6.4 del diseño)
	const dc = 12 + Math.floor(status.completed_missions.length / 3);
	const checkSuccess = total >= dc;
	return { attribute, roll, modifier, total, dc, checkSuccess, spBoostApplied };
}

async function resolveDiceCheck(userId: string, eventId: string, player: any, status: any, mission: any) {
	const { attribute, roll, modifier, total, dc, checkSuccess, spBoostApplied } = rollDiceCheck(player, status, mission);
	// Se registra ANTES de applyMissionCompletion (que persiste `status`) para
	// que quede guardado junto con el resto del intento — retryDiceCheck lo
	// necesita para saber qué misiones son elegibles a reintento.
	status.dice_check_outcomes[mission.id] = checkSuccess;

	const rewards = mission.mechanic?.rewards || {};
	const xpReward = typeof rewards.xp === 'number' ? rewards.xp : 50;
	const cpReward = typeof rewards.cp === 'number' ? rewards.cp : 1;
	const journalEntry = rewards.journal_reflection
		? { title: `Bitácora: ${mission.title}`, content_html: `<p>${escapeHtml(mission.description || '')}</p>` }
		: undefined;

	const milestonesReached = await applyMissionCompletion(userId, eventId, player, status, mission, xpReward, cpReward, journalEntry);

	const impact = mission.mechanic?.faction_impact || { success: 1, fail: 0 };
	const delta = checkSuccess ? (impact.success ?? 1) : (impact.fail ?? 0);
	if (delta) await incrementFactionPoints(eventId, player.avatar?.faction_id, delta);
	// Inercia Global es ±1 fijo por resultado (sección 1.3.3 del GDD), NO un
	// espejo del delta de facción: el fallo por defecto da 0 puntos a la
	// facción pero SIGUE sumando +1 a la Inercia ("0 puntos a la Facción →
	// +1 punto a la Inercia Global" — son reglas independientes, no un
	// mismo número con signo invertido).
	await adjustWorldPoints(eventId, checkSuccess ? -1 : 1);

	trackAnalyticsEvent(eventId, userId, 'dice_check_rolled', 'mechanic', {
		mission_id: mission.id,
		attribute,
		roll,
		modifier,
		total,
		dc,
		success: checkSuccess,
		sp_boost_applied: spBoostApplied
	});

	if (!checkSuccess) {
		trackAnalyticsEvent(eventId, userId, 'mission_failed', 'progression', {
			mission_id: mission.id,
			mission_type: 'dice_check',
			reason: 'dc_not_met',
			total,
			dc
		});
	}

	const boostNote = spBoostApplied ? ' (con Sobrecarga de Atributo: +2 SP)' : '';
	const commNote = mission.mechanic?.unlock_communication ? ' Revisa la comunicación entrante en el HUD para continuar.' : '';
	const baseMsg = `🎲 Tirada: ${roll} + ${modifier} (${attribute}) = ${total} vs DC ${dc}${boostNote}. ${checkSuccess ? '¡Éxito! Tu facción avanza.' : 'Fallo — la Inercia se resiste, pero el intento cuenta.'} +${xpReward} XP, +${cpReward} 💠.${commNote}`;

	return {
		success: true,
		checkSuccess,
		roll,
		modifier,
		total,
		dc,
		attribute,
		milestonesReached,
		message: milestonesReached.length ? `${baseMsg} ${formatMilestoneMessages(milestonesReached)}` : baseMsg,
		playerState: player
	};
}

// Consumo de la Ficha de Reintento (rew_item_reintento, comprada en la
// Bóveda): repite un dice_check que ya falló. A propósito NO pasa por
// applyMissionCompletion — el XP/CP del intento original ya se otorgó
// (sección 1.3: "50 XP fijos tanto en éxito como en fallo"); el reintento
// solo puede recuperar el punto de facción / Inercia que se perdió en el
// primer fallo. Un solo uso de por vida (mismo criterio de "prevención de
// duplicados" que el resto del catálogo de la Bóveda).
export async function retryDiceCheck(userId: string, eventId: string, missionId: string) {
	const player = await getPlayerAvatar(userId, eventId);
	if (!player) {
		return { success: false, message: 'Debes unirte al evento y seleccionar un avatar antes de reintentar.' };
	}
	const mission = await getRawMissionById(eventId, missionId);
	if (!mission || mission.mission_type !== 'dice_check') {
		return { success: false, message: 'Esta misión no admite reintento.' };
	}

	const status = normalizeGameStatus(player.game_status);
	if (!status.completed_missions.includes(missionId)) {
		return { success: false, message: 'Todavía no intentaste esta misión.' };
	}
	if (status.dice_check_outcomes[missionId] !== false) {
		return { success: false, message: 'Solo se puede reintentar un chequeo que haya fallado.' };
	}
	if (!status.unlocked_rewards.includes('rew_item_reintento')) {
		return { success: false, message: 'Necesitás una Ficha de Reintento de la Bóveda para volver a intentar esto.' };
	}
	if (status.reintento_used) {
		return { success: false, message: 'Ya usaste tu Ficha de Reintento.' };
	}

	const { attribute, roll, modifier, total, dc, checkSuccess, spBoostApplied } = rollDiceCheck(player, status, mission);
	status.dice_check_outcomes[missionId] = checkSuccess;
	status.reintento_used = true;

	let factionMsg: string;
	if (checkSuccess) {
		const impact = mission.mechanic?.faction_impact || { success: 1, fail: 0 };
		const delta = impact.success ?? 1;
		if (delta) await incrementFactionPoints(eventId, player.avatar?.faction_id, delta);
		// Flat -1, igual que cualquier otro éxito (ver resolveDiceCheck) — el
		// +1 que ya sumó el fallo original no se "deshace" con un -2, el
		// reintento exitoso solo aplica la reducción estándar de un acierto.
		await adjustWorldPoints(eventId, -1);
		factionMsg = ' Tu facción avanza y la Inercia retrocede.';
	} else {
		factionMsg = ' Sin suerte esta vez tampoco — tu Ficha de Reintento ya se usó.';
	}

	player.game_status = status;
	await persistPlayerState(userId, eventId, player);

	trackAnalyticsEvent(eventId, userId, 'dice_retry_used', 'economy', { mission_id: missionId });
	trackAnalyticsEvent(eventId, userId, 'dice_check_rolled', 'mechanic', {
		mission_id: mission.id,
		attribute,
		roll,
		modifier,
		total,
		dc,
		success: checkSuccess,
		sp_boost_applied: spBoostApplied,
		is_retry: true
	});

	const boostNote = spBoostApplied ? ' (con Sobrecarga de Atributo: +2 SP)' : '';
	const baseMsg = `🎲 Reintento: ${roll} + ${modifier} (${attribute}) = ${total} vs DC ${dc}${boostNote}.${factionMsg}`;

	return attachWorldState(eventId, {
		success: true,
		checkSuccess,
		roll,
		modifier,
		total,
		dc,
		attribute,
		message: baseMsg,
		playerState: player
	});
}

// Activa la Sobrecarga de Atributo (rew_boost_sp, comprada en la Bóveda):
// carga 3 usos que rollDiceCheck consume automáticamente uno por tirada en
// los próximos 3 dice_check que el jugador resuelva (cualquier atributo, sin
// elegir de antemano — decisión de Javier, 2026-08-17). No se puede
// reactivar mientras queden cargos sin usar del ciclo anterior.
export async function activateSpBoost(userId: string, eventId: string) {
	const player = await getPlayerAvatar(userId, eventId);
	if (!player) {
		return { success: false, message: 'Debes unirte al evento y seleccionar un avatar antes de activar la Sobrecarga.' };
	}
	const status = normalizeGameStatus(player.game_status);
	if (!status.unlocked_rewards.includes('rew_boost_sp')) {
		return { success: false, message: 'Necesitás comprar la Sobrecarga de Atributo en la Bóveda antes de activarla.' };
	}
	if (status.sp_boost_charges > 0) {
		return { success: false, message: `Ya tenés Sobrecarga activa (${status.sp_boost_charges} tirada(s) restante(s)).` };
	}

	status.sp_boost_charges = 3;
	player.game_status = status;
	await persistPlayerState(userId, eventId, player);

	trackAnalyticsEvent(eventId, userId, 'sp_boost_activated', 'economy', { charges_added: 3 });

	return {
		success: true,
		message: 'Sobrecarga de Atributo activada: +2 SP en tus próximas 3 tiradas de dado.',
		playerState: player
	};
}

// --- Juego de Contactos (Networking) ---
// docs/system_capabilities_and_mechanics.md, sección 2.18. El documento
// sugiere una columna dedicada `contact_profile`; acá vive en
// `avatar.contact_profile` (jsonb ya existente) en vez de sumar una columna
// nueva — mismo criterio del resto de esta sesión (rank/rank_title, vip_token,
// etc. entraron todos al jsonb existente sin migración).

// Activa (o edita, si ya existe) el perfil de contacto del jugador. El
// código personal solo se genera una vez, nunca se regenera al editar.
export async function activateContactProfile(
	userId: string,
	eventId: string,
	email: string,
	fields: { company?: string; phone?: string; linkedin?: string; bio?: string }
) {
	const player = await getPlayerAvatar(userId, eventId);
	if (!player) {
		return { success: false, message: 'Debes unirte al evento y seleccionar un avatar antes de activar tu código de contacto.' };
	}

	const updatedAvatar = { ...player.avatar };
	const wasAlreadyActive = !!updatedAvatar.contact_profile?.personal_code;
	let personalCode = updatedAvatar.contact_profile?.personal_code;

	if (!personalCode) {
		// Escanea el resto de avatares del evento para evitar colisión — mismo
		// patrón de agregación en JS que getFactionMembers; el volumen de un
		// evento presencial no justifica más que esto.
		const { data } = await supabaseServer
			.from('eventgage_event_avatar')
			.select('avatar')
			.eq('event_id', eventId);
		const existingCodes = new Set(
			(data || []).map((row: any) => row.avatar?.contact_profile?.personal_code).filter(Boolean)
		);
		do {
			personalCode = '@' + crypto.randomUUID().slice(0, 6).toUpperCase();
		} while (existingCodes.has(personalCode));
	}

	updatedAvatar.contact_profile = {
		personal_code: personalCode,
		company: fields.company || '',
		phone: fields.phone || '',
		email: email || '',
		linkedin: fields.linkedin || '',
		bio: fields.bio || '',
		activated_at: updatedAvatar.contact_profile?.activated_at || new Date().toISOString()
	};

	player.avatar = updatedAvatar;
	await persistPlayerState(userId, eventId, player);

	trackAnalyticsEvent(eventId, userId, 'contact_profile_activated', 'social', {
		personal_code: personalCode,
		company: fields.company || ''
	});

	return attachWorldState(eventId, {
		success: true,
		message: wasAlreadyActive ? 'Perfil de contacto actualizado.' : `¡Código personal activado: ${personalCode}!`,
		playerState: player
	});
}

// Canjea el código '@...' de otro jugador — intercambio bidireccional de
// contacto, +10 XP y +3 puntos de facción para cada uno. Enrutado acá desde
// submitCodeForPlayer cuando el código canjeado empieza con '@'.
async function redeemContactCode(userId: string, eventId: string, rawCode: string) {
	const player = await getPlayerAvatar(userId, eventId);
	if (!player) {
		return { success: false, message: 'Debes unirte al evento y seleccionar un avatar antes de canjear códigos.' };
	}
	const cleanCode = rawCode.trim().toUpperCase();

	const { data } = await supabaseServer
		.from('eventgage_event_avatar')
		.select('user_id, avatar, game_status')
		.eq('event_id', eventId);
	const rows = data || [];

	const targetRow = rows.find((r: any) => r.avatar?.contact_profile?.personal_code?.toUpperCase() === cleanCode);
	if (!targetRow) {
		return { success: false, message: 'Código de contacto inválido o expirado.' };
	}
	if (targetRow.user_id === userId) {
		return { success: false, message: 'No puedes escanear tu propio código personal, Agente.' };
	}

	const myStatus = normalizeGameStatus(player.game_status);
	if (!myStatus.saved_contacts) myStatus.saved_contacts = [];
	if (myStatus.saved_contacts.some((c: any) => c.user_id === targetRow.user_id)) {
		return { success: false, message: 'Contacto ya agregado a tu expediente.' };
	}

	const myAvatar = { ...player.avatar };
	const targetAvatar = { ...targetRow.avatar };
	const targetStatus = { ...(targetRow.game_status || {}) };
	if (!targetStatus.saved_contacts) targetStatus.saved_contacts = [];

	const now = new Date().toISOString();
	myStatus.saved_contacts = [
		...myStatus.saved_contacts,
		{
			user_id: targetRow.user_id,
			name: targetAvatar.name || 'Agente',
			faction_id: targetAvatar.faction_id,
			company: targetAvatar.contact_profile?.company || '',
			phone: targetAvatar.contact_profile?.phone || '',
			email: targetAvatar.contact_profile?.email || '',
			linkedin: targetAvatar.contact_profile?.linkedin || '',
			bio: targetAvatar.contact_profile?.bio || '',
			saved_at: now
		}
	];
	targetStatus.saved_contacts = [
		...targetStatus.saved_contacts,
		{
			user_id: userId,
			name: myAvatar.name || 'Agente',
			faction_id: myAvatar.faction_id,
			company: myAvatar.contact_profile?.company || '',
			phone: myAvatar.contact_profile?.phone || '',
			email: myAvatar.contact_profile?.email || '',
			linkedin: myAvatar.contact_profile?.linkedin || '',
			bio: myAvatar.contact_profile?.bio || '',
			saved_at: now
		}
	];

	const xpAwarded = 10;
	const cpAwarded = 0;
	const eventLevels = await getEventLevels(eventId);
	myAvatar.xp = myAvatar.xp || { points: 0, level: 1 };
	myAvatar.xp.points += xpAwarded;
	myAvatar.xp.level = calculateLevel(myAvatar.xp.points, eventLevels);
	targetAvatar.xp = targetAvatar.xp || { points: 0, level: 1 };
	targetAvatar.xp.points += xpAwarded;
	targetAvatar.xp.level = calculateLevel(targetAvatar.xp.points, eventLevels);

	player.avatar = myAvatar;
	player.game_status = myStatus;
	await persistPlayerState(userId, eventId, player);

	// Best-effort, mismo nivel de riesgo que el resto del archivo — sin
	// bloqueo de fila entre la escritura de ambos jugadores.
	try {
		await supabaseServer
			.from('eventgage_event_avatar')
			.update({ avatar: targetAvatar, game_status: targetStatus, updated_at: now })
			.eq('user_id', targetRow.user_id)
			.eq('event_id', eventId);
	} catch (e) {
		console.warn(`No se pudo persistir el contacto cruzado para "${targetRow.user_id}":`, e);
	}

	await incrementFactionPoints(eventId, myAvatar.faction_id, 3);
	await incrementFactionPoints(eventId, targetAvatar.faction_id, 3);

	await broadcastEventActivity(eventId, 'contact_scanned', {
		targetUserId: targetRow.user_id,
		scannerName: myAvatar.name || 'Agente',
		scannerFactionId: myAvatar.faction_id,
		xpAwarded,
		cpAwarded
	});

	trackAnalyticsEvent(eventId, userId, 'contact_scanned', 'social', {
		target_user_id: targetRow.user_id,
		scanner_faction_id: myAvatar.faction_id,
		target_faction_id: targetAvatar.faction_id
	});

	return attachWorldState(eventId, {
		success: true,
		message: `¡Contacto agregado: ${targetAvatar.name || 'Agente'}! +${xpAwarded} XP, +3 pts de Facción.`,
		playerState: player
	});
}

async function resolveTriviaQuiz(userId: string, eventId: string, player: any, status: any, mission: any, optionId?: string) {
	if (!optionId) {
		return { success: false, message: 'Selecciona una opción antes de responder.' };
	}
	const options = Array.isArray(mission.mechanic?.options) ? mission.mechanic.options : [];
	const chosen = options.find((o: any) => o.id === optionId);
	if (!chosen) {
		return { success: false, message: 'Opción inválida.' };
	}
	const correct = chosen.correct === true;

	const rewards = mission.mechanic?.rewards || {};
	const xpReward = typeof rewards.xp === 'number' ? rewards.xp : 50;
	const cpReward = typeof rewards.cp === 'number' ? rewards.cp : 1;
	const journalEntry = rewards.journal_reflection
		? { title: `Bitácora: ${mission.title}`, content_html: `<p>${escapeHtml(mission.description || '')}</p>` }
		: undefined;

	const milestonesReached = await applyMissionCompletion(userId, eventId, player, status, mission, xpReward, cpReward, journalEntry);

	const impact = mission.mechanic?.faction_impact || { success: 1, fail: 0 };
	const delta = correct ? (impact.success ?? 1) : (impact.fail ?? 0);
	if (delta) await incrementFactionPoints(eventId, player.avatar?.faction_id, delta);
	// Flat ±1 (ver nota en resolveDiceCheck): un fallo da 0 a la facción pero
	// SIGUE sumando a la Inercia, no es un espejo del delta de facción.
	await adjustWorldPoints(eventId, correct ? -1 : 1);

	const commNote = mission.mechanic?.unlock_communication ? ' Revisa la comunicación entrante en el HUD para continuar.' : '';
	const baseMsg = (correct
		? `¡Correcto! Desmontaste el mito. +${xpReward} XP, +${cpReward} 💠.`
		: `No era esa — pero el intento también cuenta. +${xpReward} XP, +${cpReward} 💠.`) + commNote;

	trackAnalyticsEvent(eventId, userId, 'trivia_answered', 'mechanic', {
		mission_id: mission.id,
		option_id: optionId,
		is_correct: correct
	});

	if (!correct) {
		trackAnalyticsEvent(eventId, userId, 'mission_failed', 'progression', {
			mission_id: mission.id,
			mission_type: 'trivia_quiz',
			reason: 'wrong_answer'
		});
	}

	return {
		success: true,
		correct,
		correctOptionId: options.find((o: any) => o.correct === true)?.id,
		milestonesReached,
		message: milestonesReached.length ? `${baseMsg} ${formatMilestoneMessages(milestonesReached)}` : baseMsg,
		playerState: player
	};
}

async function resolveAiPromptChallenge(userId: string, eventId: string, player: any, status: any, mission: any, answerText?: string, skipAi?: boolean) {
	const trimmed = (answerText || '').trim();
	if (trimmed.length < 20 || trimmed.length > 300) {
		return { success: false, message: 'Tu respuesta debe tener entre 20 y 300 caracteres.' };
	}

	const factionName = player?.avatar?.faction_name || player?.avatar?.faction?.name;
	const avatarName = player?.avatar?.name || player?.avatar?.title;

	// Invocación a GIOCCHI: si el usuario solicita respuesta rápida (skipAi),
	// se usa el fallback offline inmediato sin llamar a Gemini.
	let evaluation;
	if (skipAi) {
		const fallbackFeedback = mission?.mechanic?.fallback_feedback || mission?.mechanic?.offline_feedback || AI_PROMPT_FALLBACK_FEEDBACK;
		evaluation = {
			feedback_text: fallbackFeedback,
			xp_awarded: AI_PROMPT_FALLBACK_XP,
			isFallback: true
		};
	} else {
		evaluation = await evaluateAiPromptChallenge({
			userInput: trimmed,
			mission,
			playerFactionName: factionName,
			playerAvatarName: avatarName,
			playerFactionId: player?.avatar?.faction_id,
			playerAvatarId: player?.avatar?.avatar_id
		});
	}

	const rewards = mission.mechanic?.rewards || {};
	const xpBase = typeof rewards.xp_base === 'number' ? rewards.xp_base : 30;
	const xpTotal = xpBase + evaluation.xp_awarded;
	const cpReward = typeof rewards.cp === 'number' ? rewards.cp : 1;

	const journalEntry = {
		title: `Bitácora: ${mission.title}`,
		content_html: `<p><strong>Tu respuesta:</strong> ${escapeHtml(trimmed)}</p><p><strong>Análisis de GIOCCHI (+${evaluation.xp_awarded} XP):</strong><br/>${escapeHtml(evaluation.feedback_text)}</p>`
	};

	const milestonesReached = await applyMissionCompletion(userId, eventId, player, status, mission, xpTotal, cpReward, journalEntry);

	// Regla de impacto en facción e inercia (sección 1.3 / 6.3 de gamescon.md):
	// - Evaluación ≥ 25 XP (pertinente/analítica): +1 punto a la facción
	// - Evaluación < 25 XP: 0 puntos a la facción
	const impact = mission.mechanic?.faction_impact || { ai_score_ge_25: 1, ai_score_lt_25: 0 };
	const delta = evaluation.xp_awarded >= 25 ? (impact.ai_score_ge_25 ?? 1) : (impact.ai_score_lt_25 ?? 0);
	if (delta) await incrementFactionPoints(eventId, player.avatar?.faction_id, delta);
	// Flat ±1 (ver nota en resolveDiceCheck): la evaluación baja igual suma a
	// la Inercia aunque no otorgue punto de facción.
	await adjustWorldPoints(eventId, evaluation.xp_awarded >= 25 ? -1 : 1);

	// Feed Comunitario: solo evaluaciones GENUINAS de GIOCCHI (no el fallback
	// offline, que siempre da 25 XP fijos sin importar la calidad real de la
	// respuesta) — ver decisión de Javier junto a broadcastMilestoneReached.
	if (evaluation.xp_awarded >= 25 && !evaluation.isFallback) {
		await broadcastEventActivity(eventId, 'ai_prompt_highlight', {
			playerName: player.avatar?.name,
			missionTitle: mission.title,
			xpAwarded: evaluation.xp_awarded
		});
	}

	trackAnalyticsEvent(eventId, userId, 'ai_prompt_evaluated', 'mechanic', {
		mission_id: mission.id,
		score_xp: evaluation.xp_awarded,
		is_fallback: evaluation.isFallback,
		response_length: trimmed.length
	});

	const aiCommNote = mission.mechanic?.unlock_communication ? ' Revisa la comunicación entrante en el HUD para continuar.' : '';
	const baseMsg = (evaluation.isFallback
		? `GIOCCHI registró tu reflexión en la Bitácora (modo offline / respuesta rápida). +${xpTotal} XP, +${cpReward} 💠.`
		: `GIOCCHI evaluó tu reflexión (+${evaluation.xp_awarded} XP por pertinencia). +${xpTotal} XP total, +${cpReward} 💠.`) + aiCommNote;

	return {
		success: true,
		feedback: evaluation.feedback_text,
		xpAwarded: evaluation.xp_awarded,
		isFallback: evaluation.isFallback,
		milestonesReached,
		message: milestonesReached.length ? `${baseMsg} ${formatMilestoneMessages(milestonesReached)}` : baseMsg,
		playerState: player
	};
}

export async function resolveMissionForPlayer(
	userId: string,
	eventId: string,
	missionId: string,
	payload: { optionId?: string; answerText?: string; skipAi?: boolean } = {}
) {
	const player = await getPlayerAvatar(userId, eventId);
	if (!player) {
		return { success: false, message: 'Debes unirte al evento y seleccionar un avatar antes de resolver misiones.' };
	}

	const mission = await getRawMissionById(eventId, missionId);
	if (!mission) {
		return { success: false, message: 'Misión no encontrada.' };
	}

	const status = normalizeGameStatus(player.game_status);
	const isUnlocked = mission.public !== false || status.unlocked_missions.includes(missionId);
	if (!isUnlocked) {
		return { success: false, message: 'Esta misión todavía no está desbloqueada. Canjea su código primero.' };
	}
	if (status.completed_missions.includes(missionId)) {
		return { success: false, message: 'Ya completaste esta misión.' };
	}

	switch (mission.mission_type) {
		case 'dice_check':
			return attachWorldState(eventId, await resolveDiceCheck(userId, eventId, player, status, mission));
		case 'trivia_quiz':
			return attachWorldState(eventId, await resolveTriviaQuiz(userId, eventId, player, status, mission, payload.optionId));
		case 'ai_prompt_challenge':
			return attachWorldState(eventId, await resolveAiPromptChallenge(userId, eventId, player, status, mission, payload.answerText, payload.skipAi));
		default:
			return { success: false, message: `El tipo de misión "${mission.mission_type}" no se resuelve por esta vía.` };
	}
}

// Marca que el jugador ya vio la narrativa de onboarding de 4 actos + el
// modal de bienvenida de Cipher, para no repetírsela si vuelve a entrar
// (sección 5/7 del diseño). No bloquea nada si falla: es solo una bandera
// de UX, no una condición de juego.
export async function markNarrativeSeen(userId: string, eventId: string) {
	const player = await getPlayerAvatar(userId, eventId);
	if (!player) {
		return { success: false, message: 'Jugador no encontrado.' };
	}
	const status = normalizeGameStatus(player.game_status);
	status.narrative_seen = true;
	player.game_status = status;
	await persistPlayerState(userId, eventId, player);

	trackAnalyticsEvent(eventId, userId, 'narrative_completed', 'onboarding', {});

	return { success: true, playerState: player };
}

// Persiste la preferencia de mute del jugador (hallazgo 2.x del informe UX:
// `settings.sound` ya existía en el modelo de datos desde el registro inicial,
// pero nada la leía ni la escribía todavía). Falla en silencio si la escritura
// no se pudo persistir — el toggle ya se aplicó en el cliente en el momento,
// simplemente no sobrevive a una recarga si esto no llegó a guardar.
export async function updatePlayerSoundSetting(userId: string, eventId: string, enabled: boolean) {
	const player = await getPlayerAvatar(userId, eventId);
	if (!player) {
		return { success: false, message: 'Jugador no encontrado.' };
	}
	const settings = { ...(player.settings || {}), sound: enabled };
	player.settings = settings;
	try {
		await supabaseServer
			.from('eventgage_event_avatar')
			.update({ settings, updated_at: new Date().toISOString() })
			.eq('user_id', userId)
			.eq('event_id', eventId);
	} catch (e) {
		console.warn('No se pudo persistir la preferencia de sonido:', e);
	}
	const key = `${userId}_${eventId}`;
	memoryStore.eventAvatars.set(key, player);
	return { success: true, playerState: player };
}

export async function resetPlayerAvatar(userId: string, eventId: string) {
	try {
		await supabaseServer
			.from('eventgage_event_avatar')
			.delete()
			.eq('user_id', userId)
			.eq('event_id', eventId);
	} catch (e) {
		console.warn('Error al eliminar avatar de la BD:', e);
	}

	const key = `${userId}_${eventId}`;
	memoryStore.eventAvatars.delete(key);
	return { success: true };
}

/**
 * Resetea el progreso del jugador (misiones, códigos, bitácora, XP, nivel)
 * conservando su avatar, clase, facción y nombre (Comando de QA F9 en Dev).
 */
export async function softResetPlayerProgress(userId: string, eventId: string) {
	const player = await getPlayerAvatar(userId, eventId);
	if (!player) return { success: false, message: 'Jugador no encontrado' };

	const initialStatusObj = {
		viewed_dialogues: [],
		journal: [],
		unlocked_items: [],
		unlocked_missions: ['m_code_01'],
		completed_missions: [],
		current_mission_id: 'm_code_01',
		redeemed_codes: [],
		milestones_claimed: [],
		narrative_seen: true,
		votes: {},
		dice_check_outcomes: {},
		unlocked_rewards: []
	};

	const updatedAvatar = {
		...player.avatar,
		xp: { points: 0, level: 1 },
		rank: 1,
		rank_title: 'Recluta de la Red'
	};

	try {
		await supabaseServer
			.from('eventgage_event_avatar')
			.update({
				avatar: updatedAvatar,
				game_status: initialStatusObj
			})
			.eq('user_id', userId)
			.eq('event_id', eventId);
	} catch (e) {
		console.warn('Error al hacer soft reset en BD:', e);
	}

	const key = `${userId}_${eventId}`;
	player.avatar = updatedAvatar;
	player.game_status = initialStatusObj;
	memoryStore.eventAvatars.set(key, player);
	return { success: true, playerState: player };
}

// =========================================================================
// FUNCIONES ADMINISTRATIVAS: CONSOLA DE GAME MASTERS (/[slug]/game-masters)
// =========================================================================

/**
 * Retorna la tabla de líderes consolidada de todos los jugadores del evento.
 */
export async function getAdminLeaderboard(eventId: string) {
	try {
		const [{ data: avatars }, eventLevels] = await Promise.all([
			supabaseServer
				.from('eventgage_event_avatar')
				.select('*, eventgage_user(email, full_name)')
				.eq('event_id', eventId),
			getEventLevels(eventId)
		]);

		if (!avatars || !avatars.length) return [];

		return avatars.map((row: any) => {
			const av = row.avatar || {};
			const gs = row.game_status || {};
			const xpPoints = av.xp?.points ?? 0;
			const level = av.xp?.level ?? calculateLevel(xpPoints, eventLevels);
			return {
				id: row.id,
				user_id: row.user_id,
				email: row.eventgage_user?.email || 'anon@eventgage.com',
				full_name: row.eventgage_user?.full_name || av.name || 'Agente',
				avatar_name: av.name || 'Agente',
				class_name: av.class_name || 'Agente',
				gender: av.gender || 'male',
				faction_id: av.faction_id || null,
				xp_points: xpPoints,
				level,
				rank_title: av.rank_title || 'Recluta de la Red',
				cp_points: av.cp?.points ?? 0,
				completed_missions_count: (gs.completed_missions || []).length,
				unlocked_rewards_count: (gs.unlocked_rewards || []).length,
				vip_token: gs.vip_token || null,
				created_at: row.created_at
			};
		}).sort((a: any, b: any) => b.xp_points - a.xp_points);
	} catch (e) {
		console.error('[eventService] Error consultando getAdminLeaderboard:', e);
		return [];
	}
}

/**
 * Retorna la auditoría de recompensas canjeadas por los participantes.
 */
export async function getAdminRedemptions(eventId: string) {
	try {
		const [rewards, leaderboard] = await Promise.all([
			getEventRewards(eventId),
			getAdminLeaderboard(eventId)
		]);

		const redemptions: Array<{
			player_name: string;
			email: string;
			faction_id: string | null;
			reward_id: string;
			reward_name: string;
			reward_category: string;
			vip_token: string | null;
		}> = [];

		const rewardMap = new Map((rewards || []).map((r: any) => [r.id, r]));

		for (const player of leaderboard) {
			const avatarRow = await getPlayerAvatar(player.user_id, eventId);
			const unlockedRewards = avatarRow?.game_status?.unlocked_rewards || [];
			for (const rId of unlockedRewards) {
				const rObj = rewardMap.get(rId);
				redemptions.push({
					player_name: player.avatar_name,
					email: player.email,
					faction_id: player.faction_id,
					reward_id: rId,
					reward_name: rObj?.name || rId,
					reward_category: rObj?.category || 'general',
					vip_token: rId === 'rew_prime_vip_consultancy' ? player.vip_token : null
				});
			}
		}

		return { rewards, redemptions };
	} catch (e) {
		console.error('[eventService] Error consultando getAdminRedemptions:', e);
		return { rewards: [], redemptions: [] };
	}
}

/**
 * Crea o actualiza una recompensa en la Bóveda del evento.
 */
export async function createAdminReward(
	eventId: string,
	data: { id?: string; name: string; category: string; cost: number; description?: string; min_level?: number; file_url?: string }
) {
	const rewardId = data.id || `rew_${Date.now()}_${data.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15)}`;
	const payload = {
		id: rewardId,
		event_id: eventId,
		name: data.name,
		category: data.category,
		cost: data.cost,
		description: data.description || '',
		min_level: data.min_level || 1,
		file_url: data.file_url || null
	};

	const { error } = await supabaseServer
		.from('eventgage_event_rewards')
		.upsert(payload, { onConflict: 'id, event_id' });

	if (error) {
		console.error('[eventService] Error guardando reward admin:', error);
		return { success: false, message: error.message };
	}
	return { success: true, reward: payload };
}

/**
 * Retorna todos los códigos del evento con su categoría, display_id y detalles de misión.
 */
export async function getAdminCodes(eventId: string) {
	try {
		const [codesRes, missionsRes] = await Promise.all([
			supabaseServer
				.from('eventgage_event_codes')
				.select('*')
				.eq('event_id', eventId),
			supabaseServer
				.from('eventgage_event_missions')
				.select('id, title, mission_type, mechanic')
				.eq('event_id', eventId)
		]);

		const missions = missionsRes.data || [];
		const missionMap = new Map(missions.map((m: any) => [m.id, m]));

		const codes = (codesRes.data || []).map((c: any) => {
			const mission = c.unlocks_mission ? missionMap.get(c.unlocks_mission) : null;
			return {
				id: c.id,
				code: c.code,
				category: c.category || 'recinto',
				display_id: c.display_id || c.id,
				description: c.description || mission?.title || '',
				unlocks_mission: c.unlocks_mission || null,
				unlocks_item: c.unlocks_item || null,
				rewards: c.rewards || {},
				mission_title: mission?.title || null,
				mission_type: mission?.mission_type || null,
				gm_group: mission?.mechanic?.gm_group || null
			};
		});

		// Ordenar: game_master primero por display_id, luego recinto
		return codes.sort((a: any, b: any) => {
			if (a.category !== b.category) {
				return a.category === 'game_master' ? -1 : 1;
			}
			return (a.display_id || '').localeCompare(b.display_id || '', undefined, { numeric: true });
		});
	} catch (e) {
		console.error('[eventService] Error consultando getAdminCodes:', e);
		return [];
	}
}

/**
 * Crea o actualiza un código secreto en el evento.
 */
export async function createAdminCode(
	eventId: string,
	data: { id?: string; code: string; category: string; display_id?: string; description?: string; unlocks_mission?: string; unlocks_item?: string; rewards?: any }
) {
	const codeId = data.id || `code_${Date.now()}_${data.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
	const cleanCode = data.code.trim().toUpperCase();

	const { data: existing } = await supabaseServer
		.from('eventgage_event_codes')
		.select('id')
		.eq('event_id', eventId)
		.eq('code', cleanCode)
		.neq('id', codeId);

	if (existing && existing.length > 0) {
		return { success: false, message: `El código "${cleanCode}" ya existe en este evento.` };
	}

	const payload = {
		id: codeId,
		event_id: eventId,
		code: cleanCode,
		category: data.category || 'recinto',
		display_id: data.display_id || cleanCode,
		description: data.description || '',
		unlocks_mission: data.unlocks_mission || null,
		unlocks_item: data.unlocks_item || null,
		rewards: data.rewards || {}
	};

	const { error } = await supabaseServer
		.from('eventgage_event_codes')
		.upsert(payload, { onConflict: 'id, event_id' });

	if (error) {
		console.error('[eventService] Error guardando código admin:', error);
		return { success: false, message: error.message };
	}
	return { success: true, code: payload };
}

/**
 * Guarda o actualiza un mapa y sus hotspots.
 */
export async function saveAdminMap(
	eventId: string,
	data: { id?: string; name: string; image_url: string; hotspots?: any[] }
) {
	const mapId = data.id || `map_${Date.now()}`;
	const payload = {
		id: mapId,
		event_id: eventId,
		name: data.name,
		image_url: data.image_url,
		hotspots: data.hotspots || []
	};

	const { error } = await supabaseServer
		.from('eventgage_event_maps')
		.upsert(payload, { onConflict: 'id, event_id' });

	if (error) {
		console.error('[eventService] Error guardando mapa admin:', error);
		return { success: false, message: error.message };
	}
	return { success: true, map: payload };
}

/**
 * Alterna el estado activo/inactivo (iluminación) de un hotspot específico en un mapa.
 */
export async function toggleHotspotActive(eventId: string, mapId: string, hotspotId: string, isActive: boolean) {
	try {
		const maps = await getEventMaps(eventId);
		const targetMap = maps.find((m: any) => m.id === mapId);
		if (!targetMap) return { success: false, message: 'Mapa no encontrado' };

		const hotspots = (targetMap.hotspots || []).map((hs: any) => {
			if (hs.id === hotspotId || hs.title === hotspotId) {
				return { ...hs, is_active: isActive };
			}
			return hs;
		});

		const { error } = await supabaseServer
			.from('eventgage_event_maps')
			.update({ hotspots })
			.eq('id', mapId)
			.eq('event_id', eventId);

		if (error) return { success: false, message: error.message };
		return { success: true, hotspots };
	} catch (e: any) {
		console.error('[eventService] Error en toggleHotspotActive:', e);
		return { success: false, message: e.message };
	}
}

/**
 * Retorna todos los personajes del evento.
 */
export async function getAdminCharacters(eventId: string) {
	try {
		const { data } = await supabaseServer
			.from('eventgage_event_characters')
			.select('*')
			.eq('event_id', eventId);
		return data || [];
	} catch (e) {
		console.error('[eventService] Error consultando getAdminCharacters:', e);
		return [];
	}
}

/**
 * Crea o actualiza un personaje para transmisiones y diálogos.
 */
export async function createAdminCharacter(
	eventId: string,
	data: { id?: string; name: string; portrait_url?: string; role?: string }
) {
	const charId = data.id || `char_${Date.now()}_${data.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15)}`;
	const payload = {
		id: charId,
		event_id: eventId,
		name: data.name,
		portrait_url: data.portrait_url || null,
		role: data.role || 'Operador de Enlace'
	};

	const { error } = await supabaseServer
		.from('eventgage_event_characters')
		.upsert(payload, { onConflict: 'id, event_id' });

	if (error) {
		console.error('[eventService] Error guardando personaje admin:', error);
		return { success: false, message: error.message };
	}
	return { success: true, character: payload };
}

/**
 * Emite una alerta/transmisión del Game Master hacia bem.eventgage_event_alerts
 * y difunde inmediatamente en Realtime para los jugadores conectados.
 */
export async function sendAdminAlert(
	eventId: string,
	data: { message: string; type?: string; expiration_seconds?: number; media_url?: string; character_id?: string; title?: string }
) {
	const alertId = `alert_${Date.now()}`;
	const payload = {
		id: alertId,
		event_id: eventId,
		title: data.title || null,
		message: data.message,
		type: data.type || 'info',
		expiration_seconds: data.expiration_seconds || 30,
		media_url: data.media_url || null,
		character_id: data.character_id || null,
		scheduled_at: new Date().toISOString()
	};

	const { error } = await supabaseServer
		.from('eventgage_event_alerts')
		.insert(payload);

	if (error) {
		console.error('[eventService] Error insertando alerta admin:', error);
		return { success: false, message: error.message };
	}

	let speakerName: string | undefined;
	let portraitUrl: string | null | undefined;
	if (payload.character_id) {
		const { data: char } = await supabaseServer
			.from('eventgage_event_characters')
			.select('name, portrait_url')
			.eq('id', payload.character_id)
			.eq('event_id', eventId)
			.maybeSingle();
		if (char) {
			speakerName = char.name;
			portraitUrl = char.portrait_url;
		}
	}

	// Difundir en tiempo real a todos los jugadores conectados
	await broadcastEventActivity(eventId, 'gm_alert', {
		alertId,
		title: payload.title,
		message: payload.message,
		alertType: payload.type,
		expirationSeconds: payload.expiration_seconds,
		characterId: payload.character_id,
		speakerName,
		portraitUrl
	});

	return {
		success: true,
		alert: {
			...payload,
			speaker_name: speakerName,
			portrait_url: portraitUrl
		}
	};
}



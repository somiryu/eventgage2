import { supabaseServer } from './supabaseClient';
import { dev } from '$app/environment';

export type AnalyticsCategory =
	| 'onboarding'
	| 'progression'
	| 'mechanic'
	| 'social'
	| 'economy'
	| 'exploration'
	| 'system';

export type AnalyticsEventName =
	| 'player_registered'
	| 'player_joined'
	| 'narrative_completed'
	| 'mission_started'
	| 'mission_completed'
	| 'mission_failed'
	| 'code_redeemed'
	| 'code_failed'
	| 'level_up'
	| 'milestone_reached'
	| 'dice_check_rolled'
	| 'trivia_answered'
	| 'ai_prompt_evaluated'
	| 'time_bomb_defused'
	| 'time_bomb_expired'
	| 'contact_profile_activated'
	| 'contact_scanned'
	| 'vote_submitted'
	| 'treaty_signed'
	| 'reward_purchased'
	| 'sp_boost_activated'
	| 'dice_retry_used'
	| 'hotspot_clicked'
	| 'audio_played';

export interface AnalyticsEventRecord {
	id?: string;
	event_id: string;
	user_id: string | null;
	event_name: AnalyticsEventName;
	category: AnalyticsCategory;
	payload: Record<string, any>;
	created_at?: string;
}

// Memoria volátil para desarrollo local si Supabase no está conectado o falla
const analyticsMemoryStore: AnalyticsEventRecord[] = [];

/**
 * Registra un evento analítico en bem.eventgage_analytics_events de forma asíncrona y segura.
 * Nunca lanza excepciones que interrumpan el flujo de juego del jugador.
 */
export async function trackAnalyticsEvent(
	eventId: string,
	userId: string | null,
	eventName: AnalyticsEventName,
	category: AnalyticsCategory,
	payload: Record<string, any> = {}
): Promise<void> {
	if (!eventId) return;

	const now = new Date().toISOString();
	const eventRecord: AnalyticsEventRecord = {
		event_id: eventId,
		user_id: userId || null,
		event_name: eventName,
		category,
		payload: payload || {},
		created_at: now
	};

	// Guardar en memoria local exclusivamente en entorno dev local
	if (dev) {
		analyticsMemoryStore.push(eventRecord);
		if (analyticsMemoryStore.length > 5000) {
			analyticsMemoryStore.shift(); // Prevenir crecimiento desmedido en memoria
		}
	}

	try {
		const { error } = await supabaseServer
			.from('eventgage_analytics_events')
			.insert({
				event_id: eventId,
				user_id: userId || null,
				event_name: eventName,
				category,
				payload: payload || {},
				created_at: now
			});

		if (error) {
			if (dev) {
				console.warn(`[analyticsService] Advertencia al insertar evento "${eventName}":`, error.message);
			}
		}
	} catch (err: any) {
		if (dev) {
			console.warn(`[analyticsService] Error al registrar analítica "${eventName}":`, err?.message || err);
		}
	}
}

/**
 * Genera un conjunto rico de datos mock analíticos en desarrollo local para visualizar
 * métricas, gráficos de barras horarios, desglose de mecánicas y reportes realistas.
 * En producción (!dev) esta función es un no-op estricto para evitar filtración de datos mock.
 */
export function seedMockAnalyticsEvents(eventId: string): void {
	if (!dev) return;

	const today = new Date();
	const y = today.getFullYear();
	const m = String(today.getMonth() + 1).padStart(2, '0');
	const d = String(today.getDate()).padStart(2, '0');
	const prefix = `${y}-${m}-${d}`;

	const mockEvents: AnalyticsEventRecord[] = [
		// 09:00 - Onboarding & Registro de agentes
		{ event_id: eventId, user_id: 'usr_01', event_name: 'player_joined', category: 'onboarding', payload: { avatar_id: 'avatar_disenador_conductual', faction_id: 'fac_aprendizaje_activo', agent_name: 'Agente Vance' }, created_at: `${prefix}T09:05:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'player_joined', category: 'onboarding', payload: { avatar_id: 'avatar_arquitecto_experiencias', faction_id: 'fac_impacto_valor', agent_name: 'Dra. Huizinga' }, created_at: `${prefix}T09:12:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'player_joined', category: 'onboarding', payload: { avatar_id: 'avatar_facilitador_sistemico', faction_id: 'fac_agilidad_autonomia', agent_name: 'Operador Miller' }, created_at: `${prefix}T09:20:00.000Z` },
		{ event_id: eventId, user_id: 'usr_04', event_name: 'player_joined', category: 'onboarding', payload: { avatar_id: 'avatar_director_estrategico', faction_id: 'fac_aprendizaje_activo', agent_name: 'Estratega Kai' }, created_at: `${prefix}T09:30:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'narrative_completed', category: 'onboarding', payload: {}, created_at: `${prefix}T09:10:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'narrative_completed', category: 'onboarding', payload: {}, created_at: `${prefix}T09:16:00.000Z` },

		// 10:00 - Exploración del recinto y canje de primeros códigos
		{ event_id: eventId, user_id: 'usr_01', event_name: 'code_redeemed', category: 'progression', payload: { code: 'REC-01', display_id: 'REC-01', xp_awarded: 150, cp_awarded: 50 }, created_at: `${prefix}T10:02:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_code_01', mission_type: 'code', xp_awarded: 150, cp_awarded: 50 }, created_at: `${prefix}T10:02:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'code_redeemed', category: 'progression', payload: { code: 'REC-01', display_id: 'REC-01', xp_awarded: 150, cp_awarded: 50 }, created_at: `${prefix}T10:14:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_code_01', mission_type: 'code', xp_awarded: 150, cp_awarded: 50 }, created_at: `${prefix}T10:14:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'code_failed', category: 'progression', payload: { code: 'REC-99', reason: 'invalid_code' }, created_at: `${prefix}T10:25:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'code_redeemed', category: 'progression', payload: { code: 'REC-02', display_id: 'REC-02', xp_awarded: 150, cp_awarded: 50 }, created_at: `${prefix}T10:28:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_code_02', mission_type: 'code', xp_awarded: 150, cp_awarded: 50 }, created_at: `${prefix}T10:28:00.000Z` },
		{ event_id: eventId, user_id: 'usr_05', event_name: 'player_joined', category: 'onboarding', payload: { avatar_id: 'avatar_disenador_conductual', faction_id: 'fac_impacto_valor', agent_name: 'Agente Sara' }, created_at: `${prefix}T10:35:00.000Z` },
		{ event_id: eventId, user_id: 'usr_06', event_name: 'player_joined', category: 'onboarding', payload: { avatar_id: 'avatar_facilitador_sistemico', faction_id: 'fac_agilidad_autonomia', agent_name: 'Agente Leo' }, created_at: `${prefix}T10:45:00.000Z` },

		// 11:00 - Retos de tirada de dados d20 y trivias
		{ event_id: eventId, user_id: 'usr_01', event_name: 'dice_check_rolled', category: 'mechanic', payload: { mission_id: 'm_dice_01', attribute: 'EST', roll: 14, modifier: 7, total: 21, dc: 12, success: true }, created_at: `${prefix}T11:05:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_dice_01', mission_type: 'dice_check', xp_awarded: 50, cp_awarded: 1 }, created_at: `${prefix}T11:05:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'dice_check_rolled', category: 'mechanic', payload: { mission_id: 'm_dice_01', attribute: 'DIS', roll: 3, modifier: 5, total: 8, dc: 12, success: false }, created_at: `${prefix}T11:10:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'mission_failed', category: 'progression', payload: { mission_id: 'm_dice_01', mission_type: 'dice_check', reason: 'dc_not_met' }, created_at: `${prefix}T11:10:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'trivia_answered', category: 'mechanic', payload: { mission_id: 'm_trivia_01', option_id: 'opt_b', is_correct: true }, created_at: `${prefix}T11:25:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_trivia_01', mission_type: 'trivia_quiz', xp_awarded: 50, cp_awarded: 1 }, created_at: `${prefix}T11:25:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'trivia_answered', category: 'mechanic', payload: { mission_id: 'm_trivia_01', option_id: 'opt_b', is_correct: true }, created_at: `${prefix}T11:35:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_trivia_01', mission_type: 'trivia_quiz', xp_awarded: 50, cp_awarded: 1 }, created_at: `${prefix}T11:35:00.000Z` },
		{ event_id: eventId, user_id: 'usr_04', event_name: 'trivia_answered', category: 'mechanic', payload: { mission_id: 'm_trivia_01', option_id: 'opt_a', is_correct: false }, created_at: `${prefix}T11:42:00.000Z` },
		{ event_id: eventId, user_id: 'usr_04', event_name: 'mission_failed', category: 'progression', payload: { mission_id: 'm_trivia_01', mission_type: 'trivia_quiz', reason: 'wrong_answer' }, created_at: `${prefix}T11:42:00.000Z` },

		// 12:00 - Networking, juego de contactos y reflexiones GIOCCHI
		{ event_id: eventId, user_id: 'usr_01', event_name: 'contact_profile_activated', category: 'social', payload: { personal_code: '@X7K9M2', company: 'Agencia Huizinga' }, created_at: `${prefix}T12:05:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'contact_profile_activated', category: 'social', payload: { personal_code: '@B4M8N1', company: 'Universidad Central' }, created_at: `${prefix}T12:08:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'contact_profile_activated', category: 'social', payload: { personal_code: '@Z9Q3R5', company: 'Tech Hub Bogotá' }, created_at: `${prefix}T12:12:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'contact_scanned', category: 'social', payload: { target_user_id: 'usr_02', scanner_faction_id: 'fac_aprendizaje_activo', target_faction_id: 'fac_impacto_valor' }, created_at: `${prefix}T12:15:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'contact_scanned', category: 'social', payload: { target_user_id: 'usr_03', scanner_faction_id: 'fac_impacto_valor', target_faction_id: 'fac_agilidad_autonomia' }, created_at: `${prefix}T12:22:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'contact_scanned', category: 'social', payload: { target_user_id: 'usr_01', scanner_faction_id: 'fac_agilidad_autonomia', target_faction_id: 'fac_aprendizaje_activo' }, created_at: `${prefix}T12:29:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'ai_prompt_evaluated', category: 'mechanic', payload: { mission_id: 'm01_giocchi_calibration', mission_title: 'Misión 01: Calibración Conceptual', player_name: 'Agente Alex Vance', faction_id: 'fac_aprendizaje_activo', faction_name: 'División de Aprendizaje Activo', avatar_title: 'El Diseñador Conductual', user_response_text: 'El mito es creer que la gamificación solo sirve para entretener o dar puntos de descuento, ignorando que el aprendizaje requiere andamiaje y retroalimentación oportuna para consolidar hábitos reales.', giocchi_feedback: 'Excelente análisis conductual. Identificas con precisión que el valor reside en el andamiaje y la retroalimentación formativa, no en cosmética.', score_xp: 35, is_fallback: false, response_length: 180 }, created_at: `${prefix}T12:35:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_ai_prompt_01', mission_type: 'ai_prompt_challenge', xp_awarded: 65, cp_awarded: 1 }, created_at: `${prefix}T12:35:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'milestone_reached', category: 'progression', payload: { count: 3, rank: 2, rank_title: 'Agente de Campo', sp_bonus: 2 }, created_at: `${prefix}T12:35:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'level_up', category: 'progression', payload: { old_level: 1, new_level: 2, total_xp: 265 }, created_at: `${prefix}T12:35:00.000Z` },

		// 13:00 - Canjes en Bóveda, Time-Bomb y reintentos
		{ event_id: eventId, user_id: 'usr_01', event_name: 'reward_purchased', category: 'economy', payload: { reward_id: 'rew_boost_sp', reward_name: 'Sobrecarga de Atributo', category: 'game_aid', cost_cp: 1 }, created_at: `${prefix}T13:05:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'sp_boost_activated', category: 'economy', payload: { charges_added: 3 }, created_at: `${prefix}T13:06:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'reward_purchased', category: 'economy', payload: { reward_id: 'rew_item_reintento', reward_name: 'Ficha de Reintento', category: 'game_aid', cost_cp: 2 }, created_at: `${prefix}T13:15:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'dice_retry_used', category: 'economy', payload: { mission_id: 'm_dice_01' }, created_at: `${prefix}T13:18:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'dice_check_rolled', category: 'mechanic', payload: { mission_id: 'm_dice_01', attribute: 'DIS', roll: 18, modifier: 5, total: 23, dc: 12, success: true, is_retry: true }, created_at: `${prefix}T13:18:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_dice_01', mission_type: 'dice_check', xp_awarded: 50, cp_awarded: 1 }, created_at: `${prefix}T13:18:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'time_bomb_defused', category: 'mechanic', payload: { mission_id: 'm_time_bomb_01', seconds_remaining: 120 }, created_at: `${prefix}T13:40:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_time_bomb_01', mission_type: 'time_bomb', xp_awarded: 250, cp_awarded: 100 }, created_at: `${prefix}T13:40:00.000Z` },

		// 14:00 - Votaciones colectivas en plenaria
		{ event_id: eventId, user_id: 'usr_01', event_name: 'vote_submitted', category: 'social', payload: { mission_id: 'm_vote_01', option_id: 'opt_plenaria_a', faction_id: 'fac_aprendizaje_activo' }, created_at: `${prefix}T14:10:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_vote_01', mission_type: 'collective_vote', xp_awarded: 100, cp_awarded: 30 }, created_at: `${prefix}T14:10:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'vote_submitted', category: 'social', payload: { mission_id: 'm_vote_01', option_id: 'opt_plenaria_a', faction_id: 'fac_impacto_valor' }, created_at: `${prefix}T14:12:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_vote_01', mission_type: 'collective_vote', xp_awarded: 100, cp_awarded: 30 }, created_at: `${prefix}T14:12:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'vote_submitted', category: 'social', payload: { mission_id: 'm_vote_01', option_id: 'opt_plenaria_b', faction_id: 'fac_agilidad_autonomia' }, created_at: `${prefix}T14:15:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'mission_completed', category: 'progression', payload: { mission_id: 'm_vote_01', mission_type: 'collective_vote', xp_awarded: 100, cp_awarded: 30 }, created_at: `${prefix}T14:15:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'level_up', category: 'progression', payload: { old_level: 3, new_level: 4, total_xp: 950 }, created_at: `${prefix}T14:20:00.000Z` },
		{ event_id: eventId, user_id: 'usr_01', event_name: 'reward_purchased', category: 'economy', payload: { reward_id: 'rew_prime_vip_consultancy', reward_name: 'Pase VIP', category: 'vip_lead', cost_cp: 2, token_generated: 'PRIME-VIP-A7K92M', min_level: 4 }, created_at: `${prefix}T14:25:00.000Z` },

		// 15:00 - Firmas del Tratado Huizinga
		{ event_id: eventId, user_id: 'usr_01', event_name: 'treaty_signed', category: 'social', payload: { faction_id: 'fac_aprendizaje_activo', rank: 4 }, created_at: `${prefix}T15:10:00.000Z` },
		{ event_id: eventId, user_id: 'usr_02', event_name: 'treaty_signed', category: 'social', payload: { faction_id: 'fac_impacto_valor', rank: 3 }, created_at: `${prefix}T15:15:00.000Z` },
		{ event_id: eventId, user_id: 'usr_03', event_name: 'treaty_signed', category: 'social', payload: { faction_id: 'fac_agilidad_autonomia', rank: 3 }, created_at: `${prefix}T15:20:00.000Z` },
		{ event_id: eventId, user_id: 'usr_04', event_name: 'treaty_signed', category: 'social', payload: { faction_id: 'fac_aprendizaje_activo', rank: 2 }, created_at: `${prefix}T15:25:00.000Z` },
		{ event_id: eventId, user_id: 'usr_05', event_name: 'treaty_signed', category: 'social', payload: { faction_id: 'fac_impacto_valor', rank: 2 }, created_at: `${prefix}T15:30:00.000Z` }
	];

	for (const ev of mockEvents) {
		analyticsMemoryStore.push(ev);
	}
}

/**
 * Obtiene todos los eventos de analítica registrados para un evento específico.
 * En producción (!dev): lee EXCLUSIVAMENTE de Supabase bem.eventgage_analytics_events.
 * En desarrollo (dev): si Supabase está vacío o offline, recurre al store en memoria y semilla mock.
 */
export async function getRawAnalyticsEvents(eventId: string, limit = 5000): Promise<AnalyticsEventRecord[]> {
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_analytics_events')
			.select('*')
			.eq('event_id', eventId)
			.order('created_at', { ascending: true })
			.limit(limit);

		if (!error && data) {
			if (!dev) {
				// En producción: siempre retornar los datos reales de Supabase (o array vacío si aún no hay)
				return data as AnalyticsEventRecord[];
			}
			if (data.length > 0) {
				return data as AnalyticsEventRecord[];
			}
		}
	} catch (e) {
		console.warn(`[analyticsService] Error consultando eventos en Supabase para eventId="${eventId}":`, e);
		if (!dev) {
			return [];
		}
	}

	// En producción, si hubo error o no hay conexión, nunca devolver datos falsos o mock
	if (!dev) {
		return [];
	}

	// Exclusivo para entorno de desarrollo local (dev === true):
	let localEvents = analyticsMemoryStore.filter((e) => e.event_id === eventId);
	if (localEvents.length === 0) {
		seedMockAnalyticsEvents(eventId);
		localEvents = analyticsMemoryStore.filter((e) => e.event_id === eventId);
	}

	return localEvents;
}

/**
 * Reporte de misiones completadas por bloques de 1 hora.
 */
export async function getHourlyMissionsAnalytics(eventId: string) {
	const events = await getRawAnalyticsEvents(eventId);
	const missionEvents = events.filter((e) => e.event_name === 'mission_completed');

	const hourlyMap = new Map<string, { count: number; types: Record<string, number> }>();

	for (const ev of missionEvents) {
		const date = new Date(ev.created_at || Date.now());
		// Clave en formato ISO de hora: YYYY-MM-DDTHH:00
		const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00`;
		const missionType = ev.payload?.mission_type || 'unknown';

		if (!hourlyMap.has(hourKey)) {
			hourlyMap.set(hourKey, { count: 0, types: {} });
		}
		const bucket = hourlyMap.get(hourKey)!;
		bucket.count += 1;
		bucket.types[missionType] = (bucket.types[missionType] || 0) + 1;
	}

	// Si no hay eventos, retornar un arreglo con la hora actual
	if (hourlyMap.size === 0) {
		const now = new Date();
		const hourKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:00`;
		return [
			{
				hourKey,
				hourLabel: `${String(now.getHours()).padStart(2, '0')}:00`,
				count: 0,
				types: {}
			}
		];
	}

	const sortedKeys = Array.from(hourlyMap.keys()).sort();
	return sortedKeys.map((key) => {
		const date = new Date(key);
		const hourLabel = `${String(date.getHours()).padStart(2, '0')}:00`;
		const data = hourlyMap.get(key)!;
		return {
			hourKey: key,
			hourLabel,
			count: data.count,
			types: data.types
		};
	});
}

/**
 * Reporte general de actividad por hora (todos los eventos y usuarios únicos por hora).
 */
export async function getHourlyActivityAnalytics(eventId: string) {
	const events = await getRawAnalyticsEvents(eventId);

	const hourlyMap = new Map<string, { totalEvents: number; uniqueUsers: Set<string>; categories: Record<string, number> }>();

	for (const ev of events) {
		const date = new Date(ev.created_at || Date.now());
		const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00`;
		const category = ev.category || 'general';

		if (!hourlyMap.has(hourKey)) {
			hourlyMap.set(hourKey, { totalEvents: 0, uniqueUsers: new Set<string>(), categories: {} });
		}
		const bucket = hourlyMap.get(hourKey)!;
		bucket.totalEvents += 1;
		if (ev.user_id) bucket.uniqueUsers.add(ev.user_id);
		bucket.categories[category] = (bucket.categories[category] || 0) + 1;
	}

	const sortedKeys = Array.from(hourlyMap.keys()).sort();
	return sortedKeys.map((key) => {
		const date = new Date(key);
		const hourLabel = `${String(date.getHours()).padStart(2, '0')}:00`;
		const data = hourlyMap.get(key)!;
		return {
			hourKey: key,
			hourLabel,
			totalEvents: data.totalEvents,
			uniqueUsersCount: data.uniqueUsers.size,
			categories: data.categories
		};
	});
}

/**
 * Resumen consolidado de KPIs de Comportamiento y Engagement.
 */
export async function getEventOverviewReport(eventId: string) {
	const events = await getRawAnalyticsEvents(eventId);

	const uniqueUsers = new Set<string>();
	let playersJoined = 0;
	let missionsCompleted = 0;
	let missionsFailed = 0;
	let codesRedeemed = 0;
	let contactsScanned = 0;
	let rewardsPurchased = 0;
	let votesSubmitted = 0;
	let treatiesSigned = 0;
	let totalXpDistributed = 0;
	let totalCpDistributed = 0;

	const factionActivity: Record<string, number> = {};
	const avatarDistribution: Record<string, number> = {};
	const levelDistribution: Record<number, number> = {};

	for (const ev of events) {
		if (ev.user_id) uniqueUsers.add(ev.user_id);

		switch (ev.event_name) {
			case 'player_joined':
				playersJoined += 1;
				if (ev.payload?.faction_id) {
					factionActivity[ev.payload.faction_id] = (factionActivity[ev.payload.faction_id] || 0) + 1;
				}
				if (ev.payload?.avatar_id) {
					avatarDistribution[ev.payload.avatar_id] = (avatarDistribution[ev.payload.avatar_id] || 0) + 1;
				}
				break;
			case 'mission_completed':
				missionsCompleted += 1;
				if (typeof ev.payload?.xp_awarded === 'number') totalXpDistributed += ev.payload.xp_awarded;
				if (typeof ev.payload?.cp_awarded === 'number') totalCpDistributed += ev.payload.cp_awarded;
				break;
			case 'mission_failed':
				missionsFailed += 1;
				break;
			case 'code_redeemed':
				codesRedeemed += 1;
				break;
			case 'contact_scanned':
				contactsScanned += 1;
				break;
			case 'reward_purchased':
				rewardsPurchased += 1;
				break;
			case 'vote_submitted':
				votesSubmitted += 1;
				break;
			case 'treaty_signed':
				treatiesSigned += 1;
				break;
			case 'level_up':
				if (typeof ev.payload?.new_level === 'number') {
					const lvl = ev.payload.new_level;
					levelDistribution[lvl] = (levelDistribution[lvl] || 0) + 1;
				}
				break;
		}
	}

	const completionRate = missionsCompleted + missionsFailed > 0
		? Math.round((missionsCompleted / (missionsCompleted + missionsFailed)) * 100)
		: 100;

	return {
		totalEvents: events.length,
		uniqueActiveUsers: uniqueUsers.size,
		playersJoined,
		missionsCompleted,
		missionsFailed,
		completionRate,
		codesRedeemed,
		contactsScanned,
		rewardsPurchased,
		votesSubmitted,
		treatiesSigned,
		totalXpDistributed,
		totalCpDistributed,
		factionActivity,
		avatarDistribution,
		levelDistribution
	};
}

/**
 * Reporte de efectividad por mecánica de juego (dice_check, trivia, prompt AI, time_bomb, etc.).
 */
export async function getMechanicsBreakdownReport(eventId: string) {
	const events = await getRawAnalyticsEvents(eventId);

	const mechanics: Record<
		string,
		{
			totalAttempts: number;
			successCount: number;
			failCount: number;
			successRate: number;
			totalXp: number;
			details: any;
		}
	> = {
		dice_check: { totalAttempts: 0, successCount: 0, failCount: 0, successRate: 0, totalXp: 0, details: { rollsSum: 0, avgRoll: 0, spBoostCount: 0 } },
		trivia_quiz: { totalAttempts: 0, successCount: 0, failCount: 0, successRate: 0, totalXp: 0, details: {} },
		ai_prompt_challenge: { totalAttempts: 0, successCount: 0, failCount: 0, successRate: 0, totalXp: 0, details: { aiScores: [] as number[], fallbackCount: 0 } },
		time_bomb: { totalAttempts: 0, successCount: 0, failCount: 0, successRate: 0, totalXp: 0, details: { defused: 0, expired: 0 } },
		code: { totalAttempts: 0, successCount: 0, failCount: 0, successRate: 0, totalXp: 0, details: {} }
	};

	for (const ev of events) {
		if (ev.event_name === 'dice_check_rolled') {
			const m = mechanics.dice_check;
			m.totalAttempts += 1;
			if (ev.payload?.success) m.successCount += 1;
			else m.failCount += 1;
			if (typeof ev.payload?.roll === 'number') m.details.rollsSum += ev.payload.roll;
			if (ev.payload?.sp_boost_applied) m.details.spBoostCount += 1;
		} else if (ev.event_name === 'trivia_answered') {
			const m = mechanics.trivia_quiz;
			m.totalAttempts += 1;
			if (ev.payload?.is_correct) m.successCount += 1;
			else m.failCount += 1;
		} else if (ev.event_name === 'ai_prompt_evaluated') {
			const m = mechanics.ai_prompt_challenge;
			m.totalAttempts += 1;
			m.successCount += 1; // Evaluado exitosamente
			if (typeof ev.payload?.score_xp === 'number') {
				m.details.aiScores.push(ev.payload.score_xp);
				m.totalXp += ev.payload.score_xp;
			}
			if (ev.payload?.is_fallback) m.details.fallbackCount += 1;
		} else if (ev.event_name === 'time_bomb_defused') {
			const m = mechanics.time_bomb;
			m.totalAttempts += 1;
			m.successCount += 1;
			m.details.defused += 1;
		} else if (ev.event_name === 'time_bomb_expired') {
			const m = mechanics.time_bomb;
			m.totalAttempts += 1;
			m.failCount += 1;
			m.details.expired += 1;
		} else if (ev.event_name === 'code_redeemed') {
			const m = mechanics.code;
			m.totalAttempts += 1;
			m.successCount += 1;
		} else if (ev.event_name === 'code_failed') {
			const m = mechanics.code;
			m.totalAttempts += 1;
			m.failCount += 1;
		}
	}

	// Calcular tasas de éxito y promedios
	for (const key of Object.keys(mechanics)) {
		const m = mechanics[key];
		m.successRate = m.totalAttempts > 0 ? Math.round((m.successCount / m.totalAttempts) * 100) : 0;
	}

	if (mechanics.dice_check.totalAttempts > 0) {
		mechanics.dice_check.details.avgRoll = Number(
			(mechanics.dice_check.details.rollsSum / mechanics.dice_check.totalAttempts).toFixed(1)
		);
	}

	if (mechanics.ai_prompt_challenge.details.aiScores.length > 0) {
		const sum = mechanics.ai_prompt_challenge.details.aiScores.reduce((a: number, b: number) => a + b, 0);
		mechanics.ai_prompt_challenge.details.avgAiScore = Number(
			(sum / mechanics.ai_prompt_challenge.details.aiScores.length).toFixed(1)
		);
	} else {
		mechanics.ai_prompt_challenge.details.avgAiScore = 0;
	}

	return mechanics;
}

/**
 * Reporte de dinámica social y networking.
 */
export async function getNetworkingAnalyticsReport(eventId: string) {
	const events = await getRawAnalyticsEvents(eventId);

	const activations = events.filter((e) => e.event_name === 'contact_profile_activated');
	const scans = events.filter((e) => e.event_name === 'contact_scanned');

	const connectorsMap: Record<string, number> = {};
	const factionExchanges: Record<string, number> = {};

	for (const scan of scans) {
		if (scan.user_id) {
			connectorsMap[scan.user_id] = (connectorsMap[scan.user_id] || 0) + 1;
		}
		const f1 = scan.payload?.scanner_faction_id || 'unknown';
		const f2 = scan.payload?.target_faction_id || 'unknown';
		factionExchanges[f1] = (factionExchanges[f1] || 0) + 1;
		factionExchanges[f2] = (factionExchanges[f2] || 0) + 1;
	}

	return {
		totalProfilesActivated: activations.length,
		totalContactsExchanged: scans.length,
		factionExchanges,
		topConnectorsCount: Object.keys(connectorsMap).length
	};
}

/**
 * Reporte de economía y flujo de moneda lúdica (CP / Ludens).
 */
export async function getEconomyAnalyticsReport(eventId: string) {
	const events = await getRawAnalyticsEvents(eventId);

	const rewardPurchases = events.filter((e) => e.event_name === 'reward_purchased');
	const spBoosts = events.filter((e) => e.event_name === 'sp_boost_activated');
	const diceRetries = events.filter((e) => e.event_name === 'dice_retry_used');

	const rewardsCatalogStats: Record<string, { count: number; name?: string; category?: string; totalCpSpent: number }> = {};
	let totalCpSpent = 0;

	for (const p of rewardPurchases) {
		const rid = p.payload?.reward_id || 'unknown';
		const cost = p.payload?.cost_cp || 0;
		totalCpSpent += cost;

		if (!rewardsCatalogStats[rid]) {
			rewardsCatalogStats[rid] = {
				count: 0,
				name: p.payload?.reward_name,
				category: p.payload?.category,
				totalCpSpent: 0
			};
		}
		rewardsCatalogStats[rid].count += 1;
		rewardsCatalogStats[rid].totalCpSpent += cost;
	}

	return {
		totalPurchases: rewardPurchases.length,
		totalCpSpent,
		spBoostsActivated: spBoosts.length,
		diceRetriesUsed: diceRetries.length,
		rewardsCatalogStats
	};
}

export interface AiPromptReflectionRecord {
	created_at: string;
	user_id: string | null;
	player_name: string;
	faction_id: string;
	faction_name: string;
	avatar_title: string;
	mission_id: string;
	mission_title: string;
	user_response_text: string;
	score_xp: number;
	is_fallback: boolean;
	giocchi_feedback: string;
	response_length: number;
}

/**
 * Obtiene todas las reflexiones de texto generadas por los jugadores en retos ai_prompt_challenge.
 */
export async function getAiPromptReflections(eventId: string): Promise<AiPromptReflectionRecord[]> {
	const events = await getRawAnalyticsEvents(eventId);
	const promptEvents = events.filter((e) => e.event_name === 'ai_prompt_evaluated');

	return promptEvents
		.map((e) => {
			const p = e.payload || {};
			return {
				created_at: e.created_at || new Date().toISOString(),
				user_id: e.user_id || null,
				player_name: p.player_name || 'Agente',
				faction_id: p.faction_id || '',
				faction_name: p.faction_name || '',
				avatar_title: p.avatar_title || '',
				mission_id: p.mission_id || '',
				mission_title: p.mission_title || p.mission_id || '',
				user_response_text: p.user_response_text || '',
				score_xp: typeof p.score_xp === 'number' ? p.score_xp : 0,
				is_fallback: !!p.is_fallback,
				giocchi_feedback: p.giocchi_feedback || '',
				response_length: typeof p.response_length === 'number' ? p.response_length : (p.user_response_text || '').length
			};
		})
		.reverse();
}

/**
 * Generador de archivos CSV estructurados para exportación analítica.
 */
export async function exportAnalyticsCSV(
	eventId: string,
	reportType: 'overview' | 'missions' | 'hourly' | 'networking' | 'economy' | 'ai_prompts' | 'reflections'
): Promise<string> {
	switch (reportType) {
		case 'hourly': {
			const hourly = await getHourlyMissionsAnalytics(eventId);
			const headers = ['Hora_ISO', 'Hora_Local', 'Misiones_Completadas', 'Tipos_Desglose'];
			const rows = hourly.map((h) => [
				h.hourKey,
				h.hourLabel,
				h.count,
				`"${JSON.stringify(h.types).replace(/"/g, '""')}"`
			]);
			return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		}

		case 'missions': {
			const events = await getRawAnalyticsEvents(eventId);
			const missions = events.filter((e) => e.event_name === 'mission_completed' || e.event_name === 'mission_failed');
			const headers = ['Timestamp', 'User_ID', 'Event_Name', 'Mission_ID', 'Mission_Type', 'XP_Awarded', 'CP_Awarded'];
			const rows = missions.map((m) => [
				m.created_at || '',
				m.user_id || 'anónimo',
				m.event_name,
				m.payload?.mission_id || '',
				m.payload?.mission_type || '',
				m.payload?.xp_awarded || 0,
				m.payload?.cp_awarded || 0
			]);
			return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		}

		case 'networking': {
			const events = await getRawAnalyticsEvents(eventId);
			const scans = events.filter((e) => e.event_name === 'contact_scanned');
			const headers = ['Timestamp', 'Scanner_User_ID', 'Target_User_ID', 'Scanner_Faction', 'Target_Faction'];
			const rows = scans.map((s) => [
				s.created_at || '',
				s.user_id || '',
				s.payload?.target_user_id || '',
				s.payload?.scanner_faction_id || '',
				s.payload?.target_faction_id || ''
			]);
			return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		}

		case 'economy': {
			const events = await getRawAnalyticsEvents(eventId);
			const purchases = events.filter((e) => e.event_name === 'reward_purchased');
			const headers = ['Timestamp', 'User_ID', 'Reward_ID', 'Category', 'Cost_CP', 'Token_VIP'];
			const rows = purchases.map((p) => [
				p.created_at || '',
				p.user_id || '',
				p.payload?.reward_id || '',
				p.payload?.category || '',
				p.payload?.cost_cp || 0,
				p.payload?.token_generated || ''
			]);
			return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		}

		case 'ai_prompts':
		case 'reflections': {
			const reflections = await getAiPromptReflections(eventId);
			const headers = [
				'Fecha_Hora_ISO',
				'User_ID',
				'Nombre_Agente',
				'Faccion',
				'Rol_Avatar',
				'ID_Mision',
				'Titulo_Mision',
				'Texto_Escrito_Jugador',
				'Puntaje_XP_GIOCCHI',
				'Es_Modo_Offline',
				'Feedback_GIOCCHI'
			];
			const rows = reflections.map((r) => [
				r.created_at || '',
				r.user_id || '',
				`"${(r.player_name || 'Agente').replace(/"/g, '""')}"`,
				`"${(r.faction_name || r.faction_id || '').replace(/"/g, '""')}"`,
				`"${(r.avatar_title || '').replace(/"/g, '""')}"`,
				r.mission_id || '',
				`"${(r.mission_title || '').replace(/"/g, '""')}"`,
				`"${(r.user_response_text || '').replace(/"/g, '""')}"`,
				r.score_xp || 0,
				r.is_fallback ? 'SI' : 'NO',
				`"${(r.giocchi_feedback || '').replace(/"/g, '""')}"`
			]);
			return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		}

		case 'overview':
		default: {
			const overview = await getEventOverviewReport(eventId);
			const headers = ['Metrica', 'Valor'];
			const rows = [
				['Event_ID', eventId],
				['Total_Eventos_Registrados', overview.totalEvents],
				['Usuarios_Activos_Unicos', overview.uniqueActiveUsers],
				['Agentes_Creados', overview.playersJoined],
				['Misiones_Completadas', overview.missionsCompleted],
				['Misiones_Fallidas', overview.missionsFailed],
				['Tasa_Exito_Misiones_Porcentaje', overview.completionRate],
				['Codigos_Canjeados', overview.codesRedeemed],
				['Contactos_Intercambiados', overview.contactsScanned],
				['Recompensas_Boveda_Canjeadas', overview.rewardsPurchased],
				['Votos_Emitidos', overview.votesSubmitted],
				['Tratados_Firmados', overview.treatiesSigned],
				['Total_XP_Distribuida', overview.totalXpDistributed],
				['Total_CP_Distribuido', overview.totalCpDistributed]
			];
			return [headers.join(','), ...rows.map((r) => r.join(',')).map((line) => line)].join('\n');
		}
	}
}

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getEventBySlug,
	getAdminLeaderboard,
	getAdminRedemptions,
	createAdminReward,
	getAdminCodes,
	createAdminCode,
	saveAdminMap,
	toggleHotspotActive,
	getAdminCharacters,
	createAdminCharacter,
	sendAdminAlert,
	SystemUnavailableError,
	SYSTEM_ERROR_MESSAGE
} from '$lib/server/eventService';
import { parseSignedSession } from '$lib/server/session';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	try {
		const sessionCookie = cookies.get('eventgage_session');
		const user = parseSignedSession<{ id: string; email: string; full_name: string }>(sessionCookie);

		if (!user) {
			return json({ error: 'No autorizado o sesión inválida.' }, { status: 401 });
		}

		const event = await getEventBySlug(params.slug);
		if (!event) {
			return json({ error: 'Evento no encontrado' }, { status: 404 });
		}

		const body = await request.json();
		const action = body.action;

		if (action === 'get_leaderboard') {
			const leaderboard = await getAdminLeaderboard(event.id);
			return json({ success: true, leaderboard });
		}

		if (action === 'get_redemptions') {
			const data = await getAdminRedemptions(event.id);
			return json({ success: true, ...data });
		}

		if (action === 'create_reward') {
			const rewardData = body.reward || {
				id: body.id,
				name: body.name,
				category: body.category,
				cost: body.cost,
				description: body.description,
				min_level: body.min_level,
				file_url: body.file_url
			};
			const result = await createAdminReward(event.id, rewardData);
			return json(result);
		}

		if (action === 'get_codes') {
			const codes = await getAdminCodes(event.id);
			return json({ success: true, codes });
		}

		if (action === 'create_code') {
			const codeData = (typeof body.code === 'object' && body.code !== null) ? body.code : {
				code: body.code,
				category: body.category,
				display_id: body.display_id,
				description: body.description,
				rewards: body.rewards,
				unlocks_mission: body.unlocks_mission,
				unlocks_item: body.unlocks_item
			};
			const result = await createAdminCode(event.id, codeData);
			return json(result);
		}

		if (action === 'save_map') {
			const mapData = body.map || {
				id: body.id,
				name: body.name,
				image_url: body.image_url,
				hotspots: body.hotspots
			};
			const result = await saveAdminMap(event.id, mapData);
			return json(result);
		}

		if (action === 'toggle_hotspot') {
			const mapId = body.map_id || body.mapId;
			const hotspotId = body.hotspot_id || body.hotspotId;
			const isActive = body.is_active !== undefined ? body.is_active : body.isActive;
			if (!mapId || !hotspotId) return json({ error: 'map_id y hotspot_id requeridos' }, { status: 400 });
			const result = await toggleHotspotActive(event.id, mapId, hotspotId, !!isActive);
			return json(result);
		}

		if (action === 'get_characters') {
			const characters = await getAdminCharacters(event.id);
			return json({ success: true, characters });
		}

		if (action === 'create_character') {
			const charData = body.character || {
				id: body.id,
				name: body.name,
				role: body.role,
				portrait_url: body.portrait_url
			};
			const result = await createAdminCharacter(event.id, charData);
			return json(result);
		}

		if (action === 'send_alert') {
			const alertData = body.alert || {
				message: body.message,
				title: body.title,
				type: body.type,
				expiration_seconds: body.expiration_seconds,
				media_url: body.media_url,
				character_id: body.character_id
			};
			const result = await sendAdminAlert(event.id, alertData);
			return json(result);
		}

		return json({ error: 'Acción de administración no válida' }, { status: 400 });
	} catch (e: any) {
		if (e instanceof SystemUnavailableError) {
			console.error('[audit] Fallo de infraestructura en POST /api/event/[slug]/admin:', e);
			return json({ error: SYSTEM_ERROR_MESSAGE, systemError: true }, { status: 503 });
		}
		console.error('Error en POST /api/event/[slug]/admin:', e);
		return json({ error: e.message || 'Error interno del servidor' }, { status: 500 });
	}
};

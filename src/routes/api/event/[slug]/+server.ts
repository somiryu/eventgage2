import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import {
	getEventBySlug,
	createPlayerAvatar,
	submitCodeForPlayer,
	submitVoteForPlayer,
	getVotingResults,
	resolveMissionForPlayer,
	markNarrativeSeen,
	updatePlayerSoundSetting,
	resetPlayerAvatar,
	getFactionMembers,
	getWorldState,
	purchaseReward,
	retryDiceCheck,
	activateSpBoost,
	activateContactProfile,
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

		if (action === 'reset') {
			// Herramienta de QA exclusiva de desarrollo local — nunca debe existir
			// como acción alcanzable en producción, sin excepción ni flag de entorno.
			// `dev` es una constante de build: Vite la reemplaza por `false` y
			// elimina este bloque del bundle de producción (no solo lo desactiva).
			if (!dev) {
				return json({ error: 'Acción no válida' }, { status: 400 });
			}
			await resetPlayerAvatar(user.id, event.id);
			console.warn(
				`[audit] Reset de avatar ejecutado (dev) — user=${user.id} event=${event.id} slug=${params.slug} at=${new Date().toISOString()}`
			);
			return json({ success: true, message: 'Jugador reseteado con éxito' });
		}

		if (action === 'join') {
			const { avatarId, factionId, gender } = body;
			if (!avatarId || !factionId) {
				return json({ error: 'Clase de avatar y facción son requeridas' }, { status: 400 });
			}
			const player = await createPlayerAvatar(
				user.id,
				event.id,
				avatarId,
				factionId,
				gender || 'male',
				user.full_name || user.email || 'Agente'
			);
			return json({ success: true, player });
		}

		if (action === 'submit_code') {
			const { code } = body;
			if (!code) return json({ error: 'Código requerido' }, { status: 400 });
			const result = await submitCodeForPlayer(user.id, event.id, code);
			return json(result);
		}

		if (action === 'mark_narrative_seen') {
			const result = await markNarrativeSeen(user.id, event.id);
			return json(result);
		}

		if (action === 'toggle_sound') {
			const result = await updatePlayerSoundSetting(user.id, event.id, !!body.enabled);
			return json(result);
		}

		if (action === 'resolve_mission') {
			const { missionId, optionId, answerText } = body;
			if (!missionId) return json({ error: 'missionId requerido' }, { status: 400 });
			const result = await resolveMissionForPlayer(user.id, event.id, missionId, { optionId, answerText });
			return json(result);
		}

		if (action === 'get_world_state') {
			const { factions, eventPoints } = await getWorldState(event.id);
			return json({ success: true, factions, eventPoints });
		}

		if (action === 'get_voting_results') {
			const votingResults = await getVotingResults(event.id);
			return json({ success: true, votingResults });
		}

		if (action === 'get_faction_members') {
			const { factionId } = body;
			if (!factionId) return json({ error: 'factionId requerido' }, { status: 400 });
			const members = await getFactionMembers(event.id, factionId);
			return json({ members });
		}

		if (action === 'purchase') {
			const { rewardId } = body;
			if (!rewardId) return json({ error: 'rewardId requerido' }, { status: 400 });
			const result = await purchaseReward(user.id, event.id, rewardId);
			return json(result);
		}

		if (action === 'retry_dice_check') {
			const { missionId } = body;
			if (!missionId) return json({ error: 'missionId requerido' }, { status: 400 });
			const result = await retryDiceCheck(user.id, event.id, missionId);
			return json(result);
		}

		if (action === 'activate_sp_boost') {
			const result = await activateSpBoost(user.id, event.id);
			return json(result);
		}

		if (action === 'activate_contact_profile') {
			const { company, phone, linkedin, bio } = body;
			const result = await activateContactProfile(user.id, event.id, user.email, { company, phone, linkedin, bio });
			return json(result);
		}

		if (action === 'vote') {
			const { missionId, optionId } = body;
			if (!optionId) {
				return json({ error: 'La opción de voto es requerida' }, { status: 400 });
			}
			const result = await submitVoteForPlayer(user.id, event.id, missionId || 'm_vote_01', optionId);
			return json(result);
		}

		return json({ error: 'Acción no válida' }, { status: 400 });
	} catch (e: any) {
		if (e instanceof SystemUnavailableError) {
			console.error('[audit] Fallo de infraestructura en POST /api/event/[slug]:', e);
			return json({ error: SYSTEM_ERROR_MESSAGE, systemError: true }, { status: 503 });
		}
		console.error('Error en POST /api/event/[slug]:', e);
		return json({ error: e.message || 'Error interno del servidor', systemError: true }, { status: 500 });
	}
};

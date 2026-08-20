import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getEventBySlug,
	getEventFactionsAndAvatars,
	getEventMaps,
	getEventAlerts,
	getEventMissions,
	getAdminLeaderboard,
	getAdminRedemptions,
	getAdminCodes,
	getAdminCharacters
} from '$lib/server/eventService';
import { parseSignedSession } from '$lib/server/session';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const sessionCookie = cookies.get('eventgage_session');
	const user = parseSignedSession<{ id: string; email: string; full_name: string }>(sessionCookie);

	// Para esta edición no existe un rol de GM en el esquema: cualquier sesión
	// válida basta, y el acceso real se controla porque solo el staff conoce
	// esta URL. Cuando haga falta separar jugadores de GMs de verdad, esto
	// necesita un rol/flag de administrador propio en eventgage_user.
	if (!user) {
		throw redirect(303, `/login?event=${params.event_slug}&redirect=/${params.event_slug}/game-masters`);
	}

	const event = await getEventBySlug(params.event_slug);
	if (!event) {
		throw error(404, 'Evento no encontrado');
	}

	const [
		leaderboard,
		factionsAndAvatars,
		redemptionsData,
		codes,
		maps,
		characters,
		alerts,
		missions
	] = await Promise.all([
		getAdminLeaderboard(event.id),
		getEventFactionsAndAvatars(event.id),
		getAdminRedemptions(event.id),
		getAdminCodes(event.id),
		getEventMaps(event.id),
		getAdminCharacters(event.id),
		getEventAlerts(event.id),
		getEventMissions(event.id)
	]);

	return {
		event: {
			id: event.id,
			slug: event.slug,
			name: event.title,
			brand_config: event.brand_config
		},
		user,
		leaderboard,
		factions: factionsAndAvatars.factions || [],
		rewards: redemptionsData.rewards,
		redemptions: redemptionsData.redemptions,
		codes,
		maps,
		characters,
		alerts,
		missions
	};
};

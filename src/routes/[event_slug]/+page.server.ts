import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getEventBySlug,
	getEventFactionsAndAvatars,
	getEventMissions,
	getEventItems,
	getEventMaps,
	getEventAlerts,
	getEventDialogues,
	getEventPoints,
	getEventRewards,
	getVotingResults,
	getPlayerAvatar,
	checkExpiredTimeBombs,
	getEventActivityFeed,
	getEventLevels,
	SystemUnavailableError
} from '$lib/server/eventService';
import { parseSignedSession } from '$lib/server/session';

// Mensaje único para cuando la página completa no puede cargar por un fallo
// de infraestructura (no porque el evento no exista) — ver docs/audits.
const PAGE_SYSTEM_ERROR_MESSAGE =
	'No logramos establecer el enlace con la Agencia — puede ser una interferencia temporal de red. Recarga la página en unos segundos, Agente.';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const sessionCookie = cookies.get('eventgage_session');
	const user = parseSignedSession<{ id: string; email: string; full_name: string }>(sessionCookie);

	// 1. Si no está registrado o autenticado o la firma no es válida, redirigir al registro
	if (!user) {
		cookies.delete('eventgage_session', { path: '/' });
		throw redirect(303, `/register?event=${params.event_slug}`);
	}

	try {
		// 2. Obtener información del evento
		const event = await getEventBySlug(params.event_slug);
		if (!event) {
			throw error(404, `El evento "${params.event_slug}" no existe.`);
		}

		// 3. Obtener todas las entidades del evento de forma paralela
		const [
			{ factions, avatars },
			missions,
			items,
			maps,
			alerts,
			dialogues,
			eventPoints,
			rewards,
			votingResults,
			playerState,
			activityFeed,
			levels
		] = await Promise.all([
			getEventFactionsAndAvatars(event.id),
			getEventMissions(event.id),
			getEventItems(event.id),
			getEventMaps(event.id),
			getEventAlerts(event.id),
			getEventDialogues(event.id),
			getEventPoints(event.id),
			getEventRewards(event.id),
			getVotingResults(event.id),
			getPlayerAvatar(user.id, event.id),
			getEventActivityFeed(event.id),
			getEventLevels(event.id)
		]);

		// Sincroniza expiraciones de time_bomb en cada carga de página —
		// best-effort y perezoso, sin cron (ver checkExpiredTimeBombs).
		if (playerState) {
			await checkExpiredTimeBombs(event.id, playerState);
		}

		return {
			user,
			event,
			factions,
			avatarsCatalog: avatars,
			missions,
			items,
			maps,
			alerts,
			dialogues,
			eventPoints,
			rewards,
			votingResults,
			playerState,
			activityFeed,
			levels
		};
	} catch (e) {
		if (e instanceof SystemUnavailableError) {
			throw error(503, PAGE_SYSTEM_ERROR_MESSAGE);
		}
		throw e;
	}
};

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
	getEventVendors,
	getAdminCharacters,
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

	if (!user) {
		throw redirect(302, `/register?event=${params.event_slug}&redirect=/${params.event_slug}`);
	}

	try {
		// 1. Obtener evento por slug
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
			characters,
			eventPoints,
			rewards,
			votingResults,
			playerState,
			activityFeed,
			levels,
			vendors
		] = await Promise.all([
			getEventFactionsAndAvatars(event.id),
			getEventMissions(event.id),
			getEventItems(event.id),
			getEventMaps(event.id),
			getEventAlerts(event.id),
			getEventDialogues(event.id),
			getAdminCharacters(event.id),
			getEventPoints(event.id),
			getEventRewards(event.id),
			getVotingResults(event.id),
			getPlayerAvatar(user.id, event.id),
			getEventActivityFeed(event.id),
			getEventLevels(event.id),
			getEventVendors(event.id)
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
			characters,
			eventPoints,
			rewards,
			votingResults,
			playerState,
			activityFeed,
			levels,
			vendors
		};
	} catch (e) {
		if (e instanceof SystemUnavailableError) {
			throw error(503, PAGE_SYSTEM_ERROR_MESSAGE);
		}
		throw e;
	}
};

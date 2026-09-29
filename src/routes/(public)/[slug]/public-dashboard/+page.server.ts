import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getEventBySlug,
	getEventFactionsAndAvatars,
	getEventPoints,
	getEventActivityFeed,
	getHighRankPlayers,
	getTreatySignatures,
	SystemUnavailableError
} from '$lib/server/eventService';
import { getRouteStats } from '$lib/server/routeService';

// Ruta pública, sin autenticación (sección 11.1 del GDD — "Tablero de Estado
// Global en Tiempo Real" para proyectar en pantalla gigante durante la
// sesión plenaria). A propósito NO lee la cookie de sesión ni exige un
// jugador: cualquiera con el link puede abrirla, pensado para quedar
// proyectado sin que nadie tenga que loguearse en el proyector del venue.
const PAGE_SYSTEM_ERROR_MESSAGE =
	'No logramos establecer el enlace con la Agencia — puede ser una interferencia temporal de red. Recarga la página en unos segundos.';

export const load: PageServerLoad = async ({ params }) => {
	try {
		const event = await getEventBySlug(params.slug);
		if (!event) {
			throw error(404, `El evento "${params.slug}" no existe.`);
		}

		const [{ factions }, eventPoints, activityFeed, hallOfFame, treaty] = await Promise.all([
			getEventFactionsAndAvatars(event.id),
			getEventPoints(event.id),
			getEventActivityFeed(event.id, 12),
			getHighRankPlayers(event.id),
			getTreatySignatures(event.id)
		]);

		// Evento tipo ruta (config.passport): guaridas más visitadas en vivo.
		let topStops: Array<{ n: number; vendorName: string; visits: number; imageUrl: string | null }> = [];
		if (event.config?.passport) {
			const route = await getRouteStats(event);
			topStops = [...route.stops]
				.sort((a, b) => b.visits - a.visits || a.n - b.n)
				.slice(0, 5)
				.map((s) => ({ n: s.n, vendorName: s.vendorName, visits: s.visits, imageUrl: s.imageUrl }));
		}

		return { event, factions, eventPoints, activityFeed, hallOfFame, treaty, topStops };
	} catch (e) {
		if (e instanceof SystemUnavailableError) {
			throw error(503, PAGE_SYSTEM_ERROR_MESSAGE);
		}
		throw e;
	}
};

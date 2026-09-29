import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import QRCode from 'qrcode';
import { getEventBySlug, SystemUnavailableError } from '$lib/server/eventService';
import { getRouteStats, verifyVendorToken } from '$lib/server/routeService';

// Panel de un aliado de la ruta (editorial/tienda/comunidad). Sin cuenta:
// el acceso es el enlace firmado `?k=` que genera el staff en
// /[event_slug]/game-masters/aliados. Solo muestra números agregados de
// SU parada — nunca nombres ni correos de jugadores.
export const load: PageServerLoad = async ({ params, url }) => {
	try {
		const event = await getEventBySlug(params.slug);
		if (!event) throw error(404, 'Evento no encontrado');

		if (!verifyVendorToken(event.id, params.vendor_id, url.searchParams.get('k'))) {
			throw error(403, 'Enlace de aliado inválido. Pide el enlace actualizado a la organización.');
		}

		const stats = await getRouteStats(event);
		const stop = stats.stops.find((s) => s.vendorId === params.vendor_id);
		if (!stop) throw error(404, 'Este aliado no tiene una parada en la ruta.');

		const playerLink = stop.code ? `${url.origin}/${event.slug}?code=${encodeURIComponent(stop.code)}` : null;
		const qrDataUrl = playerLink
			? await QRCode.toDataURL(playerLink, { margin: 1, width: 320, color: { dark: '#1c0f0a', light: '#ffffff' } })
			: null;

		return {
			event: { slug: event.slug, title: event.title, theme: event.config?.theme || null },
			stop,
			rank: stats.rankOf.get(stop.missionId) || null,
			totalStops: stats.stops.length,
			totalPlayers: stats.totalPlayers,
			factions: stats.factions,
			factionColors: stats.factionColors,
			playerLink,
			qrDataUrl,
			generatedAt: new Date().toISOString()
		};
	} catch (e) {
		if (e instanceof SystemUnavailableError) throw error(503, 'El sistema no responde en este momento. Recarga en unos segundos.');
		throw e;
	}
};

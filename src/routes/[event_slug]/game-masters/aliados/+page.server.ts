import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import QRCode from 'qrcode';
import { getEventBySlug } from '$lib/server/eventService';
import { parseSignedSession } from '$lib/server/session';
import { getRouteStats, signVendorToken } from '$lib/server/routeService';

// Hoja del staff para un evento tipo ruta: por cada parada, el código del
// stand, su QR (canje directo) y el enlace privado al panel del aliado.
// Mismo control de acceso que el panel de Game Masters (sesión válida + URL
// solo conocida por el staff).
export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const user = parseSignedSession<{ id: string }>(cookies.get('eventgage_session'));
	if (!user) {
		throw redirect(303, `/login?event=${params.event_slug}&redirect=/${params.event_slug}/game-masters/aliados`);
	}

	const event = await getEventBySlug(params.event_slug);
	if (!event) throw error(404, 'Evento no encontrado');
	if (!event.config?.passport) throw error(404, 'Este evento no tiene una ruta de aliados configurada.');

	const stats = await getRouteStats(event);
	const stops = await Promise.all(
		stats.stops.map(async (s) => {
			const playerLink = s.code ? `${url.origin}/${event.slug}?code=${encodeURIComponent(s.code)}` : null;
			return {
				...s,
				playerLink,
				qrDataUrl: playerLink ? await QRCode.toDataURL(playerLink, { margin: 1, width: 240 }) : null,
				panelLink: s.vendorId
					? `${url.origin}/${event.slug}/aliado/${s.vendorId}?k=${signVendorToken(event.id, s.vendorId)}`
					: null
			};
		})
	);

	return { event: { slug: event.slug, title: event.title }, stops, totalPlayers: stats.totalPlayers };
};

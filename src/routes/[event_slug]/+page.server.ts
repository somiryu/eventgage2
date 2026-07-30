import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEventBySlug, getEventFactionsAndAvatars, getPlayerAvatar } from '$lib/server/eventService';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const sessionCookie = cookies.get('eventgage_session');

	// 1. Si no está registrado o autenticado, redirigir al registro incluyendo el evento en la query
	if (!sessionCookie) {
		throw redirect(303, `/register?event=${params.event_slug}`);
	}

	let user;
	try {
		user = JSON.parse(sessionCookie);
	} catch (e) {
		cookies.delete('eventgage_session', { path: '/' });
		throw redirect(303, `/register?event=${params.event_slug}`);
	}

	// 2. Obtener información del evento
	const event = await getEventBySlug(params.event_slug);
	if (!event) {
		throw error(404, `El evento "${params.event_slug}" no existe.`);
	}

	// 3. Obtener catálogo de facciones y avatares del evento
	const { factions, avatars } = await getEventFactionsAndAvatars(event.id);

	// 4. Obtener perfil del jugador en este evento (si ya seleccionó avatar)
	const playerState = await getPlayerAvatar(user.id, event.id);

	return {
		user,
		event,
		factions,
		avatarsCatalog: avatars,
		playerState
	};
};

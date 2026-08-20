import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getEventBySlug,
	getPlayerAvatar,
	hasSignedTreaty,
	getTreatySignatures,
	SystemUnavailableError
} from '$lib/server/eventService';
import { parseSignedSession } from '$lib/server/session';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const sessionCookie = cookies.get('eventgage_session');
	const user = parseSignedSession<{ id: string; email: string; full_name: string }>(sessionCookie);

	if (!user) {
		throw redirect(303, `/register?event=${params.event_slug}&redirect=/${params.event_slug}/firmar-tratado`);
	}

	try {
		const event = await getEventBySlug(params.event_slug);
		if (!event) {
			throw error(404, `El evento "${params.event_slug}" no existe.`);
		}

		const player = await getPlayerAvatar(user.id, event.id);
		if (!player) {
			// Firma exige avatar/facción ya elegidos — completa el onboarding primero.
			throw redirect(303, `/${params.event_slug}`);
		}

		const [alreadySigned, { count }] = await Promise.all([
			hasSignedTreaty(user.id, event.id),
			getTreatySignatures(event.id)
		]);

		return {
			event: { slug: event.slug, title: event.title },
			playerName: player.avatar?.name || 'Agente',
			alreadySigned,
			signatureCount: count
		};
	} catch (e) {
		if (e instanceof SystemUnavailableError) {
			throw error(503, 'No logramos establecer el enlace con la Agencia — recarga en unos segundos, Agente.');
		}
		throw e;
	}
};

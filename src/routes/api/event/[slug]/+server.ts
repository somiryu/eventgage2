import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEventBySlug, createPlayerAvatar, submitCodeForPlayer, getPlayerAvatar } from '$lib/server/eventService';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const sessionCookie = cookies.get('eventgage_session');
	if (!sessionCookie) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const user = JSON.parse(sessionCookie);
	const event = await getEventBySlug(params.slug);
	if (!event) {
		return json({ error: 'Evento no encontrado' }, { status: 404 });
	}

	const body = await request.json();
	const action = body.action;

	if (action === 'join') {
		const { avatarId, factionId } = body;
		if (!avatarId || !factionId) {
			return json({ error: 'Avatar y facción son requeridos' }, { status: 400 });
		}
		const player = await createPlayerAvatar(user.id, event.id, avatarId, factionId);
		return json({ success: true, player });
	}

	if (action === 'submit_code') {
		const { code } = body;
		if (!code) return json({ error: 'Código requerido' }, { status: 400 });
		const result = await submitCodeForPlayer(user.id, event.id, code);
		return json(result);
	}

	if (action === 'vote') {
		const { optionId } = body;
		return json({ success: true, message: `Voto registrado para ${optionId}.` });
	}

	return json({ error: 'Acción no válida' }, { status: 400 });
};

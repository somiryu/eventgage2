import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEventBySlug } from '$lib/server/eventService';
import { parseSignedSession } from '$lib/server/session';
import { uploadAsset } from '$lib/server/storageService';
// @ts-ignore
import { Buffer } from 'node:buffer';

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	try {
		const sessionCookie = cookies.get('eventgage_session');
		const user = parseSignedSession<{ id: string; email: string; full_name: string }>(sessionCookie);

		if (!user) {
			return json({ error: 'No autorizado.' }, { status: 401 });
		}

		const event = await getEventBySlug(params.slug);
		if (!event) {
			return json({ error: 'Evento no encontrado' }, { status: 404 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const folder = (formData.get('folder') as string) || 'rewards';

		if (!file) {
			return json({ error: 'No se envió ningún archivo.' }, { status: 400 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const validFolders: Array<'maps' | 'rewards' | 'characters' | 'items'> = ['maps', 'rewards', 'characters', 'items'];
		const targetFolder = validFolders.includes(folder as any) ? (folder as any) : 'rewards';

		const result = await uploadAsset(buffer, file.name, file.type, targetFolder);
		if (!result.success) {
			return json({ error: result.error || 'Error al subir el archivo.' }, { status: 500 });
		}

		return json({ success: true, url: result.url });
	} catch (e: any) {
		console.error('Error en POST /api/event/[slug]/upload:', e);
		return json({ error: e.message || 'Error interno al procesar subida.' }, { status: 500 });
	}
};

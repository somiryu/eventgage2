import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { email } = await request.json();

		if (!email) {
			return json({ error: 'Email requerido' }, { status: 400 });
		}

		const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
		const userObj = {
			id: userId,
			email: email.toLowerCase().trim(),
			full_name: 'Agente Demo'
		};

		cookies.set('eventgage_session', JSON.stringify(userObj), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7
		});

		return json({ success: true, user: userObj });
	} catch (e: any) {
		return json({ error: e.message || 'Error en el servidor' }, { status: 500 });
	}
};

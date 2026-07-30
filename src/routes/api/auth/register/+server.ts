import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { email, password, full_name } = await request.json();

		if (!email || !password) {
			return json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
		}

		// Simular / procesar registro de usuario
		const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
		const userObj = {
			id: userId,
			email: email.toLowerCase().trim(),
			full_name: full_name || 'Agente'
		};

		// Establecer cookie de sesión
		cookies.set('eventgage_session', JSON.stringify(userObj), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 días
		});

		return json({ success: true, user: userObj });
	} catch (e: any) {
		return json({ error: e.message || 'Error en el servidor' }, { status: 500 });
	}
};

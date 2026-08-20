import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAuth, supabaseServer } from '$lib/server/supabaseClient';
import { createSignedSession } from '$lib/server/session';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			return json({ error: 'La Agencia necesita tu correo y tu clave de acceso para verificarte, Agente.' }, { status: 400 });
		}

		const cleanEmail = email.toLowerCase().trim();

		let userId: string | null = null;
		let fullName = 'Agente';

		// 1. Intentar autenticar con Supabase Auth
		const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
			email: cleanEmail,
			password: password
		});

		if (authData?.user) {
			userId = authData.user.id;
			fullName = authData.user.user_metadata?.full_name || 'Agente';
		} else {
			// Auto-resolución si el email no estaba confirmado en Supabase Auth
			if (authError?.message?.toLowerCase().includes('email not confirmed')) {
				try {
					const { data: userList } = await supabaseServer.auth.admin.listUsers();
					const existingUser = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
					if (existingUser) {
						await supabaseServer.auth.admin.updateUserById(existingUser.id, { email_confirm: true });
						const { data: retryAuth } = await supabaseAuth.auth.signInWithPassword({
							email: cleanEmail,
							password: password
						});
						if (retryAuth?.user) {
							userId = retryAuth.user.id;
							fullName = retryAuth.user.user_metadata?.full_name || 'Agente';
						}
					}
				} catch (confErr) {
					console.warn('Auto-confirm retry error:', confErr);
				}
			}

			if (!userId) {
				if (authError?.message?.includes('Invalid login credentials')) {
					return json({ error: 'La Agencia no reconoce esa combinación de correo y clave. Verifica tus datos, Agente.' }, { status: 400 });
				}
				return json({ error: authError?.message ? `La Agencia reporta: ${authError.message}` : 'La Agencia no pudo verificar tu credencial en este intento. Vuelve a intentarlo.' }, { status: 400 });
			}
		}

		// Registrar/Asegurar el perfil explícito en bem.eventgage_user al ingresar a Eventgage
		await supabaseServer
			.from('eventgage_user')
			.upsert(
				{
					id: userId,
					email: cleanEmail,
					full_name: fullName,
					created_at: new Date().toISOString()
				},
				{ onConflict: 'id' }
			);

		const userObj = {
			id: userId,
			email: cleanEmail,
			full_name: fullName
		};

		const signedSession = createSignedSession(userObj);

		cookies.set('eventgage_session', signedSession, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7
		});

		return json({ success: true, user: userObj });
	} catch (e: any) {
		console.error('Login API Error:', e);
		return json({ error: 'La Agencia perdió la señal a mitad de la verificación. No es tu credencial — reintenta en unos segundos.' }, { status: 400 });
	}
};

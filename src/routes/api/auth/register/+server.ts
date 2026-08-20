import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { supabaseServer } from '$lib/server/supabaseClient';
import { createSignedSession } from '$lib/server/session';

// Retexto en tono de la Agencia (1.7/1.8/3.14 del informe UX): antes esta
// pantalla era la primera que veía cualquier persona y ya rompía el tono
// narrativo con copy genérico de SaaS corporativo. Mapea los mensajes de
// Supabase Auth más comunes a la voz de Cipher; lo no mapeado cae en un
// mensaje honesto igual de en tono, nunca en el texto crudo de Supabase.
function agencyAuthErrorMessage(rawMessage: string | undefined): string {
	const msg = (rawMessage || '').toLowerCase();
	if (msg.includes('already registered') || msg.includes('already exists')) {
		return 'Ya existe una credencial de Agente con ese correo. Si es tuya, usa "Iniciar Sesión".';
	}
	if (msg.includes('invalid email') || msg.includes('unable to validate email')) {
		return 'Ese correo no tiene un formato válido para registrar tu credencial, Agente.';
	}
	if (msg.includes('password')) {
		return `Tu clave de acceso no cumple los requisitos: ${rawMessage}`;
	}
	if (msg.includes('rate limit')) {
		return 'Límite de registros alcanzado temporalmente por Supabase. Reintenta en unos instantes.';
	}
	return rawMessage ? `La Agencia reporta: ${rawMessage}` : 'No se pudo crear el expediente en este intento. Reintenta en unos segundos.';
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { email, password, full_name } = await request.json();

		if (!email || !password) {
			return json({ error: 'La Agencia necesita tu correo y una clave de acceso para abrir tu expediente.' }, { status: 400 });
		}

		if (password.length < 6) {
			return json({ error: 'Tu clave de acceso necesita al menos 6 caracteres, Agente.' }, { status: 400 });
		}

		const cleanEmail = email.toLowerCase().trim();

		// 1. Crear usuario en Supabase Auth directamente como administrador con email pre-confirmado
		// (email_confirm: true garantiza que Supabase NO despache correos de confirmación ni use cuotas SMTP)
		let userId: string | null = null;
		try {
			const { data: adminData, error: adminError } = await supabaseServer.auth.admin.createUser({
				email: cleanEmail,
				password: password,
				email_confirm: true,
				user_metadata: { full_name: full_name || 'Agente' }
			});

			if (adminError) {
				console.warn('[register] admin.createUser error:', adminError.message);
				if (adminError.message.toLowerCase().includes('already registered') || adminError.message.toLowerCase().includes('already exists')) {
					// Garantizar que la cuenta existente quede confirmada en Supabase Auth
					try {
						const { data: userList } = await supabaseServer.auth.admin.listUsers();
						const existing = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
						if (existing && !existing.email_confirmed_at) {
							await supabaseServer.auth.admin.updateUserById(existing.id, { email_confirm: true });
						}
					} catch (e) {
						console.warn('Error auto-confirming user in register:', e);
					}
					return json({ error: 'Ya existe una credencial de Agente con ese correo. Si es tuya, usa "Iniciar Sesión".' }, { status: 400 });
				}
				if (!dev) {
					return json({ error: agencyAuthErrorMessage(adminError.message) }, { status: 400 });
				}
			} else if (adminData?.user) {
				userId = adminData.user.id;
			}
		} catch (authErr) {
			console.warn('[register] Supabase auth error in dev fallback:', authErr);
		}

		if (!userId) {
			if (dev) {
				userId = crypto.randomUUID();
			} else {
				return json({ error: 'La Agencia no pudo abrir tu expediente en este intento. Vuelve a intentarlo en unos segundos.' }, { status: 400 });
			}
		}

		// 2. Garantizar perfil en bem.eventgage_user
		const { data: userProfile, error: dbError } = await supabaseServer
			.from('eventgage_user')
			.upsert(
				{
					id: userId,
					email: cleanEmail,
					full_name: full_name || 'Agente',
					created_at: new Date().toISOString()
				},
				{ onConflict: 'id' }
			)
			.select()
			.maybeSingle();

		if (dbError) {
			console.warn('DB upsert note (the PostgreSQL trigger may have already handled it):', dbError.message);
		}

		const userObj = {
			id: userId,
			email: cleanEmail,
			full_name: full_name || userProfile?.full_name || 'Agente'
		};

		const signedSession = createSignedSession(userObj);

		// 3. Guardar cookie de sesión HTTP-only
		cookies.set('eventgage_session', signedSession, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7
		});

		return json({ success: true, user: userObj });
	} catch (e: any) {
		console.error('Register API Error:', e);
		return json({ error: 'La Agencia perdió la señal a mitad del registro. No es tu credencial — reintenta en unos segundos.' }, { status: 400 });
	}
};

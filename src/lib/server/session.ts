// @ts-ignore
import crypto from 'crypto';
import { env as privateEnv } from '$env/dynamic/private';

const SECRET: string = (privateEnv.SUPABASE_SERVICE_ROLE_KEY || privateEnv.SESSION_SECRET || '') as string;

if (!SECRET) {
	throw new Error(
		'[session] No hay ningún secreto de sesión configurado. Define SESSION_SECRET (recomendado) o ' +
			'SUPABASE_SERVICE_ROLE_KEY en las variables de entorno antes de arrancar el servidor. ' +
			'Sin esto, las cookies de sesión no pueden firmarse de forma segura.'
	);
}

export function createSignedSession(payload: object): string {
	const dataStr = JSON.stringify(payload);
	const signature = crypto.createHmac('sha256', SECRET).update(dataStr).digest('hex');
	const base64Data = btoa(encodeURIComponent(dataStr));
	return `${base64Data}.${signature}`;
}

export function parseSignedSession<T>(token: string | undefined): T | null {
	if (!token) return null;
	const parts = token.split('.');
	if (parts.length !== 2) return null;

	const [base64Data, signature] = parts;

	try {
		const dataStr = decodeURIComponent(atob(base64Data));
		const expectedSignature = crypto.createHmac('sha256', SECRET).update(dataStr).digest('hex');

		if (signature.length === expectedSignature.length && signature === expectedSignature) {
			return JSON.parse(dataStr) as T;
		}
	} catch (e) {
		return null;
	}

	return null;
}

// @ts-ignore
import crypto from 'crypto';
import { env as privateEnv } from '$env/dynamic/private';

function getSecret(): string {
	return (
		privateEnv.SESSION_SECRET ||
		privateEnv.SUPABASE_SERVICE_ROLE_KEY ||
		(typeof process !== 'undefined' ? process.env?.SESSION_SECRET || process.env?.SUPABASE_SERVICE_ROLE_KEY : '') ||
		'eventgage-default-secure-hmac-session-signing-secret-2026'
	);
}

export function createSignedSession(payload: object): string {
	const dataStr = JSON.stringify(payload);
	const secret = getSecret();
	const signature = crypto.createHmac('sha256', secret).update(dataStr).digest('hex');
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
		const secret = getSecret();
		const expectedSignature = crypto.createHmac('sha256', secret).update(dataStr).digest('hex');

		if (signature.length === expectedSignature.length && signature === expectedSignature) {
			return JSON.parse(dataStr) as T;
		}
	} catch (e) {
		return null;
	}

	return null;
}

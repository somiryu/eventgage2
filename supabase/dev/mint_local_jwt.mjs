// SOLO DESARROLLO LOCAL. Genera JWTs anon/service_role para el PostgREST
// nativo levantado en local (ver supabase/dev/local_roles_and_grants.sql y
// supabase/dev/postgrest.conf). No usar este script ni su secreto para nada
// que toque el proyecto real de Supabase.
import crypto from 'node:crypto';

const secret = process.argv[2];
if (!secret) {
	console.error('Uso: node mint_local_jwt.mjs <secreto>');
	process.exit(1);
}

function base64url(input) {
	return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signJwt(payload) {
	const header = { alg: 'HS256', typ: 'JWT' };
	const encodedHeader = base64url(JSON.stringify(header));
	const encodedPayload = base64url(JSON.stringify(payload));
	const data = `${encodedHeader}.${encodedPayload}`;
	const signature = crypto.createHmac('sha256', secret).update(data).digest('base64')
		.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	return `${data}.${signature}`;
}

const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 5; // 5 años: solo dev local, sin rotación

const anon = signJwt({ role: 'anon', iss: 'eventgage-local-dev', iat, exp });
const serviceRole = signJwt({ role: 'service_role', iss: 'eventgage-local-dev', iat, exp });

console.log('LOCAL_ANON_JWT=' + anon);
console.log('LOCAL_SERVICE_ROLE_JWT=' + serviceRole);

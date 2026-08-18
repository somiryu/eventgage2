import { createClient } from '@supabase/supabase-js';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { dev } from '$app/environment';

function getSupabaseCredentials() {
	const supabaseUrl =
		publicEnv.PUBLIC_SUPABASE_URL ||
		privateEnv.PUBLIC_SUPABASE_URL ||
		(typeof process !== 'undefined' ? process.env?.PUBLIC_SUPABASE_URL : '') ||
		'';

	const supabaseKey =
		privateEnv.SUPABASE_SERVICE_ROLE_KEY ||
		(typeof process !== 'undefined' ? process.env?.SUPABASE_SERVICE_ROLE_KEY : '') ||
		publicEnv.PUBLIC_SUPABASE_ANON_KEY ||
		privateEnv.PUBLIC_SUPABASE_ANON_KEY ||
		(typeof process !== 'undefined' ? process.env?.PUBLIC_SUPABASE_ANON_KEY : '') ||
		'';

	const localGameDataUrl = dev
		? privateEnv.LOCAL_SUPABASE_URL || (typeof process !== 'undefined' ? process.env?.LOCAL_SUPABASE_URL : undefined)
		: undefined;
	const localGameDataKey = dev
		? privateEnv.LOCAL_SUPABASE_SERVICE_KEY || (typeof process !== 'undefined' ? process.env?.LOCAL_SUPABASE_SERVICE_KEY : undefined)
		: undefined;

	const gameDataUrl = localGameDataUrl || supabaseUrl;
	const gameDataKey = localGameDataKey || supabaseKey;

	return { supabaseUrl, supabaseKey, gameDataUrl, gameDataKey };
}

let cachedServerClient: ReturnType<typeof createClient> | null = null;
let cachedServerKey: string | null = null;

export function getSupabaseServer() {
	const { gameDataUrl, gameDataKey } = getSupabaseCredentials();
	if (cachedServerClient && cachedServerKey === gameDataKey && gameDataKey !== '') {
		return cachedServerClient;
	}
	cachedServerKey = gameDataKey;
	cachedServerClient = createClient(gameDataUrl, gameDataKey, {
		db: { schema: 'bem' },
		auth: {
			persistSession: false
		}
	});
	return cachedServerClient;
}

// Cliente para consultas al esquema `bem` (datos del juego)
export const supabaseServer = new Proxy({} as ReturnType<typeof createClient>, {
	get(_target, prop) {
		const client = getSupabaseServer();
		const val = (client as any)[prop];
		return typeof val === 'function' ? val.bind(client) : val;
	}
});

export function getSupabaseAuth() {
	const { supabaseUrl, supabaseKey } = getSupabaseCredentials();
	return createClient(supabaseUrl, supabaseKey, {
		auth: {
			persistSession: false
		}
	});
}

// Cliente global para Supabase Auth — siempre contra el proyecto real.
export const supabaseAuth = new Proxy({} as ReturnType<typeof createClient>, {
	get(_target, prop) {
		const client = getSupabaseAuth();
		const val = (client as any)[prop];
		return typeof val === 'function' ? val.bind(client) : val;
	}
});

// Cliente exclusivo para Realtime Broadcast — siempre contra el proyecto real
export const supabaseRealtime = new Proxy({} as ReturnType<typeof createClient>, {
	get(_target, prop) {
		const client = getSupabaseAuth();
		const val = (client as any)[prop];
		return typeof val === 'function' ? val.bind(client) : val;
	}
});

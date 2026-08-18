import { createClient } from '@supabase/supabase-js';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { dev } from '$app/environment';

const supabaseUrl = publicEnv.PUBLIC_SUPABASE_URL || privateEnv.PUBLIC_SUPABASE_URL || '';
const supabaseKey = privateEnv.SUPABASE_SERVICE_ROLE_KEY || publicEnv.PUBLIC_SUPABASE_ANON_KEY || privateEnv.PUBLIC_SUPABASE_ANON_KEY || '';

// En desarrollo local, si hay un Postgres+PostgREST nativo levantado (ver
// supabase/dev/), los datos del juego (`bem.*`) se leen de ahí en vez del
// proyecto remoto: mismo esquema, misma seed SQL (supabase/seed_*.sql),
// mismo cliente supabase-js — solo cambia el endpoint de destino. El
// override NUNCA se activa fuera de `dev`, así que no hay forma de que esto
// llegue a producción.
const localGameDataUrl = dev ? privateEnv.LOCAL_SUPABASE_URL : undefined;
const localGameDataKey = dev ? privateEnv.LOCAL_SUPABASE_SERVICE_KEY : undefined;

const gameDataUrl = localGameDataUrl || supabaseUrl;
const gameDataKey = localGameDataKey || supabaseKey;

// Cliente para consultas al esquema `bem` (datos del juego)
export const supabaseServer = createClient(gameDataUrl, gameDataKey, {
	db: { schema: 'bem' },
	auth: {
		persistSession: false
	}
});

// Cliente global para Supabase Auth — siempre contra el proyecto real.
// Auth (GoTrue) no se replica en el entorno local: usa la anon key real,
// que sí es válida, y no depende del esquema `bem`.
export const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
	auth: {
		persistSession: false
	}
});

// Cliente exclusivo para Realtime Broadcast — siempre contra el proyecto
// real (nunca contra el Postgres+PostgREST local de dev, que no tiene
// servidor Realtime). Usado únicamente para emitir broadcasts server-side
// (ver broadcastEventActivity en eventService.ts); nunca para leer/escribir
// datos del juego, eso sigue pasando por supabaseServer.
export const supabaseRealtime = createClient(supabaseUrl, supabaseKey, {
	auth: {
		persistSession: false
	}
});

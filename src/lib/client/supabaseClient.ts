import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

// Primer uso de Supabase del lado del navegador en este proyecto — hasta
// ahora todo pasaba por el proxy server-side (src/lib/server/supabaseClient.ts).
// Este cliente NUNCA lee ni escribe datos del juego directamente (eso sigue
// yendo por /api/event/[slug]): su único propósito es suscribirse al canal
// de Realtime Broadcast efímero del evento (ver broadcastEventActivity en
// eventService.ts) para recibir notificaciones en vivo (contacto escaneado,
// ítem público desbloqueado globalmente). Solo funciona contra el proyecto
// Supabase remoto real — el Postgres+PostgREST local de dev no tiene
// servidor Realtime, así que en ese entorno la suscripción simplemente
// nunca recibe nada (no rompe nada, solo no hay push en vivo).
export const supabaseClient = createClient(
	env.PUBLIC_SUPABASE_URL || '',
	env.PUBLIC_SUPABASE_ANON_KEY || '',
	{ auth: { persistSession: false } }
);

export interface EventActivityPayload {
	type: string;
	[key: string]: any;
}

// Se suscribe al canal compartido del evento y devuelve una función de
// limpieza. Un solo canal por evento (no uno por jugador): a la escala de un
// evento presencial (80-100 asistentes) es más simple que filtrar del lado
// del servidor, y el cliente descarta lo que no le corresponde según `type`
// y los campos del payload (ver uso en +page.svelte).
export function subscribeToEventActivity(eventId: string, onActivity: (payload: EventActivityPayload) => void) {
	const channel = supabaseClient.channel(`event:${eventId}:activity`, {
		config: { broadcast: { self: false } }
	});
	channel.on('broadcast', { event: 'activity' }, ({ payload }) => {
		onActivity(payload as EventActivityPayload);
	});
	channel.subscribe();
	return () => {
		supabaseClient.removeChannel(channel);
	};
}

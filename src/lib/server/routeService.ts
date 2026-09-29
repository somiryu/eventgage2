// Estadísticas de un evento tipo "ruta de stands" (config.passport): cuántos
// jugadores visitaron cada parada, cuántos superaron su reto y cómo se
// reparten por facción. Alimenta el panel de cada aliado y la hoja de
// enlaces/QR del staff.
//
// Fuente de verdad: bem.eventgage_analytics_events (code_redeemed /
// mission_completed / trivia_answered / dice_check_rolled), que ya se
// registran en cada canje — no se agrega ningún contador paralelo.
//
// Acceso al panel de un aliado: enlace firmado (HMAC del id del aliado con
// el mismo secreto de las sesiones). No requiere cuenta; quien tenga el
// enlace ve SOLO los números agregados de su parada, nunca nombres ni
// correos de jugadores.

// @ts-ignore
import crypto from 'crypto';
import { env as privateEnv } from '$env/dynamic/private';
import { supabaseServer } from './supabaseClient';
import { getEventVendors, getEventFactionsAndAvatars } from './eventService';

interface PassportStop {
	n: number;
	vendor: string;
	mission_id: string;
	item_id?: string;
	image_url?: string | null;
	stand?: string | null;
}

export interface StopStats {
	n: number;
	vendorId: string | null;
	vendorName: string;
	tagline: string | null;
	imageUrl: string | null;
	code: string | null;
	missionId: string;
	visits: number;
	completions: number;
	successes: number;
	byFaction: Record<string, number>;
	byHour: Record<string, number>;
	lastVisitAt: string | null;
}

function tokenSecret(): string {
	return (
		privateEnv.SESSION_SECRET ||
		privateEnv.SUPABASE_SERVICE_ROLE_KEY ||
		(typeof process !== 'undefined' ? process.env?.SESSION_SECRET || process.env?.SUPABASE_SERVICE_ROLE_KEY : '') ||
		'eventgage-default-secure-hmac-session-signing-secret-2026'
	);
}

export function signVendorToken(eventId: string, vendorId: string): string {
	return crypto.createHmac('sha256', tokenSecret()).update(`vendor-panel:${eventId}:${vendorId}`).digest('hex').slice(0, 24);
}

export function verifyVendorToken(eventId: string, vendorId: string, token: string | null): boolean {
	if (!token) return false;
	const expected = signVendorToken(eventId, vendorId);
	return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

// Hora local del evento (Bogotá) como "HH:00" para el histograma.
function hourBucket(iso: string): string {
	const d = new Date(iso);
	const h = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', hour12: false, timeZone: 'America/Bogota' }).format(d);
	return `${h.padStart(2, '0')}:00`;
}

export async function getRouteStats(event: { id: string; config?: any }) {
	const stops: PassportStop[] = event.config?.passport?.stops || [];
	const missionIds = stops.map((s) => s.mission_id);

	const [vendors, { factions }, codesRes, analyticsRes, playersRes] = await Promise.all([
		getEventVendors(event.id),
		getEventFactionsAndAvatars(event.id),
		supabaseServer.from('eventgage_event_codes').select('code, unlocks_mission').eq('event_id', event.id),
		supabaseServer
			.from('eventgage_analytics_events')
			.select('user_id, event_name, payload, created_at')
			.eq('event_id', event.id)
			.in('event_name', ['code_redeemed', 'mission_completed', 'trivia_answered', 'dice_check_rolled'])
			.order('created_at', { ascending: true })
			.limit(20000),
		supabaseServer.from('eventgage_event_avatar').select('user_id, avatar').eq('event_id', event.id)
	]);

	const factionOfUser = new Map<string, string>(
		(playersRes.data || []).map((p: any) => [p.user_id, p.avatar?.faction_id || 'sin_faccion'])
	);
	const codeOfMission = new Map<string, string>(
		(codesRes.data || []).filter((c: any) => c.unlocks_mission).map((c: any) => [c.unlocks_mission, c.code])
	);
	const vendorByName = new Map(vendors.map((v: any) => [v.name, v]));

	const byMission = new Map<string, StopStats>();
	for (const stop of stops) {
		const vendor: any = vendorByName.get(stop.vendor);
		byMission.set(stop.mission_id, {
			n: stop.n,
			vendorId: vendor?.id || null,
			vendorName: stop.vendor,
			tagline: vendor?.tagline || null,
			imageUrl: stop.image_url || null,
			code: codeOfMission.get(stop.mission_id) || null,
			missionId: stop.mission_id,
			visits: 0,
			completions: 0,
			successes: 0,
			byFaction: {},
			byHour: {},
			lastVisitAt: null
		});
	}

	const seenVisit = new Set<string>();
	for (const row of (analyticsRes.data || []) as any[]) {
		const p = row.payload || {};
		if (row.event_name === 'code_redeemed') {
			for (const missionId of p.newly_unlocked_missions || []) {
				const s = byMission.get(missionId);
				const key = `${row.user_id}:${missionId}`;
				if (!s || seenVisit.has(key)) continue;
				seenVisit.add(key);
				s.visits++;
				const fac = factionOfUser.get(row.user_id) || 'sin_faccion';
				s.byFaction[fac] = (s.byFaction[fac] || 0) + 1;
				const hb = hourBucket(row.created_at);
				s.byHour[hb] = (s.byHour[hb] || 0) + 1;
				s.lastVisitAt = row.created_at;
			}
		} else if (row.event_name === 'mission_completed' && missionIds.includes(p.mission_id)) {
			byMission.get(p.mission_id)!.completions++;
		} else if (row.event_name === 'trivia_answered' && p.is_correct && missionIds.includes(p.mission_id)) {
			byMission.get(p.mission_id)!.successes++;
		} else if (row.event_name === 'dice_check_rolled' && p.success && missionIds.includes(p.mission_id)) {
			byMission.get(p.mission_id)!.successes++;
		}
	}

	const stopStats = [...byMission.values()].sort((a, b) => a.n - b.n);
	const ranking = [...stopStats].sort((a, b) => b.visits - a.visits || a.n - b.n);
	return {
		stops: stopStats,
		rankOf: new Map(ranking.map((s, i) => [s.missionId, i + 1])),
		totalPlayers: playersRes.data?.length || 0,
		factions: (factions || []).map((f: any) => ({ id: f.id, name: f.name })),
		factionColors: (event.config?.faction_colors || {}) as Record<string, string>
	};
}

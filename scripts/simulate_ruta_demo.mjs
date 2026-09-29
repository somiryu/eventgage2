// SOLO DESARROLLO LOCAL — Simula jugadores recorriendo "La Ruta del Dragón"
// para que la demo (pantalla pública, paneles de aliados, clanes) no se vea
// vacía. Juega de verdad contra la API local: registro, elección de clan,
// canje de códigos de guarida y resolución de retos — así además sirve como
// prueba de punta a punta del motor con varios jugadores a la vez.
//
// Uso (con `npm run dev` corriendo y la base local sembrada):
//   node scripts/simulate_ruta_demo.mjs            # 24 jugadores
//   node scripts/simulate_ruta_demo.mjs 40         # 40 jugadores
//   BASE_URL=http://localhost:5173 node scripts/simulate_ruta_demo.mjs
//
// Se niega a correr contra cualquier host que no sea localhost: en dev el
// registro crea usuarios SOLO en la base local (ver api/auth/register).

import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SLUG = 'ruta-dragon';
const PLAYERS = Number(process.argv[2] || 24);

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)) {
	console.error(`Solo se permite simular contra localhost (recibido: ${BASE_URL}).`);
	process.exit(1);
}

// Los códigos de guarida salen del propio seed (bloque de comentarios final).
const seed = await readFile(new URL('../supabase/seed_ruta_dragon.sql', import.meta.url), 'utf8');
const stops = [...seed.matchAll(/^--\s+G(\d{2})\s+(DRG-[A-Z0-9]{4})\s+(.+)$/gm)].map((m) => ({
	n: Number(m[1]),
	code: m[2],
	vendor: m[3].trim()
}));
if (stops.length === 0) {
	console.error('No encontré códigos de guarida en supabase/seed_ruta_dragon.sql.');
	process.exit(1);
}

const CLANES = ['clan_llama', 'clan_escarcha', 'clan_tormenta'];
const AVATARES = ['avatar_cazadora', 'avatar_explorador', 'avatar_narradora'];
// Popularidad desigual entre stands (como en un evento real): unas guaridas
// reciben muchas más visitas que otras.
const weights = stops.map((_, i) => 1 + ((i * 7) % 5));

function pickWeighted(pool) {
	const total = pool.reduce((acc, s) => acc + weights[s.n - 1], 0);
	let r = Math.random() * total;
	for (const s of pool) {
		r -= weights[s.n - 1];
		if (r <= 0) return s;
	}
	return pool[pool.length - 1];
}

async function call(cookie, path, body) {
	const res = await fetch(`${BASE_URL}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
		body: JSON.stringify(body)
	});
	const setCookie = res.headers.get('set-cookie');
	const json = await res.json().catch(() => ({}));
	return { json, cookie: setCookie ? setCookie.split(';')[0] : cookie };
}

async function simulatePlayer(i) {
	const name = `Viajero Demo ${String(i).padStart(2, '0')}`;
	const reg = await call(null, '/api/auth/register', {
		email: `sim-${randomUUID().slice(0, 8)}@ruta-dragon.test`,
		password: randomUUID(),
		full_name: name
	});
	if (!reg.json.success) throw new Error(`registro: ${reg.json.error}`);
	const cookie = reg.cookie;
	const api = (body) => call(cookie, `/api/event/${SLUG}`, body).then((r) => r.json);

	await api({
		action: 'join',
		factionId: CLANES[Math.floor(Math.random() * CLANES.length)],
		avatarId: AVATARES[Math.floor(Math.random() * AVATARES.length)]
	});
	await api({ action: 'mark_narrative_seen' });

	// Entre 2 y 15 guaridas por jugador; unos pocos completan la ruta.
	const target = Math.random() < 0.15 ? stops.length : 2 + Math.floor(Math.random() * 9);
	const pool = [...stops];
	let done = 0;
	while (done < target && pool.length) {
		const stop = pickWeighted(pool);
		pool.splice(pool.indexOf(stop), 1);
		const redeem = await api({ action: 'submit_code', code: stop.code });
		const mission = redeem.newlyUnlockedMissions?.[0];
		if (!redeem.success || !mission) continue;
		const options = mission.mechanic?.options || [];
		const optionId = options.length ? options[Math.floor(Math.random() * options.length)].id : undefined;
		await api({ action: 'resolve_mission', missionId: mission.id, optionId });
		done++;
	}
	return { name, done };
}

console.log(`Simulando ${PLAYERS} jugadores contra ${BASE_URL}/${SLUG} (${stops.length} guaridas)…`);
let ok = 0;
for (let i = 1; i <= PLAYERS; i++) {
	try {
		const r = await simulatePlayer(i);
		ok++;
		console.log(`  ✓ ${r.name}: ${r.done} escamas`);
	} catch (e) {
		console.log(`  ✗ jugador ${i}: ${e.message}`);
	}
}
console.log(`Listo: ${ok}/${PLAYERS} jugadores simulados.`);

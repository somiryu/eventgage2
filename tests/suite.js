// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// --- MOCK ENVIRONMENT FOR TESTING ---
const SECRET = 'test-secret-key-1234567890';

function createSignedSession(payload) {
	const dataStr = JSON.stringify(payload);
	const signature = crypto.createHmac('sha256', SECRET).update(dataStr).digest('hex');
	const base64Data = btoa(encodeURIComponent(dataStr));
	return `${base64Data}.${signature}`;
}

function parseSignedSession(token) {
	if (!token) return null;
	const parts = token.split('.');
	if (parts.length !== 2) return null;

	const [base64Data, signature] = parts;

	try {
		const dataStr = decodeURIComponent(atob(base64Data));
		const expectedSignature = crypto.createHmac('sha256', SECRET).update(dataStr).digest('hex');

		if (signature.length === expectedSignature.length && signature === expectedSignature) {
			return JSON.parse(dataStr);
		}
	} catch {
		return null;
	}
	return null;
}

// --- CATALOG AND MECHANICS FOR TESTING ---
const avatarsCatalog = [
	{
		id: 'class_cipher',
		name: 'Clase: Cipher',
		image_url_m: 'https://img.test/cipher_m.jpg',
		image_url_f: 'https://img.test/cipher_f.jpg',
		default_sp: { hackeo: 14, percepcion: 18, sigilo: 10 },
		default_cp: { points: 100, icon: '⚡' }
	},
	{
		id: 'class_spectre',
		name: 'Clase: Spectre',
		image_url_m: 'https://img.test/spectre_m.jpg',
		image_url_f: 'https://img.test/spectre_f.jpg',
		default_sp: { hackeo: 20, percepcion: 10, sigilo: 16 },
		default_cp: { points: 100, icon: '⚡' }
	},
	{
		id: 'class_guardian',
		name: 'Clase: Guardian',
		image_url_m: 'https://img.test/guardian_m.jpg',
		image_url_f: 'https://img.test/guardian_f.jpg',
		default_sp: { hackeo: 10, percepcion: 20, sigilo: 12 },
		default_cp: { points: 100, icon: '⚡' }
	}
];

function calculateMaxSP(catalog) {
	const totals = {};
	for (const a of catalog) {
		for (const [k, v] of Object.entries(a.default_sp)) {
			if (!totals[k] || v > totals[k]) {
				totals[k] = v;
			}
		}
	}
	return totals;
}

// --- 1. TESTS DE SEGURIDAD Y SESIÓN HMAC ---
test('Security: Session Cookie HMAC Signing & Verification', async (t) => {
	await t.test('debe firmar y parsear correctamente una sesión legítima', () => {
		const user = { id: 'usr_123', email: 'agent@cybercon.org', full_name: 'Agente Alex Vance' };
		const token = createSignedSession(user);

		assert.ok(token.includes('.'), 'El token debe contener un punto separador de datos y firma');
		const parsed = parseSignedSession(token);
		assert.deepEqual(parsed, user, 'El contenido parseado debe coincidir exactamente con el original');
	});

	await t.test('debe rechazar una cookie con firma alterada o manipulada', () => {
		const user = { id: 'usr_123', email: 'agent@cybercon.org', full_name: 'Agente Alex Vance' };
		const token = createSignedSession(user);
		const tamperedToken = token.slice(0, -4) + 'abcd';

		const parsed = parseSignedSession(tamperedToken);
		assert.equal(parsed, null, 'Debe rechazar la firma manipulada');
	});

	await t.test('debe rechazar una cookie con payload alterado', () => {
		const user = { id: 'usr_123', email: 'agent@cybercon.org', full_name: 'Agente Alex Vance' };
		const token = createSignedSession(user);
		const [, signature] = token.split('.');

		const hackerPayload = { id: 'usr_admin', email: 'admin@cybercon.org', full_name: 'Hacker' };
		const forgedBase64 = btoa(encodeURIComponent(JSON.stringify(hackerPayload)));
		const forgedToken = `${forgedBase64}.${signature}`;

		const parsed = parseSignedSession(forgedToken);
		assert.equal(parsed, null, 'Debe rechazar el payload falso');
	});
});

// --- 2. TESTS DE AVATARES, CLASES Y ATRIBUTOS SP ---
test('Game Mechanics: Avatar, Class Selection & SP Calculation', async (t) => {
	await t.test('debe calcular correctamente el SP máximo relativo entre clases', () => {
		const maxSP = calculateMaxSP(avatarsCatalog);
		assert.equal(maxSP.hackeo, 20, 'El máximo de hackeo debe ser 20 (Spectre)');
		assert.equal(maxSP.percepcion, 20, 'El máximo de percepción debe ser 20 (Guardian)');
		assert.equal(maxSP.sigilo, 16, 'El máximo de sigilo debe ser 16 (Spectre)');
	});

	await t.test('debe asignar la imagen femenina o masculina según el género elegido', () => {
		const cipher = avatarsCatalog[0];
		const maleImg = cipher.image_url_m;
		const femaleImg = cipher.image_url_f;

		assert.equal(maleImg, 'https://img.test/cipher_m.jpg');
		assert.equal(femaleImg, 'https://img.test/cipher_f.jpg');
		assert.notEqual(maleImg, femaleImg);
	});
});

// --- 3. TESTS DE CANJE DE CÓDIGOS Y RECOMPENSAS ---
test('Game Mechanics: Code Redemption & Abuse Protection', async (t) => {
	let player = {
		avatar: {
			name: 'Alex Vance',
			xp: { points: 0, level: 1 },
			cp: { points: 100, icon: '⚡' }
		},
		game_status: {
			unlocked_missions: ['m_code_01'],
			completed_missions: [],
			unlocked_items: [],
			journal: [],
			redeemed_codes: []
		}
	};

	function processCode(codeStr) {
		const cleanCode = codeStr.trim().toUpperCase();
		if (player.game_status.redeemed_codes.includes(cleanCode)) {
			return { success: false, message: 'Código ya canjeado' };
		}

		if (cleanCode === 'DEMO2026') {
			player.game_status.redeemed_codes.push(cleanCode);
			player.avatar.xp.points += 150;
			if (player.avatar.xp.points >= 200) player.avatar.xp.level = 2;
			player.avatar.cp.points += 50;
			player.game_status.completed_missions.push('m_code_01');
			player.game_status.unlocked_missions.unshift('m_time_bomb_01');
			player.game_status.unlocked_items.unshift('item_audio_log_1');
			player.game_status.journal.unshift({ id: 'entry_1', title: 'Bitácora 01' });
			return { success: true, message: 'Canjeado' };
		}

		if (cleanCode === 'DISABLE_99') {
			player.game_status.redeemed_codes.push(cleanCode);
			player.avatar.xp.points += 250;
			if (player.avatar.xp.points >= 200) player.avatar.xp.level = 2;
			player.avatar.cp.points += 100;
			player.game_status.completed_missions.push('m_time_bomb_01');
			player.game_status.journal.unshift({ id: 'entry_2', title: 'Bitácora 02' });
			return { success: true, message: 'Bomba desactivada' };
		}

		return { success: false, message: 'Código inválido' };
	}

	await t.test('debe canjear DEMO2026, otorgar XP/CP y desbloquear la misión Time-Bomb', () => {
		const res = processCode('demo2026');
		assert.equal(res.success, true);
		assert.equal(player.avatar.xp.points, 150);
		assert.equal(player.avatar.cp.points, 150);
		assert.ok(player.game_status.completed_missions.includes('m_code_01'));
		assert.ok(player.game_status.unlocked_missions.includes('m_time_bomb_01'));
		assert.ok(player.game_status.unlocked_items.includes('item_audio_log_1'));
	});

	await t.test('debe bloquear el re-canje del mismo código (anti-abuso)', () => {
		const res = processCode('DEMO2026');
		assert.equal(res.success, false);
		assert.equal(player.avatar.xp.points, 150, 'El XP no debe aumentar con canjes repetidos');
	});

	await t.test('debe subir de nivel al alcanzar 200 XP o más con DISABLE_99', () => {
		const res = processCode('DISABLE_99');
		assert.equal(res.success, true);
		assert.equal(player.avatar.xp.points, 400); // 150 + 250
		assert.equal(player.avatar.xp.level, 2, 'El jugador debe subir a Nivel 2');
		assert.ok(player.game_status.completed_missions.includes('m_time_bomb_01'));
	});
});

// --- 4. TESTS DE VOTACIÓN COLECTIVA Y ESCRUTINIO ---
test('Game Mechanics: Collective Voting & Live Tally', async (t) => {
	const missionVotes = { sec_a: 42, sec_b: 28 };
	const player = {
		avatar: { xp: { points: 0, level: 1 }, cp: { points: 100, icon: '⚡' } },
		game_status: { votes: {}, completed_missions: [] }
	};

	function vote(optionId) {
		const prevVote = player.game_status.votes['m_vote_01'];
		const isFirst = !prevVote;

		if (isFirst) {
			player.avatar.xp.points += 100;
			player.avatar.cp.points += 30;
			player.game_status.completed_missions.push('m_vote_01');
		}

		if (prevVote && missionVotes[prevVote.option_id]) {
			missionVotes[prevVote.option_id]--;
		}

		missionVotes[optionId] = (missionVotes[optionId] || 0) + 1;
		player.game_status.votes['m_vote_01'] = { option_id: optionId, voted_at: new Date().toISOString() };

		const total = missionVotes.sec_a + missionVotes.sec_b;
		return {
			isFirst,
			totalVotes: total,
			pctA: Math.round((missionVotes.sec_a / total) * 100),
			pctB: Math.round((missionVotes.sec_b / total) * 100)
		};
	}

	await t.test('primer voto otorga recompensas y registra la opción', () => {
		const res = vote('sec_a');
		assert.equal(res.isFirst, true);
		assert.equal(player.avatar.xp.points, 100);
		assert.equal(player.avatar.cp.points, 130);
		assert.equal(missionVotes.sec_a, 43);
		assert.equal(res.totalVotes, 71);
		assert.equal(res.pctA, 61);
		assert.equal(res.pctB, 39);
	});

	await t.test('cambio de voto actualiza los porcentajes sin duplicar XP', () => {
		const res = vote('sec_b');
		assert.equal(res.isFirst, false);
		assert.equal(player.avatar.xp.points, 100, 'XP no debe duplicarse');
		assert.equal(missionVotes.sec_a, 42, 'Voto previo debe ser decrementado');
		assert.equal(missionVotes.sec_b, 29, 'Nuevo voto debe ser incrementado');
		assert.equal(res.totalVotes, 71);
		assert.equal(res.pctA, 59);
		assert.equal(res.pctB, 41);
	});
});

// --- 5. TESTS DEL MOTOR DE NIVELES DE XP (DINÁMICO & FALLBACK DE 7 NIVELES) ---
test('Game Mechanics: Dynamic & 7-Tier XP Level Progression Engine', async (t) => {
	function calculateLevel(xpPoints, levels) {
		const xp = typeof xpPoints === 'number' && !isNaN(xpPoints) ? Math.max(0, xpPoints) : 0;
		if (levels && levels.length > 0) {
			const sorted = [...levels].sort((a, b) => b.level - a.level);
			for (const tier of sorted) {
				if (xp >= tier.xp_required) {
					return tier.level;
				}
			}
			return sorted[sorted.length - 1]?.level || 1;
		}
		if (xp >= 2600) return 7;
		if (xp >= 2000) return 6;
		if (xp >= 1400) return 5;
		if (xp >= 900) return 4;
		if (xp >= 500) return 3;
		if (xp >= 200) return 2;
		return 1;
	}

	await t.test('debe calcular los 7 niveles de acuerdo a los umbrales de XP (fallback)', () => {
		assert.equal(calculateLevel(0), 1, '0 XP debe ser Nivel 1');
		assert.equal(calculateLevel(199), 1, '199 XP debe ser Nivel 1');
		assert.equal(calculateLevel(200), 2, '200 XP debe ser Nivel 2');
		assert.equal(calculateLevel(499), 2, '499 XP debe ser Nivel 2');
		assert.equal(calculateLevel(500), 3, '500 XP debe ser Nivel 3');
		assert.equal(calculateLevel(899), 3, '899 XP debe ser Nivel 3');
		assert.equal(calculateLevel(900), 4, '900 XP debe ser Nivel 4');
		assert.equal(calculateLevel(1399), 4, '1399 XP debe ser Nivel 4');
		assert.equal(calculateLevel(1400), 5, '1400 XP debe ser Nivel 5');
		assert.equal(calculateLevel(1999), 5, '1999 XP debe ser Nivel 5');
		assert.equal(calculateLevel(2000), 6, '2000 XP debe ser Nivel 6');
		assert.equal(calculateLevel(2599), 6, '2599 XP debe ser Nivel 6');
		assert.equal(calculateLevel(2600), 7, '2600 XP debe ser Nivel 7 (Tope)');
		assert.equal(calculateLevel(3500), 7, 'XP superior a 2600 se mantiene en Nivel 7');
	});

	await t.test('debe calcular los niveles dinámicamente según la estructura sembrada en eventgage_event_levels', () => {
		const customLevels = [
			{ id: 'lvl_1', level: 1, xp_required: 0, title: 'Recluta Inicial' },
			{ id: 'lvl_2', level: 2, xp_required: 200, title: 'Agente Calibrado' },
			{ id: 'lvl_3', level: 3, xp_required: 500, title: 'Agente Activo' },
			{ id: 'lvl_4', level: 4, xp_required: 900, title: 'Agente Veterano' },
			{ id: 'lvl_5', level: 5, xp_required: 1400, title: 'Especialista de Élite' },
			{ id: 'lvl_6', level: 6, xp_required: 2000, title: 'Estratega Mayor' },
			{ id: 'lvl_7', level: 7, xp_required: 2600, title: 'Maestro Huizinga' }
		];
		assert.equal(calculateLevel(0, customLevels), 1);
		assert.equal(calculateLevel(150, customLevels), 1);
		assert.equal(calculateLevel(200, customLevels), 2);
		assert.equal(calculateLevel(950, customLevels), 4);
		assert.equal(calculateLevel(2700, customLevels), 7);
	});

	await t.test('debe soportar esquemas personalizados de eventos con diferente número de niveles', () => {
		const miniLevels = [
			{ id: 'lvl_a', level: 1, xp_required: 0, title: 'Novato' },
			{ id: 'lvl_b', level: 2, xp_required: 100, title: 'Experto' },
			{ id: 'lvl_c', level: 3, xp_required: 300, title: 'Leyenda' }
		];
		assert.equal(calculateLevel(50, miniLevels), 1);
		assert.equal(calculateLevel(100, miniLevels), 2);
		assert.equal(calculateLevel(250, miniLevels), 2);
		assert.equal(calculateLevel(300, miniLevels), 3);
		assert.equal(calculateLevel(9999, miniLevels), 3);
	});
});

// --- 6. TESTS DE BÓVEDA Y ACCESO RESTRINGIDO POR NIVEL ---
test('Game Mechanics: Vault Rewards & Level Gating', async (t) => {
	const rewards = [
		{ id: 'rew_item_reintento', name: 'Ficha de Reintento', cost: 2, min_level: 1 },
		{ id: 'rew_prime_vip_consultancy', name: 'Pase VIP', cost: 2, min_level: 4 }
	];

	function purchase(player, rewardId) {
		const reward = rewards.find((r) => r.id === rewardId);
		if (!reward) return { success: false, message: 'Recompensa no encontrada' };

		const playerLevel = player.avatar.xp?.level ?? 1;
		if (playerLevel < (reward.min_level || 1)) {
			return {
				success: false,
				message: `Debes estar en nivel ${reward.min_level} para adquirir esta recompensa. Tu nivel actual es ${playerLevel}.`
			};
		}

		if (player.avatar.cp.points < reward.cost) {
			return { success: false, message: 'Ludens insuficientes' };
		}

		player.avatar.cp.points -= reward.cost;
		player.game_status.unlocked_rewards.push(rewardId);
		if (reward.id === 'rew_prime_vip_consultancy') {
			player.game_status.vip_token = 'PRIME-VIP-TEST1234';
		}
		return { success: true, message: 'Canje exitoso' };
	}

	await t.test('debe bloquear la compra del Pase VIP para jugadores de Nivel 1, 2 o 3', () => {
		const player = {
			avatar: { xp: { points: 450, level: 2 }, cp: { points: 10 } },
			game_status: { unlocked_rewards: [] }
		};

		const res = purchase(player, 'rew_prime_vip_consultancy');
		assert.equal(res.success, false);
		assert.match(res.message, /Debes estar en nivel 4/);
		assert.equal(player.avatar.cp.points, 10, 'No debe descontar Ludens');
		assert.equal(player.game_status.unlocked_rewards.length, 0);
	});

	await t.test('debe permitir la compra de la Ficha de Reintento (Nivel 1) para cualquier nivel', () => {
		const player = {
			avatar: { xp: { points: 50, level: 1 }, cp: { points: 5 } },
			game_status: { unlocked_rewards: [] }
		};

		const res = purchase(player, 'rew_item_reintento');
		assert.equal(res.success, true);
		assert.equal(player.avatar.cp.points, 3);
		assert.ok(player.game_status.unlocked_rewards.includes('rew_item_reintento'));
	});

	await t.test('debe permitir la compra del Pase VIP al alcanzar Nivel 4 o superior', () => {
		const player = {
			avatar: { xp: { points: 950, level: 4 }, cp: { points: 5 } },
			game_status: { unlocked_rewards: [] }
		};

		const res = purchase(player, 'rew_prime_vip_consultancy');
		assert.equal(res.success, true);
		assert.equal(player.avatar.cp.points, 3);
		assert.ok(player.game_status.unlocked_rewards.includes('rew_prime_vip_consultancy'));
		assert.equal(player.game_status.vip_token, 'PRIME-VIP-TEST1234');
	});
});

// --- 7. GAME MASTERS CONSOLE & ADMIN CAPABILITIES ---
test('Game Masters Console: Codes, Alerts, Maps & Market Auditing', async (t) => {
	const sampleCodes = [
		{ id: 'code_gm_pbl_trap', code: 'G1P8', category: 'game_master', display_id: 'GM-01', description: 'La Trampa de los Puntos' },
		{ id: 'code_gm_goodhart', code: 'G1GH', category: 'game_master', display_id: 'GM-03', description: 'Ley de Goodhart' },
		{ id: 'code_rec_calibracion', code: 'K7X2', category: 'recinto', display_id: 'REC-01', description: 'Onboarding & Primera Victoria' },
		{ id: 'code_ludens_init', code: 'LUDENS', category: 'inicial', display_id: 'INIT-01', description: 'Código Maestro' }
	];

	await t.test('debe filtrar códigos correctamente por categoría game_master, recinto e inicial', () => {
		const gmCodes = sampleCodes.filter((c) => c.category === 'game_master');
		const recCodes = sampleCodes.filter((c) => c.category === 'recinto');
		const initCodes = sampleCodes.filter((c) => c.category === 'inicial');

		assert.equal(gmCodes.length, 2);
		assert.equal(gmCodes[0].display_id, 'GM-01');
		assert.equal(recCodes.length, 1);
		assert.equal(recCodes[0].display_id, 'REC-01');
		assert.equal(initCodes.length, 1);
		assert.equal(initCodes[0].code, 'LUDENS');
	});

	await t.test('debe generar y estructurar alertas correctamente para eventgage_event_alerts', () => {
		function createAlertPayload(eventId, data) {
			return {
				id: `alert_${Date.now()}`,
				event_id: eventId,
				title: data.title || null,
				message: data.message,
				type: data.type || 'info',
				expiration_seconds: data.expiration_seconds || 30,
				character_id: data.character_id || null,
				scheduled_at: new Date().toISOString()
			};
		}

		const alert = createAlertPayload('evt-gamescon', {
			title: 'ALERTA TÁCTICA',
			message: 'GIOCCHI detectó actividad en el pabellón 2.',
			type: 'warning',
			character_id: 'char_cipher',
			expiration_seconds: 45
		});

		assert.ok(alert.id.startsWith('alert_'));
		assert.equal(alert.event_id, 'evt-gamescon');
		assert.equal(alert.type, 'warning');
		assert.equal(alert.character_id, 'char_cipher');
		assert.equal(alert.expiration_seconds, 45);
	});

	await t.test('debe permitir encender y apagar la iluminación de hotspots en el mapa', () => {
		const map = {
			id: 'map_01',
			name: 'Plano Principal',
			hotspots: [
				{ id: 'hs_01', title: 'Estación Alpha', x: 25, y: 40, is_active: true },
				{ id: 'hs_02', title: 'Bóveda Subterránea', x: 75, y: 80, is_active: false }
			]
		};

		function toggleHotspot(mapObj, hotspotId, nextState) {
			return {
				...mapObj,
				hotspots: mapObj.hotspots.map((hs) =>
					hs.id === hotspotId ? { ...hs, is_active: nextState } : hs
				)
			};
		}

		const updated1 = toggleHotspot(map, 'hs_02', true);
		assert.equal(updated1.hotspots.find((h) => h.id === 'hs_02').is_active, true);

		const updated2 = toggleHotspot(updated1, 'hs_01', false);
		assert.equal(updated2.hotspots.find((h) => h.id === 'hs_01').is_active, false);
	});
});

// --- 8. CONFIGURABLE EVENT MILESTONES & NARRATIVE TRIGGERS ---
test('Game Mechanics: Configurable Event Milestones & Narrative Triggers', async (t) => {
	const customEventMilestones = [
		{
			count: 3,
			xp: 100,
			cp: 1,
			spBonus: 2,
			rank: 2,
			rankTitle: 'Agente de Campo',
			lore: 'Acceso prioritario a la Bóveda.',
			narrative: {
				title: 'Informe Táctico: Primeros Movimientos de la Inercia',
				speaker_name: 'Dra. Elena Huizinga',
				portrait_url: '/images/gamescon/characters/char_huizinga.jpg',
				content_html: '<p>Movimiento del adversario...</p><div class="tip-box">Tip de Gamificación</div>'
			}
		},
		{
			count: 6,
			xp: 120,
			cp: 2,
			spBonus: 2,
			rank: 3,
			rankTitle: 'Especialista Táctico',
			unlockItem: 'item_llave_boveda_prime',
			lore: 'Obtuviste la Llave Criptográfica.',
			narrative: {
				title: 'Informe Táctico: Infiltración en el Círculo Mágico',
				speaker_name: 'Comandante Marcus Vance',
				portrait_url: '/images/gamescon/characters/char_marcus.jpg',
				content_html: '<p>Círculo mágico...</p><div class="tip-box">Tip de Fail Smart</div>'
			}
		}
	];

	function checkMilestones(avatar, status, milestoneList) {
		if (!Array.isArray(status.milestones_claimed)) status.milestones_claimed = [];
		if (!Array.isArray(status.journal)) status.journal = [];
		const completedCount = status.completed_missions.length;
		const reached = [];

		for (const m of milestoneList) {
			if (completedCount >= m.count && !status.milestones_claimed.includes(m.count)) {
				status.milestones_claimed.push(m.count);
				avatar.xp.points += m.xp || 0;
				avatar.cp.points += m.cp || 0;
				avatar.rank = m.rank || 1;
				avatar.rank_title = m.rankTitle;
				if (m.unlockItem && !status.unlocked_items.includes(m.unlockItem)) {
					status.unlocked_items.unshift(m.unlockItem);
				}
				if (m.narrative) {
					const mJournalId = `journal_milestone_${m.count}`;
					if (!status.journal.some((j) => j.id === mJournalId)) {
						status.journal.unshift({
							id: mJournalId,
							title: `🏆 ${m.narrative.title}`,
							content_html: m.narrative.content_html
						});
					}
				}
				reached.push(m);
			}
		}
		return reached;
	}

	await t.test('debe disparar la narrativa del Hito 1 al completar 3 misiones y guardarla en la Bitácora', () => {
		const avatar = { xp: { points: 200, level: 2 }, cp: { points: 50 }, sp: { EST: 10, ANA: 10 } };
		const status = { completed_missions: ['m1', 'm2', 'm3'], milestones_claimed: [], unlocked_items: [], journal: [] };

		const reached = checkMilestones(avatar, status, customEventMilestones);
		assert.equal(reached.length, 1);
		assert.equal(reached[0].rankTitle, 'Agente de Campo');
		assert.equal(reached[0].narrative.speaker_name, 'Dra. Elena Huizinga');
		assert.equal(avatar.xp.points, 300); // 200 + 100
		assert.equal(avatar.cp.points, 51); // 50 + 1
		assert.equal(status.journal.length, 1);
		assert.equal(status.journal[0].id, 'journal_milestone_3');
		assert.ok(status.journal[0].content_html.includes('Tip de Gamificación'));
	});

	await t.test('debe desbloquear ítems exclusivos y no redisparar hitos ya reclamados', () => {
		const avatar = { xp: { points: 500, level: 3 }, cp: { points: 80 }, sp: { EST: 12, ANA: 10 } };
		const status = {
			completed_missions: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'],
			milestones_claimed: [3],
			unlocked_items: [],
			journal: [{ id: 'journal_milestone_3', title: 'Hito 1' }]
		};

		const reached = checkMilestones(avatar, status, customEventMilestones);
		assert.equal(reached.length, 1);
		assert.equal(reached[0].count, 6);
		assert.equal(reached[0].rankTitle, 'Especialista Táctico');
		assert.ok(status.unlocked_items.includes('item_llave_boveda_prime'));
		assert.equal(status.journal.length, 2);
		assert.equal(status.journal[0].id, 'journal_milestone_6');
	});

	await t.test('debe estructurar y paginar narrativas por páginas explícitas o división automática de párrafos', () => {
		function getPages(m) {
			if (!m?.narrative) return [{ content_html: m?.lore || '' }];
			if (Array.isArray(m.narrative.pages) && m.narrative.pages.length > 0) {
				return m.narrative.pages.map((p) => (typeof p === 'string' ? { tag: null, content_html: p } : { tag: p.tag || null, content_html: p.content_html || '' }));
			}
			const html = m.narrative.content_html || '';
			const chunks = html.split(/(?=<p><strong>|<div class=["']tip-box["']>|<p>)/i).map((c) => c.trim()).filter((c) => c.length > 0);
			return chunks.map((c, i) => ({ tag: `Página ${i + 1}`, content_html: c }));
		}

		const pagesExplicit = getPages({
			narrative: {
				pages: [
					{ tag: 'MOVIMIENTO DEL ADVERSARIO', content_html: '<p>Parte 1</p>' },
					{ tag: 'LOGRO DE LA AGENCIA', content_html: '<p>Parte 2</p>' },
					{ tag: 'TIP METODOLÓGICO', content_html: '<div class="tip-box">Parte 3</div>' }
				]
			}
		});
		assert.equal(pagesExplicit.length, 3);
		assert.equal(pagesExplicit[0].tag, 'MOVIMIENTO DEL ADVERSARIO');
		assert.equal(pagesExplicit[2].tag, 'TIP METODOLÓGICO');

		const pagesAuto = getPages({
			narrative: {
				content_html: '<p><strong>Movimiento del Adversario:</strong> Texto 1</p><p><strong>Logro:</strong> Texto 2</p><div class="tip-box">Tip 3</div>'
			}
		});
		assert.equal(pagesAuto.length, 3);
	});
});

// --- 9. BEHAVIORAL ANALYTICS & REPORTING ENGINE ---
test('Analytics Engine: Behavioral Tracking, Hourly Velocity & CSV Reports', async (t) => {
	// Mock analytics store for testing aggregations
	const mockEventId = 'evt-gamescon-2026';
	const sampleEvents = [
		{
			event_id: mockEventId,
			user_id: 'usr_01',
			event_name: 'player_joined',
			category: 'onboarding',
			payload: { avatar_id: 'avatar_disenador', faction_id: 'fac_aprendizaje_activo' },
			created_at: '2026-08-20T10:05:00Z'
		},
		{
			event_id: mockEventId,
			user_id: 'usr_02',
			event_name: 'player_joined',
			category: 'onboarding',
			payload: { avatar_id: 'avatar_arquitecto', faction_id: 'fac_impacto_valor' },
			created_at: '2026-08-20T10:15:00Z'
		},
		{
			event_id: mockEventId,
			user_id: 'usr_01',
			event_name: 'code_redeemed',
			category: 'progression',
			payload: { code: 'REC-01', display_id: 'REC-01', xp_awarded: 150, cp_awarded: 50 },
			created_at: '2026-08-20T10:20:00Z'
		},
		{
			event_id: mockEventId,
			user_id: 'usr_01',
			event_name: 'mission_completed',
			category: 'progression',
			payload: { mission_id: 'm_code_01', mission_type: 'code', xp_awarded: 150, cp_awarded: 50 },
			created_at: '2026-08-20T10:20:00Z'
		},
		{
			event_id: mockEventId,
			user_id: 'usr_01',
			event_name: 'dice_check_rolled',
			category: 'mechanic',
			payload: { mission_id: 'm_dice_01', roll: 16, modifier: 7, total: 23, dc: 12, success: true },
			created_at: '2026-08-20T11:05:00Z'
		},
		{
			event_id: mockEventId,
			user_id: 'usr_01',
			event_name: 'mission_completed',
			category: 'progression',
			payload: { mission_id: 'm_dice_01', mission_type: 'dice_check', xp_awarded: 50, cp_awarded: 1 },
			created_at: '2026-08-20T11:05:00Z'
		},
		{
			event_id: mockEventId,
			user_id: 'usr_02',
			event_name: 'trivia_answered',
			category: 'mechanic',
			payload: { mission_id: 'm_trivia_01', is_correct: true },
			created_at: '2026-08-20T11:15:00Z'
		},
		{
			event_id: mockEventId,
			user_id: 'usr_02',
			event_name: 'mission_completed',
			category: 'progression',
			payload: { mission_id: 'm_trivia_01', mission_type: 'trivia_quiz', xp_awarded: 50, cp_awarded: 1 },
			created_at: '2026-08-20T11:15:00Z'
		},
		{
			event_id: mockEventId,
			user_id: 'usr_01',
			event_name: 'contact_profile_activated',
			category: 'social',
			payload: { personal_code: '@X7K9M2', company: 'Agencia Huizinga' },
			created_at: '2026-08-20T11:30:00Z'
		},
		{
			event_id: mockEventId,
			user_id: 'usr_01',
			event_name: 'contact_scanned',
			category: 'social',
			payload: { target_user_id: 'usr_02', scanner_faction_id: 'fac_aprendizaje_activo', target_faction_id: 'fac_impacto_valor' },
			created_at: '2026-08-20T11:35:00Z'
		},
		{
			event_id: mockEventId,
			user_id: 'usr_01',
			event_name: 'reward_purchased',
			category: 'economy',
			payload: { reward_id: 'rew_prime_vip_consultancy', reward_name: 'Pase VIP', category: 'vip_lead', cost_cp: 2, token_generated: 'PRIME-VIP-A1B2C3D4' },
			created_at: '2026-08-20T12:10:00Z'
		},
		{
			event_id: mockEventId,
			user_id: 'usr_01',
			event_name: 'treaty_signed',
			category: 'social',
			payload: { faction_id: 'fac_aprendizaje_activo', rank: 2 },
			created_at: '2026-08-20T12:45:00Z'
		}
	];

	function computeHourlyMissions(events) {
		const missionEvents = events.filter((e) => e.event_name === 'mission_completed');
		const map = new Map();
		for (const ev of missionEvents) {
			const d = new Date(ev.created_at);
			const hourKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:00`;
			const type = ev.payload?.mission_type || 'unknown';
			if (!map.has(hourKey)) map.set(hourKey, { count: 0, types: {} });
			const b = map.get(hourKey);
			b.count++;
			b.types[type] = (b.types[type] || 0) + 1;
		}
		return Array.from(map.entries()).map(([key, val]) => ({
			hourKey: key,
			count: val.count,
			types: val.types
		}));
	}

	function computeOverview(events) {
		const uniqueUsers = new Set();
		let playersJoined = 0;
		let missionsCompleted = 0;
		let codesRedeemed = 0;
		let contactsScanned = 0;
		let rewardsPurchased = 0;
		let treatiesSigned = 0;

		for (const ev of events) {
			if (ev.user_id) uniqueUsers.add(ev.user_id);
			if (ev.event_name === 'player_joined') playersJoined++;
			if (ev.event_name === 'mission_completed') missionsCompleted++;
			if (ev.event_name === 'code_redeemed') codesRedeemed++;
			if (ev.event_name === 'contact_scanned') contactsScanned++;
			if (ev.event_name === 'reward_purchased') rewardsPurchased++;
			if (ev.event_name === 'treaty_signed') treatiesSigned++;
		}

		return {
			totalEvents: events.length,
			uniqueUsersCount: uniqueUsers.size,
			playersJoined,
			missionsCompleted,
			codesRedeemed,
			contactsScanned,
			rewardsPurchased,
			treatiesSigned
		};
	}

	function generateCSV(overview, eventId) {
		const rows = [
			['Metrica', 'Valor'],
			['Event_ID', eventId],
			['Total_Eventos', overview.totalEvents],
			['Usuarios_Unicos', overview.uniqueUsersCount],
			['Agentes_Creados', overview.playersJoined],
			['Misiones_Completadas', overview.missionsCompleted],
			['Contactos_Intercambiados', overview.contactsScanned],
			['Canjes_Boveda', overview.rewardsPurchased],
			['Tratados_Firmados', overview.treatiesSigned]
		];
		return rows.map((r) => r.join(',')).join('\n');
	}

	await t.test('debe agrupar misiones completadas en bloques horarios con desglose de mecánicas', () => {
		const hourly = computeHourlyMissions(sampleEvents);
		assert.equal(hourly.length, 2, 'Debe haber 2 franjas horarias (10:00 y 11:00 UTC)');

		const h10 = hourly.find((h) => h.hourKey.includes('10:00'));
		assert.ok(h10);
		assert.equal(h10.count, 1);
		assert.equal(h10.types.code, 1);

		const h11 = hourly.find((h) => h.hourKey.includes('11:00'));
		assert.ok(h11);
		assert.equal(h11.count, 2);
		assert.equal(h11.types.dice_check, 1);
		assert.equal(h11.types.trivia_quiz, 1);
	});

	await t.test('debe calcular métricas consolidadas de engagement y comportamiento humano', () => {
		const overview = computeOverview(sampleEvents);
		assert.equal(overview.totalEvents, 12);
		assert.equal(overview.uniqueUsersCount, 2);
		assert.equal(overview.playersJoined, 2);
		assert.equal(overview.missionsCompleted, 3);
		assert.equal(overview.codesRedeemed, 1);
		assert.equal(overview.contactsScanned, 1);
		assert.equal(overview.rewardsPurchased, 1);
		assert.equal(overview.treatiesSigned, 1);
	});

	await t.test('debe generar reporte CSV válido y bien formateado para descarga', () => {
		const overview = computeOverview(sampleEvents);
		const csv = generateCSV(overview, mockEventId);
		assert.ok(csv.includes('Metrica,Valor'));
		assert.ok(csv.includes('Event_ID,evt-gamescon-2026'));
		assert.ok(csv.includes('Misiones_Completadas,3'));
		assert.ok(csv.includes('Contactos_Intercambiados,1'));
		assert.ok(csv.includes('Tratados_Firmados,1'));
	});

	await t.test('debe capturar el texto completo de reflexiones IA y generar reporte CSV de ai_prompts', () => {
		const aiPromptEvents = [
			{
				event_id: mockEventId,
				user_id: 'usr_01',
				event_name: 'ai_prompt_evaluated',
				category: 'mechanic',
				payload: {
					mission_id: 'm01_giocchi_calibration',
					mission_title: 'Misión 01: Calibración Conceptual',
					player_name: 'Agente Alex Vance',
					faction_id: 'fac_aprendizaje_activo',
					faction_name: 'División de Aprendizaje Activo',
					avatar_title: 'El Diseñador Conductual',
					user_response_text: 'El mito es pensar que gamificar es solo poner puntos.',
					giocchi_feedback: 'Excelente análisis crítico del mito.',
					score_xp: 35,
					is_fallback: false,
					response_length: 53
				},
				created_at: '2026-08-20T12:35:00Z'
			}
		];

		function generateAiPromptsCSV(events) {
			const headers = [
				'Fecha_Hora_ISO',
				'User_ID',
				'Nombre_Agente',
				'Faccion',
				'Rol_Avatar',
				'ID_Mision',
				'Titulo_Mision',
				'Texto_Escrito_Jugador',
				'Puntaje_XP_GIOCCHI',
				'Es_Modo_Offline',
				'Feedback_GIOCCHI'
			];
			const rows = events.map((e) => {
				const p = e.payload || {};
				return [
					e.created_at || '',
					e.user_id || '',
					`"${(p.player_name || 'Agente').replace(/"/g, '""')}"`,
					`"${(p.faction_name || p.faction_id || '').replace(/"/g, '""')}"`,
					`"${(p.avatar_title || '').replace(/"/g, '""')}"`,
					p.mission_id || '',
					`"${(p.mission_title || '').replace(/"/g, '""')}"`,
					`"${(p.user_response_text || '').replace(/"/g, '""')}"`,
					p.score_xp || 0,
					p.is_fallback ? 'SI' : 'NO',
					`"${(p.giocchi_feedback || '').replace(/"/g, '""')}"`
				];
			});
			return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		}

		const csv = generateAiPromptsCSV(aiPromptEvents);
		assert.ok(csv.includes('Texto_Escrito_Jugador'));
		assert.ok(csv.includes('Feedback_GIOCCHI'));
		assert.ok(csv.includes('El mito es pensar que gamificar es solo poner puntos.'));
		assert.ok(csv.includes('Excelente análisis crítico del mito.'));
		assert.ok(csv.includes('Agente Alex Vance'));
		assert.ok(csv.includes('35'));
		assert.ok(csv.includes('NO'));
	});
});

// --- 10. TESTS DE COMUNICACIONES DESBLOQUEABLES POR MISIÓN & REMOVE_ON_CODE ---
test('Game Mechanics: Mission Unlockable Communications & remove_on_code Lifecycle', async (t) => {
	const player = {
		avatar: { name: 'Agente S', xp: { points: 0, level: 1 } },
		game_status: {
			unlocked_communications: [],
			completed_missions: [],
			redeemed_codes: []
		}
	};

	function completeMissionWithComm(mission) {
		if (mission.mechanic?.unlock_communication) {
			const uComm = mission.mechanic.unlock_communication;
			const commId = uComm.id || `comm_${mission.id}`;
			if (!player.game_status.unlocked_communications.some((c) => c.id === commId)) {
				player.game_status.unlocked_communications.unshift({
					id: commId,
					character_id: uComm.character_id || 'char_cipher',
					badge: uComm.badge || 'DIRECTIVA DE CAMPO',
					badge_type: uComm.badge_type || 'tactical',
					text: uComm.text,
					remove_on_code: uComm.remove_on_code || null,
					unlocked_at: new Date().toISOString()
				});
			}
		}
		player.game_status.completed_missions.push(mission.id);
	}

	function redeemCode(cleanCode) {
		player.game_status.redeemed_codes.push(cleanCode);
		if (Array.isArray(player.game_status.unlocked_communications)) {
			player.game_status.unlocked_communications = player.game_status.unlocked_communications.filter(
				(comm) => !comm.remove_on_code || comm.remove_on_code.trim().toUpperCase() !== cleanCode
			);
		}
	}

	await t.test('debe apilar múltiples comunicaciones en modo lista (Newest First) sin sobrescribirlas', () => {
		completeMissionWithComm({
			id: 'rec_calibracion',
			mechanic: {
				unlock_communication: {
					id: 'comm_rec_calibracion',
					character_id: 'char_cipher',
					text: 'Directiva GM-01',
					remove_on_code: 'G1P8'
				}
			}
		});
		assert.equal(player.game_status.unlocked_communications.length, 1);
		assert.equal(player.game_status.unlocked_communications[0].id, 'comm_rec_calibracion');

		completeMissionWithComm({
			id: 'rec_feedback_loop',
			mechanic: {
				unlock_communication: {
					id: 'comm_rec_feedback_loop',
					character_id: 'char_cipher',
					text: 'Directiva GM-15',
					remove_on_code: 'G5DS'
				}
			}
		});
		assert.equal(player.game_status.unlocked_communications.length, 2, 'Deben coexistir 2 comunicaciones');
		assert.equal(player.game_status.unlocked_communications[0].id, 'comm_rec_feedback_loop', 'La más reciente debe estar arriba');
		assert.equal(player.game_status.unlocked_communications[1].id, 'comm_rec_calibracion');

		completeMissionWithComm({
			id: 'rec_fail_smart',
			mechanic: {
				unlock_communication: {
					id: 'comm_rec_fail_smart',
					character_id: 'char_cipher',
					text: 'Directiva GM-02',
					remove_on_code: 'G1TB'
				}
			}
		});
		assert.equal(player.game_status.unlocked_communications.length, 3, 'Deben coexistir 3 comunicaciones');
		assert.equal(player.game_status.unlocked_communications[0].id, 'comm_rec_fail_smart');
	});

	await t.test('al canjear el código remove_on_code debe eliminar sólo la directiva correspondiente', () => {
		redeemCode('G1P8'); // Código de GM-01
		assert.equal(player.game_status.unlocked_communications.length, 2, 'Debe quedar con 2 comunicaciones');
		assert.ok(!player.game_status.unlocked_communications.some((c) => c.id === 'comm_rec_calibracion'), 'comm_rec_calibracion debió ser eliminada');
		assert.ok(player.game_status.unlocked_communications.some((c) => c.id === 'comm_rec_feedback_loop'), 'comm_rec_feedback_loop debe permanecer');
		assert.ok(player.game_status.unlocked_communications.some((c) => c.id === 'comm_rec_fail_smart'), 'comm_rec_fail_smart debe permanecer');
	});

	await t.test('al canjear otro código remove_on_code debe eliminar la siguiente directiva', () => {
		redeemCode('G1TB'); // Código de GM-02
		assert.equal(player.game_status.unlocked_communications.length, 1, 'Debe quedar con 1 comunicación');
		assert.equal(player.game_status.unlocked_communications[0].id, 'comm_rec_feedback_loop');
	});
});

// --- 11. TESTS DEL DIRECTORIO DE SPONSORS Y ALIADOS ESTRATÉGICOS (TAB PREMIUM) ---
test('Vendors Directory: Ordering, Contact Integrity & Banner Specifications', async (t) => {
	const mockVendors = [
		{
			id: 'vendor_f2p',
			name: 'Free to Play',
			tagline: 'Especialistas en Gamificación para Aprendizaje',
			contact_name: 'Javier Velásquez',
			linkedin_url: 'https://www.linkedin.com/in/javier-velasquez-game/',
			logo_url: '/images/gamescon/banners/f2p.png',
			tier: 'organizer',
			order_index: 1,
			is_active: true
		},
		{
			id: 'vendor_prime',
			name: 'Prime Business School',
			tagline: 'Escuela de negocios con programas de gamificación',
			contact_name: 'Eduardo Guacaneme',
			linkedin_url: 'https://www.linkedin.com/in/ramon-guacaneme/',
			logo_url: '/images/gamescon/banners/logoPrime.jpg',
			tier: 'partner',
			order_index: 2,
			is_active: true
		},
		{
			id: 'vendor_play4agile',
			name: 'Play4Agilie',
			tagline: 'Unimos Agilismo con juego en organizaciones',
			contact_name: 'Fabián Dulcé',
			linkedin_url: 'https://www.linkedin.com/in/fabiandulce/',
			logo_url: '/images/gamescon/banners/play4agile.jpeg',
			tier: 'partner',
			order_index: 3,
			is_active: true
		},
		{
			id: 'vendor_wakeupbrain',
			name: 'WakeUpBrain',
			tagline: 'Unimos Innovación y Sostenibilidad con Lúdica',
			contact_name: 'Guillermo Solano',
			linkedin_url: 'https://www.linkedin.com/in/solanobrainer/',
			logo_url: '/images/gamescon/banners/wakeupbrain.png',
			tier: 'partner',
			order_index: 4,
			is_active: true
		}
	];

	await t.test('debe ordenar los sponsors y aliados en el orden exacto requerido', () => {
		const sorted = [...mockVendors].sort((a, b) => a.order_index - b.order_index);
		assert.equal(sorted[0].name, 'Free to Play');
		assert.equal(sorted[0].contact_name, 'Javier Velásquez');
		assert.equal(sorted[1].name, 'Prime Business School');
		assert.equal(sorted[1].contact_name, 'Eduardo Guacaneme');
		assert.equal(sorted[2].name, 'Play4Agilie');
		assert.equal(sorted[2].contact_name, 'Fabián Dulcé');
		assert.equal(sorted[3].name, 'WakeUpBrain');
		assert.equal(sorted[3].contact_name, 'Guillermo Solano');
	});

	await t.test('debe validar la estructura completa de URLs y datos de contacto de cada vendor', () => {
		for (const v of mockVendors) {
			assert.ok(v.name.length > 0, 'Debe tener nombre');
			assert.ok(v.contact_name.length > 0, 'Debe tener contacto');
			assert.ok(v.tagline.length > 0, 'Debe tener tagline descriptivo');
			assert.ok(v.logo_url.startsWith('/images/gamescon/banners/'), 'Debe apuntar a la carpeta banners');
			assert.ok(v.linkedin_url.startsWith('https://www.linkedin.com/in/'), 'Debe ser enlace de LinkedIn válido');
		}
	});

	await t.test('debe asignar el rol de organizador prioritario a Free to Play', () => {
		const organizer = mockVendors.find((v) => v.tier === 'organizer');
		assert.ok(organizer);
		assert.equal(organizer.name, 'Free to Play');
		assert.equal(organizer.order_index, 1);
	});
});






import { supabaseServer } from './supabaseClient';

// Memoria volátil para desarrollo local si Supabase no está conectado
const memoryStore = {
	users: new Map<string, { id: string; email: string; full_name?: string }>(),
	eventAvatars: new Map<string, any>(),
	demoEventPoints: 140,
	factionPoints: {
		faction_hackers: 1250,
		faction_resistencia: 980
	}
};

export async function getEventBySlug(slug: string) {
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_events')
			.select('*')
			.eq('slug', slug)
			.maybeSingle();

		if (data) return data;
	} catch (e) {
		console.warn('Fallback to mock event data');
	}

	// Mock Fallback para evento Demo
	if (slug === 'demo') {
		return {
			id: '00000000-0000-0000-0000-000000000001',
			slug: 'demo',
			title: 'CyberCon 2026 Demo',
			description: 'Evento interactivo de prueba para demostrar las mecánicas de Eventgage.',
			current_chapter: 1
		};
	}
	return null;
}

export async function getEventFactionsAndAvatars(eventId: string) {
	try {
		const [factionsRes, avatarsRes] = await Promise.all([
			supabaseServer.from('eventgage_event_factions').select('*').eq('event_id', eventId),
			supabaseServer.from('eventgage_event_avatars').select('*').eq('event_id', eventId)
		]);

		if (factionsRes.data?.length && avatarsRes.data?.length) {
			return {
				factions: factionsRes.data,
				avatars: avatarsRes.data
			};
		}
	} catch (e) {
		console.warn('Fallback to mock factions/avatars');
	}

	// Mock Fallback
	return {
		factions: [
			{
				id: 'faction_hackers',
				name: 'Colectivo Hacker',
				description: 'Especialistas en filtración de datos y operaciones digitales.',
				faction_points: memoryStore.factionPoints.faction_hackers,
				icon_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=100&auto=format&fit=crop&q=80'
			},
			{
				id: 'faction_resistencia',
				name: 'División Resistencia',
				description: 'Agentes de campo enfocados en exploración táctica y misiones físicas.',
				faction_points: memoryStore.factionPoints.faction_resistencia,
				icon_url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=100&auto=format&fit=crop&q=80'
			}
		],
		avatars: [
			{
				id: 'avatar_cipher_m',
				name: 'Cipher (Masculino)',
				description: 'Analista táctico con alta percepción de patrones.',
				gender: 'male',
				image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
				default_sp: { hackeo: 12, percepcion: 15, sigilo: 8 },
				default_cp: { points: 100, icon: '⚡' },
				default_dp: { misiones_resueltas: 0 }
			},
			{
				id: 'avatar_cipher_f',
				name: 'Valkyrie (Femenino)',
				description: 'Especialista en infiltración cibernética y combate digital.',
				gender: 'female',
				image_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
				default_sp: { hackeo: 15, percepcion: 10, sigilo: 12 },
				default_cp: { points: 100, icon: '⚡' },
				default_dp: { misiones_resueltas: 0 }
			}
		]
	};
}

export async function getPlayerAvatar(userId: string, eventId: string) {
	try {
		const { data, error } = await supabaseServer
			.from('eventgage_event_avatar')
			.select('*')
			.eq('user_id', userId)
			.eq('event_id', eventId)
			.maybeSingle();

		if (data) return data;
	} catch (e) {
		console.warn('Fallback memory for player avatar');
	}

	const key = `${userId}_${eventId}`;
	return memoryStore.eventAvatars.get(key) || null;
}

export async function createPlayerAvatar(userId: string, eventId: string, avatarChoiceId: string, factionId: string) {
	const { avatars } = await getEventFactionsAndAvatars(eventId);
	const selectedTemplate = avatars.find((a: any) => a.id === avatarChoiceId) || avatars[0];

	const initialAvatarObj = {
		avatar_id: selectedTemplate.id,
		faction_id: factionId,
		name: selectedTemplate.name,
		gender: selectedTemplate.gender,
		image_url: selectedTemplate.image_url,
		xp: { points: 0, level: 1 },
		sp: selectedTemplate.default_sp,
		cp: selectedTemplate.default_cp,
		dp: selectedTemplate.default_dp
	};

	const initialStatusObj = {
		viewed_dialogues: [],
		journal: [],
		unlocked_items: [],
		unlocked_missions: ['m_code_01'],
		current_mission_id: 'm_code_01'
	};

	try {
		const { data, error } = await supabaseServer
			.from('eventgage_event_avatar')
			.upsert(
				{
					user_id: userId,
					event_id: eventId,
					avatar: initialAvatarObj,
					game_status: initialStatusObj,
					settings: { sound: true }
				},
				{ onConflict: 'user_id,event_id' }
			)
			.select()
			.single();

		if (data) return data;
	} catch (e) {
		console.warn('Fallback saving avatar memory');
	}

	const key = `${userId}_${eventId}`;
	const record = {
		id: 'avatar-' + Date.now(),
		user_id: userId,
		event_id: eventId,
		avatar: initialAvatarObj,
		game_status: initialStatusObj,
		settings: { sound: true }
	};
	memoryStore.eventAvatars.set(key, record);
	return record;
}

export async function submitCodeForPlayer(userId: string, eventId: string, codeStr: string) {
	const player = await getPlayerAvatar(userId, eventId);
	if (!player) throw new Error('Jugador no encontrado');

	const cleanCode = codeStr.trim().toUpperCase();

	// Validar código
	if (cleanCode !== 'DEMO2026' && cleanCode !== 'CYBER_DEMO' && cleanCode !== 'DISABLE_99') {
		return { success: false, message: 'Código inválido o expirado' };
	}

	const updatedAvatar = { ...player.avatar };
	const updatedStatus = { ...player.game_status };

	if (cleanCode === 'DEMO2026' || cleanCode === 'CYBER_DEMO') {
		updatedAvatar.xp.points += 150;
		if (updatedAvatar.xp.points >= 200) updatedAvatar.xp.level = 2;
		updatedAvatar.cp.points += 50;
		if (!updatedStatus.journal) updatedStatus.journal = [];
		if (!updatedStatus.journal.some((j: any) => j.id === 'entry_1')) {
			updatedStatus.journal.push({
				id: 'entry_1',
				title: 'Bitácora 01: El Inicio',
				content_html: '<p>Has ingresado al sistema principal de CyberCon. Los registros confirman la firma digital del Colectivo.</p>'
			});
		}
		if (!updatedStatus.unlocked_items.includes('item_audio_log_1')) {
			updatedStatus.unlocked_items.push('item_audio_log_1');
		}
		if (!updatedStatus.unlocked_missions.includes('m_time_bomb_01')) {
			updatedStatus.unlocked_missions.push('m_time_bomb_01');
		}
	} else if (cleanCode === 'DISABLE_99') {
		updatedAvatar.xp.points += 250;
		updatedAvatar.cp.points += 100;
		if (updatedAvatar.xp.points >= 200) updatedAvatar.xp.level = 2;
		if (!updatedStatus.journal) updatedStatus.journal = [];
		if (!updatedStatus.journal.some((j: any) => j.id === 'entry_2')) {
			updatedStatus.journal.push({
				id: 'entry_2',
				title: 'Bitácora 02: Amenaza Neutralizada',
				content_html: '<p>La bomba de datos fue desactivada con éxito. El servidor local vuelve a operar de manera segura.</p>'
			});
		}
	}

	// Persistir
	player.avatar = updatedAvatar;
	player.game_status = updatedStatus;

	try {
		await supabaseServer
			.from('eventgage_event_avatar')
			.update({ avatar: updatedAvatar, game_status: updatedStatus, updated_at: new Date().toISOString() })
			.eq('user_id', userId)
			.eq('event_id', eventId);
	} catch (e) {
		console.warn('Updated player in memory');
	}

	const key = `${userId}_${eventId}`;
	memoryStore.eventAvatars.set(key, player);

	return {
		success: true,
		message: '¡Código canjeado con éxito! +150 XP, +50 CP y nueva entrada en Bitácora.',
		playerState: player
	};
}

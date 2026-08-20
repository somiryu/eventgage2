<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { dev } from '$app/environment';
	import {
		audioSettings,
		setSoundEnabled,
		playDiceRoll,
		playDiceSuccess,
		playDiceFail,
		playCodeValid,
		playCodeInvalid,
		playMilestone,
		playTriviaCorrect,
		playTriviaIncorrect,
		playItemUnlocked,
		playModalOpen,
		playCipherNotification
	} from '$lib/client/audio.svelte';
	// Sistema de íconos (3.3 del informe UX): reemplaza el emoji nativo del
	// SO por SVG de línea de Lucide — mismo trazo en todos los dispositivos,
	// coloreable con currentColor/acento de facción, animable con CSS. Cada
	// ícono se importa por nombre (no la librería entera), así el bundler
	// solo empaqueta los ~20 que realmente se usan.
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Target from '@lucide/svelte/icons/target';
	import Backpack from '@lucide/svelte/icons/backpack';
	import MapIcon from '@lucide/svelte/icons/map';
	import Radio from '@lucide/svelte/icons/radio';
	import User from '@lucide/svelte/icons/user';
	import Lock from '@lucide/svelte/icons/lock';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Zap from '@lucide/svelte/icons/zap';
	import Gem from '@lucide/svelte/icons/gem';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Vote from '@lucide/svelte/icons/vote';
	import Music from '@lucide/svelte/icons/music';
	import FileText from '@lucide/svelte/icons/file-text';
	import CircleUserRound from '@lucide/svelte/icons/circle-user-round';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import Dices from '@lucide/svelte/icons/dices';
	import Sparkle from '@lucide/svelte/icons/sparkle';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Users from '@lucide/svelte/icons/users';
	import Check from '@lucide/svelte/icons/check';
	import SkillBadge from '$lib/components/SkillBadge.svelte';
	import VaultModal from '$lib/components/VaultModal.svelte';
	import { subscribeToEventActivity } from '$lib/client/supabaseClient';
	import DiceCheckRoll from '$lib/components/DiceCheckRoll.svelte';
	import FactionLeaderboardWidget from '$lib/components/FactionLeaderboardWidget.svelte';

	const { data } = $props();

	// Mensaje único y honesto para cualquier fallo de infraestructura — nunca
	// se reusa el copy de validación ("código incorrecto", etc.) para esto.
	// Coincide en tono con SYSTEM_ERROR_MESSAGE del servidor; se usa acá solo
	// como último recurso si la respuesta no trae su propio mensaje (p.ej. sin
	// conexión de red en absoluto, donde ni siquiera hay respuesta del servidor).
	const SYSTEM_ERROR_FALLBACK =
		'Cipher perdió la señal con el sistema central. No es tu código ni tu respuesta — reintenta en unos segundos.';

	// Estado local reactivo
	let activeTab = $state<'hud' | 'missions' | 'items' | 'map' | 'feed' | 'profile'>('hud');
	let player = $state<any>(data.playerState);
	let selectedFactionId = $state(data.factions?.[0]?.id || '');
	let joining = $state(false);
	let joinError = $state('');

	// Placeholder intencional para imágenes sin arte real o inalcanzables (3.11
	// del informe UX): mientras `image_url` sea NULL (ítems reales de Gamescon,
	// hoy sin arte generado) o la carga falle en vivo (wifi saturado del
	// evento), se muestra un ícono de sistema en vez del ícono de imagen rota
	// nativo del navegador — un roto se lee como "esto está mal", un
	// placeholder intencional se lee como "falta arte todavía".
	let brokenImages = $state<Record<string, boolean>>({});
	function markImageBroken(key: string) {
		brokenImages[key] = true;
	}

	// "Esto está vivo ahora mismo" (3.4 del informe UX): en vez de fabricar un
	// dato falso tipo "última actividad de tu facción" (no existe esa columna
	// en la base), se usa el momento REAL en que el propio cliente recibió el
	// último refresco de facciones/Inercia Global (1.3) — honesto porque es un
	// hecho que sí ocurrió, no una simulación de actividad ajena.
	let worldStateUpdatedAt = $state<number | null>(null);
	let nowTick = $state(Date.now());

	// Espejo local de facciones e Inercia Global (1.3 del informe UX): antes se leía
	// directamente de `data.factions`/`data.eventPoints`, cargados una sola vez
	// por el `load` del servidor y nunca refrescados — el HUD quedaba mostrando
	// valores viejos tras una acción exitosa hasta recargar la página a mano.
	// Los handlers de acción actualizan estos dos con lo que devuelve el
	// servidor (ver attachWorldState en eventService.ts), sin pedir un segundo
	// endpoint.
	let factionsState = $state<any[]>(data.factions || []);
	let eventPointsState = $state<any>(data.eventPoints || null);
	// Fix del bug is_public (docs/system_capabilities_and_mechanics.md 2.13):
	// un ítem público arranca bloqueado para todos y se desbloquea acá recién
	// cuando el servidor confirma que alguien lo descubrió primero (carga
	// inicial de `data.event.global_unlocked_items`, actualizado en vivo por
	// el broadcast `item_unlocked_globally`).
	let globalUnlockedItemsState = $state<string[]>(data.event?.global_unlocked_items || []);
	// Notificación en vivo de "te escanearon" (Juego de Contactos) — llega por
	// Realtime Broadcast, filtrada del lado del cliente por targetUserId.
	let contactScannedNotification = $state<{ scannerName: string; xp: number; cp: number } | null>(null);
	// Feed Comunitario real (docs/system_capabilities_and_mechanics.md 2.16):
	// carga inicial desde `eventgage_event_activity_feed` (persistente), y se
	// antepone en vivo con los mismos eventos que ya llegan por
	// subscribeToEventActivity — un solo canal alimenta ambas cosas.
	let activityFeed = $state<any[]>(data.activityFeed || []);
	function describeActivity(entry: any): string {
		if (entry.type === 'item_unlocked_globally') {
			return `¡Toda la comunidad desbloqueó "${entry.payload?.itemName}"!`;
		}
		if (entry.type === 'contact_scanned') {
			return `${entry.payload?.scannerName || 'Un agente'} sumó un nuevo contacto a su red.`;
		}
		if (entry.type === 'milestone_reached') {
			return `🏆 ${entry.payload?.playerName || 'Un agente'} alcanzó el Rango "${entry.payload?.rankTitle}".`;
		}
		if (entry.type === 'faction_lead_change') {
			return `⚡ ¡${entry.payload?.factionName} tomó la delantera!`;
		}
		if (entry.type === 'ai_prompt_highlight') {
			return `✨ ${entry.payload?.playerName || 'Un agente'} recibió una evaluación destacada de GIOCCHI en "${entry.payload?.missionTitle}".`;
		}
		if (entry.type === 'treaty_signed') {
			return `🏛️ ${entry.payload?.playerName || 'Un agente'} firmó el Tratado Huizinga.`;
		}
		if (entry.type === 'gm_alert') {
			return entry.payload?.message || 'Transmisión del Game Master.';
		}
		return 'Nueva actividad registrada.';
	}

	// Onboarding Wizard por Pasos (Paso 1: Facción, Paso 2: Clase/Avatar)
	let onboardingStep = $state<1 | 2>(1);
	let selectedAvatarIndex = $state(0);
	let selectedGender = $state<'male' | 'female'>('male');

	// No-reactivo a propósito: el toggle de sonido (handleToggleSound) ya
	// mantiene `audioSettings.enabled` al día en cada cambio dentro de la
	// sesión, así que acá solo hace falta levantar la preferencia persistida
	// UNA vez al llegar el primer playerState.
	let soundInitialized = false;

	$effect(() => {
		const soundSetting = player?.settings?.sound;
		if (!soundInitialized && soundSetting !== undefined) {
			setSoundEnabled(soundSetting !== false);
			soundInitialized = true;
		}
	});

	// Cálculo del mayor SP por habilidad en todo el catálogo de clases (100% relativo de las barras)
	const maxSP = $derived.by(() => {
		const totals: Record<string, number> = {};
		for (const avatar of data.avatarsCatalog || []) {
			if (avatar.default_sp) {
				for (const [key, val] of Object.entries(avatar.default_sp as Record<string, number>)) {
					if (!totals[key] || (val as number) > totals[key]) {
						totals[key] = val as number;
					}
				}
			}
		}
		return totals;
	});

	const currentAvatarClass = $derived(
		data.avatarsCatalog?.[selectedAvatarIndex] || data.avatarsCatalog?.[0]
	);

	// Formularios de Misiones y Códigos
	let codeInput = $state('');
	let codeMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let submittingCode = $state(false);
	let selectedMission = $state<any>(null);

	// Resolución de misiones dice_check / trivia_quiz / ai_prompt_challenge (Fase 2)
	let resolvingMission = $state(false);
	let missionResult = $state<any>(null);
	let aiPromptText = $state('');

	// Feedback progresivo mientras GIOCCHI evalúa (puede tardar hasta ~15s
	// bajo carga alta de la API de Gemini) — sin esto, un botón "Enviando..."
	// fijo por más de diez segundos se siente colgado. Mensajes rotativos en
	// vez de streaming real: la respuesta final es un JSON estricto (no texto
	// libre), así que mostrar tokens a medida que llegan no es viable sin
	// arriesgar parsear JSON a medio construir — esto es más simple y confiable.
	const GIOCCHI_THINKING_MESSAGES = [
		'GIOCCHI está leyendo tu respuesta...',
		'Cruzando tu argumento con la teoría BEM...',
		'Consultando el archivo de BEM Brain...',
		'Calibrando el puntaje de pertinencia...',
		'Redactando el análisis...'
	];
	let giocchiThinkingIndex = $state(0);
	$effect(() => {
		if (!(resolvingMission && selectedMission?.type === 'ai_prompt_challenge')) {
			giocchiThinkingIndex = 0;
			return;
		}
		const interval = setInterval(() => {
			giocchiThinkingIndex = (giocchiThinkingIndex + 1) % GIOCCHI_THINKING_MESSAGES.length;
		}, 2200);
		return () => clearInterval(interval);
	});

	// Reintento de dice_check con la Ficha de Reintento de la Bóveda (Fase
	// 4.4) — resultado propio, separado de `missionResult`: si reusara
	// `missionResult`, el resultado del reintento desaparecería apenas
	// `player.game_status.reintento_used` se actualiza (canRetry pasaría a
	// false en el mismo render que trae el resultado).
	let retryingMission = $state(false);
	let retryResult = $state<any>(null);

	// Momento ceremonial de Hito (1.5 del informe UX): separado del feedback
	// rutinario de la misión — antes el logro más importante del juego se veía
	// dentro del mismo recuadro verde que un acierto de trivia cualquiera.
	let milestoneOverlay = $state<any[] | null>(null);
	let milestonePageIndex = $state(0);

	function getMilestoneNarrativePages(m: any): Array<{ tag?: string | null; content_html: string }> {
		if (!m?.narrative) {
			return [{ content_html: `<p>${m?.lore || 'Hito alcanzado con éxito.'}</p>` }];
		}
		if (Array.isArray(m.narrative.pages) && m.narrative.pages.length > 0) {
			return m.narrative.pages.map((p: any) => {
				if (typeof p === 'string') return { tag: null, content_html: p };
				return { tag: p.tag || null, content_html: p.content_html || p.text || '' };
			});
		}
		const html = m.narrative.content_html || '';
		if (!html) {
			return [{ tag: null, content_html: `<p>${m?.lore || 'Hito alcanzado con éxito.'}</p>` }];
		}
		const chunks = html
			.split(/(?=<p><strong>|<div class=["']tip-box["']>|<p>)/i)
			.map((c: string) => c.trim())
			.filter((c: string) => c.length > 0);

		if (chunks.length <= 1) {
			return [{ tag: null, content_html: html }];
		}

		return chunks.map((chunk: string, idx: number) => {
			let tag: string | null = null;
			if (/adversario/i.test(chunk)) tag = 'MOVIMIENTO DEL ADVERSARIO';
			else if (/agencia|logro/i.test(chunk)) tag = 'LOGRO DE LA AGENCIA';
			else if (/tip/i.test(chunk)) tag = 'TIP METODOLÓGICO · EDUCACIÓN SUPERIOR';
			else tag = `PARTE ${idx + 1}`;
			return { tag, content_html: chunk };
		});
	}

	// Fase de revelado de un dice_check (Fase 5, animación estilo XCOM):
	// 'idle' = sin resultado todavía, 'revealing' = la barra ya tiene el
	// resultado del servidor pero las consecuencias (XP/facción/Inercia) no
	// se aplicaron aún, 'consequences' = el jugador presionó "Continuar" y
	// recién ahí se aplican y se muestran.
	let diceRollPhase = $state<'idle' | 'revealing' | 'consequences'>('idle');
	let diceRollPreviousItemCount = 0;

	// Recuperar datos de evaluación de GIOCCHI si la misión ya fue completada previamente
	function getCompletedAiMissionData(mission: any) {
		if (!player?.game_status?.journal || !mission) return null;
		const targetTitle = `Bitácora: ${mission.title}`;
		const entry = player.game_status.journal.find(
			(j: any) => j.title === targetTitle || (mission.title && j.title?.toLowerCase().includes(mission.title.toLowerCase()))
		);
		if (!entry || !entry.content_html) return null;

		const userMatch = entry.content_html.match(/<strong>Tu respuesta:<\/strong>\s*(.*?)(?:<\/p>|$)/s);
		const feedbackMatch = entry.content_html.match(
			/Análisis de GIOCCHI.*?:<\/strong>(?:<br\s*\/?>|\s)*(.*?)(?:<\/p>|$)/s
		);
		const xpMatch = entry.content_html.match(/\+(\d+)\s*XP/);

		return {
			userInput: userMatch ? userMatch[1].replace(/<[^>]*>/g, '').trim() : '',
			feedback: feedbackMatch
				? feedbackMatch[1].replace(/<br\s*\/?>/gi, '\n\n').replace(/<[^>]*>/g, '').trim()
				: entry.content_html.replace(/<[^>]*>/g, '').trim(),
			xpAwarded: xpMatch ? Number(xpMatch[1]) : 25
		};
	}

	const isAiMissionCompleted = $derived(
		selectedMission?.type === 'ai_prompt_challenge' &&
		Boolean(selectedMission?.completed || player?.game_status?.completed_missions?.includes(selectedMission?.id))
	);

	// Modal dedicado de evaluación de GIOCCHI (Foco limpio y scrollable para retos de IA)
	let giocchiModalData = $state<{
		missionTitle: string;
		userInput: string;
		feedback: string;
		xpAwarded: number;
		hasUnlockedCommunication?: boolean;
	} | null>(null);

	// Cuenta regresiva y cancelación para retos de IA (GIOCCHI)
	let aiCountdown = $state(25);
	let aiCountdownInterval: any = null;
	let aiAbortController: AbortController | null = null;
	let requestingQuickFallback = $state(false);

	// Al cambiar de misión seleccionada, se limpia el resultado de la anterior
	$effect(() => {
		selectedMission;
		missionResult = null;
		aiPromptText = '';
		retryResult = null;
		diceRollPhase = 'idle';
	});

	// Votaciones, Resultados y Feed Sub-Tabs
	let feedSubTab = $state<'feed' | 'votes' | 'premium'>('feed');
	let expandedVoteIds = $state<Record<string, boolean>>({ m_vote_01: true });
	let votingStats = $state<Record<string, any>>({});
	let selectedHotspot = $state<any>(null);

	// Modal de Recompensas y Misiones Desbloqueadas por Código
	let codeRewardModal = $state<{
		code: string;
		message: string;
		xpReward: number;
		cpReward: number;
		newlyUnlockedMissions: any[];
		unlockedItemIds: string[];
	} | null>(null);

	// Typewriter effect para Onboarding & Hitos
	let typewriterProgress = $state(0);
	let isTypewriterComplete = $state(false);

	// Refrescar resultados de votaciones en vivo
	async function refreshVotingStats() {
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'get_voting_results' })
			});
			if (res.ok) {
				const resJson = await res.json();
				if (resJson.votingResults) {
					votingStats = resJson.votingResults;
				}
			}
		} catch (e) {
			console.warn('No se pudieron refrescar los resultados de votación:', e);
		}
	}

	// Al cambiar de pantalla o pestaña, siempre devolver el scroll arriba
	$effect(() => {
		activeTab;
		feedSubTab;
		if (typeof window !== 'undefined') {
			window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
			const scrollContainers = document.querySelectorAll('.app-shell, main, .main-scroll-area, .game-container, .tab-pane');
			scrollContainers.forEach((el) => {
				el.scrollTop = 0;
			});
		}
	});

	// Pantalla de detalle de Gremio: se abre al tocar el nombre de una facción
	// (header o widget de Gremios) y trae la nómina bajo demanda — no viene
	// precargada en el load de la página, no hace falta para el resto del HUD.
	let factionDetailId = $state<string | null>(null);
	let factionMembers = $state<any[] | null>(null);
	let loadingFactionMembers = $state(false);
	let factionMembersError = $state('');

	async function openFactionDetail(factionId: string) {
		factionDetailId = factionId;
		factionMembers = null;
		factionMembersError = '';
		loadingFactionMembers = true;
		playModalOpen();
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'get_faction_members', factionId })
			});
			const resData = await res.json();
			if (!res.ok) {
				factionMembersError = resData.error || SYSTEM_ERROR_FALLBACK;
			} else {
				factionMembers = resData.members || [];
			}
		} catch (e) {
			factionMembersError = SYSTEM_ERROR_FALLBACK;
		} finally {
			loadingFactionMembers = false;
		}
	}

	// Bóveda de Inteligencia (Fase 4.4 del GDD): un solo overlay compartido,
	// accesible desde 3 puntos (badge de CP, Inventario, Perfil) — pedido
	// explícito de Javier (2026-08-17). El catálogo ya viene precargado en
	// `data.rewards` (estático por evento), solo la compra/activación pega al
	// servidor.
	let vaultOpen = $state(false);
	function openVault() {
		vaultOpen = true;
		playModalOpen();
	}
	async function handlePurchaseReward(rewardId: string) {
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'purchase', rewardId })
			});
			const resData = await res.json();
			if (resData.playerState) player = resData.playerState;
			if (resData.factions) factionsState = resData.factions;
			if (resData.eventPoints) eventPointsState = resData.eventPoints;
			if (resData.factions || resData.eventPoints) worldStateUpdatedAt = Date.now();
			resData.success ? playCodeValid() : playCodeInvalid();
			return { success: !!resData.success, message: resData.message || resData.error || SYSTEM_ERROR_FALLBACK };
		} catch (e) {
			return { success: false, message: SYSTEM_ERROR_FALLBACK };
		}
	}
	async function handleActivateSpBoost() {
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'activate_sp_boost' })
			});
			const resData = await res.json();
			if (resData.playerState) player = resData.playerState;
			resData.success ? playCodeValid() : playCodeInvalid();
			return { success: !!resData.success, message: resData.message || resData.error || SYSTEM_ERROR_FALLBACK };
		} catch (e) {
			return { success: false, message: SYSTEM_ERROR_FALLBACK };
		}
	}

	// Juego de Contactos (Networking) — sección 2.18 de
	// docs/system_capabilities_and_mechanics.md. El canje del código '@...'
	// de otro jugador reusa el mismo campo de código y handleCodeSubmit ya
	// existentes (el backend lo enruta solo); acá solo hace falta la
	// activación/edición del propio perfil y la lista de contactos guardados.
	let contactModalOpen = $state(false);
	let contactCompany = $state('');
	let contactPhone = $state('');
	let contactLinkedin = $state('');
	let contactBio = $state('');
	let contactHelpOpen = $state(false);
	let savingContact = $state(false);
	let contactModalMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	function openContactModal() {
		const existing = player?.avatar?.contact_profile;
		contactCompany = existing?.company || '';
		contactPhone = existing?.phone || '';
		contactLinkedin = existing?.linkedin || '';
		contactBio = existing?.bio || '';
		contactModalMessage = null;
		contactModalOpen = true;
		playModalOpen();
	}

	async function handleActivateContactProfile() {
		savingContact = true;
		contactModalMessage = null;
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'activate_contact_profile',
					company: contactCompany,
					phone: contactPhone,
					linkedin: contactLinkedin,
					bio: contactBio
				})
			});
			const resData = await res.json();
			if (resData.playerState) player = resData.playerState;
			if (resData.success) {
				playCodeValid();
				contactModalMessage = { type: 'success', text: resData.message };
			} else {
				playCodeInvalid();
				contactModalMessage = { type: 'error', text: resData.message || resData.error || SYSTEM_ERROR_FALLBACK };
			}
		} catch (e) {
			contactModalMessage = { type: 'error', text: SYSTEM_ERROR_FALLBACK };
		} finally {
			savingContact = false;
		}
	}

	// Genera y descarga una vCard (.vcf) 100% en el cliente — sin tocar el
	// servidor, sin almacenamiento de archivos. VCARD 3.0, sin el nombre de
	// la facción a propósito (pedido del documento: mantenerla profesional
	// en la agenda nativa del celular).
	function downloadContactVcf(contact: any) {
		const lines = [
			'BEGIN:VCARD',
			'VERSION:3.0',
			`FN:${contact.name || 'Agente'}`,
			contact.company ? `ORG:${contact.company}` : '',
			contact.phone ? `TEL:${contact.phone}` : '',
			contact.email ? `EMAIL:${contact.email}` : '',
			contact.bio ? `NOTE:${contact.bio.replace(/\n/g, '\\n')}` : '',
			'END:VCARD'
		].filter(Boolean);
		const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${(contact.name || 'contacto').replace(/\s+/g, '_')}.vcf`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	let votedOption = $state<string | null>(null);
	let voting = $state(false);

	$effect(() => {
		if ((data as any).votingResults) {
			votingStats = (data as any).votingResults;
		}
		if (player?.game_status?.votes?.['m_vote_01']?.option_id) {
			votedOption = player.game_status.votes['m_vote_01'].option_id;
		}
	});

	// Alertas Dinámicas del Game Master
	let alertsState = $state<any[]>([]);
	let activeAlert = $state<{ message: string; type: string; secondsLeft: number; speakerName?: string; portraitUrl?: string | null } | null>(null);
	$effect(() => {
		if (alertsState.length === 0 && data.alerts && data.alerts.length > 0) {
			alertsState = data.alerts;
		}
	});
	$effect(() => {
		if (!activeAlert && alertsState && alertsState.length > 0) {
			const alertObj = alertsState[0];
			if (alertObj.scheduled_at) {
				const scheduledTime = new Date(alertObj.scheduled_at).getTime();
				const expirationMs = (alertObj.expiration_seconds || 30) * 1000;
				const remainingSeconds = Math.round((scheduledTime + expirationMs - Date.now()) / 1000);
				const seenKey = `eventgage_seen_alert_${alertObj.id}`;
				const alreadySeen = typeof window !== 'undefined' && sessionStorage.getItem(seenKey);

				if (remainingSeconds > 0 && !alreadySeen) {
					if (typeof window !== 'undefined') {
						sessionStorage.setItem(seenKey, '1');
					}
					activeAlert = {
						message: alertObj.message,
						type: alertObj.type || 'info',
						secondsLeft: remainingSeconds,
						speakerName: alertObj.speaker_name,
						portraitUrl: alertObj.portrait_url
					};
				}
			}
		}
	});

	// Suscripción al canal de Realtime Broadcast del evento — un solo canal
	// compartido (`event:{eventId}:activity`, ver supabaseClient.ts), no uno
	// por jugador. Se abre una sola vez mientras `data.event.id` esté
	// disponible; si Realtime no está disponible (dev local sin servidor
	// Realtime), simplemente nunca llega nada — no rompe la página.
	$effect(() => {
		const eventId = data.event?.id;
		if (!eventId) return;
		const unsubscribe = subscribeToEventActivity(eventId, (activity) => {
			if (activity.type === 'gm_alert') {
				playCipherNotification();
				const alertId = activity.alertId || `alert_${Date.now()}`;
				if (typeof window !== 'undefined') {
					sessionStorage.setItem(`eventgage_seen_alert_${alertId}`, '1');
				}
				activeAlert = {
					message: activity.message,
					type: activity.alertType || 'info',
					secondsLeft: activity.expirationSeconds || 30,
					speakerName: activity.speakerName,
					portraitUrl: activity.portraitUrl
				};
				alertsState = [
					{
						id: alertId,
						message: activity.message,
						type: activity.alertType || 'info',
						title: activity.title,
						speaker_name: activity.speakerName || 'Game Master',
						portrait_url: activity.portraitUrl || null,
						scheduled_at: new Date().toISOString()
					},
					...alertsState
				];
				return;
			}
			// Feed Comunitario: cada evento que pasa por este canal también
			// queda persistido en `eventgage_event_activity_feed` del lado del
			// servidor (ver broadcastEventActivity) — acá solo lo anteponemos
			// en vivo para no esperar a la próxima recarga.
			activityFeed = [{ type: activity.type, payload: activity, created_at: new Date().toISOString() }, ...activityFeed];

			if (activity.type === 'item_unlocked_globally') {
				if (!globalUnlockedItemsState.includes(activity.itemId)) {
					globalUnlockedItemsState = [...globalUnlockedItemsState, activity.itemId];
				}
				activeAlert = {
					message: `¡Toda la comunidad desbloqueó "${activity.itemName}"!`,
					type: 'info',
					secondsLeft: 30
				};
			} else if (activity.type === 'contact_scanned' && activity.targetUserId === player?.user_id) {
				contactScannedNotification = {
					scannerName: activity.scannerName,
					xp: activity.xpAwarded,
					cp: activity.cpAwarded
				};
				playItemUnlocked();
			}
		});
		return unsubscribe;
	});

	// Tick de reloj compartido — alimenta el pulso "vivo ahora mismo" (3.4),
	// las Alertas y el countdown real de time_bomb (derivado en `missions`
	// a partir de `mission_timers`/`time_limit_seconds` del servidor).
	$effect(() => {
		const interval = setInterval(() => {
			if (activeAlert && activeAlert.secondsLeft > 0) activeAlert.secondsLeft--;
			nowTick = Date.now();
		}, 1000);
		return () => clearInterval(interval);
	});

	// Texto del pulso "vivo ahora mismo" (3.4) — depende de nowTick para que
	// se actualice cada segundo sin recalcular nada más pesado.
	const worldPulseText = $derived.by(() => {
		nowTick;
		if (!worldStateUpdatedAt) return null;
		const secs = Math.max(0, Math.round((Date.now() - worldStateUpdatedAt) / 1000));
		if (secs < 3) return 'Actualizado ahora mismo';
		if (secs < 60) return `Actualizado hace ${secs}s`;
		const mins = Math.round(secs / 60);
		return `Actualizado hace ${mins} min`;
	});

	// Refresh manual de Gremios + puntaje global (feedback directo de Javier):
	// no depende de que el propio jugador complete una acción para ver el
	// estado real — otro agente puede haber movido los puntos mientras tanto.
	let refreshingWorldState = $state(false);
	async function refreshWorldState() {
		if (refreshingWorldState) return;
		refreshingWorldState = true;
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'get_world_state' })
			});
			const resData = await res.json();
			if (res.ok) {
				if (resData.factions) factionsState = resData.factions;
				if (resData.eventPoints) eventPointsState = resData.eventPoints;
				worldStateUpdatedAt = Date.now();
			}
		} catch (e) {
			// Silencioso a propósito: refresh manual de un dato secundario, no
			// bloquea nada si falla — el jugador puede volver a tocar el botón.
		} finally {
			refreshingWorldState = false;
		}
	}

	// Ítems Multimedia Dinámicos (Solo los desbloqueados/encontrados se visualizan en el inventario,
	// ordenados con el más reciente primero — hallazgo 1.5 del informe UX y regla de inventario)
	const items = $derived(
		(data.items || [])
			.map((item: any) => ({
				...item,
				unlocked: (item.is_public && globalUnlockedItemsState.includes(item.id)) || player?.game_status?.unlocked_items?.includes(item.id) || false
			}))
			.filter((item: any) => item.unlocked)
			.sort((a: any, b: any) => {
				const unlockedOrder: string[] = player?.game_status?.unlocked_items || [];
				const aIdx = unlockedOrder.indexOf(a.id);
				const bIdx = unlockedOrder.indexOf(b.id);
				if (aIdx === -1 && bIdx === -1) return 0;
				if (aIdx === -1) return 1;
				if (bIdx === -1) return -1;
				return aIdx - bIdx;
			})
	);

	// Recompensas de la Bóveda ya adquiridas (Fase 4.4) — para la sección del
	// Inventario, ordenadas más-reciente-primero, mismo criterio que `items`.
	const purchasedRewards = $derived(
		[...(player?.game_status?.unlocked_rewards || [])]
			.reverse()
			.map((id: string) => (data.rewards || []).find((r: any) => r.id === id))
			.filter(Boolean)
	);

	// Misiones Dinámicas (Desbloqueadas / Nuevas primero)
	const missions = $derived(
		(data.missions || []).map((m: any) => {
			const isUnlocked = m.public !== false || player?.game_status?.unlocked_missions?.includes(m.id) || false;
			const isCompleted = player?.game_status?.completed_missions?.includes(m.id) ||
				(m.id === 'm_code_01' && player?.game_status?.journal?.some((j: any) => j.id === 'entry_1')) ||
				(m.id === 'm_time_bomb_01' && player?.game_status?.journal?.some((j: any) => j.id === 'entry_2')) ||
				(m.id === 'm_vote_01' && (votedOption !== null || player?.game_status?.votes?.['m_vote_01'])) || false;

			// Countdown real de time_bomb (antes cosmético, ver checkExpiredTimeBombs
			// en el servidor): se deriva de `mission_timers[m.id]` + `time_limit_seconds`
			// usando `nowTick` (ya se actualiza cada segundo) en vez de un timer propio.
			let remainingSeconds: number | null = null;
			let isExpired = false;
			if (m.type === 'time_bomb') {
				isExpired = player?.game_status?.expired_missions?.includes(m.id) || false;
				const sealedAt = player?.game_status?.mission_timers?.[m.id];
				if (sealedAt && m.time_limit_seconds) {
					nowTick;
					const elapsedSecs = Math.floor((Date.now() - new Date(sealedAt).getTime()) / 1000);
					remainingSeconds = Math.max(0, m.time_limit_seconds - elapsedSecs);
					if (remainingSeconds === 0) isExpired = true;
				}
			}

			return {
				...m,
				unlocked: isUnlocked,
				completed: isCompleted,
				remainingSeconds,
				expired: isExpired
			};
		}).sort((a: any, b: any) => {
			if (a.unlocked !== b.unlocked) return Number(b.unlocked) - Number(a.unlocked);
			// Una misión expirada es un callejón sin salida, igual que una
			// completada — no debe competir por atención con las activas.
			const aDone = a.completed || a.expired;
			const bDone = b.completed || b.expired;
			if (aDone !== bDone) return Number(aDone) - Number(bDone);
			return 0;
		})
	);

	// Listado de Votaciones en las que ha participado el agente (Newest first)
	const participatedVotes = $derived.by(() => {
		const userVotes = player?.game_status?.votes || {};
		const list: Array<{
			mission: any;
			votedOptionId: string;
			votedOptionText: string;
			votedAt?: string;
			stats: any;
		}> = [];

		for (const m of (data.missions || []) as any[]) {
			if (m.type === 'collective_vote' || m.mission_type === 'collective_vote') {
				const voteRecord = userVotes[m.id];
				const hasVoted = Boolean(voteRecord || (m.id === 'm_vote_01' && votedOption));
				if (hasVoted) {
					const chosenOptionId = voteRecord?.option_id || votedOption;
					const mOptions = m.options || m.mechanic?.options || [
						{ id: 'sec_a', text: 'Zona A: Stand de Robótica' },
						{ id: 'sec_b', text: 'Zona B: Escenario Principal' }
					];
					const optObj = mOptions.find((o: any) => o.id === chosenOptionId);
					const stats = votingStats[m.id] || {
						missionId: m.id,
						title: m.title,
						question: m.mechanic?.question || m.description || 'Decisión de facción',
						totalVotes: 0,
						options: mOptions.map((o: any) => ({ ...o, count: 0, percentage: 0 }))
					};

					list.push({
						mission: m,
						votedOptionId: chosenOptionId,
						votedOptionText: optObj ? optObj.text : chosenOptionId,
						votedAt: voteRecord?.voted_at,
						stats
					});
				}
			}
		}
		return list;
	});

	// Jerarquía visual en tarjetas de ítems (3.12 del informe UX): la
	// descripción ya viene estructurada en el propio texto — "Driver BEM: ...
	// Lección Teórica/Libreto completo: ... Tip práctico: ..." — separada por
	// líneas en blanco (ver seed_gamescon.sql). No hace falta un campo nuevo
	// en el modelo de datos, solo parsear ese patrón ya consistente para
	// mostrarlo en bloques con su propio label en vez de un párrafo corrido.
	// Si algún ítem no sigue el patrón (fallback), se muestra la descripción
	// cruda tal cual, sin romper nada.
	function parseItemDescription(desc: string): { driver: string; lessonLabel: string; lesson: string; tip: string } | null {
		if (!desc) return null;
		const driverMatch = desc.match(/Driver BEM:\s*([\s\S]*?)(?=\n\n(?:Lección Teórica|Libreto completo):)/);
		const lessonMatch = desc.match(/(Lección Teórica|Libreto completo):\s*([\s\S]*?)(?=\n\nTip práctico:)/);
		const tipMatch = desc.match(/Tip práctico:\s*([\s\S]*)$/);
		if (!driverMatch || !lessonMatch || !tipMatch) return null;
		return {
			driver: driverMatch[1].trim(),
			lessonLabel: lessonMatch[1] === 'Libreto completo' ? 'Libreto Completo' : 'Lección Teórica',
			lesson: lessonMatch[2].trim(),
			tip: tipMatch[1].trim()
		};
	}

	const LIBRETO_COLLAPSE_LENGTH = 180;
	let expandedLibretos = $state<Record<string, boolean>>({});
	function toggleLibreto(id: string) {
		expandedLibretos[id] = !expandedLibretos[id];
	}

	// Color de acento por facción (3.6 del informe UX): hoy el morado de marca
	// es el mismo para todos, sin importar el bando — acá se le da a cada
	// facción un acento propio, por posición en `factionsState` (no hay campo
	// de color en el modelo de datos). Se evitan a propósito los colores ya
	// usados con otro significado (verde=éxito, rojo=error, ámbar=Hito,
	// índigo=acción del jugador) para no generar confusión semántica.
	const FACTION_COLORS = ['#22d3ee', '#f472b6', '#fb923c', '#a78bfa'];
	function factionColor(idx: number): string {
		return FACTION_COLORS[idx % FACTION_COLORS.length];
	}
	const ownFactionIndex = $derived(
		factionsState.findIndex((f: any) => f.id === player?.avatar?.faction_id)
	);
	const ownFactionColor = $derived(
		ownFactionIndex >= 0 ? factionColor(ownFactionIndex) : '#818cf8'
	);
	// Widget de Gremios como tabla de líderes: ordenado por puntos, no por el
	// orden de llegada de la API. `idx` conserva la posición original porque
	// el color de facción (factionColor) es de identidad, no de ranking — si
	// coloreara por posición en el ranking, el color de un gremio cambiaría
	// cada vez que sube o baja, rompiendo la asociación color↔facción que ya
	// se usa en el avatar, el badge de rango y el resto del HUD.
	const rankedFactions = $derived(
		(factionsState || [])
			.map((fac: any, idx: number) => ({ fac, idx }))
			.sort((a: any, b: any) => (b.fac.faction_points ?? 1000) - (a.fac.faction_points ?? 1000))
	);

	// Misión Destacada en HUD. Antes caía en missions[0] cuando no había ninguna
	// desbloqueada-y-sin-completar, lo que reciclaba una misión ya resuelta como
	// si siguiera disponible (hallazgo 1.6) y dejaba al jugador sin ninguna
	// instrucción real en el estado "completé todo lo que tenía" (hallazgo 3.5,
	// el estado en el que más tiempo real de evento pasa un jugador). Ahora cae
	// en null y el template muestra un estado explícito en su lugar.
	const featuredMission = $derived(
		missions.find((m: any) => m.unlocked && !m.completed && !m.expired) || null
	);

	// Logo principal del HUD (por evento, vía eventgage_events.config.main_logo)
	const mainLogoUrl = $derived<string | null>(
		data.event?.config?.main_logo || null
	);

	// Niveles dinámicos cargados de la base de datos (bem.eventgage_event_levels)
	const defaultLevelsFallback = [
		{ id: 'lvl_1', level: 1, xp_required: 0, title: 'Recluta Inicial' },
		{ id: 'lvl_2', level: 2, xp_required: 200, title: 'Agente Calibrado' },
		{ id: 'lvl_3', level: 3, xp_required: 500, title: 'Agente Activo' },
		{ id: 'lvl_4', level: 4, xp_required: 900, title: 'Agente Veterano' },
		{ id: 'lvl_5', level: 5, xp_required: 1400, title: 'Especialista de Élite' },
		{ id: 'lvl_6', level: 6, xp_required: 2000, title: 'Estratega Mayor' },
		{ id: 'lvl_7', level: 7, xp_required: 2600, title: 'Maestro Huizinga' }
	];
	const eventLevels = $derived<Array<{ id: string; level: number; xp_required: number; title: string; unlocks?: any }>>(
		data.levels && data.levels.length > 0 ? data.levels : defaultLevelsFallback
	);

	const currentLevelInfo = $derived.by(() => {
		const pts = player?.avatar?.xp?.points ?? 0;
		const sorted = [...eventLevels].sort((a, b) => a.level - b.level);
		let current = sorted[0];
		for (const lvl of sorted) {
			if (pts >= lvl.xp_required) {
				current = lvl;
			}
		}
		const next = sorted.find((l) => l.level === current.level + 1) || null;
		return { current, next };
	});

	const currentLevelTitle = $derived(currentLevelInfo.current?.title || 'Recluta');

	// Progreso relativo de XP dentro del nivel actual hacia el siguiente (dinámico por niveles de BD)
	const xpProgressPercent = $derived.by(() => {
		const pts = player?.avatar?.xp?.points ?? 0;
		const { current, next } = currentLevelInfo;
		if (!next) return 100;
		const minXp = current?.xp_required ?? 0;
		const nextXp = next.xp_required;
		const span = nextXp - minXp;
		if (span <= 0) return 100;
		return Math.min(100, Math.max(0, Math.round(((pts - minXp) / span) * 100)));
	});

	// Progreso hacia el próximo Hito (Configurable por evento desde data.event.config.milestones)
	const defaultMilestonesFallback = [
		{ count: 3, xp: 100, cp: 1, spBonus: 2, rank: 2, rankTitle: 'Agente de Campo', lore: 'Acceso prioritario a la Bóveda de Inteligencia.' },
		{ count: 6, xp: 120, cp: 2, spBonus: 2, rank: 3, rankTitle: 'Especialista Táctico', unlockItem: 'item_llave_boveda_prime', lore: 'Obtuviste la Llave Criptográfica PRIME.' },
		{ count: 9, xp: 140, cp: 2, spBonus: 2, rank: 4, rankTitle: 'Estratega de Enlace', lore: 'Se desclasifican las cláusulas del Tratado Huizinga.' },
		{ count: 12, xp: 150, cp: 0, spBonus: 0, rank: 5, rankTitle: 'Agente Master Huizinga', lore: 'Consagración de honor al cierre del evento.' }
	];
	const eventMilestones = $derived<any[]>(data.event?.config?.milestones || defaultMilestonesFallback);
	const MILESTONE_THRESHOLDS = $derived<number[]>(eventMilestones.map((m: any) => m.count));
	const completedMissionsCount = $derived(player?.game_status?.completed_missions?.length || 0);
	const nextMilestoneObj = $derived(eventMilestones.find((m: any) => m.count > completedMissionsCount) || null);
	const nextMilestone = $derived(nextMilestoneObj?.count || null);

	// Tope real de diseño para las barras de SP del jugador (ver SP_CAP en
	// eventService.ts) — el 20/18 del hallazgo 1.4 pasaba porque el denominador
	// usaba el máximo del catálogo de clases en vez de este tope fijo.
	const PLAYER_SP_CAP = 20;

	// Chequeo de dado (1.4 del informe UX): mostrar el modificador YA calculado
	// antes de tirar, y el DC actual con la misma fórmula que usa el servidor
	// (resolveDiceCheck en eventService.ts) para que la vista previa no diverja.
	const diceCheckAttribute = $derived(selectedMission?.mechanic?.attribute || 'EST');
	const diceCheckSp = $derived(player?.avatar?.sp?.[diceCheckAttribute] ?? 10);
	const diceCheckModifier = $derived(Math.floor(diceCheckSp / 2));
	const diceCheckDc = $derived(12 + Math.floor(completedMissionsCount / 3));
	const milestoneProgressPct = $derived.by(() => {
		if (!nextMilestone) return 100;
		const prevThreshold = [...MILESTONE_THRESHOLDS].reverse().find((t) => t <= completedMissionsCount) || 0;
		return Math.min(100, Math.round(((completedMissionsCount - prevThreshold) / (nextMilestone - prevThreshold)) * 100));
	});

	// A una misión de distancia del próximo Hito (3.4): sube el peso visual del
	// widget para que sea lo primero que salte a la vista al escanear rápido,
	// en vez de pesar igual que un medidor pasivo como Inercia Global.
	const milestoneImminent = $derived(nextMilestone !== null && nextMilestone - completedMissionsCount === 1);

	// --- Narrativa de Onboarding: 4 Actos + Modal de Cipher (secciones 5 y 7 del
	// diseño). Es lore específico de Gamescon, así que todo esto solo se activa
	// cuando el evento es 'gamescon' — el evento demo no se ve afectado.
	let narrativeActIndex = $state(0);
	let showCipherWelcomeModal = $state(false);

	const NARRATIVE_ACT1 =
		'"Identidad confirmada, Agente. Si estás leyendo esta transmisión, tu credencial ha sido validada dentro de la Agencia Antropológica Huizinga. Durante años hemos operado en las sombras, analizando cómo el diseño lúdico y la ciencia del comportamiento pueden transformar organizaciones enteras, mientras el mundo exterior sigue creyendo que la gamificación es solo acumular puntos sin sentido."';

	const NARRATIVE_ACT2 =
		'"El Sindicato de la Inercia ha infectado nuestras instituciones con burocracia, capacitaciones invisibles y fórmulas vacías. Durante este congreso, tu misión es infiltrarte en los pasillos, recuperar fragmentos de datos (Databits) y derribar mitos en tiempo real. Todo lo que recolectes nos preparará para el despliegue decisivo: al cierre del congreso, donde ejecutaremos la intervención central y definiremos el nuevo estándar del aprendizaje interactivo."';

	const NARRATIVE_ACT3_BY_AVATAR: Record<string, string> = {
		avatar_disenador_conductual:
			'"Tu mente analítica es nuestra mayor ventaja, Agente. Tu objetivo es desmantelar las trampas de sesgo y demostrar con métricas y ciencia del comportamiento que el compromiso humano no es un accidente, sino un sistema predecible y medible. Vigila los datos y optimiza cada decisión."',
		avatar_arquitecto_experiencias:
			'"Necesitamos tu visión estética y espacial, Agente. Tu objetivo es transformar dinámicas aburridas en viajes memorables. Diseña las narrativas, tensiona las interfaces y asegúrate de que cada punto de contacto despierte curiosidad genuina en lugar de apatía."',
		avatar_facilitador_sistemico:
			'"Las personas son el núcleo de esta red, Agente. Tu objetivo es tender puentes entre las facciones, activar el cambio cultural y romper la resistencia humana ante nuevas formas de aprender y colaborar. La cohesión del equipo descansa en tu liderazgo."',
		avatar_director_estrategico:
			'"Tú ves el panorama completo y el valor real del negocio, Agente. Tu objetivo es alinear cada mecánica con los objetivos institucionales de alto nivel, blindando el retorno de inversión y asegurando que nuestras soluciones tengan impacto ejecutivo sostenible."'
	};

	const NARRATIVE_ACT4_BY_FACTION: Record<string, string> = {
		fac_aprendizaje_activo:
			'"Has sido asignado a la División de Aprendizaje Activo. Tu frente de batalla es el aula, el taller y el auditorio. Tu objetivo prioritario es erradicar el \'Sabotaje del Formulario Invisible\': transformar la capacitación pasiva en dominio real. Haz que cada concepto sea vivido y dominado."',
		fac_impacto_valor:
			'"Te has integrado a la División de Impacto & Valor. Tu frente de batalla es la percepción, la lealtad y el posicionamiento. Tu misión prioritaria es derribar el \'Sabotaje de la Medalla Vacía\': demostrar que el engagement no se regala ni se compra, se conquista con experiencias memorables y auténticas."',
		fac_agilidad_autonomia:
			'"Operas ahora bajo la División de Agilidad & Autonomía. Tu frente de batalla son los procesos, la experimentación y el producto. Tu misión prioritaria es quebrar el \'Sabotaje de la Parálisis Creativa\': empoderar a los equipos para prototipar rápido, aprender del error y desatar la innovación sin pedir permiso a la burocracia."'
	};

	const currentNarrativeText = $derived.by(() => {
		if (narrativeActIndex === 1) return NARRATIVE_ACT1;
		if (narrativeActIndex === 2) return NARRATIVE_ACT2;
		if (narrativeActIndex === 3) {
			return NARRATIVE_ACT3_BY_AVATAR[player?.avatar?.avatar_id] || NARRATIVE_ACT3_BY_AVATAR.avatar_disenador_conductual;
		}
		if (narrativeActIndex === 4) {
			return NARRATIVE_ACT4_BY_FACTION[player?.avatar?.faction_id] || NARRATIVE_ACT4_BY_FACTION.fac_aprendizaje_activo;
		}
		return '';
	});

	const narrativeActLabel = $derived.by(() => {
		if (narrativeActIndex === 2) return 'La Amenaza & La Sesión de Cierre';
		if (narrativeActIndex === 3) return 'Directiva del Rol';
		if (narrativeActIndex === 4) return 'Directiva de Frente de Batalla';
		return 'Bienvenida a la Red Huizinga';
	});

	// Dispara la narrativa una sola vez, solo en Gamescon, solo si el jugador
	// (ya con avatar) todavía no la ha visto — nunca bloquea a quien vuelve a entrar.
	$effect(() => {
		if (
			player &&
			data.event?.slug === 'gamescon' &&
			!player.game_status?.narrative_seen &&
			narrativeActIndex === 0 &&
			!showCipherWelcomeModal
		) {
			narrativeActIndex = 1;
		}
	});

	// Typewriter effect reactivo para narrativa de onboarding
	$effect(() => {
		const target = currentNarrativeText;
		typewriterProgress = 0;
		isTypewriterComplete = false;
		if (!target || narrativeActIndex === 0) return;

		const timer = setInterval(() => {
			if (typewriterProgress < target.length) {
				typewriterProgress = Math.min(target.length, typewriterProgress + 3);
			} else {
				isTypewriterComplete = true;
				clearInterval(timer);
			}
		}, 14);

		return () => clearInterval(timer);
	});

	const displayedNarrativeText = $derived(
		currentNarrativeText ? currentNarrativeText.slice(0, typewriterProgress) : ''
	);

	function completeTypewriter() {
		typewriterProgress = currentNarrativeText.length;
		isTypewriterComplete = true;
	}

	function advanceNarrative() {
		// Si el texto aún se está escribiendo, el primer clic lo completa de inmediato
		if (!isTypewriterComplete && typewriterProgress < currentNarrativeText.length) {
			completeTypewriter();
			return;
		}
		if (narrativeActIndex < 4) {
			narrativeActIndex++;
		} else {
			finishNarrative();
		}
	}

	async function finishNarrative() {
		narrativeActIndex = 0;
		showCipherWelcomeModal = true;
		if (player?.game_status) player.game_status.narrative_seen = true;
		try {
			await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'mark_narrative_seen' })
			});
		} catch (e) {
			console.error('No se pudo registrar la narrativa como vista:', e);
		}
	}

	function skipNarrative() {
		finishNarrative();
	}

	function closeCipherModal() {
		showCipherWelcomeModal = false;
	}

	// Mensaje persistente de Cipher en el Canal del GM, según progreso real
	// del jugador (secciones 7.3, 7.4 y 8.3 del diseño) — no es un diálogo
	// estático de base de datos, cambia con lo que el jugador ya hizo.
	const cipherPersistentMessage = $derived.by(() => {
		const status = player?.game_status || {};
		const redeemedLudens = (status.redeemed_codes || []).includes('LUDENS');
		const m01Completed = (status.completed_missions || []).includes('m01_giocchi_calibration');
		if (m01Completed) {
			return '¡Excelente calibración! El análisis de GIOCCHI ya está guardado en tu Bitácora. Ahora es momento de entrar en acción: acércate a uno de los Game Masters PRIME en los pasillos para recibir códigos de misión, o encuentra pistas físicas en el recinto para continuar desclasificando el sistema.';
		}
		if (redeemedLudens) {
			return '¡Terminal sincronizada! Revisa tu pestaña de Misiones: GIOCCHI, nuestra IA de inteligencia táctica, te espera para calibrar tus sensores.';
		}
		return 'Usa el código LUDENS en el panel de códigos para activar el sistema y desbloquear la Misión 1.';
	});

	// Notificación de Cipher (2.x, SFX restantes): suena cuando el mensaje
	// persistente del Canal del GM cambia de verdad como consecuencia de
	// progreso real del jugador — nunca en la carga inicial de la página.
	// `lastCipherMessage` es una variable plana (no $state) a propósito: leer
	// y escribir la MISMA pieza de $state reactivo dentro de un efecto fue
	// justo el bug que causó el bucle infinito documentado en el informe UX
	// (ver hallazgo 2.x, ronda de SFX) — acá no hay ese riesgo porque la
	// escritura no es reactiva.
	let lastCipherMessage: string | null = null;
	$effect(() => {
		const msg = cipherPersistentMessage;
		if (lastCipherMessage !== null && msg !== lastCipherMessage) {
			playCipherNotification();
		}
		lastCipherMessage = msg;
	});

	// Lista de Comunicaciones Activas para el Canal de Comunicaciones:
	// Muestra por separado las transmisiones de historia (eventgage_event_dialogues)
	// y la directiva táctica de progreso de misiones (Operador Cipher).
	interface CommunicationItem {
		id: string;
		speaker_name: string;
		portrait_url?: string | null;
		badge?: string;
		badge_type?: 'tactical' | 'story';
		text: string;
	}

	const activeCommunications = $derived.by<CommunicationItem[]>(() => {
		const list: CommunicationItem[] = [];
		const charMap = new Map((data.characters || []).map((c: any) => [c.id, c]));

		// 1. Directivas de campo / Comunicaciones dinámicas desbloqueadas por misiones (unlock_communication):
		const unlockedComms = (player?.game_status?.unlocked_communications || []) as any[];
		for (const comm of unlockedComms) {
			const char = comm.character_id ? charMap.get(comm.character_id) : null;
			list.push({
				id: comm.id,
				speaker_name: char?.name || 'Operador Cipher',
				portrait_url: char?.portrait_url || '/images/gamescon/characters/char_cipher.jpg',
				badge: comm.badge || 'DIRECTIVA DE CAMPO',
				badge_type: comm.badge_type || 'tactical',
				text: comm.text
			});
		}

		// 2. Directiva Táctica Base de Cipher (Tutorial / Fallback si no hay directivas de campo activas):
		if (list.length === 0 && cipherPersistentMessage) {
			list.push({
				id: 'cipher_tactical_directive',
				speaker_name: 'Operador Cipher',
				portrait_url: '/images/gamescon/characters/char_cipher.jpg',
				badge: 'DIRECTIVA DE MISIÓN',
				badge_type: 'tactical',
				text: cipherPersistentMessage
			});
		}

		// 3. Diálogos de Historia / Transmisiones de Personajes (desde bem.eventgage_event_dialogues):
		const validDbDialogues = (data.dialogues || []).filter((d: any) => d.id !== 'dialogue_welcome');
		for (const d of validDbDialogues) {
			list.push({
				id: d.id,
				speaker_name: d.speaker_name || 'Enlace de Red',
				portrait_url: d.portrait_url || null,
				badge: d.title || 'TRANSMISIÓN DE HISTORIA',
				badge_type: 'story',
				text: d.text
			});
		}

		return list;
	});

	// Mapa Dinámico (sin datos reales: estado vacío, nunca un mapa de otro evento)
	const currentMap = $derived(
		data.maps?.[0] || {
			name: 'Mapa no disponible',
			image_url: null,
			hotspots: []
		}
	);
	// 3.10: sin mapa real, la pestaña completa se oculta en vez de mostrar un
	// estado vacío permanente — no hay nada que hacer ahí hasta que exista un
	// mapa. Si el jugador estaba parado en 'map' cuando el mapa deja de
	// existir (no debería pasar en la práctica), lo devuelve al HUD.
	const hasMap = $derived((data.maps?.length ?? 0) > 0);
	$effect(() => {
		if (!hasMap && activeTab === 'map') activeTab = 'hud';
	});

	// Puntos Mundiales Dinámicos (sin datos reales: estado vacío en vez de cifras inventadas)
	const worldPoints = $derived(
		eventPointsState || {
			display_name: 'Sin datos',
			current_points: 0,
			max_points: 0
		}
	);

	// Crear perfil / avatar si no existe
	async function handleJoinEvent() {
		if (joining || !currentAvatarClass || !selectedFactionId) return;
		joining = true;
		joinError = '';
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'join',
					avatarId: currentAvatarClass.id,
					factionId: selectedFactionId,
					gender: selectedGender
				})
			});
			const resData = await res.json();
			if (!res.ok) {
				joinError = resData.error || SYSTEM_ERROR_FALLBACK;
			} else if (resData.player) {
				player = resData.player;
			} else {
				joinError = SYSTEM_ERROR_FALLBACK;
			}
		} catch (e) {
			joinError = SYSTEM_ERROR_FALLBACK;
		} finally {
			joining = false;
		}
	}

	// Canjear Código
	async function handleCodeSubmit(codeToSubmit?: string) {
		const targetCode = codeToSubmit || codeInput;
		if (!targetCode || submittingCode) return;
		submittingCode = true;
		codeMessage = null;
		const previousItemCount = player?.game_status?.unlocked_items?.length || 0;

		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'submit_code',
					code: targetCode
				})
			});
			const resData = await res.json();
			if (!res.ok) {
				// Fallo de infraestructura (backend/red) — nunca se confunde con un
				// código erróneo. El servidor ya manda el mensaje honesto de Cipher.
				codeMessage = { type: 'error', text: resData.error || SYSTEM_ERROR_FALLBACK };
			} else if (resData.success) {
				codeMessage = { type: 'success', text: resData.message };
				playCodeValid();
				if (resData.playerState) player = resData.playerState;
				if (resData.factions) factionsState = resData.factions;
				if (resData.eventPoints) eventPointsState = resData.eventPoints;
				if (resData.factions || resData.eventPoints) worldStateUpdatedAt = Date.now();
				if (resData.milestonesReached?.length) {
					milestoneOverlay = resData.milestonesReached;
					playMilestone();
				} else {
					const newItemCount = resData.playerState?.game_status?.unlocked_items?.length || 0;
					if (newItemCount > previousItemCount) playItemUnlocked();
					const newlyUnlocked = resData.newlyUnlockedMissions || [];
					codeRewardModal = {
						code: targetCode,
						message: resData.message || `¡Código ${targetCode} canjeado con éxito!`,
						xpReward: resData.xpReward || 0,
						cpReward: resData.cpReward || 0,
						newlyUnlockedMissions: newlyUnlocked,
						unlockedItemIds: resData.newlyUnlockedItemIds || []
					};
				}
				codeInput = '';
			} else {
				// Acá sí es un código genuinamente inválido (res.ok=true, success=false)
				// — no un fallo de sistema — por eso es el único lugar donde suena el
				// tono de error de código. Ver hallazgo 1.1: nunca se confunde un fallo
				// de infraestructura con un error del jugador, tampoco en el audio.
				codeMessage = { type: 'error', text: resData.message || 'Código inválido o expirado.' };
				playCodeInvalid();
			}
		} catch (e: any) {
			// El fetch ni siquiera completó (sin red) — mismo mensaje honesto.
			codeMessage = { type: 'error', text: SYSTEM_ERROR_FALLBACK };
		} finally {
			submittingCode = false;
		}
	}

	async function handleVote(optionId: string) {
		const targetMission = selectedMission || missions.find((m: any) => m.type === 'collective_vote') || { id: 'm_vote_01' };
		if (voting) return;
		voting = true;
		const previousVote = votedOption;
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'vote',
					missionId: targetMission.id,
					optionId
				})
			});
			const resData = await res.json();
			if (!res.ok) {
				// No se marca el voto como emitido si el servidor no lo confirmó —
				// antes esto quedaba marcado visualmente aunque el voto no se guardara.
				codeMessage = { type: 'error', text: resData.error || SYSTEM_ERROR_FALLBACK };
				return;
			}
			votedOption = optionId;
			if (resData.playerState) {
				player = resData.playerState;
			}
			if (resData.votingResults) {
				votingStats = resData.votingResults;
			}
			if (resData.factions) factionsState = resData.factions;
			if (resData.eventPoints) eventPointsState = resData.eventPoints;
			if (resData.factions || resData.eventPoints) worldStateUpdatedAt = Date.now();
			if (resData.message) {
				codeMessage = { type: 'success', text: resData.message };
			}
		} catch (e) {
			votedOption = previousVote;
			codeMessage = { type: 'error', text: SYSTEM_ERROR_FALLBACK };
		} finally {
			voting = false;
		}
	}

	// Aplica las consecuencias (XP/CP ya reflejado en playerState, facción,
	// Inercia Global, hitos, ítems desbloqueados) de un dice_check recién
	// resuelto o reintentado. Se llama recién cuando el jugador presiona
	// "Continuar" en la animación de la barra (Fase 5), no apenas llega la
	// respuesta del servidor — así el resultado visual (barra + Prueba
	// superada/fallada) queda desacoplado de cuándo cambian las barras de
	// estado del mundo.
	function applyDiceCheckConsequences(resData: any, previousItemCount: number) {
		if (!resData.success) {
			diceRollPhase = 'consequences';
			return;
		}
		if (resData.playerState) player = resData.playerState;
		if (resData.factions) factionsState = resData.factions;
		if (resData.eventPoints) eventPointsState = resData.eventPoints;
		if (resData.factions || resData.eventPoints) worldStateUpdatedAt = Date.now();

		const hasMilestone = resData.milestonesReached?.length;
		if (hasMilestone) {
			milestoneOverlay = resData.milestonesReached;
			playMilestone();
		} else {
			// El sonido de "ítem desbloqueado" queda afuera cuando hay Hito
			// en la misma respuesta — el overlay ceremonial de 1.5 ya trae
			// su propio sonido y no debería competir con otro encimado.
			const newItemCount = resData.playerState?.game_status?.unlocked_items?.length || 0;
			if (newItemCount > previousItemCount) playItemUnlocked();
		}
		diceRollPhase = 'consequences';
	}

	// Resolver dice_check / trivia_quiz / ai_prompt_challenge (Fase 2)
	async function handleResolveMission(payload: { optionId?: string; answerText?: string } = {}) {
		if (!selectedMission || resolvingMission) return;
		const missionType = selectedMission.type;
		const previousItemCount = player?.game_status?.unlocked_items?.length || 0;
		if (missionType === 'dice_check') playDiceRoll();
		resolvingMission = true;

		if (missionType === 'ai_prompt_challenge') {
			aiCountdown = 25;
			if (aiCountdownInterval) clearInterval(aiCountdownInterval);
			aiCountdownInterval = setInterval(() => {
				if (aiCountdown > 0) aiCountdown--;
			}, 1000);
			aiAbortController = new AbortController();
		}

		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'resolve_mission', missionId: selectedMission.id, ...payload }),
				signal: aiAbortController?.signal
			});
			const resData = await res.json();
			if (!res.ok) {
				// La forma de esta respuesta es {error} no {success, message} —
				// sin este chequeo el recuadro de resultado quedaba en blanco.
				missionResult = { success: false, message: resData.error || SYSTEM_ERROR_FALLBACK };
				if (missionType === 'dice_check') diceRollPhase = 'consequences';
			} else if (missionType === 'dice_check') {
				// Las consecuencias (player/facciones/Inercia/sonido) se
				// difieren hasta que el jugador presione "Continuar" en la
				// barra animada — ver applyDiceCheckConsequences.
				missionResult = resData;
				diceRollPreviousItemCount = previousItemCount;
				diceRollPhase = 'revealing';
			} else {
				missionResult = resData;
				if (resData.success && resData.playerState) player = resData.playerState;
				if (resData.success && resData.factions) factionsState = resData.factions;
				if (resData.success && resData.eventPoints) eventPointsState = resData.eventPoints;
				if (resData.success && (resData.factions || resData.eventPoints)) worldStateUpdatedAt = Date.now();
				if (resData.success && missionType === 'trivia_quiz') {
					if (resData.correct) playTriviaCorrect();
					else playTriviaIncorrect();
				}
				if (resData.success && missionType === 'ai_prompt_challenge' && resData.feedback) {
					giocchiModalData = {
						missionTitle: selectedMission.title,
						userInput: payload.answerText || aiPromptText,
						feedback: resData.feedback,
						xpAwarded: resData.xpAwarded || 25,
						hasUnlockedCommunication: !!selectedMission?.mechanic?.unlock_communication
					};
					selectedMission = null;
					playSuccess();
				}
				const hasMilestone = resData.success && resData.milestonesReached?.length;
				if (hasMilestone) {
					milestoneOverlay = resData.milestonesReached;
					playMilestone();
				} else if (resData.success) {
					// El sonido de "ítem desbloqueado" queda afuera cuando hay Hito
					// en la misma respuesta — el overlay ceremonial de 1.5 ya trae
					// su propio sonido y no debería competir con otro encimado.
					const newItemCount = resData.playerState?.game_status?.unlocked_items?.length || 0;
					if (newItemCount > previousItemCount) playItemUnlocked();
				}
			}
		} catch (e: any) {
			if (e?.name === 'AbortError') {
				// Cancelado intencionalmente para usar respuesta rápida
				return;
			}
			missionResult = { success: false, message: SYSTEM_ERROR_FALLBACK };
			if (missionType === 'dice_check') diceRollPhase = 'consequences';
		} finally {
			if (aiCountdownInterval) {
				clearInterval(aiCountdownInterval);
				aiCountdownInterval = null;
			}
			aiAbortController = null;
			resolvingMission = false;
		}
	}

	// Respuesta rápida: cancela la llamada a la IA y solicita inmediatamente el fallback offline
	async function handleQuickFallback() {
		if (!selectedMission || requestingQuickFallback) return;
		requestingQuickFallback = true;
		const currentMissionTitle = selectedMission.title;
		const currentMissionId = selectedMission.id;
		const currentAnswer = aiPromptText;
		const missionHasComm = !!selectedMission?.mechanic?.unlock_communication;

		if (aiAbortController) {
			aiAbortController.abort();
			aiAbortController = null;
		}
		if (aiCountdownInterval) {
			clearInterval(aiCountdownInterval);
			aiCountdownInterval = null;
		}

		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'resolve_mission',
					missionId: currentMissionId,
					answerText: currentAnswer,
					skipAi: true
				})
			});
			const resData = await res.json();
			if (resData.success) {
				if (resData.playerState) player = resData.playerState;
				if (resData.factions) factionsState = resData.factions;
				if (resData.eventPoints) eventPointsState = resData.eventPoints;
				if (resData.factions || resData.eventPoints) worldStateUpdatedAt = Date.now();
				giocchiModalData = {
					missionTitle: currentMissionTitle,
					userInput: currentAnswer,
					feedback: resData.feedback,
					xpAwarded: resData.xpAwarded || 25,
					hasUnlockedCommunication: missionHasComm
				};
				selectedMission = null;
				playSuccess();
			} else {
				missionResult = { success: false, message: resData.message || SYSTEM_ERROR_FALLBACK };
			}
		} catch (err) {
			missionResult = { success: false, message: SYSTEM_ERROR_FALLBACK };
		} finally {
			requestingQuickFallback = false;
			resolvingMission = false;
		}
	}

	// Reintento de un dice_check fallado con la Ficha de Reintento comprada en
	// la Bóveda (Fase 4.4) — no re-otorga XP/CP (ya se dieron en el primer
	// intento), solo puede recuperar el punto de facción/Inercia perdido.
	async function handleRetryDiceCheck() {
		if (!selectedMission || retryingMission) return;
		const previousItemCount = player?.game_status?.unlocked_items?.length || 0;
		retryingMission = true;
		playDiceRoll();
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'retry_dice_check', missionId: selectedMission.id })
			});
			const resData = await res.json();
			if (!res.ok) {
				retryResult = { success: false, message: resData.error || SYSTEM_ERROR_FALLBACK };
				diceRollPhase = 'consequences';
			} else {
				retryResult = resData;
				diceRollPreviousItemCount = previousItemCount;
				diceRollPhase = 'revealing';
			}
		} catch (e) {
			retryResult = { success: false, message: SYSTEM_ERROR_FALLBACK };
			diceRollPhase = 'consequences';
		} finally {
			retryingMission = false;
		}
	}

	function formatTime(secs: number) {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto(`/register?event=${data.event.slug}`);
	}

	let resetting = $state(false);

	// Toggle de sonido, visible en el HUD (2.x del informe UX: el mute no puede
	// quedar enterrado en un menú en un evento de 80-100 personas). Se aplica
	// de inmediato en el cliente y se persiste en `player.settings.sound` en
	// segundo plano — si la escritura falla, el toggle sigue funcionando en la
	// sesión actual, simplemente no sobrevive a un refresh.
	async function handleToggleSound() {
		const nextValue = !audioSettings.enabled;
		setSoundEnabled(nextValue);
		if (nextValue) playCodeValid(); // confirmación audible de que el sonido quedó activado
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'toggle_sound', enabled: nextValue })
			});
			const resData = await res.json();
			if (res.ok && resData.success && resData.playerState) player = resData.playerState;
		} catch (e) {
			// Silencioso a propósito: el toggle ya se aplicó localmente.
		}
	}

	// Herramienta exclusiva de desarrollo local — nunca debe llegar a un
	// jugador real. `dev` se resuelve en build time; en producción esta rama
	// completa (botón + atajo + llamada) queda fuera del bundle.
	async function handleResetPlayer() {
		if (!dev || resetting) return;
		const confirmed = window.confirm(
			'Esto borra TODO el progreso de este agente (rango, XP, Ludens, ítems, Hitos) y EL AVATAR, volviendo a la selección de facción. ¿Reiniciar por completo?'
		);
		if (!confirmed) return;
		resetting = true;
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'reset' })
			});
			const resData = await res.json();
			if (resData.success) {
				window.location.reload();
			}
		} catch (e) {
			console.error(e);
		} finally {
			resetting = false;
		}
	}

	async function handleSoftResetPlayer() {
		if (!dev || resetting) return;
		const confirmed = window.confirm(
			'F9 (Dev): ¿Reiniciar el progreso del jugador (misiones, códigos, XP a 0) CONSERVANDO tu Avatar y Facción?'
		);
		if (!confirmed) return;
		resetting = true;
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'soft_reset' })
			});
			const resData = await res.json();
			if (resData.success) {
				window.location.reload();
			}
		} catch (e) {
			console.error(e);
		} finally {
			resetting = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (dev) {
			if (e.key === 'F9') {
				e.preventDefault();
				handleSoftResetPlayer();
			} else if (e.key === 'F10') {
				e.preventDefault();
				handleResetPlayer();
			}
		}
	}
</script>

<!-- handleKeyDown ya comprueba `dev` internamente; svelte:window no puede ir dentro de un {#if} -->
<svelte:window onkeydown={handleKeyDown} />

<!-- IF PLAYER HAS NO AVATAR IN THIS EVENT -> 2-STEP SELECTION WIZARD -->
{#if !player}
	<div class="selection-overlay">
		<div class="selection-card">
			<div class="badge">PASO {onboardingStep} DE 2</div>
			<h2>{data.event.title}</h2>

			{#if onboardingStep === 1}
				<!-- PASO 1: ELECCIÓN DE FACCIÓN -->
				<p class="subtitle">Elige la facción a la que pertenecerá tu agente durante el evento.</p>
				<fieldset disabled={joining} class="selection-fieldset">
					<div class="step-section">
						<h3>Selecciona tu Facción</h3>
						<div class="grid-options">
							{#each data.factions as f}
								<button
									type="button"
									class="option-btn {selectedFactionId === f.id ? 'active' : ''}"
									onclick={() => (selectedFactionId = f.id)}
								>
									<img src={f.icon_url} alt={f.name} class="icon-thumb" />
									<div class="opt-text">
										<strong>{f.name}</strong>
										<span class="desc">{f.description}</span>
									</div>
								</button>
							{/each}
						</div>
					</div>

					<button
						type="button"
						class="primary-btn confirm-btn"
						onclick={() => (onboardingStep = 2)}
						disabled={!selectedFactionId}
					>
						<span>Siguiente: Elegir Avatar (Clase) ➔</span>
					</button>
				</fieldset>
			{:else if onboardingStep === 2}
				<!-- PASO 2: ELECCIÓN DE AVATAR (CLASE DE JUEGO) EN CARRUSEL -->
				<p class="subtitle">Selecciona la Clase de tu avatar y ajusta la versión visual.</p>
				<fieldset disabled={joining} class="selection-fieldset">
					<div class="carousel-container">
						<!-- NAV DEL CARRUSEL DE CLASES -->
						<div class="carousel-nav">
							<button
								type="button"
								class="nav-arrow"
								onclick={() =>
									(selectedAvatarIndex =
										(selectedAvatarIndex - 1 + data.avatarsCatalog.length) %
										data.avatarsCatalog.length)}
							>
								◄
							</button>
							<div class="carousel-title-group">
								<span class="class-label">CLASE {selectedAvatarIndex + 1} DE {data.avatarsCatalog.length}</span>
								<h4>{currentAvatarClass.name}</h4>
							</div>
							<button
								type="button"
								class="nav-arrow"
								onclick={() =>
									(selectedAvatarIndex = (selectedAvatarIndex + 1) % data.avatarsCatalog.length)}
							>
								►
							</button>
						</div>

						<!-- TARJETA DEL AVATAR / CLASE ACTIVA -->
						<div class="avatar-card">
							<div class="avatar-img-wrapper">
								<img
									src={selectedGender === 'female'
										? currentAvatarClass.image_url_f
										: currentAvatarClass.image_url_m}
									alt={currentAvatarClass.name}
									class="carousel-avatar-img"
								/>
							</div>

							<!-- BOTONES TOGGLE MASCULINO / FEMENINO -->
							<div class="gender-toggle">
								<button
									type="button"
									class="gender-btn {selectedGender === 'male' ? 'active' : ''}"
									onclick={() => (selectedGender = 'male')}
								>
									♂ Masculino
								</button>
								<button
									type="button"
									class="gender-btn {selectedGender === 'female' ? 'active' : ''}"
									onclick={() => (selectedGender = 'female')}
								>
									♀ Femenino
								</button>
							</div>

							<p class="class-desc">{currentAvatarClass.description}</p>

							<!-- BARRAS DE PROGRESO DE PUNTOS SP (RELATIVOS AL MÁXIMO DEL CATÁLOGO) -->
							<div class="sp-bars-container">
								<h5>PUNTOS DE HABILIDAD (SP)</h5>
								{#each Object.entries(currentAvatarClass.default_sp || {}) as [attrKey, attrVal]}
									<div class="sp-bar-row">
										<div class="sp-label">
											<SkillBadge skillKey={attrKey} value={Number(attrVal)} showValue={false} />
											<strong class="attr-val mono">{attrVal} / {maxSP[attrKey] || 20}</strong>
										</div>
										<div class="sp-track">
											<div
												class="sp-fill"
												style="width: {(Number(attrVal) / (maxSP[attrKey] || 1)) * 100}%"
											></div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>

					{#if joinError}
						<div class="code-feedback error">{joinError}</div>
					{/if}

					<div class="wizard-actions">
						<button type="button" class="secondary-btn" onclick={() => (onboardingStep = 1)}>
							⬅ Volver a Facciones
						</button>

						<button class="primary-btn confirm-btn" onclick={handleJoinEvent} disabled={joining}>
							{#if joining}
								<svg class="spinner" viewBox="0 0 24 24" fill="none">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								<span>Inicializando Agente e Ingresando...</span>
							{:else}
								<span>Confirmar e Ingresar al Evento ⚡</span>
							{/if}
						</button>
					</div>
				</fieldset>
			{/if}
		</div>
	</div>
{:else}
	<!-- MAIN GAME INTERFACE (MOBILE FIRST) -->
	<div class="app-shell">
		<!-- ONBOARDING NARRATIVO: 4 ACTOS (Gamescon, secciones 5 y 12.2 del diseño) -->
		{#if narrativeActIndex > 0}
			<div class="narrative-overlay">
				<div class="narrative-card">
					<div class="narrative-badge">ACTO {narrativeActIndex} DE 4 · {narrativeActLabel}</div>
					<div class="narrative-speaker">
						<img src="/images/gamescon/characters/char_huizinga.jpg" alt="Dra. Elena Huizinga" class="narrative-speaker-avatar" />
						<div class="narrative-speaker-info">
							<strong>Dra. Elena Huizinga</strong>
							<span>Directora de la Agencia Antropológica Huizinga</span>
						</div>
					</div>
					<button type="button" class="narrative-text-btn" onclick={completeTypewriter} aria-label="Completar texto de la transmisión">
						<span class="narrative-p">
							{displayedNarrativeText}
							{#if !isTypewriterComplete}
								<span class="typewriter-cursor"></span>
							{/if}
						</span>
					</button>
					<div class="narrative-actions">
						<button type="button" class="secondary-btn" onclick={skipNarrative}>
							Omitir informe e ir a la terminal
						</button>
						<button type="button" class="primary-btn" onclick={advanceNarrative}>
							{narrativeActIndex < 4 ? 'Siguiente ➜' : 'Acceder al HUD ⚡'}
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- MODAL DE FEEDBACK DE CÓDIGO & MISIÓN DESBLOQUEADA -->
		{#if codeRewardModal}
			<div class="code-reward-overlay">
				<div class="code-reward-card">
					<div class="code-reward-header">
						<span class="code-reward-badge">🎉 ¡CÓDIGO CANJEADO CON ÉXITO!</span>
						<div class="code-reward-code mono">CÓDIGO: {codeRewardModal.code}</div>
					</div>

					<p class="code-reward-msg">{codeRewardModal.message}</p>

					<!-- Recompensas Numéricas -->
					<div class="code-reward-stats mono">
						{#if codeRewardModal.xpReward > 0}
							<div class="stat-pill xp">+{codeRewardModal.xpReward} XP</div>
						{/if}
						{#if codeRewardModal.cpReward > 0}
							<div class="stat-pill cp">+{codeRewardModal.cpReward} <Gem size={13} /></div>
						{/if}
					</div>

					<!-- Si desbloqueó una o más misiones -->
					{#if codeRewardModal.newlyUnlockedMissions && codeRewardModal.newlyUnlockedMissions.length > 0}
						{@const firstMission = codeRewardModal.newlyUnlockedMissions[0]}
						<div class="unlocked-mission-preview">
							<div class="ump-header">
								<span class="ump-tag mono">NUEVA DIRECTIVA DESBLOQUEADA</span>
								<span class="ump-type-tag {firstMission.type || firstMission.mission_type || 'code'}">
									{(firstMission.type || firstMission.mission_type || 'MISIÓN').toUpperCase()}
								</span>
							</div>
							<h4 class="ump-title">{firstMission.title}</h4>
							<p class="ump-desc">{firstMission.description || firstMission.preview || 'Misión disponible en tu terminal.'}</p>
							
							<div class="ump-rewards mono">
								{#if firstMission.mechanic?.rewards?.xp || firstMission.rewards?.xp}
									<span>+{(firstMission.mechanic?.rewards?.xp || firstMission.rewards?.xp)} XP</span>
								{/if}
								{#if firstMission.mechanic?.rewards?.cp || firstMission.rewards?.cp}
									<span>+{(firstMission.mechanic?.rewards?.cp || firstMission.rewards?.cp)} <Gem size={12} /></span>
								{/if}
							</div>
						</div>
					{/if}

					<div class="code-reward-actions">
						{#if codeRewardModal.newlyUnlockedMissions && codeRewardModal.newlyUnlockedMissions.length > 0}
							{@const targetMission = codeRewardModal.newlyUnlockedMissions[0]}
							<button
								type="button"
								class="primary-btn to-mission-btn"
								onclick={() => {
									selectedMission = targetMission;
									activeTab = 'missions';
									codeRewardModal = null;
									if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
								}}
							>
								<span>Ir a Misión Desbloqueada ➔</span>
							</button>
						{/if}
						<button
							type="button"
							class="secondary-btn"
							onclick={() => (codeRewardModal = null)}
						>
							Permanecer en la Terminal
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- OVERLAY CEREMONIAL DE HITO PAGINADO (Narrativa Táctica & Tip de Gamificación) -->
		{#if milestoneOverlay && milestoneOverlay.length > 0}
			{@const currentMilestone = milestoneOverlay[0]}
			{@const pages = getMilestoneNarrativePages(currentMilestone)}
			{@const totalPages = pages.length}
			{@const safePageIndex = Math.min(milestonePageIndex, Math.max(0, totalPages - 1))}
			{@const currentPage = pages[safePageIndex] || pages[0]}
			{@const isLastPage = safePageIndex >= totalPages - 1}

			<div class="milestone-overlay">
				<div class="milestone-overlay-card">
					<div class="milestone-header">
						<div class="milestone-trophy"><Trophy size={36} strokeWidth={1.75} /></div>
						<div class="milestone-title-group">
							<div class="milestone-badge-row">
								<span class="milestone-badge">{currentMilestone.narrative?.badge || `HITO ${currentMilestone.count} ALCANZADO`}</span>
								{#if totalPages > 1}
									<span class="milestone-page-counter mono">Pág. {safePageIndex + 1} de {totalPages}</span>
								{/if}
							</div>
							<h2 class="milestone-rank">{currentMilestone.rankTitle}</h2>
						</div>
					</div>

					<!-- Indicador de Páginas / Dots -->
					{#if totalPages > 1}
						<div class="milestone-dots-indicator">
							{#each pages as _, pIdx}
								<button
									type="button"
									class="milestone-dot {safePageIndex === pIdx ? 'active' : ''}"
									onclick={() => (milestonePageIndex = pIdx)}
									aria-label="Ir a página {pIdx + 1}"
								></button>
							{/each}
						</div>
					{/if}

					{#if currentMilestone.narrative}
						<div class="milestone-speaker">
							{#if currentMilestone.narrative.portrait_url}
								<img src={currentMilestone.narrative.portrait_url} alt={currentMilestone.narrative.speaker_name} class="milestone-speaker-avatar" />
							{:else}
								<div class="milestone-speaker-avatar placeholder"><Radio size={20} /></div>
							{/if}
							<div class="milestone-speaker-info">
								<strong>{currentMilestone.narrative.speaker_name}</strong>
								<span>{currentMilestone.narrative.speaker_role || 'Agencia Antropológica Huizinga'}</span>
							</div>
						</div>
					{/if}

					<!-- Contenido de la Página Actual -->
					<div class="milestone-page-body">
						{#if currentPage?.tag}
							<div class="milestone-page-tag mono">{currentPage.tag}</div>
						{/if}
						<div class="milestone-narrative-content typewriter-reveal">
							{#if currentPage}
								{@html currentPage.content_html}
							{/if}
						</div>
					</div>

					<!-- Recompensas en la última página -->
					{#if isLastPage}
						<div class="milestone-rewards-box">
							<span class="milestone-rewards-title mono">RECOMPENSAS DESBLOQUEADAS</span>
							<div class="milestone-rewards mono">
								<span>+{currentMilestone.xp} XP</span>
								{#if currentMilestone.cp}<span>+{currentMilestone.cp} <Gem size={13} /></span>{/if}
								{#if currentMilestone.spBonus}<span>+{currentMilestone.spBonus} SP</span>{/if}
							</div>

							{#if currentMilestone.unlockItem}
								{@const unlockedItemObj = (data.items || []).find((it: any) => it.id === currentMilestone.unlockItem)}
								{#if unlockedItemObj}
									<div class="milestone-item-reveal">
										<span class="milestone-item-icon"><Sparkle size={20} /></span>
										<div>
											<span class="milestone-item-label">Objeto Desbloqueado</span>
											<strong class="milestone-item-name">{unlockedItemObj.name}</strong>
										</div>
									</div>
								{/if}
							{/if}
						</div>
					{/if}

					<!-- Botones de Navegación Paginada -->
					<div class="milestone-actions">
						{#if safePageIndex > 0}
							<button type="button" class="secondary-btn" onclick={() => (milestonePageIndex = safePageIndex - 1)}>
								◀ Anterior
							</button>
						{/if}
						{#if !isLastPage}
							<button type="button" class="primary-btn" onclick={() => (milestonePageIndex = safePageIndex + 1)}>
								Siguiente ➜
							</button>
						{:else}
							<button type="button" class="primary-btn milestone-finish-btn" onclick={() => (milestoneOverlay = null)}>
								Acceder al HUD ⚡
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- PANTALLA DE DETALLE DE GREMIO: se abre al tocar el nombre de una
		     facción (header o widget de Gremios). Color e imagen propios del
		     gremio, nómina traída bajo demanda vía openFactionDetail(). -->
		{#if factionDetailId}
			{@const factionDetail = factionsState.find((f: any) => f.id === factionDetailId)}
			{@const factionDetailIdx = factionsState.findIndex((f: any) => f.id === factionDetailId)}
			{@const factionDetailColor = factionDetailIdx >= 0 ? factionColor(factionDetailIdx) : '#818cf8'}
			<div
				class="modal-overlay"
				role="button"
				tabindex="0"
				onclick={() => (factionDetailId = null)}
				onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') factionDetailId = null; }}
			>
				<div
					class="modal-card faction-detail-card"
					role="dialog"
					aria-modal="true"
					tabindex="-1"
					style="border-color: {factionDetailColor}55"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
				>
					<div class="faction-detail-header">
						{#if factionDetail?.icon_url && !brokenImages['faction-' + factionDetailId]}
							<img
								src={factionDetail.icon_url}
								alt={factionDetail.name}
								class="faction-detail-img"
								style="border-color: {factionDetailColor}"
								onerror={() => markImageBroken('faction-' + factionDetailId)}
							/>
						{:else}
							<div class="faction-detail-img img-placeholder" style="border-color: {factionDetailColor}; color: {factionDetailColor}">
								<Users size={28} />
							</div>
						{/if}
						<div class="faction-detail-titles">
							<h3 style="color: {factionDetailColor}">{factionDetail?.name || 'Gremio'}</h3>
							<span class="faction-detail-pts mono">{(factionDetail?.faction_points ?? 1000).toLocaleString()} pt</span>
						</div>
					</div>

					{#if factionDetail?.description}
						<p>{factionDetail.description}</p>
					{/if}

					<div class="faction-detail-list-title">Miembros por XP</div>
					{#if loadingFactionMembers}
						<p class="hint">Cargando nómina del gremio...</p>
					{:else if factionMembersError}
						<p class="hint faction-detail-error">{factionMembersError}</p>
					{:else if factionMembers && factionMembers.length > 0}
						<div class="faction-member-list">
							{#each factionMembers as m, i}
								<div class="faction-member-row">
									<span class="fm-rank mono">{i + 1}</span>
									{#if m.image_url}
										<img src={m.image_url} alt={m.name} class="fm-avatar" />
									{:else}
										<div class="fm-avatar img-placeholder"><CircleUserRound size={16} /></div>
									{/if}
									<span class="fm-name">{m.name}</span>
									<span class="fm-xp mono">NIVEL {m.level} · {m.xp} XP</span>
								</div>
							{/each}
						</div>
					{:else}
						<p class="hint">Todavía no hay agentes registrados en este gremio.</p>
					{/if}

					<button type="button" class="secondary-btn modal-close" onclick={() => (factionDetailId = null)}>Cerrar</button>
				</div>
			</div>
		{/if}

		<!-- BÓVEDA DE INTELIGENCIA (Fase 4.4): un solo overlay, 3 puntos de
		     entrada (badge de CP, Inventario, Perfil) -->
		<VaultModal
			open={vaultOpen}
			rewards={data.rewards || []}
			{player}
			onClose={() => (vaultOpen = false)}
			onPurchase={handlePurchaseReward}
			onActivateBoost={handleActivateSpBoost}
		/>

		<!-- JUEGO DE CONTACTOS: modal de activación/edición del perfil -->
		{#if contactModalOpen}
			<div
				class="modal-overlay"
				role="button"
				tabindex="0"
				onclick={() => (contactModalOpen = false)}
				onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') contactModalOpen = false; }}
			>
				<div
					class="modal-card"
					role="dialog"
					aria-modal="true"
					tabindex="-1"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
				>
					<h3>{player.avatar?.contact_profile ? 'Editar Perfil de Contacto' : 'Activar Código Personal'}</h3>
					<p class="hint">
						Recibirás un código personal con prefijo <strong>@</strong> para intercambiar con otros agentes desde el campo de canje de código — ganan XP y puntos de facción ambos.
						<button type="button" class="link-btn" onclick={() => (contactHelpOpen = !contactHelpOpen)}>[?]</button>
					</p>
					{#if contactHelpOpen}
						<p class="hint">Todos los campos son opcionales. Tu código nunca cambia una vez activado, aunque edites estos datos después.</p>
					{/if}
					<form onsubmit={(e) => { e.preventDefault(); handleActivateContactProfile(); }} class="modal-form">
						<input type="text" bind:value={contactCompany} placeholder="Empresa" class="code-input" disabled={savingContact} />
						<input type="text" bind:value={contactPhone} placeholder="Celular" class="code-input" disabled={savingContact} />
						<input type="text" bind:value={contactLinkedin} placeholder="LinkedIn (URL)" class="code-input" disabled={savingContact} />
						<textarea bind:value={contactBio} placeholder="Bio corta" class="code-input contact-bio-input" disabled={savingContact} rows="3"></textarea>
						<button type="submit" class="primary-btn" disabled={savingContact}>
							{#if savingContact}Guardando...{:else}{player.avatar?.contact_profile ? 'Guardar cambios' : 'Activar código'}{/if}
						</button>
					</form>
					{#if contactModalMessage}
						<div class="code-feedback {contactModalMessage.type}">{contactModalMessage.text}</div>
					{/if}
					<button type="button" class="secondary-btn modal-close" onclick={() => (contactModalOpen = false)}>Cerrar</button>
				</div>
			</div>
		{/if}

		<!-- JUEGO DE CONTACTOS: notificación en vivo de "te escanearon" -->
		{#if contactScannedNotification}
			<div
				class="modal-overlay"
				role="button"
				tabindex="0"
				onclick={() => (contactScannedNotification = null)}
				onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') contactScannedNotification = null; }}
			>
				<div
					class="modal-card"
					role="dialog"
					aria-modal="true"
					tabindex="-1"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
				>
					<span class="m-badge collective_vote">CONTACTO AGREGADO</span>
					<h3>{contactScannedNotification.scannerName} escaneó tu código</h3>
					<p>+{contactScannedNotification.xp} XP, +3 pts de Facción para ambos.</p>
					<button type="button" class="secondary-btn modal-close" onclick={() => (contactScannedNotification = null)}>Cerrar</button>
				</div>
			</div>
		{/if}

		<!-- MODAL DE BIENVENIDA: OPERADOR CIPHER (sección 7.3 del diseño) -->
		{#if showCipherWelcomeModal}
			<div
				class="modal-overlay"
				role="button"
				tabindex="0"
				onclick={closeCipherModal}
				onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') closeCipherModal(); }}
			>
				<div
					class="modal-card"
					role="dialog"
					aria-modal="true"
					tabindex="-1"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
				>
					<div class="cipher-modal-header">
						<img src="/images/gamescon/characters/char_cipher.jpg" alt="Operador Cipher" class="cipher-modal-avatar" />
						<div class="cipher-modal-meta">
							<span class="m-badge cipher"><Radio size={12} /> TRANSMISIÓN DIRECTA</span>
							<h3>Operador Cipher</h3>
							<span class="cipher-modal-role">Soporte Táctico y Telecomunicaciones</span>
						</div>
					</div>
					<p>¡Enlace establecido, colega! Soy Cipher, tu soporte táctico durante el congreso. La Dra. Huizinga ya te dio el panorama general, pero aquí en el terreno vamos paso a paso.</p>
					<p>Para inicializar tu terminal, habilitar el sistema de seguridad y desbloquear tus herramientas de campo, necesitamos confirmar que tu conexión no está intervenida por el Sindicato.</p>
					<p>Introduce la clave de acceso <strong>LUDENS</strong> en el Panel de Códigos de tu HUD.</p>
					<button type="button" class="primary-btn modal-close" onclick={closeCipherModal}>Entendido</button>
				</div>
			</div>
		{/if}

		<!-- ALERT OVERLAY -->
		{#if activeAlert && activeAlert.secondsLeft > 0}
			<div class="alert-banner {activeAlert.type}">
				<div class="alert-content">
					<span class="alert-icon"><Zap size={18} /></span>
					<span class="alert-msg">{activeAlert.message}</span>
				</div>
				<div class="alert-timer">
					<div class="alert-bar" style="width: {(activeAlert.secondsLeft / 30) * 100}%"></div>
				</div>
			</div>
		{/if}

		<!-- TOP HEADER / STATUS BAR -->
		<header class="top-bar">
			<div class="player-summary">
				{#if player.avatar.image_url && !brokenImages['avatar-header']}
					<img
						src={player.avatar.image_url}
						alt={player.avatar.name}
						class="avatar-img"
						style="border-color: {ownFactionColor}"
						onerror={() => markImageBroken('avatar-header')}
					/>
				{:else}
					<div class="avatar-img img-placeholder" style="border-color: {ownFactionColor}; color: {ownFactionColor}">
						<CircleUserRound size={26} />
					</div>
				{/if}
				<div class="player-info">
					<div class="agent-name">{player.avatar.name}</div>
					<div class="row-title">
						<span class="rank-tag" style="background: {ownFactionColor}33; color: {ownFactionColor}">{player.avatar.rank_title || 'Recluta de la Red'}</span>
					</div>
					<div class="xp-bar-container">
						<div class="xp-bar" style="width: {xpProgressPercent}%"></div>
					</div>
					<div class="xp-label mono">
						<span>NIVEL {player.avatar.xp.level}</span>
						<span>{player.avatar.xp.points} XP</span>
					</div>
				</div>
			</div>
			<div class="top-bar-right">
				<button type="button" class="cp-badge" onclick={openVault} aria-label="Abrir la Bóveda de Inteligencia" title="Bóveda de Inteligencia">
					<Gem size={16} />
					<span class="cp-val mono">{player.avatar.cp.points}</span>
				</button>
				<button
					type="button"
					class="sound-toggle {audioSettings.enabled ? 'active' : 'muted'}"
					onclick={handleToggleSound}
					aria-label={audioSettings.enabled ? 'Silenciar sonido' : 'Activar sonido'}
					title={audioSettings.enabled ? 'Silenciar sonido' : 'Activar sonido'}
				>
					{#if audioSettings.enabled}
						<Volume2 size={16} />
					{:else}
						<VolumeX size={16} />
					{/if}
				</button>
			</div>
		</header>

		<!-- WORLD EVENT & FACTION POINTS WIDGET -->
		<section class="world-widget">
			<div class="point-card event-pts">
				<div class="pt-header">
					<span>{worldPoints.display_name}</span>
					<strong class="mono">{worldPoints.current_points} / {worldPoints.max_points}</strong>
				</div>
				<div class="progress-bg">
					<div
						class="progress-fill danger"
						style="width: {Math.min(100, (worldPoints.current_points / (worldPoints.max_points || 1)) * 100)}%"
					></div>
				</div>
			</div>

			<FactionLeaderboardWidget
				factions={factionsState}
				ownFactionId={player?.avatar?.faction_id}
				refreshing={refreshingWorldState}
				onRefresh={refreshWorldState}
				onFactionClick={openFactionDetail}
			/>

			{#if worldPulseText}
				<div class="pulse-row" title="Estos números vienen de tu última acción, no de una recarga de página">
					<span class="pulse-dot"></span>
					<span class="mono">{worldPulseText}</span>
				</div>
			{/if}
		</section>

		<!-- TAB CONTENT CONTAINER -->
		<main class="main-content">
			{#if activeTab === 'hud'}
				<!-- HUD HOME TAB -->
				<div class="tab-pane">
					<div class="milestone-card {milestoneImminent ? 'imminent' : ''}">
						{#if milestoneImminent}
							<div class="milestone-imminent-badge"><Zap size={13} /> A UNA MISIÓN DEL PRÓXIMO HITO</div>
						{/if}
						<div class="pt-header">
							<span>{player.avatar.rank_title || 'Recluta de la Red'}</span>
							<strong>{completedMissionsCount} misiones completadas</strong>
						</div>
						<div class="progress-bg">
							<div class="progress-fill milestone" style="width: {milestoneProgressPct}%"></div>
						</div>
						<small class="hint">
							{#if nextMilestone}
								Próximo Hito en {nextMilestone - completedMissionsCount} misión(es) más — Rango {nextMilestoneObj?.rankTitle || 'Siguiente Nivel'}.
							{:else}
								Rango máximo alcanzado: {eventMilestones[eventMilestones.length - 1]?.rankTitle || 'Agente Master Huizinga'}.
							{/if}
						</small>
					</div>

					<div class="quick-code-card">
						<h3>Canje Rápido de Código</h3>
						<p class="hint">Ingresa un código hallado en el mapa o stand para desbloquear misiones o ítems.</p>
						<form onsubmit={(e) => { e.preventDefault(); handleCodeSubmit(); }} class="code-form">
							<input
								type="text"
								bind:value={codeInput}
								placeholder="Ej. K7X2"
								class="code-input"
								disabled={submittingCode}
							/>
							<button type="submit" class="code-btn" disabled={submittingCode}>
								{#if submittingCode}
									<svg class="spinner" viewBox="0 0 24 24" fill="none">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								{:else}
									Canjear
								{/if}
							</button>
						</form>
						{#if codeMessage}
							<div class="code-feedback {codeMessage.type}">{codeMessage.text}</div>
						{/if}
					</div>

					<!-- Juego de Contactos (sección 2.18): tarjeta de activación o de
					     código propio, atajo a Perfil → Contactos. -->
					{#if !player.avatar?.contact_profile}
						<button type="button" class="contact-card contact-card-inactive" onclick={openContactModal}>
							<Users size={18} />
							<span>Activa tu código personal para intercambiar contacto con otros agentes</span>
						</button>
					{:else}
						<button
							type="button"
							class="contact-card"
							onclick={() => { activeTab = 'profile'; }}
						>
							<Users size={18} />
							<span>Tu código: <strong class="mono">{player.avatar.contact_profile.personal_code}</strong></span>
						</button>
					{/if}

					{#if mainLogoUrl}
						<div class="hud-main-logo-container">
							<img src={mainLogoUrl} alt="Logo de {data.event.title}" class="hud-main-logo" />
						</div>
					{/if}

					{#if featuredMission}
						<div class="section-title">Misión Destacada</div>
						<button
							type="button"
							class="mission-card featured"
							onclick={() => {
								if (featuredMission.completed && featuredMission.type === 'ai_prompt_challenge') {
									const aiData = getCompletedAiMissionData(featuredMission);
									if (aiData) {
										giocchiModalData = {
											missionTitle: featuredMission.title,
											userInput: aiData.userInput,
											feedback: aiData.feedback,
											xpAwarded: aiData.xpAwarded
										};
										playModalOpen();
										return;
									}
								}
								activeTab = 'missions';
								selectedMission = featuredMission;
								playModalOpen();
							}}
						>
							<img
								src={featuredMission.image || 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&auto=format&fit=crop&q=80'}
								alt={featuredMission.title}
								class="m-thumb"
							/>
							<div class="m-info">
								<span class="m-badge">{featuredMission.type.toUpperCase()}</span>
								<h4>{featuredMission.title}</h4>
								<p>{featuredMission.preview}</p>
								<div class="m-rewards">
									<span>+{featuredMission.xp} XP</span>
									<span>+{featuredMission.cp} CP</span>
								</div>
							</div>
						</button>
					{:else}
						<div class="section-title">Misión Destacada</div>
						<div class="no-mission-card">
							<span class="no-mission-icon"><Radio size={26} /></span>
							<p>Sin transmisiones activas. Localiza a un Operador de campo o una terminal física para recibir tu próximo código, Agente.</p>
						</div>
					{/if}

					<div class="section-title">Canal de Comunicaciones</div>
					{#if activeCommunications.length === 0}
						<div class="no-mission-card">
							<span class="no-mission-icon"><Radio size={24} /></span>
							<p>Sin transmisiones disponibles por el momento.</p>
						</div>
					{:else}
						<div class="comms-list">
							{#each activeCommunications as comm (comm.id)}
								<div class="dialogue-box comm-card-{comm.badge_type || 'tactical'}">
									{#if comm.portrait_url && !brokenImages[comm.id]}
										<img
											src={comm.portrait_url}
											alt={comm.speaker_name}
											class="gm-avatar"
											onerror={() => markImageBroken(comm.id)}
										/>
									{:else}
										<div class="gm-avatar img-placeholder {comm.badge_type === 'story' ? 'story-avatar' : 'cipher-avatar'}">
											<Radio size={20} />
										</div>
									{/if}
									<div class="dialogue-text">
										<div class="comm-header">
											<strong>{comm.speaker_name}</strong>
											{#if comm.badge}
												<span class="comm-badge {comm.badge_type || 'tactical'}">{comm.badge}</span>
											{/if}
										</div>
										<p>{comm.text}</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if activeTab === 'missions'}
				<!-- MISSIONS TAB -->
				<div class="tab-pane">
					<h2 class="pane-title">Registro de Misiones</h2>
					<div class="missions-list">
						{#each missions as m}
							<button
								type="button"
								class="mission-card {m.unlocked ? '' : 'locked'} {m.completed ? 'completed' : ''}"
								onclick={() => {
									if (m.unlocked) {
										if (m.completed && m.type === 'ai_prompt_challenge') {
											const aiData = getCompletedAiMissionData(m);
											if (aiData) {
												giocchiModalData = {
													missionTitle: m.title,
													userInput: aiData.userInput,
													feedback: aiData.feedback,
													xpAwarded: aiData.xpAwarded
												};
												playModalOpen();
												return;
											}
										}
										selectedMission = m;
										playModalOpen();
									}
								}}
								disabled={!m.unlocked}
							>
								<div class="m-header">
									<span class="m-badge {m.type}">{m.type.toUpperCase()}</span>
									{#if m.completed}
										<span class="status-tag done">COMPLETADA <Check size={12} /></span>
									{:else if !m.unlocked}
										<span class="status-tag lock">BLOQUEADA <Lock size={12} /></span>
									{/if}
								</div>
								<h4>{m.title}</h4>
								<p class="m-preview">{m.preview}</p>

								{#if m.type === 'time_bomb' && m.unlocked && !m.completed}
									{#if m.expired}
										<div class="timer-box expired">
											<span>TIEMPO AGOTADO</span>
										</div>
									{:else if m.remainingSeconds !== null}
										<div class="timer-box">
											<span>TIEMPO RESTANTE:</span>
											<strong class="timer-val">{formatTime(m.remainingSeconds)}</strong>
										</div>
									{/if}
								{/if}

								<div class="m-rewards">
									<span>+{m.xp} XP</span>
									<span>+{m.cp} CP</span>
								</div>
							</button>
						{/each}
					</div>
				</div>
			{:else if activeTab === 'map'}
				<!-- MAP TAB -->
				<div class="tab-pane">
					<h2 class="pane-title">{currentMap.name}</h2>
					<div class="map-wrapper">
						{#if currentMap.image_url && !brokenImages['map-img']}
							<img
								src={currentMap.image_url}
								alt={currentMap.name}
								class="map-img"
								onerror={() => markImageBroken('map-img')}
							/>
						{:else}
							<div class="map-img img-placeholder map-img-placeholder">
								<span><MapIcon size={34} /></span>
								<p>Mapa del recinto pendiente de cargar — vuelve a intentarlo más tarde, Agente.</p>
							</div>
						{/if}

						{#each currentMap.hotspots || [] as hs}
							<button
								type="button"
								class="hotspot-pin"
								style="left: {hs.x}%; top: {hs.y}%;"
								onclick={() => (selectedHotspot = {
									title: hs.title,
									desc: hs.description,
									code: hs.code || (hs.unlocks_mission === 'm_time_bomb_01' ? 'DISABLE_99' : 'DEMO2026')
								})}
							>
								<MapPin size={13} /> {hs.title}
							</button>
						{/each}
					</div>

					{#if selectedHotspot}
						<div class="hotspot-modal">
							<h3>{selectedHotspot.title}</h3>
							<p>{selectedHotspot.desc}</p>
							<button class="primary-btn" onclick={() => handleCodeSubmit(selectedHotspot.code)} disabled={submittingCode}>
								{#if submittingCode}
									<svg class="spinner" viewBox="0 0 24 24" fill="none">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									<span>Verificando...</span>
								{:else}
									<span>Probar Código ({selectedHotspot.code})</span>
								{/if}
							</button>
							<button class="secondary-btn" onclick={() => (selectedHotspot = null)}>Cerrar</button>
						</div>
					{/if}
				</div>
			{:else if activeTab === 'feed'}
				<!-- FEED & MIS VOTACIONES TAB CONTAINER -->
				<div class="tab-pane">
					<!-- SELECTOR DE SUB-PESTAÑAS (SEGMENTED CONTROL) -->
					<div class="subtabs-bar">
						<button
							type="button"
							class="subtab-btn {feedSubTab === 'feed' ? 'active' : ''}"
							onclick={() => (feedSubTab = 'feed')}
						>
							<span class="subtab-icon"><Radio size={16} /></span>
							<span class="subtab-text">Feed</span>
						</button>
						<button
							type="button"
							class="subtab-btn {feedSubTab === 'votes' ? 'active' : ''}"
							onclick={() => {
								feedSubTab = 'votes';
								refreshVotingStats();
							}}
						>
							<span class="subtab-icon"><Vote size={16} /></span>
							<span class="subtab-text">Votaciones</span>
							{#if participatedVotes.length > 0}
								<span class="subtab-counter">{participatedVotes.length}</span>
							{/if}
						</button>
						<button
							type="button"
							class="subtab-btn {feedSubTab === 'premium' ? 'active' : ''}"
							onclick={() => (feedSubTab = 'premium')}
						>
							<span class="subtab-icon"><Sparkle size={16} /></span>
							<span class="subtab-text">Premium</span>
						</button>
					</div>

					{#if feedSubTab === 'feed'}
						<!-- PESTAÑA 1: FEED DE ACTIVIDAD COMUNITARIA. Antes tenía tres
						     entradas de actividad inventadas (@AlexVance, Colectivo Hacker)
						     que se mostraban siempre, sin importar el evento — hallazgo 3.10
						     del informe UX. Ahora lee `eventgage_event_activity_feed` real
						     (carga inicial) y se actualiza en vivo con el mismo canal de
						     Realtime Broadcast que ya alimenta el resto del juego. -->
						<div class="feed-section">
							<h3 class="subpane-title">Transmisiones del Game Master & Alertas</h3>
							{#if alertsState.length > 0}
								<div class="alerts-feed-list">
									{#each alertsState as alertItem}
										<div class="alert-feed-card {alertItem.type || 'info'}">
											<div class="afc-header">
												<div class="afc-speaker">
													{#if alertItem.portrait_url}
														<img src={alertItem.portrait_url} alt={alertItem.speaker_name} class="afc-avatar" />
													{:else}
														<span class="afc-avatar placeholder"><Radio size={14} /></span>
													{/if}
													<strong>{alertItem.speaker_name || 'Game Master'}</strong>
												</div>
												<span class="afc-badge {alertItem.type || 'info'}">
													{(alertItem.type || 'info').toUpperCase()}
												</span>
											</div>
											{#if alertItem.title}
												<h4 class="afc-title">{alertItem.title}</h4>
											{/if}
											<p class="afc-msg">{alertItem.message}</p>
											{#if alertItem.scheduled_at}
												<span class="afc-time">{new Date(alertItem.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<div class="feed-empty">
									<span class="feed-empty-icon"><Radio size={26} /></span>
									<p>Sin transmisiones oficiales del Game Master por el momento.</p>
								</div>
							{/if}

							<h3 class="subpane-title" style="margin-top: 1.5rem;">Actividad de la Red</h3>
							{#if activityFeed.length > 0}
								<div class="feed-list">
									{#each activityFeed as entry}
										<div class="feed-entry">
											<span class="feed-entry-icon"><Radio size={16} /></span>
											<p>{describeActivity(entry)}</p>
										</div>
									{/each}
								</div>
							{:else}
								<div class="feed-empty">
									<span class="feed-empty-icon"><Zap size={26} /></span>
									<p>Sin actividad reciente en la red.</p>
								</div>
							{/if}
						</div>
					{:else if feedSubTab === 'votes'}
						<!-- PESTAÑA 2: VOTACIONES EN LAS QUE HA PARTICIPADO CON CARDS EXPANDIBLES -->
						<div class="votes-section">
							<div class="votes-intro">
								<h3 class="subpane-title">Mis Votaciones Registradas</h3>
								<p class="votes-subtitle">Haz click sobre cada tarjeta para desplegar el escrutinio y los porcentajes en tiempo real.</p>
							</div>

							{#if participatedVotes.length > 0}
								<div class="voted-cards-list">
									{#each participatedVotes as vItem}
										<div class="vote-result-card {expandedVoteIds[vItem.mission.id] ? 'expanded' : ''}">
											<!-- ENCABEZADO CLICABLE / ACCORDION TRIGGER -->
											<button
												type="button"
												class="vote-card-header"
												onclick={() => {
													const nextState = !expandedVoteIds[vItem.mission.id];
													expandedVoteIds[vItem.mission.id] = nextState;
													if (nextState) refreshVotingStats();
												}}
											>
												<div class="v-header-top">
													<span class="m-badge collective_vote">VOTACIÓN TÁCTICA</span>
													<span class="status-tag done">PARTICIPASTE <Check size={12} /></span>
												</div>
												<div class="v-header-main">
													<h4 class="v-title">{vItem.mission.title}</h4>
													<div class="v-user-choice">
														<span class="choice-label">Tu elección:</span>
														<strong class="choice-val">{vItem.votedOptionText}</strong>
													</div>
												</div>
												<div class="v-expand-toggle">
													<span class="toggle-text">{expandedVoteIds[vItem.mission.id] ? 'Ocultar escrutinio' : 'Ver resultados y porcentajes'}</span>
													<span class="toggle-icon">{expandedVoteIds[vItem.mission.id] ? '▲' : '▼'}</span>
												</div>
											</button>

											<!-- CUERPO EXPANDIDO CON BARRAS DE PORCENTAJE Y RESULTADOS -->
											{#if expandedVoteIds[vItem.mission.id]}
												<div class="vote-results-body">
													<div class="vote-question-box">
														<span class="q-label">Pregunta:</span>
														<p class="q-text">{vItem.stats.question || vItem.mission.preview || 'Decisión de facción en curso'}</p>
													</div>

													<div class="options-breakdown">
														{#each vItem.stats.options as opt}
															<div class="option-stat-box {opt.id === vItem.votedOptionId ? 'user-selected' : ''}">
																<div class="opt-stat-header">
																	<div class="opt-name-wrapper">
																		<span class="opt-name">{opt.text}</span>
																		{#if opt.id === vItem.votedOptionId}
																			<span class="user-vote-pill">TU ELECCIÓN <Check size={11} /></span>
																		{/if}
																	</div>
																	<div class="opt-numbers">
																		<strong class="opt-pct">{opt.percentage}%</strong>
																		<span class="opt-cnt">({opt.count} votos)</span>
																	</div>
																</div>
																<div class="opt-bar-track">
																	<div
																		class="opt-bar-fill {opt.id === vItem.votedOptionId ? 'highlight' : ''}"
																		style="width: {opt.percentage}%"
																	></div>
																</div>
															</div>
														{/each}
													</div>

													<div class="vote-meta-footer">
														<span class="meta-total"><Users size={13} /> <strong>{vItem.stats.totalVotes}</strong> votos computados hasta ahora</span>
														<span class="meta-status"><Zap size={12} /> Conteo en vivo</span>
													</div>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-votes-card">
									<span class="empty-icon"><Vote size={26} /></span>
									<h4>Aún no has participado en ninguna votación</h4>
									<p>
										Las votaciones colectivas permiten a tu agente coordinar el avance de la facción e influir en el destino del evento.
									</p>
									<button
										type="button"
										class="primary-btn to-missions-btn"
										onclick={() => (activeTab = 'missions')}
									>
										<span>Explorar Misiones de Votación ➔</span>
									</button>
								</div>
							{/if}
						</div>
					{:else if feedSubTab === 'premium'}
						<!-- PESTAÑA 3: PREMIUM (SPONSORS & ORGANIZADORES) -->
						<div class="premium-section">
							<div class="premium-card">
								<div class="premium-header">
									<div class="premium-badge-group">
										<span class="premium-badge">MÓDULO PREMIUM</span>
										<span class="premium-badge-tag mono">EN DESARROLLO</span>
									</div>
									<span class="premium-sparkle-icon"><Sparkle size={24} /></span>
								</div>

								<h3 class="premium-title">Directorio de Sponsors y Organizadores</h3>
								
								<p class="premium-main-msg">
									Acá aparecerán los contactos de los sponsors y organizadores. Por implementar.
								</p>

								<div class="premium-info-box">
									<h4>📋 Especificación Técnica Pendiente:</h4>
									<p>
										Este módulo permitirá a los participantes explorar las marcas aliadas, stands corporativos, contactos comerciales (LinkedIn, teléfono, web oficial) y beneficios exclusivos del evento.
									</p>
									<ul class="premium-specs-list mono">
										<li>• Tabla destino: <code>bem.eventgage_event_vendors</code></li>
										<li>• Campos: <code>logo, name, contact_name, linkedin, phone, description, website_url</code></li>
										<li>• Gestión: Panel administrativo de Game Masters (<code>/[slug]/game-masters</code>)</li>
									</ul>
								</div>
							</div>
						</div>
					{/if}
				</div>
			{:else if activeTab === 'profile'}
				<!-- PROFILE & JOURNAL TAB -->
				<div class="tab-pane">
					<h2 class="pane-title">Expediente del Agente</h2>
					
					<div class="profile-card">
						{#if player.avatar.image_url && !brokenImages['avatar-profile']}
							<img
								src={player.avatar.image_url}
								alt="Profile"
								class="p-avatar"
								style="border-color: {ownFactionColor}"
								onerror={() => markImageBroken('avatar-profile')}
							/>
						{:else}
							<div class="p-avatar img-placeholder" style="border-color: {ownFactionColor}; color: {ownFactionColor}">
							<CircleUserRound size={40} />
						</div>
						{/if}
						<h3>{player.avatar.name}</h3>
						<p class="p-fac">
							{player.avatar.class_name || 'Clase Agente'} •
							<strong style="color: {ownFactionColor}">{factionsState.find((f: any) => f.id === player.avatar.faction_id)?.name || player.avatar.faction_id}</strong>
						</p>

						<div class="profile-level-badge">
							<span class="p-lvl-tag mono" style="background: {ownFactionColor}22; border-color: {ownFactionColor}66; color: {ownFactionColor}">NIVEL {player.avatar.xp?.level || currentLevelInfo.current?.level || 1}</span>
							<span class="p-lvl-title">{currentLevelTitle}</span>
							<span class="p-lvl-xp mono">{player.avatar.xp?.points ?? 0} XP</span>
						</div>

						<div class="sp-bars-container profile-sp">
							<h5>PUNTOS DE HABILIDAD (SP)</h5>
							{#each Object.entries(player.avatar.sp || {}) as [attrKey, attrVal]}
								<div class="sp-bar-row">
									<div class="sp-label">
										<SkillBadge skillKey={attrKey} value={Number(attrVal)} showValue={false} />
										<strong class="attr-val mono">{attrVal} / {PLAYER_SP_CAP}</strong>
									</div>
									<div class="sp-track">
										<div
											class="sp-fill"
											style="width: {Math.min(100, (Number(attrVal) / PLAYER_SP_CAP) * 100)}%"
										></div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="section-title">Journal (Bitácora de Lore)</div>
					<div class="journal-list">
						{#if player.game_status?.journal && player.game_status.journal.length > 0}
							{#each player.game_status.journal as j}
								<div class="journal-card">
									<h4>{j.title}</h4>
									<div class="j-html">{@html j.content_html}</div>
								</div>
							{/each}
						{:else}
							<p class="empty-msg">No has desbloqueado entradas en la bitácora aún. Resuelve misiones para ganar lore.</p>
						{/if}
					</div>

					<div class="section-title vault-section-title">Bóveda de Inteligencia</div>
					{#if player.game_status?.vip_token}
						<div class="profile-vip-token">
							<span class="vip-token-label">Token de Consulta VIP</span>
							<strong class="vip-token-val mono">{player.game_status.vip_token}</strong>
						</div>
					{/if}
					<button type="button" class="primary-btn to-vault-btn" onclick={openVault}><Gem size={14} /> Abrir la Bóveda</button>

					<div class="section-title vault-section-title">Contactos</div>
					{#if player.avatar?.contact_profile}
						<div class="profile-vip-token">
							<span class="vip-token-label">Tu Código Personal</span>
							<strong class="vip-token-val mono">{player.avatar.contact_profile.personal_code}</strong>
						</div>
						<button type="button" class="primary-btn to-vault-btn" onclick={openContactModal}><Users size={14} /> Editar perfil de contacto</button>
					{:else}
						<p class="hint">Activá tu código personal para intercambiar contacto con otros agentes.</p>
						<button type="button" class="primary-btn to-vault-btn" onclick={openContactModal}><Users size={14} /> Activar código personal</button>
					{/if}

					<!-- La lista de contactos guardados NO depende de tener el propio
					     código activado: se puede escanear el código de otro agente
					     (mismo campo de canje del HUD) sin haber activado el propio. -->
					{#if (player.game_status?.saved_contacts || []).length > 0}
						<div class="contacts-list">
							{#each player.game_status.saved_contacts as contact}
								<div class="contact-row">
									<div class="contact-row-info">
										<strong>{contact.name}</strong>
										<span class="hint">{factionsState.find((f: any) => f.id === contact.faction_id)?.name || contact.faction_id}{contact.company ? ` · ${contact.company}` : ''}</span>
										{#if contact.linkedin}<a href={contact.linkedin} target="_blank" rel="noopener noreferrer" class="contact-linkedin">LinkedIn</a>{/if}
										{#if contact.bio}<p class="hint contact-bio">{contact.bio}</p>{/if}
									</div>
									<button type="button" class="secondary-btn contact-vcf-btn" onclick={() => downloadContactVcf(contact)}>Agregar al celular</button>
								</div>
							{/each}
						</div>
					{:else}
						<p class="hint">Todavía no agregaste ningún contacto. Pedile a otro agente que escanee tu código, o escaneá el suyo desde el campo de canje de código.</p>
					{/if}

					{#if dev}
						<button class="logout-btn reset-btn" onclick={handleResetPlayer} disabled={resetting}>
							{#if resetting}
								<span>Reiniciando Agente...</span>
							{:else}
								<span><RefreshCw size={14} /> Reiniciar Agente y Progreso — SOLO DEV</span>
							{/if}
						</button>
					{/if}

					<button class="logout-btn" onclick={handleLogout}>Cerrar Sesión</button>
				</div>
			{:else if activeTab === 'items'}
				<!-- ITEMS & INVENTORY TAB -->
				<div class="tab-pane">
					<h2 class="pane-title">Inventario de Objetos</h2>
					<p class="hint" style="margin-top: -0.5rem; margin-bottom: 1.25rem;">Colecciona objetos secretos, pistas multimedia y registros de audio durante el evento.</p>

					{#if items.length === 0}
						<div class="empty-votes-card">
							<span class="empty-icon"><Backpack size={36} /></span>
							<h4>Inventario vacío</h4>
							<p>Aún no has descubierto ningún objeto. Resuelve misiones o canjea códigos para obtener pistas y artefactos.</p>
							<button type="button" class="primary-btn to-missions-btn" onclick={() => (activeTab = 'missions')}>Ver Misiones Disponibles</button>
						</div>
					{:else}
						<div class="items-list">
							{#each items as item}
								{@const parsed = parseItemDescription(item.description)}
								<div class="item-card {item.media_type}">
									<!-- SI ES IMAGEN: IMAGEN 100% WIDTH ARRIBA -->
									{#if item.media_type === 'image'}
										<div class="item-cover-wrapper">
											{#if item.image_url && !brokenImages['item-' + item.id]}
												<img
													src={item.image_url}
													alt={item.name}
													class="item-cover-img"
													onerror={() => markImageBroken('item-' + item.id)}
												/>
											{:else}
												<div class="item-cover-img img-placeholder item-cover-placeholder">
													<FileText size={32} />
													<span>Artefacto Clasificado</span>
												</div>
											{/if}
										</div>
									{/if}

									<div class="item-info">
										<div class="item-header">
											<h4>{item.name}</h4>
											<span class="m-badge {item.media_type}">{item.media_type.toUpperCase()}</span>
										</div>

										{#if parsed}
											<div class="item-desc-blocks">
												<div class="item-desc-block">
													<span class="item-desc-label">Driver BEM</span>
													<p>{parsed.driver}</p>
												</div>
												<div class="item-desc-block">
													<span class="item-desc-label">{parsed.lessonLabel}</span>
													{#if parsed.lesson.length > LIBRETO_COLLAPSE_LENGTH && !expandedLibretos[item.id]}
														<p>{parsed.lesson.slice(0, LIBRETO_COLLAPSE_LENGTH)}…</p>
														<button type="button" class="item-desc-toggle" onclick={() => toggleLibreto(item.id)}>Ver transcripción completa ▾</button>
													{:else}
														<p>{parsed.lesson}</p>
														{#if parsed.lesson.length > LIBRETO_COLLAPSE_LENGTH}
															<button type="button" class="item-desc-toggle" onclick={() => toggleLibreto(item.id)}>Ver menos ▴</button>
														{/if}
													{/if}
												</div>
												<div class="item-desc-block">
													<span class="item-desc-label">Tip Práctico</span>
													<p>{parsed.tip}</p>
												</div>
											</div>
										{:else}
											<p class="item-desc">{item.description}</p>
										{/if}

										<!-- SI ES AUDIO O DESCARGA: ASSET CENTRADO Y REPRODUCTOR ABAJO -->
										{#if item.media_type === 'audio'}
											<div class="audio-box centered">
												{#if item.image_url && !brokenImages['item-' + item.id]}
													<div class="audio-cover-wrapper">
														<img
															src={item.image_url}
															alt={item.name}
															class="audio-cover-img"
															onerror={() => markImageBroken('item-' + item.id)}
														/>
													</div>
												{/if}
												<span class="audio-title"><Music size={15} /> Registro de Audio Clasificado:</span>
												{#if item.media_url}
													<audio controls src={item.media_url} class="audio-player"></audio>
												{:else}
													<div class="audio-pending-badge">Transmisión de audio encriptada</div>
												{/if}
											</div>
										{/if}

										<div class="item-status unlocked"><Check size={14} /> Desbloqueado en tu Inventario</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- RECOMPENSAS DE LA BÓVEDA (Fase 4.4): distinto de los ítems de
					     arriba (esos vienen de misiones/códigos, estos de comprar en
					     eventgage_event_rewards) — sección propia con acceso a la Bóveda. -->
					<div class="section-title vault-section-title">Recompensas de la Bóveda</div>
					{#if purchasedRewards.length === 0}
						<p class="hint">Todavía no canjeaste nada en la Bóveda de Inteligencia.</p>
					{:else}
						{@const B2B_DOC_MAP: Record<string, string> = {
							rew_bem_executive_deck: '/docs/gamescon/kit_ejecutivo_bem.pdf',
							rew_quiz_drivers_tool: '/docs/gamescon/quiz_diagnostico_drivers.pdf',
							rew_canvas_gdd_template: '/docs/gamescon/lienzo_canvas_gdd.pdf',
							rew_rubrica_feedback_inmediato: '/docs/gamescon/matriz_feedback_instruccional.pdf',
							rew_mcpft_diagnostic_tool: '/docs/gamescon/herramienta_matriz_mcpft.pdf',
							rew_antipatrones_guia: '/docs/gamescon/manual_antipatrones_gamificacion.pdf',
							rew_compendio_25_mecanicas: '/docs/gamescon/compendio_25_mecanicas.pdf',
							rew_fail_smart_rubric: '/docs/gamescon/rubrica_fail_smart.pdf',
							rew_matriz_metricas_bem: '/docs/gamescon/matriz_metametricas_bem.pdf'
						}}
						<div class="vault-inventory-list">
							{#each purchasedRewards as reward (reward.id)}
								<div class="vault-inventory-row">
									<span class="vault-inventory-name">{reward.name}</span>
									{#if B2B_DOC_MAP[reward.id]}
										<a href={B2B_DOC_MAP[reward.id]} download class="vault-inventory-download-link" target="_blank" rel="noopener noreferrer">
											Descargar PDF ⤓
										</a>
									{:else}
										<span class="vault-inventory-cost mono">{reward.cost} 💠</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
					<button type="button" class="primary-btn to-vault-btn" onclick={openVault}><Gem size={14} /> Ir a la Bóveda</button>
				</div>
			{/if}
		</main>

		<!-- MISSION DETAIL MODAL -->
		{#if selectedMission}
			<div
				class="modal-overlay"
				role="button"
				tabindex="0"
				onclick={() => (selectedMission = null)}
				onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') selectedMission = null; }}
			>
				<div
					class="modal-card"
					role="dialog"
					aria-modal="true"
					tabindex="-1"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
				>
					{#if selectedMission.type === 'ai_prompt_challenge' && (resolvingMission || requestingQuickFallback)}
						<!-- ESTADO DE ESPERA EXCLUSIVO DE GIOCCHI AI: Oculta la descripción y textarea para enfocar en la espera -->
						<div class="ai-processing-focused">
							<img src="/images/gamescon/characters/char_giocchi.jpg" alt="GIOCCHI AI" class="giocchi-popup-avatar" />
							<div class="ai-processing-header">
								<span class="giocchi-popup-badge">INTELIGENCIA TÁCTICA</span>
								<h3 class="ai-processing-title">GIOCCHI está evaluando tu respuesta...</h3>
							</div>

							<div class="ai-processing-box">
								<p class="giocchi-thinking mono">{GIOCCHI_THINKING_MESSAGES[giocchiThinkingIndex]}</p>
								<p class="ai-countdown-text">
									{#if aiCountdown > 0}
										Tiempo estimado de respuesta: <strong class="mono">{aiCountdown}s</strong>
									{:else}
										Tiempo estimado de respuesta: Puede tomar unos segundos más...
									{/if}
								</p>
								<button
									type="button"
									class="quick-fallback-btn"
									onclick={handleQuickFallback}
									disabled={requestingQuickFallback}
								>
									<Zap size={14} /> <span>{requestingQuickFallback ? 'Obteniendo respuesta...' : 'Respuesta rápida'}</span>
								</button>
							</div>
						</div>
					{:else}
						<span class="m-badge {selectedMission.type}">{selectedMission.type.toUpperCase()}</span>
						<h3>{selectedMission.title}</h3>
						<p>{selectedMission.description}</p>

						<!-- Cascada de texto por Facción/Avatar (sección 10.4): solo
						     algunas misiones tienen variantes (mechanic.faction_variants/
						     avatar_variants, sembradas selectivamente donde aportan — ver
						     seed_gamescon.sql). Si no aplica para la facción/avatar de este
						     jugador, no se agrega nada, nunca un placeholder vacío. -->
						{#if selectedMission.mechanic?.faction_variants?.[player?.avatar?.faction_id]}
							<p class="mission-context-variant mono"><span class="variant-label">Perspectiva de tu División:</span> {selectedMission.mechanic.faction_variants[player.avatar.faction_id]}</p>
						{/if}
						{#if selectedMission.mechanic?.avatar_variants?.[player?.avatar?.avatar_id]}
							<p class="mission-context-variant mono"><span class="variant-label">Perspectiva de tu Rol:</span> {selectedMission.mechanic.avatar_variants[player.avatar.avatar_id]}</p>
						{/if}

						{#if selectedMission.completed && selectedMission.type !== 'collective_vote' && selectedMission.type !== 'ai_prompt_challenge'}
							<!-- 1.6 del informe UX: antes esto caía en el formulario en blanco de
							     abajo, y el jugador se enteraba de que ya la había completado
							     recién AL ENVIAR una respuesta que nunca iba a contar. Las
							     votaciones y retos de IA quedan afuera a propósito: votaciones
							     para recomponer el voto y retos IA para revisar la evaluación de GIOCCHI. -->
							{@const canRetry = selectedMission.type === 'dice_check'
								&& player.game_status?.dice_check_outcomes?.[selectedMission.id] === false
								&& player.game_status?.unlocked_rewards?.includes('rew_item_reintento')
								&& !player.game_status?.reintento_used
								&& !retryResult}
							{#if canRetry}
								<!-- Ficha de Reintento (Fase 4.4, comprada en la Bóveda): la
								     misión ya está en completed_missions (el XP/CP del primer
								     intento no se toca), pero el fallo es reintentable una vez. -->
								<div class="mission-retry-panel">
									<p class="dc-note">Fallaste este chequeo, pero tenés una Ficha de Reintento sin usar en tu Bóveda.</p>
									<button type="button" class="primary-btn" onclick={handleRetryDiceCheck} disabled={retryingMission}>
										{#if retryingMission}Reintentando...{:else}<Dices size={16} /> Reintentar con Ficha de Reintento{/if}
									</button>
								</div>
							{:else if retryResult}
								{#if retryResult.success}
									<DiceCheckRoll
										roll={retryResult.roll}
										modifier={retryResult.modifier}
										total={retryResult.total}
										dc={retryResult.dc}
										checkSuccess={retryResult.checkSuccess}
										attribute={retryResult.attribute}
										onSettle={() => (retryResult.checkSuccess ? playDiceSuccess() : playDiceFail())}
										onContinue={() => applyDiceCheckConsequences(retryResult, diceRollPreviousItemCount)}
									/>
								{/if}
								{#if diceRollPhase === 'consequences'}
									<p class="hint">{retryResult.message}</p>
								{/if}
							{:else}
								<div class="mission-already-done">
									<span class="mission-done-icon"><Check size={16} /></span>
									<p>Ya completaste esta misión — no hace falta volver a resolverla.</p>
								</div>
							{/if}
						{:else if selectedMission.type === 'time_bomb' && selectedMission.expired}
							<!-- El tiempo real (server-side, ver checkExpiredTimeBombs) expiró
							     sin completar — ya no se puede canjear el código y la Inercia
							     Global ya subió +2 en el servidor. -->
							<div class="mission-already-done">
								<span class="mission-done-icon"><Lock size={16} /></span>
								<p>El tiempo para desactivar esta misión se agotó. La Agencia ya registró la falla.</p>
							</div>
						{:else if selectedMission.type === 'code' || selectedMission.type === 'time_bomb'}
							<form onsubmit={(e) => { e.preventDefault(); handleCodeSubmit(); }} class="modal-form">
								<input
									type="text"
									bind:value={codeInput}
									placeholder="Introduce la clave..."
									class="code-input"
									disabled={submittingCode}
								/>
								<button type="submit" class="primary-btn" disabled={submittingCode}>
									{#if submittingCode}
										<svg class="spinner" viewBox="0 0 24 24" fill="none">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										<span>Verificando...</span>
									{:else}
										<span>Enviar Solución</span>
									{/if}
								</button>
							</form>
						{:else if selectedMission.type === 'collective_vote'}
							<div class="vote-options">
								{#each selectedMission.options as opt}
									<button
										class="vote-btn {votedOption === opt.id ? 'active' : ''}"
										onclick={() => handleVote(opt.id)}
										disabled={voting}
									>
										{opt.text} {votedOption === opt.id ? '✓' : ''}
									</button>
								{/each}
							</div>
						{:else if selectedMission.type === 'dice_check'}
							<div class="mechanic-panel">
								{#if !missionResult}
									<p class="dc-note">DC actual: <strong class="mono">{diceCheckDc}</strong> — sube con tus propias misiones resueltas, no es arbitrario.</p>
									<p class="mechanic-hint">
										Atributo en juego: <SkillBadge skillKey={diceCheckAttribute} value={diceCheckSp} />
										→ modificador <strong class="mono">+{diceCheckModifier}</strong>
										<br />Tirada: d20 + modificador, contra el DC de arriba.
									</p>
									<button class="primary-btn" onclick={() => handleResolveMission({})} disabled={resolvingMission}>
										{#if resolvingMission}Tirando...{:else}<Dices size={16} /> Hacer chequeo{/if}
									</button>
								{:else if missionResult.success}
									<DiceCheckRoll
										roll={missionResult.roll}
										modifier={missionResult.modifier}
										total={missionResult.total}
										dc={missionResult.dc}
										checkSuccess={missionResult.checkSuccess}
										attribute={missionResult.attribute}
										onSettle={() => (missionResult.checkSuccess ? playDiceSuccess() : playDiceFail())}
										onContinue={() => applyDiceCheckConsequences(missionResult, diceRollPreviousItemCount)}
									/>
								{/if}
							</div>
						{:else if selectedMission.type === 'trivia_quiz'}
							<div class="vote-options">
								{#each (selectedMission.mechanic?.options || []) as opt}
									<button
										class="vote-btn {missionResult?.correctOptionId === opt.id ? 'active' : ''}"
										onclick={() => handleResolveMission({ optionId: opt.id })}
										disabled={resolvingMission || !!missionResult}
									>
										{opt.text} {missionResult?.correctOptionId === opt.id ? '✓' : ''}
									</button>
								{/each}
							</div>
						{:else if selectedMission.type === 'ai_prompt_challenge'}
							<form
								class="modal-form"
								onsubmit={(e) => { e.preventDefault(); handleResolveMission({ answerText: aiPromptText }); }}
							>
								<textarea
									class="code-input ai-textarea"
									bind:value={aiPromptText}
									rows="4"
									maxlength="300"
									placeholder="Escribe tu argumento (entre 20 y 300 caracteres)..."
									disabled={resolvingMission || !!missionResult}
								></textarea>
								<small class="char-counter">{aiPromptText.trim().length} / 300</small>
								<button
									type="submit"
									class="primary-btn"
									disabled={resolvingMission || !!missionResult || aiPromptText.trim().length < 20}
								>
									Enviar a GIOCCHI
								</button>
							</form>
						{/if}

						{#if codeMessage}
							<div class="code-feedback {codeMessage.type}">{codeMessage.text}</div>
						{/if}

						{#if missionResult && selectedMission.type !== 'ai_prompt_challenge' && (selectedMission.type !== 'dice_check' || diceRollPhase === 'consequences')}
							<div class="code-feedback {missionResult.success ? 'success' : 'error'}">{missionResult.message}</div>
							{#if missionResult.success && selectedMission?.mechanic?.unlock_communication}
								<div class="unlocked-comm-banner">
									<svg class="comm-banner-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
									</svg>
									<span>Revisa la comunicación entrante en el HUD para continuar.</span>
								</div>
							{/if}
						{:else if missionResult && !missionResult.success}
							<div class="code-feedback error">{missionResult.message}</div>
						{/if}

						<button class="secondary-btn modal-close" onclick={() => (selectedMission = null)}>Cerrar</button>
					{/if}
				</div>
			</div>
		{/if}

		<!-- MODAL DEDICADO DE EVALUACIÓN GIOCCHI AI (RETOS AI_PROMPT) -->
		{#if giocchiModalData}
			<div
				class="modal-overlay giocchi-overlay"
				role="button"
				tabindex="0"
				onclick={() => (giocchiModalData = null)}
				onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') giocchiModalData = null; }}
			>
				<div
					class="modal-card giocchi-popup-card"
					role="dialog"
					aria-modal="true"
					tabindex="-1"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
				>
					<div class="giocchi-popup-header">
						<img src="/images/gamescon/characters/char_giocchi.jpg" alt="GIOCCHI AI" class="giocchi-popup-avatar" />
						<div class="giocchi-popup-header-info">
							<span class="giocchi-popup-badge">EVALUACIÓN DE INTELIGENCIA TÁCTICA</span>
							<strong class="giocchi-popup-title">GIOCCHI AI</strong>
							<span class="giocchi-popup-mission">{giocchiModalData.missionTitle}</span>
						</div>
						{#if giocchiModalData.xpAwarded}
							<div class="giocchi-popup-xp">+{giocchiModalData.xpAwarded} XP</div>
						{/if}
					</div>

					<div class="giocchi-popup-scrollable-body">
						{#if giocchiModalData.userInput}
							<div class="giocchi-popup-quote">
								<span class="quote-label">Tu argumento:</span>
								<p class="quote-text">"{giocchiModalData.userInput}"</p>
							</div>
						{/if}

						<div class="giocchi-popup-analysis">
							<span class="analysis-label">Análisis de GIOCCHI & Principio BEM:</span>
							<div class="giocchi-popup-paragraphs">
								{#each (giocchiModalData.feedback || '').split('\n\n') as para}
									{#if para.trim()}
										<p>{para.trim()}</p>
									{/if}
								{/each}
							</div>
						</div>

						<div class="giocchi-popup-footer-notice">
							<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="20 6 9 17 4 12"></polyline>
							</svg>
							<span>Entrada archivada permanentemente en tu Bitácora (Pestaña Perfil)</span>
						</div>

						{#if giocchiModalData.hasUnlockedCommunication}
							<div class="giocchi-popup-comm-notice">
								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
								</svg>
								<span>Revisa la comunicación entrante en el HUD para continuar.</span>
							</div>
						{/if}
					</div>

					<button
						type="button"
						class="primary-btn giocchi-popup-close-btn"
						onclick={() => (giocchiModalData = null)}
					>
						<span>Entendido / Continuar ➔</span>
					</button>
				</div>
			</div>
		{/if}

		<!-- BOTTOM NAVIGATION BAR -->
		<nav class="bottom-nav">
			<button class="nav-item {activeTab === 'hud' ? 'active' : ''}" onclick={() => (activeTab = 'hud')}>
				<span class="nav-icon"><LayoutDashboard size={22} strokeWidth={2.25} /></span>
				<span class="nav-label">HUD</span>
			</button>
			<button class="nav-item {activeTab === 'missions' ? 'active' : ''}" onclick={() => (activeTab = 'missions')}>
				<span class="nav-icon"><Target size={22} strokeWidth={2.25} /></span>
				<span class="nav-label">Misiones</span>
			</button>
			<button class="nav-item {activeTab === 'items' ? 'active' : ''}" onclick={() => (activeTab = 'items')}>
				<span class="nav-icon"><Backpack size={22} strokeWidth={2.25} /></span>
				<span class="nav-label">Inventario</span>
			</button>
			{#if hasMap}
				<button class="nav-item {activeTab === 'map' ? 'active' : ''}" onclick={() => (activeTab = 'map')}>
					<span class="nav-icon"><MapIcon size={22} strokeWidth={2.25} /></span>
					<span class="nav-label">Mapa</span>
				</button>
			{/if}
			<button class="nav-item {activeTab === 'feed' ? 'active' : ''}" onclick={() => (activeTab = 'feed')}>
				<span class="nav-icon"><Radio size={22} strokeWidth={2.25} /></span>
				<span class="nav-label">Canal</span>
			</button>
			<button class="nav-item {activeTab === 'profile' ? 'active' : ''}" onclick={() => (activeTab = 'profile')}>
				<span class="nav-icon"><User size={22} strokeWidth={2.25} /></span>
				<span class="nav-label">Perfil</span>
			</button>
		</nav>
	</div>
{/if}

<style>
	/* Alineación base de todo ícono Lucide (3.3 del informe UX): sin esto,
	   un SVG inline se sienta sobre la línea de base del texto en vez de
	   centrarse ópticamente con ella. Una sola regla en vez de repetir un
	   `vertical-align` a mano en cada uno de los ~30 puntos donde aparece. */
	:global(.lucide-icon) { vertical-align: -0.2em; flex-shrink: 0; }

	/* RESET & ROOT */
	:global(body) {
		margin: 0;
		padding: 0;
		background: #090d16;
		color: #f8fafc;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		--font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
		/* Escala de radios (3.2 del informe UX): antes había 13 valores sueltos
		   sin ningún sistema detrás — cada componente definía el suyo "a ojo".
		   Consolidados a 5 pasos con nombre; el 50% de los círculos (avatares)
		   queda fuera de la escala a propósito, es un concepto distinto. */
		--radius-xs: 4px;
		--radius-sm: 0.5rem;
		--radius-md: 0.75rem;
		--radius-lg: 0.85rem;
		--radius-xl: 1.25rem;
		--radius-pill: 9999px;
		/* Motivo visual del HUD (3.2 del informe UX): esquina superior-izquierda
		   cortada en vez de redondeada, aplicada a las tarjetas de misión y al
		   marco del HUD — el gesto visual más reconocible de interfaz sci-fi
		   (Deus Ex, Cyberpunk 2077), en vez del lenguaje de "card" redondeada
		   que comparte cualquier dashboard genérico. Reemplaza el border-radius
		   de esos elementos puntuales, no se aplica a botones/modales/inputs. */
		--corner-cut: polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px);
		/* Escala tipográfica (3.2, cierre de lo que 3.1 dejó anotado): 24 valores
		   de font-size sueltos consolidados a 8 pasos con nombre — mismo criterio
		   que la escala de radios, drift visual mínimo (siempre <2px) a cambio de
		   un sistema real detrás de los tamaños de texto. */
		--text-xs: 0.65rem;
		--text-sm: 0.7rem;
		--text-base: 0.78rem;
		--text-md: 0.85rem;
		--text-lg: 0.95rem;
		--text-xl: 1.15rem;
		--text-2xl: 1.4rem;
		--text-3xl: 2.4rem;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	/* Lectura de sistema (códigos, contadores, fórmulas de dado, timestamps) en
	   fuente monoespaciada, separada de la voz narrativa de Cipher — 3.1 del
	   informe UX. Sin costo de descarga: son fuentes ya instaladas en el SO. */
	.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

	/* Cascada de texto por Facción/Avatar (10.4): párrafo secundario, sutil,
	   distinto de la descripción principal de la misión. */
	.mission-context-variant { font-size: var(--text-sm); opacity: 0.85; margin-top: 0.4rem; line-height: 1.5; }
	.mission-context-variant .variant-label { display: block; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; margin-bottom: 0.15rem; }

	/* Placeholder intencional para imágenes sin arte o inalcanzables (3.11) —
	   se combina con la clase base (avatar-img, gm-avatar, item-thumb, p-avatar)
	   así que hereda tamaño/radio/borde y solo aporta el centrado y el ícono. */
	.img-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(99, 102, 241, 0.12);
		font-size: var(--text-2xl);
		flex-shrink: 0;
	}

	/* SELECTION WIZARD (ONBOARDING) */
	.selection-overlay {
		position: fixed;
		inset: 0;
		background: radial-gradient(circle at top, #1e1b4b 0%, #090d16 80%);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		z-index: 100;
		overflow-y: auto;
	}
	.selection-card {
		background: rgba(15, 23, 42, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(16px);
		border-radius: var(--radius-xl);
		padding: 1.75rem;
		width: 100%;
		max-width: 440px;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
		text-align: center;
	}
	.badge {
		display: inline-block;
		font-size: var(--text-sm);
		font-weight: 800;
		letter-spacing: 0.08em;
		background: rgba(99, 102, 241, 0.2);
		color: #818cf8;
		border: 1px solid rgba(99, 102, 241, 0.4);
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius-pill);
		margin-bottom: 0.5rem;
	}
	.selection-card h2 {
		margin: 0 0 0.25rem 0;
		font-size: var(--text-2xl);
	}
	.subtitle {
		font-size: var(--text-md);
		color: #94a3b8;
		margin: 0 0 1.25rem 0;
	}
	.selection-fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}
	.step-section h3 {
		font-size: var(--text-lg);
		margin: 0 0 0.85rem 0;
		color: #cbd5e1;
	}
	.grid-options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}
	.option-btn {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: var(--radius-lg);
		padding: 1rem;
		cursor: pointer;
		text-align: left;
		transition: all 0.2s ease;
		color: inherit;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
	}
	.option-btn:hover {
		background: rgba(51, 65, 85, 0.8);
		border-color: rgba(255, 255, 255, 0.25);
	}
	.option-btn.active {
		background: rgba(99, 102, 241, 0.25);
		border-color: #818cf8;
		box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
	}
	.icon-thumb {
		width: 60px;
		height: 60px;
		min-width: 60px;
		border-radius: var(--radius-md);
		object-fit: cover;
		border: 2px solid rgba(255, 255, 255, 0.25);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
		background: #090d16;
	}
	.opt-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.opt-text strong {
		font-size: var(--text-lg);
		color: #f8fafc;
	}
	.opt-text .desc {
		font-size: var(--text-base);
		color: #cbd5e1;
		line-height: 1.35;
	}

	.primary-btn {
		width: 100%;
		padding: 0.85rem 1.25rem;
		background: linear-gradient(135deg, #6366f1, #a855f7);
		border: none;
		border-radius: var(--radius-md);
		color: #fff;
		font-weight: 700;
		font-size: var(--text-lg);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: opacity 0.2s ease, transform 0.1s ease;
	}
	.primary-btn:active { transform: scale(0.98); }
	.primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.secondary-btn {
		width: 100%;
		padding: 0.75rem 1rem;
		background: rgba(51, 65, 85, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		color: #cbd5e1;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.secondary-btn:hover { background: rgba(71, 85, 105, 0.8); }

	.spinner {
		width: 18px;
		height: 18px;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* CARRUSEL Y WIZARD DE AVATARES */
	.carousel-container { display: flex; flex-direction: column; gap: 1rem; margin: 1rem 0; }
	.carousel-nav { display: flex; align-items: center; justify-content: space-between; background: rgba(30, 41, 59, 0.7); padding: 0.6rem 0.85rem; border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.1); }
	.nav-arrow { background: rgba(99, 102, 241, 0.2); border: 1px solid #818cf8; color: #fff; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: var(--text-lg); transition: background 0.15s ease; }
	.nav-arrow:hover { background: rgba(99, 102, 241, 0.4); }
	.carousel-title-group { text-align: center; }
	.class-label { font-size: var(--text-xs); color: #a855f7; font-weight: 800; letter-spacing: 0.08em; display: block; }
	.carousel-title-group h4 { margin: 0.15rem 0 0 0; font-size: var(--text-xl); color: #fff; }

	.avatar-card { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: var(--radius-lg); padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
	.avatar-img-wrapper { width: 100%; height: 210px; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); }
	.carousel-avatar-img { width: 100%; height: 100%; object-fit: cover; transition: opacity 0.3s ease; }

	.gender-toggle { display: flex; gap: 0.6rem; justify-content: center; }
	.gender-btn { flex: 1; padding: 0.55rem 0.85rem; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: var(--radius-sm); color: #94a3b8; font-weight: 700; font-size: var(--text-md); cursor: pointer; transition: all 0.2s ease; }
	.gender-btn.active { background: rgba(168, 85, 247, 0.25); border-color: #a855f7; color: #fff; box-shadow: 0 0 12px rgba(168, 85, 247, 0.3); }

	.class-desc { font-size: var(--text-md); color: #cbd5e1; margin: 0; line-height: 1.45; }

	/* BARRAS DE PROGRESO DE PUNTOS SP */
	.sp-bars-container { background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; gap: 0.75rem; text-align: left; }
	.sp-bars-container h5 { margin: 0 0 0.4rem 0; font-size: var(--text-sm); color: #818cf8; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 800; }
	.sp-bar-row { display: flex; flex-direction: column; gap: 0.35rem; }
	.sp-label { display: flex; justify-content: space-between; align-items: center; font-size: var(--text-base); }
	.attr-name { color: #94a3b8; font-weight: 700; }
	.attr-val { color: #818cf8; font-weight: 800; }
	.sp-track { width: 100%; height: 7px; background: rgba(0, 0, 0, 0.4); border-radius: var(--radius-xs); overflow: hidden; }
	.sp-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #a855f7); border-radius: var(--radius-xs); transition: width 0.4s ease-out; }

	.wizard-actions { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 1rem; }

	/* MAIN APP SHELL */
	.app-shell {
		max-width: 480px;
		margin: 0 auto;
		min-height: 100vh;
		background: #090d16;
		display: flex;
		flex-direction: column;
		position: relative;
		padding-bottom: 75px;
	}

	/* ALERT BANNER */
	.alert-banner {
		background: rgba(15, 23, 42, 0.95);
		border-bottom: 2px solid #6366f1;
		padding: 0.75rem 1rem;
		font-size: var(--text-base);
		position: sticky;
		top: 0;
		z-index: 50;
		backdrop-filter: blur(8px);
	}
	.alert-banner.danger { border-color: #ef4444; }
	.alert-banner.warning { border-color: #f59e0b; }
	.alert-content { display: flex; align-items: center; gap: 0.5rem; }
	.alert-timer { height: 2px; background: rgba(255,255,255,0.1); margin-top: 0.5rem; }
	.alert-bar { height: 100%; background: #6366f1; transition: width 1s linear; }

	/* TOP HEADER */
	.top-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1rem;
		background: rgba(15, 23, 42, 0.8);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	/* min-width:0 en toda la cadena flex es lo que permite truncar con
	   ellipsis en vez de forzar el header a desbordar y cortar el badge de
	   CP / botón de sonido del lado derecho. El nombre va en su propia fila
	   (no comparte línea con el badge de rango): antes ambos peleaban por el
	   mismo espacio angosto y el nombre terminaba reducido a 3-4 letras. */
	.player-summary { display: flex; align-items: center; gap: 0.65rem; flex: 1; min-width: 0; }
	.avatar-img { width: 40px; height: 40px; border-radius: 50%; border: 2px solid #818cf8; object-fit: cover; flex-shrink: 0; }
	.player-info { flex: 1; min-width: 0; }
	.agent-name {
		font-weight: 700;
		font-size: var(--text-md);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row-title { display: flex; align-items: center; gap: 0.4rem; min-width: 0; margin-top: 0.2rem; }
	.rank-tag { font-size: var(--text-xs); background: rgba(99, 102, 241, 0.2); color: #818cf8; padding: 0.15rem 0.4rem; border-radius: var(--radius-xs); font-weight: 800; white-space: nowrap; flex-shrink: 0; }
	.xp-bar-container { width: 100%; height: 5px; background: rgba(255,255,255,0.1); border-radius: var(--radius-xs); margin: 0.35rem 0 0.2rem 0; overflow: hidden; }
	.xp-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #a855f7); border-radius: var(--radius-xs); }
	.xp-label { display: flex; justify-content: space-between; font-size: var(--text-sm); color: #94a3b8; font-weight: 600; }

	/* flex-shrink:0 asegura que este bloque nunca ceda espacio ni se corte —
	   es .agent-name quien absorbe la falta de espacio truncando. El botón de
	   sonido va apilado debajo de las monedas (en vez de al lado) para darle
	   más ancho horizontal a la columna del nombre/rango. */
	.top-bar-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem; flex-shrink: 0; }
	.sound-toggle {
		background: rgba(30, 41, 59, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #ffffff;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		min-width: 32px;
		min-height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
	}
	.sound-toggle.muted {
		color: #94a3b8;
		border-color: rgba(255, 255, 255, 0.1);
	}
	.sound-toggle:hover {
		background: rgba(51, 65, 85, 0.95);
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.3);
	}

	.cp-badge {
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 0.35rem 0.55rem;
		border-radius: var(--radius-pill);
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-family: inherit;
		font-weight: 800;
		font-size: var(--text-sm);
		color: #fbbf24;
		flex-shrink: 0;
		cursor: pointer;
	}
	.cp-badge:hover { background: rgba(30, 41, 59, 1); border-color: rgba(251, 191, 36, 0.4); }

	/* WORLD EVENT WIDGET — Inercia Global y Gremios apilados a ancho completo en
	   vez de una grilla de 2 columnas: a la mitad del ancho, el label de
	   el label envolvía a dos líneas y el widget quedaba más alto de lo
	   necesario. */
	.world-widget {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.85rem 1rem;
		background: rgba(15, 23, 42, 0.4);
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}
	.point-card {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.08);
		clip-path: var(--corner-cut);
		padding: 0.6rem;
	}
	.pulse-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--text-xs);
		color: #6ee7b7;
		margin-top: -0.15rem;
	}
	.pulse-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #34d399;
		flex-shrink: 0;
		animation: pulse-glow 1.8s ease-in-out infinite;
	}
	@keyframes pulse-glow {
		0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5); }
		50% { opacity: 0.6; box-shadow: 0 0 0 4px rgba(52, 211, 153, 0); }
	}
	.pt-header { display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); color: #94a3b8; font-weight: 700; margin-bottom: 0.35rem; }
	.refresh-btn {
		background: none;
		border: none;
		padding: 0.15rem;
		margin: -0.15rem;
		color: #fff;
		display: flex;
		align-items: center;
		cursor: pointer;
	}
	.refresh-btn:disabled { cursor: default; opacity: 0.6; }
	.refresh-btn :global(.spinning) { animation: spin 0.8s linear infinite; }
	.progress-bg { width: 100%; height: 6px; background: rgba(0,0,0,0.3); border-radius: var(--radius-xs); overflow: hidden; }
	.progress-fill.danger { height: 100%; background: #ef4444; border-radius: var(--radius-xs); }
	.progress-fill.milestone { height: 100%; background: linear-gradient(90deg, #f59e0b, #f97316); border-radius: var(--radius-xs); }
	.milestone-card {
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(245, 158, 11, 0.25);
		clip-path: var(--corner-cut);
		padding: 0.85rem 1rem;
		transition: border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
	}
	.milestone-card .pt-header { font-size: var(--text-base); color: #fbbf24; margin-bottom: 0.5rem; }
	.milestone-card .hint { display: block; margin-top: 0.4rem; }
	/* A una misión del próximo Hito (3.4): más peso visual que un medidor
	   pasivo — borde sólido, glow y fondo más cálido, no solo un cambio de
	   color sutil que se pierde escaneando rápido. */
	.milestone-card.imminent {
		border: 1px solid #fbbf24;
		background: rgba(120, 53, 15, 0.25);
		box-shadow: 0 0 24px rgba(251, 191, 36, 0.25);
		padding: 1rem 1.1rem;
	}
	.milestone-imminent-badge {
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: 0.05em;
		color: #fbbf24;
		margin-bottom: 0.5rem;
	}
	.faction-bars { display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.25rem; }
	/* Gremios como tabla de líderes: el ranking por posición ya comunica
	   competencia por sí solo, no hace falta una barra de progreso ni la
	   palabra "en competencia" en el título (feedback directo de Javier). */
	.faction-leaderboard { display: flex; flex-direction: column; gap: 0.15rem; margin-top: 0.3rem; }
	.f-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		background: none;
		border: none;
		border-radius: var(--radius-xs);
		padding: 0.35rem 0.4rem;
		margin: 0 -0.2rem;
		font-family: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.f-row:hover { background: rgba(255, 255, 255, 0.04); }
	.f-rank { font-size: var(--text-xs); color: #64748b; width: 1.1rem; flex-shrink: 0; }
	.f-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
	.f-name { flex: 1; font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.f-pts { font-size: var(--text-xs); color: #94a3b8; flex-shrink: 0; }
	/* Fila de la propia facción destacada (3.6) — para ubicarla de un vistazo
	   entre las tres sin tener que leer los nombres una por una. */
	.f-row.own-faction {
		background: rgba(255, 255, 255, 0.06);
		font-weight: 700;
	}
	.f-row.own-faction .f-name { color: #fff; }

	/* CONTENT TABS */
	.main-content { padding: 1rem; flex: 1; }
	.tab-pane { display: flex; flex-direction: column; gap: 1rem; }
	.pane-title { margin: 0 0 0.25rem 0; font-size: var(--text-xl); }

	/* QUICK CODE */
	.quick-code-card {
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-lg);
		padding: 1rem;
	}
	.quick-code-card h3 { margin: 0 0 0.25rem 0; font-size: var(--text-lg); }
	.hint { font-size: var(--text-base); color: #94a3b8; margin: 0 0 0.85rem 0; line-height: 1.3; }

	/* Juego de Contactos (sección 2.18) */
	.contact-card {
		display: flex; align-items: center; gap: 0.6rem; width: 100%;
		background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-lg); padding: 0.85rem 1rem; color: #e2e8f0;
		font-family: inherit; font-size: var(--text-base); text-align: left; cursor: pointer;
	}
	.contact-card-inactive { border-color: rgba(99, 102, 241, 0.4); }
	.link-btn { background: none; border: none; color: #a5b4fc; cursor: pointer; font-family: inherit; padding: 0; }
	.contact-bio-input { resize: vertical; font-family: inherit; }
	.contacts-list { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.6rem; }
	.contact-row {
		display: flex; justify-content: space-between; align-items: flex-start; gap: 0.6rem;
		background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md); padding: 0.7rem 0.85rem;
	}
	.contact-row-info { display: flex; flex-direction: column; gap: 0.15rem; }
	.contact-linkedin { color: #a5b4fc; font-size: var(--text-sm); }
	.contact-bio { margin: 0.2rem 0 0 0; }
	.contact-vcf-btn { flex-shrink: 0; white-space: nowrap; }
	.code-form { display: flex; gap: 0.5rem; }
	.code-input {
		flex: 1;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-sm);
		padding: 0.6rem 0.85rem;
		color: #fff;
		font-family: var(--font-mono);
		font-size: var(--text-md);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.code-btn {
		background: #6366f1;
		border: none;
		border-radius: var(--radius-sm);
		padding: 0.6rem 1rem;
		color: #fff;
		font-weight: 700;
		font-size: var(--text-md);
		cursor: pointer;
	}
	.code-feedback { margin-top: 0.65rem; padding: 0.5rem; border-radius: var(--radius-sm); font-size: var(--text-base); }
	.code-feedback.success { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; }
	.code-feedback.error { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }

	.section-title { font-size: var(--text-base); color: #94a3b8; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 0.5rem; }

	/* LOGO PRINCIPAL DEL HUD — eventgage_events.config.main_logo
	   Ocupa el 100% del ancho con altura dinámica y sin distorsión ni márgenes blancos. */
	.hud-main-logo-container {
		width: calc(100% + 2rem);
		margin: 0.5rem -1rem;
		overflow: hidden;
		background: transparent;
	}
	.hud-main-logo {
		display: block;
		width: 100%;
		height: auto;
		max-height: none;
		object-fit: cover;
		border: none;
	}

	/* BÓVEDA DE INTELIGENCIA — Fase 4.4 */
	.vault-section-title { margin-top: 1.5rem; }
	.vault-inventory-list { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.5rem; }
	.vault-inventory-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-sm);
		padding: 0.55rem 0.7rem;
	}
	.vault-inventory-name { font-size: var(--text-sm); font-weight: 600; }
	.vault-inventory-cost { font-size: var(--text-xs); color: #fbbf24; flex-shrink: 0; }
	.to-vault-btn { margin-top: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.4rem; }
	.profile-vip-token {
		background: rgba(251, 191, 36, 0.1);
		border: 1px dashed rgba(251, 191, 36, 0.4);
		border-radius: var(--radius-sm);
		padding: 0.6rem 0.75rem;
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.vip-token-label { font-size: var(--text-xs); color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
	.vip-token-val { color: #fbbf24; font-size: var(--text-base); }

	/* FEATURED & MISSIONS */
	.missions-list { display: flex; flex-direction: column; gap: 0.75rem; }
	.mission-card {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.08);
		clip-path: var(--corner-cut);
		padding: 1rem;
		cursor: pointer;
		text-align: left;
		color: inherit;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		transition: border-color 0.2s ease;
	}
	.mission-card.featured {
		display: flex;
		flex-direction: row;
		gap: 0.85rem;
		align-items: center;
		background: rgba(30, 41, 59, 0.7);
		border-color: rgba(99, 102, 241, 0.3);
	}
	.mission-card.locked { opacity: 0.5; cursor: not-allowed; }
	.mission-card.completed { border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.05); }
	.no-mission-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px dashed rgba(148, 163, 184, 0.3);
		clip-path: var(--corner-cut);
		padding: 1rem;
	}
	.no-mission-icon { font-size: var(--text-2xl); flex-shrink: 0; }
	.no-mission-card p { margin: 0; font-size: var(--text-md); color: #cbd5e1; line-height: 1.4; }
	.mission-already-done {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: rgba(16, 185, 129, 0.08);
		border: 1px solid rgba(16, 185, 129, 0.3);
		clip-path: var(--corner-cut);
		padding: 1rem;
	}
	.mission-done-icon {
		font-size: var(--text-xl);
		font-weight: 800;
		color: #34d399;
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: rgba(16, 185, 129, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.mission-already-done p { margin: 0; font-size: var(--text-md); color: #cbd5e1; }
	.m-thumb { width: 68px; height: 68px; border-radius: var(--radius-sm); object-fit: cover; }
	.m-info { flex: 1; }
	.m-info h4 { margin: 0.2rem 0; font-size: var(--text-lg); }
	.m-info p { margin: 0; font-size: var(--text-base); color: #94a3b8; line-height: 1.25; }
	.m-header { display: flex; justify-content: space-between; align-items: center; }
	/* Badge de tipo de misión (3.2): esquinas rectas + monoespaciado en vez de
	   la pastilla redondeada genérica — pasa de "etiqueta de producto" a "tag
	   de sistema", coherente con el resto de la lectura de sistema (3.1). */
	.m-badge { font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 800; letter-spacing: 0.02em; padding: 0.15rem 0.4rem; border-radius: 0; background: rgba(99, 102, 241, 0.2); color: #818cf8; }
	.m-badge.time_bomb { background: rgba(239, 68, 68, 0.2); color: #f87171; }
	.m-badge.cipher { background: rgba(16, 185, 129, 0.2); color: #34d399; align-self: flex-start; }
	.status-tag { font-size: var(--text-xs); font-weight: 700; }
	.status-tag.done { color: #10b981; }
	.status-tag.lock { color: #94a3b8; }
	.m-rewards { display: flex; gap: 0.5rem; font-size: var(--text-sm); color: #fbbf24; font-weight: 700; margin-top: 0.3rem; }
	.timer-box { font-size: var(--text-sm); color: #f87171; font-weight: 700; background: rgba(239, 68, 68, 0.15); padding: 0.3rem 0.5rem; border-radius: var(--radius-xs); display: inline-block; }
	.timer-box.expired { color: #94a3b8; background: rgba(148, 163, 184, 0.15); letter-spacing: 0.05em; }

	/* DIALOGUE & COMMS BOX */
	.comms-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.dialogue-box {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-lg);
		padding: 0.85rem;
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	.dialogue-box.comm-card-tactical {
		border-left: 3px solid #10b981;
	}
	.dialogue-box.comm-card-story {
		border-left: 3px solid #a855f7;
	}
	.comm-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.2rem;
		gap: 0.5rem;
	}
	.comm-badge {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 800;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.comm-badge.tactical {
		background: rgba(16, 185, 129, 0.2);
		color: #34d399;
	}
	.comm-badge.story {
		background: rgba(168, 85, 247, 0.2);
		color: #c084fc;
	}
	.gm-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #a855f7; }
	.cipher-avatar { color: #34d399; border-color: #10b981 !important; }
	.story-avatar { color: #c084fc; border-color: #a855f7 !important; }
	.dialogue-text { flex: 1; min-width: 0; }
	.dialogue-text strong { font-size: var(--text-base); color: #f1f5f9; display: block; margin-bottom: 0.15rem; }
	.dialogue-text p { margin: 0; font-size: var(--text-base); color: #cbd5e1; font-style: italic; line-height: 1.3; }

	/* MAP */
	.map-wrapper { position: relative; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
	.map-img { width: 100%; height: 260px; object-fit: cover; display: block; }
	.map-img-placeholder {
		flex-direction: column;
		gap: 0.5rem;
		text-align: center;
		padding: 1.5rem;
	}
	.map-img-placeholder span { font-size: var(--text-3xl); }
	.map-img-placeholder p { margin: 0; font-size: var(--text-sm); color: #94a3b8; max-width: 240px; }
	.hotspot-pin {
		position: absolute;
		transform: translate(-50%, -50%);
		background: rgba(15, 23, 42, 0.85);
		border: 1px solid #818cf8;
		color: #fff;
		font-size: var(--text-sm);
		font-weight: 700;
		padding: 0.35rem 0.6rem;
		border-radius: var(--radius-pill);
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(0,0,0,0.5);
		white-space: nowrap;
	}
	.hotspot-modal {
		background: rgba(15, 23, 42, 0.9);
		border: 1px solid rgba(255,255,255,0.15);
		border-radius: var(--radius-lg);
		padding: 1rem;
		margin-top: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.hotspot-modal h3 { margin: 0; font-size: var(--text-lg); }
	.hotspot-modal p { margin: 0; font-size: var(--text-base); color: #cbd5e1; }

	/* FEED & SUBTABS */
	.subtabs-bar {
		display: flex;
		gap: 0.5rem;
		background: rgba(15, 23, 42, 0.7);
		padding: 0.35rem;
		border-radius: var(--radius-lg);
		border: 1px solid rgba(255, 255, 255, 0.08);
		margin-bottom: 0.75rem;
	}
	.subtab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.65rem 0.85rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		color: #94a3b8;
		font-family: inherit;
		font-size: var(--text-md);
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.subtab-btn:hover {
		color: #e2e8f0;
		background: rgba(255, 255, 255, 0.04);
	}
	.subtab-btn.active {
		background: rgba(99, 102, 241, 0.2);
		border-color: rgba(99, 102, 241, 0.4);
		color: #fff;
		box-shadow: 0 2px 10px rgba(99, 102, 241, 0.2);
	}
	.subtab-counter {
		background: #818cf8;
		color: #0f172a;
		font-size: var(--text-xs);
		font-weight: 800;
		padding: 0.1rem 0.4rem;
		border-radius: var(--radius-pill);
		line-height: 1.2;
	}

	.subpane-title {
		font-size: var(--text-xl);
		font-weight: 700;
		margin: 0 0 0.25rem 0;
		color: #f8fafc;
	}
	.votes-intro {
		margin-bottom: 1rem;
	}
	.votes-subtitle {
		font-size: var(--text-base);
		color: #94a3b8;
		margin: 0;
		line-height: 1.35;
	}

	.alerts-feed-list {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		margin-bottom: 1.25rem;
	}
	.alert-feed-card {
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-left: 4px solid #38bdf8;
		border-radius: var(--radius-lg);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		backdrop-filter: blur(8px);
	}
	.alert-feed-card.warning {
		border-left-color: #f59e0b;
		background: rgba(45, 30, 15, 0.6);
	}
	.alert-feed-card.danger {
		border-left-color: #ef4444;
		background: rgba(45, 15, 20, 0.6);
	}
	.afc-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.afc-speaker {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.afc-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}
	.afc-avatar.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(99, 102, 241, 0.3);
		color: #c7d2fe;
	}
	.afc-speaker strong {
		font-size: var(--text-md);
		color: #e2e8f0;
	}
	.afc-badge {
		font-size: var(--text-xs);
		font-weight: 800;
		padding: 0.15rem 0.5rem;
		border-radius: var(--radius-pill);
		background: rgba(56, 189, 248, 0.2);
		color: #38bdf8;
		border: 1px solid rgba(56, 189, 248, 0.4);
	}
	.afc-badge.warning {
		background: rgba(245, 158, 11, 0.2);
		color: #fbbf24;
		border-color: rgba(245, 158, 11, 0.4);
	}
	.afc-badge.danger {
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
		border-color: rgba(239, 68, 68, 0.4);
	}
	.afc-title {
		margin: 0;
		font-size: var(--text-base);
		color: #f1f5f9;
		font-weight: 700;
	}
	.afc-msg {
		margin: 0;
		font-size: var(--text-base);
		color: #cbd5e1;
		line-height: 1.45;
	}
	.afc-time {
		font-size: var(--text-xs);
		color: #64748b;
		align-self: flex-end;
	}

	.feed-list { display: flex; flex-direction: column; gap: 0.75rem; }
	/* Estado honesto del Feed sin datos reales todavía (3.10) — mismo patrón
	   visual que .no-mission-card, en vez de actividad de otros jugadores
	   inventada. Las reglas .feed-item/.feed-icon/.feed-body del feed falso
	   se retiraron junto con el markup que las usaba. */
	.feed-empty {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px dashed rgba(148, 163, 184, 0.3);
		clip-path: var(--corner-cut);
		padding: 1rem;
	}
	.feed-empty-icon { font-size: var(--text-2xl); flex-shrink: 0; }
	.feed-empty p { margin: 0; font-size: var(--text-base); color: #cbd5e1; line-height: 1.4; }

	.feed-entry {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		clip-path: var(--corner-cut);
		padding: 0.85rem 1rem;
	}
	.feed-entry-icon { color: #a5b4fc; flex-shrink: 0; }
	.feed-entry p { margin: 0; font-size: var(--text-base); color: #e2e8f0; line-height: 1.4; }

	/* VOTED RESULT CARDS (EXPANDABLE) */
	.voted-cards-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.vote-result-card {
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-lg);
		overflow: hidden;
		transition: all 0.2s ease;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
	}
	.vote-result-card.expanded {
		border-color: rgba(168, 85, 247, 0.4);
		box-shadow: 0 8px 25px rgba(168, 85, 247, 0.15);
	}
	.vote-card-header {
		width: 100%;
		background: transparent;
		border: none;
		padding: 1rem 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		text-align: left;
		color: inherit;
		font-family: inherit;
		cursor: pointer;
	}
	.vote-card-header:hover {
		background: rgba(255, 255, 255, 0.02);
	}
	.v-header-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.v-header-main {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.v-title {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 700;
		color: #f8fafc;
	}
	.v-user-choice {
		font-size: var(--text-base);
		display: flex;
		gap: 0.35rem;
		align-items: baseline;
	}
	.choice-label {
		color: #94a3b8;
	}
	.choice-val {
		color: #c084fc;
		font-weight: 700;
	}
	.v-expand-toggle {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.35rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		font-size: var(--text-sm);
		color: #818cf8;
		font-weight: 700;
	}
	.toggle-icon {
		font-size: var(--text-sm);
	}

	.vote-results-body {
		padding: 0 1.15rem 1.15rem 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		border-top: 1px dashed rgba(255, 255, 255, 0.08);
		background: rgba(30, 41, 59, 0.35);
	}
	.vote-question-box {
		padding-top: 0.85rem;
	}
	.q-label {
		font-size: var(--text-xs);
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #94a3b8;
		display: block;
		margin-bottom: 0.15rem;
	}
	.q-text {
		margin: 0;
		font-size: var(--text-md);
		color: #e2e8f0;
		line-height: 1.4;
	}

	.options-breakdown {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.option-stat-box {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-md);
		padding: 0.75rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.option-stat-box.user-selected {
		border-color: rgba(168, 85, 247, 0.45);
		background: rgba(168, 85, 247, 0.08);
	}
	.opt-stat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: var(--text-base);
		gap: 0.5rem;
	}
	.opt-name-wrapper {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex: 1;
		flex-wrap: wrap;
	}
	.opt-name {
		font-weight: 600;
		color: #f1f5f9;
	}
	.user-vote-pill {
		font-size: var(--text-xs);
		font-weight: 800;
		color: #d8b4fe;
		background: rgba(168, 85, 247, 0.25);
		border: 1px solid rgba(168, 85, 247, 0.4);
		padding: 0.1rem 0.4rem;
		border-radius: var(--radius-xs);
		letter-spacing: 0.04em;
	}
	.opt-numbers {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
		text-align: right;
		white-space: nowrap;
	}
	.opt-pct {
		font-size: var(--text-lg);
		font-weight: 800;
		color: #818cf8;
	}
	.option-stat-box.user-selected .opt-pct {
		color: #c084fc;
	}
	.opt-cnt {
		font-size: var(--text-sm);
		color: #94a3b8;
	}
	.opt-bar-track {
		width: 100%;
		height: 7px;
		background: rgba(0, 0, 0, 0.4);
		border-radius: var(--radius-xs);
		overflow: hidden;
	}
	.opt-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, #6366f1, #818cf8);
		border-radius: var(--radius-xs);
		transition: width 0.5s ease-out;
	}
	.opt-bar-fill.highlight {
		background: linear-gradient(90deg, #9333ea, #c084fc);
	}

	.vote-meta-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: var(--text-sm);
		color: #94a3b8;
		padding-top: 0.35rem;
	}
	.meta-total strong {
		color: #e2e8f0;
	}
	.meta-status {
		color: #34d399;
		font-weight: 700;
	}

	.empty-votes-card {
		background: rgba(30, 41, 59, 0.4);
		border: 1px dashed rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-lg);
		padding: 2rem 1.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}
	.empty-icon {
		font-size: var(--text-3xl);
	}
	.empty-votes-card h4 {
		margin: 0;
		font-size: var(--text-lg);
		color: #f8fafc;
	}
	.empty-votes-card p {
		margin: 0;
		font-size: var(--text-base);
		color: #94a3b8;
		line-height: 1.45;
		max-width: 320px;
	}
	.to-missions-btn {
		margin-top: 0.5rem;
		width: auto;
		padding: 0.65rem 1.25rem;
		font-size: var(--text-md);
	}

	/* ITEMS */
	.items-list { display: flex; flex-direction: column; gap: 1.25rem; }
	.item-card {
		display: flex;
		flex-direction: column;
		background: rgba(15, 23, 42, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		transition: transform 0.2s ease, border-color 0.2s ease;
	}
	.item-card:hover {
		border-color: rgba(129, 140, 248, 0.35);
	}
	.item-cover-wrapper {
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #090d16;
		overflow: hidden;
		position: relative;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.item-cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.item-cover-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: #64748b;
		font-size: var(--text-sm);
		background: radial-gradient(circle at center, rgba(30, 41, 59, 0.6), #090d16);
	}
	.item-info {
		padding: 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.item-header { display: flex; justify-content: space-between; align-items: center; }
	.item-header h4 { margin: 0; font-size: var(--text-xl); font-weight: 700; color: #f8fafc; }
	.item-desc { font-size: var(--text-base); color: #94a3b8; margin: 0; line-height: 1.45; }
	
	.item-desc-blocks { display: flex; flex-direction: column; gap: 0.75rem; }
	.item-desc-block p { margin: 0.2rem 0 0 0; font-size: var(--text-base); color: #cbd5e1; line-height: 1.5; }
	.item-desc-label { display: block; font-size: var(--text-xs); color: #818cf8; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 800; }
	.item-desc-toggle {
		background: none;
		border: none;
		color: #818cf8;
		font-size: var(--text-sm);
		font-weight: 700;
		padding: 0.25rem 0;
		cursor: pointer;
		text-align: left;
	}
	.item-status { font-size: var(--text-sm); font-weight: 700; margin-top: 0.25rem; }
	.item-status.unlocked { color: #10b981; }
	.item-status.locked { color: #94a3b8; }
	
	.audio-box.centered {
		margin-top: 0.5rem;
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-md);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
	}
	.audio-cover-wrapper {
		width: 100%;
		max-width: 240px;
		aspect-ratio: 16 / 9;
		border-radius: var(--radius-sm);
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.audio-cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.audio-title { font-size: var(--text-sm); color: #c084fc; font-weight: 700; display: block; }
	.audio-player { width: 100%; max-width: 380px; height: 36px; border-radius: var(--radius-xs); }
	.audio-pending-badge {
		font-size: var(--text-xs);
		color: #94a3b8;
		background: rgba(148, 163, 184, 0.1);
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-pill);
		border: 1px dashed rgba(148, 163, 184, 0.3);
	}

	/* PROFILE */
	.profile-card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem; border-radius: var(--radius-lg); text-align: center; margin-bottom: 1.5rem; }
	.p-avatar { width: 76px; height: 76px; border-radius: 50%; border: 3px solid #6366f1; margin-bottom: 0.5rem; }
	.profile-card h3 { margin: 0 0 0.25rem 0; font-size: var(--text-xl); }
	.p-fac { margin: 0 0 0.75rem 0; font-size: var(--text-md); color: #94a3b8; }
	.profile-level-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-pill);
		padding: 0.35rem 0.85rem;
		margin-bottom: 1.25rem;
		font-size: var(--text-sm);
	}
	.p-lvl-tag {
		font-weight: 800;
		font-size: var(--text-xs);
		padding: 0.15rem 0.45rem;
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
	}
	.p-lvl-title {
		color: #e2e8f0;
		font-weight: 600;
	}
	.p-lvl-xp {
		color: #94a3b8;
		font-size: var(--text-xs);
	}

	.journal-list { display: flex; flex-direction: column; gap: 1rem; }
	.journal-card { background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: var(--radius-md); font-size: var(--text-md); margin-bottom: 0.75rem; }
	.journal-card h4 { margin: 0 0 0.4rem 0; font-size: var(--text-lg); color: #818cf8; }
	.j-html { color: #cbd5e1; line-height: 1.4; }
	.empty-msg { font-size: var(--text-base); color: #94a3b8; font-style: italic; }

	.logout-btn {
		width: 100%;
		margin-top: 1.5rem;
		padding: 0.75rem;
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #f87171;
		font-weight: 700;
		border-radius: var(--radius-md);
		cursor: pointer;
	}
	.logout-btn.reset-btn {
		background: rgba(99, 102, 241, 0.15);
		border-color: rgba(99, 102, 241, 0.4);
		color: #818cf8;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
	}

	/* MODAL */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		z-index: 200;
	}
	.modal-card {
		background: #0f172a;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		width: 100%;
		max-width: 440px;
		max-height: 88vh;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.7);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.modal-card h3 { margin: 0; font-size: var(--text-xl); }
	.modal-card p { margin: 0; font-size: var(--text-md); color: #cbd5e1; line-height: 1.4; }

	/* PANTALLA DE DETALLE DE GREMIO */
	.faction-detail-card { border-width: 1px; border-style: solid; }
	.faction-detail-header { display: flex; align-items: center; gap: 0.85rem; }
	.faction-detail-img { width: 56px; height: 56px; border-radius: 50%; border: 2px solid; object-fit: cover; flex-shrink: 0; }
	.faction-detail-titles h3 { line-height: 1.2; }
	.faction-detail-pts { display: block; font-size: var(--text-sm); color: #94a3b8; margin-top: 0.15rem; }
	.faction-detail-list-title { font-size: var(--text-xs); font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #94a3b8; margin-top: 0.2rem; }
	.faction-detail-error { color: #fca5a5; }
	.faction-member-list {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		max-height: 45vh;
		overflow-y: auto;
		margin: -0.2rem -0.3rem 0;
		padding: 0.2rem 0.3rem 0;
	}
	.vault-inventory-download-link {
		font-family: var(--font-mono, monospace);
		font-size: var(--text-xs);
		font-weight: 800;
		color: #10b981;
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.3);
		padding: 0.2rem 0.5rem;
		border-radius: var(--radius-sm);
		text-decoration: none;
		transition: background 0.15s ease;
	}
	.vault-inventory-download-link:hover {
		background: rgba(16, 185, 129, 0.25);
	}
	.faction-member-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.4rem 0.2rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.faction-member-row:last-child { border-bottom: none; }
	.fm-rank { font-size: var(--text-xs); color: #64748b; width: 1.3rem; flex-shrink: 0; }
	.fm-avatar { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: rgba(99, 102, 241, 0.12); }
	.fm-name { flex: 1; font-size: var(--text-sm); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.fm-xp { font-size: var(--text-xs); color: #94a3b8; flex-shrink: 0; }

	.narrative-overlay {
		position: fixed;
		inset: 0;
		background: radial-gradient(circle at top, rgba(30, 27, 75, 0.97), rgba(2, 6, 23, 0.99));
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		z-index: 210;
	}
	.narrative-card {
		background: rgba(15, 23, 42, 0.9);
		border: 1px solid rgba(129, 140, 248, 0.35);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		width: 100%;
		max-width: 460px;
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.narrative-badge {
		align-self: flex-start;
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		background: rgba(129, 140, 248, 0.18);
		color: #a5b4fc;
		padding: 0.25rem 0.55rem;
		border-radius: var(--radius-pill);
	}
	.narrative-speaker { display: flex; align-items: center; gap: 0.85rem; }
	.narrative-speaker-avatar { width: 56px; height: 56px; border-radius: var(--radius-md); object-fit: cover; border: 2px solid #818cf8; flex-shrink: 0; box-shadow: 0 0 15px rgba(129, 140, 248, 0.3); }
	.narrative-speaker-info { display: flex; flex-direction: column; gap: 0.1rem; }
	.narrative-speaker-info strong { font-size: var(--text-lg); color: #fff; }
	.narrative-speaker-info span { font-size: var(--text-sm); color: #94a3b8; }
	.narrative-text-btn {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		text-align: left;
		font-family: inherit;
		color: inherit;
		cursor: pointer;
		width: 100%;
		display: block;
	}
	.narrative-p {
		margin: 0;
		font-size: var(--text-base);
		color: #e2e8f0;
		line-height: 1.55;
	}
	.cipher-modal-header { display: flex; align-items: center; gap: 0.85rem; margin-bottom: 0.75rem; }
	.cipher-modal-avatar { width: 56px; height: 56px; border-radius: var(--radius-md); object-fit: cover; border: 2px solid #10b981; flex-shrink: 0; box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); }
	.cipher-modal-meta { display: flex; flex-direction: column; gap: 0.2rem; }
	.cipher-modal-meta h3 { margin: 0; font-size: var(--text-xl); color: #fff; }
	.cipher-modal-role { font-size: var(--text-xs); color: #94a3b8; font-family: var(--font-mono); }

	/* OVERLAY CEREMONIAL DE HITO PAGINADO & NARRATIVA TÁCTICA */
	.milestone-overlay {
		position: fixed;
		inset: 0;
		background: radial-gradient(circle at top, rgba(120, 53, 15, 0.45), rgba(2, 6, 23, 0.98));
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		z-index: 220;
	}
	.milestone-overlay-card {
		background: rgba(15, 23, 42, 0.96);
		border: 1px solid rgba(251, 191, 36, 0.45);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		width: 100%;
		max-width: 480px;
		max-height: 88vh;
		overflow-y: auto;
		box-shadow: 0 0 40px rgba(251, 191, 36, 0.18), 0 25px 60px rgba(0, 0, 0, 0.8);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		text-align: left;
	}
	.milestone-header {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}
	.milestone-trophy { font-size: var(--text-3xl); line-height: 1; color: #fbbf24; }
	.milestone-title-group { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
	.milestone-badge-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
	.milestone-badge {
		font-size: var(--text-xs);
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: rgba(251, 191, 36, 0.18);
		color: #fbbf24;
		padding: 0.2rem 0.55rem;
		border-radius: var(--radius-pill);
	}
	.milestone-page-counter {
		font-size: var(--text-xs);
		color: #94a3b8;
		font-weight: 600;
	}
	.milestone-rank { margin: 0; font-size: var(--text-xl); color: #fff; }

	.milestone-dots-indicator {
		display: flex;
		gap: 0.4rem;
		justify-content: center;
		padding: 0.2rem 0;
	}
	.milestone-dot {
		width: 22px;
		height: 5px;
		border-radius: var(--radius-pill);
		background: rgba(255, 255, 255, 0.15);
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
	}
	.milestone-dot.active {
		background: #fbbf24;
		width: 32px;
		box-shadow: 0 0 8px rgba(251, 191, 36, 0.4);
	}

	.milestone-speaker {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-md);
		padding: 0.6rem 0.8rem;
	}
	.milestone-speaker-avatar {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-sm);
		object-fit: cover;
		border: 2px solid #fbbf24;
		flex-shrink: 0;
	}
	.milestone-speaker-avatar.placeholder {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-sm);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid #fbbf24;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fbbf24;
		flex-shrink: 0;
	}
	.milestone-speaker-info { display: flex; flex-direction: column; gap: 0.1rem; }
	.milestone-speaker-info strong { font-size: var(--text-sm); color: #fff; }
	.milestone-speaker-info span { font-size: var(--text-xs); color: #94a3b8; }

	.milestone-page-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 120px;
	}
	.milestone-page-tag {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: #a5b4fc;
		text-transform: uppercase;
	}
	.milestone-narrative-content {
		font-size: var(--text-sm);
		line-height: 1.55;
		color: #e2e8f0;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.milestone-narrative-content :global(p) { margin: 0; }
	.milestone-narrative-content :global(.tip-box) {
		background: rgba(99, 102, 241, 0.12);
		border: 1px solid rgba(99, 102, 241, 0.35);
		border-left: 3px solid #818cf8;
		border-radius: var(--radius-sm);
		padding: 0.75rem;
		font-size: 0.82rem;
		color: #e0e7ff;
		line-height: 1.45;
	}

	.milestone-rewards-box {
		background: rgba(251, 191, 36, 0.06);
		border: 1px solid rgba(251, 191, 36, 0.25);
		border-radius: var(--radius-md);
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.milestone-rewards-title {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: #fbbf24;
	}
	.milestone-rewards { display: flex; gap: 0.6rem; font-size: var(--text-md); font-weight: 700; color: #fbbf24; margin: 0.1rem 0; }
	.milestone-item-reveal {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		background: rgba(251, 191, 36, 0.08);
		border: 1px dashed rgba(251, 191, 36, 0.35);
		border-radius: var(--radius-md);
		padding: 0.75rem 1rem;
		margin: 0.3rem 0;
		text-align: left;
	}
	.milestone-item-icon {
		font-size: var(--text-2xl);
		flex-shrink: 0;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(circle, rgba(251, 191, 36, 0.35), rgba(251, 191, 36, 0.08));
		border-radius: 50%;
		color: #fbbf24;
	}
	.milestone-item-label { display: block; font-size: var(--text-xs); color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
	.milestone-item-name { display: block; font-size: var(--text-lg); color: #fff; }
	.milestone-overlay-card .primary-btn { margin-top: 0.5rem; width: 100%; }
	.modal-form { display: flex; flex-direction: column; gap: 0.6rem; }
	.vote-options { display: flex; flex-direction: column; gap: 0.5rem; }
	.vote-btn {
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 0.75rem;
		border-radius: var(--radius-sm);
		color: #fff;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
	}
	.vote-btn.active {
		background: rgba(99, 102, 241, 0.25);
		border-color: #6366f1;
		color: #818cf8;
	}
	.modal-close { margin-top: 0.5rem; }

	.mechanic-panel, .mission-retry-panel { display: flex; flex-direction: column; gap: 0.6rem; }
	.mechanic-hint { font-size: var(--text-base); color: #94a3b8; line-height: 1.5; }
	.dc-note { font-size: var(--text-sm); color: #94a3b8; margin: 0; }
	.dice-result { padding: 0.75rem; border-radius: var(--radius-sm); font-size: var(--text-md); text-align: center; }
	.dice-result.success { background: rgba(16, 185, 129, 0.18); border: 1px solid #10b981; color: #34d399; }
	.dice-result.fail { background: rgba(148, 163, 184, 0.15); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; }
	.ai-textarea { text-transform: none; resize: vertical; min-height: 5.5rem; font-family: inherit; line-height: 1.4; }
	/* #64748b medía 3.5-4.1:1 contra los fondos reales de la app — no llegaba
	   al 4.5:1 de WCAG AA que exige la sección 12.3 del diseño (3.13 del
	   informe UX, medido con la fórmula de contraste real, no a ojo).
	   #94a3b8 (el gris ya usado en el resto de la app) mide 6.5-7.6:1. */
	.char-counter { align-self: flex-end; font-size: var(--text-sm); color: #94a3b8; }
	.giocchi-thinking {
		margin: 0;
		font-size: var(--text-sm);
		color: #a78bfa;
		text-align: center;
		animation: giocchi-pulse 1.8s ease-in-out infinite;
	}
	.ai-processing-focused {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1.25rem;
		padding: 1.25rem 0.5rem;
		width: 100%;
	}
	.ai-processing-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
	}
	.ai-processing-title {
		margin: 0;
		font-size: 1.15rem;
		color: #ffffff;
		font-weight: 700;
		text-align: center;
	}
	.ai-processing-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
		padding: 0.85rem;
		background: rgba(167, 139, 250, 0.08);
		border: 1px dashed rgba(167, 139, 250, 0.3);
		border-radius: 0.75rem;
	}
	.ai-countdown-text {
		margin: 0;
		font-size: 0.82rem;
		color: #cbd5e1;
		text-align: center;
	}
	.ai-countdown-text strong {
		color: #38bdf8;
	}
	.quick-fallback-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.45rem 1.1rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: #fbbf24;
		background: rgba(251, 191, 36, 0.12);
		border: 1px solid rgba(251, 191, 36, 0.4);
		border-radius: 9999px;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.quick-fallback-btn:hover:not(:disabled) {
		background: rgba(251, 191, 36, 0.22);
		border-color: #fbbf24;
		transform: translateY(-1px);
	}
	.quick-fallback-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	@keyframes giocchi-pulse {
		0%, 100% { opacity: 0.55; }
		50% { opacity: 1; }
	}

	/* MODAL DEDICADO DE RESPUESTA GIOCCHI AI */
	.giocchi-overlay {
		z-index: 300;
		background: rgba(5, 7, 15, 0.85);
		backdrop-filter: blur(10px);
	}
	.giocchi-popup-card {
		background: linear-gradient(145deg, #161233 0%, #0c1020 100%);
		border: 1px solid rgba(192, 132, 252, 0.45);
		max-width: 460px;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
		gap: 1.2rem;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(168, 85, 247, 0.2);
	}
	.giocchi-popup-header {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		flex-shrink: 0;
	}
	.giocchi-popup-avatar {
		width: 50px;
		height: 50px;
		border-radius: 50%;
		border: 2px solid #c084fc;
		object-fit: cover;
		box-shadow: 0 0 14px rgba(192, 132, 252, 0.45);
		flex-shrink: 0;
	}
	.giocchi-popup-header-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
		text-align: left;
		min-width: 0;
	}
	.giocchi-popup-badge {
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #c084fc;
		text-transform: uppercase;
	}
	.giocchi-popup-title {
		font-size: 1.15rem;
		color: #ffffff;
		font-weight: 800;
		letter-spacing: -0.01em;
		margin: 0;
	}
	.giocchi-popup-mission {
		font-size: 0.75rem;
		color: #94a3b8;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.giocchi-popup-xp {
		background: rgba(168, 85, 247, 0.25);
		color: #e9d5ff;
		font-size: 0.9rem;
		font-weight: 800;
		padding: 0.35rem 0.8rem;
		border-radius: 9999px;
		border: 1px solid rgba(192, 132, 252, 0.45);
		flex-shrink: 0;
	}
	.giocchi-popup-scrollable-body {
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding-right: 0.3rem;
		max-height: 52vh;
	}
	.giocchi-popup-quote {
		background: rgba(0, 0, 0, 0.4);
		border-left: 3px solid #38bdf8;
		border-radius: 0 0.5rem 0.5rem 0;
		padding: 0.85rem 1rem;
		text-align: left;
	}
	.giocchi-popup-quote .quote-label {
		display: block;
		font-size: 0.72rem;
		font-weight: 700;
		color: #38bdf8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
	}
	.giocchi-popup-quote .quote-text {
		margin: 0;
		font-size: 0.88rem;
		font-style: italic;
		color: #cbd5e1;
		line-height: 1.45;
	}
	.giocchi-popup-analysis {
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.giocchi-popup-analysis .analysis-label {
		font-size: 0.76rem;
		font-weight: 800;
		color: #fbbf24;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.giocchi-popup-paragraphs {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		line-height: 1.6;
		font-size: 0.94rem;
		color: #f1f5f9;
	}
	.giocchi-popup-paragraphs p {
		margin: 0;
	}
	.giocchi-popup-footer-notice {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		font-size: 0.76rem;
		color: #a78bfa;
		text-align: left;
	}
	.giocchi-popup-comm-notice {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.75rem;
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.3);
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		font-weight: 600;
		color: #34d399;
		text-align: left;
	}
	.giocchi-popup-comm-notice svg {
		flex-shrink: 0;
	}
	.unlocked-comm-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 0.85rem;
		background: rgba(16, 185, 129, 0.12);
		border: 1px solid rgba(16, 185, 129, 0.35);
		border-radius: var(--radius-md);
		color: #34d399;
		font-size: 0.85rem;
		font-weight: 600;
		margin-top: 0.65rem;
		text-align: left;
	}
	.unlocked-comm-banner svg {
		flex-shrink: 0;
		color: #34d399;
	}
	.giocchi-popup-close-btn {
		width: 100%;
		padding: 0.85rem;
		font-size: 1rem;
		font-weight: 700;
		background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: var(--radius-md);
		color: #ffffff;
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);
		transition: transform 0.15s ease, filter 0.15s ease;
	}
	.giocchi-popup-close-btn:hover {
		filter: brightness(1.1);
		transform: translateY(-1px);
	}

	/* BOTTOM NAVIGATION BAR */
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 480px;
		background: rgba(15, 23, 42, 0.92);
		backdrop-filter: blur(12px);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		display: flex;
		justify-content: space-around;
		padding: 0.5rem 0;
		z-index: 90;
	}
	.nav-item {
		background: none;
		border: none;
		color: #94a3b8;
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		cursor: pointer;
		padding: 0.55rem 0.25rem;
		font-family: inherit;
		transition: color 0.15s ease;
	}
	.nav-item.active { color: #818cf8; }
	/* 3.3: el cambio de tab antes era instantáneo, sin ninguna transición —
	   el ícono activo ahora escala y "rebota" levemente al entrar. */
	.nav-icon {
		display: flex;
		transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	/* TYPEWRITER EFFECTS */
	.typewriter-cursor {
		display: inline-block;
		width: 7px;
		height: 1.1em;
		vertical-align: middle;
		margin-left: 3px;
		background: #38bdf8;
		border-radius: 1px;
		animation: cursorBlink 0.65s infinite alternate;
	}
	@keyframes cursorBlink {
		0% { opacity: 1; }
		100% { opacity: 0; }
	}
	.typewriter-reveal {
		animation: typewriterFadeIn 0.35s ease-out;
	}
	@keyframes typewriterFadeIn {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* CODE REWARD CELEBRATION MODAL */
	.code-reward-overlay {
		position: fixed;
		inset: 0;
		background: rgba(10, 15, 29, 0.85);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1.25rem;
		animation: fadeIn 0.25s ease-out;
	}
	.code-reward-card {
		background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
		border: 1px solid rgba(56, 189, 248, 0.35);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		width: 100%;
		max-width: 440px;
		box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15);
		display: flex;
		flex-direction: column;
		gap: 1rem;
		animation: popUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes popUp {
		from { transform: scale(0.92); opacity: 0; }
		to { transform: scale(1); opacity: 1; }
	}
	.code-reward-header {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		align-items: center;
		text-align: center;
	}
	.code-reward-badge {
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.12);
		border: 1px solid rgba(56, 189, 248, 0.3);
		padding: 0.3rem 0.75rem;
		border-radius: var(--radius-pill);
	}
	.code-reward-code {
		font-size: var(--text-base);
		font-weight: 800;
		color: #f8fafc;
		letter-spacing: 0.05em;
	}
	.code-reward-msg {
		margin: 0;
		font-size: var(--text-sm);
		color: #cbd5e1;
		text-align: center;
		line-height: 1.45;
	}
	.code-reward-stats {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		margin: 0.2rem 0;
	}
	.stat-pill {
		padding: 0.4rem 0.85rem;
		border-radius: var(--radius-pill);
		font-weight: 800;
		font-size: var(--text-sm);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.stat-pill.xp {
		background: rgba(99, 102, 241, 0.2);
		border: 1px solid rgba(99, 102, 241, 0.4);
		color: #a5b4fc;
	}
	.stat-pill.cp {
		background: rgba(56, 189, 248, 0.2);
		border: 1px solid rgba(56, 189, 248, 0.4);
		color: #7dd3fc;
	}
	.unlocked-mission-preview {
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-left: 4px solid #38bdf8;
		border-radius: var(--radius-md);
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		text-align: left;
	}
	.ump-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.ump-tag {
		font-size: 0.68rem;
		font-weight: 700;
		color: #38bdf8;
		letter-spacing: 0.05em;
	}
	.ump-type-tag {
		font-size: 0.65rem;
		font-weight: 800;
		padding: 0.15rem 0.45rem;
		border-radius: var(--radius-pill);
		background: rgba(255, 255, 255, 0.08);
		color: #94a3b8;
	}
	.ump-type-tag.ai_prompt_challenge { color: #c084fc; background: rgba(192, 132, 252, 0.15); }
	.ump-type-tag.collective_vote { color: #60a5fa; background: rgba(96, 165, 250, 0.15); }
	.ump-type-tag.trivia_quiz { color: #fbbf24; background: rgba(251, 191, 36, 0.15); }
	.ump-type-tag.dice_check { color: #34d399; background: rgba(52, 211, 153, 0.15); }
	.ump-type-tag.time_bomb { color: #f87171; background: rgba(248, 113, 113, 0.15); }
	.ump-title {
		margin: 0;
		font-size: var(--text-md);
		color: #f8fafc;
		font-weight: 700;
	}
	.ump-desc {
		margin: 0;
		font-size: var(--text-xs);
		color: #94a3b8;
		line-height: 1.4;
	}
	.ump-rewards {
		display: flex;
		gap: 0.5rem;
		font-size: 0.72rem;
		color: #fbbf24;
		font-weight: 700;
		margin-top: 0.2rem;
	}
	.code-reward-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}
	.code-reward-actions .primary-btn {
		width: 100%;
		justify-content: center;
	}
	.code-reward-actions .secondary-btn {
		width: 100%;
		justify-content: center;
	}

	/* PREMIUM SUBTAB IN CANAL */
	.premium-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.premium-card {
		background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%);
		border: 1px solid rgba(251, 191, 36, 0.3);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), inset 0 0 15px rgba(251, 191, 36, 0.05);
	}
	.premium-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.premium-badge-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.premium-badge {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: #fbbf24;
		background: rgba(251, 191, 36, 0.15);
		border: 1px solid rgba(251, 191, 36, 0.35);
		padding: 0.25rem 0.6rem;
		border-radius: var(--radius-pill);
	}
	.premium-badge-tag {
		font-size: 0.68rem;
		color: #94a3b8;
	}
	.premium-sparkle-icon {
		color: #fbbf24;
	}
	.premium-title {
		margin: 0;
		font-size: var(--text-lg);
		color: #f8fafc;
	}
	.premium-main-msg {
		margin: 0;
		font-size: var(--text-md);
		color: #e2e8f0;
		font-weight: 500;
		line-height: 1.5;
		background: rgba(15, 23, 42, 0.5);
		border: 1px dashed rgba(251, 191, 36, 0.25);
		border-radius: var(--radius-md);
		padding: 0.9rem 1rem;
	}
	.premium-info-box {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-md);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.premium-info-box h4 {
		margin: 0;
		font-size: var(--text-sm);
		color: #94a3b8;
		font-weight: 700;
	}
	.premium-info-box p {
		margin: 0;
		font-size: var(--text-xs);
		color: #94a3b8;
		line-height: 1.45;
	}
	.premium-specs-list {
		list-style: none;
		padding: 0;
		margin: 0.3rem 0 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.72rem;
		color: #cbd5e1;
	}
	.premium-specs-list code {
		color: #fbbf24;
		background: rgba(251, 191, 36, 0.1);
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
	}
</style>

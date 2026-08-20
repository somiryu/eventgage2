<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { subscribeToEventActivity } from '$lib/client/supabaseClient';
	import QRCode from 'qrcode';

	const { data } = $props();

	// URL de firma: siempre la misma base donde esté corriendo el servidor
	// (localhost en dev, el dominio real en Netlify) — nunca hardcodeada.
	let showQrModal = $state(false);
	let qrDataUrl = $state('');
	let treatyUrl = $derived(`${page.url.origin}/${data.event?.slug}/firmar-tratado`);

	async function openQrModal() {
		showQrModal = true;
		qrDataUrl = await QRCode.toDataURL(treatyUrl, { width: 320, margin: 1 });
	}

	let activityFeed = $state<any[]>([]);
	$effect(() => {
		activityFeed = data.activityFeed || [];
	});

	function describeActivity(entry: any): string {
		if (entry.type === 'item_unlocked_globally') return `¡Toda la comunidad desbloqueó "${entry.payload?.itemName}"!`;
		if (entry.type === 'contact_scanned') return `${entry.payload?.scannerName || 'Un agente'} sumó un nuevo contacto a su red.`;
		if (entry.type === 'milestone_reached') return `🏆 ${entry.payload?.playerName || 'Un agente'} alcanzó el Rango "${entry.payload?.rankTitle}".`;
		if (entry.type === 'faction_lead_change') return `⚡ ¡${entry.payload?.factionName} tomó la delantera!`;
		if (entry.type === 'ai_prompt_highlight') return `✨ ${entry.payload?.playerName || 'Un agente'} recibió una evaluación destacada de GIOCCHI en "${entry.payload?.missionTitle}".`;
		if (entry.type === 'treaty_signed') return `🏛️ ${entry.payload?.playerName || 'Un agente'} firmó el Tratado Huizinga.`;
		if (entry.type === 'gm_alert') return entry.payload?.message || 'Transmisión del Game Master.';
		return 'Nueva actividad registrada.';
	}

	// Auto-reload cada 3 minutos (poll de baja frecuencia, no cada campo
	// necesita ser instantáneo en una pantalla proyectada) + botón de
	// refresco manual para forzarlo. El feed de actividad sigue siendo en
	// vivo aparte, vía el canal de Realtime Broadcast (ver más abajo).
	let refreshing = $state(false);
	async function manualRefresh() {
		refreshing = true;
		try {
			await invalidateAll();
		} finally {
			refreshing = false;
		}
	}
	$effect(() => {
		const interval = setInterval(() => invalidateAll(), 3 * 60 * 1000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		const eventId = data.event?.id;
		if (!eventId) return;
		const unsubscribe = subscribeToEventActivity(eventId, (activity) => {
			activityFeed = [{ type: activity.type, payload: activity, created_at: new Date().toISOString() }, ...activityFeed].slice(0, 12);
		});
		return unsubscribe;
	});

	const inerciaPct = $derived.by(() => {
		const p = data.eventPoints;
		if (!p || !p.max_points) return 0;
		return Math.max(0, Math.min(100, Math.round((p.current_points / p.max_points) * 100)));
	});

	// Mismo criterio que [event_slug]/+page.svelte: el color es identidad de
	// facción (por posición en el catálogo), no cambia según el ranking.
	const FACTION_COLORS = ['#22d3ee', '#f472b6', '#fb923c', '#a78bfa'];
	const factionsWithColor = $derived(
		(data.factions || []).map((f: any, idx: number) => ({ ...f, color: FACTION_COLORS[idx % FACTION_COLORS.length] }))
	);
	const sortedFactions = $derived(
		[...factionsWithColor].sort((a: any, b: any) => (b.faction_points || 0) - (a.faction_points || 0))
	);
	function factionOf(factionId: string) {
		return factionsWithColor.find((f: any) => f.id === factionId);
	}
	function honorBadge(rank: number): string {
		return rank >= 5 ? 'Agente Master Huizinga' : 'Llave PRIME';
	}
</script>

<svelte:head>
	<title>{data.event?.title} — Tablero Global</title>
</svelte:head>

<div class="dashboard">
	<header class="dash-header">
		<button class="qr-btn" onclick={openQrModal} title="Generar QR para firmar el Tratado" aria-label="Generar QR para firmar el Tratado">
			📜 Generar QR para firma
		</button>
		<button class="refresh-btn" onclick={manualRefresh} disabled={refreshing} title="Actualizar ahora" aria-label="Actualizar ahora">
			<span class:spin={refreshing}>⟳</span>
		</button>
		<h1>{data.event?.title}</h1>
		<p class="dash-sub">Tablero de Estado Global — Transmisión en Vivo</p>
	</header>

	{#if showQrModal}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="qr-overlay" onclick={() => (showQrModal = false)} role="presentation">
			<div class="qr-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
				<h2>Firma el Tratado Huizinga</h2>
				<p>Escanea con tu móvil (debes estar registrado en la Agencia).</p>
				{#if qrDataUrl}
					<img src={qrDataUrl} alt="Código QR para firmar el Tratado Huizinga" />
				{/if}
				<p class="qr-url">{treatyUrl}</p>
				<button class="close-btn" onclick={() => (showQrModal = false)}>Cerrar</button>
			</div>
		</div>
	{/if}

	<!-- Dos columnas: el Hall a la izquierda ocupa toda la altura disponible
	     (su propia lista interna hace scroll si hace falta, sin desplazar la
	     columna derecha); Inercia + Facciones + Feed a la derecha, apiladas. -->
	<div class="dashboard-body">
		<section class="hof-panel">
			<h2>Hall de la Fama — Precedencia de Honor {#if (data.hallOfFame || []).length}({data.hallOfFame.length}){/if}</h2>
			{#if (data.hallOfFame || []).length > 0}
				<div class="hof-list">
					{#each data.hallOfFame as player}
						{@const fac = factionOf(player.faction_id)}
						<div class="hof-card" style="border-color: {fac?.color || '#818cf8'}">
							<span class="hof-badge">{honorBadge(player.rank)}</span>
							<strong class="hof-name">{player.name}</strong>
							<span class="hof-meta">
								<span class="hof-dot" style="background: {fac?.color || '#818cf8'}"></span>
								{fac?.name || player.faction_id} · {player.rank_title}
							</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="hof-empty">Todavía nadie alcanzó la Llave PRIME o el Rango Master.</p>
			{/if}
		</section>

		<div class="dashboard-side">
			<section class="inercia-panel">
				<div class="inercia-label">
					<span>{data.eventPoints?.display_name || 'Inercia Global'}</span>
					<strong>{data.eventPoints?.current_points ?? '—'} / {data.eventPoints?.max_points ?? '—'}</strong>
				</div>
				<div class="inercia-bar-track">
					<div class="inercia-bar-fill" style="width: {inerciaPct}%"></div>
				</div>
			</section>

			<section class="factions-panel">
				<h2>Ranking de Facciones</h2>
				<div class="factions-list">
					{#each sortedFactions as f, i}
						<div class="faction-row">
							<span class="faction-rank">{i + 1}</span>
							<span class="faction-dot" style="background: {f.color || '#6366f1'}"></span>
							<span class="faction-name">{f.name}</span>
							<span class="faction-points">{f.faction_points ?? 0} pt</span>
						</div>
					{/each}
				</div>
			</section>

			<section class="treaty-panel">
				<h2>Tratado Huizinga — Firmantes ({data.treaty?.count ?? 0})</h2>
				{#if (data.treaty?.signatures || []).length > 0}
					<div class="treaty-list">
						{#each data.treaty.signatures as sig}
							<span class="treaty-chip" class:precedence={sig.rank >= 3}>
								{#if sig.rank >= 3}★{/if} {sig.name}
							</span>
						{/each}
					</div>
				{:else}
					<p class="treaty-empty">Nadie ha firmado el Tratado todavía.</p>
				{/if}
			</section>

			<section class="feed-panel">
				<h2>Transmisiones Recientes</h2>
				{#if activityFeed.length > 0}
					<div class="feed-list">
						{#each activityFeed as entry}
							<p class="feed-entry">{describeActivity(entry)}</p>
						{/each}
					</div>
				{:else}
					<p class="feed-empty">Sin transmisiones registradas todavía.</p>
				{/if}
			</section>
		</div>
	</div>
</div>

<style>
	.dashboard {
		max-width: 1400px;
		margin: 0 auto;
		padding: 3rem 2rem;
		min-height: 100vh;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}
	.dash-header { text-align: center; position: relative; }
	.dash-header h1 { font-size: clamp(1.75rem, 4vw, 3rem); margin: 0; }
	.dash-sub { color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.9rem; margin-top: 0.5rem; }
	.refresh-btn {
		position: absolute; top: 0; right: 0;
		background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
		color: #e2e8f0; border-radius: 999px; width: 2.75rem; height: 2.75rem;
		font-size: 1.4rem; cursor: pointer; line-height: 1;
	}
	.refresh-btn:disabled { opacity: 0.5; cursor: default; }
	.refresh-btn .spin { display: inline-block; animation: spin 0.8s linear infinite; }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

	.qr-btn {
		position: absolute; top: 0; left: 0;
		background: rgba(129,140,248,0.12); border: 1px solid rgba(129,140,248,0.35);
		color: #c7d2fe; border-radius: 999px; padding: 0.6rem 1.1rem;
		font-size: 0.85rem; font-weight: 600; cursor: pointer;
	}
	.qr-btn:hover { background: rgba(129,140,248,0.22); }

	.qr-overlay {
		position: fixed; inset: 0; background: rgba(0,0,0,0.7);
		display: flex; align-items: center; justify-content: center;
		z-index: 50; padding: 1.5rem;
	}
	.qr-card {
		background: #0b0f1a; border: 1px solid rgba(255,255,255,0.12);
		border-radius: 1rem; padding: 2rem; text-align: center; max-width: 380px;
	}
	.qr-card h2 { margin: 0 0 0.5rem 0; font-size: 1.2rem; }
	.qr-card p { color: #94a3b8; font-size: 0.9rem; margin: 0 0 1rem 0; }
	.qr-card img { width: 100%; max-width: 280px; border-radius: 0.5rem; background: white; padding: 0.75rem; }
	.qr-url { word-break: break-all; font-size: 0.75rem; color: #64748b; margin-top: 1rem !important; }
	.close-btn {
		margin-top: 1.25rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
		color: #e2e8f0; border-radius: 0.5rem; padding: 0.55rem 1.5rem; cursor: pointer;
	}

	.treaty-panel h2 { font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 1rem; }
	.treaty-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
	.treaty-chip {
		background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
		border-radius: 999px; padding: 0.35rem 0.9rem; font-size: 0.85rem; color: #cbd5e1;
	}
	.treaty-chip.precedence { border-color: #fbbf24; color: #fde68a; background: rgba(251,191,36,0.08); }
	.treaty-empty { color: #64748b; font-size: 0.95rem; margin: 0; }

	/* Dos columnas: el Hall (izquierda) se estira a la misma altura que la
	   columna derecha (Inercia + Facciones + Feed apiladas) — su lista interna
	   es la que hace scroll, la columna en sí nunca crece más que eso. */
	.dashboard-body {
		display: grid;
		grid-template-columns: minmax(280px, 1fr) minmax(320px, 1.4fr);
		gap: 2rem;
		align-items: stretch;
		flex: 1;
		min-height: 0;
	}
	.dashboard-side { display: flex; flex-direction: column; gap: 2rem; min-height: 0; }

	.hof-panel {
		display: flex; flex-direction: column; min-height: 0;
		background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
		border-radius: 0.85rem; padding: 1.25rem;
	}
	.hof-panel h2 { font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em; color: #fbbf24; margin: 0 0 1rem 0; flex-shrink: 0; }
	.hof-empty { color: #64748b; font-size: 0.95rem; margin: 0; }
	/* Ocupa todo el alto disponible del panel; scroll propio si hay más
	   agentes de los que entran — escala a decenas sin desplazar la columna
	   derecha ni el resto de la página. */
	.hof-list {
		display: flex; flex-direction: column; gap: 0.6rem;
		flex: 1; min-height: 0; overflow-y: auto; padding-right: 0.4rem;
	}
	.hof-card {
		display: flex; flex-direction: column; align-items: flex-start; gap: 0.3rem;
		background: rgba(255,255,255,0.05); border: 1px solid; border-radius: 0.6rem;
		padding: 0.75rem 1rem; flex-shrink: 0;
	}
	.hof-badge { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: #fbbf24; font-weight: 700; }
	.hof-name { font-size: 1.1rem; }
	.hof-meta { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: #cbd5e1; }
	.hof-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; flex-shrink: 0; }

	.inercia-panel { display: flex; flex-direction: column; gap: 0.75rem; }
	.inercia-label { display: flex; justify-content: space-between; align-items: baseline; font-size: 1.25rem; }
	.inercia-bar-track { height: 1.5rem; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; }
	.inercia-bar-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #f97316); transition: width 0.6s ease; }

	.factions-panel h2, .feed-panel h2 { font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 1rem; }
	.factions-list { display: flex; flex-direction: column; gap: 0.6rem; }
	.faction-row {
		display: flex; align-items: center; gap: 1rem;
		background: rgba(255,255,255,0.04); border-radius: 0.6rem; padding: 0.9rem 1.2rem;
		font-size: 1.1rem;
	}
	.faction-rank { color: #64748b; font-weight: 700; width: 1.5rem; }
	.faction-dot { width: 0.9rem; height: 0.9rem; border-radius: 50%; flex-shrink: 0; }
	.faction-name { flex: 1; font-weight: 600; }
	.faction-points { color: #fbbf24; font-weight: 700; }

	.feed-list { display: flex; flex-direction: column; gap: 0.5rem; }
	.feed-entry { margin: 0; background: rgba(255,255,255,0.03); border-radius: 0.5rem; padding: 0.7rem 1rem; font-size: 0.95rem; color: #cbd5e1; }
	.feed-empty { color: #64748b; font-size: 0.95rem; }
</style>

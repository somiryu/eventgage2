<script lang="ts">
	import type { PageData } from './$types';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Diamond from '@lucide/svelte/icons/diamond';
	import Key from '@lucide/svelte/icons/key';
	import MapIcon from '@lucide/svelte/icons/map';
	import Radio from '@lucide/svelte/icons/radio';
	import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
	import ExternalLink from '@lucide/svelte/icons/external-link';

	import LeaderboardTab from '$lib/components/admin/LeaderboardTab.svelte';
	import MarketTab from '$lib/components/admin/MarketTab.svelte';
	import CodesTab from '$lib/components/admin/CodesTab.svelte';
	import MapsTab from '$lib/components/admin/MapsTab.svelte';
	import ChannelTab from '$lib/components/admin/ChannelTab.svelte';
	import AnalyticsTab from '$lib/components/admin/AnalyticsTab.svelte';

	let { data }: { data: PageData } = $props();

	// Control de navegación entre las funciones
	type TabType = 'leaderboard' | 'market' | 'codes' | 'maps' | 'channel' | 'analytics';
	let currentTab = $state<TabType>('leaderboard');

	// Feedback global y toasts
	let actionMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	function showMessage(type: 'success' | 'error', text: string) {
		actionMessage = { type, text };
		setTimeout(() => {
			if (actionMessage?.text === text) actionMessage = null;
		}, 4000);
	}

	// Estados sincronizados reactivamente
	let leaderboard = $state<any[]>([]);
	let factions = $state<any[]>([]);
	let rewards = $state<any[]>([]);
	let redemptions = $state<any[]>([]);
	let codes = $state<any[]>([]);
	let maps = $state<any[]>([]);
	let characters = $state<any[]>([]);
	let alerts = $state<any[]>([]);
	let refreshingLeaderboard = $state(false);

	$effect(() => {
		if (data.leaderboard) leaderboard = data.leaderboard;
		if (data.factions) factions = data.factions;
		if (data.rewards) rewards = data.rewards;
		if (data.redemptions) redemptions = data.redemptions;
		if (data.codes) codes = data.codes;
		if (data.maps) maps = data.maps;
		if (data.characters) characters = data.characters;
		if (data.alerts) alerts = data.alerts;
	});

	async function reloadLeaderboard() {
		refreshingLeaderboard = true;
		try {
			const res = await fetch(`/api/event/${data.event.slug}/admin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'get_leaderboard' })
			});
			const json = await res.json();
			if (json.success) {
				leaderboard = json.leaderboard;
				showMessage('success', 'Tabla de líderes actualizada en vivo');
			}
		} catch {
			showMessage('error', 'Error al refrescar tabla de líderes');
		} finally {
			refreshingLeaderboard = false;
		}
	}

	function handleRewardCreated(newReward: any) {
		rewards = [newReward, ...rewards];
	}

	function handleCodeCreated(newCode: any) {
		codes = [newCode, ...codes];
	}

	function handleMapSaved(savedMap: any) {
		const idx = maps.findIndex((m) => m.id === savedMap.id);
		if (idx >= 0) {
			maps[idx] = savedMap;
			maps = [...maps];
		} else {
			maps = [...maps, savedMap];
		}
	}

	function handleHotspotToggled(mapId: string, hotspotId: string, isActive: boolean) {
		maps = maps.map((m) => {
			if (m.id !== mapId) return m;
			return {
				...m,
				hotspots: (m.hotspots || []).map((hs: any) =>
					hs.id === hotspotId ? { ...hs, is_active: isActive } : hs
				)
			};
		});
	}

	function handleCharacterCreated(newChar: any) {
		characters = [...characters, newChar];
	}

	function handleAlertSent(newAlert: any) {
		alerts = [newAlert, ...alerts];
	}
</script>

<svelte:head>
	<title>Consola de Game Masters | {data.event.name}</title>
</svelte:head>

<div class="gm-app-container">
	<!-- HEADER CENTRAL DE OPERACIONES -->
	<header class="gm-topbar">
		<div class="gm-topbar-left">
			<span class="badge-role">PRIME COMMAND</span>
			<h1 class="gm-title">Consola de Game Masters</h1>
			<p class="gm-sub">{data.event.name} • Control Central de Operaciones</p>
		</div>
		<div class="gm-topbar-right">
			<a href="/{data.event.slug}" class="secondary-btn link-to-hud" target="_blank" rel="noopener noreferrer">
				<span>Ver Juego</span>
				<ExternalLink size={14} />
			</a>
		</div>
	</header>

	<!-- TOAST FLOTANTE -->
	{#if actionMessage}
		<div class="toast-message toast-{actionMessage.type}" role="status" aria-live="polite">
			{actionMessage.text}
		</div>
	{/if}

	<!-- CONTENIDO MODULAR POR PESTAÑA -->
	<main class="gm-main-content">
		{#if currentTab === 'leaderboard'}
			<LeaderboardTab
				{leaderboard}
				{factions}
				slug={data.event.slug}
				onRefresh={reloadLeaderboard}
				refreshing={refreshingLeaderboard}
			/>
		{:else if currentTab === 'market'}
			<MarketTab
				{rewards}
				{redemptions}
				slug={data.event.slug}
				onRewardCreated={handleRewardCreated}
				{showMessage}
			/>
		{:else if currentTab === 'codes'}
			<CodesTab
				{codes}
				slug={data.event.slug}
				onCodeCreated={handleCodeCreated}
				{showMessage}
			/>
		{:else if currentTab === 'maps'}
			<MapsTab
				{maps}
				missions={data.missions}
				slug={data.event.slug}
				onMapSaved={handleMapSaved}
				onHotspotToggled={handleHotspotToggled}
				{showMessage}
			/>
		{:else if currentTab === 'channel'}
			<ChannelTab
				{characters}
				{alerts}
				slug={data.event.slug}
				onAlertSent={handleAlertSent}
				onCharacterCreated={handleCharacterCreated}
				{showMessage}
			/>
		{:else if currentTab === 'analytics'}
			<AnalyticsTab
				slug={data.event.slug}
				{showMessage}
			/>
		{/if}
	</main>

	<!-- NAVEGACIÓN INFERIOR (6 FUNCIONES) -->
	<nav class="gm-bottom-nav" aria-label="Navegación del Game Master">
		<button
			class="nav-item {currentTab === 'leaderboard' ? 'active' : ''}"
			onclick={() => (currentTab = 'leaderboard')}
		>
			<Trophy size={20} />
			<span>Líderes</span>
		</button>

		<button
			class="nav-item {currentTab === 'market' ? 'active' : ''}"
			onclick={() => (currentTab = 'market')}
		>
			<Diamond size={20} />
			<span>Mercado</span>
		</button>

		<button
			class="nav-item {currentTab === 'codes' ? 'active' : ''}"
			onclick={() => (currentTab = 'codes')}
		>
			<Key size={20} />
			<span>Códigos</span>
		</button>

		<button
			class="nav-item {currentTab === 'maps' ? 'active' : ''}"
			onclick={() => (currentTab = 'maps')}
		>
			<MapIcon size={20} />
			<span>Mapas</span>
		</button>

		<button
			class="nav-item {currentTab === 'channel' ? 'active' : ''}"
			onclick={() => (currentTab = 'channel')}
		>
			<Radio size={20} />
			<span>Canal</span>
		</button>

		<button
			class="nav-item {currentTab === 'analytics' ? 'active' : ''}"
			onclick={() => (currentTab = 'analytics')}
		>
			<BarChart3 size={20} />
			<span>Analíticas</span>
		</button>
	</nav>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: #0b0f19;
		color: #f1f5f9;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		-webkit-tap-highlight-color: transparent;
	}

	.gm-app-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background: radial-gradient(circle at 50% 0%, #172033 0%, #0b0f19 80%);
		padding-bottom: 5.5rem;
		box-sizing: border-box;
	}

	.gm-topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		background: rgba(15, 23, 42, 0.85);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		position: sticky;
		top: 0;
		z-index: 50;
	}

	.badge-role {
		display: inline-block;
		font-size: var(--text-xs, 0.75rem);
		font-weight: 800;
		letter-spacing: 0.1em;
		background: rgba(99, 102, 241, 0.2);
		color: #a5b4fc;
		border: 1px solid rgba(99, 102, 241, 0.4);
		padding: 0.2rem 0.6rem;
		border-radius: var(--radius-pill, 9999px);
		margin-bottom: 0.35rem;
	}

	.gm-title {
		margin: 0;
		font-size: var(--text-xl, 1.25rem);
		font-weight: 800;
		color: #f8fafc;
	}

	.gm-sub {
		margin: 0.15rem 0 0 0;
		font-size: var(--text-xs, 0.75rem);
		color: #94a3b8;
	}

	.link-to-hud {
		text-decoration: none;
	}

	.gm-main-content {
		flex: 1;
		padding: 1.5rem 1.25rem;
		max-width: 1100px;
		width: 100%;
		margin: 0 auto;
		box-sizing: border-box;
	}

	.toast-message {
		position: fixed;
		top: 5rem;
		right: 1.5rem;
		z-index: 99;
		padding: 0.75rem 1.25rem;
		border-radius: var(--radius-md, 8px);
		font-size: var(--text-sm, 0.875rem);
		font-weight: 700;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
		animation: slide-toast 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.toast-success {
		background: #10b981;
		color: #fff;
	}

	.toast-error {
		background: #ef4444;
		color: #fff;
	}

	@keyframes slide-toast {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* NAVEGACIÓN INFERIOR (ESTILO MOBILE FIRST / HUD) */
	.gm-bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: 4.25rem;
		background: rgba(15, 23, 42, 0.95);
		backdrop-filter: blur(16px);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		justify-content: space-around;
		align-items: center;
		z-index: 60;
		padding: 0 0.5rem;
	}

	.nav-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		background: none;
		border: none;
		color: #64748b;
		cursor: pointer;
		padding: 0.4rem;
		border-radius: var(--radius-md, 8px);
		transition: all 0.2s ease;
		font-size: 0.7rem;
		font-weight: 700;
	}

	.nav-item:hover {
		color: #cbd5e1;
	}

	.nav-item.active {
		color: #818cf8;
	}

	.secondary-btn {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #e2e8f0;
		padding: 0.55rem 0.9rem;
		border-radius: var(--radius-md, 8px);
		font-weight: 600;
		font-size: var(--text-sm, 0.875rem);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		transition: all 0.2s ease;
	}

	.secondary-btn:hover {
		background: rgba(255, 255, 255, 0.15);
	}
</style>

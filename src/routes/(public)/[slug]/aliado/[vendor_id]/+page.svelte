<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolveEventTheme } from '$lib/eventCopy';

	let { data } = $props();

	const theme = $derived(resolveEventTheme({ config: { theme: data.event.theme } }));
	const stop = $derived(data.stop);
	const successRate = $derived(stop.completions ? Math.round((stop.successes / stop.completions) * 100) : null);
	const reachPct = $derived(data.totalPlayers ? Math.round((stop.visits / data.totalPlayers) * 100) : 0);
	const factionRows = $derived(
		data.factions.map((f: any) => ({
			...f,
			count: stop.byFaction[f.id] || 0,
			color: data.factionColors[f.id] || '#94a3b8'
		}))
	);
	const maxFaction = $derived(Math.max(1, ...factionRows.map((f: any) => f.count)));
	const hours = $derived(Object.entries(stop.byHour).sort(([a], [b]) => a.localeCompare(b)) as [string, number][]);
	const maxHour = $derived(Math.max(1, ...hours.map(([, c]) => c)));

	function formatTime(iso: string | null) {
		if (!iso) return '—';
		return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso));
	}

	// Datos en vivo sin websockets: se recarga el load cada 60 s mientras la
	// pestaña está abierta.
	$effect(() => {
		const id = setInterval(() => invalidateAll(), 60_000);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<title>{stop.vendorName} · {data.event.title}</title>
	<meta name="robots" content="noindex" />
	{#if theme.fontHref}<link rel="stylesheet" href={theme.fontHref} />{/if}
	{#if theme.css}{@html `<style>${theme.css}</style>`}{/if}
</svelte:head>

<main class="panel">
	<header class="panel-header">
		<span class="kicker">PANEL DEL ALIADO · {data.event.title}</span>
		<h1>{stop.vendorName}</h1>
		<p class="sub">Parada {stop.n} de {data.totalStops}{stop.tagline ? ` · ${stop.tagline}` : ''}</p>
	</header>

	<section class="kpis">
		<div class="kpi">
			<span class="kpi-label">Visitas</span>
			<strong class="kpi-value">{stop.visits}</strong>
			<span class="kpi-hint">jugadores canjearon tu código</span>
		</div>
		<div class="kpi">
			<span class="kpi-label">Alcance</span>
			<strong class="kpi-value">{reachPct}%</strong>
			<span class="kpi-hint">de {data.totalPlayers} jugadores del evento</span>
		</div>
		<div class="kpi">
			<span class="kpi-label">Retos jugados</span>
			<strong class="kpi-value">{stop.completions}</strong>
			<span class="kpi-hint">{successRate === null ? 'aún sin intentos' : `${successRate}% los superó`}</span>
		</div>
		<div class="kpi">
			<span class="kpi-label">Posición</span>
			<strong class="kpi-value">#{data.rank ?? '—'}</strong>
			<span class="kpi-hint">en visitas entre {data.totalStops} paradas</span>
		</div>
	</section>

	<div class="grid">
		<section class="card">
			<h2>Visitas por clan</h2>
			{#each factionRows as f (f.id)}
				<div class="bar-row">
					<span class="bar-label"><i style="background: {f.color}"></i>{f.name}</span>
					<div class="bar-track"><div class="bar-fill" style="width: {(f.count / maxFaction) * 100}%; background: {f.color}"></div></div>
					<span class="bar-val">{f.count}</span>
				</div>
			{/each}
		</section>

		<section class="card">
			<h2>Visitas por hora</h2>
			{#if hours.length === 0}
				<p class="empty">Todavía no hay visitas registradas. Aparecerán aquí en cuanto alguien canjee tu código.</p>
			{:else}
				<div class="hours">
					{#each hours as [hour, count] (hour)}
						<div class="hour-col" title="{count} visitas a las {hour}">
							<span class="hour-count">{count}</span>
							<div class="hour-bar" style="height: {(count / maxHour) * 100}%"></div>
							<span class="hour-label">{hour.slice(0, 2)}h</span>
						</div>
					{/each}
				</div>
			{/if}
			<p class="meta">Última visita: {formatTime(stop.lastVisitAt)}</p>
		</section>

		<section class="card code-card">
			<h2>Tu código de guarida</h2>
			{#if stop.code}
				<strong class="code">{stop.code}</strong>
				{#if data.qrDataUrl}
					<img src={data.qrDataUrl} alt="QR que abre la ruta con el código {stop.code}" class="qr" />
				{/if}
				<p class="meta">Dáselo a quien juegue en tu stand, o deja el QR impreso: al escanearlo se canjea solo.</p>
			{:else}
				<p class="empty">Esta parada aún no tiene código asignado.</p>
			{/if}
		</section>
	</div>

	<footer class="foot">
		Solo se muestran datos agregados; ningún dato personal de los jugadores.
		Se actualiza cada minuto · {formatTime(data.generatedAt)}
	</footer>
</main>

<style>
	.panel {
		max-width: 980px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
		box-sizing: border-box;
		background: var(--bg-app, #05070d);
		min-height: 100vh;
	}
	.panel-header h1 {
		margin: 0.3rem 0 0.2rem;
		font-family: var(--font-display, inherit);
		font-size: clamp(1.6rem, 5vw, 2.4rem);
		color: #f8fafc;
	}
	.kicker {
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		font-weight: 800;
		color: var(--accent-soft, #818cf8);
	}
	.sub {
		margin: 0;
		color: #94a3b8;
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.75rem;
		margin: 1.5rem 0;
	}
	.kpi,
	.card {
		background: rgba(var(--panel-rgb, 30, 41, 59), 0.6);
		border: 1px solid rgba(var(--accent-rgb, 99, 102, 241), 0.25);
		border-radius: 0.9rem;
		padding: 1rem;
	}
	.kpi {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.kpi-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #94a3b8;
		font-weight: 700;
	}
	.kpi-value {
		font-size: 2.2rem;
		color: var(--accent-soft, #818cf8);
		font-variant-numeric: tabular-nums;
	}
	.kpi-hint {
		font-size: 0.75rem;
		color: #cbd5e1;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 0.75rem;
	}
	.card h2 {
		margin: 0 0 0.9rem;
		font-size: 1rem;
		font-family: var(--font-display, inherit);
		color: #f8fafc;
	}
	.bar-row {
		display: grid;
		grid-template-columns: minmax(0, 9rem) 1fr 2rem;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.55rem;
		font-size: 0.8rem;
	}
	.bar-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.bar-label i {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: none;
	}
	.bar-track {
		height: 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.07);
		overflow: hidden;
	}
	.bar-fill {
		height: 100%;
		border-radius: 999px;
		min-width: 2px;
	}
	.bar-val {
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}
	.hours {
		display: flex;
		align-items: flex-end;
		gap: 0.35rem;
		height: 140px;
		overflow-x: auto;
	}
	.hour-col {
		flex: 1 0 28px;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		gap: 0.2rem;
	}
	.hour-bar {
		width: 100%;
		min-height: 3px;
		border-radius: 4px 4px 0 0;
		background: linear-gradient(180deg, var(--accent-soft, #818cf8), var(--accent, #6366f1));
	}
	.hour-count,
	.hour-label {
		font-size: 0.65rem;
		color: #94a3b8;
		font-variant-numeric: tabular-nums;
	}
	.code-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	.code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 1.8rem;
		letter-spacing: 0.08em;
		color: #f8fafc;
	}
	.qr {
		width: 180px;
		height: 180px;
		margin: 0.75rem 0;
		border-radius: 0.5rem;
		background: #fff;
		padding: 6px;
	}
	.meta,
	.empty {
		margin: 0.6rem 0 0;
		font-size: 0.78rem;
		color: #94a3b8;
		line-height: 1.45;
	}
	.foot {
		margin-top: 1.5rem;
		font-size: 0.72rem;
		color: #64748b;
		text-align: center;
	}
</style>

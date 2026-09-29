<script lang="ts">
	let { data } = $props();
	let copiedId = $state<string | null>(null);

	async function copyLink(id: string, link: string) {
		try {
			await navigator.clipboard.writeText(link);
			copiedId = id;
			setTimeout(() => (copiedId = null), 1500);
		} catch {
			copiedId = null;
		}
	}
</script>

<svelte:head>
	<title>Aliados · {data.event.title}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="sheet">
	<header class="no-print">
		<h1>Aliados de la ruta — {data.event.title}</h1>
		<p>
			{data.stops.length} paradas · {data.totalPlayers} jugadores registrados. Cada tarjeta tiene el código del stand, su QR
			(abre la ruta y canjea el código) y el enlace privado al panel del aliado. Imprime esta página para tener los QR.
		</p>
		<button type="button" onclick={() => window.print()}>Imprimir QR</button>
	</header>

	<div class="cards">
		{#each data.stops as s (s.missionId)}
			<article class="card">
				<div class="card-head">
					<span class="n">{s.n}</span>
					<div>
						<h2>{s.vendorName}</h2>
						<span class="stats no-print">{s.visits} visitas · {s.completions} retos</span>
					</div>
				</div>
				{#if s.qrDataUrl}
					<img src={s.qrDataUrl} alt="QR de {s.vendorName}" class="qr" />
				{/if}
				<strong class="code">{s.code ?? 'sin código'}</strong>
				<div class="links no-print">
					{#if s.panelLink}
						<a href={s.panelLink} target="_blank" rel="noopener">Abrir panel del aliado</a>
						<button type="button" onclick={() => copyLink(s.missionId, s.panelLink!)}>
							{copiedId === s.missionId ? '¡Copiado!' : 'Copiar enlace'}
						</button>
					{:else}
						<span class="warn">Sin aliado vinculado</span>
					{/if}
				</div>
			</article>
		{/each}
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0b0f19;
		color: #e2e8f0;
		font-family: system-ui, -apple-system, sans-serif;
	}
	.sheet {
		max-width: 1100px;
		margin: 0 auto;
		padding: 1.5rem 1rem 3rem;
	}
	h1 {
		margin: 0 0 0.4rem;
		font-size: 1.4rem;
	}
	header p {
		margin: 0 0 0.8rem;
		color: #94a3b8;
		font-size: 0.9rem;
		line-height: 1.5;
	}
	button {
		background: #f59e0b;
		color: #1c0f0a;
		border: none;
		border-radius: 0.5rem;
		padding: 0.45rem 0.8rem;
		font-weight: 700;
		cursor: pointer;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 0.8rem;
		margin-top: 1.2rem;
	}
	.card {
		background: #151b2b;
		border: 1px solid #263048;
		border-radius: 0.8rem;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		break-inside: avoid;
	}
	.card-head {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		width: 100%;
	}
	.n {
		flex: none;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: #f59e0b;
		color: #1c0f0a;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
	}
	h2 {
		margin: 0;
		font-size: 1rem;
	}
	.stats {
		font-size: 0.75rem;
		color: #94a3b8;
	}
	.qr {
		width: 170px;
		height: 170px;
		background: #fff;
		border-radius: 0.4rem;
		padding: 4px;
	}
	.code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 1.2rem;
		letter-spacing: 0.06em;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		justify-content: center;
		font-size: 0.8rem;
	}
	.links a {
		color: #fbbf24;
	}
	.warn {
		color: #f87171;
	}
	@media print {
		:global(body) {
			background: #fff;
			color: #000;
		}
		.no-print {
			display: none !important;
		}
		.card {
			background: #fff;
			border: 1px dashed #999;
			color: #000;
		}
	}
</style>

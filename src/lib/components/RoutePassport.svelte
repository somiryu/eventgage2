<script lang="ts">
	// Pasaporte de una ruta de stands (config.passport del evento): una
	// casilla por parada con su estado real para el jugador —
	//   'done'     → misión de la parada completada (ítem/escama obtenido)
	//   'unlocked' → código del stand canjeado, reto pendiente
	//   'locked'   → todavía no visitó el stand
	// El estado sale de `missions` (ya calculado por la página con
	// unlocked/completed), nunca de un conteo paralelo.
	import Lock from '@lucide/svelte/icons/lock';
	import Check from '@lucide/svelte/icons/check';
	import Stamp from '@lucide/svelte/icons/stamp';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import X from '@lucide/svelte/icons/x';

	interface PassportStop {
		n: number;
		vendor: string;
		mission_id: string;
		item_id?: string;
		image_url?: string | null;
		stand?: string | null;
	}

	interface Props {
		passport: { title?: string; subtitle?: string; stops: PassportStop[] };
		vendors: any[];
		missions: any[];
		itemLabel?: string;
		onOpenMission: (mission: any) => void;
	}

	let { passport, vendors = [], missions = [], itemLabel = 'escamas', onOpenMission }: Props = $props();

	const vendorByName = $derived(new Map(vendors.map((v: any) => [v.name, v])));
	const missionById = $derived(new Map(missions.map((m: any) => [m.id, m])));

	const stops = $derived(
		(passport?.stops || []).map((stop) => {
			const mission = missionById.get(stop.mission_id);
			const state: 'done' | 'unlocked' | 'locked' = mission?.completed
				? 'done'
				: mission?.unlocked
					? 'unlocked'
					: 'locked';
			return { ...stop, mission, state, vendorInfo: vendorByName.get(stop.vendor) };
		})
	);

	const doneCount = $derived(stops.filter((s) => s.state === 'done').length);
	const progressPct = $derived(stops.length ? Math.round((doneCount / stops.length) * 100) : 0);

	let selected = $state<(typeof stops)[number] | null>(null);

	function openStop(stop: (typeof stops)[number]) {
		selected = stop;
	}

	function handleChallenge() {
		if (!selected?.mission) return;
		const mission = selected.mission;
		selected = null;
		onOpenMission(mission);
	}
</script>

<section class="passport">
	<header class="passport-header">
		<div class="passport-title">
			<Stamp size={20} />
			<div>
				<h2>{passport.title || 'Pasaporte'}</h2>
				{#if passport.subtitle}<p>{passport.subtitle}</p>{/if}
			</div>
		</div>
		<div class="passport-count mono">
			<strong>{doneCount}</strong>/{stops.length}
			<span>{itemLabel}</span>
		</div>
	</header>

	<div class="passport-progress" aria-hidden="true">
		<div class="passport-progress-fill" style="width: {progressPct}%"></div>
	</div>

	<div class="passport-grid">
		{#each stops as stop (stop.n)}
			<button
				type="button"
				class="stop {stop.state}"
				onclick={() => openStop(stop)}
				aria-label="Guarida {stop.n}: {stop.vendor} — {stop.state === 'done'
					? 'obtenida'
					: stop.state === 'unlocked'
						? 'reto pendiente'
						: 'por visitar'}"
			>
				<div class="stop-img-wrap">
					{#if stop.image_url}
						<img src={stop.image_url} alt="" class="stop-img" loading="lazy" />
					{/if}
					<span class="stop-n mono">{stop.n}</span>
					<span class="stop-state">
						{#if stop.state === 'done'}
							<Check size={14} strokeWidth={3} />
						{:else if stop.state === 'locked'}
							<Lock size={12} />
						{:else}
							!
						{/if}
					</span>
				</div>
				<span class="stop-name">{stop.vendor}</span>
			</button>
		{/each}
	</div>

	<p class="passport-legend">
		<span class="dot done"></span> Obtenida
		<span class="dot unlocked"></span> Reto pendiente
		<span class="dot locked"></span> Por visitar
	</p>
</section>

{#if selected}
	<div
		class="stop-sheet-overlay"
		role="button"
		tabindex="0"
		onclick={() => (selected = null)}
		onkeydown={(e) => {
			if (e.key === 'Escape') selected = null;
		}}
	>
		<div
			class="stop-sheet"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<button type="button" class="sheet-close" onclick={() => (selected = null)} aria-label="Cerrar">
				<X size={18} />
			</button>
			{#if selected.image_url}
				<img src={selected.image_url} alt="" class="sheet-img {selected.state}" />
			{/if}
			<span class="sheet-kicker mono">GUARIDA {selected.n}{selected.stand ? ` · STAND ${selected.stand}` : ''}</span>
			<h3>{selected.vendor}</h3>
			{#if selected.vendorInfo?.tagline}
				<p class="sheet-tagline">{selected.vendorInfo.tagline}</p>
			{/if}
			{#if selected.vendorInfo?.description}
				<p class="sheet-desc">{selected.vendorInfo.description}</p>
			{/if}

			<div class="sheet-status {selected.state}">
				{#if selected.state === 'done'}
					<Check size={16} /> Escama recuperada. ¡Esta guarida ya es parte de tu crónica!
				{:else if selected.state === 'unlocked'}
					Ya tienes el código de esta guarida: te falta superar su reto.
				{:else}
					<Lock size={14} /> Visita el stand y pide el código a sus guardianes.
				{/if}
			</div>

			{#if selected.state === 'unlocked' && selected.mission}
				<button type="button" class="primary-btn sheet-cta" onclick={handleChallenge}>Enfrentar el reto ➔</button>
			{/if}
			{#if selected.vendorInfo?.website_url}
				<a class="sheet-link" href={selected.vendorInfo.website_url} target="_blank" rel="noopener noreferrer">
					Visitar sitio <ExternalLink size={13} />
				</a>
			{/if}
		</div>
	</div>
{/if}

<style>
	.passport {
		background: rgba(var(--panel-rgb, 30, 41, 59), 0.55);
		border: 1px solid rgba(var(--accent-rgb, 99, 102, 241), 0.35);
		border-radius: var(--radius-lg, 0.85rem);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}
	.passport-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
	}
	.passport-title {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		color: var(--accent-soft, #818cf8);
	}
	.passport-title h2 {
		margin: 0;
		font-size: var(--text-xl, 1.15rem);
		font-family: var(--font-display, inherit);
		color: #f8fafc;
	}
	.passport-title p {
		margin: 0.2rem 0 0;
		font-size: var(--text-sm, 0.7rem);
		color: #cbd5e1;
		line-height: 1.4;
	}
	.passport-count {
		text-align: right;
		color: #94a3b8;
		font-size: var(--text-md, 0.85rem);
		white-space: nowrap;
	}
	.passport-count strong {
		font-size: 1.6rem;
		color: var(--accent-soft, #818cf8);
	}
	.passport-count span {
		display: block;
		font-size: var(--text-xs, 0.65rem);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.passport-progress {
		height: 6px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}
	.passport-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--accent, #6366f1), var(--accent2, #a855f7));
		transition: width 0.5s ease-out;
	}
	.passport-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.6rem;
	}
	.stop {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0;
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		text-align: center;
		font: inherit;
	}
	.stop-img-wrap {
		position: relative;
		aspect-ratio: 1;
		border-radius: 50%;
		overflow: hidden;
		border: 3px solid rgba(255, 255, 255, 0.12);
		background: rgba(var(--panel-deep-rgb, 15, 23, 42), 0.9);
		transition: transform 0.2s ease, border-color 0.2s ease;
	}
	.stop:active .stop-img-wrap {
		transform: scale(0.95);
	}
	.stop-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.stop.locked .stop-img {
		filter: grayscale(1) brightness(0.35);
	}
	.stop.unlocked .stop-img {
		filter: grayscale(0.4) brightness(0.7);
	}
	.stop.unlocked .stop-img-wrap {
		border-color: var(--accent-soft, #818cf8);
		border-style: dashed;
	}
	.stop.done .stop-img-wrap {
		border-color: var(--accent, #6366f1);
		box-shadow: 0 0 14px rgba(var(--accent-rgb, 99, 102, 241), 0.55);
	}
	.stop-n {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.6rem;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.85);
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
	}
	.stop.done .stop-n {
		display: none;
	}
	.stop-state {
		position: absolute;
		right: 6%;
		bottom: 6%;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		font-weight: 800;
		background: rgba(0, 0, 0, 0.7);
		color: #cbd5e1;
	}
	.stop.done .stop-state {
		background: var(--accent, #6366f1);
		color: #fff;
	}
	.stop.unlocked .stop-state {
		background: var(--accent-soft, #818cf8);
		color: #111;
	}
	.stop-name {
		font-size: var(--text-xs, 0.65rem);
		font-weight: 700;
		line-height: 1.2;
		color: #cbd5e1;
		overflow-wrap: anywhere;
	}
	.stop.locked .stop-name {
		color: #64748b;
	}
	.passport-legend {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.8rem;
		align-items: center;
		font-size: var(--text-xs, 0.65rem);
		color: #94a3b8;
	}
	.dot {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		margin-right: -0.4rem;
	}
	.dot.done {
		background: var(--accent, #6366f1);
	}
	.dot.unlocked {
		border: 2px dashed var(--accent-soft, #818cf8);
		width: 5px;
		height: 5px;
	}
	.dot.locked {
		background: #475569;
	}

	.stop-sheet-overlay {
		position: fixed;
		inset: 0;
		z-index: 120;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.stop-sheet {
		position: relative;
		width: 100%;
		max-width: 480px;
		max-height: 88dvh;
		overflow-y: auto;
		box-sizing: border-box;
		background: linear-gradient(180deg, var(--panel, #1e293b) 0%, var(--panel-deep, #0f172a) 100%);
		border: 1px solid rgba(var(--accent-rgb, 99, 102, 241), 0.4);
		border-bottom: none;
		border-radius: 1.25rem 1.25rem 0 0;
		padding: 1.25rem 1.1rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		animation: sheetUp 0.25s ease-out;
	}
	@keyframes sheetUp {
		from {
			transform: translateY(30px);
			opacity: 0;
		}
	}
	.sheet-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		background: rgba(0, 0, 0, 0.5);
		border: none;
		color: #fff;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 1;
	}
	.sheet-img {
		width: 100%;
		height: 170px;
		object-fit: cover;
		border-radius: 0.75rem;
	}
	.sheet-img.locked {
		filter: grayscale(1) brightness(0.5);
	}
	.sheet-kicker {
		font-size: var(--text-xs, 0.65rem);
		letter-spacing: 0.1em;
		color: var(--accent-soft, #818cf8);
		font-weight: 700;
	}
	.stop-sheet h3 {
		margin: 0;
		font-size: 1.35rem;
		font-family: var(--font-display, inherit);
		color: #f8fafc;
	}
	.sheet-tagline {
		margin: 0;
		font-weight: 700;
		color: #e2e8f0;
		font-size: var(--text-md, 0.85rem);
	}
	.sheet-desc {
		margin: 0;
		color: #94a3b8;
		font-size: var(--text-base, 0.78rem);
		line-height: 1.45;
	}
	.sheet-status {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0.7rem 0.8rem;
		border-radius: 0.6rem;
		font-size: var(--text-base, 0.78rem);
		font-weight: 600;
		background: rgba(255, 255, 255, 0.05);
		color: #cbd5e1;
	}
	.sheet-status.done {
		background: rgba(16, 185, 129, 0.15);
		color: #6ee7b7;
	}
	.sheet-status.unlocked {
		background: rgba(var(--accent-rgb, 99, 102, 241), 0.15);
		color: var(--accent-pale, #a5b4fc);
	}
	.sheet-cta {
		width: 100%;
	}
	.sheet-link {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		color: var(--accent-soft, #818cf8);
		font-size: var(--text-md, 0.85rem);
		font-weight: 700;
		text-decoration: none;
	}
	.primary-btn {
		padding: 0.85rem 1rem;
		border: none;
		border-radius: 0.75rem;
		font-weight: 800;
		font-size: 1rem;
		color: #fff;
		cursor: pointer;
		background: linear-gradient(135deg, var(--accent, #6366f1), var(--accent2, #a855f7));
	}
</style>

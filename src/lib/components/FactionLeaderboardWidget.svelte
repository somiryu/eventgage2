<script lang="ts">
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';

	interface Faction {
		id: string;
		name: string;
		description?: string;
		image_url?: string;
		faction_points?: number;
	}

	interface Props {
		factions: Faction[];
		ownFactionId?: string | null;
		refreshing?: boolean;
		onRefresh?: () => void;
		onFactionClick?: (factionId: string) => void;
		title?: string;
		showRefresh?: boolean;
	}

	let {
		factions = [],
		ownFactionId = null,
		refreshing = false,
		onRefresh,
		onFactionClick,
		title = 'GREMIOS',
		showRefresh = true
	}: Props = $props();

	const FACTION_COLORS = ['#22d3ee', '#f472b6', '#fb923c', '#a78bfa'];

	function factionColor(idx: number): string {
		return FACTION_COLORS[idx % FACTION_COLORS.length];
	}

	const rankedFactions = $derived(
		[...factions]
			.map((fac, idx) => ({ fac, idx }))
			.sort((a, b) => (b.fac.faction_points ?? 1000) - (a.fac.faction_points ?? 1000))
	);
</script>

<div class="point-card faction-pts">
	<div class="pt-header">
		<span>{title}</span>
		{#if showRefresh && onRefresh}
			<button
				type="button"
				class="refresh-btn"
				onclick={onRefresh}
				disabled={refreshing}
				aria-label="Actualizar puntos de Gremios"
				title="Actualizar"
			>
				<RefreshCw size={14} class={refreshing ? 'spinning' : ''} />
			</button>
		{/if}
	</div>
	<div class="faction-leaderboard">
		{#each rankedFactions as { fac, idx }, rank (fac.id)}
			<button
				type="button"
				class="f-row {fac.id === ownFactionId ? 'own-faction' : ''}"
				onclick={() => onFactionClick?.(fac.id)}
			>
				<span class="f-rank mono">{rank + 1}</span>
				<span class="f-dot" style="background: {factionColor(idx)}"></span>
				<span class="f-name">{fac.name}</span>
				<span class="f-pts mono">{(fac.faction_points ?? 1000).toLocaleString()} pt</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.point-card {
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-lg, 12px);
		padding: 0.75rem 1rem;
		backdrop-filter: blur(8px);
	}
	.pt-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
		font-size: var(--text-xs, 0.75rem);
		color: #94a3b8;
		font-weight: 700;
		letter-spacing: 0.05em;
	}
	.refresh-btn {
		background: none;
		border: none;
		color: #94a3b8;
		padding: 0.2rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s ease;
	}
	.refresh-btn:hover:not(:disabled) {
		color: #fff;
		background: rgba(255, 255, 255, 0.1);
	}
	:global(.spinning) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}
	.faction-leaderboard {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-top: 0.3rem;
	}
	.f-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		background: none;
		border: none;
		border-radius: var(--radius-xs, 4px);
		padding: 0.35rem 0.4rem;
		margin: 0 -0.2rem;
		font-family: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.f-row:hover {
		background: rgba(255, 255, 255, 0.04);
	}
	.f-rank {
		font-size: var(--text-xs, 0.75rem);
		color: #64748b;
		width: 1.1rem;
		flex-shrink: 0;
	}
	.f-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.f-name {
		flex: 1;
		font-size: var(--text-sm, 0.875rem);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.f-pts {
		font-size: var(--text-xs, 0.75rem);
		color: #94a3b8;
		flex-shrink: 0;
	}
	.f-row.own-faction {
		background: rgba(255, 255, 255, 0.06);
		font-weight: 700;
	}
	.f-row.own-faction .f-name {
		color: #fff;
	}
	.mono {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
	}
</style>

<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import FactionLeaderboardWidget from '$lib/components/FactionLeaderboardWidget.svelte';

	interface Props {
		leaderboard: any[];
		factions: any[];
		slug: string;
		onRefresh: () => Promise<void>;
		refreshing?: boolean;
	}

	let {
		leaderboard = [],
		factions = [],
		slug,
		onRefresh,
		refreshing = false
	}: Props = $props();

	let searchAgent = $state('');
	let selectedFactionFilter = $state<string>('all');

	const filteredLeaderboard = $derived(
		leaderboard.filter((player) => {
			const matchesSearch =
				!searchAgent ||
				player.avatar_name?.toLowerCase().includes(searchAgent.toLowerCase()) ||
				player.email?.toLowerCase().includes(searchAgent.toLowerCase()) ||
				player.class_name?.toLowerCase().includes(searchAgent.toLowerCase());
			const matchesFaction =
				selectedFactionFilter === 'all' || player.faction_id === selectedFactionFilter;
			return matchesSearch && matchesFaction;
		})
	);
</script>

<div class="tab-pane">
	<div class="pane-header">
		<div>
			<h2>Tablas de Líderes</h2>
			<p class="hint">Monitorea el progreso de los participantes y el balance de gremios en vivo.</p>
		</div>
		<button class="secondary-btn" onclick={onRefresh} disabled={refreshing}>
			<RefreshCw size={15} class={refreshing ? 'spinning' : ''} />
			<span>Actualizar</span>
		</button>
	</div>

	<!-- WIDGET DRY DE GREMIOS -->
	<div class="widget-container">
		<FactionLeaderboardWidget
			{factions}
			{refreshing}
			{onRefresh}
			title="PUNTOS POR GREMIO (RANKING)"
		/>
	</div>

	<!-- FILTROS Y BUSCADOR DE AGENTES -->
	<div class="filter-card">
		<div class="search-box">
			<Search size={16} class="search-icon" />
			<input
				type="text"
				bind:value={searchAgent}
				placeholder="Buscar por nombre, email o clase..."
				class="search-input"
			/>
		</div>
		<div class="factions-chips">
			<button
				class="chip-btn {selectedFactionFilter === 'all' ? 'active' : ''}"
				onclick={() => (selectedFactionFilter = 'all')}
			>
				Todas ({leaderboard.length})
			</button>
			{#each factions as fac}
				<button
					class="chip-btn {selectedFactionFilter === fac.id ? 'active' : ''}"
					onclick={() => (selectedFactionFilter = fac.id)}
				>
					{fac.name}
				</button>
			{/each}
		</div>
	</div>

	<!-- TABLA DE JUGADORES -->
	<div class="table-responsive">
		<table class="gm-table">
			<thead>
				<tr>
					<th>#</th>
					<th>Agente</th>
					<th>Gremio</th>
					<th>Nivel</th>
					<th>XP Total</th>
					<th>Misiones</th>
					<th>Recompensas</th>
				</tr>
			</thead>
			<tbody>
				{#if filteredLeaderboard.length === 0}
					<tr>
						<td colspan="7" class="empty-cell">No se encontraron agentes registrados.</td>
					</tr>
				{:else}
					{#each filteredLeaderboard as p, idx (p.id || p.user_id || idx)}
						<tr>
							<td class="mono rank-cell">{idx + 1}</td>
							<td>
								<div class="agent-cell">
									<strong>{p.avatar_name}</strong>
									<small class="agent-email">{p.email}</small>
								</div>
							</td>
							<td>
								<span class="faction-tag">
									{factions.find((f) => f.id === p.faction_id)?.name || p.faction_id || 'Sin gremio'}
								</span>
							</td>
							<td>
								<span class="level-badge">Lvl {p.level}</span>
							</td>
							<td class="mono xp-cell"><strong>{p.xp_points}</strong> XP</td>
							<td class="mono">{p.completed_missions_count}</td>
							<td>
								{#if p.vip_token}
									<span class="vip-token-chip" title="Token VIP: {p.vip_token}">VIP PASS</span>
								{:else}
									<span>{p.unlocked_rewards_count}</span>
								{/if}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>

<style>
	.tab-pane {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.pane-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}
	.pane-header h2 {
		margin: 0 0 0.25rem 0;
		font-size: var(--text-2xl, 1.5rem);
	}
	.hint {
		margin: 0;
		font-size: var(--text-sm, 0.875rem);
		color: #94a3b8;
	}
	.widget-container {
		margin-bottom: 0.5rem;
	}
	.filter-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-lg, 12px);
		padding: 0.85rem;
	}
	.search-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md, 8px);
		padding: 0.5rem 0.75rem;
	}
	.search-input {
		background: none;
		border: none;
		color: #fff;
		width: 100%;
		font-family: inherit;
		font-size: var(--text-sm, 0.875rem);
	}
	.search-input:focus {
		outline: none;
	}
	:global(.search-icon) {
		color: #64748b;
	}
	.factions-chips {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
	}
	.chip-btn {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #94a3b8;
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-pill, 9999px);
		font-size: var(--text-xs, 0.75rem);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.2s ease;
	}
	.chip-btn:hover {
		color: #fff;
		border-color: rgba(255, 255, 255, 0.2);
	}
	.chip-btn.active {
		background: rgba(99, 102, 241, 0.3);
		color: #c7d2fe;
		border-color: #818cf8;
	}
	.table-responsive {
		overflow-x: auto;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-lg, 12px);
	}
	.gm-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm, 0.875rem);
		text-align: left;
	}
	.gm-table th {
		background: rgba(30, 41, 59, 0.7);
		padding: 0.75rem 1rem;
		color: #94a3b8;
		font-weight: 700;
		font-size: var(--text-xs, 0.75rem);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.gm-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		color: #cbd5e1;
	}
	.gm-table tr:last-child td {
		border-bottom: none;
	}
	.gm-table tr:hover td {
		background: rgba(255, 255, 255, 0.02);
	}
	.rank-cell {
		color: #64748b;
		font-weight: 700;
	}
	.agent-cell {
		display: flex;
		flex-direction: column;
	}
	.agent-cell strong {
		color: #f1f5f9;
	}
	.agent-email {
		font-size: var(--text-xs, 0.75rem);
		color: #64748b;
	}
	.faction-tag {
		background: rgba(255, 255, 255, 0.06);
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: var(--text-xs, 0.75rem);
	}
	.level-badge {
		background: rgba(99, 102, 241, 0.2);
		color: #a5b4fc;
		border: 1px solid rgba(99, 102, 241, 0.3);
		padding: 0.2rem 0.5rem;
		border-radius: var(--radius-pill, 9999px);
		font-size: var(--text-xs, 0.75rem);
		font-weight: 700;
	}
	.xp-cell {
		color: #38bdf8;
	}
	.vip-token-chip {
		background: rgba(234, 179, 8, 0.2);
		color: #fde047;
		border: 1px solid rgba(234, 179, 8, 0.4);
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: var(--text-xs, 0.75rem);
		font-weight: 800;
	}
	.empty-cell {
		text-align: center;
		padding: 2rem !important;
		color: #64748b;
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
	.secondary-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.15);
	}
	:global(.spinning) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		100% { transform: rotate(360deg); }
	}
	.mono {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
	}
</style>

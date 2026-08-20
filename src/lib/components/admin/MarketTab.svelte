<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Lock from '@lucide/svelte/icons/lock';
	import Download from '@lucide/svelte/icons/download';

	interface Props {
		rewards: any[];
		redemptions: any[];
		slug: string;
		onRewardCreated: (reward: any) => void;
		showMessage: (type: 'success' | 'error', text: string) => void;
	}

	let {
		rewards = [],
		redemptions = [],
		slug,
		onRewardCreated,
		showMessage
	}: Props = $props();

	let marketSubTab = $state<'catalog' | 'redemptions'>('catalog');
	let showCreateRewardModal = $state(false);

	let newRewardName = $state('');
	let newRewardCategory = $state('general');
	let newRewardCost = $state(5);
	let newRewardMinLevel = $state(1);
	let newRewardDesc = $state('');
	let newRewardFile = $state<File | null>(null);
	let creatingReward = $state(false);

	function resetRewardForm() {
		newRewardName = '';
		newRewardCategory = 'general';
		newRewardCost = 5;
		newRewardMinLevel = 1;
		newRewardDesc = '';
		newRewardFile = null;
	}

	async function handleCreateReward(e: SubmitEvent) {
		e.preventDefault();
		if (!newRewardName.trim()) {
			showMessage('error', 'El nombre del incentivo es requerido');
			return;
		}

		creatingReward = true;
		try {
			let uploadedFileUrl = '';
			if (newRewardFile) {
				const formData = new FormData();
				formData.append('file', newRewardFile);
				formData.append('folder', 'rewards');
				const uploadRes = await fetch(`/api/event/${slug}/upload`, {
					method: 'POST',
					body: formData
				});
				const uploadJson = await uploadRes.json();
				if (uploadJson.success) {
					uploadedFileUrl = uploadJson.url;
				} else {
					throw new Error(uploadJson.message || 'Error al subir archivo');
				}
			}

			const res = await fetch(`/api/event/${slug}/admin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'create_reward',
					name: newRewardName,
					category: newRewardCategory,
					cost: Number(newRewardCost),
					min_level: Number(newRewardMinLevel),
					description: newRewardDesc,
					file_url: uploadedFileUrl || null
				})
			});
			const json = await res.json();
			if (json.success) {
				onRewardCreated(json.reward);
				showCreateRewardModal = false;
				resetRewardForm();
				showMessage('success', `Incentivo "${json.reward.name}" creado con éxito`);
			} else {
				throw new Error(json.message || 'Error al guardar');
			}
		} catch (err: any) {
			showMessage('error', err.message || 'Falla al crear incentivo');
		} finally {
			creatingReward = false;
		}
	}
</script>

<div class="tab-pane">
	<div class="pane-header">
		<div>
			<h2>Mercado & Bóveda de Inteligencia</h2>
			<p class="hint">Administra los incentivos desbloqueables y audita los canjes de los jugadores.</p>
		</div>
		<button class="primary-btn" onclick={() => (showCreateRewardModal = true)}>
			<Plus size={16} />
			<span>Nuevo Incentivo</span>
		</button>
	</div>

	<!-- SUB-PESTAÑAS DEL MERCADO -->
	<div class="subtabs-bar">
		<button
			class="subtab-btn {marketSubTab === 'catalog' ? 'active' : ''}"
			onclick={() => (marketSubTab = 'catalog')}
		>
			💎 Catálogo de Incentivos ({rewards.length})
		</button>
		<button
			class="subtab-btn {marketSubTab === 'redemptions' ? 'active' : ''}"
			onclick={() => (marketSubTab = 'redemptions')}
		>
			🏆 Canjes & Tokens VIP ({redemptions.length})
		</button>
	</div>

	{#if marketSubTab === 'catalog'}
		<div class="rewards-grid">
			{#if rewards.length === 0}
				<div class="empty-state">No hay incentivos configurados en la Bóveda aún.</div>
			{:else}
				{#each rewards as rew (rew.id)}
					<div class="reward-admin-card">
						<div class="reward-admin-header">
							<span class="category-tag">{rew.category}</span>
							<span class="cost-badge">{rew.cost} 💠</span>
						</div>
						<h3>{rew.name}</h3>
						<p class="desc">{rew.description || 'Sin descripción detallada.'}</p>
						<div class="card-footer">
							<span class="min-lvl">
								{#if (rew.min_level || 1) > 1}
									<Lock size={12} class="icon-lock" />
								{/if}
								Nivel Mínimo: <strong>{rew.min_level || 1}</strong>
							</span>
							{#if rew.file_url}
								<a href={rew.file_url} target="_blank" rel="noopener noreferrer" class="file-link" title="Ver archivo adjunto">
									<Download size={13} />
									<span>Archivo</span>
								</a>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	{:else}
		<div class="table-responsive">
			<table class="gm-table">
				<thead>
					<tr>
						<th>Agente</th>
						<th>Gremio</th>
						<th>Incentivo Canjeado</th>
						<th>Categoría</th>
						<th>Token VIP / Detalle</th>
					</tr>
				</thead>
				<tbody>
					{#if redemptions.length === 0}
						<tr>
							<td colspan="5" class="empty-cell">Ningún participante ha canjeado incentivos aún.</td>
						</tr>
					{:else}
						{#each redemptions as red, idx (`${red.email}_${red.reward_id}_${idx}`)}
							<tr>
								<td>
									<strong>{red.player_name}</strong>
									<br />
									<small class="agent-email">{red.email}</small>
								</td>
								<td><span class="faction-tag">{red.faction_id || 'General'}</span></td>
								<td><strong>{red.reward_name}</strong></td>
								<td><span class="category-tag">{red.reward_category}</span></td>
								<td>
									{#if red.vip_token}
										<div class="vip-token-box">
											<code>{red.vip_token}</code>
											<span class="vip-sub">Consultoría 1-a-1</span>
										</div>
									{:else}
										<span class="text-muted">Canje digital estándar</span>
									{/if}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- MODAL: CREAR RECOMPENSA -->
	{#if showCreateRewardModal}
		<div class="modal-overlay" onclick={() => (showCreateRewardModal = false)} role="presentation">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
				<h3>Crear Nuevo Incentivo para el Mercado</h3>
				<form onsubmit={handleCreateReward}>
					<div class="form-group">
						<label for="reward-name">Nombre del Incentivo *</label>
						<input
							id="reward-name"
							type="text"
							bind:value={newRewardName}
							placeholder="Ej. Matriz de Retención LTV (PDF)"
							required
						/>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="reward-category">Categoría</label>
							<select id="reward-category" bind:value={newRewardCategory}>
								<option value="general">General</option>
								<option value="game_aid">Ayuda Táctica (Game Aid)</option>
								<option value="b2b_tool">Herramienta B2B</option>
								<option value="vip_lead">Conversión VIP</option>
							</select>
						</div>

						<div class="form-group">
							<label for="reward-cost">Coste (Ludens 💠) *</label>
							<input
								id="reward-cost"
								type="number"
								min="1"
								bind:value={newRewardCost}
								required
							/>
						</div>

						<div class="form-group">
							<label for="reward-min-lvl">Nivel Mínimo</label>
							<input
								id="reward-min-lvl"
								type="number"
								min="1"
								max="7"
								bind:value={newRewardMinLevel}
							/>
						</div>
					</div>

					<div class="form-group">
						<label for="reward-desc">Descripción / Instrucciones de Canje</label>
						<textarea
							id="reward-desc"
							rows="3"
							bind:value={newRewardDesc}
							placeholder="Explica qué recibe el agente y cómo acceder."
						></textarea>
					</div>

					<div class="form-group">
						<label for="reward-file">Archivo Adjunto (PDF, Guía o Asset - Opcional)</label>
						<input
							id="reward-file"
							type="file"
							accept=".pdf,.png,.jpg,.jpeg,.zip"
							onchange={(e) => {
								const target = e.target as HTMLInputElement;
								newRewardFile = target.files?.[0] || null;
							}}
						/>
					</div>

					<div class="modal-actions">
						<button
							type="button"
							class="secondary-btn"
							onclick={() => (showCreateRewardModal = false)}
							disabled={creatingReward}
						>
							Cancelar
						</button>
						<button type="submit" class="primary-btn" disabled={creatingReward}>
							{creatingReward ? 'Subiendo y Guardando...' : 'Publicar Incentivo'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
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
	.subtabs-bar {
		display: flex;
		gap: 0.5rem;
		background: rgba(30, 41, 59, 0.5);
		padding: 0.35rem;
		border-radius: var(--radius-lg, 12px);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.subtab-btn {
		flex: 1;
		background: transparent;
		border: none;
		color: #94a3b8;
		padding: 0.6rem 1rem;
		border-radius: var(--radius-md, 8px);
		font-weight: 700;
		font-size: var(--text-xs, 0.75rem);
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.subtab-btn.active {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}
	.rewards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}
	.reward-admin-card {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-lg, 12px);
		padding: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.reward-admin-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.category-tag {
		background: rgba(99, 102, 241, 0.2);
		color: #c7d2fe;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: var(--text-xs, 0.75rem);
		font-weight: 700;
		text-transform: uppercase;
	}
	.cost-badge {
		color: #38bdf8;
		font-weight: 800;
		font-size: var(--text-base, 1rem);
	}
	.reward-admin-card h3 {
		margin: 0;
		font-size: var(--text-base, 1rem);
		color: #f1f5f9;
	}
	.reward-admin-card .desc {
		margin: 0;
		font-size: var(--text-xs, 0.75rem);
		color: #94a3b8;
		line-height: 1.4;
		flex: 1;
	}
	.card-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		font-size: var(--text-xs, 0.75rem);
		color: #64748b;
	}
	.min-lvl {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.file-link {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: #818cf8;
		text-decoration: none;
		font-weight: 600;
	}
	.file-link:hover {
		text-decoration: underline;
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
	.vip-token-box {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.vip-token-box code {
		background: rgba(234, 179, 8, 0.2);
		color: #fde047;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		font-weight: 800;
		font-size: var(--text-xs, 0.75rem);
	}
	.vip-sub {
		font-size: 0.7rem;
		color: #94a3b8;
	}
	.text-muted {
		color: #64748b;
		font-size: var(--text-xs, 0.75rem);
	}
	.empty-state, .empty-cell {
		text-align: center;
		padding: 2.5rem 1rem;
		color: #64748b;
	}
	.primary-btn {
		background: #6366f1;
		color: #fff;
		border: none;
		padding: 0.55rem 1rem;
		border-radius: var(--radius-md, 8px);
		font-weight: 700;
		font-size: var(--text-sm, 0.875rem);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		transition: all 0.2s ease;
	}
	.primary-btn:hover:not(:disabled) {
		background: #4f46e5;
	}
	.primary-btn:disabled, .secondary-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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
	/* MODALES */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(8px);
		z-index: 100;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 1.25rem 1rem calc(2rem + env(safe-area-inset-bottom, 20px)) 1rem;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		box-sizing: border-box;
	}
	.modal-card {
		background: #1e293b;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-xl, 16px);
		max-width: 520px;
		width: 100%;
		padding: 1.5rem;
		max-height: calc(100dvh - 3rem);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		margin: auto 0;
		box-sizing: border-box;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
	}
	@media (max-width: 480px) {
		.modal-overlay {
			padding: 0.85rem 0.65rem calc(1.75rem + env(safe-area-inset-bottom, 16px)) 0.65rem;
		}
		.modal-card {
			padding: 1.15rem 0.85rem;
			max-height: calc(100dvh - 2rem);
			margin: 0 auto;
		}
	}
	.modal-card h3 {
		margin: 0 0 1.25rem 0;
		font-size: var(--text-xl, 1.25rem);
		color: #fff;
	}
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}
	.form-row {
		display: grid;
		grid-template-columns: 1.5fr 1fr 1fr;
		gap: 0.75rem;
	}
	.form-group label {
		font-size: var(--text-xs, 0.75rem);
		font-weight: 700;
		color: #94a3b8;
	}
	.form-group input, .form-group select, .form-group textarea {
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #fff;
		padding: 0.6rem 0.8rem;
		border-radius: var(--radius-md, 8px);
		font-family: inherit;
		font-size: 16px;
	}
	.form-group input:focus, .form-group select:focus, .form-group textarea:focus {
		outline: none;
		border-color: #6366f1;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
</style>

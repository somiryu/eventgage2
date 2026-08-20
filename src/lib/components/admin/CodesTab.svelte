<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';

	interface Props {
		codes: any[];
		slug: string;
		onCodeCreated: (code: any) => void;
		showMessage: (type: 'success' | 'error', text: string) => void;
	}

	let {
		codes = [],
		slug,
		onCodeCreated,
		showMessage
	}: Props = $props();

	let codeCategoryFilter = $state<'all' | 'game_master' | 'recinto' | 'inicial'>('all');
	let copiedCodeId = $state<string | null>(null);
	let showCreateCodeModal = $state(false);

	let newCodeText = $state('');
	let newCodeCategory = $state<'game_master' | 'recinto' | 'inicial'>('game_master');
	let newCodeDisplayId = $state('');
	let newCodeDesc = $state('');
	let newCodeXP = $state(50);
	let newCodeCP = $state(1);
	let creatingCode = $state(false);

	const filteredCodes = $derived(
		codeCategoryFilter === 'all'
			? codes
			: codes.filter((c) => c.category === codeCategoryFilter)
	);

	function copyToClipboard(text: string, id: string) {
		navigator.clipboard.writeText(text);
		copiedCodeId = id;
		showMessage('success', `Código ${text} copiado al portapapeles`);
		setTimeout(() => {
			if (copiedCodeId === id) copiedCodeId = null;
		}, 2000);
	}

	function resetCodeForm() {
		newCodeText = '';
		newCodeCategory = 'game_master';
		newCodeDisplayId = '';
		newCodeDesc = '';
		newCodeXP = 50;
		newCodeCP = 1;
	}

	async function handleCreateCode(e: SubmitEvent) {
		e.preventDefault();
		if (!newCodeText.trim()) {
			showMessage('error', 'El texto del código es obligatorio');
			return;
		}

		creatingCode = true;
		try {
			const res = await fetch(`/api/event/${slug}/admin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'create_code',
					code: newCodeText.trim().toUpperCase(),
					category: newCodeCategory,
					display_id: newCodeDisplayId.trim() || undefined,
					description: newCodeDesc.trim(),
					rewards: {
						xp: Number(newCodeXP),
						cp: Number(newCodeCP)
					}
				})
			});
			const json = await res.json();
			if (json.success) {
				onCodeCreated(json.code);
				showCreateCodeModal = false;
				resetCodeForm();
				showMessage('success', `Código "${json.code.code}" creado con éxito`);
			} else {
				throw new Error(json.message || 'Error al registrar código');
			}
		} catch (err: any) {
			showMessage('error', err.message || 'Falla al crear código');
		} finally {
			creatingCode = false;
		}
	}
</script>

<div class="tab-pane">
	<div class="pane-header">
		<div>
			<h2>Gestión de Códigos Tácticos</h2>
			<p class="hint">Códigos asignados a Game Masters e instalados en el recinto para entregar a los asistentes.</p>
		</div>
		<button class="primary-btn" onclick={() => (showCreateCodeModal = true)}>
			<Plus size={16} />
			<span>Nuevo Código</span>
		</button>
	</div>

	<!-- FILTROS POR CATEGORÍA -->
	<div class="factions-chips">
		<button
			class="chip-btn {codeCategoryFilter === 'all' ? 'active' : ''}"
			onclick={() => (codeCategoryFilter = 'all')}
		>
			Todos ({codes.length})
		</button>
		<button
			class="chip-btn {codeCategoryFilter === 'game_master' ? 'active' : ''}"
			onclick={() => (codeCategoryFilter = 'game_master')}
		>
			Game Master ({codes.filter((c) => c.category === 'game_master').length})
		</button>
		<button
			class="chip-btn {codeCategoryFilter === 'recinto' ? 'active' : ''}"
			onclick={() => (codeCategoryFilter = 'recinto')}
		>
			Recinto ({codes.filter((c) => c.category === 'recinto').length})
		</button>
		<button
			class="chip-btn {codeCategoryFilter === 'inicial' ? 'active' : ''}"
			onclick={() => (codeCategoryFilter = 'inicial')}
		>
			Inicial ({codes.filter((c) => c.category === 'inicial').length})
		</button>
	</div>

	<div class="codes-grid">
		{#if filteredCodes.length === 0}
			<div class="empty-state">No hay códigos en esta categoría.</div>
		{:else}
			{#each filteredCodes as codeItem (codeItem.id)}
				<div class="code-card">
					<div class="code-header">
						<span class="display-id-badge">{codeItem.display_id || codeItem.id}</span>
						<span class="category-tag">{codeItem.category || 'recinto'}</span>
					</div>

					<div class="code-display-box">
						<span class="secret-code">{codeItem.code}</span>
						<button
							class="copy-btn"
							onclick={() => copyToClipboard(codeItem.code, codeItem.id)}
							title="Copiar código para entregar al asistente"
						>
							{#if copiedCodeId === codeItem.id}
								<Check size={16} class="copied-icon" />
							{:else}
								<Copy size={16} />
							{/if}
						</button>
					</div>

					<div class="code-details">
						<h4>{codeItem.description || 'Sin descripción'}</h4>
						{#if codeItem.mission_title}
							<p class="mission-link">Misión: {codeItem.mission_title}</p>
						{/if}
						<div class="rewards-preview">
							{#if codeItem.rewards?.xp}
								<span class="reward-pill xp">+{codeItem.rewards.xp} XP</span>
							{/if}
							{#if codeItem.rewards?.cp}
								<span class="reward-pill cp">+{codeItem.rewards.cp} CP</span>
							{/if}
							{#if codeItem.mission_type}
								<span class="mechanic-tag">{codeItem.mission_type}</span>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- MODAL: CREAR CÓDIGO -->
	<!-- Este formulario solo genera XP/CP plano (sin unlocks_mission/unlocks_item)
	     a propósito: por ahora las misiones se crean por seed, no desde la
	     consola. Cuando exista un módulo de creación de misiones, este form
	     debería ganar un selector para vincular el código a una misión/ítem. -->
	{#if showCreateCodeModal}
		<div class="modal-overlay" onclick={() => (showCreateCodeModal = false)} role="presentation">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
				<h3>Registrar Nuevo Código Secreto</h3>
				<form onsubmit={handleCreateCode}>
					<div class="form-row">
						<div class="form-group">
							<label for="code-str">Código (4-8 chars) *</label>
							<input
								id="code-str"
								type="text"
								bind:value={newCodeText}
								placeholder="Ej. G1TB"
								maxlength="12"
								required
								class="mono"
							/>
						</div>

						<div class="form-group">
							<label for="code-cat">Categoría</label>
							<select id="code-cat" bind:value={newCodeCategory}>
								<option value="game_master">Game Master (Personal)</option>
								<option value="recinto">Recinto (Stands / Pistas)</option>
								<option value="inicial">Inicial (Onboarding)</option>
							</select>
						</div>

						<div class="form-group">
							<label for="code-num-id">ID Visible (Ej. GM-01)</label>
							<input
								id="code-num-id"
								type="text"
								bind:value={newCodeDisplayId}
								placeholder="GM-16 / REC-15"
								class="mono"
							/>
						</div>
					</div>

					<div class="form-group">
						<label for="code-description">Descripción / Título del Desafío</label>
						<input
							id="code-description"
							type="text"
							bind:value={newCodeDesc}
							placeholder="Ej. GM 1 - Pregunta de Validación de Fricción"
						/>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="code-xp">XP a Otorgar</label>
							<input id="code-xp" type="number" min="0" bind:value={newCodeXP} />
						</div>

						<div class="form-group">
							<label for="code-cp">CP / Ludens a Otorgar</label>
							<input id="code-cp" type="number" min="0" bind:value={newCodeCP} />
						</div>
					</div>

					<div class="modal-actions">
						<button
							type="button"
							class="secondary-btn"
							onclick={() => (showCreateCodeModal = false)}
							disabled={creatingCode}
						>
							Cancelar
						</button>
						<button type="submit" class="primary-btn" disabled={creatingCode}>
							{creatingCode ? 'Guardando...' : 'Crear Código'}
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
	.codes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}
	.code-card {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-lg, 12px);
		padding: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		border-left: 3px solid #38bdf8;
	}
	.code-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.display-id-badge {
		font-family: 'JetBrains Mono', monospace;
		font-weight: 800;
		font-size: var(--text-xs, 0.75rem);
		background: rgba(255, 255, 255, 0.1);
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		color: #f1f5f9;
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
	.code-display-box {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(15, 23, 42, 0.8);
		border: 1px dashed rgba(56, 189, 248, 0.4);
		border-radius: var(--radius-md, 8px);
		padding: 0.6rem 0.9rem;
	}
	.secret-code {
		font-family: 'JetBrains Mono', monospace;
		font-weight: 900;
		font-size: 1.25rem;
		letter-spacing: 0.2em;
		color: #38bdf8;
	}
	.copy-btn {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #c7d2fe;
		padding: 0.4rem;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}
	.copy-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		color: #fff;
	}
	:global(.copied-icon) {
		color: #4ade80;
	}
	.code-details h4 {
		margin: 0;
		font-size: var(--text-sm, 0.875rem);
		color: #f8fafc;
	}
	.mission-link {
		margin: 0.25rem 0 0 0;
		font-size: var(--text-xs, 0.75rem);
		color: #94a3b8;
	}
	.rewards-preview {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-top: 0.4rem;
	}
	.reward-pill {
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 700;
	}
	.reward-pill.xp {
		background: rgba(56, 189, 248, 0.15);
		color: #38bdf8;
	}
	.reward-pill.cp {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
	}
	.mechanic-tag {
		background: rgba(255, 255, 255, 0.06);
		color: #94a3b8;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-family: monospace;
	}
	.empty-state {
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
		grid-template-columns: 1fr 1fr 1fr;
		gap: 0.75rem;
	}
	.form-group label {
		font-size: var(--text-xs, 0.75rem);
		font-weight: 700;
		color: #94a3b8;
	}
	.form-group input, .form-group select {
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #fff;
		padding: 0.6rem 0.8rem;
		border-radius: var(--radius-md, 8px);
		font-family: inherit;
		font-size: var(--text-sm, 0.875rem);
	}
	.form-group input:focus, .form-group select:focus {
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
	.mono {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
	}
</style>

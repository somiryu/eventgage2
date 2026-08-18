<script lang="ts">
	import Radio from '@lucide/svelte/icons/radio';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Send from '@lucide/svelte/icons/send';

	interface Props {
		characters: any[];
		alerts: any[];
		slug: string;
		onAlertSent: (alert: any) => void;
		onCharacterCreated: (character: any) => void;
		showMessage: (type: 'success' | 'error', text: string) => void;
	}

	let {
		characters = [],
		alerts = [],
		slug,
		onAlertSent,
		onCharacterCreated,
		showMessage
	}: Props = $props();

	let showCreateCharacterModal = $state(false);

	let newCharName = $state('');
	let newCharRole = $state('Game Master');
	let newCharFile = $state<File | null>(null);
	let creatingChar = $state(false);

	let alertSpeakerCharId = $state('');
	let alertType = $state<'info' | 'warning' | 'danger'>('info');
	let alertTitle = $state('');
	let alertMessage = $state('');
	let alertDuration = $state(30);
	let sendingAlert = $state(false);

	const selectedCharObj = $derived(characters.find((c: any) => c.id === alertSpeakerCharId));

	function resetCharForm() {
		newCharName = '';
		newCharRole = 'Game Master';
		newCharFile = null;
	}

	async function handleCreateCharacter(e: SubmitEvent) {
		e.preventDefault();
		if (!newCharName.trim()) {
			showMessage('error', 'El nombre del personaje es requerido');
			return;
		}

		creatingChar = true;
		try {
			let portraitUrl = '';
			if (newCharFile) {
				const formData = new FormData();
				formData.append('file', newCharFile);
				formData.append('folder', 'characters');
				const uploadRes = await fetch(`/api/event/${slug}/upload`, {
					method: 'POST',
					body: formData
				});
				const uploadJson = await uploadRes.json();
				if (uploadJson.success) {
					portraitUrl = uploadJson.url;
				} else {
					showMessage('error', uploadJson.error || 'No se pudo subir el retrato. El personaje se creará sin imagen.');
				}
			}

			const res = await fetch(`/api/event/${slug}/admin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'create_character',
					name: newCharName.trim(),
					role: newCharRole.trim(),
					portrait_url: portraitUrl || null
				})
			});
			const json = await res.json();
			if (json.success) {
				onCharacterCreated(json.character);
				alertSpeakerCharId = json.character.id;
				showCreateCharacterModal = false;
				resetCharForm();
				showMessage('success', `Personaje "${json.character.name}" creado`);
			} else {
				throw new Error(json.message || 'Error al crear personaje');
			}
		} catch (err: any) {
			showMessage('error', err.message || 'Falla al crear personaje');
		} finally {
			creatingChar = false;
		}
	}

	async function handleSendAlert(e: SubmitEvent) {
		e.preventDefault();
		if (!alertMessage.trim()) {
			showMessage('error', 'Escribe el mensaje de la transmisión');
			return;
		}

		sendingAlert = true;
		try {
			const res = await fetch(`/api/event/${slug}/admin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'send_alert',
					message: alertMessage.trim(),
					title: alertTitle.trim() || undefined,
					type: alertType,
					expiration_seconds: Number(alertDuration),
					character_id: alertSpeakerCharId || null
				})
			});
			const json = await res.json();
			if (json.success) {
				onAlertSent(json.alert);
				alertMessage = '';
				alertTitle = '';
				showMessage('success', 'Transmisión emitida a todos los jugadores');
			} else {
				throw new Error(json.message || 'Error al enviar alerta');
			}
		} catch (err: any) {
			showMessage('error', err.message || 'Falla al emitir transmisión');
		} finally {
			sendingAlert = false;
		}
	}
</script>

<div class="tab-pane">
	<div class="pane-header">
		<div>
			<h2>Canal de Transmisión & Alertas</h2>
			<p class="hint">Envía mensajes en vivo a las pantallas de los jugadores y gestiona los personajes de enlace.</p>
		</div>
		<button class="secondary-btn" onclick={() => (showCreateCharacterModal = true)}>
			<UserPlus size={16} />
			<span>Nuevo Personaje</span>
		</button>
	</div>

	<!-- ROSTER DE PERSONAJES ACTIVOS -->
	{#if characters.length > 0}
		<div class="roster-section">
			<div class="roster-header">
				<h3>Personajes Oficiales de la Red ({characters.length})</h3>
			</div>
			<div class="roster-grid">
				{#each characters as char}
					<button
						type="button"
						class="roster-card {alertSpeakerCharId === char.id ? 'selected' : ''}"
						onclick={() => (alertSpeakerCharId = char.id)}
					>
						{#if char.portrait_url}
							<img src={char.portrait_url} alt={char.name} class="roster-avatar" />
						{:else}
							<div class="roster-avatar placeholder"><Radio size={20} /></div>
						{/if}
						<div class="roster-info">
							<strong>{char.name}</strong>
							<span>{char.role || 'Enlace de Red'}</span>
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- COMPOSITOR DE ALERTA -->
	<form class="broadcast-card" onsubmit={handleSendAlert}>
		<h3><Radio size={18} class="live-icon" /> Emitir Transmisión a la Red</h3>

		<div class="form-row">
			<div class="form-group">
				<label for="alert-char">Personaje Emisor:</label>
				<div class="char-select-wrapper">
					{#if selectedCharObj?.portrait_url}
						<img src={selectedCharObj.portrait_url} alt={selectedCharObj.name} class="char-select-preview" />
					{:else}
						<div class="char-select-preview empty"><Radio size={16} /></div>
					{/if}
					<select id="alert-char" bind:value={alertSpeakerCharId}>
						<option value="">Game Master General</option>
						{#each characters as char}
							<option value={char.id}>{char.name} ({char.role || 'Enlace'})</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="form-group">
				<label for="alert-type">Nivel de Alerta:</label>
				<select id="alert-type" bind:value={alertType}>
					<option value="info">Info / Enlace (Cyan)</option>
					<option value="warning">Alerta Táctica (Ámbar)</option>
					<option value="danger">Amenaza Crítica (Rojo)</option>
				</select>
			</div>

			<div class="form-group">
				<label for="alert-duration">Duración en Pantalla:</label>
				<select id="alert-duration" bind:value={alertDuration}>
					<option value={15}>15 segundos</option>
					<option value={30}>30 segundos</option>
					<option value={60}>1 minuto</option>
					<option value={120}>2 minutos</option>
				</select>
			</div>
		</div>

		<div class="form-group">
			<label for="alert-title">Título de la Transmisión (opcional):</label>
			<input
				id="alert-title"
				type="text"
				bind:value={alertTitle}
				placeholder="Ej: ALERTA DE GIOCCHI: Nueva anomalía en el pasillo central"
			/>
		</div>

		<div class="form-group">
			<label for="alert-msg">Mensaje / Transmisión: *</label>
			<textarea
				id="alert-msg"
				rows="3"
				bind:value={alertMessage}
				placeholder="Escribe el mensaje que verán todos los jugadores en su HUD..."
				required
			></textarea>
		</div>

		<div class="broadcast-actions">
			<button
				type="submit"
				class="primary-btn broadcast-btn"
				disabled={sendingAlert || !alertMessage.trim()}
			>
				<Send size={16} />
				<span>{sendingAlert ? 'Transmitiendo a la Red...' : 'Emitir a Todos los Jugadores'}</span>
			</button>
		</div>
	</form>

	<!-- HISTORIAL DE ALERTAS -->
	<div class="alerts-history-section">
		<h3>Historial de Transmisiones Emitidas ({alerts.length})</h3>
		{#if alerts.length === 0}
			<div class="empty-state">No se han emitido transmisiones en este evento aún.</div>
		{:else}
			<div class="alerts-list">
				{#each alerts as a (a.id)}
					<div class="alert-history-item alert-{a.type || 'info'}">
						<div class="alert-hist-top">
							<div class="speaker-info">
								{#if a.portrait_url}
									<img src={a.portrait_url} alt={a.speaker_name} class="speaker-mini-avatar" />
								{/if}
								<strong>{a.speaker_name || a.title || 'Transmisión Oficial'}</strong>
							</div>
							<div class="alert-meta">
								<span class="type-chip">{a.type || 'info'}</span>
								<span class="time-stamp">
									{a.scheduled_at ? new Date(a.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
								</span>
							</div>
						</div>
						{#if a.title && a.speaker_name}
							<h4 class="alert-hist-title">{a.title}</h4>
						{/if}
						<p class="alert-hist-msg">{a.message}</p>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- MODAL: CREAR PERSONAJE -->
	{#if showCreateCharacterModal}
		<div class="modal-overlay" onclick={() => (showCreateCharacterModal = false)} role="presentation">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
				<h3>Crear Personaje de Enlace</h3>
				<form onsubmit={handleCreateCharacter}>
					<div class="form-group">
						<label for="char-name">Nombre del Personaje *</label>
						<input
							id="char-name"
							type="text"
							bind:value={newCharName}
							placeholder="Ej. Operador Cipher / Dra. Elena Ross"
							required
						/>
					</div>

					<div class="form-group">
						<label for="char-role">Rol / Título Táctico</label>
						<input
							id="char-role"
							type="text"
							bind:value={newCharRole}
							placeholder="Ej. Oficial de Enlace PRIME"
						/>
					</div>

					<div class="form-group">
						<label for="char-file">Retrato / Avatar (Imagen)</label>
						<input
							id="char-file"
							type="file"
							accept="image/*"
							onchange={(e) => {
								const target = e.target as HTMLInputElement;
								newCharFile = target.files?.[0] || null;
							}}
						/>
					</div>

					<div class="modal-actions">
						<button
							type="button"
							class="secondary-btn"
							onclick={() => (showCreateCharacterModal = false)}
							disabled={creatingChar}
						>
							Cancelar
						</button>
						<button type="submit" class="primary-btn" disabled={creatingChar}>
							{creatingChar ? 'Guardando...' : 'Crear Personaje'}
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
	.broadcast-card {
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: var(--radius-lg, 12px);
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.broadcast-card h3 {
		margin: 0 0 0.5rem 0;
		font-size: var(--text-base, 1rem);
		color: #f1f5f9;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.live-icon {
		color: #ef4444;
		animation: pulse-live 1.5s infinite;
	}
	@keyframes pulse-live {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}
	.broadcast-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.5rem;
	}
	.broadcast-btn {
		width: 100%;
		justify-content: center;
		padding: 0.75rem;
		font-size: var(--text-sm, 0.875rem);
	}
	.alerts-history-section h3 {
		margin: 0 0 1rem 0;
		font-size: var(--text-lg, 1.125rem);
	}
	.alerts-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.alert-history-item {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-lg, 12px);
		padding: 1rem;
		border-left: 4px solid #38bdf8;
	}
	.alert-history-item.alert-warning {
		border-left-color: #f59e0b;
	}
	.alert-history-item.alert-danger {
		border-left-color: #ef4444;
	}
	.alert-hist-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
	}
	.speaker-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.speaker-mini-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}
	.alert-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.type-chip {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.08);
		color: #94a3b8;
	}
	.time-stamp {
		font-size: var(--text-xs, 0.75rem);
		color: #64748b;
	}
	.alert-hist-title {
		margin: 0.25rem 0;
		font-size: var(--text-sm, 0.875rem);
		color: #f8fafc;
	}
	.alert-hist-msg {
		margin: 0;
		font-size: var(--text-sm, 0.875rem);
		color: #cbd5e1;
		line-height: 1.4;
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
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 0.75rem;
	}
	.form-row {
		display: grid;
		grid-template-columns: 1.5fr 1fr 1fr;
		gap: 0.75rem;
	}
	/* ROSTER DE PERSONAJES */
	.roster-section {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-lg, 12px);
		padding: 1rem;
		margin-bottom: 1.25rem;
	}
	.roster-header h3 {
		margin: 0 0 0.75rem 0;
		font-size: var(--text-base, 1rem);
		color: #e2e8f0;
	}
	.roster-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.75rem;
	}
	.roster-card {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.5rem 0.65rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-md, 8px);
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}
	.roster-card:hover {
		background: rgba(30, 41, 59, 0.9);
		border-color: rgba(99, 102, 241, 0.4);
	}
	.roster-card.selected {
		border-color: #6366f1;
		background: rgba(99, 102, 241, 0.15);
		box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
	}
	.roster-avatar {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm, 6px);
		object-fit: cover;
		flex-shrink: 0;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}
	.roster-avatar.placeholder {
		background: rgba(255, 255, 255, 0.05);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #818cf8;
	}
	.roster-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.roster-info strong {
		font-size: var(--text-xs, 0.75rem);
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.roster-info span {
		font-size: 0.65rem;
		color: #94a3b8;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.char-select-wrapper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.char-select-wrapper select {
		flex: 1;
	}
	.char-select-preview {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm, 6px);
		object-fit: cover;
		border: 1px solid rgba(99, 102, 241, 0.4);
		flex-shrink: 0;
	}
	.char-select-preview.empty {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm, 6px);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #64748b;
		flex-shrink: 0;
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
		font-size: var(--text-sm, 0.875rem);
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
	/* MODALES */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(8px);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}
	.modal-card {
		background: #1e293b;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-xl, 16px);
		max-width: 520px;
		width: 100%;
		padding: 1.5rem;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
	}
	.modal-card h3 {
		margin: 0 0 1.25rem 0;
		font-size: var(--text-xl, 1.25rem);
		color: #fff;
	}
</style>

<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Plus from '@lucide/svelte/icons/plus';

	interface Props {
		maps: any[];
		missions?: any[];
		slug: string;
		onMapSaved: (map: any) => void;
		onHotspotToggled: (mapId: string, hotspotId: string, isActive: boolean) => void;
		showMessage: (type: 'success' | 'error', text: string) => void;
	}

	let {
		maps = [],
		missions = [],
		slug,
		onMapSaved,
		onHotspotToggled,
		showMessage
	}: Props = $props();

	let selectedMapId = $state<string>('');
	const activeMap = $derived(maps.find((m) => m.id === selectedMapId) || maps[0]);

	$effect(() => {
		if (maps.length > 0 && (!selectedMapId || !maps.some((m) => m.id === selectedMapId))) {
			selectedMapId = maps[0].id;
		}
	});

	let mapImageFile = $state<File | null>(null);
	let uploadingMap = $state(false);
	let showNewHotspotForm = $state(false);

	let newHsTitle = $state('');
	let newHsDesc = $state('');
	let newHsCode = $state('');
	let newHsX = $state(50);
	let newHsY = $state(50);
	let newHsMissionId = $state('');
	let savingHotspot = $state(false);

	async function handleUploadMap() {
		if (!mapImageFile) {
			showMessage('error', 'Selecciona un archivo de imagen de mapa');
			return;
		}

		uploadingMap = true;
		try {
			const formData = new FormData();
			formData.append('file', mapImageFile);
			formData.append('folder', 'maps');
			const uploadRes = await fetch(`/api/event/${slug}/upload`, {
				method: 'POST',
				body: formData
			});
			const uploadJson = await uploadRes.json();
			if (!uploadJson.success) throw new Error(uploadJson.message || 'Error al subir mapa');

			const newMapObj = {
				id: activeMap?.id || `map_${Date.now()}`,
				name: activeMap?.name || 'Plano Principal del Evento',
				image_url: uploadJson.url,
				hotspots: activeMap?.hotspots || []
			};

			const saveRes = await fetch(`/api/event/${slug}/admin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'save_map',
					map: newMapObj
				})
			});
			const saveJson = await saveRes.json();
			if (saveJson.success) {
				onMapSaved(saveJson.map);
				mapImageFile = null;
				showMessage('success', 'Plano del mapa actualizado con éxito');
			} else {
				throw new Error(saveJson.message || 'Error al guardar plano');
			}
		} catch (err: any) {
			showMessage('error', err.message || 'Falla al actualizar plano');
		} finally {
			uploadingMap = false;
		}
	}

	function handleMapClick(e: MouseEvent) {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
		const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
		newHsX = Math.max(0, Math.min(100, x));
		newHsY = Math.max(0, Math.min(100, y));
		showNewHotspotForm = true;
		showMessage('success', `Punto fijado en (${newHsX}%, ${newHsY}%). Completa los datos.`);
	}

	async function handleAddHotspot(e: SubmitEvent) {
		e.preventDefault();
		if (!newHsTitle.trim()) {
			showMessage('error', 'El nombre del punto es obligatorio');
			return;
		}

		savingHotspot = true;
		try {
			const currentMap = activeMap || {
				id: `map_${Date.now()}`,
				name: 'Plano Principal',
				image_url: '/images/gamescon/maps/venue_map.jpg',
				hotspots: []
			};

			const newHotspot = {
				id: `hs_${Date.now()}`,
				title: newHsTitle.trim(),
				description: newHsDesc.trim(),
				code: newHsCode.trim().toUpperCase() || undefined,
				mission_id: newHsMissionId || undefined,
				x: Number(newHsX),
				y: Number(newHsY),
				is_active: true
			};

			const updatedHotspots = [...(currentMap.hotspots || []), newHotspot];
			const updatedMap = { ...currentMap, hotspots: updatedHotspots };

			const res = await fetch(`/api/event/${slug}/admin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'save_map',
					map: updatedMap
				})
			});
			const json = await res.json();
			if (json.success) {
				onMapSaved(json.map);
				showNewHotspotForm = false;
				newHsTitle = '';
				newHsDesc = '';
				newHsCode = '';
				showMessage('success', `Punto "${newHotspot.title}" guardado en el plano`);
			} else {
				throw new Error(json.message || 'Error al guardar');
			}
		} catch (err: any) {
			showMessage('error', err.message || 'Falla al agregar punto');
		} finally {
			savingHotspot = false;
		}
	}

	async function toggleHotspotActive(hotspotId: string, currentActive: boolean) {
		if (!activeMap) return;
		const nextActive = !currentActive;
		try {
			const res = await fetch(`/api/event/${slug}/admin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'toggle_hotspot',
					map_id: activeMap.id,
					hotspot_id: hotspotId,
					is_active: nextActive
				})
			});
			const json = await res.json();
			if (json.success) {
				onHotspotToggled(activeMap.id, hotspotId, nextActive);
				showMessage('success', `Punto ${nextActive ? 'iluminado (visible)' : 'apagado (oculto)'}`);
			} else {
				throw new Error(json.message || 'Error al alternar estado');
			}
		} catch (err: any) {
			showMessage('error', err.message || 'Falla al alternar punto');
		}
	}
</script>

<div class="tab-pane">
	<div class="pane-header">
		<div>
			<h2>Control de Mapas & Puntos de Interés</h2>
			<p class="hint">Sube mapas y activa o desactiva la iluminación de hotspots en el recinto.</p>
		</div>
	</div>

	<!-- SUBIR / ACTUALIZAR IMAGEN DE PLANO -->
	<div class="map-upload-box">
		<div class="file-input-wrapper">
			<label class="custom-file-btn" for="map-file-upload">
				<Upload size={16} />
				<span>{mapImageFile ? mapImageFile.name : 'Subir nueva imagen de mapa...'}</span>
			</label>
			<input
				id="map-file-upload"
				type="file"
				accept="image/*"
				class="hidden-file-input"
				onchange={(e) => {
					const target = e.target as HTMLInputElement;
					mapImageFile = target.files?.[0] || null;
				}}
			/>
		</div>
		<button
			class="primary-btn"
			onclick={handleUploadMap}
			disabled={!mapImageFile || uploadingMap}
		>
			{uploadingMap ? 'Subiendo...' : 'Actualizar Plano'}
		</button>
	</div>

	<!-- VISOR INTERACTIVO DE MAPA -->
	{#if activeMap?.image_url}
		<div class="map-canvas-container">
			<div class="map-canvas-hint">
				Haz clic en cualquier punto del mapa para colocar un nuevo hotspot.
			</div>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="interactive-map" onclick={handleMapClick} role="img" aria-label="Plano interactivo">
				<img src={activeMap.image_url} alt="Plano del Recinto" class="map-bg-img" />
				{#each activeMap.hotspots || [] as hs (hs.id)}
					<div
						class="hotspot-pin {hs.is_active === false ? 'inactive' : 'active'}"
						style="left: {hs.x}%; top: {hs.y}%;"
						title="{hs.title} {hs.is_active === false ? '(Apagado)' : '(Iluminado)'}"
					>
						<MapPin size={22} class="pin-icon" />
						<span class="pin-label">{hs.title}</span>
					</div>
				{/each}
				{#if showNewHotspotForm}
					<div class="hotspot-pin draft" style="left: {newHsX}%; top: {newHsY}%;">
						<MapPin size={26} class="pin-icon draft" />
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- FORMULARIO DE NUEVO HOTSPOT -->
	{#if showNewHotspotForm}
		<div class="hotspot-form-card">
			<h3>Registrar Punto en ({newHsX}%, {newHsY}%)</h3>
			<form onsubmit={handleAddHotspot}>
				<div class="form-row">
					<div class="form-group">
						<label for="hs-title">Nombre del Punto / Stand *</label>
						<input
							id="hs-title"
							type="text"
							bind:value={newHsTitle}
							placeholder="Ej. Stand de Realidad Aumentada"
							required
						/>
					</div>
					<div class="form-group">
						<label for="hs-code">Código Asociado (Opcional)</label>
						<input
							id="hs-code"
							type="text"
							bind:value={newHsCode}
							placeholder="Ej. K7X2"
							class="mono"
						/>
					</div>
				</div>

				<div class="form-group">
					<label for="hs-desc">Descripción / Pista para el Jugador</label>
					<textarea
						id="hs-desc"
						rows="2"
						bind:value={newHsDesc}
						placeholder="Pista visual o instrucciones para los agentes."
					></textarea>
				</div>

				<div class="modal-actions">
					<button
						type="button"
						class="secondary-btn"
						onclick={() => (showNewHotspotForm = false)}
					>
						Cancelar
					</button>
					<button type="submit" class="primary-btn" disabled={savingHotspot}>
						{savingHotspot ? 'Guardando...' : 'Fijar Punto'}
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- LISTA DE HOTSPOTS -->
	<div class="hotspots-list-section">
		<h3>Puntos Configurados ({(activeMap?.hotspots || []).length})</h3>
		{#if (activeMap?.hotspots || []).length === 0}
			<div class="empty-state">No hay puntos registrados en este mapa. Haz clic sobre el mapa para añadir uno.</div>
		{:else}
			<div class="hotspots-grid">
				{#each activeMap?.hotspots || [] as hs (hs.id)}
					<div class="hotspot-item-card {hs.is_active === false ? 'muted-card' : ''}">
						<div class="hs-item-header">
							<strong>{hs.title}</strong>
							<span class="coord-badge mono">({hs.x}%, {hs.y}%)</span>
						</div>
						<p class="hs-item-desc">{hs.description || 'Sin descripción.'}</p>
						{#if hs.code}
							<p class="hs-item-code">Código: <code>{hs.code}</code></p>
						{/if}
						<div class="hs-item-actions">
							<button
								class="toggle-btn {hs.is_active !== false ? 'btn-active' : 'btn-inactive'}"
								onclick={() => toggleHotspotActive(hs.id, hs.is_active !== false)}
							>
								{#if hs.is_active !== false}
									<Eye size={14} />
									<span>ILUMINADO (ACTIVO)</span>
								{:else}
									<EyeOff size={14} />
									<span>APAGADO (OCULTO)</span>
								{/if}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
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
	.map-upload-box {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.file-input-wrapper {
		flex: 1;
		min-width: 250px;
	}
	.custom-file-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px dashed rgba(255, 255, 255, 0.2);
		padding: 0.65rem 1rem;
		border-radius: var(--radius-md, 8px);
		color: #cbd5e1;
		cursor: pointer;
		font-size: var(--text-sm, 0.875rem);
		transition: all 0.2s ease;
	}
	.custom-file-btn:hover {
		border-color: #6366f1;
		color: #fff;
	}
	.hidden-file-input {
		display: none;
	}
	.map-canvas-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.map-canvas-hint {
		font-size: var(--text-xs, 0.75rem);
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.1);
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		border-left: 3px solid #38bdf8;
	}
	.interactive-map {
		position: relative;
		width: 100%;
		border-radius: var(--radius-lg, 12px);
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: #090d16;
		cursor: crosshair;
	}
	.map-bg-img {
		width: 100%;
		height: auto;
		display: block;
		user-select: none;
	}
	.hotspot-pin {
		position: absolute;
		transform: translate(-50%, -100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		pointer-events: none;
		transition: all 0.2s ease;
	}
	:global(.pin-icon) {
		filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
	}
	:global(.hotspot-pin.active .pin-icon) {
		color: #38bdf8;
		animation: pulse-pin 2s infinite;
	}
	:global(.hotspot-pin.inactive .pin-icon) {
		color: #64748b;
		opacity: 0.6;
	}
	:global(.hotspot-pin.draft .pin-icon) {
		color: #f59e0b;
		animation: bounce-pin 1s infinite alternate;
	}
	@keyframes pulse-pin {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.15); }
	}
	@keyframes bounce-pin {
		0% { transform: translateY(0); }
		100% { transform: translateY(-8px); }
	}
	.pin-label {
		background: rgba(15, 23, 42, 0.9);
		color: #fff;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		font-size: 0.65rem;
		font-weight: 700;
		white-space: nowrap;
		margin-top: -2px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.hotspot-form-card {
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid #6366f1;
		border-radius: var(--radius-lg, 12px);
		padding: 1.25rem;
	}
	.hotspot-form-card h3 {
		margin: 0 0 1rem 0;
		font-size: var(--text-base, 1rem);
		color: #a5b4fc;
	}
	.hotspots-list-section h3 {
		margin: 0 0 1rem 0;
		font-size: var(--text-lg, 1.125rem);
	}
	.hotspots-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}
	.hotspot-item-card {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-lg, 12px);
		padding: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.hotspot-item-card.muted-card {
		opacity: 0.6;
		background: rgba(15, 23, 42, 0.4);
	}
	.hs-item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.coord-badge {
		font-size: 0.7rem;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		color: #94a3b8;
	}
	.hs-item-desc {
		margin: 0;
		font-size: var(--text-xs, 0.75rem);
		color: #94a3b8;
	}
	.hs-item-code {
		margin: 0;
		font-size: var(--text-xs, 0.75rem);
		color: #cbd5e1;
	}
	.hs-item-code code {
		background: rgba(56, 189, 248, 0.2);
		color: #38bdf8;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		font-weight: 800;
	}
	.toggle-btn {
		width: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.45rem;
		border-radius: 6px;
		font-size: var(--text-xs, 0.75rem);
		font-weight: 800;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
	}
	.toggle-btn.btn-active {
		background: rgba(34, 197, 94, 0.2);
		color: #4ade80;
		border: 1px solid rgba(34, 197, 94, 0.4);
	}
	.toggle-btn.btn-inactive {
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
		border: 1px solid rgba(239, 68, 68, 0.3);
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
		margin-bottom: 1rem;
	}
	.form-row {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 0.75rem;
	}
	.form-group label {
		font-size: var(--text-xs, 0.75rem);
		font-weight: 700;
		color: #94a3b8;
	}
	.form-group input, .form-group textarea {
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #fff;
		padding: 0.6rem 0.8rem;
		border-radius: var(--radius-md, 8px);
		font-family: inherit;
		font-size: var(--text-sm, 0.875rem);
	}
	.form-group input:focus, .form-group textarea:focus {
		outline: none;
		border-color: #6366f1;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.mono {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
	}
</style>

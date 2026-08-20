<script lang="ts">
	import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
	import Download from '@lucide/svelte/icons/download';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Users from '@lucide/svelte/icons/users';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import Zap from '@lucide/svelte/icons/zap';
	import Share2 from '@lucide/svelte/icons/share-2';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import FileText from '@lucide/svelte/icons/file-text';
	import Clock from '@lucide/svelte/icons/clock';
	import Target from '@lucide/svelte/icons/target';

	import Bot from '@lucide/svelte/icons/bot';
	import MessageSquareText from '@lucide/svelte/icons/message-square-text';
	import Search from '@lucide/svelte/icons/search';

	let {
		slug,
		showMessage
	}: {
		slug: string;
		showMessage: (type: 'success' | 'error', text: string) => void;
	} = $props();

	let loading = $state(true);
	let refreshing = $state(false);
	let exporting = $state(false);

	let overview = $state<any>(null);
	let hourlyMissions = $state<any[]>([]);
	let hourlyActivity = $state<any[]>([]);
	let mechanics = $state<any>(null);
	let networking = $state<any>(null);
	let economy = $state<any>(null);
	let reflections = $state<any[]>([]);
	let reflectionSearch = $state('');

	let activeTimelineView = $state<'missions' | 'activity'>('missions');
	let selectedExportType = $state<'overview' | 'missions' | 'hourly' | 'networking' | 'economy' | 'ai_prompts'>('overview');

	async function loadAnalyticsData() {
		try {
			const [resOverview, resHourlyMissions, resHourlyActivity, resMechanics, resNetworking, resEconomy, resReflections] = await Promise.all([
				fetch(`/api/event/${slug}/admin`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'get_analytics_overview' })
				}).then((r) => r.json()),
				fetch(`/api/event/${slug}/admin`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'get_hourly_missions' })
				}).then((r) => r.json()),
				fetch(`/api/event/${slug}/admin`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'get_hourly_activity' })
				}).then((r) => r.json()),
				fetch(`/api/event/${slug}/admin`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'get_mechanics_report' })
				}).then((r) => r.json()),
				fetch(`/api/event/${slug}/admin`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'get_networking_report' })
				}).then((r) => r.json()),
				fetch(`/api/event/${slug}/admin`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'get_economy_report' })
				}).then((r) => r.json()),
				fetch(`/api/event/${slug}/admin`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'get_ai_reflections' })
				}).then((r) => r.json())
			]);

			if (resOverview.success) overview = resOverview.overview;
			if (resHourlyMissions.success) hourlyMissions = resHourlyMissions.hourlyMissions;
			if (resHourlyActivity.success) hourlyActivity = resHourlyActivity.hourlyActivity;
			if (resMechanics.success) mechanics = resMechanics.mechanics;
			if (resNetworking.success) networking = resNetworking.networking;
			if (resEconomy.success) economy = resEconomy.economy;
			if (resReflections.success) reflections = resReflections.reflections;
		} catch (err) {
			console.error('Error al cargar analíticas:', err);
			showMessage('error', 'No se pudieron cargar las analíticas en tiempo real.');
		} finally {
			loading = false;
			refreshing = false;
		}
	}

	$effect(() => {
		loadAnalyticsData();
	});

	async function handleRefresh() {
		refreshing = true;
		await loadAnalyticsData();
		showMessage('success', 'Analíticas y métricas horarias actualizadas.');
	}

	async function handleExportCSV() {
		exporting = true;
		try {
			const res = await fetch(`/api/event/${slug}/admin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'export_analytics_csv',
					report_type: selectedExportType
				})
			});
			const json = await res.json();
			if (json.success && json.csv) {
				const blob = new Blob([json.csv], { type: 'text/csv;charset=utf-8;' });
				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.setAttribute('href', url);
				link.setAttribute('download', `reporte_${selectedExportType}_${slug}_${new Date().toISOString().slice(0, 10)}.csv`);
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				showMessage('success', `Reporte "${selectedExportType}" exportado con éxito.`);
			} else {
				showMessage('error', 'Error al generar el archivo CSV.');
			}
		} catch {
			showMessage('error', 'Error de conexión al exportar reporte.');
		} finally {
			exporting = false;
		}
	}

	const filteredReflections = $derived(
		reflections.filter((r) => {
			if (!reflectionSearch.trim()) return true;
			const q = reflectionSearch.toLowerCase();
			return (
				(r.player_name || '').toLowerCase().includes(q) ||
				(r.mission_title || '').toLowerCase().includes(q) ||
				(r.faction_name || '').toLowerCase().includes(q) ||
				(r.user_response_text || '').toLowerCase().includes(q)
			);
		})
	);

	// Cálculo del valor máximo para escalar visualmente las barras horarias
	const maxHourlyMissions = $derived(
		hourlyMissions.length > 0 ? Math.max(...hourlyMissions.map((h) => h.count), 1) : 1
	);

	const maxHourlyActivity = $derived(
		hourlyActivity.length > 0 ? Math.max(...hourlyActivity.map((h) => h.totalEvents), 1) : 1
	);
</script>

<div class="analytics-tab-container">
	<!-- HEADER SUPERIOR DE ANALÍTICAS -->
	<div class="analytics-header">
		<div>
			<h2 class="section-title">
				<BarChart3 size={22} class="title-icon" />
				Métricas & Analíticas de Comportamiento
			</h2>
			<p class="section-desc">
				Monitoreo de engagement, ritmo horario de misiones, efectividad de mecánicas y reportes para exportación.
			</p>
		</div>

		<div class="header-actions">
			<button class="btn-refresh" onclick={handleRefresh} disabled={refreshing || loading}>
				<RefreshCw size={16} class={refreshing ? 'spin' : ''} />
				<span>{refreshing ? 'Actualizando...' : 'Refrescar Datos'}</span>
			</button>
		</div>
	</div>

	{#if loading}
		<div class="loading-state">
			<RefreshCw size={32} class="spin loader-icon" />
			<p>Analizando eventos de juego en tiempo real...</p>
		</div>
	{:else}
		<!-- RESUMEN DE KPIS -->
		<div class="kpi-grid">
			<div class="kpi-card">
				<div class="kpi-icon-wrap icon-cyan">
					<Users size={20} />
				</div>
				<div class="kpi-body">
					<span class="kpi-label">Agentes Activos</span>
					<span class="kpi-value">{overview?.playersJoined ?? 0}</span>
					<span class="kpi-sub">{overview?.uniqueActiveUsers ?? 0} usuarios interactuando</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-icon-wrap icon-green">
					<CheckCircle2 size={20} />
				</div>
				<div class="kpi-body">
					<span class="kpi-label">Misiones Resueltas</span>
					<span class="kpi-value">{overview?.missionsCompleted ?? 0}</span>
					<span class="kpi-sub">Tasa de éxito: {overview?.completionRate ?? 100}%</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-icon-wrap icon-purple">
					<Zap size={20} />
				</div>
				<div class="kpi-body">
					<span class="kpi-label">Códigos Canjeados</span>
					<span class="kpi-value">{overview?.codesRedeemed ?? 0}</span>
					<span class="kpi-sub">Misiones, recinto y GMs</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-icon-wrap icon-blue">
					<Share2 size={20} />
				</div>
				<div class="kpi-body">
					<span class="kpi-label">Contactos Escaneados</span>
					<span class="kpi-value">{overview?.contactsScanned ?? 0}</span>
					<span class="kpi-sub">{networking?.totalProfilesActivated ?? 0} perfiles @código activos</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-icon-wrap icon-amber">
					<ShoppingBag size={20} />
				</div>
				<div class="kpi-body">
					<span class="kpi-label">Canjes en Bóveda</span>
					<span class="kpi-value">{overview?.rewardsPurchased ?? 0}</span>
					<span class="kpi-sub">{economy?.totalCpSpent ?? 0} 💠 Ludens gastados</span>
				</div>
			</div>

			<div class="kpi-card">
				<div class="kpi-icon-wrap icon-emerald">
					<FileText size={20} />
				</div>
				<div class="kpi-body">
					<span class="kpi-label">Tratados Firmados</span>
					<span class="kpi-value">{overview?.treatiesSigned ?? 0}</span>
					<span class="kpi-sub">{overview?.votesSubmitted ?? 0} votos en plenaria</span>
				</div>
			</div>
		</div>

		<!-- LÍNEA DE TIEMPO Y ACTIVIDAD POR HORA -->
		<div class="analytics-card timeline-card">
			<div class="card-header">
				<div>
					<h3 class="card-title">
						<Clock size={18} />
						Ritmo de Actividad y Misiones por Hora
					</h3>
					<p class="card-subtitle">Distribución temporal del flujo de jugadores a lo largo del evento.</p>
				</div>

				<div class="toggle-group">
					<button
						class="btn-toggle {activeTimelineView === 'missions' ? 'active' : ''}"
						onclick={() => (activeTimelineView = 'missions')}
					>
						Misiones / Hora
					</button>
					<button
						class="btn-toggle {activeTimelineView === 'activity' ? 'active' : ''}"
						onclick={() => (activeTimelineView = 'activity')}
					>
						Eventos Totales / Hora
					</button>
				</div>
			</div>

			<div class="timeline-chart-wrap">
				{#if activeTimelineView === 'missions'}
					{#if hourlyMissions.length === 0 || (hourlyMissions.length === 1 && hourlyMissions[0].count === 0)}
						<div class="empty-chart">
							<p>Aún no hay misiones completadas registradas en el periodo.</p>
						</div>
					{:else}
						<div class="bars-container">
							{#each hourlyMissions as hour}
								{@const heightPercent = Math.max(Math.round((hour.count / maxHourlyMissions) * 100), 8)}
								<div class="bar-col">
									<div class="bar-value">{hour.count}</div>
									<div class="bar-track">
										<div class="bar-fill cyan-fill" style="height: {heightPercent}%;"></div>
									</div>
									<div class="bar-label">{hour.hourLabel}</div>
								</div>
							{/each}
						</div>
					{/if}
				{:else}
					{#if hourlyActivity.length === 0}
						<div class="empty-chart">
							<p>Aún no hay eventos de actividad registrados en el periodo.</p>
						</div>
					{:else}
						<div class="bars-container">
							{#each hourlyActivity as hour}
								{@const heightPercent = Math.max(Math.round((hour.totalEvents / maxHourlyActivity) * 100), 8)}
								<div class="bar-col">
									<div class="bar-value">{hour.totalEvents}</div>
									<div class="bar-track">
										<div class="bar-fill purple-fill" style="height: {heightPercent}%;"></div>
									</div>
									<div class="bar-label">{hour.hourLabel}</div>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</div>

		<!-- ANÁLISIS DE EFECTIVIDAD POR MECÁNICA -->
		<div class="analytics-card">
			<div class="card-header">
				<div>
					<h3 class="card-title">
						<Target size={18} />
						Rendimiento y Fricción por Mecánica de Juego
					</h3>
					<p class="card-subtitle">Tasas de acierto, promedios y comportamiento por tipo de reto.</p>
				</div>
			</div>

			<div class="table-responsive">
				<table class="analytics-table">
					<thead>
						<tr>
							<th>Mecánica</th>
							<th>Intentos Totales</th>
							<th>Éxitos</th>
							<th>Fallos / Expiradas</th>
							<th>Tasa de Éxito</th>
							<th>Métricas Clave</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<span class="badge-type type-dice">🎲 Tirada de Dados (d20)</span>
							</td>
							<td>{mechanics?.dice_check?.totalAttempts ?? 0}</td>
							<td class="text-success">{mechanics?.dice_check?.successCount ?? 0}</td>
							<td class="text-danger">{mechanics?.dice_check?.failCount ?? 0}</td>
							<td>
								<span class="pill-rate">{mechanics?.dice_check?.successRate ?? 0}%</span>
							</td>
							<td class="text-dim">
								Dado Prom: <strong>{mechanics?.dice_check?.details?.avgRoll ?? '-'}</strong> •
								Boosts SP: {mechanics?.dice_check?.details?.spBoostCount ?? 0}
							</td>
						</tr>

						<tr>
							<td>
								<span class="badge-type type-trivia">❓ Trivia & Desmitificación</span>
							</td>
							<td>{mechanics?.trivia_quiz?.totalAttempts ?? 0}</td>
							<td class="text-success">{mechanics?.trivia_quiz?.successCount ?? 0}</td>
							<td class="text-danger">{mechanics?.trivia_quiz?.failCount ?? 0}</td>
							<td>
								<span class="pill-rate">{mechanics?.trivia_quiz?.successRate ?? 0}%</span>
							</td>
							<td class="text-dim">Acierto directo en opciones</td>
						</tr>

						<tr>
							<td>
								<span class="badge-type type-ai">🤖 Reflexión GIOCCHI (LLM)</span>
							</td>
							<td>{mechanics?.ai_prompt_challenge?.totalAttempts ?? 0}</td>
							<td class="text-success">{mechanics?.ai_prompt_challenge?.successCount ?? 0}</td>
							<td class="text-dim">0</td>
							<td>
								<span class="pill-rate">100%</span>
							</td>
							<td class="text-dim">
								XP Prom: <strong>+{mechanics?.ai_prompt_challenge?.details?.avgAiScore ?? 0} XP</strong> •
								Fallbacks: {mechanics?.ai_prompt_challenge?.details?.fallbackCount ?? 0}
							</td>
						</tr>

						<tr>
							<td>
								<span class="badge-type type-timebomb">⏱️ Time-Bomb Contrarreloj</span>
							</td>
							<td>{mechanics?.time_bomb?.totalAttempts ?? 0}</td>
							<td class="text-success">{mechanics?.time_bomb?.details?.defused ?? 0}</td>
							<td class="text-danger">{mechanics?.time_bomb?.details?.expired ?? 0}</td>
							<td>
								<span class="pill-rate">{mechanics?.time_bomb?.successRate ?? 0}%</span>
							</td>
							<td class="text-dim">Desactivadas vs Penalizadas</td>
						</tr>

						<tr>
							<td>
								<span class="badge-type type-code">🔑 Canje de Códigos</span>
							</td>
							<td>{mechanics?.code?.totalAttempts ?? 0}</td>
							<td class="text-success">{mechanics?.code?.successCount ?? 0}</td>
							<td class="text-danger">{mechanics?.code?.failCount ?? 0}</td>
							<td>
								<span class="pill-rate">{mechanics?.code?.successRate ?? 0}%</span>
							</td>
							<td class="text-dim">Válidos vs Inválidos/Expirados</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- REGISTRO DE REFLEXIONES GIOCCHI -->
		<div class="analytics-card reflections-card">
			<div class="card-header">
				<div>
					<h3 class="card-title">
						<MessageSquareText size={18} />
						Reflexiones de Agentes ante GIOCCHI ({reflections.length})
					</h3>
					<p class="card-subtitle">
						Monitoreo cualitativo de las respuestas redactadas por los participantes en misiones de Inteligencia Artificial.
					</p>
				</div>

				<div class="reflections-search-wrap">
					<Search size={14} class="search-icon" />
					<input
						type="text"
						bind:value={reflectionSearch}
						placeholder="Buscar por agente, misión o texto..."
						class="reflection-search-input"
					/>
				</div>
			</div>

			{#if filteredReflections.length === 0}
				<div class="empty-reflections">
					{#if reflections.length === 0}
						<Bot size={28} class="empty-icon" />
						<p>Aún no hay reflexiones de IA registradas en este evento.</p>
					{:else}
						<Search size={28} class="empty-icon" />
						<p>No se encontraron reflexiones que coincidan con la búsqueda.</p>
					{/if}
				</div>
			{:else}
				<div class="table-responsive reflections-table-wrap">
					<table class="analytics-table">
						<thead>
							<tr>
								<th>Agente / Facción</th>
								<th>Misión</th>
								<th>Texto Escrito por el Jugador</th>
								<th>Puntaje XP</th>
								<th>Evaluación de GIOCCHI</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredReflections as ref}
								<tr>
									<td class="player-cell">
										<strong class="player-name">{ref.player_name || 'Agente'}</strong>
										<span class="player-faction">{ref.faction_name || ref.faction_id || 'Sin Facción'}</span>
										{#if ref.avatar_title}
											<span class="player-role">{ref.avatar_title}</span>
										{/if}
									</td>
									<td class="mission-cell">
										<span class="mission-title">{ref.mission_title || ref.mission_id}</span>
										<span class="mission-date">{new Date(ref.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
									</td>
									<td class="response-cell">
										<div class="response-bubble">
											"{ref.user_response_text || 'Sin texto registrado'}"
										</div>
									</td>
									<td class="score-cell">
										<span class="pill-score {ref.score_xp >= 25 ? 'score-high' : 'score-low'}">
											+{ref.score_xp} XP
										</span>
										{#if ref.is_fallback}
											<span class="fallback-tag">Offline</span>
										{/if}
									</td>
									<td class="feedback-cell">
										<div class="feedback-text">
											{ref.giocchi_feedback || 'Sin retroalimentación'}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- EXPORTACIÓN DE REPORTES -->
		<div class="analytics-card export-card">
			<div class="card-header">
				<div>
					<h3 class="card-title">
						<Download size={18} />
						Generador y Exportador de Reportes (CSV)
					</h3>
					<p class="card-subtitle">Descarga conjuntos de datos tabulares para análisis en Excel, PowerBI o memorias de evento.</p>
				</div>
			</div>

			<div class="export-controls">
				<div class="export-select-wrap">
					<label for="export-type-select" class="form-label">Tipo de Reporte:</label>
					<select id="export-type-select" bind:value={selectedExportType} class="select-field">
						<option value="overview">Resumen Ejecutivo de KPIs</option>
						<option value="ai_prompts">Reflexiones de Jugadores en Retos de IA (GIOCCHI)</option>
						<option value="hourly">Misiones Completadas por Franjas Horarias</option>
						<option value="missions">Histórico Detallado de Resoluciones de Misión</option>
						<option value="networking">Registro de Intercambios de Contactos</option>
						<option value="economy">Flujo Económico y Canjes de Bóveda</option>
					</select>
				</div>

				<button class="btn-export" onclick={handleExportCSV} disabled={exporting}>
					<Download size={16} class={exporting ? 'spin' : ''} />
					<span>{exporting ? 'Generando CSV...' : 'Descargar Archivo CSV'}</span>
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.analytics-tab-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding-bottom: 2rem;
	}

	.analytics-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.25rem;
		font-weight: 700;
		color: #f8fafc;
		margin: 0;
	}

	:global(.title-icon) {
		color: #38bdf8;
	}

	.section-desc {
		color: #94a3b8;
		font-size: 0.875rem;
		margin: 0.35rem 0 0 0;
	}

	.btn-refresh {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(56, 189, 248, 0.1);
		border: 1px solid rgba(56, 189, 248, 0.25);
		color: #38bdf8;
		padding: 0.5rem 0.85rem;
		border-radius: 8px;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-refresh:hover:not(:disabled) {
		background: rgba(56, 189, 248, 0.2);
		border-color: rgba(56, 189, 248, 0.4);
	}

	.btn-refresh:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 1rem;
		gap: 1rem;
		color: #94a3b8;
		font-size: 0.9375rem;
	}

	:global(.loader-icon) {
		color: #38bdf8;
	}

	/* KPI GRID */
	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
	}

	.kpi-card {
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(51, 65, 85, 0.6);
		border-radius: 12px;
		padding: 1.125rem;
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		backdrop-filter: blur(8px);
	}

	.kpi-icon-wrap {
		padding: 0.65rem;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.icon-cyan {
		background: rgba(6, 182, 212, 0.15);
		color: #22d3ee;
		border: 1px solid rgba(6, 182, 212, 0.3);
	}

	.icon-green {
		background: rgba(34, 197, 94, 0.15);
		color: #4ade80;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.icon-purple {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
		border: 1px solid rgba(168, 85, 247, 0.3);
	}

	.icon-blue {
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
		border: 1px solid rgba(59, 130, 246, 0.3);
	}

	.icon-amber {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
		border: 1px solid rgba(245, 158, 11, 0.3);
	}

	.icon-emerald {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
		border: 1px solid rgba(16, 185, 129, 0.3);
	}

	.kpi-body {
		display: flex;
		flex-direction: column;
	}

	.kpi-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
		font-weight: 600;
	}

	.kpi-value {
		font-size: 1.5rem;
		font-weight: 800;
		color: #f8fafc;
		margin: 0.2rem 0;
	}

	.kpi-sub {
		font-size: 0.75rem;
		color: #64748b;
	}

	/* CARDS GENERALES */
	.analytics-card {
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(51, 65, 85, 0.6);
		border-radius: 12px;
		padding: 1.25rem;
		backdrop-filter: blur(8px);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.card-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
		font-weight: 700;
		color: #f1f5f9;
		margin: 0;
	}

	.card-subtitle {
		font-size: 0.8125rem;
		color: #94a3b8;
		margin: 0.25rem 0 0 0;
	}

	.toggle-group {
		display: flex;
		background: rgba(30, 41, 59, 0.8);
		border-radius: 8px;
		padding: 0.25rem;
		border: 1px solid rgba(71, 85, 105, 0.5);
	}

	.btn-toggle {
		background: transparent;
		border: none;
		color: #94a3b8;
		padding: 0.35rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-toggle.active {
		background: #38bdf8;
		color: #0f172a;
	}

	/* CHART HORARIO */
	.timeline-chart-wrap {
		background: rgba(10, 15, 30, 0.6);
		border: 1px solid rgba(51, 65, 85, 0.4);
		border-radius: 10px;
		padding: 1.25rem 1rem;
		min-height: 180px;
		display: flex;
		align-items: flex-end;
		overflow-x: auto;
	}

	.empty-chart {
		width: 100%;
		text-align: center;
		color: #64748b;
		font-size: 0.875rem;
		padding: 2rem 0;
	}

	.bars-container {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
		min-width: 100%;
		height: 160px;
		padding-top: 1.5rem;
	}

	.bar-col {
		flex: 1;
		min-width: 48px;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		justify-content: flex-end;
		gap: 0.35rem;
	}

	.bar-value {
		font-size: 0.75rem;
		font-weight: 700;
		color: #f1f5f9;
	}

	.bar-track {
		width: 24px;
		height: 100px;
		background: rgba(51, 65, 85, 0.3);
		border-radius: 6px;
		display: flex;
		align-items: flex-end;
		overflow: hidden;
	}

	.bar-fill {
		width: 100%;
		border-radius: 6px 6px 0 0;
		transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.cyan-fill {
		background: linear-gradient(180deg, #38bdf8 0%, #0284c7 100%);
		box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
	}

	.purple-fill {
		background: linear-gradient(180deg, #c084fc 0%, #7e22ce 100%);
		box-shadow: 0 0 10px rgba(192, 132, 252, 0.4);
	}

	.bar-label {
		font-size: 0.6875rem;
		color: #94a3b8;
		font-weight: 600;
		white-space: nowrap;
	}

	/* TABLA ANALÍTICA */
	.table-responsive {
		overflow-x: auto;
	}

	.analytics-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		font-size: 0.8125rem;
	}

	.analytics-table th {
		padding: 0.75rem 1rem;
		background: rgba(30, 41, 59, 0.6);
		color: #94a3b8;
		font-weight: 600;
		border-bottom: 1px solid rgba(71, 85, 105, 0.4);
		text-transform: uppercase;
		font-size: 0.6875rem;
		letter-spacing: 0.05em;
	}

	.analytics-table td {
		padding: 0.85rem 1rem;
		border-bottom: 1px solid rgba(51, 65, 85, 0.3);
		color: #f1f5f9;
	}

	.badge-type {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		display: inline-block;
	}

	.type-dice {
		background: rgba(245, 158, 11, 0.15);
		color: #fbbf24;
		border: 1px solid rgba(245, 158, 11, 0.3);
	}

	.type-trivia {
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
		border: 1px solid rgba(59, 130, 246, 0.3);
	}

	.type-ai {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
		border: 1px solid rgba(168, 85, 247, 0.3);
	}

	.type-timebomb {
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.type-code {
		background: rgba(34, 197, 94, 0.15);
		color: #4ade80;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.pill-rate {
		font-weight: 700;
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.1);
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
	}

	.text-success {
		color: #4ade80;
		font-weight: 600;
	}

	.text-danger {
		color: #f87171;
		font-weight: 600;
	}

	.text-dim {
		color: #94a3b8;
		font-size: 0.75rem;
	}

	/* EXPORT CARD */
	.export-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1rem;
		background: rgba(10, 15, 30, 0.5);
		padding: 1rem;
		border-radius: 10px;
		border: 1px solid rgba(51, 65, 85, 0.4);
	}

	.export-select-wrap {
		flex: 1;
		min-width: 240px;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.select-field {
		background: rgba(30, 41, 59, 0.9);
		border: 1px solid rgba(71, 85, 105, 0.6);
		color: #f8fafc;
		padding: 0.6rem 0.85rem;
		border-radius: 8px;
		font-size: 0.875rem;
		outline: none;
		cursor: pointer;
	}

	.select-field:focus {
		border-color: #38bdf8;
	}

	.btn-export {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: #0284c7;
		color: #ffffff;
		border: none;
		padding: 0.65rem 1.25rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-export:hover:not(:disabled) {
		background: #0369a1;
	}

	.btn-export:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* REFLECTIONS SECTION */
	.reflections-card {
		background: rgba(15, 23, 42, 0.85);
	}

	.reflections-search-wrap {
		position: relative;
		display: flex;
		align-items: center;
		min-width: 260px;
	}

	.reflections-search-wrap :global(.search-icon) {
		position: absolute;
		left: 0.75rem;
		color: #64748b;
		pointer-events: none;
	}

	.reflection-search-input {
		width: 100%;
		background: rgba(10, 15, 30, 0.7);
		border: 1px solid rgba(71, 85, 105, 0.5);
		border-radius: 8px;
		padding: 0.5rem 0.75rem 0.5rem 2.2rem;
		color: #f1f5f9;
		font-size: 0.825rem;
		outline: none;
		transition: border-color 0.2s ease;
	}

	.reflection-search-input:focus {
		border-color: #a855f7;
	}

	.empty-reflections {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2.5rem 1rem;
		color: #64748b;
		gap: 0.75rem;
	}

	.empty-reflections :global(.empty-icon) {
		color: #475569;
	}

	.reflections-table-wrap {
		max-height: 480px;
		overflow-y: auto;
	}

	.player-cell {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 140px;
	}

	.player-name {
		color: #f8fafc;
		font-size: 0.875rem;
	}

	.player-faction {
		font-size: 0.7rem;
		color: #a855f7;
		font-weight: 500;
	}

	.player-role {
		font-size: 0.65rem;
		color: #64748b;
	}

	.mission-cell {
		min-width: 130px;
	}

	.mission-title {
		display: block;
		font-size: 0.825rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.mission-date {
		font-size: 0.7rem;
		color: #64748b;
	}

	.response-cell {
		max-width: 320px;
		min-width: 220px;
	}

	.response-bubble {
		background: rgba(30, 41, 59, 0.6);
		border-left: 3px solid #a855f7;
		padding: 0.6rem 0.8rem;
		border-radius: 0 8px 8px 0;
		font-size: 0.8rem;
		color: #f1f5f9;
		line-height: 1.4;
		font-style: italic;
		word-break: break-word;
	}

	.score-cell {
		min-width: 90px;
		vertical-align: middle;
	}

	.pill-score {
		display: inline-block;
		font-weight: 700;
		font-size: 0.75rem;
		padding: 0.25rem 0.55rem;
		border-radius: 6px;
	}

	.score-high {
		background: rgba(168, 85, 247, 0.15);
		color: #c084fc;
		border: 1px solid rgba(168, 85, 247, 0.3);
	}

	.score-low {
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.fallback-tag {
		display: block;
		font-size: 0.65rem;
		color: #f59e0b;
		margin-top: 0.25rem;
		font-weight: 600;
	}

	.feedback-cell {
		max-width: 340px;
		min-width: 200px;
	}

	.feedback-text {
		font-size: 0.78rem;
		color: #94a3b8;
		line-height: 1.35;
		word-break: break-word;
	}

	/* ANIMACIONES */
	:global(.spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>

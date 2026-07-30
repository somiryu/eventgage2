<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const { data } = $props();

	// Estado local reactivo
	let activeTab = $state<'hud' | 'missions' | 'map' | 'feed' | 'profile'>('hud');
	let player = $state(data.playerState);
	let selectedFactionId = $state(data.factions[0]?.id || '');
	let selectedAvatarId = $state(data.avatarsCatalog[0]?.id || '');
	let joining = $state(false);

	// Formularios de Misiones y Códigos
	let codeInput = $state('');
	let codeMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let submittingCode = $state(false);
	let selectedMission = $state<any>(null);

	// Votaciones y Mapas
	let selectedHotspot = $state<any>(null);
	let votedOption = $state<string | null>(null);
	let voting = $state(false);

	let activeAlert = $state<{ message: string; type: string; secondsLeft: number } | null>({
		message: '¡Bienvenido a CyberCon 2026 Demo! Explora el mapa y descifra tus primeras misiones.',
		type: 'info',
		secondsLeft: 30
	});

	// Temporizador para Time-Bomb
	let timeBombSeconds = $state(600);
	$effect(() => {
		const interval = setInterval(() => {
			if (timeBombSeconds > 0) timeBombSeconds--;
			if (activeAlert && activeAlert.secondsLeft > 0) activeAlert.secondsLeft--;
		}, 1000);
		return () => clearInterval(interval);
	});

	// Misiones Demo
	const demoMissions = $derived([
		{
			id: 'm_code_01',
			title: 'El Código de la Red',
			type: 'code',
			preview: 'Descifra el código oculto impreso en el mapa o señalización del evento.',
			description: 'Encuentra el código impreso en el mapa táctico o en los banners del evento. Código de prueba disponible: DEMO2026',
			unlocked: true,
			completed: player?.game_status?.journal?.some((j: any) => j.id === 'entry_1') || false,
			xp: 150,
			cp: 50
		},
		{
			id: 'm_time_bomb_01',
			title: 'Desactivación Contrarreloj (Time-Bomb)',
			type: 'time_bomb',
			preview: '¡Alerta! Neutraliza la bomba de datos antes de que expire el temporizador.',
			description: 'La IA enemiga está infectando el servidor. Introduce la clave DISABLE_99 antes de que expire el tiempo.',
			unlocked: player?.game_status?.unlocked_missions?.includes('m_time_bomb_01') || false,
			completed: player?.game_status?.journal?.some((j: any) => j.id === 'entry_2') || false,
			xp: 250,
			cp: 100
		},
		{
			id: 'm_vote_01',
			title: 'Votación Táctica: Estrategia de Facción',
			type: 'collective_vote',
			preview: 'Elige el siguiente sector a inspeccionar por tu facción.',
			description: 'Tus votos guiarán el avance de tu bando y la apertura del siguiente capítulo.',
			unlocked: true,
			completed: votedOption !== null,
			xp: 100,
			cp: 30,
			options: [
				{ id: 'sec_a', text: 'Zona A: Stand de Robótica' },
				{ id: 'sec_b', text: 'Zona B: Escenario Principal' }
			]
		}
	]);

	// Crear perfil / avatar si no existe
	async function handleJoinEvent() {
		if (joining) return;
		joining = true;
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'join',
					avatarId: selectedAvatarId,
					factionId: selectedFactionId
				})
			});
			const resData = await res.json();
			if (resData.player) {
				player = resData.player;
			}
		} catch (e) {
			console.error(e);
		} finally {
			joining = false;
		}
	}

	// Canjear Código
	async function handleCodeSubmit(codeToSubmit?: string) {
		const targetCode = codeToSubmit || codeInput;
		if (!targetCode || submittingCode) return;
		submittingCode = true;
		codeMessage = null;

		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'submit_code',
					code: targetCode
				})
			});
			const resData = await res.json();
			if (resData.success) {
				codeMessage = { type: 'success', text: resData.message };
				if (resData.playerState) player = resData.playerState;
				codeInput = '';
			} else {
				codeMessage = { type: 'error', text: resData.message || 'Código incorrecto' };
			}
		} catch (e: any) {
			codeMessage = { type: 'error', text: 'Error al enviar código' };
		} finally {
			submittingCode = false;
		}
	}

	async function handleVote(optionId: string) {
		if (voting) return;
		voting = true;
		votedOption = optionId;
		try {
			await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'vote', optionId })
			});
		} catch (e) {
			console.error(e);
		} finally {
			voting = false;
		}
	}

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto(`/register?event=${data.event.slug}`);
	}

	function formatTime(secs: number) {
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}
</script>

<!-- IF PLAYER HAS NO AVATAR IN THIS EVENT -> SELECTION SCREEN -->
{#if !player}
	<div class="selection-overlay">
		<div class="selection-card">
			<div class="badge">CONFIGURACIÓN DE AGENTE</div>
			<h2>{data.event.title}</h2>
			<p class="subtitle">Elige tu Facción y Avatar para entrar al entorno del juego.</p>

			<fieldset disabled={joining} class="selection-fieldset">
				<div class="step-section">
					<h3>1. Selecciona tu Facción</h3>
					<div class="grid-options">
						{#each data.factions as f}
							<button
								type="button"
								class="option-btn {selectedFactionId === f.id ? 'active' : ''}"
								onclick={() => (selectedFactionId = f.id)}
							>
								<img src={f.icon_url} alt={f.name} class="icon-thumb" />
								<div class="opt-text">
									<strong>{f.name}</strong>
									<span class="desc">{f.description}</span>
								</div>
							</button>
						{/each}
					</div>
				</div>

				<div class="step-section">
					<h3>2. Elige tu Avatar</h3>
					<div class="grid-options avatars">
						{#each data.avatarsCatalog as a}
							<button
								type="button"
								class="option-btn {selectedAvatarId === a.id ? 'active' : ''}"
								onclick={() => (selectedAvatarId = a.id)}
							>
								<img src={a.image_url} alt={a.name} class="avatar-thumb" />
								<div class="opt-text">
									<strong>{a.name}</strong>
									<span class="desc">{a.description}</span>
								</div>
							</button>
						{/each}
					</div>
				</div>

				<button class="primary-btn confirm-btn" onclick={handleJoinEvent} disabled={joining}>
					{#if joining}
						<svg class="spinner" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span>Inicializando Agente e Ingresando...</span>
					{:else}
						<span>Confirmar e Ingresar al Evento</span>
					{/if}
				</button>
			</fieldset>
		</div>
	</div>
{:else}
	<!-- MAIN GAME INTERFACE (MOBILE FIRST) -->
	<div class="app-shell">
		<!-- ALERT OVERLAY -->
		{#if activeAlert && activeAlert.secondsLeft > 0}
			<div class="alert-banner {activeAlert.type}">
				<div class="alert-content">
					<span class="alert-icon">⚡</span>
					<span class="alert-msg">{activeAlert.message}</span>
				</div>
				<div class="alert-timer">
					<div class="alert-bar" style="width: {(activeAlert.secondsLeft / 30) * 100}%"></div>
				</div>
			</div>
		{/if}

		<!-- TOP HEADER / STATUS BAR -->
		<header class="top-bar">
			<div class="player-summary">
				<img src={player.avatar.image_url} alt={player.avatar.name} class="avatar-img" />
				<div class="player-info">
					<div class="row-title">
						<span class="agent-name">{player.avatar.name}</span>
						<span class="chapter-tag">CAP {data.event.current_chapter}</span>
					</div>
					<div class="xp-bar-container">
						<div class="xp-bar" style="width: {Math.min(100, (player.avatar.xp.points / 200) * 100)}%"></div>
					</div>
					<div class="xp-label">
						<span>NIVEL {player.avatar.xp.level}</span>
						<span>{player.avatar.xp.points} XP</span>
					</div>
				</div>
			</div>
			<div class="cp-badge">
				<span class="cp-icon">{player.avatar.cp.icon}</span>
				<span class="cp-val">{player.avatar.cp.points}</span>
			</div>
		</header>

		<!-- WORLD EVENT & FACTION POINTS WIDGET -->
		<section class="world-widget">
			<div class="point-card event-pts">
				<div class="pt-header">
					<span>AMENAZA IA (GLOBAL)</span>
					<strong>140 / 500</strong>
				</div>
				<div class="progress-bg">
					<div class="progress-fill danger" style="width: {(140 / 500) * 100}%"></div>
				</div>
			</div>

			<div class="point-card faction-pts">
				<div class="pt-header">
					<span>GREMIOS EN COMPETENCIA</span>
				</div>
				<div class="faction-bars">
					<div class="f-row">
						<span>Hackers</span>
						<div class="f-bar-bg"><div class="f-bar hackers" style="width: 75%"></div></div>
						<small>1,250 pt</small>
					</div>
					<div class="f-row">
						<span>Resistencia</span>
						<div class="f-bar-bg"><div class="f-bar resistencia" style="width: 58%"></div></div>
						<small>980 pt</small>
					</div>
				</div>
			</div>
		</section>

		<!-- TAB CONTENT CONTAINER -->
		<main class="main-content">
			{#if activeTab === 'hud'}
				<!-- HUD HOME TAB -->
				<div class="tab-pane">
					<div class="quick-code-card">
						<h3>Canje Rápido de Código</h3>
						<p class="hint">Ingresa un código hallado en el mapa o stand para desbloquear misiones o ítems.</p>
						<form onsubmit={(e) => { e.preventDefault(); handleCodeSubmit(); }} class="code-form">
							<input
								type="text"
								bind:value={codeInput}
								placeholder="Ej. DEMO2026"
								class="code-input"
								disabled={submittingCode}
							/>
							<button type="submit" class="code-btn" disabled={submittingCode}>
								{#if submittingCode}
									<svg class="spinner" viewBox="0 0 24 24" fill="none">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								{:else}
									Canjear
								{/if}
							</button>
						</form>
						{#if codeMessage}
							<div class="code-feedback {codeMessage.type}">{codeMessage.text}</div>
						{/if}
					</div>

					<div class="section-title">Misión Destacada</div>
					<div class="mission-card featured" onclick={() => { activeTab = 'missions'; selectedMission = demoMissions[0]; }}>
						<img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&auto=format&fit=crop&q=80" alt="Misión 1" class="m-thumb" />
						<div class="m-info">
							<span class="m-badge">CÓDIGO</span>
							<h4>El Código de la Red</h4>
							<p>Encuentra el código impreso en la señalización para ganar XP y Bitácora.</p>
							<div class="m-rewards">
								<span>+150 XP</span>
								<span>+50 CP</span>
							</div>
						</div>
					</div>

					<div class="section-title">Canal del Game Master</div>
					<div class="dialogue-box">
						<img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80" alt="GM" class="gm-avatar" />
						<div class="dialogue-text">
							<strong>Game Master Zero</strong>
							<p>"Bienvenido agente. Tu facción cuenta contigo para desvelar el secreto de CyberCon."</p>
						</div>
					</div>
				</div>
			{:else if activeTab === 'missions'}
				<!-- MISSIONS TAB -->
				<div class="tab-pane">
					<h2 class="pane-title">Registro de Misiones</h2>
					<div class="missions-list">
						{#each demoMissions as m}
							<div class="mission-card {m.unlocked ? '' : 'locked'} {m.completed ? 'completed' : ''}" onclick={() => { if (m.unlocked) selectedMission = m; }}>
								<div class="m-header">
									<span class="m-badge {m.type}">{m.type.toUpperCase()}</span>
									{#if m.completed}
										<span class="status-tag done">COMPLETADA ✓</span>
									{:else if !m.unlocked}
										<span class="status-tag lock">BLOQUEADA 🔒</span>
									{/if}
								</div>
								<h4>{m.title}</h4>
								<p class="m-preview">{m.preview}</p>

								{#if m.type === 'time_bomb' && m.unlocked && !m.completed}
									<div class="timer-box">
										<span>TIEMPO RESTANTE:</span>
										<strong class="timer-val">{formatTime(timeBombSeconds)}</strong>
									</div>
								{/if}

								<div class="m-rewards">
									<span>+{m.xp} XP</span>
									<span>+{m.cp} CP</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else if activeTab === 'map'}
				<!-- MAP TAB -->
				<div class="tab-pane">
					<h2 class="pane-title">Mapa Táctico - Hall Principal</h2>
					<div class="map-wrapper">
						<img src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80" alt="Mapa" class="map-img" />

						<!-- Hotspot 1 -->
						<button
							type="button"
							class="hotspot-pin pin-1"
							onclick={() => (selectedHotspot = { title: 'Terminal de Entrada', desc: 'Punto de acceso principal. Usa el código DEMO2026 aquí.', code: 'DEMO2026' })}
						>
							📍 Terminal
						</button>

						<!-- Hotspot 2 -->
						<button
							type="button"
							class="hotspot-pin pin-2"
							onclick={() => (selectedHotspot = { title: 'Zona de Hackeo Físico', desc: 'Lugar donde se desactivan bombas de datos con el código DISABLE_99.', code: 'DISABLE_99' })}
						>
							🔥 Time-Bomb
						</button>
					</div>

					{#if selectedHotspot}
						<div class="hotspot-modal">
							<h3>{selectedHotspot.title}</h3>
							<p>{selectedHotspot.desc}</p>
							<button class="primary-btn" onclick={() => handleCodeSubmit(selectedHotspot.code)} disabled={submittingCode}>
								{#if submittingCode}
									<svg class="spinner" viewBox="0 0 24 24" fill="none">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									<span>Verificando...</span>
								{:else}
									<span>Probar Código ({selectedHotspot.code})</span>
								{/if}
							</button>
							<button class="secondary-btn" onclick={() => (selectedHotspot = null)}>Cerrar</button>
						</div>
					{/if}
				</div>
			{:else if activeTab === 'feed'}
				<!-- FEED / COMUNIDAD TAB -->
				<div class="tab-pane">
					<h2 class="pane-title">Feed de la Comunidad</h2>
					<div class="feed-list">
						<div class="feed-item">
							<div class="feed-icon">🏆</div>
							<div class="feed-body">
								<strong>@AlexVance</strong> desbloqueó el ítem público <em>Chip de Memoria Alpha</em>.
								<small>Hace 2 minutos</small>
							</div>
						</div>

						<div class="feed-item">
							<div class="feed-icon">📢</div>
							<div class="feed-body">
								La facción <strong>Colectivo Hacker</strong> ha tomado la delantera con +150 pt.
								<small>Hace 10 minutos</small>
							</div>
						</div>
					</div>
				</div>
			{:else if activeTab === 'profile'}
				<!-- PROFILE & JOURNAL TAB -->
				<div class="tab-pane">
					<h2 class="pane-title">Expediente del Agente</h2>
					
					<div class="profile-card">
						<img src={player.avatar.image_url} alt="Profile" class="p-avatar" />
						<h3>{player.avatar.name}</h3>
						<p class="p-fac">Facción: <strong>{player.avatar.faction_id === 'faction_hackers' ? 'Colectivo Hacker' : 'División Resistencia'}</strong></p>

						<div class="stats-grid">
							<div class="stat-box">
								<span class="lbl">HACKEO</span>
								<span class="val">{player.avatar.sp.hackeo || 10}</span>
							</div>
							<div class="stat-box">
								<span class="lbl">PERCEPCIÓN</span>
								<span class="val">{player.avatar.sp.percepcion || 10}</span>
							</div>
							<div class="stat-box">
								<span class="lbl">SIGILO</span>
								<span class="val">{player.avatar.sp.sigilo || 8}</span>
							</div>
						</div>
					</div>

					<div class="section-title">Journal (Bitácora de Lore)</div>
					<div class="journal-list">
						{#if player.game_status?.journal && player.game_status.journal.length > 0}
							{#each player.game_status.journal as j}
								<div class="journal-card">
									<h4>{j.title}</h4>
									<div class="j-html">{@html j.content_html}</div>
								</div>
							{/each}
						{:else}
							<p class="empty-msg">No has desbloqueado entradas en la bitácora aún. Resuelve misiones para ganar lore.</p>
						{/if}
					</div>

					<button class="logout-btn" onclick={handleLogout}>Cerrar Sesión</button>
				</div>
			{/if}
		</main>

		<!-- MISSION DETAIL MODAL -->
		{#if selectedMission}
			<div class="modal-overlay" onclick={() => (selectedMission = null)}>
				<div class="modal-card" onclick={(e) => e.stopPropagation()}>
					<span class="m-badge {selectedMission.type}">{selectedMission.type.toUpperCase()}</span>
					<h3>{selectedMission.title}</h3>
					<p>{selectedMission.description}</p>

					{#if selectedMission.type === 'code' || selectedMission.type === 'time_bomb'}
						<form onsubmit={(e) => { e.preventDefault(); handleCodeSubmit(); }} class="modal-form">
							<input
								type="text"
								bind:value={codeInput}
								placeholder="Introduce la clave..."
								class="code-input"
								disabled={submittingCode}
							/>
							<button type="submit" class="primary-btn" disabled={submittingCode}>
								{#if submittingCode}
									<svg class="spinner" viewBox="0 0 24 24" fill="none">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									<span>Verificando...</span>
								{:else}
									<span>Enviar Solución</span>
								{/if}
							</button>
						</form>
					{:else if selectedMission.type === 'collective_vote'}
						<div class="vote-options">
							{#each selectedMission.options as opt}
								<button
									class="vote-btn {votedOption === opt.id ? 'active' : ''}"
									onclick={() => handleVote(opt.id)}
									disabled={voting}
								>
									{opt.text} {votedOption === opt.id ? '✓' : ''}
								</button>
							{/each}
						</div>
					{/if}

					{#if codeMessage}
						<div class="code-feedback {codeMessage.type}">{codeMessage.text}</div>
					{/if}

					<button class="secondary-btn modal-close" onclick={() => (selectedMission = null)}>Cerrar</button>
				</div>
			</div>
		{/if}

		<!-- BOTTOM NAVIGATION BAR -->
		<nav class="bottom-nav">
			<button class="nav-item {activeTab === 'hud' ? 'active' : ''}" onclick={() => (activeTab = 'hud')}>
				<span class="nav-icon">📊</span>
				<span class="nav-label">HUD</span>
			</button>
			<button class="nav-item {activeTab === 'missions' ? 'active' : ''}" onclick={() => (activeTab = 'missions')}>
				<span class="nav-icon">🎯</span>
				<span class="nav-label">Misiones</span>
			</button>
			<button class="nav-item {activeTab === 'map' ? 'active' : ''}" onclick={() => (activeTab = 'map')}>
				<span class="nav-icon">🗺️</span>
				<span class="nav-label">Mapa</span>
			</button>
			<button class="nav-item {activeTab === 'feed' ? 'active' : ''}" onclick={() => (activeTab = 'feed')}>
				<span class="nav-icon">📡</span>
				<span class="nav-label">Feed</span>
			</button>
			<button class="nav-item {activeTab === 'profile' ? 'active' : ''}" onclick={() => (activeTab = 'profile')}>
				<span class="nav-icon">📁</span>
				<span class="nav-label">Perfil</span>
			</button>
		</nav>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		background: #080914;
		color: #e2e8f0;
		font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		user-select: none;
	}

	.selection-overlay {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.5rem;
		box-sizing: border-box;
		background: radial-gradient(circle at top, rgba(99, 102, 241, 0.2), #080914 70%);
	}

	.selection-card {
		width: 100%;
		max-width: 500px;
		background: rgba(15, 23, 42, 0.85);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 1.5rem;
		padding: 2.25rem;
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
	}

	.selection-fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}

	.selection-fieldset:disabled {
		opacity: 0.75;
	}

	.badge {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #a855f7;
		background: rgba(168, 85, 247, 0.15);
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
		display: inline-block;
		margin-bottom: 0.75rem;
		border: 1px solid rgba(168, 85, 247, 0.3);
	}

	h2 { margin: 0 0 0.35rem 0; font-size: 1.6rem; }
	.subtitle { font-size: 0.88rem; color: #94a3b8; margin-bottom: 1.75rem; line-height: 1.4; }

	.step-section { margin-bottom: 1.75rem; }
	.step-section h3 { font-size: 0.95rem; margin-bottom: 0.75rem; color: #818cf8; letter-spacing: 0.02em; }

	.grid-options { display: flex; flex-direction: column; gap: 0.75rem; }
	.option-btn {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.9rem 1rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.85rem;
		color: #fff;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.option-btn.active {
		background: rgba(99, 102, 241, 0.25);
		border-color: #818cf8;
		box-shadow: 0 0 16px rgba(129, 140, 248, 0.35);
	}
	.icon-thumb, .avatar-thumb { width: 46px; height: 46px; border-radius: 0.6rem; object-fit: cover; }
	.opt-text strong { display: block; font-size: 0.92rem; margin-bottom: 0.15rem; }
	.opt-text .desc { font-size: 0.76rem; color: #94a3b8; line-height: 1.3; }

	.primary-btn {
		width: 100%;
		padding: 0.95rem;
		margin-top: 1rem;
		background: linear-gradient(135deg, #6366f1, #a855f7);
		border: none;
		border-radius: 0.75rem;
		color: #fff;
		font-weight: 700;
		font-size: 0.98rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		transition: transform 0.15s ease, opacity 0.15s ease;
	}

	.primary-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		opacity: 0.95;
	}

	.primary-btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.secondary-btn {
		width: 100%;
		padding: 0.75rem;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.65rem;
		color: #cbd5e1;
		margin-top: 0.75rem;
		cursor: pointer;
		font-weight: 600;
	}

	.spinner {
		width: 18px;
		height: 18px;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* MAIN APP SHELL */
	.app-shell {
		max-width: 480px;
		margin: 0 auto;
		min-height: 100vh;
		background: #080914;
		display: flex;
		flex-direction: column;
		position: relative;
		padding-bottom: 80px;
		box-sizing: border-box;
	}

	.alert-banner {
		background: rgba(99, 102, 241, 0.95);
		color: #fff;
		padding: 0.75rem 1.25rem;
		font-size: 0.82rem;
		position: sticky;
		top: 0;
		z-index: 50;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
	}
	.alert-content { display: flex; align-items: center; gap: 0.6rem; }
	.alert-bar { height: 3px; background: #fff; margin-top: 0.35rem; border-radius: 2px; }

	.top-bar {
		padding: 1.25rem 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(15, 23, 42, 0.95);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		margin-bottom: 0.5rem;
	}
	.player-summary { display: flex; align-items: center; gap: 0.85rem; }
	.avatar-img { width: 48px; height: 48px; border-radius: 50%; border: 2px solid #818cf8; }
	.agent-name { font-weight: 700; font-size: 0.95rem; margin-right: 0.6rem; }
	.chapter-tag { font-size: 0.65rem; background: #a855f7; padding: 0.18rem 0.45rem; border-radius: 4px; font-weight: 800; }
	.xp-bar-container { width: 130px; height: 6px; background: rgba(255, 255, 255, 0.12); border-radius: 3px; margin: 0.3rem 0; overflow: hidden; }
	.xp-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #a855f7); }
	.xp-label { font-size: 0.68rem; color: #94a3b8; display: flex; justify-content: space-between; }
	.cp-badge { background: rgba(255, 255, 255, 0.08); padding: 0.45rem 0.85rem; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.15); font-weight: 800; display: flex; gap: 0.35rem; align-items: center; }

	.world-widget { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; background: rgba(15, 23, 42, 0.4); border-bottom: 1px solid rgba(255, 255, 255, 0.05); margin-bottom: 1.25rem; }
	.point-card { background: rgba(30, 41, 59, 0.55); padding: 0.85rem 1rem; border-radius: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.06); }
	.pt-header { display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.78rem; }
	.progress-bg { height: 7px; background: rgba(0, 0, 0, 0.35); border-radius: 4px; overflow: hidden; margin-top: 0.25rem; }
	.progress-fill.danger { height: 100%; background: #ef4444; }
	.faction-bars { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.4rem; }
	.f-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.72rem; }
	.f-row span { width: 75px; font-weight: 600; }
	.f-bar-bg { flex: 1; height: 6px; background: rgba(0,0,0,0.35); border-radius: 3px; }
	.f-bar.hackers { height: 100%; background: #6366f1; }
	.f-bar.resistencia { height: 100%; background: #a855f7; }

	.main-content { padding: 0 1.25rem 1.5rem 1.25rem; flex: 1; }
	.tab-pane { display: flex; flex-direction: column; gap: 1.5rem; }
	.pane-title { font-size: 1.25rem; margin: 0 0 1rem 0; font-weight: 700; color: #f8fafc; }

	.section-title { font-size: 0.8rem; font-weight: 800; letter-spacing: 0.08em; color: #94a3b8; text-transform: uppercase; margin: 1.5rem 0 0.85rem 0; }

	.quick-code-card { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1.25rem; border-radius: 0.85rem; margin-bottom: 1.25rem; }
	.quick-code-card h3 { margin: 0 0 0.35rem 0; font-size: 1rem; }
	.quick-code-card .hint { font-size: 0.78rem; color: #94a3b8; margin: 0 0 1rem 0; line-height: 1.4; }
	.code-form { display: flex; gap: 0.75rem; }
	.code-input { flex: 1; padding: 0.7rem 0.9rem; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 0.6rem; color: #fff; font-size: 0.9rem; }
	.code-btn { padding: 0.7rem 1.1rem; background: #6366f1; border: none; border-radius: 0.6rem; color: #fff; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; min-width: 90px; }
	.code-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.code-feedback { font-size: 0.82rem; padding: 0.65rem 0.85rem; border-radius: 0.5rem; margin-top: 0.85rem; }
	.code-feedback.success { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }
	.code-feedback.error { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); }

	.mission-card { background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.85rem; padding: 1.1rem; cursor: pointer; display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem; }
	.mission-card.completed { opacity: 0.85; border-color: #22c55e; }
	.mission-card.locked { opacity: 0.5; pointer-events: none; }
	.m-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }
	.m-badge { font-size: 0.65rem; font-weight: 800; background: #6366f1; color: #fff; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.05em; }
	.m-badge.time_bomb { background: #ef4444; }
	.m-badge.collective_vote { background: #a855f7; }
	.status-tag { font-size: 0.68rem; font-weight: 700; }
	.status-tag.done { color: #4ade80; }
	.status-tag.lock { color: #94a3b8; }
	.mission-card h4 { margin: 0; font-size: 1rem; color: #f8fafc; }
	.m-preview { font-size: 0.78rem; color: #94a3b8; margin: 0; line-height: 1.4; }
	.m-rewards { display: flex; gap: 0.85rem; font-size: 0.75rem; font-weight: 700; color: #818cf8; margin-top: 0.25rem; }
	.timer-box { font-size: 0.78rem; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; padding: 0.5rem 0.75rem; border-radius: 0.5rem; display: flex; justify-content: space-between; margin: 0.25rem 0; }

	.dialogue-box { display: flex; gap: 1rem; background: rgba(30, 41, 59, 0.45); border: 1px solid rgba(255, 255, 255, 0.08); padding: 1rem; border-radius: 0.85rem; align-items: center; margin-top: 0.5rem; }
	.gm-avatar { width: 44px; height: 44px; border-radius: 50%; border: 1px solid #a855f7; }
	.dialogue-text strong { display: block; font-size: 0.82rem; color: #a855f7; margin-bottom: 0.25rem; }
	.dialogue-text p { margin: 0; font-size: 0.78rem; color: #cbd5e1; line-height: 1.4; }

	.map-wrapper { position: relative; width: 100%; border-radius: 0.85rem; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.12); margin-bottom: 1.25rem; }
	.map-img { width: 100%; display: block; }
	.hotspot-pin { position: absolute; background: #ef4444; color: #fff; border: none; font-size: 0.72rem; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 9999px; cursor: pointer; transform: translate(-50%, -50%); box-shadow: 0 0 12px rgba(239, 68, 68, 0.8); }
	.pin-1 { left: 35%; top: 45%; }
	.pin-2 { left: 70%; top: 65%; }

	.hotspot-modal { background: rgba(15, 23, 42, 0.95); border: 1px solid #818cf8; padding: 1.25rem; border-radius: 0.85rem; margin-top: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
	.hotspot-modal h3 { margin: 0; font-size: 1.05rem; }
	.hotspot-modal p { margin: 0; font-size: 0.82rem; color: #cbd5e1; line-height: 1.4; }

	.feed-list { display: flex; flex-direction: column; gap: 1rem; }
	.feed-item { display: flex; gap: 1rem; background: rgba(30, 41, 59, 0.5); padding: 1rem; border-radius: 0.75rem; font-size: 0.83rem; border: 1px solid rgba(255,255,255,0.06); }
	.feed-item small { display: block; color: #94a3b8; margin-top: 0.3rem; font-size: 0.72rem; }

	.profile-card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem; border-radius: 0.85rem; text-align: center; margin-bottom: 1.5rem; }
	.p-avatar { width: 76px; height: 76px; border-radius: 50%; border: 3px solid #6366f1; margin-bottom: 0.5rem; }
	.profile-card h3 { margin: 0 0 0.25rem 0; font-size: 1.15rem; }
	.p-fac { margin: 0; font-size: 0.82rem; color: #94a3b8; }
	.stats-grid { display: flex; justify-content: space-around; margin-top: 1.25rem; gap: 1rem; }
	.stat-box { display: flex; flex-direction: column; gap: 0.2rem; }
	.stat-box .lbl { font-size: 0.68rem; color: #94a3b8; font-weight: 700; letter-spacing: 0.05em; }
	.stat-box .val { font-size: 1.2rem; font-weight: 800; color: #818cf8; }

	.journal-list { display: flex; flex-direction: column; gap: 1rem; }
	.journal-card { background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 0.75rem; font-size: 0.82rem; margin-bottom: 0.75rem; }
	.journal-card h4 { margin: 0 0 0.5rem 0; font-size: 0.95rem; color: #818cf8; }
	:global(.j-html p) { margin: 0; line-height: 1.4; }
	.empty-msg { font-size: 0.82rem; color: #94a3b8; text-align: center; margin: 1.5rem 0; }
	.logout-btn { width: 100%; margin-top: 2rem; padding: 0.85rem; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; border-radius: 0.75rem; font-weight: 700; cursor: pointer; }

	/* MODALS */
	.modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1.5rem; }
	.modal-card { width: 100%; max-width: 400px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 1.25rem; padding: 1.75rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 25px 60px rgba(0,0,0,0.7); }
	.modal-card h3 { margin: 0; font-size: 1.15rem; }
	.modal-card p { margin: 0; font-size: 0.85rem; color: #cbd5e1; line-height: 1.45; }
	.modal-form { display: flex; flex-direction: column; gap: 0.85rem; margin-top: 0.5rem; }
	.vote-options { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
	.vote-btn { padding: 0.85rem; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.65rem; color: #fff; text-align: left; cursor: pointer; font-size: 0.88rem; }
	.vote-btn.active { border-color: #a855f7; background: rgba(168, 85, 247, 0.2); }
	.vote-btn:disabled { opacity: 0.6; cursor: not-allowed; }

	/* BOTTOM NAV */
	.bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; height: 68px; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(16px); border-top: 1px solid rgba(255, 255, 255, 0.12); display: flex; justify-content: space-around; align-items: center; z-index: 90; padding: 0 0.5rem; box-sizing: border-box; }
	.nav-item { background: transparent; border: none; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; cursor: pointer; flex: 1; }
	.nav-item.active { color: #818cf8; }
	.nav-icon { font-size: 1.25rem; }
	.nav-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.02em; }
</style>

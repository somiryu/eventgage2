<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<div class="landing-container">
	<div class="landing-card">
		<div class="logo-badge">EVENTGAGE ARG ENGINE</div>
		<h1>Eventgage Platform</h1>
		<p class="tagline">Módulos de Gamificación, Alternate Reality Game (ARG) y Misiones en Tiempo Real para Eventos.</p>
		
		<div class="demo-box">
			<h3>Evento Activo</h3>
			<p>Ingresa a la experiencia oficial de <strong>Gamescon — Agencia Antropológica Huizinga</strong>.</p>
			<button class="launch-btn" onclick={() => goto('/gamescon')}>
				Ingresar a /gamescon
			</button>
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #080914;
		color: #e2e8f0;
		font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.landing-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		box-sizing: border-box;
		background: radial-gradient(circle at center, rgba(99, 102, 241, 0.2), #080914 80%);
	}

	.landing-card {
		width: 100%;
		max-width: 440px;
		background: rgba(15, 23, 42, 0.85);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 1.5rem;
		padding: 2.25rem;
		text-align: center;
	}

	.logo-badge {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.15em;
		color: #a855f7;
		background: rgba(168, 85, 247, 0.15);
		padding: 0.3rem 0.75rem;
		border-radius: 9999px;
		border: 1px solid rgba(168, 85, 247, 0.3);
		margin-bottom: 1rem;
	}

	h1 {
		font-size: 2rem;
		margin: 0 0 0.5rem 0;
		background: linear-gradient(135deg, #ffffff, #94a3b8);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.tagline {
		font-size: 0.9rem;
		color: #94a3b8;
		margin-bottom: 2rem;
		line-height: 1.5;
	}

	.demo-box {
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(99, 102, 241, 0.3);
		border-radius: 1rem;
		padding: 1.25rem;
	}

	.demo-box h3 {
		margin: 0 0 0.4rem 0;
		font-size: 1rem;
		color: #818cf8;
	}

	.demo-box p {
		font-size: 0.85rem;
		color: #cbd5e1;
		margin-bottom: 1rem;
	}

	.launch-btn {
		width: 100%;
		padding: 0.85rem;
		background: linear-gradient(135deg, #6366f1, #a855f7);
		border: none;
		border-radius: 0.6rem;
		color: #fff;
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
		transition: transform 0.15 ease, opacity 0.15s ease;
	}

	.launch-btn:hover {
		transform: translateY(-2px);
		opacity: 0.95;
	}
</style>

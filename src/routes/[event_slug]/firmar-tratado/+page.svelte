<script lang="ts">
	const { data } = $props();

	let signed = $state(data.alreadySigned);
	let signing = $state(false);
	let errorMsg = $state('');

	async function handleSign() {
		if (signing || signed) return;
		signing = true;
		errorMsg = '';
		try {
			const res = await fetch(`/api/event/${data.event.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'sign_treaty' })
			});
			const json = await res.json();
			if (json.success) {
				signed = true;
			} else {
				errorMsg = json.message || 'No se pudo registrar la firma.';
			}
		} catch (e) {
			errorMsg = 'La Agencia perdió la señal — revisa tu conexión y reintenta.';
		} finally {
			signing = false;
		}
	}
</script>

<svelte:head>
	<title>Tratado Huizinga — {data.event.title}</title>
</svelte:head>

<div class="treaty-page">
	<div class="treaty-card">
		<span class="eyebrow">Agencia Antropológica Huizinga</span>
		<h1>🏛️ Manifiesto de la Red Huizinga por la Excelencia Lúdica</h1>

		<blockquote>
			Nosotros, líderes académicos, directivos y diseñadores reunidos en Gamescon, declaramos
			formalmente nuestro compromiso de desterrar la mediocridad pedagógica y la inercia formativa
			de nuestras instituciones.
		</blockquote>

		<ol>
			<li><strong>El Juego es Soberano</strong>: reconocemos que el juego no es una recompensa infantil, sino la tecnología cognitiva fundamental a través de la cual los seres humanos ensayan el futuro.</li>
			<li><strong>Rigor sobre Cosmética</strong>: rechazamos el maquillaje lúdico de puntos y medallas vacías; nos comprometemos a diseñar sistemas con metas claras, retos justos y retroalimentación inmediata.</li>
			<li><strong>Fail Smart como Derecho</strong>: nos comprometemos a crear entornos educativos y laborales donde el error sea tratado como un checkpoint de aprendizaje y nunca como un motivo de exclusión.</li>
			<li><strong>Autonomía y Propósito</strong>: diseñaremos para empoderar la toma de decisiones humanas, poniendo el bienestar y la maestría del participante por encima del control burocrático.</li>
		</ol>

		<p class="signed-by">Firmado colectivamente por los Agentes de la Red Huizinga — Gamescon.</p>

		{#if signed}
			<div class="signed-state">
				<span class="check">✓</span>
				<div>
					<strong>Firma registrada, {data.playerName}.</strong>
					<p>Tu nombre queda enlazado al Tratado en el tablero de la Agencia.</p>
				</div>
			</div>
		{:else}
			<button class="sign-btn" onclick={handleSign} disabled={signing}>
				{signing ? 'Registrando firma…' : `Firmar como ${data.playerName}`}
			</button>
			{#if errorMsg}
				<p class="error-text">{errorMsg}</p>
			{/if}
		{/if}

		<p class="count-note">{data.signatureCount} agente{data.signatureCount === 1 ? '' : 's'} ya firmaron el Tratado.</p>
	</div>
</div>

<style>
	.treaty-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
		background: #05070d;
		color: #e2e8f0;
		font-family: system-ui, -apple-system, sans-serif;
	}
	.treaty-card {
		max-width: 560px;
		width: 100%;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 1rem;
		padding: 2rem;
	}
	.eyebrow {
		display: block;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.75rem;
		color: #94a3b8;
		margin-bottom: 0.5rem;
	}
	h1 {
		font-size: 1.4rem;
		margin: 0 0 1.25rem 0;
		line-height: 1.35;
	}
	blockquote {
		margin: 0 0 1.25rem 0;
		padding-left: 1rem;
		border-left: 3px solid #818cf8;
		color: #cbd5e1;
		font-style: italic;
	}
	ol {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-left: 1.25rem;
		margin: 0 0 1.25rem 0;
	}
	ol li {
		color: #cbd5e1;
		font-size: 0.95rem;
		line-height: 1.5;
	}
	.signed-by {
		text-align: center;
		color: #64748b;
		font-size: 0.85rem;
		font-style: italic;
		margin: 0 0 1.5rem 0;
	}
	.sign-btn {
		width: 100%;
		background: linear-gradient(90deg, #6366f1, #818cf8);
		border: none;
		color: white;
		font-weight: 700;
		font-size: 1rem;
		padding: 0.9rem 1.5rem;
		border-radius: 0.6rem;
		cursor: pointer;
	}
	.sign-btn:disabled { opacity: 0.6; cursor: default; }
	.error-text { color: #fca5a5; font-size: 0.85rem; margin-top: 0.6rem; }
	.signed-state {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		background: rgba(34, 197, 94, 0.1);
		border: 1px solid rgba(34, 197, 94, 0.3);
		border-radius: 0.6rem;
		padding: 1rem;
	}
	.signed-state .check {
		font-size: 1.5rem;
		color: #4ade80;
		line-height: 1;
	}
	.signed-state p { margin: 0.25rem 0 0 0; color: #94a3b8; font-size: 0.9rem; }
	.count-note { text-align: center; color: #64748b; font-size: 0.85rem; margin: 1.5rem 0 0 0; }
</style>

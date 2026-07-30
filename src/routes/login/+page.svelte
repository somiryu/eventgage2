<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let loading = $state(false);

	const targetEvent = $derived(page.url.searchParams.get('event') || 'demo');

	async function handleLogin(e: Event) {
		e.preventDefault();
		if (loading) return;
		errorMessage = '';
		loading = true;

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			const data = await res.json();
			if (!res.ok || data.error) {
				errorMessage = data.error || 'Error al iniciar sesión';
				loading = false;
			} else {
				await goto(`/${targetEvent}`);
			}
		} catch (err: any) {
			errorMessage = err.message || 'Error de conexión';
			loading = false;
		}
	}
</script>

<div class="auth-container">
	<div class="auth-card">
		<div class="badge">EVENTGAGE</div>
		<h1>Iniciar Sesión</h1>
		<p class="subtitle">Ingresa para continuar en <strong>{targetEvent.toUpperCase()}</strong></p>

		{#if errorMessage}
			<div class="error-banner">{errorMessage}</div>
		{/if}

		<form onsubmit={handleLogin}>
			<fieldset disabled={loading} class="form-fieldset">
				<div class="form-group">
					<label for="email">Correo Electrónico</label>
					<input id="email" type="email" bind:value={email} placeholder="agente@eventgage.com" required />
				</div>

				<div class="form-group">
					<label for="password">Contraseña</label>
					<input id="password" type="password" bind:value={password} placeholder="••••••••" required />
				</div>

				<button type="submit" class="submit-btn" disabled={loading}>
					{#if loading}
						<svg class="spinner" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span>Iniciando Sesión e Ingresando...</span>
					{:else}
						<span>Iniciar Sesión</span>
					{/if}
				</button>
			</fieldset>
		</form>

		<div class="auth-footer">
			¿No tienes cuenta? <a href={`/register?event=${targetEvent}`}>Crear Cuenta</a>
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

	.auth-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		box-sizing: border-box;
		background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), transparent 50%),
		            radial-gradient(circle at bottom left, rgba(168, 85, 247, 0.15), transparent 50%),
		            #080914;
	}

	.auth-card {
		width: 100%;
		max-width: 400px;
		background: rgba(15, 23, 42, 0.75);
		backdrop-filter: blur(16px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 1.25rem;
		padding: 2rem;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
	}

	.form-fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}

	.form-fieldset:disabled {
		opacity: 0.75;
	}

	.badge {
		display: inline-block;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.15em;
		color: #a855f7;
		background: rgba(168, 85, 247, 0.1);
		padding: 0.25rem 0.6rem;
		border-radius: 9999px;
		border: 1px solid rgba(168, 85, 247, 0.3);
		margin-bottom: 0.75rem;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0 0 0.25rem 0;
		color: #f8fafc;
	}

	.subtitle {
		font-size: 0.9rem;
		color: #94a3b8;
		margin-bottom: 1.5rem;
	}

	.error-banner {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #fca5a5;
		padding: 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.85rem;
		margin-bottom: 1rem;
	}

	.form-group {
		margin-bottom: 1.25rem;
	}

	label {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		color: #cbd5e1;
		margin-bottom: 0.4rem;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.75rem 1rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 0.6rem;
		color: #ffffff;
		font-size: 0.95rem;
		transition: all 0.2s ease;
	}

	input:focus {
		outline: none;
		border-color: #818cf8;
		box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.2);
	}

	.submit-btn {
		width: 100%;
		padding: 0.85rem;
		margin-top: 0.5rem;
		background: linear-gradient(135deg, #6366f1, #a855f7);
		color: #ffffff;
		border: none;
		border-radius: 0.6rem;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: opacity 0.2s ease, transform 0.1s ease;
	}

	.submit-btn:hover:not(:disabled) {
		opacity: 0.95;
		transform: translateY(-1px);
	}

	.submit-btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
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

	.auth-footer {
		margin-top: 1.5rem;
		text-align: center;
		font-size: 0.85rem;
		color: #94a3b8;
	}

	.auth-footer a {
		color: #818cf8;
		text-decoration: none;
		font-weight: 600;
	}

	.auth-footer a:hover {
		text-decoration: underline;
	}
</style>

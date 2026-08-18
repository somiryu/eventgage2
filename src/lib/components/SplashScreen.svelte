<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	let visible = $state(true);

	onMount(() => {
		const timer = setTimeout(() => {
			visible = false;
		}, 2000);

		return () => clearTimeout(timer);
	});
</script>

{#if visible}
	<div class="splash-screen" transition:fade={{ duration: 400 }} aria-hidden="true">
		<div class="splash-content">
			<span class="splash-powered">Eventgage Powered by</span>
			<img src="/images/branding/logo_f2p.png" alt="Free To Play - Level up your ideas" class="splash-logo" />
		</div>
	</div>
{/if}

<style>
	.splash-screen {
		position: fixed;
		inset: 0;
		z-index: 99999;
		background: #060913;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		pointer-events: all;
	}

	.splash-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		text-align: center;
		animation: splash-pulse 2s ease-in-out infinite alternate;
	}

	.splash-powered {
		font-family: var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
		font-size: clamp(0.85rem, 3.5vw, 1.1rem);
		font-weight: 600;
		color: #94a3b8;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.splash-logo {
		max-width: 80vw;
		width: 320px;
		height: auto;
		object-fit: contain;
		filter: drop-shadow(0 0 25px rgba(0, 164, 180, 0.35));
	}

	@keyframes splash-pulse {
		0% {
			transform: scale(0.97);
			opacity: 0.92;
		}
		100% {
			transform: scale(1.02);
			opacity: 1;
		}
	}
</style>

<script lang="ts">
	let { children } = $props();
</script>

<!-- Grupo de rutas públicas, sin autenticación (dashboard de pantalla gigante
     para la plenaria — sección 11.1 del GDD). Layout propio y minimalista:
     sin la navegación inferior ni el chrome del HUD del jugador, pensado
     para proyectarse en una pantalla, no para navegarse desde un celular. -->
<div class="public-shell">
	{@render children()}
</div>

<style>
	.public-shell {
		min-height: 100vh;
		width: 100%;
		background: #05070d;
		color: #e2e8f0;
		font-family: system-ui, -apple-system, sans-serif;
	}
</style>

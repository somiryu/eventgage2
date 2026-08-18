<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import SplashScreen from '$lib/components/SplashScreen.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<SplashScreen />

{@render children()}


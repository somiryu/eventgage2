<script lang="ts">
	import Dices from '@lucide/svelte/icons/dices';
	import SkillBadge from '$lib/components/SkillBadge.svelte';

	interface Props {
		roll: number;
		modifier: number;
		total: number;
		dc: number;
		checkSuccess: boolean;
		attribute: string;
		onSettle: () => void;
		onContinue: () => void;
	}

	let { roll, modifier, total, dc, checkSuccess, attribute, onSettle, onContinue }: Props = $props();

	const scaleMax = $derived(Math.max(20, Math.ceil((Math.max(total, dc) + 3) / 5) * 5));
	const dcPct = $derived(Math.min(100, (dc / scaleMax) * 100));

	let currentValue = $state(0);
	let phase = $state<'animating' | 'result' | 'continued'>('animating');
	let settled = false;

	function handleContinue() {
		if (phase === 'continued') return;
		phase = 'continued';
		onContinue();
	}

	const fillPct = $derived(Math.min(100, (currentValue / scaleMax) * 100));
	const barColor = $derived(
		currentValue >= dc ? 'green' : dc - currentValue < 4 ? 'yellow' : 'red'
	);

	function easeOutCubic(t: number) {
		return 1 - Math.pow(1 - t, 3);
	}

	$effect(() => {
		const duration = 1200;
		const start = performance.now();
		let raf: number;

		function tick(now: number) {
			const elapsed = now - start;
			const t = Math.min(1, elapsed / duration);
			currentValue = total * easeOutCubic(t);
			if (t < 1) {
				raf = requestAnimationFrame(tick);
			} else {
				currentValue = total;
				if (!settled) {
					settled = true;
					phase = 'result';
					onSettle();
				}
			}
		}
		raf = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="dcr">
	<div class="dcr-bar-track">
		<div class="dcr-bar-fill {barColor}" style="width: {fillPct}%"></div>
		<div class="dcr-threshold" style="left: {dcPct}%">
			<span class="dcr-threshold-label mono">DC {dc}</span>
		</div>
	</div>

	{#if phase === 'animating'}
		<p class="dcr-live-value mono">{Math.round(currentValue)}</p>
	{:else}
		<div class="dcr-outcome {checkSuccess ? 'success' : 'fail'}">
			<p class="dcr-outcome-title">{checkSuccess ? 'Prueba superada' : 'Prueba fallada'}</p>
			<p class="dcr-outcome-detail mono">
				<Dices size={14} /> {roll} + {modifier} (<SkillBadge skillKey={attribute} showValue={false} variant="text" />) = <strong>{total}</strong> vs DC {dc}
			</p>
		</div>
		{#if phase === 'result'}
			<button type="button" class="primary-btn" onclick={handleContinue}>Continuar</button>
		{/if}
	{/if}
</div>

<style>
	.dcr {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.dcr-bar-track {
		position: relative;
		width: 100%;
		height: 22px;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-sm, 0.5rem);
		overflow: hidden;
	}

	.dcr-bar-fill {
		height: 100%;
		border-radius: var(--radius-sm, 0.5rem);
		transition: background-color 0.15s linear;
	}

	.dcr-bar-fill.red {
		background: #ef4444;
	}

	.dcr-bar-fill.yellow {
		background: #f59e0b;
	}

	.dcr-bar-fill.green {
		background: #10b981;
	}

	.dcr-threshold {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: #f8fafc;
		box-shadow: 0 0 6px rgba(248, 250, 252, 0.7);
	}

	.dcr-threshold-label {
		position: absolute;
		top: -1.2rem;
		left: 50%;
		transform: translateX(-50%);
		font-size: var(--text-xs, 0.65rem);
		color: #f8fafc;
		white-space: nowrap;
		font-weight: 700;
	}

	.dcr-live-value {
		align-self: center;
		font-size: var(--text-lg, 0.95rem);
		font-weight: 800;
		color: #f8fafc;
	}

	.dcr-outcome {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		align-items: center;
		padding: 0.75rem;
		border-radius: var(--radius-sm, 0.5rem);
		text-align: center;
	}

	.dcr-outcome.success {
		background: rgba(16, 185, 129, 0.18);
		border: 1px solid #10b981;
		color: #34d399;
	}

	.dcr-outcome.fail {
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid #ef4444;
		color: #f87171;
	}

	.dcr-outcome-title {
		margin: 0;
		font-size: var(--text-lg, 0.95rem);
		font-weight: 800;
	}

	.dcr-outcome-detail {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: var(--text-base, 0.78rem);
		color: inherit;
		opacity: 0.9;
	}
</style>

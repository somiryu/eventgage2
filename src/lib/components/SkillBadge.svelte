<script lang="ts">
	import { getSkillInfo } from '$lib/client/skills';
	import { playUiClick } from '$lib/client/audio.svelte';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Info from '@lucide/svelte/icons/info';

	interface Props {
		skillKey: string;
		value?: number | string | any;
		customSkills?: Record<string, { name?: string; description?: string }>;
		variant?: 'tag' | 'pill' | 'text' | 'badge';
		showValue?: boolean;
		interactive?: boolean;
	}

	let {
		skillKey,
		value = undefined,
		customSkills = undefined,
		variant = 'tag',
		showValue = true,
		interactive = true
	}: Props = $props();

	let showModal = $state(false);

	const info = $derived(getSkillInfo(skillKey, customSkills));

	function handleOpenModal(e: MouseEvent | KeyboardEvent) {
		if (!interactive) return;
		e.stopPropagation();
		showModal = true;
		playUiClick();
	}

	function handleCloseModal(e?: MouseEvent | KeyboardEvent) {
		if (e) e.stopPropagation();
		showModal = false;
	}
</script>

{#if interactive}
	<button
		type="button"
		class="skill-badge-btn {variant}"
		onclick={handleOpenModal}
		aria-label={`Ver información de la habilidad ${info.name}`}
		title={`Click para ver descripción de ${info.name}`}
	>
		<span class="skill-code mono">{info.code}</span>
		{#if showValue && value !== undefined}
			<span class="skill-val mono">{value}</span>
		{/if}
		<span class="skill-info-icon" aria-hidden="true"><Info size={11} /></span>
	</button>
{:else}
	<span class="skill-badge-static {variant}">
		<span class="skill-code mono">{info.code}</span>
		{#if showValue && value !== undefined}
			<span class="skill-val mono">{value}</span>
		{/if}
	</span>
{/if}

{#if showModal}
	<div
		class="skill-modal-overlay"
		role="button"
		tabindex="0"
		onclick={handleCloseModal}
		onkeydown={(e) => {
			if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') handleCloseModal();
		}}
	>
		<div
			class="skill-modal-card"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="skill-modal-header">
				<span class="skill-tag-pill mono">{info.code}</span>
				<div class="skill-modal-titles">
					<span class="skill-subtitle">PUNTO DE HABILIDAD (SP)</span>
					<h3 class="skill-title">{info.name}</h3>
				</div>
			</div>

			<div class="skill-modal-body">
				<p class="skill-description">{info.description}</p>
				{#if value !== undefined}
					<div class="skill-current-val-box">
						<span class="val-label">Valor actual:</span>
						<strong class="val-num mono">{value}</strong>
					</div>
				{/if}
			</div>

			<button type="button" class="primary-btn skill-modal-close-btn" onclick={() => handleCloseModal()}>
				Entendido
			</button>
		</div>
	</div>
{/if}

<style>
	/* BOTÓN BADGE */
	.skill-badge-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: rgba(99, 102, 241, 0.18);
		border: 1px solid rgba(129, 140, 248, 0.35);
		color: #e0e7ff;
		padding: 0.15rem 0.45rem;
		border-radius: var(--radius-xs, 4px);
		font-family: inherit;
		font-size: var(--text-xs, 0.65rem);
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
		line-height: 1.2;
		vertical-align: middle;
		box-sizing: border-box;
	}

	.skill-badge-btn:hover {
		background: rgba(99, 102, 241, 0.35);
		border-color: #818cf8;
		color: #fff;
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
	}

	.skill-badge-btn:active {
		transform: translateY(0);
	}

	.skill-badge-btn.pill {
		border-radius: var(--radius-pill, 9999px);
		padding: 0.2rem 0.6rem;
	}

	.skill-badge-btn.text {
		background: transparent;
		border: none;
		padding: 0;
		color: #818cf8;
		text-decoration: underline dotted;
		text-underline-offset: 3px;
	}

	.skill-badge-btn.text:hover {
		background: transparent;
		color: #c7d2fe;
		box-shadow: none;
	}

	.skill-badge-static {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: rgba(99, 102, 241, 0.18);
		border: 1px solid rgba(129, 140, 248, 0.25);
		color: #e0e7ff;
		padding: 0.15rem 0.45rem;
		border-radius: var(--radius-xs, 4px);
		font-size: var(--text-xs, 0.65rem);
		font-weight: 700;
		line-height: 1.2;
		vertical-align: middle;
	}

	.skill-code {
		letter-spacing: 0.04em;
		font-weight: 800;
		color: #818cf8;
	}

	.skill-val {
		color: #f8fafc;
		font-weight: 800;
	}

	.skill-info-icon {
		color: #94a3b8;
		opacity: 0.7;
		display: flex;
		align-items: center;
	}

	.skill-badge-btn:hover .skill-info-icon {
		opacity: 1;
		color: #c7d2fe;
	}

	/* MODAL GLASSMORPHISM */
	.skill-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		z-index: 300;
		animation: fadeIn 0.15s ease-out;
	}

	.skill-modal-card {
		background: #0f172a;
		border: 1px solid rgba(129, 140, 248, 0.3);
		border-radius: var(--radius-lg, 0.85rem);
		padding: 1.5rem;
		width: 100%;
		max-width: 380px;
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8), 0 0 20px rgba(99, 102, 241, 0.15);
		display: flex;
		flex-direction: column;
		gap: 1rem;
		animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		box-sizing: border-box;
	}

	.skill-modal-header {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		padding-bottom: 0.85rem;
	}

	.skill-tag-pill {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3));
		border: 1px solid #818cf8;
		color: #fff;
		font-size: var(--text-md, 0.85rem);
		font-weight: 800;
		padding: 0.35rem 0.65rem;
		border-radius: var(--radius-sm, 0.5rem);
		letter-spacing: 0.05em;
		box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
	}

	.skill-modal-titles {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.skill-subtitle {
		font-size: var(--text-xs, 0.65rem);
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #818cf8;
		text-transform: uppercase;
	}

	.skill-title {
		margin: 0;
		font-size: var(--text-lg, 0.95rem);
		font-weight: 700;
		color: #f8fafc;
		line-height: 1.25;
	}

	.skill-modal-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.skill-description {
		margin: 0;
		font-size: var(--text-base, 0.78rem);
		color: #cbd5e1;
		line-height: 1.5;
	}

	.skill-current-val-box {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.06);
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm, 0.5rem);
	}

	.val-label {
		font-size: var(--text-xs, 0.65rem);
		color: #94a3b8;
		text-transform: uppercase;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.val-num {
		color: #818cf8;
		font-size: var(--text-base, 0.78rem);
		font-weight: 800;
	}

	.skill-modal-close-btn {
		width: 100%;
		padding: 0.65rem 1rem;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		border: none;
		border-radius: var(--radius-md, 0.75rem);
		color: #fff;
		font-size: var(--text-md, 0.85rem);
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
	}

	.skill-modal-close-btn:hover {
		opacity: 0.95;
		box-shadow: 0 6px 16px rgba(99, 102, 241, 0.5);
	}

	.mono {
		font-family: var(--font-mono, monospace);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from { transform: translateY(12px) scale(0.97); opacity: 0; }
		to { transform: translateY(0) scale(1); opacity: 1; }
	}
</style>

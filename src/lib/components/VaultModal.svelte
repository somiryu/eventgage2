<script lang="ts">
	import Gem from '@lucide/svelte/icons/gem';
	import Check from '@lucide/svelte/icons/check';
	import Zap from '@lucide/svelte/icons/zap';
	import Dices from '@lucide/svelte/icons/dices';
	import Lock from '@lucide/svelte/icons/lock';
	import Download from '@lucide/svelte/icons/download';

	interface Props {
		open: boolean;
		rewards: any[];
		player: any;
		onClose: () => void;
		onPurchase: (rewardId: string) => Promise<{ success: boolean; message: string }>;
		onActivateBoost: () => Promise<{ success: boolean; message: string }>;
	}

	let { open, rewards, player, onClose, onPurchase, onActivateBoost }: Props = $props();

	const CATEGORY_LABELS: Record<string, string> = {
		game_aid: 'Ayuda Táctica de Juego',
		b2b_tool: 'Herramienta B2B',
		vip_lead: 'Conversión VIP'
	};
	const CATEGORY_ORDER = ['game_aid', 'b2b_tool', 'vip_lead'];

	const cpPoints = $derived(player?.avatar?.cp?.points ?? 0);
	const playerLevel = $derived(player?.avatar?.xp?.level ?? 1);
	const unlockedRewards = $derived(player?.game_status?.unlocked_rewards ?? []);
	const vipToken = $derived(player?.game_status?.vip_token ?? null);
	const reintentoUsed = $derived(player?.game_status?.reintento_used ?? false);
	const spBoostCharges = $derived(player?.game_status?.sp_boost_charges ?? 0);

	const grouped = $derived.by(() => {
		const groups: Record<string, any[]> = {};
		for (const r of rewards || []) {
			if (!groups[r.category]) groups[r.category] = [];
			groups[r.category].push(r);
		}
		return CATEGORY_ORDER.filter((c) => groups[c]?.length).map((c) => ({
			category: c,
			label: CATEGORY_LABELS[c] || c,
			items: groups[c]
		}));
	});

	let pendingId = $state<string | null>(null);
	let feedback = $state<{ rewardId: string; type: 'success' | 'error'; text: string } | null>(null);

	async function handlePurchase(rewardId: string) {
		if (pendingId) return;
		pendingId = rewardId;
		feedback = null;
		try {
			const res = await onPurchase(rewardId);
			feedback = { rewardId, type: res.success ? 'success' : 'error', text: res.message };
		} finally {
			pendingId = null;
		}
	}

	async function handleActivateBoost() {
		if (pendingId) return;
		pendingId = 'rew_boost_sp';
		feedback = null;
		try {
			const res = await onActivateBoost();
			feedback = { rewardId: 'rew_boost_sp', type: res.success ? 'success' : 'error', text: res.message };
		} finally {
			pendingId = null;
		}
	}
	const B2B_PDF_MAP: Record<string, string> = {
		rew_bem_executive_deck: '/docs/gamescon/kit_ejecutivo_bem.pdf',
		rew_quiz_drivers_tool: '/docs/gamescon/quiz_diagnostico_drivers.pdf',
		rew_canvas_gdd_template: '/docs/gamescon/lienzo_canvas_gdd.pdf',
		rew_rubrica_feedback_inmediato: '/docs/gamescon/matriz_feedback_instruccional.pdf',
		rew_mcpft_diagnostic_tool: '/docs/gamescon/herramienta_matriz_mcpft.pdf',
		rew_antipatrones_guia: '/docs/gamescon/manual_antipatrones_gamificacion.pdf',
		rew_compendio_25_mecanicas: '/docs/gamescon/compendio_25_mecanicas.pdf',
		rew_fail_smart_rubric: '/docs/gamescon/rubrica_fail_smart.pdf',
		rew_matriz_metricas_bem: '/docs/gamescon/matriz_metametricas_bem.pdf'
	};
</script>

{#if open}
	<div
		class="vault-overlay"
		role="button"
		tabindex="0"
		onclick={onClose}
		onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onClose(); }}
	>
		<div
			class="vault-card"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="vault-header">
				<h3>Bóveda de Inteligencia</h3>
				<div class="vault-balance mono"><Gem size={15} /> {cpPoints}</div>
			</div>
			<p class="vault-hint">Invertí tus Ludens en ayudas tácticas y herramientas de transferencia metodológica.</p>

			{#if vipToken}
				<div class="vault-vip-token">
					<span class="vip-token-label">Tu token de Consulta VIP</span>
					<strong class="vip-token-val mono">{vipToken}</strong>
				</div>
			{/if}

			<div class="vault-groups">
				{#each grouped as group (group.category)}
					<div class="vault-group">
						<div class="vault-group-title">{group.label}</div>
						{#each group.items as reward (reward.id)}
							{@const owned = unlockedRewards.includes(reward.id)}
							{@const requiredLevel = reward.min_level ?? (reward.id === 'rew_prime_vip_consultancy' ? 4 : 1)}
							{@const levelLocked = !owned && playerLevel < requiredLevel}
							<div class="vault-item {levelLocked ? 'locked-item' : ''}">
								<div class="vault-item-info">
									<div class="vault-item-title-row">
										<span class="vault-item-name">{reward.name}</span>
										{#if levelLocked}
											<span class="vault-level-badge"><Lock size={10} /> Requiere Nivel {requiredLevel}</span>
										{/if}
									</div>
									{#if reward.description}<p class="vault-item-desc">{reward.description}</p>{/if}
									{#if levelLocked}
										<p class="vault-item-lock-msg"><Lock size={11} /> Debes estar en nivel {requiredLevel} para adquirir.</p>
									{/if}
									{#if feedback && feedback.rewardId === reward.id}
										<p class="vault-item-feedback {feedback.type}">{feedback.text}</p>
									{/if}
								</div>
								<div class="vault-item-action">
									{#if owned}
										{#if reward.id === 'rew_item_reintento'}
											<span class="vault-owned-tag"><Check size={12} /> {reintentoUsed ? 'Usada' : 'Disponible'}</span>
										{:else if reward.id === 'rew_boost_sp'}
											{#if spBoostCharges > 0}
												<span class="vault-owned-tag active"><Zap size={12} /> {spBoostCharges} tirada(s)</span>
											{:else if feedback?.rewardId === 'rew_boost_sp' && feedback.type === 'success'}
												<span class="vault-owned-tag"><Check size={12} /> Ciclo usado</span>
											{:else}
												<button type="button" class="vault-buy-btn" onclick={handleActivateBoost} disabled={pendingId === 'rew_boost_sp'}>
													{pendingId === 'rew_boost_sp' ? '...' : 'Activar'}
												</button>
											{/if}
										{:else if B2B_PDF_MAP[reward.id]}
											<a href={B2B_PDF_MAP[reward.id]} download class="vault-download-btn" target="_blank" rel="noopener noreferrer">
												<Download size={13} /> Descargar PDF
											</a>
										{:else}
											<span class="vault-owned-tag"><Check size={12} /> Adquirido</span>
										{/if}
									{:else if levelLocked}
										<button
											type="button"
											class="vault-buy-btn locked"
											disabled={true}
											title="Debes estar en nivel {requiredLevel} para adquirir"
										>
											<Lock size={11} /> {reward.cost} 💠
										</button>
									{:else}
										<button
											type="button"
											class="vault-buy-btn"
											onclick={() => handlePurchase(reward.id)}
											disabled={pendingId === reward.id || cpPoints < reward.cost}
										>
											{pendingId === reward.id ? '...' : `${reward.cost} 💠`}
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/each}
			</div>

			<button type="button" class="vault-close-btn" onclick={onClose}>Cerrar</button>
		</div>
	</div>
{/if}

<style>
	.vault-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 1.25rem 1rem calc(2rem + env(safe-area-inset-bottom, 20px)) 1rem;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		box-sizing: border-box;
		z-index: 210;
	}
	.vault-card {
		background: #0f172a;
		border: 1px solid rgba(251, 191, 36, 0.35);
		border-radius: var(--radius-lg, 0.85rem);
		padding: 1.5rem;
		width: 100%;
		max-width: 440px;
		max-height: calc(100dvh - 3rem);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.7);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: auto 0;
		box-sizing: border-box;
	}
	@media (max-width: 480px) {
		.vault-overlay {
			padding: 0.85rem 0.65rem calc(1.75rem + env(safe-area-inset-bottom, 16px)) 0.65rem;
		}
		.vault-card {
			padding: 1.15rem 0.85rem;
			gap: 0.65rem;
			max-height: calc(100dvh - 2rem);
			margin: 0 auto;
		}
	}
	.vault-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
	.vault-header h3 { margin: 0; font-size: var(--text-xl, 1.15rem); color: #fff; }
	.vault-balance {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 0.3rem 0.6rem;
		border-radius: var(--radius-pill, 9999px);
		font-weight: 800;
		color: #fbbf24;
		font-size: var(--text-sm, 0.7rem);
		flex-shrink: 0;
	}
	.vault-hint { margin: 0; font-size: var(--text-sm, 0.7rem); color: #94a3b8; line-height: 1.4; }

	.vault-vip-token {
		background: rgba(251, 191, 36, 0.1);
		border: 1px dashed rgba(251, 191, 36, 0.4);
		border-radius: var(--radius-sm, 0.5rem);
		padding: 0.6rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.vip-token-label { font-size: var(--text-xs, 0.65rem); color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
	.vip-token-val { color: #fbbf24; font-size: var(--text-base, 0.78rem); }

	.vault-groups { display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; margin: -0.2rem -0.3rem 0; padding: 0.2rem 0.3rem 0; }
	.vault-group { display: flex; flex-direction: column; gap: 0.4rem; }
	.vault-group-title { font-size: var(--text-xs, 0.65rem); font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #818cf8; }

	.vault-item {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: var(--radius-sm, 0.5rem);
		padding: 0.6rem 0.7rem;
		transition: border-color 0.2s ease;
	}
	.vault-item.locked-item {
		border-color: rgba(245, 158, 11, 0.25);
		background: rgba(30, 41, 59, 0.35);
	}
	.vault-item-info { flex: 1; min-width: 0; }
	.vault-item-title-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.vault-item-name { font-size: var(--text-base, 0.78rem); font-weight: 700; color: #f8fafc; }
	.vault-level-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: var(--text-xs, 0.62rem);
		font-weight: 800;
		color: #fbbf24;
		background: rgba(245, 158, 11, 0.15);
		border: 1px solid rgba(245, 158, 11, 0.35);
		padding: 0.1rem 0.4rem;
		border-radius: var(--radius-pill, 9999px);
		letter-spacing: 0.02em;
	}
	.vault-item-desc { margin: 0.2rem 0 0; font-size: var(--text-sm, 0.7rem); color: #94a3b8; line-height: 1.35; }
	.vault-item-lock-msg {
		margin: 0.35rem 0 0;
		font-size: var(--text-xs, 0.65rem);
		font-weight: 700;
		color: #fbbf24;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
	.vault-item-feedback { margin: 0.35rem 0 0; font-size: var(--text-xs, 0.65rem); font-weight: 700; }
	.vault-item-feedback.success { color: #6ee7b7; }
	.vault-item-feedback.error { color: #fca5a5; }

	.vault-item-action { flex-shrink: 0; }
	.vault-buy-btn {
		background: linear-gradient(135deg, #6366f1, #a855f7);
		border: none;
		color: #fff;
		font-family: var(--font-mono, monospace);
		font-weight: 800;
		font-size: var(--text-sm, 0.7rem);
		padding: 0.4rem 0.65rem;
		border-radius: var(--radius-sm, 0.5rem);
		cursor: pointer;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.vault-buy-btn:disabled { opacity: 0.45; cursor: not-allowed; }
	.vault-buy-btn.locked {
		background: rgba(51, 65, 85, 0.6);
		color: #94a3b8;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.vault-owned-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--text-xs, 0.65rem);
		font-weight: 700;
		color: #6ee7b7;
		white-space: nowrap;
	}
	.vault-download-btn {
		background: linear-gradient(135deg, #059669, #10b981);
		color: #fff;
		font-family: var(--font-mono, monospace);
		font-weight: 800;
		font-size: var(--text-xs, 0.65rem);
		padding: 0.35rem 0.6rem;
		border-radius: var(--radius-sm, 0.5rem);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		white-space: nowrap;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
		transition: opacity 0.15s ease;
	}
	.vault-download-btn:hover { opacity: 0.9; }

	.vault-close-btn {
		margin-top: 0.25rem;
		width: 100%;
		padding: 0.65rem 1rem;
		background: rgba(51, 65, 85, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-sm, 0.5rem);
		color: #e2e8f0;
		font-family: inherit;
		font-size: var(--text-md, 0.85rem);
		font-weight: 700;
		cursor: pointer;
	}
	.vault-close-btn:hover { background: rgba(71, 85, 105, 0.8); }

	.mono { font-family: var(--font-mono, monospace); }
</style>

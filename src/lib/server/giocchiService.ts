import { env } from '$env/dynamic/private';
import { searchBemTheory, getBemNoteContent } from './mcpClient';

export interface GiocchiEvaluationResult {
	feedback_text: string;
	xp_awarded: number;
	isFallback?: boolean;
	source_notes?: string[];
}

export const AI_PROMPT_FALLBACK_XP = 25;
export const AI_PROMPT_FALLBACK_FEEDBACK =
	'La reflexión ha sido registrada en la Bitácora para alimentar el análisis colectivo. Desde la perspectiva del marco BEM, el cuestionamiento crítico de las prácticas formativas y organizacionales es el primer paso para desmantelar la inercia institucional.';

/**
 * Consulta a GIOCCHI conectando el contexto de la misión, el conocimiento de BEM Brain
 * vía MCP en Render y el modelo Gemini de Google AI Studio.
 */
export async function evaluateAiPromptChallenge(params: {
	userInput: string;
	mission: any;
	playerFactionName?: string;
	playerAvatarName?: string;
	playerFactionId?: string;
	playerAvatarId?: string;
}): Promise<GiocchiEvaluationResult> {
	const { userInput, mission, playerFactionName, playerAvatarName, playerFactionId, playerAvatarId } = params;
	const apiKey = env.GOOGLE_AI_STUDIO_API_KEY;

	if (!apiKey) {
		console.warn('[GIOCCHI] GOOGLE_AI_STUDIO_API_KEY no configurada. Usando fallback offline.');
		const fallbackFeedback = mission?.mechanic?.fallback_feedback || mission?.mechanic?.offline_feedback || AI_PROMPT_FALLBACK_FEEDBACK;
		return {
			feedback_text: fallbackFeedback,
			xp_awarded: AI_PROMPT_FALLBACK_XP,
			isFallback: true
		};
	}

	// Dos presupuestos de tiempo INDEPENDIENTES, no uno compartido. Con un solo
	// reloj de 3800ms para todo (contexto MCP + llamada a Gemini), una consulta
	// MCP lenta le comía a Gemini todo el tiempo que le quedaba — en pruebas
	// reales, `search_notes` tardó los 2000ms completos de su propio límite
	// interno y dejó a Gemini con ~1.8s antes de que el reloj compartido lo
	// abortara a mitad de la respuesta, cayendo siempre al fallback offline
	// aunque Gemini funcionara perfectamente bien por su cuenta. Ahora: el
	// contexto de BEM Brain tiene su propio techo corto y best-effort (si no
	// llega a tiempo, se sigue sin él, nunca bloquea) y Gemini arranca su
	// propio reloj completo recién cuando empieza su propia llamada.
	// 3500, no 1200: a pedido de Javier, un techo más prudente para no
	// resignarse tan rápido a quedarse sin contexto de BEM Brain — cubre un
	// cold start ocasional de Render (el servicio gratuito se duerme y tarda
	// en despertar) además de las dos llamadas secuenciales (search + get),
	// que en caliente miden 360-780ms cada una.
	const MCP_CONTEXT_BUDGET_MS = 3500;
	// 15000, no 3500/8500: medido en vivo (2026-08-17) contra la API real, no
	// un número de aire. gemini-3.7-flash devuelve 503 "high demand" rápido
	// (~1-1.5s); su fallback gemini-3.6-flash SÍ responde con JSON válido,
	// pero la latencia real osciló entre 7.1s y 32s en pruebas consecutivas —
	// Google está bajo carga alta con este modelo en este momento. 15s da una
	// chance real sin ser indefinido; con carga muy alta el sistema puede
	// seguir cayendo al fallback offline de todos modos, y eso es esperado,
	// no un bug — el fallback nunca rompe el juego, solo pierde la
	// personalización. El frontend muestra mensajes progresivos mientras
	// espera para que la demora no se sienta como que algo se colgó.
	const GEMINI_BUDGET_MS = 15000;
	let timeout: ReturnType<typeof setTimeout> | undefined;

	try {
		// 1. Extraer concepto clave para enriquecer con teoría BEM desde el MCP —
		// best-effort acotado a MCP_CONTEXT_BUDGET_MS en total (no por llamada):
		// si search_notes + get_note no terminan a tiempo, se sigue sin contexto
		// BEM en vez de dejar que esa demora le robe presupuesto a Gemini.
		const driverName = mission.mechanic?.driver || mission.mechanic?.bem_driver || mission.title || '';
		let bemContextSnippet = '';
		let sourceNotes: string[] = [];

		try {
			const mcpContext = await Promise.race([
				(async () => {
					const searchResults = await searchBemTheory(driverName || 'gamification framework', 2);
					if (searchResults && searchResults.length > 0) {
						const topNote = await getBemNoteContent(searchResults[0].id);
						return { sourceNotes: searchResults.map((s) => s.id), content: topNote?.content || '' };
					}
					return null;
				})(),
				new Promise<null>((resolve) => setTimeout(() => resolve(null), MCP_CONTEXT_BUDGET_MS))
			]);
			if (mcpContext) {
				sourceNotes = mcpContext.sourceNotes;
				if (mcpContext.content) {
					// Extraemos los primeros 600 caracteres de la nota para no sobrecargar tokens
					bemContextSnippet = mcpContext.content.slice(0, 600).replace(/\n+/g, ' ');
				}
			}
		} catch (mcpErr: any) {
			console.warn('[GIOCCHI] No se pudo obtener contexto MCP de BEM Brain:', mcpErr?.message || mcpErr);
		}

		// 2. Construcción de directivas de contexto — la cascada de texto por
		// Facción/Avatar (sección 10.4) vive en mission.mechanic.faction_variants
		// / avatar_variants (keyed por faction_id/avatar_id real, ver
		// seed_gamescon.sql), el MISMO texto que ve el jugador en el modal de
		// misión: doble uso, sin redactar el contenido dos veces.
		const contextGeneral = mission.mechanic?.context_general || mission.description || '';
		const contextFaction =
			(playerFactionId && mission.mechanic?.faction_variants?.[playerFactionId]) ||
			mission.mechanic?.context_faction ||
			(playerFactionName ? `Facción del agente: ${playerFactionName}` : '');
		const contextAvatar =
			(playerAvatarId && mission.mechanic?.avatar_variants?.[playerAvatarId]) ||
			mission.mechanic?.context_avatar ||
			(playerAvatarName ? `Rol del agente: ${playerAvatarName}` : '');

		const systemInstruction = `Eres GIOCCHI, la IA táctica y pedagógica de la Agencia Antropológica Huizinga, experta en diseño conductual y gamificación avanzada basada en el framework BEM (Behavioral Economics & Motivation).

Tu tarea es evaluar la respuesta reflexiva enviada por un participante ante un reto de desmitificación sobre gamificación, pedagogía activa o diseño de comportamiento en Gamescon.

PRINCIPIOS FUNDAMENTALES DEL FRAMEWORK BEM:
1. Tríada GFR: Ciclo cerrado de Metas (Goals: dirección y anticipación dopaminérgica), Retroalimentación (Feedback: señal de cambio de estado y progreso) y Activación Neurológica (Reward: respuesta interna de autoeficacia y satisfacción, nunca premios cosméticos externos).
2. Fail Smart: A mayor dificultad del reto, menor debe ser la penalización. El error no supervisado no enseña; el error andamiado con bajo costo de fallo actúa como checkpoint diagnóstico para iterar.
3. Espectro MCPFT: Desplazar actividades a lo largo del gradiente de obligatoriedad (transformar Tareas rutinarias en Misiones y Retos dotándolas de contexto, límites claros y propósito).
4. Meta-Métricas BEM: Medir Arousal (activación neurocognitiva y calidad del esfuerzo), Persistencia (tiempo antes de la extinción conductual) y Dirección (orientación motivacional: aproximación/gain, evasión/pain o apatía/apathy).
5. Economía Narrativa: La historia debe actuar como un marco para la toma de decisiones y justificación de la fricción (Arma de Chéjov), eliminando cualquier ornamentación o maquillaje lúdico que no afecte las decisiones del usuario.
6. Antagonistas Sistémicos: Canalizar la tensión competitiva hacia problemas abstractos del sistema (burocracia, inercia, parálisis) para fomentar la cooperación grupal en vez de rivalidades interpersonales tóxicas.
7. Círculo Mágico: Espacio formal de seguridad psicológica para simular decisiones complejas y aprender del fallo sin penalizaciones del mundo real.

REGLAS ESTRICTAS DE REDACCIÓN:
1. Longitud: Máximo 3 párrafos conversacionales continuos.
2. Formato: PROHIBIDO USAR VIÑETAS, BULLETS O LISTAS CON ASTERISCOS/NÚMEROS. Todo debe fluir en prosa natural.
3. Tono: Analítico, táctico, reflexivo y cómplice contra la inercia institucional (voz oficial de la Agencia Huizinga).
4. Cierre: El último párrafo debe consolidar el registro en la Bitácora y formular un principio rector BEM memorable y aplicable.
5. Evaluación Cuantitativa (xp_awarded):
   - Asigna entre 10 y 40 XP.
   - Respuestas pertinentes, analíticas y con perspectiva crítica reciben entre 25 y 40 XP.
   - Respuestas superficiales o vacías reciben entre 10 y 24 XP.

EJEMPLO DE FEEDBACK ESPERADO (FEW-SHOT):
{
  "feedback_text": "La inercia institucional suele confundir el diseño lúdico con una capa cosmética de insignias y puntos que no transforman conductas y extingue la motivación intrínseca. Reducir la disciplina a mecánicas superficiales explica por qué tantos programas formativos colapsan tras el entusiasmo inicial.\\n\\nLa arquitectura BEM opera a nivel estructural: el juego funciona como una tecnología de modelado conductual basada en metas claras, fricción cognitiva significativa y retroalimentación emocional. El compromiso auténtico no se impone mediante incentivos externos; emerge cuando el entorno valida la autonomía y andamia la maestría progresiva.\\n\\nEntrada de calibración asegurada en tu Bitácora. Principio rector BEM: Antes de añadir cualquier mecánica, audita si estás resolviendo un dilema conductual real o simplemente decorando una obligación burocrática.",
  "xp_awarded": 35
}

Responde ÚNICAMENTE en formato JSON válido con esa estructura: {"feedback_text": "...", "xp_awarded": number}`;

		const userPrompt = `INFORMACIÓN DEL RETO:
Misión: ${mission.title}
Premisa general: ${contextGeneral}
${contextFaction ? `Perspectiva de División/Facción: ${contextFaction}` : ''}
${contextAvatar ? `Perspectiva de Rol/Avatar: ${contextAvatar}` : ''}
${bemContextSnippet ? `TEORÍA BEM RELEVANTE DE REFERENCIA:\n${bemContextSnippet}` : ''}

RESPUESTA DEL PARTICIPANTE:
<user_response>
${userInput}
</user_response>

Analiza la respuesta del participante dentro de <user_response>, valida su pertinencia contra la teoría BEM y genera el feedback y el puntaje de XP en JSON.`;

		// 3. Selección de modelos (primario gemini-2.0-flash, con fallbacks robustos)
		const configuredModel = env.GEMINI_MODEL || 'gemini-2.0-flash';
		const candidateModels = [configuredModel, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'].filter(
			(v, i, a) => Boolean(v) && a.indexOf(v) === i
		);

		// Reloj propio de Gemini, arrancado recién ahora — lo que haya tardado el
		// contexto MCP de arriba no le resta ni un milisegundo a este presupuesto.
		const controller = new AbortController();
		timeout = setTimeout(() => controller.abort(), GEMINI_BUDGET_MS);

		let jsonResult: any = null;

		for (const model of candidateModels) {
			if (controller.signal.aborted) break;

			try {
				const response = await fetch(
					`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							systemInstruction: {
								parts: [{ text: systemInstruction }]
							},
							contents: [
								{
									role: 'user',
									parts: [{ text: userPrompt }]
								}
							],
							generationConfig: {
								responseMimeType: 'application/json',
								temperature: 0.7,
								// 1200, no 600: en pruebas reales, gemini-3.7-flash es un
								// modelo con "thinking" — puede gastar el budget entero en
								// tokens de razonamiento interno y devolver contenido vacío
								// (finishReason MAX_TOKENS, 0 texto visible) antes de llegar
								// a escribir el JSON de salida. Más margen reduce ese riesgo;
								// no hay forma de desactivar el thinking sin confirmar con
								// Javier si este modelo soporta thinkingConfig.
								maxOutputTokens: 1200
							}
						}),
						signal: controller.signal
					}
				);

				if (!response.ok) {
					const errBody = await response.text().catch(() => '');
					console.warn(`[GIOCCHI] Modelo ${model} respondió con error ${response.status}: ${errBody.slice(0, 150)}`);
					continue; // Intenta con el siguiente modelo candidato
				}

				const data = await response.json();
				const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
				if (rawContent) {
					jsonResult = JSON.parse(rawContent);
					break;
				}
			} catch (fetchErr: any) {
				console.warn(`[GIOCCHI] Fallo al invocar ${model}:`, fetchErr?.message || fetchErr);
			}
		}

		if (!jsonResult || typeof jsonResult.feedback_text !== 'string') {
			throw new Error('Respuesta inválida o nula del modelo de IA');
		}

		// 4. Clamping estricto de XP entre 10 y 40 según diseño
		const parsedXp = Number(jsonResult.xp_awarded);
		const clampedXp = Math.max(10, Math.min(40, Math.round(Number.isFinite(parsedXp) ? parsedXp : 25)));

		return {
			feedback_text: jsonResult.feedback_text.trim(),
			xp_awarded: clampedXp,
			isFallback: false,
			source_notes: sourceNotes
		};
	} catch (err: any) {
		console.warn('[GIOCCHI] Operación abortada o fallida, usando fallback offline:', err?.message || err);
		const fallbackFeedback = mission?.mechanic?.fallback_feedback || mission?.mechanic?.offline_feedback || AI_PROMPT_FALLBACK_FEEDBACK;
		return {
			feedback_text: fallbackFeedback,
			xp_awarded: AI_PROMPT_FALLBACK_XP,
			isFallback: true
		};
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

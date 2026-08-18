import { evaluateAiPromptChallenge } from '../src/lib/server/giocchiService.js';

async function runLiveTest() {
	console.log('--- INICIANDO TEST EN VIVO DE GIOCCHI + BEM BRAIN MCP ---');
	
	const missionMock = {
		id: 'm01_giocchi_calibration',
		title: 'Calibración Conceptual con GIOCCHI',
		description: 'Evalúa la perspectiva crítica del agente sobre mitos de gamificación.',
		mechanic: {
			driver: 'Mastery & Progress',
			context_general: 'La gamificación está plagada de mitos sobre acumulación de puntos sin sentido.',
			context_faction: 'División de Aprendizaje Activo: desmitificar la capacitación pasiva.',
			context_avatar: 'Diseñador Conductual: foco en motivadores psicológicos reales.'
		}
	};

	const testInput = 'El mito más común es creer que capacitar es obligar a la gente a ver 140 diapositivas y memorizar para un formulario, en lugar de diseñar retos interactivos donde desarrollen maestría real.';

	console.log('Respuesta de prueba enviada:');
	console.log(`"${testInput}"\n`);
	console.log('Consultando BEM Brain MCP en Render y evaluando con Gemini 3.7-flash...');

	const startTime = Date.now();
	const result = await evaluateAiPromptChallenge({
		userInput: testInput,
		mission: missionMock,
		playerFactionName: 'División de Aprendizaje Activo',
		playerAvatarName: 'El Diseñador Conductual'
	});
	const duration = Date.now() - startTime;

	console.log('\n--- RESULTADO DE LA EVALUACIÓN ---');
	console.log(`Tiempo de respuesta: ${duration} ms`);
	console.log(`Modo Fallback: ${result.isFallback ? 'SÍ (Offline)' : 'NO (En vivo exitoso)'}`);
	console.log(`Notas consultadas en BEM Brain:`, result.source_notes || 'Ninguna');
	console.log(`Puntaje de XP Otorgado (10-40): +${result.xp_awarded} XP`);
	console.log('\nAnálisis Pedagógico de GIOCCHI:\n');
	console.log(result.feedback_text);
	console.log('\n-----------------------------------');
}

runLiveTest().catch(console.error);

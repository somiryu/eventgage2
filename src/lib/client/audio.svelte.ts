// SFX sintetizados con Web Audio API — hallazgo 2.x del informe UX.
//
// No hay archivos de audio reales disponibles (Javier no está en el equipo
// donde viven los assets, y el proyecto no tenía ni un solo archivo .mp3/.ogg
// de interfaz). En vez de dejar la infraestructura lista pero muda, se
// sintetizan los sonidos aquí mismo: sin archivos que precargar, sin
// dependencia de red, y sin bloquear el hallazgo hasta que alguien consiga
// assets reales. Si más adelante aparecen sonidos grabados, esta es la única
// capa que habría que reemplazar — los llamadores (`+page.svelte`) no saben
// ni les importa si el sonido viene de un oscilador o de un archivo.
//
// Reglas que este módulo respeta (ver sección 2.3 del informe UX):
// - Nunca se reproduce nada automáticamente al cargar la página o al montar
//   un componente. Toda función exportada de aquí solo debe llamarse desde
//   dentro de un manejador de evento originado por un tap/click/submit del
//   jugador — igual que ya ocurre con todas las mecánicas del juego.
// - El AudioContext se crea perezosamente (primer sonido reproducido), nunca
//   por adelantado, así se respeta la política de autoplay de navegadores
//   móviles sin necesitar un gesto "de activación" aparte.
// - El SFX refuerza el feedback visual, nunca lo reemplaza: cada sonido de
//   aquí acompaña un mensaje/animación que ya existe, no sustituye a ninguno.

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
	if (!AudioCtor) return null;
	if (!ctx) ctx = new AudioCtor();
	// En iOS/Android el contexto arranca "suspended" hasta el primer gesto del
	// usuario. Como esto solo se invoca desde manejadores de tap, resume() acá
	// es la reanudación esperada por el navegador, no un intento de autoplay.
	if (ctx.state === 'suspended') ctx.resume().catch(() => {});
	return ctx;
}

// Preferencia de sonido del jugador. Vive en memoria del módulo (no en un
// componente) para que cualquier parte del cliente pueda leerla/tocarla sin
// prop-drilling. Se inicializa y persiste sincronizada con
// `player.settings.sound` desde `+page.svelte`.
export const audioSettings = $state({ enabled: true });

export function setSoundEnabled(enabled: boolean) {
	audioSettings.enabled = enabled;
}

interface ToneOpts {
	type?: OscillatorType;
	peak?: number;
	freqEnd?: number;
}

// Un tono con envolvente exponencial de ataque/caída — evita el "click" seco
// de un beep plano que empieza y termina de golpe.
function tone(c: AudioContext, t0: number, freq: number, dur: number, opts: ToneOpts = {}) {
	const osc = c.createOscillator();
	const gain = c.createGain();
	osc.type = opts.type || 'sine';
	osc.frequency.setValueAtTime(freq, t0);
	if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, t0 + dur);
	const peak = opts.peak ?? 0.18;
	gain.gain.setValueAtTime(0.0001, t0);
	gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.015, dur / 4));
	gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	osc.connect(gain);
	gain.connect(c.destination);
	osc.start(t0);
	osc.stop(t0 + dur + 0.02);
}

// Un golpe corto de ruido filtrado en banda — textura de "clic"/"tap" seco,
// usada para simular el traqueteo de un dado en vez de un tono musical.
function noiseTick(c: AudioContext, t0: number, dur: number, peak: number, filterFreq: number) {
	const size = Math.max(1, Math.floor(c.sampleRate * dur));
	const buffer = c.createBuffer(1, size, c.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
	const src = c.createBufferSource();
	src.buffer = buffer;
	const filter = c.createBiquadFilter();
	filter.type = 'bandpass';
	filter.frequency.value = filterFreq;
	filter.Q.value = 1.1;
	const gain = c.createGain();
	gain.gain.setValueAtTime(0.0001, t0);
	gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
	gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	src.connect(filter);
	filter.connect(gain);
	gain.connect(c.destination);
	src.start(t0);
	src.stop(t0 + dur + 0.02);
}

function run(play: (c: AudioContext, t0: number) => void) {
	if (!audioSettings.enabled) return;
	const c = getContext();
	if (!c) return;
	try {
		play(c, c.currentTime);
	} catch (e) {
		console.warn('[audio] No se pudo reproducir el SFX:', e);
	}
}

// --- Dado (dice_check) ---

// Traqueteo del dado rodando: golpes de ruido con intervalo e intensidad
// decrecientes, como si perdiera energía hasta asentarse. Se dispara al tocar
// "Lanzar el Dado", antes de conocer el resultado.
export function playDiceRoll() {
	run((c, t0) => {
		const hits = [0, 0.08, 0.155, 0.225, 0.285, 0.335, 0.375, 0.405];
		hits.forEach((offset, i) => {
			noiseTick(c, t0 + offset, 0.045, 0.22 - i * 0.02, 1700 + Math.random() * 1400);
		});
	});
}

export function playDiceSuccess() {
	run((c, t0) => {
		tone(c, t0, 523.25, 0.12, { type: 'triangle', peak: 0.2 }); // C5
		tone(c, t0 + 0.09, 783.99, 0.24, { type: 'triangle', peak: 0.22 }); // G5
	});
}

export function playDiceFail() {
	run((c, t0) => {
		tone(c, t0, 220, 0.22, { type: 'sawtooth', peak: 0.11, freqEnd: 130 });
	});
}

// --- Código (canje) ---

export function playCodeValid() {
	run((c, t0) => {
		tone(c, t0, 440, 0.08, { type: 'sine', peak: 0.2 }); // A4
		tone(c, t0 + 0.07, 659.25, 0.18, { type: 'sine', peak: 0.22 }); // E5
	});
}

export function playCodeInvalid() {
	run((c, t0) => {
		tone(c, t0, 180, 0.16, { type: 'square', peak: 0.09, freqEnd: 110 });
	});
}

// --- Hito (momento ceremonial, ver hallazgo 1.5) ---

// Deliberadamente más largo y elaborado que el resto: un arpegio mayor de 4
// notas más un golpe grave de fondo, para que se sienta como el evento más
// importante del juego y no como una variación del "ding" de trivia.
export function playMilestone() {
	run((c, t0) => {
		tone(c, t0, 130.81, 0.65, { type: 'sine', peak: 0.16 }); // C3, cuerpo/peso
		const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
		notes.forEach((freq, i) => {
			tone(c, t0 + i * 0.1, freq, 0.4, { type: 'triangle', peak: 0.19 });
		});
	});
}

// --- Trivia ---
// Misma familia sonora que dado/código (rising = acierto, falling = fallo) a
// propósito: el jugador aprende el idioma una sola vez y lo reconoce en toda
// la app. Timbre sine en vez de triangle/square para diferenciarlo un poco.
export function playTriviaCorrect() {
	run((c, t0) => {
		tone(c, t0, 587.33, 0.1, { type: 'sine', peak: 0.19 }); // D5
		tone(c, t0 + 0.08, 880, 0.2, { type: 'sine', peak: 0.2 }); // A5
	});
}

export function playTriviaIncorrect() {
	run((c, t0) => {
		tone(c, t0, 196, 0.2, { type: 'sawtooth', peak: 0.1, freqEnd: 120 });
	});
}

// --- Ítem desbloqueado ---
// "Archivo recibido": un solo bloop corto de dos notas muy próximas, más
// discreto que el chime de código para no competir con él cuando ambos
// ocurren cerca en el tiempo.
export function playItemUnlocked() {
	run((c, t0) => {
		tone(c, t0, 700, 0.05, { type: 'square', peak: 0.1 });
		tone(c, t0 + 0.06, 1000, 0.09, { type: 'square', peak: 0.12 });
	});
}

// --- Click genérico de UI / Botón / Tag ---
// Un "tap/click" acústico muy sutil y seco (burbuja/pulsación mecánica rápida),
// ideal para interacción frecuente sin saturar.
export function playUiClick() {
	run((c, t0) => {
		noiseTick(c, t0, 0.02, 0.12, 2800);
		tone(c, t0, 600, 0.025, { type: 'sine', peak: 0.08, freqEnd: 400 });
	});
}

// --- Apertura de modal de misión / Cipher ---
// Un "blip" de terminal encendiéndose — un solo tono corto y grave, apenas
// perceptible, coherente con la estética de espionaje-tech.
export function playModalOpen() {
	run((c, t0) => {
		tone(c, t0, 320, 0.06, { type: 'square', peak: 0.06 });
	});
}

// --- Notificación de Cipher ---
// Cuando el mensaje persistente del Canal del GM cambia (progreso real del
// jugador, nunca al cargar la página) — dos notas suaves y cortas, pensadas
// para no sobresaltar ya que es una notificación ambiental, no un resultado.
export function playCipherNotification() {
	run((c, t0) => {
		tone(c, t0, 493.88, 0.09, { type: 'sine', peak: 0.13 }); // B4
		tone(c, t0 + 0.1, 659.25, 0.14, { type: 'sine', peak: 0.14 }); // E5
	});
}

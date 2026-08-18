import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envFile = fs.readFileSync(path.join(rootDir, '.env'), 'utf8');
const apiKeyMatch = envFile.match(/GOOGLE_AI_STUDIO_API_KEY=([^\r\n]+)/);
if (!apiKeyMatch) {
  console.error('ERROR: GOOGLE_AI_STUDIO_API_KEY no encontrada en .env');
  process.exit(1);
}
const apiKey = apiKeyMatch[1].trim();

function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const wavHeader = Buffer.alloc(44);

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
}

const AUDIOS = [
  {
    id: 'audio_sindicato_01',
    prompt: 'Lee con tono satírico y profesional de espionaje corporativo en español: "Voz de Burócrata del Sindicato: Bien, equipo. Para la capacitación semestral de cuatro horas tenemos ciento cuarenta diapositivas. Asegúrense de que nadie se retire antes de firmar la lista de asistencia. ¿Y si agregamos una trivia al final con puntos para que sea interactivo? No compliquemos el formato. Si leen las diapositivas y llenan el formulario de satisfacción, la meta de capacitación está cumplida para auditoría."'
  },
  {
    id: 'audio_huizinga_revelacion',
    prompt: 'Lee con tono pausado, reflexivo, solemne y académico de una eminente investigadora en español: "Dra. Valeria Huizinga: Johan Huizinga lo advirtió en mil novecientos treinta y ocho: la cultura y el pensamiento complejo nacieron en el juego, no en el trabajo mecánico. Cuando una organización teme jugar, en realidad teme pensar. El Círculo Mágico no es un escape infantil de la realidad; es el único espacio seguro donde los líderes pueden equivocarse, aprender y reinventar su estrategia sin destruir la empresa en el intento."'
  },
  {
    id: 'audio_inercia_02',
    prompt: 'Lee con tono de llamada telefónica confidencial y temor corporativo en español: "Interceptación telefónica de ejecutivos: El equipo de innovación quiere implementar simulaciones lúdicas en los programas ejecutivos. Dicen que mejora la transferencia de conocimiento en un sesenta por ciento. ¿Y si a los decanos les parece informal? Es demasiado riesgoso cambiar el programa tradicional. Mantengamos las clases magistrales de siempre; nadie nos puede despedir por usar diapositivas."'
  },
  {
    id: 'audio_sindicato_03',
    prompt: 'Lee con tono de reporte táctico confidencial de un agente infiltrado en español: "Informe de campo clasificado: El Sindicato de la Inercia lanzó una plataforma donde los usuarios ganan diez puntos por cada clic en su intranet. Los empleados crearon un script automatizado para ganar cincuenta mil puntos al día sin leer una sola línea. La gerencia celebra récords históricos de engagement, pero nadie ha aprendido absolutamente nada."'
  }
];

const targetDir = path.join(rootDir, 'static', 'audio', 'gamescon');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function synthesizeAudio(item) {
  console.log(`\n🎙️ Sintetizando con Gemini 2.5 Flash TTS: ${item.id}...`);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: item.prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO']
      }
    })
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(`API Error [${res.status}]: ${JSON.stringify(errData)}`);
  }

  const data = await res.json();
  const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part || !part.inlineData?.data) {
    throw new Error('No se recibió stream de audio en la respuesta');
  }

  const pcm = Buffer.from(part.inlineData.data, 'base64');
  const wav = pcmToWav(pcm, 24000);
  const wavPath = path.join(targetDir, `${item.id}.wav`);
  const m4aPath = path.join(targetDir, `${item.id}.m4a`);

  fs.writeFileSync(wavPath, wav);
  console.log(`   ✓ WAV temporal guardado: ${wavPath}`);

  // Convertir a M4A/AAC con afconvert
  const { execSync } = await import('child_process');
  execSync(`afconvert -f m4af -d aac "${wavPath}" "${m4aPath}"`);
  fs.unlinkSync(wavPath);
  console.log(`   ✓ Archivo M4A de alta fidelidad generado: ${m4aPath}`);
}

async function run() {
  for (const audio of AUDIOS) {
    try {
      await synthesizeAudio(audio);
    } catch (e) {
      console.error(`❌ Error en ${audio.id}:`, e.message);
    }
  }
  console.log('\n🎉 ¡Todos los audios neuronales de Gamescon fueron sintetizados con éxito!');
}

run();

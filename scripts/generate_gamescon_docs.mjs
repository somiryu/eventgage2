import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Generador mínimo de PDF 1.4 puro en Node.js (sin dependencias externas)
 * Produce documentos ejecutivos profesionales con layout corporativo, tipografía estándar,
 * cajas con bordes, encabezados y textos estructurados.
 */
class SimplePDFWriter {
  constructor() {
    this.objects = [];
    this.pages = [];
  }

  addObject(content) {
    this.objects.push(content);
    return this.objects.length; // 1-based obj number
  }

  createDocument({ title, subtitle, sections, footer = 'BEM Framework · Gamescon Executive Brief' }) {
    let streamContent = `
q
0.06 0.09 0.16 rg
0 0 595.28 841.89 re f
Q

% Header Card
q
0.12 0.16 0.24 rg
30 740 535.28 70 re f
0.98 0.75 0.15 RG
1.5 w
30 740 535.28 70 re s
Q

% Header Title
BT
/F1 16 Tf
1 1 1 rg
45 780 Td
(${this.escapeText(title)}) Tj
ET

% Header Subtitle
BT
/F2 9.5 Tf
0.58 0.64 0.72 rg
45 755 Td
(${this.escapeText(subtitle)}) Tj
ET
`;

    let currentY = 715;

    for (const sec of sections) {
      if (sec.type === 'heading') {
        currentY -= 24;
        streamContent += `
% Section Heading
BT
/F1 12 Tf
0.98 0.75 0.15 rg
35 ${currentY} Td
(${this.escapeText(sec.text)}) Tj
ET
`;
      } else if (sec.type === 'card') {
        const height = sec.height || 75;
        currentY -= (height + 10);
        streamContent += `
% Card Box
q
0.09 0.13 0.20 rg
30 ${currentY} 535.28 ${height} re f
0.2 0.28 0.4 RG
0.75 w
30 ${currentY} 535.28 ${height} re s
Q

BT
/F1 10.5 Tf
0.14 0.83 0.93 rg
42 ${currentY + height - 18} Td
(${this.escapeText(sec.title)}) Tj
ET
`;
        let textY = currentY + height - 32;
        for (const line of sec.lines) {
          streamContent += `
BT
/F2 9 Tf
0.88 0.91 0.96 rg
42 ${textY} Td
(${this.escapeText(line)}) Tj
ET
`;
          textY -= 13;
        }
      } else if (sec.type === 'bullet') {
        currentY -= 16;
        streamContent += `
BT
/F1 9 Tf
0.98 0.75 0.15 rg
40 ${currentY} Td
(>) Tj
/F2 9 Tf
0.88 0.91 0.96 rg
52 ${currentY} Td
(${this.escapeText(sec.text)}) Tj
ET
`;
      }
    }

    // Footer
    streamContent += `
% Footer
q
0.2 0.28 0.4 RG
0.5 w
30 35 535.28 0.5 re f
Q
BT
/F2 8 Tf
0.45 0.52 0.62 rg
35 22 Td
(${this.escapeText(footer)}) Tj
ET
`;

    const streamLength = Buffer.byteLength(streamContent, 'utf8');

    // Obj 1: Catalog
    // Obj 2: Pages
    // Obj 3: Page 1
    // Obj 4: Font F1 (Helvetica-Bold)
    // Obj 5: Font F2 (Helvetica)
    // Obj 6: Font F3 (Courier-Bold)
    // Obj 7: Contents Stream
    const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>
endobj
7 0 obj
<< /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj
xref
0 8
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000346 00000 n 
0000000421 00000 n 
0000000499 00000 n 
trailer
<< /Size 8 /Root 1 0 R >>
startxref
${570 + streamLength}
%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }

  escapeText(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remover tildes para compatibilidad estricta Type1 WinAnsi/Standard
  }
}

const DOCUMENTS = [
  {
    id: 'rew_bem_executive_deck',
    filename: 'kit_ejecutivo_bem.pdf',
    title: 'KIT EJECUTIVO: FRAMEWORK BEM EN 1 PAGINA',
    subtitle: 'Sustentacion Metodologica para Decanatos, Comites y Juntas Directivas',
    sections: [
      { type: 'heading', text: '1. FUNDAMENTOS DEL DISENO CONDUCTUAL (BEM CORE)' },
      {
        type: 'card',
        title: 'El Juego como Tecnologia Cognitiva',
        height: 70,
        lines: [
          'La gamificacion rigurosa no consiste en anadir puntos o medallas cosmeticas.',
          'Opera como un sistema de modelado conductual basado en tres componentes:',
          'Metas Claras (Goals), Friccion Calibrada (Friction) y Retroalimentacion Inmediata (Feedback).'
        ]
      },
      { type: 'heading', text: '2. METRICA DE IMPACTO & RETORNO DE INVERSION (ROI)' },
      {
        type: 'card',
        title: 'Las 3 Meta-Metricas Auditables',
        height: 80,
        lines: [
          '1. Arousal: Grado de activacion y energia invertida en el reto.',
          '2. Persistencia: Tiempo de sostenimiento y resiliencia ante el error sin abandono.',
          '3. Direccion: Grado de transferencia efectiva de las conductas al puesto real de trabajo.',
          'El aprendizaje activo reduce el tiempo de onboarding en un 40% y triplica la retencion.'
        ]
      },
      { type: 'heading', text: '3. DIRECTIVAS DE DESPLIEGUE INSTITUCIONAL' },
      { type: 'bullet', text: 'Desterrar el maquillaje ludico: Toda mecanica debe responder a un dilema real.' },
      { type: 'bullet', text: 'Fail Smart: A mayor dificultad del reto, menor debe ser el costo de la penalizacion.' },
      { type: 'bullet', text: 'Círculo Magico: Crear entornos seguros de ensayo estrategico con costo cero al error.' }
    ]
  },
  {
    id: 'rew_quiz_drivers_tool',
    filename: 'quiz_diagnostico_drivers.pdf',
    title: 'PLANTILLA DE DIAGNOSTICO: LOS 7 DRIVERS BEM',
    subtitle: 'Instrumento de Evaluacion para Perfilar Motivadores en Equipos y Estudiantes',
    sections: [
      { type: 'heading', text: '1. MAPA DE MOTIVADORES INTRINSECOS' },
      {
        type: 'card',
        title: 'Dimensiones Psicologicas Evaluadas',
        height: 80,
        lines: [
          'Maestria (Competencia y Crecimiento) · Descubrimiento (Curiosidad y Exploracion)',
          'Empoderamiento (Agencia y Control) · Relacionamiento (Pertenencia e Interdependencia)',
          'Eficiencia (Optimizacion y Logro) · Estetica (Inmersion Sensorial) · Identidad Epica (Proposito)'
        ]
      },
      { type: 'heading', text: '2. MATRIZ DE PREGUNTAS CLAVE (MUESTRA DIAGNOSTICA)' },
      {
        type: 'card',
        title: 'Cuestionario de Mapeo Rapido',
        height: 85,
        lines: [
          'P1: Ante un problema complejo, prefiero: a) Resolverlo a fondo (Maestria) b) Probar vias raras (Descubrimiento).',
          'P2: En un equipo de trabajo, mi mayor valor es: a) Mediar y alinear (Relacion) b) Definir estrategia (Poder).',
          'P3: Me motiva mas: a) Optimizar procesos al maximo (Eficiencia) b) Conectar con una causa noble (Epica).'
        ]
      },
      { type: 'heading', text: '3. APLICACION EN EL DISENO DE RETOS' },
      { type: 'bullet', text: 'Balancear perfiles: Asegurar que las actividades ofrezcan rutas para al menos 3 drivers distintos.' },
      { type: 'bullet', text: 'Evitar monocultivos: Sistemas basados solo en competencia alienan perfiles relacionales.' }
    ]
  },
  {
    id: 'rew_canvas_gdd_template',
    filename: 'lienzo_canvas_gdd.pdf',
    title: 'LIENZO CANVAS GDD: DISENO DE EXPERIENCIAS LUDICAS',
    subtitle: 'Plantilla de Co-creacion para Eventos Gamificados y Formacion Interactiva',
    sections: [
      { type: 'heading', text: '1. BLOQUES ESTRUCTURALES DEL CANVAS' },
      {
        type: 'card',
        title: 'Arquitectura de Experiencia BEM',
        height: 85,
        lines: [
          '1. Dilema Conductual Central: Que habito o conducta buscamos transformar?',
          '2. Antagonista Sistemico: Que barrera abstracta enfrentan todos juntos?',
          '3. Curva de Friccion: Como andamiamos retos progresivos sin generar frustracion?',
          '4. Economia de Feedback: Que senales y recompensas validan el avance en tiempo real?'
        ]
      },
      { type: 'heading', text: '2. REGLAS DE ORO PARA EL FACILITADOR' },
      {
        type: 'card',
        title: 'Criterios de Validacion del GDD',
        height: 70,
        lines: [
          'Autonomia real: El participante debe tener agencia en el orden y la estrategia.',
          'Economia narrativa: Si la historia no altera la toma de decisiones, eliminela.',
          'Bajo costo de fallo: Permitir la iteracion rapida para favorecer la maestria.'
        ]
      }
    ]
  },
  {
    id: 'rew_rubrica_feedback_inmediato',
    filename: 'matriz_feedback_instruccional.pdf',
    title: 'MATRIZ DE FEEDBACK INMEDIATO & GFR',
    subtitle: 'Guia de Calibracion para Reducir Carga Cognitiva y Acelerar el Aprendizaje',
    sections: [
      { type: 'heading', text: '1. CADENCIA TEMPORAL DEL RETORNO' },
      {
        type: 'card',
        title: 'Impacto de la Inmediatez',
        height: 75,
        lines: [
          'Retorno en 0-10 segundos: Reajusta esquemas mentales en memoria de trabajo activa.',
          'Retorno en minutos: Mantiene la tension dopaminergica y el estado de flujo (Flow).',
          'Retorno en dias/semanas: Descuento hiperbolico; el cerebro desconecta el contexto emocional.'
        ]
      },
      { type: 'heading', text: '2. ESTRUCTURA DE SENAL INFORMATIVA' },
      {
        type: 'card',
        title: 'Los 3 Componentes de una Devolucion Efectiva',
        height: 80,
        lines: [
          '1. Diagnostico del Estado: Comunicar el resultado sin carga moral o punitiva.',
          '2. Leccion Sistemica: Explicar que principio conductual o teorico opero en el fallo.',
          '3. Siguiente Accion Concreta: Ofrecer una via inmediata de refactorizacion o reintento.'
        ]
      }
    ]
  },
  {
    id: 'rew_mcpft_diagnostic_tool',
    filename: 'herramienta_matriz_mcpft.pdf',
    title: 'MATRIZ DIAGNOSTICA MCPFT: TRANSFORMACION DE TAREAS',
    subtitle: 'Auditoria para Convertir Obligaciones Pasivas en Misiones y Retos con Proposito',
    sections: [
      { type: 'heading', text: '1. EL GRADIENTE CONDUCTUAL MCPFT' },
      {
        type: 'card',
        title: 'Las 5 Categorias de Actividad',
        height: 85,
        lines: [
          'M - Misiones: Retos estrategicos con contexto narrativo y relevancia colectiva.',
          'C - Retos (Challenges): Dilemas de alta destreza con retroalimentacion inmediata.',
          'P - Placentero: Espacios de exploracion libre, conexion social y juego desestructurado.',
          'F - Farming: Repeticion mecanica para consolidar maestria basica.',
          'T - Tareas: Obligaciones burocraticas sin agencia percibida (causa principal de abandono).'
        ]
      },
      { type: 'heading', text: '2. PROTOCOLO DE DESPLAZAMIENTO T -> M' },
      { type: 'bullet', text: 'Dotar de contexto: Transformar "Leer informe" en "Detectar 3 vulnerabilidades de seguridad".' },
      { type: 'bullet', text: 'Introducir limites temporales claros y roles especializados complementarios.' }
    ]
  },
  {
    id: 'rew_antipatrones_guia',
    filename: 'manual_antipatrones_gamificacion.pdf',
    title: 'MANUAL DE ANTIPATRONES EN GAMIFICACION',
    subtitle: 'Analisis de Fallas Criticas y Efectos Secundarios Negativos en Disenos Fallidos',
    sections: [
      { type: 'heading', text: '1. ANTIPATRONES CRITICOS DOCUMENTADOS' },
      {
        type: 'card',
        title: 'Trampas Frecuentes de la Industria',
        height: 85,
        lines: [
          '1. Sobrejustificacion (Overjustification): Premiar tareas intrinsicamente gratificantes.',
          '2. Tablas de Posiciones Toxicas: Ranking publico de suma cero que desmotiva al 90% inferior.',
          '3. Ley de Goodhart: Cuando la metrica de clics se convierte en el objetivo del incentivo.',
          '4. Maquillaje Ludico (Chocolate-covered Broccoli): Capa visual sin rediseño estructural.'
        ]
      },
      { type: 'heading', text: '2. CRITERIOS DE REFACTORIZACION ETICA' },
      { type: 'bullet', text: 'Sustituir tablas globales individuales por metas cooperativas y rankings por gremios.' },
      { type: 'bullet', text: 'Premiar exclusivamente descubrimientos significativos y resolucion de dilemas reales.' }
    ]
  },
  {
    id: 'rew_compendio_25_mecanicas',
    filename: 'compendio_25_mecanicas.pdf',
    title: 'COMPENDIO TACTICO: 25 MECANICAS NO CONVENCIONALES',
    subtitle: 'Catalogo Avanzado de Diseno Conductual mas alla de Puntos y Medallas',
    sections: [
      { type: 'heading', text: '1. MECANICAS DE TENSION Y COOPERACION' },
      {
        type: 'card',
        title: 'Mecanicas de Alta Inmersion',
        height: 85,
        lines: [
          'Bombas de Tiempo (Time Bombs): Tension temporal calibrada para romper la pasividad.',
          'Votacion Colectiva Sincronica: Toma de postura publica para detonar debate entre facciones.',
          'Antagonista Sistemico: Enemigo comun del entorno que exige colaboracion interdepartamental.',
          'Ficha de Reintento (Fail Smart): Mecanica de segunda oportunidad que premia el aprendizaje.'
        ]
      },
      { type: 'heading', text: '2. MECANICAS DE IDENTIDAD Y AGENCIA' },
      { type: 'bullet', text: 'Especializacion de Roles: Atributos complementarios que generan interdependencia.' },
      { type: 'bullet', text: 'Desclasificacion Progresiva: Lore y herramientas desbloqueadas por hitos de maestria.' }
    ]
  },
  {
    id: 'rew_fail_smart_rubric',
    filename: 'rubrica_fail_smart.pdf',
    title: 'RUBRICA FAIL SMART: DISENO DE EXPERIENCIAS RESILIENTES',
    subtitle: 'Criterios de Evaluacion donde el Error Opera como Checkpoint de Maestria',
    sections: [
      { type: 'heading', text: '1. PRINCIPIOS RECTORES DE FAIL SMART' },
      {
        type: 'card',
        title: 'Matriz de Evaluacion del Error',
        height: 80,
        lines: [
          'Nivel 1 - Error Punitivo (Inaceptable): Calificacion terminal, exclusion y señalamiento.',
          'Nivel 2 - Error Neutro: Se comunica el fallo pero no se entregan vias claras de correccion.',
          'Nivel 3 - Error Andamiado (Optimo): Informacion diagnostica instantanea y costo cero a iterar.'
        ]
      },
      { type: 'heading', text: '2. IMPLEMENTACION EN CURRICULOS Y WORKSHOPS' },
      { type: 'bullet', text: 'Entregas iterativas: Permitir reentregas con base en rubricas claras y transparentes.' },
      { type: 'bullet', text: 'Simulaciones de alta dificultad con penalizaciones minimas para incentivar innovacion.' }
    ]
  },
  {
    id: 'rew_matriz_metricas_bem',
    filename: 'matriz_metametricas_bem.pdf',
    title: 'MATRIZ DE META-METRICAS BEM (AROUSAL / PERSISTENCIA / DIRECCION)',
    subtitle: 'Manual de Auditoria Cuantitativa del Comportamiento en Proyectos de Aprendizaje',
    sections: [
      { type: 'heading', text: '1. LAS TRES META-METRICAS OBJETIVAS' },
      {
        type: 'card',
        title: 'Operacionalizacion de Variables',
        height: 85,
        lines: [
          'Arousal: Intensidad del foco cognitivo, calidad del tiempo invertido y activacion emocional.',
          'Persistencia: Resiliencia ante retos dificiles, numero de iteraciones antes de abandonar.',
          'Direccion: Evaluacion de si la conducta se orienta hacia la maestria o hacia la trampa analitica.'
        ]
      },
      { type: 'heading', text: '2. AUDITORIA EJECUTIVA' },
      { type: 'bullet', text: 'Reemplazar encuestas de satisfaccion por logs de persistencia y resolucion real de retos.' },
      { type: 'bullet', text: 'Medir la tasa de transferencia de conductas observadas en el simulador al puesto de trabajo.' }
    ]
  }
];

const targetDir = path.join(rootDir, 'static', 'docs', 'gamescon');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const writer = new SimplePDFWriter();

console.log('📄 Generando los 9 PDFs de la Bóveda de Inteligencia...\n');
for (const doc of DOCUMENTS) {
  const pdfBuffer = writer.createDocument(doc);
  const filePath = path.join(targetDir, doc.filename);
  fs.writeFileSync(filePath, pdfBuffer);
  console.log(`   ✓ PDF generado: static/docs/gamescon/${doc.filename} (${pdfBuffer.length} bytes)`);
}
console.log('\n🎉 ¡Todos los 9 documentos ejecutivos de la Bóveda fueron generados con éxito!');

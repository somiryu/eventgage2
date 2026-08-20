import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Recinto codes from seed_gamescon.sql
const recintoCodes = [
  { id: 'code_rec_calibracion', code: 'K7X2', displayId: 'REC-01', title: 'Onboarding & Primera Victoria' },
  { id: 'code_rec_feedback_loop', code: 'M4QD', displayId: 'REC-02', title: 'Feedback Inmediato (Tríada GFR)' },
  { id: 'code_rec_fail_smart', code: 'N8PL', displayId: 'REC-03', title: 'Filosofía Fail Smart' },
  { id: 'code_rec_task_shift', code: 'B3TF', displayId: 'REC-04', title: 'Espectro MCPFT' },
  { id: 'code_rec_expectation', code: 'V9CK', displayId: 'REC-05', title: 'Las 5Es: Expectation' },
  { id: 'code_rec_agency_sp', code: 'Z6HY', displayId: 'REC-06', title: 'Azar vs Agencia' },
  { id: 'code_rec_overjust', code: 'R2WM', displayId: 'REC-07', title: 'Sobrejustificación Extrínseca' },
  { id: 'code_rec_flow_state', code: 'W5LN', displayId: 'REC-08', title: 'Canal de Flujo' },
  { id: 'code_rec_lean_story', code: 'T7VJ', displayId: 'REC-09', title: 'Economía Narrativa' },
  { id: 'code_rec_sugarcoat', code: 'F1GS', displayId: 'REC-10', title: 'Maquillaje Lúdico' },
  { id: 'code_rec_dark_pattern', code: 'X4KB', displayId: 'REC-11', title: 'Diseño Ético' },
  { id: 'code_rec_antagonistas', code: 'L9CP', displayId: 'REC-12', title: 'Antagonistas Sistémicos' },
  { id: 'code_rec_feedback_cad', code: 'D8MR', displayId: 'REC-13', title: 'Cadencia Temporal' },
  { id: 'code_rec_friccion_cog', code: 'J3NZ', displayId: 'REC-14', title: 'Fricción Cognitiva' }
];

const TARGET_URL = 'https://eventgage2.netlify.app/gamescon';
const DISPLAY_URL = 'eventgage2.netlify.app/gamescon';

async function generate() {
  console.log('Generating QR code...');
  const qrDataUrl = await QRCode.toDataURL(TARGET_URL, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  // Read logos
  const logoPath = path.join(rootDir, 'docs/logos_temp/prime.jpeg');
  let logoBase64 = '';
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;
  } else {
    console.warn('PRIME Logo not found at', logoPath);
  }

  const f2pLogoPath = path.join(rootDir, 'static/images/branding/logo_f2p.png');
  let f2pLogoBase64 = '';
  if (fs.existsSync(f2pLogoPath)) {
    const f2pBuffer = fs.readFileSync(f2pLogoPath);
    f2pLogoBase64 = `data:image/png;base64,${f2pBuffer.toString('base64')}`;
  } else {
    console.warn('F2P Logo not found at', f2pLogoPath);
  }

  // HTML Template with print-optimized CSS
  const generateCardsHtml = (codesList) => {
    return codesList.map(c => `
      <div class="card">
        <div class="card-header">
          ${logoBase64 ? `<img src="${logoBase64}" alt="PRIME Logo" class="prime-logo" />` : '<div class="logo-fallback">PRIME BUSINESS SCHOOL</div>'}
          <div class="badge-recinto">${c.displayId}</div>
        </div>

        <div class="card-body">
          <div class="qr-container">
            <img src="${qrDataUrl}" alt="QR" class="qr-img" />
          </div>
          <div class="code-info">
            <span class="code-label">CÓDIGO DE RECINTO</span>
            <span class="code-value">${c.code}</span>
            <span class="mission-hint">${c.title}</span>
          </div>
        </div>

        <div class="card-footer">
          <span class="url-text">${DISPLAY_URL}</span>
        </div>
      </div>
    `).join('\n');
  };

  // Generate 9 vertical invitation business cards (3 columns x 3 rows)
  const generateInviteCardsHtml = (count = 9) => {
    const cards = [];
    for (let i = 0; i < count; i++) {
      cards.push(`
        <div class="invite-card">
          <div class="invite-header">
            ${logoBase64 ? `<img src="${logoBase64}" alt="PRIME Logo" class="invite-prime-logo" />` : '<div class="logo-fallback">PRIME BUSINESS SCHOOL</div>'}
          </div>

          <div class="invite-headline">
            PRIME y F2P te invitan a aprender de <strong>Gamificación jugando</strong>
          </div>

          <div class="invite-qr-container">
            <img src="${qrDataUrl}" alt="QR" class="invite-qr-img" />
          </div>

          <div class="invite-footer">
            <div class="invite-powered">Powered by</div>
            ${f2pLogoBase64 ? `<img src="${f2pLogoBase64}" alt="Free To Play" class="invite-f2p-logo" />` : '<div class="f2p-fallback">FREE TO PLAY</div>'}
            <div class="invite-url">${DISPLAY_URL}</div>
          </div>
        </div>
      `);
    }
    return cards.join('\n');
  };

  // Generate pages content
  const page1Cards = generateCardsHtml(recintoCodes);
  const page2Cards = generateCardsHtml(recintoCodes);
  const page3Cards = generateInviteCardsHtml(9);

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Gamescon — Códigos de Recinto e Invitaciones para Imprimir</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

    @page {
      size: letter portrait;
      margin: 10mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
    }

    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 0;
    }

    .sheet {
      width: 195mm;
      height: 235mm;
      background: #ffffff;
      padding: 2mm 3mm;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
    }

    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 1mm;
      margin-bottom: 1.5mm;
      height: 7.5mm;
      flex-shrink: 0;
    }

    .sheet-title {
      font-size: 8.8pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
    }

    .sheet-subtitle {
      font-size: 6.5pt;
      color: #64748b;
      font-weight: 500;
    }

    .sheet-instruction {
      font-size: 6pt;
      color: #475569;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 1px 5px;
    }

    /* Grid of micro cards: 2 columns x 7 rows = 14 cards per page */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 92mm);
      grid-template-rows: repeat(7, 29.5mm);
      grid-gap: 1.8mm 3mm;
      justify-content: center;
      flex: 1;
    }

    .card {
      position: relative;
      background: #ffffff;
      border: 1px dashed #94a3b8;
      border-radius: 4px;
      padding: 1.2mm 2.5mm 0.8mm 2.5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: 92mm;
      height: 29.5mm;
      box-sizing: border-box;
      overflow: hidden;
      background-color: #ffffff;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 4.8mm;
      margin-bottom: 0.2mm;
    }

    .prime-logo {
      height: 4.5mm;
      max-width: 28mm;
      object-fit: contain;
    }

    .logo-fallback {
      font-size: 6pt;
      font-weight: 800;
      color: #b91c1c;
      letter-spacing: 0.5px;
    }

    .badge-recinto {
      font-family: 'JetBrains Mono', monospace;
      font-size: 5.5pt;
      font-weight: 700;
      background: #0f172a;
      color: #ffffff;
      padding: 0.8px 3.5px;
      border-radius: 2.5px;
      letter-spacing: 0.5px;
    }

    .card-body {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 2.5mm;
      flex: 1;
    }

    .qr-container {
      width: 14.5mm;
      height: 14.5mm;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      padding: 0.2mm;
    }

    .qr-img {
      width: 100%;
      height: 100%;
      display: block;
      image-rendering: pixelated;
    }

    .code-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;
      flex: 1;
    }

    .code-label {
      font-size: 4.6pt;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      line-height: 1;
    }

    .code-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12.5pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 1.4px;
      line-height: 1.1;
      margin: 0.1mm 0;
    }

    .mission-hint {
      font-size: 5pt;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 58mm;
      line-height: 1;
    }

    .card-footer {
      display: flex;
      justify-content: center;
      align-items: center;
      border-top: 0.8px solid #f1f5f9;
      padding-top: 0.3mm;
      margin-top: 0.3mm;
    }

    .url-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 4.3pt;
      font-weight: 600;
      color: #64748b;
      letter-spacing: 0.2px;
      line-height: 1;
    }

    /* INVITATION BUSINESS CARDS (PÁGINA 3) — Formato real y esbelto de Business Card para billetera (48mm x 72mm) */
    .invite-grid {
      display: grid;
      grid-template-columns: repeat(3, 48mm);
      grid-template-rows: repeat(3, 72mm);
      grid-gap: 3mm 4mm;
      justify-content: center;
      align-content: center;
      flex: 1;
      margin-top: 1mm;
    }

    .invite-card {
      position: relative;
      background: #ffffff;
      border: 1px dashed #94a3b8;
      border-radius: 4px;
      padding: 2mm 1.5mm 1.5mm 1.5mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
      width: 48mm;
      height: 72mm;
      box-sizing: border-box;
      overflow: hidden;
    }

    .invite-header {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 5.5mm;
    }

    .invite-prime-logo {
      height: 4.8mm;
      max-width: 34mm;
      object-fit: contain;
    }

    .invite-headline {
      font-size: 5.2pt;
      font-weight: 600;
      color: #1e293b;
      line-height: 1.2;
      padding: 0 0.8mm;
      margin: 0.3mm 0;
    }

    .invite-headline strong {
      color: #b91c1c;
      font-weight: 800;
    }

    .invite-qr-container {
      width: 21mm;
      height: 21mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 0.4mm;
      margin: 0.3mm 0;
    }

    .invite-qr-img {
      width: 100%;
      height: 100%;
      display: block;
      image-rendering: pixelated;
    }

    .invite-footer {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4mm;
      border-top: 0.8px solid #f1f5f9;
      padding-top: 0.6mm;
    }

    .invite-powered {
      font-size: 3.8pt;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      line-height: 1;
    }

    .invite-f2p-logo {
      height: 4.8mm;
      max-width: 28mm;
      object-fit: contain;
    }

    .f2p-fallback {
      font-size: 5pt;
      font-weight: 800;
      color: #0f172a;
    }

    .invite-url {
      font-family: 'JetBrains Mono', monospace;
      font-size: 4pt;
      font-weight: 600;
      color: #475569;
      letter-spacing: 0.1px;
      line-height: 1;
    }

    @media print {
      html, body {
        background: transparent !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .sheet {
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 235mm !important;
        max-height: 240mm !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        overflow: hidden !important;
      }
      .sheet:not(:last-child) {
        page-break-after: always !important;
        break-after: page !important;
      }
      .sheet:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .no-print {
        display: none !important;
      }
    }

    .print-bar {
      margin-bottom: 16px;
      background: #0f172a;
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      display: flex;
      gap: 15px;
      align-items: center;
      font-size: 13px;
    }

    .print-btn {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <span>🖨️ <strong>Spread de Códigos de Recinto e Invitaciones — Gamescon</strong> (Listo para imprimir / recortar)</span>
    <button class="print-btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
  </div>

  <!-- PÁGINA 1: Set Principal (14 códigos) -->
  <div class="sheet">
    <div class="sheet-header">
      <div>
        <div class="sheet-title">GAMESCON · CÓDIGOS DE RECINTO (HOJA 1 DE 3)</div>
        <div class="sheet-subtitle">Agencia Antropológica Huizinga & PRIME Business School</div>
      </div>
      <div class="sheet-instruction">✂️ Recortar por las líneas punteadas</div>
    </div>
    <div class="cards-grid">
      ${page1Cards}
    </div>
  </div>

  <!-- PÁGINA 2: Set Duplicado / Respaldo (14 códigos) -->
  <div class="sheet">
    <div class="sheet-header">
      <div>
        <div class="sheet-title">GAMESCON · CÓDIGOS DE RECINTO (HOJA 2 DE 3 — RESPALDO)</div>
        <div class="sheet-subtitle">Copias duplicadas de seguridad para dispersión en el recinto</div>
      </div>
      <div class="sheet-instruction">✂️ Recortar por las líneas punteadas</div>
    </div>
    <div class="cards-grid">
      ${page2Cards}
    </div>
  </div>

  <!-- PÁGINA 3: Tarjetas de Invitación al Juego (Formato Vertical Business Card) -->
  <div class="sheet">
    <div class="sheet-header">
      <div>
        <div class="sheet-title">GAMESCON · TARJETAS DE INVITACIÓN AL JUEGO (HOJA 3 DE 3)</div>
        <div class="sheet-subtitle">Tarjetas verticales para entregar en mano a participantes</div>
      </div>
      <div class="sheet-instruction">✂️ Recortar por las líneas punteadas</div>
    </div>
    <div class="invite-grid">
      ${page3Cards}
    </div>
  </div>
</body>
</html>`;

  // Output paths
  const htmlDocPath = path.join(rootDir, 'docs/codigos_recinto_gamescon.html');
  const htmlStaticPath = path.join(rootDir, 'static/docs/gamescon/codigos_recinto_gamescon.html');
  const pdfDocPath = path.join(rootDir, 'docs/codigos_recinto_gamescon.pdf');
  const pdfStaticPath = path.join(rootDir, 'static/docs/gamescon/codigos_recinto_gamescon.pdf');

  fs.mkdirSync(path.dirname(htmlStaticPath), { recursive: true });

  fs.writeFileSync(htmlDocPath, htmlContent, 'utf-8');
  fs.writeFileSync(htmlStaticPath, htmlContent, 'utf-8');
  console.log('Saved HTML to:\n-', htmlDocPath, '\n-', htmlStaticPath);

  // Convert to PDF using headless Chrome
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(chromePath)) {
    console.log('Rendering PDF with Chrome headless...');
    const cmd = `"${chromePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfDocPath}" "${htmlDocPath}"`;
    execSync(cmd);
    fs.copyFileSync(pdfDocPath, pdfStaticPath);
    console.log('Successfully generated PDF:\n-', pdfDocPath, '\n-', pdfStaticPath);
  } else {
    console.warn('Chrome executable not found at standard path, skipped direct PDF conversion.');
  }
}

generate().catch(err => {
  console.error('Error generating codes sheet:', err);
  process.exit(1);
});
